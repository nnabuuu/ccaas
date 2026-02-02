# Frontend Integration Guide

## Overview

LoopAI provides the Vue SDK (`@ccaas/vue-sdk`) and a general Socket.io integration pattern, supporting both Vue and React frontend frameworks.

## Vue SDK Integration

### Installation

```bash
npm install @ccaas/vue-sdk
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
import { useAgentState, useTodoProgress } from '@ccaas/vue-sdk'

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
import { useFormBridge } from '@ccaas/vue-sdk'

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
import { useAIEditing } from '@ccaas/vue-sdk'

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

## React Integration

React applications integrate directly via Socket.io. Below are the core hook patterns.

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
    setMessages(prev => appendText(prev, data.text))
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

Implement a "sync button" pattern that lets users choose whether to accept AI-generated content:

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

## Socket.io Event Reference

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

1. **Use type definitions** -- Import event types from `@ccaas/common`
2. **Unified parsing** -- Use `parseOutputUpdateEvent` for handling output\_update
3. **Error handling** -- Listen for `error` events and provide user feedback
4. **Status indicators** -- Use `agent_status` and `tool_activity` to display execution progress
5. **Reconnection** -- Implement Socket.io auto-reconnection and session recovery
