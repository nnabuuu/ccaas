# 5. Forms and the output\_update Protocol

The `output_update` protocol bridges AI Agent output and frontend form state. When the Agent calls the `write_output` MCP tool, the CCAAS backend emits an `output_update` WebSocket event that the frontend can parse and present as a SyncCard for human approval. This chapter explains how `write_output` works, the event structure (including its nested `payload.data` format), and the SyncCard approval pattern used in production.

## Learning Objectives

By the end of this chapter, you will be able to:

- Implement the `write_output` MCP tool using `@modelcontextprotocol/sdk`
- Parse `output_update` events correctly (including the nested `payload.data` structure)
- Use the react-sdk's `useAgentChat` `onOutputUpdate` callback
- Implement the SyncCard approval pattern with field-level sync, discard, and undo
- Use the react-sdk's `OutputUpdateCard` component

## The write\_output Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI Agent                                                            │
│                                                                     │
│ Calls write_output({ field: 'objectives', value: '...', preview })  │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ MCP Server (@modelcontextprotocol/sdk)                              │
│                                                                     │
│ 1. Validates field name against SYNC_FIELDS enum                    │
│ 2. Validates value with Zod schema (auto-fix if possible)           │
│ 3. Returns JSON: { data: { field, value, preview }, status }        │
│    wrapped in MCP content blocks: [{ type: 'text', text: JSON }]    │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ CCAAS Backend (EventMapperService)                                  │
│                                                                     │
│ 1. Parses tool result from Agent stdout                             │
│ 2. Detects { data: { field, value }, status } structure             │
│ 3. Emits output_update WebSocket event with payload.data            │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ react-sdk (useAgentChat)                                            │
│                                                                     │
│ 1. Listens for output_update on socket                              │
│ 2. parseOutputUpdate() normalizes multiple formats                  │
│ 3. Calls onOutputUpdate({ field, value, preview }) callback         │
│ 4. Attaches to current assistant message's outputUpdates[]           │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────────┐
│ Solution Frontend                                                   │
│                                                                     │
│ 1. onOutputUpdate callback adds to pendingUpdates Map               │
│ 2. SyncCard UI shows "Sync to Form" / "Discard" buttons            │
│ 3. User approves → value written to form state                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementing write\_output in Your MCP Server

The MCP server uses `@modelcontextprotocol/sdk` (not Express). Here is a simplified example based on the lesson-plan-designer MCP server.

### Tool Definition

```typescript
// mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

const SYNC_FIELDS = ['title', 'description', 'priority', 'status', 'tags'] as const
type SyncField = typeof SYNC_FIELDS[number]

const server = new Server(
  { name: 'my-solution', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

const writeOutputTool: Tool = {
  name: 'write_output',
  description: `Write structured data to the frontend form.
The frontend will display a "Sync to Form" button allowing the user to apply changes.

Valid fields: ${SYNC_FIELDS.join(', ')}

Example:
{
  "field": "title",
  "value": "Fix login bug",
  "preview": "Updated task title"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...SYNC_FIELDS],
        description: 'The form field to update',
      },
      value: {
        description: 'The value for the field',
      },
      preview: {
        type: 'string',
        description: 'Human-readable summary shown on the sync button',
      },
    },
    required: ['field', 'value', 'preview'],
  },
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [writeOutputTool],
}))
```

### Tool Handler

The handler validates the input and returns the result in a specific JSON structure. The CCAAS backend EventMapper looks for `{ data: { field, value }, status }` in the tool result content to emit `output_update` events.

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'write_output') {
    const { field, value, preview } = args as {
      field: string; value: unknown; preview: string
    }

    // Validate field name
    if (!SYNC_FIELDS.includes(field as SyncField)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            data: { error: `Invalid field: ${field}` },
            status: 'error',
          }),
        }],
        isError: true,
      }
    }

    // Return structured result
    // EventMapper detects this { data: { field, value }, status } structure
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { field, value, preview },
          status: 'success',
        }),
      }],
    }
  }

  return {
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    isError: true,
  }
})

// Start server
const transport = new StdioServerTransport()
await server.connect(transport)
```

**Key points:**
- The tool result must be a JSON string inside a content block `[{ type: 'text', text: '...' }]`
- The JSON must have the shape `{ data: { field, value, preview? }, status: 'success' }`
- The EventMapper in the CCAAS backend detects this structure and emits `output_update`

### Adding Zod Validation

For production use, validate the value against a schema before returning. The lesson-plan-designer MCP server uses a `validateAndFixField` function that can auto-correct common issues (e.g., coercing a string `"3"` to number `3` for a numeric field).

```typescript
// mcp-server/src/schemas.ts
import { z } from 'zod'

const fieldSchemas: Record<string, z.ZodSchema> = {
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['todo', 'in_progress', 'done']),
  tags: z.array(z.string()),
}

export function validateField(field: string, value: unknown) {
  const schema = fieldSchemas[field]
  if (!schema) return { success: false, errors: ['Unknown field'] }
  const result = schema.safeParse(value)
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues.map(i => i.message) }
}
```

## The output\_update Event Structure

When the CCAAS backend receives a `write_output` tool result, EventMapper wraps it as an `output_update` WebSocket event. The `@ccaas/common` package defines the schema:

```typescript
// From @ccaas/common - OutputUpdatePayloadSchema (Zod)
{
  field?: string,          // Field name (when using generic format)
  value?: unknown,         // Field value (when using generic format)
  operation?: 'set' | 'append' | 'merge',
  progressive?: boolean,
  complete?: boolean,
  data?: unknown,          // Nested data from write_output (primary format)
  status?: string,
  progress?: number,
}
```

The full event shape received by the frontend:

```typescript
{
  type: 'output_update',
  sessionId: 'session-abc',
  timestamp: '2026-02-15T10:30:00Z',
  payload: {
    data: {                    // <-- Nested inside payload.data
      field: 'objectives',     // Field name
      value: '...',            // Field value
      preview: '2 objectives', // Human-readable summary
    },
    status: 'success',
  }
}
```

{% hint style="danger" %}
**The most common mistake**: Accessing `event.payload.field` instead of `event.payload.data.field`. The data returned by `write_output` is nested one level deeper than you might expect. Always access field data through `event.payload.data`.

This was a real production bug in the lesson-plan-designer: the frontend defined a local `OutputUpdateEvent` type expecting a flat structure, but the backend EventMapper sends a nested `payload.data` structure. The fix was to use the `@ccaas/common` type and create a proper parser.
{% endhint %}

### Multiple Event Formats

The backend can send `output_update` events in multiple formats depending on how the data arrives. The react-sdk's `parseOutputUpdate` function handles all three:

```typescript
// From packages/react-sdk/src/utils/parseOutputUpdate.ts

// Format 1: payload.data.field (primary - from write_output MCP tool)
event.payload.data = { field: 'title', value: '...', preview: '...' }

// Format 2: payload.data as content blocks array
event.payload.data = [{ type: 'text', text: '{"data":{"field":"title","value":"..."}}' }]

// Format 3: payload.field (generic/legacy format)
event.payload = { field: 'title', value: '...' }
```

You do not need to handle these formats manually if you use the react-sdk's `onOutputUpdate` callback. The SDK normalizes them into a consistent `OutputUpdate` structure:

```typescript
interface OutputUpdate {
  field: string
  value: unknown
  preview: string
  synced?: boolean
  syncedAt?: Date
  timestamp?: number
}
```

## Receiving output\_update in the Frontend

### Using the react-sdk (Recommended)

The `useAgentChat` hook provides an `onOutputUpdate` callback that fires whenever a valid `output_update` event is received. The SDK handles parsing, format normalization, and message attachment automatically.

```typescript
// From solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

import { useAgentConnection, useAgentChat } from '@ccaas/react-sdk'

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // Core CCAAS backend
  tenantId: 'my-solution',
  autoConnect: true,
})

const chat = useAgentChat({
  connection,
  tenantId: 'my-solution',
  mcpServers: solutionConfig?.mcpServers,
  skillPath: solutionConfig?.skillPath,
  onOutputUpdate: (update) => {
    // update = { field, value, preview, timestamp }
    // Bridge to your sync state management
    addPendingUpdate({
      field: update.field,
      value: update.value,
      preview: update.preview,
    })
  },
})
```

The SDK also handles a secondary detection path: when a `tool_event` fires for a tool named `*write_output`, the SDK extracts `{ field, value }` from the tool input and calls the same `onOutputUpdate` callback. This ensures output updates are captured even if the `output_update` event is missed.

### Manual Parsing (Without SDK)

If you are not using the react-sdk, you can parse the event manually. Use the `@ccaas/common` types for type safety:

```typescript
import type { OutputUpdateEvent } from '@ccaas/common'

socket.on('output_update', (event: OutputUpdateEvent) => {
  // Try payload.data first (primary format)
  const data = event.payload.data as { field?: string; value?: unknown; preview?: string }
  if (data?.field) {
    handleUpdate(data.field, data.value, data.preview)
    return
  }

  // Fallback to payload.field (generic format)
  if (event.payload.field) {
    handleUpdate(event.payload.field, event.payload.value, '')
  }
})
```

## The SyncCard Approval Pattern

In production Solutions, AI-generated field updates should not be applied directly to the form. Instead, they are buffered as "pending" and presented to the user as SyncCards for review.

### Architecture Overview

```
onOutputUpdate({ field, value, preview })
        │
        ▼
  addPendingUpdate()  ──→  pendingUpdates Map<SyncField, OutputUpdate>
        │
        ▼
  SyncCard UI  ──→  "Sync to Form" | "Discard"
        │                    │
        ▼                    ▼
  syncToForm(field)    discardUpdate(field)
        │                    │
        ▼                    ▼
  Update form state    Remove from pendingUpdates
  Add to undoStack
  Mark as synced
```

### The useLessonPlanSync Hook (Real Implementation)

The lesson-plan-designer implements this pattern with a dedicated hook. The key design decisions:

1. **Map-based storage** (`Map<SyncField, OutputUpdate>`) -- same-field updates are deduplicated automatically
2. **Value normalization** -- each field type has specific coercion rules (e.g., `gradeLevel` is always a number)
3. **Timed undo** -- the previous value is stored for 30 seconds after sync

```typescript
// Simplified from solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSync.ts

export function useLessonPlanSync() {
  const [pendingUpdates, setPendingUpdates] = useState<Map<SyncField, OutputUpdate>>(new Map())
  const [modifiedFields, setModifiedFields] = useState<Set<SyncField>>(new Set())
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])

  // Add a pending update from AI
  const addPendingUpdate = useCallback((update: OutputUpdate) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.set(update.field, update)  // Deduplicates by field name
      return next
    })
  }, [])

  // Sync: apply AI value to form, save previous for undo
  const syncToForm = useCallback((field, lessonPlan, setLessonPlan) => {
    const update = pendingUpdates.get(field)
    if (!update) return

    const normalizedValue = normalizeFieldValue(field, update.value)
    const previousValue = lessonPlan[field]

    setLessonPlan({ ...lessonPlan, [field]: normalizedValue })
    setModifiedFields(prev => new Set(prev).add(field))
    setUndoStack(prev => [...prev.filter(e => e.field !== field), {
      field, previousValue, timestamp: Date.now()
    }])

    // Mark as synced (keep in map for re-sync)
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.set(field, { ...update, synced: true, syncedAt: new Date() })
      return next
    })

    // Auto-expire undo after 30 seconds
    setTimeout(() => {
      setUndoStack(prev => prev.filter(e => e.field !== field))
    }, 30000)
  }, [pendingUpdates])

  // Discard: remove suggestion
  const removePendingUpdate = useCallback((field: SyncField) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }, [])

  return { pendingUpdates, modifiedFields, addPendingUpdate, syncToForm, removePendingUpdate, ... }
}
```

### Value Normalization

A subtle but important detail: the AI may return values in unexpected formats (e.g., a string `"3"` for a numeric field). The sync hook normalizes values per field type:

```typescript
// From solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSync.ts

function normalizeFieldValue(field: SyncField, value: unknown): unknown {
  value = parseJsonIfString(value)  // Parse "[1,2,3]" strings to arrays

  if (field === 'gradeLevel' || field === 'durationMinutes') {
    return Number(value) || (field === 'gradeLevel' ? 1 : 45)
  }

  if (field === 'curriculumRequirements') {
    return Array.isArray(value) ? value : []
  }

  if (field === 'extraProperties') {
    return (typeof value === 'object' && !Array.isArray(value)) ? value : {}
  }

  // All other fields: string
  return value == null ? null : String(value)
}
```

### Sync All

The lesson-plan-designer supports syncing all pending updates at once. This iterates through the `pendingUpdates` map and calls `syncToForm` for each field:

```typescript
// From solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts

const syncAll = useCallback(async () => {
  if (!crud.lessonPlan) return

  const allFields = Array.from(pendingUpdates.keys())
  for (const field of allFields) {
    await syncToForm(field)
  }
}, [crud.lessonPlan, pendingUpdates, syncToForm])
```

## UI Components

### OutputUpdateCard (react-sdk)

The `@ccaas/react-sdk` provides a generic `OutputUpdateCard` component that renders pending updates with Sync/Discard actions and synced state with a Re-sync option.

```tsx
import { OutputUpdateCard } from '@ccaas/react-sdk'

<OutputUpdateCard
  field="objectives"
  fieldLabel="Learning Objectives"
  preview="2 learning objectives about fractions"
  synced={false}
  onSync={() => syncToForm('objectives')}
  onDiscard={() => discardUpdate('objectives')}
/>
```

Props:

| Prop | Type | Description |
|------|------|-------------|
| `field` | `string` | Internal field name |
| `fieldLabel` | `string` | Human-readable label shown in the card |
| `preview` | `string` | Preview text of the AI-suggested value |
| `synced` | `boolean` | Whether the field has been synced |
| `syncedAt` | `Date` | Timestamp of last sync |
| `icon` | `'sync' \| 'attach' \| ReactNode` | Icon to display |
| `syncLabel` | `string` | Custom label for the sync button |
| `onSync` | `() => void` | Called when user clicks Sync |
| `onDiscard` | `() => void` | Called when user clicks Discard |

### Field Label Mapping

Solutions define a mapping from internal field names to user-friendly labels:

```typescript
// From solutions/lesson-plan-designer/frontend/src/components/SyncButton.tsx

const FIELD_LABELS: Record<SyncField, string> = {
  title: 'Title',
  subject: 'Subject',
  gradeLevel: 'Grade',
  durationMinutes: 'Duration',
  objectives: 'Learning Objectives',
  content: 'Lesson Content',
  teachingMethods: 'Teaching Methods',
  materialsNeeded: 'Materials',
  assessmentMethods: 'Assessment',
  // ... etc
}

// Solution wrapper around OutputUpdateCard
export function SyncButton({ field, preview, synced, syncedAt, onSync, onDiscard }) {
  return (
    <OutputUpdateCard
      field={field}
      fieldLabel={FIELD_LABELS[field]}
      preview={preview}
      synced={synced}
      syncedAt={syncedAt}
      onSync={onSync}
      onDiscard={onDiscard}
    />
  )
}
```

### GlobalSyncSection

The lesson-plan-designer also provides a collapsible global sync area that shows all pending updates with a "Sync All" button:

```tsx
// From solutions/lesson-plan-designer/frontend/src/components/sync/GlobalSyncSection.tsx

<GlobalSyncSection
  pendingUpdates={pendingUpdatesWithMeta}
  onSyncAll={syncAll}
  onSyncField={syncToForm}
  onDiscardField={discardUpdate}
/>
```

This component:
- Shows a count of unsynced and synced updates in the header
- Expands to show individual sync items with per-field Sync/Discard
- Provides a "Sync All" button to apply everything at once
- Auto-collapses when all updates are synced

## Defining write\_output in Your Skill

The Skill instructions tell the AI Agent which fields are available and what format each expects. Be explicit about field names, types, and the `preview` parameter:

```markdown
# Output Format

Use the write_output tool to send structured data to the frontend form.
The user will see a "Sync to Form" button for each field you update.

Call write_output once per field. Always include a human-readable preview.

Available fields:
- field: "title"       -> string, task title
- field: "description" -> string, task description (max 2000 chars)
- field: "priority"    -> "low" | "medium" | "high" | "urgent"
- field: "status"      -> "todo" | "in_progress" | "done"
- field: "tags"        -> string[], list of tags

Example:
1. write_output({ field: "title", value: "Fix login bug", preview: "Updated title" })
2. write_output({ field: "priority", value: "high", preview: "Set to high priority" })
3. write_output({ field: "tags", value: ["bug", "auth"], preview: "2 tags" })
```

## Troubleshooting

### output\_update events not arriving

1. Verify the MCP server is registered in your solution config (`mcpServers` in `useAgentChat`)
2. Verify the MCP tool returns JSON with the `{ data: { field, value }, status }` structure
3. Check the CCAAS backend logs for EventMapper parsing errors
4. Use browser DevTools Network tab to inspect WebSocket frames for `output_update`

### SyncCards not appearing

1. Confirm the `onOutputUpdate` callback is provided to `useAgentChat`
2. Verify the callback correctly adds to `pendingUpdates` state
3. Check that the component rendering SyncCards reads from the same state
4. Log the raw event to verify the `payload.data.field` path exists

### Type mismatches between AI output and form

1. Add Zod validation in your MCP server's `write_output` handler
2. Add normalization in your sync hook (see `normalizeFieldValue` above)
3. Specify exact types in the Skill instructions (e.g., `string[]` not just "array")

### Synced values not persisting

1. Verify `syncToForm` updates the form state object (not a stale copy)
2. Check that the form state is connected to your save/persistence logic
3. Ensure `normalizeFieldValue` returns the correct type for your form's schema

## Key Takeaways

1. **`write_output` uses `@modelcontextprotocol/sdk`** -- not Express. The tool result must return JSON with `{ data: { field, value, preview }, status }` inside MCP content blocks.

2. **`output_update` has nested structure** -- always access `event.payload.data.field`, never `event.payload.field`. This was a real production bug.

3. **Use the react-sdk `onOutputUpdate` callback** -- it handles format normalization, fallback paths, and message attachment automatically.

4. **SyncCard pattern is the production approach** -- buffer updates in a Map, present Sync/Discard UI, support undo with a timeout.

5. **Normalize field values** -- the AI may return strings for numeric fields or JSON strings for array fields. Always normalize before writing to form state.

6. **`OutputUpdateCard` from react-sdk** -- provides a ready-to-use component. Solutions wrap it with field label mappings.

## What's Next

In [Chapter 6](06-implementation/README.md), we will put everything together and build a complete Solution step by step -- from project setup to a working application with backend, MCP Server, Skills, and frontend.
