# 5. Forms and the output\_update Protocol

The `output_update` protocol is the mechanism that transforms AI Agent output into structured data your frontend can render in forms, tables, and other UI elements. This chapter provides a deep dive into how `write_output` works on the MCP Server side, how `output_update` events are structured, and how to build robust form synchronization in your Solution frontend.

## Learning Objectives

By the end of this chapter, you will be able to:

- Implement the `write_output` MCP tool in your Solution's MCP Server
- Parse `output_update` events correctly (including the nested structure)
- Handle all three operation types: `set`, `append`, and `merge`
- Implement the SyncCard approval pattern for human-in-the-loop review
- Use the Vue SDK's `useFormBridge` and React SDK's `SyncCardPanel` components

## The write\_output Pipeline

The `write_output` tool is the bridge between AI reasoning and frontend form state. Here is how data flows through the pipeline:

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Agent                                                            │
│                                                                     │
│ "I need to set the task title to 'Fix login bug'"                  │
│                     │                                               │
│                     ▼                                               │
│ Calls write_output({ field: 'title', value: 'Fix login bug' })    │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ MCP Server                                                          │
│                                                                     │
│ 1. Receives tool call                                               │
│ 2. Validates field name against allowed list                        │
│ 3. Validates value against Zod schema                               │
│ 4. Returns { data: { field, value, operation }, status: 'success' } │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ CCAAS Backend                                                       │
│                                                                     │
│ 1. Receives tool result from Agent process                          │
│ 2. Wraps it as an output_update event                               │
│ 3. Pushes via WebSocket to the Solution backend                     │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ Solution Frontend                                                   │
│                                                                     │
│ 1. Receives output_update event                                     │
│ 2. Parses event.payload.data                                        │
│ 3. Updates form state or buffers as pending SyncCard                │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementing write\_output in Your MCP Server

### Basic Implementation

The `write_output` tool is defined in your Solution's MCP Server. Here is a minimal implementation for the Task Manager:

```typescript
// mcp-server/src/index.ts
import express from 'express'
import { z } from 'zod'

const app = express()
app.use(express.json())

// Define valid fields and their schemas
const TaskFieldSchemas = {
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'done']),
  assignee: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  tags: z.array(z.string()),
}

type TaskField = keyof typeof TaskFieldSchemas

// Tool definition endpoint (called by CCAAS to discover tools)
app.get('/tools', (req, res) => {
  res.json([
    {
      name: 'write_output',
      description: 'Write structured data to the frontend form. Call once per field.',
      inputSchema: {
        type: 'object',
        properties: {
          field: {
            type: 'string',
            enum: Object.keys(TaskFieldSchemas),
            description: 'The form field to update',
          },
          value: {
            description: 'The value to set for the field',
          },
          operation: {
            type: 'string',
            enum: ['set', 'append', 'merge'],
            default: 'set',
            description: 'How to apply the update',
          },
        },
        required: ['field', 'value'],
      },
    },
  ])
})

// Tool execution endpoint
app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body

  // Validate field name
  if (!(field in TaskFieldSchemas)) {
    return res.status(400).json({
      error: `Invalid field: "${field}"`,
      validFields: Object.keys(TaskFieldSchemas),
    })
  }

  // Validate value against schema
  const schema = TaskFieldSchemas[field as TaskField]
  const result = schema.safeParse(value)
  if (!result.success) {
    return res.status(400).json({
      error: 'Validation failed',
      field,
      details: result.error.issues,
    })
  }

  // Return structured response
  // CCAAS wraps this as an output_update event
  res.json({
    data: {
      field,
      value: result.data,
      operation,
    },
    status: 'success',
  })
})

app.listen(3004, () => {
  console.log('Task Manager MCP Server running on :3004')
})
```

### Defining write\_output in Your Skill

The Skill instructions tell the AI Agent how to use `write_output`. Be explicit about field names and expected formats:

```markdown
# Output Format

Use the write_output tool to output task data. Call once per field.

Available fields:
- field: "title" -> Task title (string, required)
- field: "description" -> Task description (string, optional)
- field: "priority" -> Priority level: "low" | "medium" | "high" | "urgent"
- field: "status" -> Task status: "todo" | "in_progress" | "done"
- field: "assignee" -> Assigned person's name (string)
- field: "dueDate" -> Due date in ISO 8601 format
- field: "tags" -> Tags array (string[])

Example call sequence:
1. write_output({ field: "title", value: "Fix login bug" })
2. write_output({ field: "priority", value: "high" })
3. write_output({ field: "status", value: "todo" })
4. write_output({ field: "tags", value: ["bug", "auth"] })
```

## The output\_update Event Structure

When the CCAAS backend receives a `write_output` result, it wraps it in an `output_update` WebSocket event. Understanding this structure is critical.

### Event Schema

```typescript
interface OutputUpdateEvent {
  type: 'output_update'
  sessionId: string
  timestamp?: string
  payload: {
    data: {                        // <-- Nested inside payload.data
      field: string                // Field name (e.g., 'title')
      value: unknown               // Field value
      operation?: 'set' | 'append' | 'merge'
      preview?: string             // Human-readable preview
    }
    progressive?: boolean          // Is this part of a streaming sequence?
    complete?: boolean             // Is this the final update?
    status?: string                // 'success' | 'error'
    progress?: number              // 0-100 progress indicator
  }
}
```

{% hint style="danger" %}
**The most common mistake**: Accessing `event.payload.field` instead of `event.payload.data.field`. The data is nested one level deeper than you might expect. Always access field data through `event.payload.data`.
{% endhint %}

### Correct vs Incorrect Parsing

```typescript
socket.on('output_update', (event) => {
  // WRONG - will be undefined
  const field = event.payload.field       // undefined!
  const value = event.payload.value       // undefined!
  const field2 = event.field              // undefined!

  // CORRECT
  const { field, value, operation } = event.payload.data
})
```

### Using the Zod Schema for Validation

The `@ccaas/common` package provides Zod schemas for runtime validation:

```typescript
import { OutputUpdateEventSchema } from '@ccaas/common'

socket.on('output_update', (raw) => {
  const result = OutputUpdateEventSchema.safeParse(raw)
  if (!result.success) {
    console.error('Invalid output_update event:', result.error)
    return
  }

  const event = result.data
  const { field, value, operation } = event.payload
  // field, value, operation are now type-safe
})
```

## Operation Types

The `write_output` tool supports three operation types for different update semantics.

### set -- Replace the Value

The default and most common operation. Replaces the field value entirely:

```typescript
// MCP tool call
write_output({ field: 'title', value: 'Fix login bug', operation: 'set' })

// Frontend handler
case 'set':
  formState[field] = value
  break
```

Use `set` for: scalar fields (strings, numbers, enums), replacing entire arrays, replacing entire objects.

### append -- Add to Existing Value

Appends to an array or concatenates to a string:

```typescript
// MCP tool call - append to array
write_output({
  field: 'tags',
  value: 'urgent',
  operation: 'append'
})

// Frontend handler
case 'append':
  if (Array.isArray(formState[field])) {
    formState[field] = [...formState[field], value]
  } else if (typeof formState[field] === 'string') {
    formState[field] = formState[field] + String(value)
  }
  break
```

Use `append` for: adding items to a list one at a time, building up text incrementally, progressive content generation.

### merge -- Merge into Object

Shallow-merges an object into an existing object field:

```typescript
// MCP tool call - merge into object
write_output({
  field: 'metadata',
  value: { estimatedHours: 4, complexity: 'medium' },
  operation: 'merge'
})

// Frontend handler
case 'merge':
  formState[field] = {
    ...(formState[field] || {}),
    ...value
  }
  break
```

Use `merge` for: updating specific properties of an object field without replacing the whole object, incremental object building.

## Frontend Form Synchronization Patterns

There are two main approaches to handling `output_update` events in the frontend: **direct apply** and **SyncCard approval**.

### Pattern A: Direct Apply

The simplest approach -- apply updates directly to the form as they arrive:

```typescript
// React: Direct apply pattern
function useDirectFormSync(socket: Socket) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  useEffect(() => {
    const handler = (event: OutputUpdateEvent) => {
      const { field, value, operation = 'set' } = event.payload.data

      setFormData(prev => applyOperation(prev, field, value, operation))
    }

    socket.on('output_update', handler)
    return () => { socket.off('output_update', handler) }
  }, [socket])

  return { formData, setFormData }
}

// Shared operation logic
function applyOperation(
  state: Record<string, unknown>,
  field: string,
  value: unknown,
  operation: string
): Record<string, unknown> {
  switch (operation) {
    case 'set':
      return { ...state, [field]: value }
    case 'append': {
      const existing = state[field]
      if (Array.isArray(existing)) {
        return { ...state, [field]: [...existing, value] }
      }
      return { ...state, [field]: (existing || '') + String(value) }
    }
    case 'merge':
      return {
        ...state,
        [field]: { ...(state[field] as object || {}), ...(value as object) },
      }
    default:
      return { ...state, [field]: value }
  }
}
```

**When to use**: Prototyping, simple forms, situations where AI output is always trusted.

### Pattern B: SyncCard Approval (Human-in-the-Loop)

The recommended approach for production Solutions. Updates are buffered as "pending" and presented to the user as SyncCards for approval:

```typescript
// React: SyncCard approval pattern
function useSyncCardManager(socket: Socket) {
  const [pendingUpdates, setPendingUpdates] = useState<OutputUpdate[]>([])
  const [formData, setFormData] = useState<Record<string, unknown>>({})

  // Buffer incoming updates as pending SyncCards
  useEffect(() => {
    const handler = (event: OutputUpdateEvent) => {
      const { field, value } = event.payload.data
      const preview = typeof value === 'string'
        ? value.substring(0, 80)
        : JSON.stringify(value).substring(0, 80)

      setPendingUpdates(prev => {
        // Replace existing update for same field (keep latest)
        const filtered = prev.filter(u => u.field !== field)
        return [...filtered, {
          field,
          value,
          preview,
          synced: false,
          timestamp: Date.now(),
        }]
      })
    }

    socket.on('output_update', handler)
    return () => { socket.off('output_update', handler) }
  }, [socket])

  // User approves: apply to form
  const syncField = (field: string) => {
    const update = pendingUpdates.find(u => u.field === field)
    if (!update) return

    setFormData(prev => ({ ...prev, [field]: update.value }))
    setPendingUpdates(prev =>
      prev.map(u => u.field === field
        ? { ...u, synced: true, syncedAt: new Date() }
        : u
      )
    )
  }

  // User rejects: discard the suggestion
  const discardField = (field: string) => {
    setPendingUpdates(prev => prev.filter(u => u.field !== field))
  }

  return {
    pendingUpdates,
    formData,
    setFormData,
    syncField,
    discardField,
  }
}
```

**When to use**: Production Solutions, forms with important data, situations requiring human review.

### Using the React SDK SyncCardPanel

The `@ccaas/react-sdk` provides ready-to-use components for the SyncCard pattern:

```tsx
import { SyncCardPanel } from '@ccaas/react-sdk'

function TaskForm() {
  const {
    pendingUpdates,
    formData,
    syncField,
    discardField,
  } = useSyncCardManager(socket)

  return (
    <div>
      {/* Form fields */}
      <input
        value={formData.title as string || ''}
        onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
      />

      {/* SyncCard panel at bottom */}
      <SyncCardPanel
        outputUpdates={pendingUpdates}
        onSync={syncField}
        onDiscard={discardField}
        renderSyncCard={(update, onSync, onDiscard) => (
          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <div className="flex-1">
              <div className="text-sm font-medium">{update.field}</div>
              <div className="text-xs text-gray-500">{update.preview}</div>
            </div>
            <button onClick={onSync}>Sync</button>
            <button onClick={onDiscard}>Discard</button>
          </div>
        )}
      />
    </div>
  )
}
```

### Using the Vue SDK FormBridge

The `@ccaas/vue-sdk` provides the `useFormBridge` composable for automatic form registration and synchronization:

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useFormBridge } from '@ccaas/vue-sdk'

const form = reactive({
  title: '',
  description: '',
  priority: 'medium',
  tags: [],
})

const { isActive } = useFormBridge({
  formId: 'task-form',
  readonly: false,
  getFormState: () => ({ ...form }),
  applyFormData: async (data) => {
    Object.assign(form, data)
    return {
      success: true,
      appliedFields: Object.keys(data),
    }
  },
  submit: async () => {
    await saveTask(form)
    return { success: true }
  },
})
</script>

<template>
  <form>
    <div v-if="isActive" class="text-sm text-green-600">
      Connected to AI Agent
    </div>

    <input v-model="form.title" placeholder="Task title" />
    <textarea v-model="form.description" placeholder="Description" />
    <select v-model="form.priority">
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="urgent">Urgent</option>
    </select>
  </form>
</template>
```

The Vue SDK's `FormStateSynchronizer` handles the connection between `output_update` events and your reactive form state automatically:

```
output_update event
       │
       ▼
AgentListener (listens for output_update)
       │
       ▼
FormStateSynchronizer.updateField(formId, field, value, 'agent')
       │
       ▼
Vue reactive form state (auto-updates the template)
```

## Advanced Patterns

### Progressive Output

For long-running tasks, you can send progressive updates to show progress:

```typescript
// MCP Server: Progressive output
app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body

  res.json({
    data: { field, value, operation },
    progressive: true,    // Indicates more updates coming
    complete: false,       // Not the final update
    status: 'success',
    progress: 50,          // 50% done
  })
})
```

The frontend can use `progressive` and `progress` to show loading states:

```typescript
socket.on('output_update', (event) => {
  const { progressive, complete, progress } = event.payload

  if (progressive && !complete) {
    showProgressBar(progress)
  }

  if (complete) {
    hideProgressBar()
  }

  // Always process the data
  const { field, value } = event.payload.data
  updateField(field, value)
})
```

### Field-Level Undo

Track previous values to support undo after sync:

```typescript
interface UndoEntry {
  field: string
  previousValue: unknown
  timestamp: number
}

function useSyncWithUndo(socket: Socket) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])

  const syncField = (field: string, newValue: unknown) => {
    // Save current value for undo
    setUndoStack(prev => [...prev, {
      field,
      previousValue: formData[field],
      timestamp: Date.now(),
    }])

    // Apply new value
    setFormData(prev => ({ ...prev, [field]: newValue }))
  }

  const undoField = (field: string) => {
    const entry = [...undoStack].reverse().find(e => e.field === field)
    if (entry) {
      setFormData(prev => ({ ...prev, [field]: entry.previousValue }))
      setUndoStack(prev => prev.filter(e => e !== entry))
    }
  }

  return { formData, syncField, undoField, undoStack }
}
```

### Batch Updates

When the AI Agent updates multiple fields in sequence, you may want to batch them for a smoother UX:

```typescript
function useBatchedFormSync(socket: Socket, batchWindowMs = 200) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const batchRef = useRef<Record<string, unknown>>({})
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    socket.on('output_update', (event) => {
      const { field, value } = event.payload.data

      // Accumulate updates
      batchRef.current[field] = value

      // Reset debounce timer
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      // Apply batch after window closes
      timerRef.current = setTimeout(() => {
        const batch = { ...batchRef.current }
        batchRef.current = {}
        setFormData(prev => ({ ...prev, ...batch }))
      }, batchWindowMs)
    })

    return () => {
      socket.off('output_update')
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [socket, batchWindowMs])

  return formData
}
```

### Field Label Mapping

Map internal field names to user-friendly labels for the SyncCard UI:

```typescript
const FIELD_LABELS: Record<string, string> = {
  title: 'Task Title',
  description: 'Description',
  priority: 'Priority',
  status: 'Status',
  assignee: 'Assigned To',
  dueDate: 'Due Date',
  tags: 'Tags',
}

// In SyncCard rendering
<OutputUpdateCard
  field={update.field}
  fieldLabel={FIELD_LABELS[update.field] || update.field}
  preview={update.preview}
  onSync={() => syncField(update.field)}
  onDiscard={() => discardField(update.field)}
/>
```

## Complete Example: Task Manager Form Sync

Here is a complete, runnable example that ties together all the concepts in this chapter:

```typescript
// hooks/useTaskFormSync.ts
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Socket } from 'socket.io-client'

interface TaskFormData {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'done'
  assignee: string
  tags: string[]
}

interface PendingUpdate {
  field: keyof TaskFormData
  value: unknown
  preview: string
  synced: boolean
  syncedAt?: Date
  timestamp: number
}

const INITIAL_FORM: TaskFormData = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  assignee: '',
  tags: [],
}

export function useTaskFormSync(socket: Socket | null) {
  const [formData, setFormData] = useState<TaskFormData>(INITIAL_FORM)
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([])

  // Listen for output_update events
  useEffect(() => {
    if (!socket) return

    const handler = (event: any) => {
      // CORRECT: access nested payload.data
      const data = event.payload?.data
      if (!data?.field) return

      const { field, value } = data
      const preview = typeof value === 'string'
        ? value.substring(0, 100)
        : Array.isArray(value)
        ? `[${value.length} items]`
        : JSON.stringify(value).substring(0, 100)

      setPendingUpdates(prev => {
        const filtered = prev.filter(u => u.field !== field)
        return [...filtered, {
          field: field as keyof TaskFormData,
          value,
          preview,
          synced: false,
          timestamp: Date.now(),
        }]
      })
    }

    socket.on('output_update', handler)
    return () => { socket.off('output_update', handler) }
  }, [socket])

  // Sync a single field
  const syncField = useCallback((field: string) => {
    const update = pendingUpdates.find(u => u.field === field)
    if (!update) return

    setFormData(prev => ({
      ...prev,
      [field]: update.value,
    }))

    setPendingUpdates(prev =>
      prev.map(u =>
        u.field === field
          ? { ...u, synced: true, syncedAt: new Date() }
          : u
      )
    )
  }, [pendingUpdates])

  // Sync all pending fields
  const syncAll = useCallback(() => {
    const updates: Partial<TaskFormData> = {}
    for (const u of pendingUpdates.filter(u => !u.synced)) {
      updates[u.field] = u.value as any
    }

    setFormData(prev => ({ ...prev, ...updates }))
    setPendingUpdates(prev =>
      prev.map(u => ({ ...u, synced: true, syncedAt: new Date() }))
    )
  }, [pendingUpdates])

  // Discard a field
  const discardField = useCallback((field: string) => {
    setPendingUpdates(prev => prev.filter(u => u.field !== field))
  }, [])

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM)
    setPendingUpdates([])
  }, [])

  return {
    formData,
    setFormData,
    pendingUpdates,
    syncField,
    syncAll,
    discardField,
    resetForm,
  }
}
```

## Troubleshooting

### output\_update events not arriving

1. Verify the MCP Server is registered with CCAAS (check `solution.json`)
2. Verify the Skill's `allowedTools` includes `write_output`
3. Check that the Solution backend relays `output_update` events from CCAAS
4. Use browser DevTools to inspect WebSocket frames

### Fields updating with wrong values

1. Add Zod validation in your MCP Server's `write_output` handler
2. Ensure the field names in the Skill instructions match the MCP Server's valid fields
3. Log the raw `output_update` event to verify the nested structure

### SyncCards not appearing

1. Confirm the frontend is listening for `output_update` on the correct socket
2. Verify the `event.payload.data` path is being parsed (not `event.payload`)
3. Check that pending updates are not being filtered out (check `synced` flag)

### Type mismatches between AI output and form

1. Define strict Zod schemas in your MCP Server for each field
2. Specify exact types in the Skill instructions (e.g., "string[]" not just "array")
3. Use the same TypeScript interfaces in both MCP Server and frontend

## Exercises

### Exercise 5.1: Implement write\_output

Create a `write_output` handler for the Task Manager MCP Server with the following fields:

- `title` (string, 1-200 chars)
- `description` (string, max 2000 chars)
- `priority` (enum: low/medium/high/urgent)
- `subtasks` (array of { title: string, done: boolean })

Include Zod validation for each field.

### Exercise 5.2: Handle output\_update

Write a React hook that:
1. Listens for `output_update` events
2. Correctly parses the nested `payload.data` structure
3. Handles all three operation types (`set`, `append`, `merge`)
4. Provides a `pendingUpdates` array for SyncCard rendering

### Exercise 5.3: Design a SyncCard Flow

For the Task Manager, design the complete SyncCard flow for when the AI generates a task with 5 fields (title, description, priority, assignee, tags):

1. What order should the SyncCards appear?
2. Should the user approve each field individually, or all at once?
3. What happens if the user edits a field manually and then the AI sends an update for the same field?
4. How would you handle the "Sync All" action?

Draw a state diagram showing all possible states of a SyncCard.

## Key Takeaways

1. **`write_output` is a standard MCP tool** -- implement it in your MCP Server with field validation
2. **`output_update` uses nested structure** -- always access `event.payload.data.field`, never `event.field`
3. **Three operation types** -- `set` (replace), `append` (add), `merge` (shallow merge)
4. **SyncCard pattern** enables human-in-the-loop review -- buffer updates and let users approve
5. **The Vue SDK provides `useFormBridge`** and the React SDK provides `SyncCardPanel` and `OutputUpdateCard` for built-in form sync
6. **Validate both sides** -- Zod schemas in MCP Server, type-safe handlers in frontend

## What's Next

In [Chapter 6](06-implementation/README.md), we will put everything together and build the complete Task Manager Solution step by step -- from project setup to a working application with backend, MCP Server, Skills, and frontend.
