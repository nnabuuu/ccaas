# Vue SDK API Reference

Complete API documentation for `@ccaas/vue-sdk` - Vue 3 composables and utilities for integrating with Claude-Code-as-a-Service backend.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Composables](#composables)
  - [useAgentState](#useagentstate)
  - [useAgentChat](#useagentchat)
  - [useFormBridge](#useformbridge)
  - [useAIEditing](#useaiediting)
  - [usePlanMode](#useplanmode)
  - [useTodoProgress](#usetodoprogress)
  - [useToolActivity](#usetoolactivity)
  - [useThinking](#usethinking)
  - [useTokenUsage](#usetokenusage)
  - [useExploration](#useexploration)
  - [useSkills](#useskills)
  - [useOutputSync](#useoutputsync)
  - [useLessonPlanSync](#uselessonplansync)
  - [useEntityBridge](#useentitybridge)
- [Services](#services)
  - [FormStateSynchronizer](#formstatesynchronizer)
  - [AgentConnection](#agentconnection)
- [Types](#types)
- [Injection Symbols](#injection-symbols)
- [Best Practices](#best-practices)

## Installation

```bash
npm install @ccaas/vue-sdk
```

**Requirements:**
- Vue 3.3+
- socket.io-client 4.x
- TypeScript 5.0+ (recommended)

## Quick Start

### Basic Setup

```vue
<!-- App.vue -->
<template>
  <AgentListener>
    <RouterView />
  </AgentListener>
</template>
```

### Using Composables

```vue
<script setup lang="ts">
import { useAgentState, useTodoProgress } from '@ccaas/vue-sdk'

const { isProcessing, currentToolName } = useAgentState()
const { progress, currentTodo } = useTodoProgress()
</script>

<template>
  <div v-if="isProcessing" class="agent-status">
    <span>Processing: {{ currentToolName }}</span>
    <ProgressBar :value="progress" />
    <span v-if="currentTodo">{{ currentTodo.content }}</span>
  </div>
</template>
```

## Core Concepts

### Composables-First Design

The Vue SDK follows a **composables-first** design pattern, providing granular, reusable functions instead of a monolithic plugin. This approach offers:

- **Progressive adoption**: Use only what you need
- **Tree-shaking friendly**: Unused code is eliminated in builds
- **Type safety**: Full TypeScript support with inference
- **Testability**: Easy to test individual composables

### Provide/Inject Pattern

State is provided by `AgentListener` component and consumed via composables using Vue's provide/inject system:

```
AgentListener (provides state)
    ↓
useAgentState (injects state)
    ↓
Your Component
```

### Reactivity

All composables return Vue reactive references (Ref/ComputedRef) that automatically trigger re-renders when state changes.

## Composables

### useAgentState

Access centralized agent state including connection status, processing state, todos, and metrics.

#### Signature

```typescript
function useAgentState(): UseAgentStateReturn
```

#### Return Type

```typescript
interface UseAgentStateReturn {
  // Connection
  clientId: Readonly<Ref<string>>
  sessionId: Readonly<Ref<string>>
  isConnected: Readonly<Ref<boolean>>

  // Processing
  isProcessing: Readonly<Ref<boolean>>
  currentToolName: Readonly<Ref<string>>
  currentSkillName: Readonly<Ref<string>>
  currentAgentType: Readonly<Ref<string>>
  currentToolDuration: Readonly<Ref<number>>
  streamingText: Readonly<Ref<string>>

  // Tool activity
  currentToolActivity: Readonly<Ref<ToolActivity | null>>
  toolActivityHistory: Readonly<Ref<ToolActivity[]>>

  // Todos
  todoItems: Readonly<Ref<TodoItem[]>>
  subagentTodos: Readonly<Ref<TodoItem[]>>
  todoStats: Readonly<Ref<{
    completed: number
    inProgress: number
    pending: number
    total: number
  }>>

  // Reasoning
  reasoningPhase: Readonly<Ref<ReasoningPhase>>
  reasoningSummary: Readonly<Ref<string>>

  // Output generation
  aiOutputGenerating: Readonly<Ref<boolean>>
  aiOutputProgress: Readonly<Ref<OutputProgress>>

  // Metrics
  tokenUsage: Readonly<Ref<TokenUsage>>
  elapsedSeconds: Readonly<Ref<number>>

  // Run tracking
  currentRunSeq: Readonly<Ref<number | undefined>>
  totalAgentRuns: Readonly<Ref<number | undefined>>

  // Goal narrative
  goalNarrative: Readonly<Ref<GoalNarrative>>

  // Computed helpers
  hasActiveTodo: ComputedRef<boolean>
  isAnyToolRunning: ComputedRef<boolean>
  currentActivity: ComputedRef<string>
}
```

#### Example

```vue
<script setup lang="ts">
import { useAgentState } from '@ccaas/vue-sdk'

const {
  isProcessing,
  currentToolName,
  todoItems,
  todoStats,
  hasActiveTodo,
  currentActivity
} = useAgentState()
</script>

<template>
  <div class="agent-panel">
    <div v-if="isProcessing" class="status">
      <span class="tool">{{ currentToolName }}</span>
      <span class="activity">{{ currentActivity }}</span>
    </div>

    <div class="stats">
      <span>Completed: {{ todoStats.completed }}</span>
      <span>In Progress: {{ todoStats.inProgress }}</span>
      <span>Pending: {{ todoStats.pending }}</span>
    </div>

    <ul class="todos">
      <li v-for="todo in todoItems" :key="todo.id || todo.content">
        <span :class="todo.status">{{ todo.content }}</span>
      </li>
    </ul>
  </div>
</template>
```

---

### useAgentChat

Reactive Socket.io connection management for agent communication.

#### Signature

```typescript
function useAgentChat(options?: UseAgentChatOptions): UseAgentChatReturn
```

#### Options

```typescript
interface UseAgentChatOptions extends AgentConnectionConfig {
  connection?: AgentConnection  // Custom connection instance
  autoConnect?: boolean         // Auto-connect on mount (default: true)
}

interface AgentConnectionConfig {
  serverUrl?: string            // Backend URL (default: window.location.origin)
  apiKey?: string              // API key for authentication
  tenantId?: string            // Tenant ID
  debug?: boolean              // Enable debug logging
}
```

#### Return Type

```typescript
interface UseAgentChatReturn {
  // Connection state
  isConnected: ComputedRef<boolean>
  connectionStatus: Readonly<Ref<ConnectionState>>
  sessionId: Readonly<Ref<string | null>>
  clientId: Readonly<Ref<string | null>>

  // Pending result state
  hasPendingResult: Readonly<Ref<boolean>>
  pendingResultTruncated: Readonly<Ref<boolean>>
  pendingResultContext: Readonly<Ref<PendingResultContext | null>>

  // Methods
  sendMessage: (message: string, options?: SendMessageOptions) => Promise<SendMessageResult>
  cancel: () => void
  reconnectSession: (sessionId: string) => Promise<SendMessageResult>
  applyPendingResult: () => OutputUpdateEvent[]
  notifyNavigatedAway: () => void
  markContextForPending: (context: PageContext) => void

  // Event subscription
  on: <T = unknown>(event: string, handler: (data: T) => void) => () => void
  off: <T = unknown>(event: string, handler: (data: T) => void) => void

  // Connection management
  connect: (config?: AgentConnectionConfig) => void
  disconnect: () => void
  reconnect: () => void
}
```

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAgentChat } from '@ccaas/vue-sdk'

const message = ref('')
const messages = ref<string[]>([])

const {
  isConnected,
  sessionId,
  sendMessage,
  cancel,
  on
} = useAgentChat({
  serverUrl: 'http://localhost:3001',
  tenantId: 'my-tenant',
  debug: true
})

// Subscribe to events
on('text_delta', (data) => {
  messages.value.push(data.text)
})

on('complete', () => {
  console.log('Agent finished')
})

async function handleSend() {
  if (!message.value.trim()) return

  await sendMessage(message.value, {
    context: {
      route: '/lesson-plan',
      pageType: 'lesson-plan',
      entityId: '123'
    }
  })

  message.value = ''
}
</script>

<template>
  <div class="chat">
    <div class="status">
      <span v-if="isConnected" class="connected">Connected</span>
      <span v-else class="disconnected">Disconnected</span>
      <span v-if="sessionId">Session: {{ sessionId }}</span>
    </div>

    <div class="messages">
      <div v-for="(msg, i) in messages" :key="i">{{ msg }}</div>
    </div>

    <div class="input">
      <input v-model="message" @keyup.enter="handleSend" />
      <button @click="handleSend" :disabled="!isConnected">Send</button>
      <button @click="cancel" :disabled="!isConnected">Cancel</button>
    </div>
  </div>
</template>
```

---

### useFormBridge

Register forms with the agent for bidirectional data synchronization.

#### Signature

```typescript
function useFormBridge(options: UseFormBridgeOptions): UseFormBridgeReturn
```

#### Options

```typescript
interface UseFormBridgeOptions {
  formId: string                                                  // Unique form identifier
  readonly?: boolean                                              // Is form read-only
  getFormState: () => Record<string, unknown>                     // Get current form state
  applyFormData: (data: Record<string, unknown>) => Promise<ApplyResult>  // Apply data to form
  submit?: () => Promise<SubmitResult>                           // Optional submit handler
  getDataShape?: () => FormDataShape                             // Optional schema provider
}

interface ApplyResult {
  success: boolean
  appliedFields?: string[]
  errors?: Record<string, string>
}

interface SubmitResult {
  success: boolean
  errors?: Record<string, string>
}

interface FormDataShape {
  fields: Array<{
    name: string
    type: string
    required?: boolean
    description?: string
  }>
}
```

#### Return Type

```typescript
interface UseFormBridgeReturn {
  isActive: Readonly<Ref<boolean>>    // Whether this form is currently active
  formId: string                      // The form ID
  register: () => void                // Manually register the form
  unregister: () => void              // Manually unregister the form
}
```

#### Example

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useFormBridge } from '@ccaas/vue-sdk'

const form = reactive({
  title: '',
  subject: '',
  gradeLevel: '',
  objectives: []
})

const { isActive } = useFormBridge({
  formId: 'lesson-plan-form',
  readonly: false,

  getFormState: () => ({
    title: form.title,
    subject: form.subject,
    gradeLevel: form.gradeLevel,
    objectives: form.objectives
  }),

  applyFormData: async (data) => {
    try {
      Object.assign(form, data)
      return {
        success: true,
        appliedFields: Object.keys(data)
      }
    } catch (error) {
      return {
        success: false,
        errors: { _general: error.message }
      }
    }
  },

  submit: async () => {
    try {
      await api.saveLessonPlan(form)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        errors: { _general: error.message }
      }
    }
  },

  getDataShape: () => ({
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'subject', type: 'string', required: true },
      { name: 'gradeLevel', type: 'string', required: false },
      { name: 'objectives', type: 'array', required: false }
    ]
  })
})
</script>

<template>
  <form :class="{ active: isActive }">
    <input v-model="form.title" placeholder="Title" />
    <input v-model="form.subject" placeholder="Subject" />
    <input v-model="form.gradeLevel" placeholder="Grade Level" />
  </form>
</template>
```

---

### useAIEditing

Manage AI editing mode for section-based content generation with progress tracking.

#### Signature

```typescript
function useAIEditing<T extends string>(options: UseAIEditingOptions<T>): UseAIEditingReturn<T>
```

#### Options

```typescript
interface UseAIEditingOptions<T extends string> {
  allSections: readonly T[]                               // All section IDs that can be AI-edited
  onSectionUpdate?: (sectionId: T, content: unknown) => void  // Callback when section is updated
  onComplete?: () => void                                 // Callback when all sections complete
  onCancel?: () => void                                   // Callback when editing is cancelled
}
```

#### Return Type

```typescript
interface UseAIEditingReturn<T extends string> {
  // State
  aiEditingMode: Readonly<Ref<boolean>>         // Whether AI editing mode is active
  aiCurrentSection: Readonly<Ref<T | null>>     // Currently active section
  aiCompletedSections: Readonly<Ref<Set<T>>>    // Sections that have been completed
  aiPendingSections: Readonly<Ref<Set<T>>>      // Sections planned for generation
  progress: ComputedRef<number>                 // Progress percentage (0-100)

  // Methods
  startAIEditing: (sections?: T[]) => void      // Start AI editing for specified sections
  updateFromAI: (sectionId: T, content: unknown) => void  // Update a section from AI
  completeAISection: (sectionId: T) => void     // Mark a section as completed
  finishAIEditing: () => void                   // Finish AI editing mode
  cancelAIEditing: () => void                   // Cancel AI editing and discard
  isAIEditing: (sectionId: T) => boolean        // Check if section is being edited
  isAICompleted: (sectionId: T) => boolean      // Check if section is completed
  isAIPending: (sectionId: T) => boolean        // Check if section is pending
  resetAIState: () => void                      // Reset all AI editing state
}
```

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAIEditing } from '@ccaas/vue-sdk'

const sectionIds = ['objectives', 'activities', 'assessment'] as const
type SectionId = typeof sectionIds[number]

const sections = ref<Record<SectionId, string>>({
  objectives: '',
  activities: '',
  assessment: ''
})

const {
  aiEditingMode,
  aiCurrentSection,
  progress,
  startAIEditing,
  updateFromAI,
  completeAISection,
  finishAIEditing,
  isAIEditing,
  isAICompleted
} = useAIEditing({
  allSections: sectionIds,

  onSectionUpdate: (id, content) => {
    sections.value[id] = content as string
  },

  onComplete: () => {
    console.log('All sections generated!')
  }
})

function handleGenerate() {
  startAIEditing(['objectives', 'activities'])
}
</script>

<template>
  <div class="editor">
    <div v-if="aiEditingMode" class="progress">
      <span>Generating... {{ progress }}%</span>
      <span v-if="aiCurrentSection">Current: {{ aiCurrentSection }}</span>
    </div>

    <div
      v-for="section in sectionIds"
      :key="section"
      :class="{
        editing: isAIEditing(section),
        completed: isAICompleted(section)
      }"
    >
      <h3>{{ section }}</h3>
      <textarea v-model="sections[section]" />
    </div>

    <button @click="handleGenerate" :disabled="aiEditingMode">
      Generate with AI
    </button>
    <button v-if="aiEditingMode" @click="finishAIEditing">
      Finish
    </button>
  </div>
</template>
```

---

### usePlanMode

Handle plan proposals for human-in-the-loop workflows.

#### Signature

```typescript
function usePlanMode(): UsePlanModeReturn
```

#### Return Type

```typescript
interface UsePlanModeReturn {
  pendingProposal: Readonly<Ref<PlanProposal | null>> | null  // Currently pending proposal
  hasPendingProposal: ComputedRef<boolean>                    // Whether there's a pending proposal
  plannedSections: ComputedRef<PlanProposalSection[]>         // Sections planned for generation
  confirm: () => void                                         // Confirm the pending proposal
  reject: () => void                                          // Reject the pending proposal
}

interface PlanProposal {
  traceId: string
  sections: PlanProposalSection[]
  context: PlanProposalContext
}

interface PlanProposalSection {
  id: string
  name: string
  description?: string
}
```

#### Example

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
    <h3>AI Generation Plan</h3>
    <p>The AI will generate the following sections:</p>
    <ul>
      <li v-for="section in plannedSections" :key="section.id">
        <strong>{{ section.name }}</strong>
        <span v-if="section.description">: {{ section.description }}</span>
      </li>
    </ul>
    <div class="actions">
      <button @click="confirm" class="primary">
        Confirm Plan
      </button>
      <button @click="reject" class="secondary">
        Reject
      </button>
    </div>
  </div>
</template>
```

---

### useTodoProgress

Track todo/task progress with computed statistics.

#### Signature

```typescript
function useTodoProgress(): UseTodoProgressReturn
```

#### Return Type

```typescript
interface UseTodoProgressReturn {
  todoItems: Readonly<Ref<TodoItem[]>>        // Main agent todo items
  subagentTodos: Readonly<Ref<TodoItem[]>>    // Sub-agent specific todos
  stats: Readonly<Ref<{                       // Todo statistics
    completed: number
    inProgress: number
    pending: number
    total: number
  }>>
  progress: ComputedRef<number>               // Progress percentage (0-100)
  hasTodos: ComputedRef<boolean>              // Whether there are any todos
  isComplete: ComputedRef<boolean>            // Whether all todos are completed
  currentTodo: ComputedRef<TodoItem | undefined>  // Currently active todo
  completedTodos: ComputedRef<TodoItem[]>     // Completed todos
  pendingTodos: ComputedRef<TodoItem[]>       // Pending todos
}

interface TodoItem {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}
```

#### Example

```vue
<script setup lang="ts">
import { useTodoProgress } from '@ccaas/vue-sdk'

const {
  todoItems,
  stats,
  progress,
  currentTodo,
  isComplete,
  completedTodos,
  pendingTodos
} = useTodoProgress()
</script>

<template>
  <div class="progress-panel">
    <div class="progress-bar">
      <div class="fill" :style="{ width: progress + '%' }"></div>
      <span>{{ progress }}%</span>
    </div>

    <div class="stats">
      <div class="stat">
        <span class="label">Completed</span>
        <span class="value">{{ stats.completed }}</span>
      </div>
      <div class="stat">
        <span class="label">In Progress</span>
        <span class="value">{{ stats.inProgress }}</span>
      </div>
      <div class="stat">
        <span class="label">Pending</span>
        <span class="value">{{ stats.pending }}</span>
      </div>
    </div>

    <div v-if="currentTodo" class="current-task">
      <h4>Current Task</h4>
      <p>{{ currentTodo.content }}</p>
      <span v-if="currentTodo.activeForm">Form: {{ currentTodo.activeForm }}</span>
    </div>

    <div v-if="isComplete" class="completion">
      ✓ All tasks completed!
    </div>
  </div>
</template>
```

---

### useToolActivity

Track tool execution activity with history and decision logic.

#### Signature

```typescript
function useToolActivity(): UseToolActivityReturn
```

#### Return Type

```typescript
interface UseToolActivityReturn {
  current: Readonly<Ref<ToolActivity | null>>       // Current tool activity
  history: Readonly<Ref<ToolActivity[]>>            // Tool activity history
  toolName: Readonly<Ref<string>>                   // Current tool name
  duration: Readonly<Ref<number>>                   // Current tool duration in ms
  isRunning: ComputedRef<boolean>                   // Whether a tool is currently running
  lastSucceeded: ComputedRef<boolean | null>        // Whether the last tool succeeded
  decisionLogic: ComputedRef<{                      // Current decision logic
    why: string
    benefit: string
    nextStep?: string
  } | null>
  recentActivities: (count?: number) => ToolActivity[]  // Get recent activities
  getById: (toolId: string) => ToolActivity | undefined // Get activity by ID
}

interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  description: string
  agentType?: string
  duration?: number
  success?: boolean
  decisionLogic?: {
    why: string
    benefit: string
    nextStep?: string
  }
}
```

#### Example

```vue
<script setup lang="ts">
import { useToolActivity } from '@ccaas/vue-sdk'

const {
  current,
  isRunning,
  decisionLogic,
  recentActivities
} = useToolActivity()
</script>

<template>
  <div class="tool-activity">
    <div v-if="isRunning" class="current">
      <h4>Current Tool: {{ current?.toolName }}</h4>
      <p>{{ current?.description }}</p>

      <div v-if="decisionLogic" class="decision">
        <p><strong>Why:</strong> {{ decisionLogic.why }}</p>
        <p><strong>Benefit:</strong> {{ decisionLogic.benefit }}</p>
        <p v-if="decisionLogic.nextStep">
          <strong>Next:</strong> {{ decisionLogic.nextStep }}
        </p>
      </div>
    </div>

    <div class="history">
      <h4>Recent Activity</h4>
      <ul>
        <li v-for="activity in recentActivities(5)" :key="activity.toolId">
          <span class="tool">{{ activity.toolName }}</span>
          <span class="desc">{{ activity.description }}</span>
          <span v-if="activity.duration" class="duration">
            {{ activity.duration }}ms
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
```

---

### useThinking

Access agent thinking/reasoning state for extended thinking events.

#### Signature

```typescript
function useThinking(): UseThinkingReturn
```

#### Return Type

```typescript
interface UseThinkingReturn {
  isThinking: Readonly<Ref<boolean>>           // Whether agent is currently thinking
  thinkingContent: Readonly<Ref<string>>       // Current thinking content (streaming)
  thinkingHistory: Readonly<Ref<string[]>>     // History of thinking blocks
  thinkingId: Readonly<Ref<string>>            // Current thinking block ID
  hasThinking: ComputedRef<boolean>            // Whether there is any thinking content
  thinkingLength: ComputedRef<number>          // Length of current thinking content
  thinkingPreview: ComputedRef<string>         // Truncated preview (first 200 chars)
}
```

#### Example

```vue
<script setup lang="ts">
import { useThinking } from '@ccaas/vue-sdk'

const {
  isThinking,
  thinkingContent,
  thinkingPreview,
  thinkingHistory
} = useThinking()
</script>

<template>
  <div class="thinking-panel">
    <div v-if="isThinking" class="thinking-indicator">
      <span class="icon">🧠</span>
      <span class="label">Claude is thinking...</span>
      <p v-if="thinkingContent" class="preview">{{ thinkingPreview }}</p>
    </div>

    <details v-if="thinkingHistory.length > 0">
      <summary>Thinking History ({{ thinkingHistory.length }} blocks)</summary>
      <div v-for="(block, i) in thinkingHistory" :key="i" class="thinking-block">
        <pre>{{ block }}</pre>
      </div>
    </details>
  </div>
</template>
```

---

### useTokenUsage

Track real-time token usage metrics and costs.

#### Signature

```typescript
function useTokenUsage(): UseTokenUsageReturn
```

#### Return Type

```typescript
interface UseTokenUsageReturn {
  tokenUsage: Readonly<Ref<TokenUsage>>                  // Current request token usage
  sessionTokens: Readonly<Ref<SessionTokens>>            // Session cumulative tokens
  currentModel: Readonly<Ref<string>>                    // Current model being used
  estimatedCost: Readonly<Ref<number>>                   // Estimated cost in USD
  totalTokens: ComputedRef<number>                       // Total tokens (current request)
  sessionTotalTokens: ComputedRef<number>                // Session total tokens
  formattedTotalTokens: ComputedRef<string>              // Formatted count (e.g., "1.2K")
  formattedSessionTokens: ComputedRef<string>            // Formatted session tokens
  formattedCost: ComputedRef<string>                     // Formatted cost (e.g., "$0.12")
  hasUsage: ComputedRef<boolean>                         // Whether there's any token usage
  cacheHitRate: ComputedRef<number>                      // Cache hit rate percentage
}

interface TokenUsage {
  input: number
  output: number
  total: number
}

interface SessionTokens {
  input: number
  output: number
  cached: number
  reasoning: number
  total: number
}
```

#### Example

```vue
<script setup lang="ts">
import { useTokenUsage } from '@ccaas/vue-sdk'

const {
  tokenUsage,
  sessionTokens,
  currentModel,
  formattedTotalTokens,
  formattedCost,
  cacheHitRate
} = useTokenUsage()
</script>

<template>
  <div class="token-usage">
    <div class="model">Model: {{ currentModel }}</div>

    <div class="current-request">
      <h4>Current Request</h4>
      <div class="stat">
        <span>Input:</span>
        <span>{{ tokenUsage.input }}</span>
      </div>
      <div class="stat">
        <span>Output:</span>
        <span>{{ tokenUsage.output }}</span>
      </div>
      <div class="stat total">
        <span>Total:</span>
        <span>{{ formattedTotalTokens }}</span>
      </div>
    </div>

    <div class="session">
      <h4>Session Total</h4>
      <div class="stat">
        <span>Input:</span>
        <span>{{ sessionTokens.input.toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span>Output:</span>
        <span>{{ sessionTokens.output.toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span>Cached:</span>
        <span>{{ sessionTokens.cached.toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span>Reasoning:</span>
        <span>{{ sessionTokens.reasoning.toLocaleString() }}</span>
      </div>
      <div class="stat">
        <span>Cache Hit Rate:</span>
        <span>{{ cacheHitRate }}%</span>
      </div>
    </div>

    <div class="cost">
      <span>Estimated Cost:</span>
      <span class="amount">{{ formattedCost }}</span>
    </div>
  </div>
</template>
```

---

### useExploration

Track exploration activity from Explore/Plan sub-agents.

#### Signature

```typescript
function useExploration(): UseExplorationReturn
```

#### Return Type

```typescript
interface UseExplorationReturn {
  exploration: Readonly<Ref<ExplorationActivity | null>>     // Current exploration activity
  explorationHistory: Readonly<Ref<ExplorationHistoryEntry[]>>  // Exploration history
  isExploring: ComputedRef<boolean>                          // Whether exploration is in progress
  actionIcon: ComputedRef<string>                            // Icon for current action
  actionLabel: ComputedRef<string>                           // Label for current action
  totalResultCount: ComputedRef<number>                      // Total files/matches found
  explorationCount: ComputedRef<number>                      // Number of exploration actions
}

interface ExplorationActivity {
  action: 'search' | 'read' | 'glob' | 'grep' | 'analyze'
  target: string
  phase: 'start' | 'progress' | 'complete'
  agentType: string
  resultCount?: number
  resultSummary?: string
}
```

#### Example

```vue
<script setup lang="ts">
import { useExploration } from '@ccaas/vue-sdk'

const {
  exploration,
  isExploring,
  actionIcon,
  actionLabel,
  totalResultCount,
  explorationHistory
} = useExploration()
</script>

<template>
  <div class="exploration">
    <div v-if="isExploring" class="current">
      <span class="icon">{{ actionIcon }}</span>
      <span class="action">{{ actionLabel }}</span>
      <span class="target">{{ exploration?.target }}</span>
      <span v-if="exploration?.resultSummary" class="result">
        {{ exploration.resultSummary }}
      </span>
    </div>

    <div class="summary">
      <span>Total Results: {{ totalResultCount }}</span>
      <span>Explorations: {{ explorationHistory.length }}</span>
    </div>

    <details v-if="explorationHistory.length > 0">
      <summary>Exploration History</summary>
      <ul>
        <li v-for="(entry, i) in explorationHistory" :key="i">
          <strong>{{ entry.action }}</strong>: {{ entry.target }}
          <span v-if="entry.resultCount">({{ entry.resultCount }} results)</span>
        </li>
      </ul>
    </details>
  </div>
</template>
```

---

### useSkills

Manage skills (fetch, search, toggle enabled/disabled).

#### Signature

```typescript
function useSkills(options: UseSkillsOptions): UseSkillsReturn
```

#### Options

```typescript
interface UseSkillsOptions {
  serverUrl?: string    // Backend URL
  tenantId: string      // Tenant ID
}
```

#### Return Type

```typescript
interface UseSkillsReturn {
  skills: Ref<Skill[]>                          // All skills
  loading: Ref<boolean>                         // Loading state
  error: Ref<string | null>                     // Error message
  searchQuery: Ref<string>                      // Search query
  filteredSkills: ComputedRef<Skill[]>          // Filtered skills based on search
  toggleSkill: (skillId: string) => Promise<void>  // Toggle skill enabled/disabled
  enabledSkillIds: ComputedRef<Set<string>>     // Set of enabled skill IDs
  isSkillEnabled: (skillId: string) => boolean  // Check if skill is enabled
  refresh: () => Promise<void>                  // Refresh skills list
}
```

#### Example

```vue
<script setup lang="ts">
import { useSkills } from '@ccaas/vue-sdk'

const {
  filteredSkills,
  loading,
  error,
  searchQuery,
  toggleSkill,
  isSkillEnabled
} = useSkills({
  serverUrl: 'http://localhost:3001',
  tenantId: 'my-tenant'
})
</script>

<template>
  <div class="skills-manager">
    <input
      v-model="searchQuery"
      placeholder="Search skills..."
      class="search"
    />

    <div v-if="loading">Loading skills...</div>
    <div v-if="error" class="error">{{ error }}</div>

    <ul class="skills-list">
      <li v-for="skill in filteredSkills" :key="skill.id">
        <div class="info">
          <strong>{{ skill.name }}</strong>
          <p v-if="skill.description">{{ skill.description }}</p>
        </div>
        <button @click="toggleSkill(skill.id)">
          {{ isSkillEnabled(skill.id) ? 'Disable' : 'Enable' }}
        </button>
      </li>
    </ul>
  </div>
</template>
```

---

### useOutputSync

Generic output synchronization for manual or auto sync modes.

#### Signature

```typescript
function useOutputSync<T extends Record<string, unknown>>(
  options: UseOutputSyncOptions
): UseOutputSyncReturn<T>
```

#### Options

```typescript
interface UseOutputSyncOptions {
  mode: 'manual' | 'auto'                                      // Sync mode
  normalizeField?: (field: string, value: unknown) => unknown  // Field normalization function
  undoTimeout?: number                                         // Undo timeout in ms (default: 30000)
}
```

#### Return Type

```typescript
interface UseOutputSyncReturn<T extends Record<string, unknown>> {
  pendingUpdates: Ref<Map<string, OutputUpdate>>         // Pending updates from AI
  modifiedFields: Ref<Set<string>>                       // Set of fields modified by AI
  handleOutputUpdate: (update: OutputUpdate) => void     // Handle incoming output update
  syncToForm: (field: string, formData: Ref<T>) => void  // Sync a single field
  syncAllToForm: (formData: Ref<T>) => void             // Sync all pending updates
  discardUpdate: (field: string) => void                 // Discard a pending update
  undoSync: (field: string, formData: Ref<T>) => void   // Undo a synced field
  canUndo: (field: string) => boolean                    // Check if undo is available
  reset: () => void                                      // Reset all state
}

interface OutputUpdate {
  field: string
  value: unknown
  synced?: boolean
  syncedAt?: Date
}
```

#### Example

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useOutputSync } from '@ccaas/vue-sdk'

const formData = ref({
  title: '',
  content: '',
  tags: []
})

const {
  pendingUpdates,
  modifiedFields,
  handleOutputUpdate,
  syncToForm,
  syncAllToForm,
  discardUpdate,
  canUndo,
  undoSync
} = useOutputSync({
  mode: 'manual',
  normalizeField: (field, value) => {
    // Custom normalization logic
    if (field === 'tags' && typeof value === 'string') {
      return value.split(',').map(t => t.trim())
    }
    return value
  }
})

// Subscribe to output_update events
socket.on('output_update', (event) => {
  handleOutputUpdate({
    field: event.field,
    value: event.content
  })
})
</script>

<template>
  <div class="form-editor">
    <div v-if="pendingUpdates.size > 0" class="pending-updates">
      <h4>Pending AI Updates</h4>
      <div v-for="[field, update] of pendingUpdates" :key="field">
        <strong>{{ field }}</strong>
        <button @click="syncToForm(field, formData)">Apply</button>
        <button @click="discardUpdate(field)">Discard</button>
      </div>
      <button @click="syncAllToForm(formData)">Apply All</button>
    </div>

    <div v-for="field in modifiedFields" :key="field" class="modified">
      <span>{{ field }} was modified by AI</span>
      <button v-if="canUndo(field)" @click="undoSync(field, formData)">
        Undo
      </button>
    </div>

    <input v-model="formData.title" placeholder="Title" />
    <textarea v-model="formData.content" placeholder="Content" />
  </div>
</template>
```

---

### useLessonPlanSync

Specialized synchronization for lesson plan entities with field validation.

#### Signature

```typescript
function useLessonPlanSync(options: UseLessonPlanSyncOptions): UseLessonPlanSyncReturn
```

#### Options

```typescript
interface UseLessonPlanSyncOptions {
  initialPlan: LessonPlan                                                    // Initial lesson plan data
  onApply?: (field: LessonPlanSyncField, value: unknown) => Promise<void>   // Callback when update is applied
  onPendingUpdate?: (field: LessonPlanSyncField, value: unknown) => void    // Callback when pending update received
  undoTimeout?: number                                                       // Undo timeout in ms (default: 30000)
}
```

#### Return Type

```typescript
interface UseLessonPlanSyncReturn {
  lessonPlan: Ref<LessonPlan>                                        // Current lesson plan state
  pendingUpdates: Ref<Partial<Record<LessonPlanSyncField, unknown>>>  // Pending updates
  hasPendingUpdates: ComputedRef<boolean>                            // Whether there are pending updates
  modifiedFields: Ref<Set<LessonPlanSyncField>>                      // Fields modified by AI
  handleOutputUpdate: (field: LessonPlanSyncField, value: unknown) => void  // Handle output update
  applyUpdate: (field: LessonPlanSyncField) => Promise<void>         // Apply single update
  applyAllUpdates: () => Promise<void>                               // Apply all updates
  discardUpdate: (field: LessonPlanSyncField) => void                // Discard single update
  discardAllUpdates: () => void                                      // Discard all updates
  undoUpdate: (field: LessonPlanSyncField) => void                   // Undo update
  canUndo: ComputedRef<(field: LessonPlanSyncField) => boolean>      // Check if undo available
  resetLessonPlan: (newPlan: LessonPlan) => void                     // Reset to new plan
  getPendingUpdateForField: (field: LessonPlanSyncField) => unknown | undefined  // Get pending update
  isFieldModified: (field: LessonPlanSyncField) => boolean           // Check if field modified
}

type LessonPlanSyncField =
  | 'title'
  | 'subject'
  | 'gradeLevel'
  | 'duration'
  | 'objectives'
  | 'standards'
  | 'materials'
  | 'activities'
  | 'assessment'
  | 'differentiation'
```

#### Example

```vue
<script setup lang="ts">
import { useLessonPlanSync } from '@ccaas/vue-sdk'

const {
  lessonPlan,
  pendingUpdates,
  hasPendingUpdates,
  modifiedFields,
  handleOutputUpdate,
  applyUpdate,
  applyAllUpdates,
  discardUpdate,
  canUndo,
  undoUpdate
} = useLessonPlanSync({
  initialPlan: {
    id: '123',
    title: '',
    subject: '',
    objectives: [],
    // ...
  },
  onApply: async (field, value) => {
    await api.updateLessonPlanField(lessonPlan.value.id, field, value)
  }
})

// Subscribe to output_update
socket.on('output_update', (event) => {
  handleOutputUpdate(event.field, event.value)
})
</script>

<template>
  <div class="lesson-plan-editor">
    <div v-if="hasPendingUpdates" class="pending-banner">
      <span>{{ Object.keys(pendingUpdates).length }} pending updates</span>
      <button @click="applyAllUpdates">Apply All</button>
    </div>

    <div class="field" v-for="field in ['title', 'subject', 'objectives']" :key="field">
      <label>{{ field }}</label>

      <div v-if="pendingUpdates[field]" class="pending-indicator">
        AI suggested: {{ pendingUpdates[field] }}
        <button @click="applyUpdate(field)">Apply</button>
        <button @click="discardUpdate(field)">Discard</button>
      </div>

      <div v-if="modifiedFields.has(field)" class="modified-indicator">
        Modified by AI
        <button v-if="canUndo(field)" @click="undoUpdate(field)">Undo</button>
      </div>

      <input v-model="lessonPlan[field]" />
    </div>
  </div>
</template>
```

---

### useEntityBridge

Entity-agnostic bridging between AI output and entity stores with auto-subscription.

#### Signature

```typescript
function useEntityBridge(config: EntityBridgeConfig): UseEntityBridgeReturn
```

#### Options

```typescript
interface EntityBridgeConfig {
  chat?: UseAgentChatReturn                                  // Custom chat instance
  sections: string[]                                         // Section IDs
  fieldMapping: Record<string, string>                       // Backend field -> frontend section mapping
  updateSection: (sectionId: string, content: unknown) => void  // Update section callback
  saveToBackend: () => Promise<void>                         // Save callback
  onStart?: () => void                                       // Start callback
  onComplete?: () => void                                    // Complete callback
  onError?: (error: Error) => void                           // Error callback
  debug?: boolean                                            // Enable debug logging
}
```

#### Return Type

```typescript
interface UseEntityBridgeReturn {
  chat: UseAgentChatReturn                                   // Exposed chat instance
  aiEditingMode: Readonly<Ref<boolean>>                      // AI editing mode active
  currentSection: Readonly<Ref<string | null>>               // Current section being edited
  sectionStates: Readonly<Ref<Record<string, SectionState>>> // Section states
  progress: ComputedRef<number>                              // Progress percentage
  isDirty: Readonly<Ref<boolean>>                            // Whether there are unsaved changes
  isSaving: Readonly<Ref<boolean>>                           // Whether currently saving
  startAIEditing: () => void                                 // Start AI editing mode
  stopAIEditing: () => void                                  // Stop AI editing mode
  handleOutputUpdate: (event: EntityOutputUpdateEvent) => void  // Handle output update
  saveAll: () => Promise<void>                               // Save all changes
  discardAll: () => void                                     // Discard all changes
  isSectionEditing: (sectionId: string) => boolean           // Check if section editing
  isSectionCompleted: (sectionId: string) => boolean         // Check if section completed
  reset: () => void                                          // Reset all state
}

interface SectionState {
  status: 'idle' | 'pending' | 'streaming' | 'completed' | 'error'
  error?: string
  lastUpdatedAt?: Date
}
```

#### Example

```vue
<script setup lang="ts">
import { reactive } from 'vue'
import { useEntityBridge } from '@ccaas/vue-sdk'

const draft = reactive({
  textbookAnalysis: '',
  studentAnalysis: '',
  learningObjectives: ''
})

const {
  aiEditingMode,
  currentSection,
  progress,
  isDirty,
  isSaving,
  saveAll,
  discardAll,
  isSectionEditing,
  isSectionCompleted
} = useEntityBridge({
  sections: ['textbookAnalysis', 'studentAnalysis', 'learningObjectives'],

  fieldMapping: {
    textbook_analysis: 'textbookAnalysis',
    student_analysis: 'studentAnalysis',
    learning_objectives: 'learningObjectives'
  },

  updateSection: (id, content) => {
    draft[id] = content as string
  },

  saveToBackend: async () => {
    await api.update('123', draft)
  },

  onComplete: () => {
    console.log('All sections completed!')
  },

  debug: true
})
</script>

<template>
  <div class="entity-editor">
    <div v-if="aiEditingMode" class="ai-banner">
      <span>AI Editing: {{ progress }}%</span>
      <span v-if="currentSection">Current: {{ currentSection }}</span>
    </div>

    <div
      v-for="section in ['textbookAnalysis', 'studentAnalysis', 'learningObjectives']"
      :key="section"
      :class="{
        editing: isSectionEditing(section),
        completed: isSectionCompleted(section)
      }"
    >
      <h3>{{ section }}</h3>
      <textarea v-model="draft[section]" />
    </div>

    <div class="actions">
      <button @click="saveAll" :disabled="!isDirty || isSaving">
        {{ isSaving ? 'Saving...' : 'Save' }}
      </button>
      <button @click="discardAll" :disabled="!isDirty">
        Discard Changes
      </button>
    </div>
  </div>
</template>
```

---

## Services

### FormStateSynchronizer

Centralized service for form state synchronization between Vue reactive state and external updates.

#### Methods

```typescript
class FormStateSynchronizer {
  // Registration
  registerForm(formId: string, reactiveState: Record<string, unknown>): void
  unregisterForm(formId: string): void
  hasForm(formId: string): boolean

  // Updates
  updateField(formId: string, field: string, value: unknown, source: FormUpdateSource): boolean
  updateFields(formId: string, updates: Record<string, unknown>, source: FormUpdateSource): boolean

  // State access
  getFormState(formId: string): Record<string, unknown> | null
  getFormStateCopy(formId: string): Record<string, unknown> | null

  // Event subscription
  onFormUpdated(handler: EventHandler<FormUpdateEvent>): () => void
  onFormUpdatedFor(formId: string, handler: EventHandler<FormUpdateEvent>): () => void

  // Debug
  debug(): Array<{ formId: string; fields: string[] }>
  clear(): void
}

type FormUpdateSource = 'user' | 'agent' | 'a2ui' | 'api'

interface FormUpdateEvent {
  formId: string
  field: string
  value: unknown
  oldValue: unknown
  source: FormUpdateSource
  timestamp: number
}
```

#### Usage

```typescript
import { getFormStateSynchronizer } from '@ccaas/vue-sdk'

const sync = getFormStateSynchronizer()

// In component
const formState = reactive({ title: '', content: '' })
onMounted(() => sync.registerForm('my-form', formState))
onUnmounted(() => sync.unregisterForm('my-form'))

// From external source
sync.updateFields('my-form', { title: 'New Title' }, 'agent')

// Subscribe to updates
const unsubscribe = sync.onFormUpdated((event) => {
  console.log(`${event.formId}.${event.field} updated from ${event.source}`)
})
```

---

### AgentConnection

Singleton Socket.io connection manager for agent communication.

#### Methods

```typescript
class AgentConnection {
  // Connection management
  connect(config?: AgentConnectionConfig): void
  disconnect(): void
  reconnect(): void

  // State
  get isConnected(): boolean
  get sessionId(): string | null
  get clientId(): string | null
  get status(): ConnectionState

  // Messaging
  sendMessage(message: string, options?: SendMessageOptions): Promise<SendMessageResult>
  cancel(): void

  // Pending results
  get hasPendingResult(): boolean
  get pendingResultTruncated(): boolean
  get pendingResultContext(): PendingResultContext | null
  applyPendingResult(): OutputUpdateEvent[]
  notifyNavigatedAway(): void
  markContextForPending(context: PageContext): void

  // Event subscription
  on<T = unknown>(event: string, handler: (data: T) => void): () => void
  off<T = unknown>(event: string, handler: (data: T) => void): void
}

// Get singleton instance
import { agentConnection } from '@ccaas/vue-sdk'

// Or create custom instance
import { createAgentConnection } from '@ccaas/vue-sdk'
const connection = createAgentConnection()
```

---

## Types

### Core Types

```typescript
// Connection
interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  error?: string
  reconnectAttempts: number
}

interface PageContext {
  route: string
  pageType: string
  entityId?: string
  entityType?: string
  editMode?: boolean
  selectedFields?: string[]
  dirtyFields?: string[]
  currentData?: Record<string, unknown>
}

// Agent State
interface TodoItem {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  description: string
  agentType?: string
  duration?: number
  success?: boolean
  decisionLogic?: {
    why: string
    benefit: string
    nextStep?: string
  }
}

interface OutputProgress {
  totalSteps: number
  completedSteps: number
  percentage: number
}

interface TokenUsage {
  input: number
  output: number
  total: number
}

interface GoalNarrative {
  title: string
  subject: string
  chapter: string
  edition: string
}

type ReasoningPhase = '' | 'analyzing' | 'planning' | 'executing'

// Plan Proposal
interface PlanProposal {
  traceId: string
  sections: PlanProposalSection[]
  context: PlanProposalContext
}

interface PlanProposalSection {
  id: string
  name: string
  description?: string
}
```

### Event Types

```typescript
// Output Update Event
interface OutputUpdateEvent {
  field: string
  content?: unknown
  data?: unknown
  isFinal?: boolean
  timestamp?: string
}

// Agent Status Event
interface AgentStatusEvent {
  status: 'idle' | 'processing' | 'waiting'
  toolName?: string
  skillName?: string
  agentType?: string
}

// Todo Update Event
interface TodoUpdateEvent {
  todos: TodoItem[]
  subagentTodos?: TodoItem[]
}

// Tool Activity Event
interface ToolActivityEvent {
  toolName: string
  toolId: string
  phase: 'start' | 'progress' | 'end'
  description: string
  agentType?: string
  duration?: number
  success?: boolean
  decisionLogic?: {
    why: string
    benefit: string
    nextStep?: string
  }
}
```

---

## Injection Symbols

All injection symbols are typed and exported for use with Vue's `inject()`:

```typescript
import { inject } from 'vue'
import {
  // Connection
  AgentClientIdKey,
  AgentSessionIdKey,
  AgentConnectedKey,

  // Processing
  IsAgentProcessingKey,
  CurrentToolNameKey,
  CurrentSkillNameKey,
  CurrentAgentTypeKey,
  CurrentToolDurationKey,
  StreamingTextKey,

  // Tool Activity
  CurrentToolActivityKey,
  ToolActivityHistoryKey,

  // Todos
  TodoItemsKey,
  SubagentTodosKey,
  TodoStatsKey,

  // Reasoning
  ReasoningPhaseKey,
  ReasoningSummaryKey,

  // Output Generation
  AiOutputGeneratingKey,
  AiOutputProgressKey,

  // Metrics
  TokenUsageKey,
  ElapsedSecondsKey,

  // Run Tracking
  CurrentRunSeqKey,
  TotalAgentRunsKey,

  // Goal Narrative
  GoalNarrativeKey,

  // Plan Mode
  PendingPlanProposalKey,
  ConfirmPlanProposalKey,
  RejectPlanProposalKey,

  // Form Bridge
  RegisterAgentFormKey,
  UnregisterAgentFormKey,
  ActiveFormIdKey,

  // Thinking
  IsThinkingKey,
  ThinkingContentKey,
  ThinkingHistoryKey,
  ThinkingIdKey,

  // Token Usage
  SessionTokensKey,
  CurrentModelKey,
  EstimatedCostKey,

  // Exploration
  ExplorationActivityKey,
  ExplorationHistoryKey,
} from '@ccaas/vue-sdk'

// Usage
const isProcessing = inject(IsAgentProcessingKey)
const todoItems = inject(TodoItemsKey)
```

---

## Best Practices

### 1. Use Composables Instead of Direct Injection

**Recommended:**
```typescript
const { todoItems, stats, progress } = useTodoProgress()
```

**Not recommended:**
```typescript
const todoItems = inject(TodoItemsKey)
const stats = inject(TodoStatsKey)
// Manual progress calculation
```

**Why:** Composables provide computed helpers and encapsulate logic.

### 2. Destructure Only What You Need

```typescript
// Good - only import what you use
const { isProcessing, currentToolName } = useAgentState()

// Avoid - importing everything
const agentState = useAgentState()
```

**Why:** Better tree-shaking and clearer dependencies.

### 3. Handle Async Operations Properly

```typescript
async function handleApply() {
  try {
    await applyUpdate('objectives')
    toast.success('Applied successfully')
  } catch (error) {
    toast.error(`Failed: ${error.message}`)
  }
}
```

**Why:** Proper error handling improves UX.

### 4. Clean Up Subscriptions

```typescript
onMounted(() => {
  const unsubscribe = chat.on('text_delta', handler)

  onUnmounted(() => {
    unsubscribe()
  })
})
```

**Why:** Prevents memory leaks.

### 5. Use TypeScript for Type Safety

```typescript
const sectionIds = ['intro', 'body', 'conclusion'] as const
type SectionId = typeof sectionIds[number]

const { aiEditingMode } = useAIEditing<SectionId>({
  allSections: sectionIds,
  // TypeScript ensures sectionId is typed correctly
  onSectionUpdate: (sectionId, content) => {
    sections.value[sectionId] = content as string
  }
})
```

**Why:** Catch errors at compile time, better IDE support.

### 6. Provide User Feedback

```typescript
const {
  aiEditingMode,
  progress,
  currentSection
} = useAIEditing({
  allSections: sections,
  onSectionUpdate: (id, content) => {
    form[id] = content
    toast.info(`Updated ${id}`)
  },
  onComplete: () => {
    toast.success('All sections generated!')
  }
})
```

**Why:** Users know what's happening.

### 7. Debounce Expensive Operations

```typescript
import { debounce } from 'lodash-es'

const debouncedSync = debounce((field) => {
  syncToForm(field, formData)
}, 300)
```

**Why:** Improves performance for frequent updates.

### 8. Test with Mock Connections

```typescript
import { createAgentConnection } from '@ccaas/vue-sdk'

const mockConnection = createAgentConnection()
const { isConnected } = useAgentChat({ connection: mockConnection })
```

**Why:** Easier unit testing.

---

## Migration Guide

### From Direct Injection

**Before:**
```typescript
const isProcessing = inject(IsAgentProcessingKey)
const todoItems = inject(TodoItemsKey)
const stats = computed(() => {
  // Manual calculation
})
```

**After:**
```typescript
const { todoItems, stats, progress } = useTodoProgress()
```

### From Manual Form Registration

**Before:**
```typescript
const registerForm = inject(RegisterAgentFormKey)
onMounted(() => registerForm('my-form', handlers))
onUnmounted(() => unregisterForm('my-form'))
```

**After:**
```typescript
const { isActive } = useFormBridge({
  formId: 'my-form',
  ...handlers
})
// Lifecycle handled automatically
```

---

## License

MIT
