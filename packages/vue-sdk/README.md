# @ccaas/vue-sdk

Vue composables and utilities for integrating with Claude-Code-as-a-Service backend.

## Installation

```bash
npm install @ccaas/vue-sdk
```

## Requirements

- Vue 3.3+
- socket.io-client 4.x

## Quick Start

### 1. Wrap your app with AgentListener

The SDK expects an `AgentListener` component to be mounted as a parent. This component provides all the state via Vue's provide/inject system.

```vue
<!-- App.vue -->
<template>
  <AgentListener>
    <RouterView />
  </AgentListener>
</template>
```

### 2. Access agent state in child components

```vue
<script setup lang="ts">
import { useAgentState } from '@ccaas/vue-sdk'

const { isProcessing, currentToolName, todoItems } = useAgentState()
</script>

<template>
  <div v-if="isProcessing">
    Processing: {{ currentToolName }}
  </div>
  <ul>
    <li v-for="todo in todoItems" :key="todo.content">
      {{ todo.content }} - {{ todo.status }}
    </li>
  </ul>
</template>
```

### 3. Register forms with the agent

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useFormBridge } from '@ccaas/vue-sdk'

const form = reactive({
  title: '',
  content: ''
})

const { isActive } = useFormBridge({
  formId: 'my-form',
  getFormState: () => ({ ...form }),
  applyFormData: async (data) => {
    Object.assign(form, data)
    return { success: true, appliedFields: Object.keys(data) }
  }
})
</script>
```

### 4. Use AI editing mode in stores

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAIEditing } from '@ccaas/vue-sdk'

export const useMyStore = defineStore('my', () => {
  const sections = ref({
    intro: '',
    body: '',
    conclusion: ''
  })

  const {
    aiEditingMode,
    aiCurrentSection,
    startAIEditing,
    updateFromAI,
    finishAIEditing
  } = useAIEditing({
    allSections: ['intro', 'body', 'conclusion'],
    onSectionUpdate: (id, content) => {
      sections.value[id] = content as string
    }
  })

  return {
    sections,
    aiEditingMode,
    aiCurrentSection,
    startAIEditing,
    updateFromAI,
    finishAIEditing
  }
})
```

### 5. Handle plan proposals

```vue
<script setup lang="ts">
import { usePlanMode } from '@ccaas/vue-sdk'

const {
  pendingProposal,
  hasPendingProposal,
  plannedSections,
  confirm,
  reject
} = usePlanMode()
</script>

<template>
  <div v-if="hasPendingProposal" class="plan-dialog">
    <h3>Plan Proposal</h3>
    <p>The AI will generate the following sections:</p>
    <ul>
      <li v-for="section in plannedSections" :key="section.id">
        {{ section.name }}
      </li>
    </ul>
    <button @click="confirm">Confirm</button>
    <button @click="reject">Reject</button>
  </div>
</template>
```

## Composables

### `useAgentState()`

Access centralized agent state.

```ts
const {
  clientId,
  sessionId,
  isConnected,
  isProcessing,
  currentToolName,
  todoItems,
  reasoningPhase,
  tokenUsage,
  // ... and more
} = useAgentState()
```

### `useFormBridge(options)`

Register a form with the agent for data synchronization.

```ts
const { isActive, formId, register, unregister } = useFormBridge({
  formId: 'my-form',
  getFormState: () => ({ ...form }),
  applyFormData: async (data) => {
    // Apply data to form
    return { success: true }
  },
  submit: async () => {
    // Submit form
    return { success: true }
  },
  getDataShape: () => ({
    fields: [
      { name: 'title', type: 'string', required: true }
    ]
  }),
  readonly: false
})
```

### `useAIEditing(options)`

Manage AI editing mode for section-based content.

```ts
const {
  aiEditingMode,
  aiCurrentSection,
  aiCompletedSections,
  aiPendingSections,
  progress,
  startAIEditing,
  updateFromAI,
  completeAISection,
  finishAIEditing,
  cancelAIEditing,
  isAIEditing,
  isAICompleted,
  isAIPending,
  resetAIState
} = useAIEditing({
  allSections: ['section1', 'section2', 'section3'],
  onSectionUpdate: (sectionId, content) => { /* ... */ },
  onComplete: () => { /* ... */ },
  onCancel: () => { /* ... */ }
})
```

### `usePlanMode()`

Handle plan proposals for human-in-the-loop workflows.

```ts
const {
  pendingProposal,
  hasPendingProposal,
  plannedSections,
  confirm,
  reject
} = usePlanMode()
```

### `useTodoProgress()`

Track todo/task progress.

```ts
const {
  todoItems,
  subagentTodos,
  stats,
  progress,
  hasTodos,
  isComplete,
  currentTodo,
  completedTodos,
  pendingTodos
} = useTodoProgress()
```

### `useToolActivity()`

Track tool execution activity.

```ts
const {
  current,
  history,
  toolName,
  duration,
  isRunning,
  lastSucceeded,
  decisionLogic,
  recentActivities,
  getById
} = useToolActivity()
```

## Services

### `FormStateSynchronizer`

Centralized form state synchronization service.

```ts
import { getFormStateSynchronizer } from '@ccaas/vue-sdk'

const sync = getFormStateSynchronizer()

// Register a form
sync.registerForm('my-form', reactiveState)

// Update fields from external source
sync.updateFields('my-form', { field: 'value' }, 'agent')

// Subscribe to updates
const unsubscribe = sync.onFormUpdated((event) => {
  console.log(`${event.formId}.${event.field} = ${event.value}`)
})
```

## Injection Symbols

The SDK exports typed injection symbols for use with Vue's `inject()`:

```ts
import { inject } from 'vue'
import {
  IsAgentProcessingKey,
  CurrentToolNameKey,
  TodoItemsKey
} from '@ccaas/vue-sdk'

const isProcessing = inject(IsAgentProcessingKey)
const currentTool = inject(CurrentToolNameKey)
const todos = inject(TodoItemsKey)
```

## Types

All TypeScript types are exported:

```ts
import type {
  // Connection
  ConnectionState,
  AgentConnectionConfig,
  PageContext,

  // Agent State
  AgentState,
  ToolActivity,
  TodoItem,
  OutputProgress,
  TokenUsage,

  // Form Bridge
  AgentFormHandlers,
  ApplyResult,
  SubmitResult,
  FormDataShape,

  // Plan Mode
  PlanProposal,
  PlanProposalSection,

  // Events
  SocketEvent,
  AgentStatusEvent,
  ToolActivityEvent,
  TodoUpdateEvent
} from '@ccaas/vue-sdk'
```

## License

MIT
