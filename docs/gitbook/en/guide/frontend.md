# Frontend Integration Guide

## Overview

CCAAS provides official SDKs for both Vue (`@kedge-agentic/vue-sdk`) and React (`@kedge-agentic/react-sdk`), using SSE (Server-Sent Events) as the default real-time transport.

## Vue SDK Integration

### Installation

```bash
npm install @kedge-agentic/vue-sdk@0.1.0
```

### Architecture

The Vue SDK follows a composables-first design with a three-layer architecture:

```
Composables Layer (used directly by developers)
├── useAgentState    - Agent connection and processing state
├── useFormBridge    - Bridge between forms and Agent data
├── useAIEditing     - AI editing mode management
├── usePlanMode      - Plan mode management
├── useTodoProgress  - Task progress tracking
└── useToolActivity  - Tool activity monitoring

Services Layer (internal to the SDK)
└── FormStateSynchronizer - Form state synchronization singleton

Types & Symbols Layer
└── 40+ injection keys
```

### Quick Start

```vue
<!-- App.vue -->
<template>
  <AgentListener>
    <RouterView />
  </AgentListener>
</template>
```

```vue
<!-- Using composables in a component -->
<script setup lang="ts">
import { useAgentState, useTodoProgress } from '@kedge-agentic/vue-sdk'

const { isProcessing, currentToolName } = useAgentState()
const { progress, currentTodo, isComplete } = useTodoProgress()
</script>

<template>
  <div v-if="isProcessing" class="agent-status">
    <span>Executing: {{ currentToolName }}</span>
    <ProgressBar :value="progress" />
  </div>
</template>
```

### Form Bridge

Use `useFormBridge` to enable two-way data synchronization between the AI Agent and forms:

```typescript
import { useFormBridge } from '@kedge-agentic/vue-sdk'

const form = reactive({ title: '', content: '' })

const { isActive } = useFormBridge({
  formId: 'my-form',
  readonly: false,
  getFormState: () => ({ ...form }),
  applyFormData: async (data) => {
    Object.assign(form, data)
    return { success: true, appliedFields: Object.keys(data) }
  },
  submit: async () => {
    await saveForm()
    return { success: true }
  }
})
```

### AI Editing Mode

Use `useAIEditing` to manage batch AI edits:

```typescript
import { useAIEditing } from '@kedge-agentic/vue-sdk'

const {
  aiEditingMode,
  aiCurrentSection,
  progress,
  startAIEditing,
  updateFromAI,
  completeAISection,
  finishAIEditing
} = useAIEditing({
  allSections: ['objectives', 'activities', 'assessment'],
  onSectionUpdate: (id, content) => {
    formData.value[id] = content
  },
  onComplete: () => {
    console.log('AI editing complete')
  }
})
```

## React SDK Integration (@kedge-agentic/react-sdk)

### Installation

```bash
npm install @kedge-agentic/react-sdk@0.1.0
```

### Core Hooks

The React SDK provides six essential hooks for Solution development:

| Hook | Responsibility |
|------|---------------|
| `useAgentConnection` | SSE connection (default), session ID persistence, reconnection |
| `useAgentChat` | Message history, text streaming, send via REST, conversation lifecycle |
| `useAgentStatus` | Tool activity, thinking state, SubAgent tracking, todo items |
| `usePageContext` | Sends current page/form state as context with every message |
| `useFiles` | Session file listing, upload, download, new-file tracking |
| `useOutputSync` | Pending state management for AI output fields (output_update → Sync → apply) |

#### 1. useAgentConnection

Manages connection to CCAAS backend (SSE by default):

```typescript
import { useAgentConnection } from '@kedge-agentic/react-sdk'

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // CCAAS backend (absolute URL required)
  tenantId: 'lesson-plan-designer',
  autoConnect: true,
})

// connection.connected  - Whether connected
// connection.sessionId  - Current session ID (persisted in localStorage)
// connection.sendMessage(message, sessionId) - Send chat message
// connection.cancelCompletion(sessionId) - Cancel ongoing request
```

When `tenantId` is provided, the session ID is persisted in `localStorage` under `ccaas_session_{tenantId}`. On page refresh, the same session is recovered automatically.

#### 2. useAgentChat

Manages chat messages and streaming:

```typescript
import { useAgentChat } from '@kedge-agentic/react-sdk'

const chat = useAgentChat({
  connection,
  tenantId,
  sessionTemplate: 'your-template-name',  // resolved server-side from session templates
  context,  // from usePageContext - attached to every message
  onOutputUpdate: (update) => {
    // Handle AI-generated field updates (field, value, preview)
    console.log('Output update:', update.field, update.value)
  },
})

// chat.messages            - Array of chat messages
// chat.isProcessing        - Whether AI is currently responding
// chat.currentStreamContent - Current streaming text
// chat.isLoadingHistory    - Whether message history is being fetched
// chat.sendMessage(content) - Send a message
// chat.cancelProcessing()   - Cancel current processing
// chat.clearConversation()  - Clear messages and start a new session
```

#### 3. useAgentStatus

Tracks Agent processing state, SubAgents, and tool activity:

```typescript
import { useAgentStatus } from '@kedge-agentic/react-sdk'

const status = useAgentStatus({ connection })

// status.activeTools      - Map of currently executing tools
// status.isThinking       - Whether Agent is in thinking state
// status.thinkingContent  - Current thinking text
// status.activeSubAgents  - Array of running SubAgents
// status.tokenUsage       - { inputTokens, outputTokens, cacheReadTokens }
// status.todoItems        - Array of todo items from the Agent
// status.todoStats        - Aggregated todo progress statistics
```

SubAgent tracking is handled entirely via SSE events (`subagent_started`, `subagent_completed`) -- no polling required.

#### 4. usePageContext

Context-aware Skill triggering -- sends current page state with every chat message:

```typescript
import { usePageContext } from '@kedge-agentic/react-sdk'

const { context, updateContext } = usePageContext()

// Update context whenever the form changes
useEffect(() => {
  if (lessonPlan) {
    updateContext('lesson-plan-editor', {
      lessonPlanId: lessonPlan.id,
      currentForm: {
        title: lessonPlan.title,
        subject: lessonPlan.subject,
        objectives: lessonPlan.objectives,
      },
    })
  }
}, [lessonPlan, updateContext])
```

Pass `context` to `useAgentChat` so it is automatically attached to every message sent to the backend.

#### 5. useFiles

File upload and management for the current session:

```typescript
import { useFiles } from '@kedge-agentic/react-sdk'

const files = useFiles({
  connection,
  sessionId: connection.sessionId,
  enabled: connection.connected,
})

// files.files          - Array of FileMetadata
// files.newFilesCount  - Number of unread files (for badge display)
// files.hasNewFiles    - Boolean shortcut
// files.uploadFile     - Upload a file to the session
// files.markAsSynced   - Mark a file as seen
// files.markAllSeen    - Mark all files as seen
```

#### 6. useOutputSync

Manages the pending state for AI output fields (`output_update` event → user clicks Sync → applied to form).

```typescript
import { useOutputSync } from '@kedge-agentic/react-sdk'

const { pendingUpdates, addPendingUpdate, removePendingUpdate, clearPendingUpdates } =
  useOutputSync()

// When an output_update event arrives (typically in useAgentChat's onOutputUpdate callback)
const chat = useAgentChat({
  connection,
  onOutputUpdate: (update) => addPendingUpdate(update.field, update.value),
})

// When the user clicks the Sync button for a field
const handleSync = (field: string) => {
  applyField(field)           // Apply to form
  removePendingUpdate(field)  // Clear pending state
}

// Clear all pending updates
clearPendingUpdates()
```

**Returns:**
- `pendingUpdates` - `Record<string, any>` — Current pending fields and their values
- `addPendingUpdate(field, value)` - Add or update a pending field
- `removePendingUpdate(field)` - Remove a specific pending field
- `clearPendingUpdates()` - Remove all pending fields

> This hook replaces 30+ lines of pending state boilerplate found in every Solution frontend. Already used in rehab-motion-renderer and lesson-plan-designer.

### Pre-built Components

The React SDK also provides ready-to-use UI components:

| Component | Purpose |
|-----------|---------|
| `ChatPanel` | Complete chat interface with tabs (messages, files, tasks) |
| `AgentActivityLine` | Compact status bar showing active tools, thinking, SubAgents |
| `OutputUpdateCard` | Renders a pending AI update with sync/discard actions |
| `SubAgentCard` | Shows SubAgent type, description, and live duration timer |
| `MessageBubble` | Single message display with markdown rendering |
| `FilePanel` | File browser with icons, sizes, and download buttons |
| `TasksView` | SubAgent and todo task list with grouping |
| `TokenBadge` | Displays token usage statistics |

### Complete Integration Example

A typical Solution composes the six hooks inside a single session hook, then passes the state to components:

```typescript
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  useFiles,
  useOutputSync,
} from '@kedge-agentic/react-sdk'

export function useMySession(options = {}) {
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    tenantId: 'my-solution',
    autoConnect: true,
  })

  const { context, updateContext } = usePageContext()
  const { pendingUpdates, addPendingUpdate, removePendingUpdate } = useOutputSync()

  const chat = useAgentChat({
    connection,
    tenantId: 'my-solution',
    context,
    onOutputUpdate: (update) => addPendingUpdate(update.field, update.value),
  })

  const status = useAgentStatus({ connection })
  const files = useFiles({ connection, sessionId: connection.sessionId, enabled: connection.connected })

  return { connection, chat, status, files, context, updateContext, pendingUpdates, removePendingUpdate }
}
```

See tutorial [Chapter 6.5](../tutorial/06-implementation/05-frontend.md) for a complete working example with the Lesson Plan Designer.

## Custom React Integration (Advanced / Legacy Socket.io)

{% hint style="warning" %}
The following patterns use the legacy Socket.io transport. **New Solutions should use `@kedge-agentic/react-sdk` with the default SSE transport.** Only use these patterns if you need full control over the low-level connection.
{% endhint %}

> For most use cases, prefer using `@kedge-agentic/react-sdk` hooks documented above.

The following patterns show how to integrate directly via Socket.io without the SDK (legacy approach), for cases where you need full control over the connection and event handling.

### useSocket Hook

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket(url: string) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    socketRef.current = io(url)
    return () => { socketRef.current?.disconnect() }
  }, [url])

  const sendMessage = useCallback((message: string, sessionId?: string) => {
    socketRef.current?.emit('chat', { message, sessionId })
  }, [])

  const cancel = useCallback((sessionId: string) => {
    socketRef.current?.emit('cancel', { sessionId })
  }, [])

  return { socket: socketRef.current, sendMessage, cancel }
}
```

### Event Handling

```typescript
useEffect(() => {
  if (!socket) return

  // Text streaming
  socket.on('text_delta', (data) => {
    setMessages(prev => appendText(prev, data.delta))
  })

  // Structured output
  socket.on('output_update', (event) => {
    const { field, value } = event.payload.data
    setFormData(prev => ({ ...prev, [field]: value }))
  })

  // Agent status
  socket.on('agent_status', (data) => {
    setAgentStatus(data.status)
  })

  // Tool activity
  socket.on('tool_activity', (data) => {
    setCurrentTool(data.toolName)
  })

  return () => {
    socket.off('text_delta')
    socket.off('output_update')
    socket.off('agent_status')
    socket.off('tool_activity')
  }
}, [socket])
```

### Sync Management

> **If you are using `@kedge-agentic/react-sdk`**, use [`useOutputSync`](#6-useoutputsync) instead — it provides this pattern out of the box.

The following shows the raw implementation for custom integrations that bypass the SDK:

```typescript
export function useSyncManager() {
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any>>({})

  // Buffer incoming output_update events
  const handleOutputUpdate = (field: string, value: any) => {
    setPendingUpdates(prev => ({ ...prev, [field]: value }))
  }

  // Apply when user clicks the sync button
  const applyUpdate = (field: string) => {
    const value = pendingUpdates[field]
    setFormData(prev => ({ ...prev, [field]: value }))
    setPendingUpdates(prev => {
      const { [field]: _, ...rest } = prev
      return rest
    })
  }

  // Discard an update
  const discardUpdate = (field: string) => {
    setPendingUpdates(prev => {
      const { [field]: _, ...rest } = prev
      return rest
    })
  }

  return { pendingUpdates, handleOutputUpdate, applyUpdate, discardUpdate }
}
```

## Event Reference (SSE / Socket.io)

| Event | Direction | Data Format |
|-------|-----------|-------------|
| `chat` | Client → Server | `{ message, sessionId }` |
| `cancel` | Client → Server | `{ sessionId }` |
| `text_delta` | Server → Client | `{ text, sessionId }` |
| `output_update` | Server → Client | `{ payload: { data: { field, value } } }` |
| `agent_status` | Server → Client | `{ status, context? }` |
| `tool_activity` | Server → Client | `{ toolName, phase, description }` |
| `todo_update` | Server → Client | `{ todos, summary }` |
| `token_usage` | Server → Client | `{ inputTokens, outputTokens, ... }` |
| `error` | Server → Client | `{ code, message, recoverable }` |

## Best Practices

1. **Use type definitions** -- Import event types from `@kedge-agentic/common`
2. **Unified parsing** -- Use `parseOutputUpdateEvent` for handling output\_update
3. **Error handling** -- Listen for `error` events and provide user feedback
4. **Status indicators** -- Use `agent_status` and `tool_activity` to display execution progress
5. **Reconnection** -- The SDK provides built-in SSE auto-reconnection and session recovery
