# @ccaas/vue-sdk Architecture Documentation

## Overview

`@ccaas/vue-sdk` is a Vue 3 Composition API-based SDK for integrating with Claude-Code-as-a-Service backend services. The SDK follows a **Composables-First** design philosophy, providing reusable state management and interaction patterns.

## Design Philosophy

### Why Composables Instead of Vue Plugin?

| Approach | Advantages | Disadvantages |
|----------|------------|---------------|
| **Composables (Adopted)** | Progressive adoption, easy to test, type-safe, tree-shaking friendly | Requires manual imports |
| Vue Plugin | Global registration, convenient usage | Adds abstraction layer, difficult to tree-shake |

**Decision**: AgentListener.vue is already a mature solution (1,941 lines). A Vue Plugin would add unnecessary abstraction. Composables allow progressive adoption and are easier to test and maintain.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        @ccaas/vue-sdk                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        COMPOSABLES LAYER                            │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │useAgentState │  │ useFormBridge│  │    useAIEditing          │  │ │
│  │  │ • State      │  │ • Form reg   │  │ • AI edit mode mgmt      │  │ │
│  │  │ • Injection  │  │ • Data sync  │  │ • Section tracking       │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │ │
│  │  │ usePlanMode  │  │useTodoProgress│ │   useToolActivity        │  │ │
│  │  │ • Proposals  │  │ • Progress   │  │ • Tool execution         │  │ │
│  │  │ • Confirm    │  │ • Stats      │  │ • History                │  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌────────────────────────────────▼────────────────────────────────────┐│
│  │                        SERVICES LAYER                               ││
│  │  ┌─────────────────────────────────────────────────────────────┐   ││
│  │  │              FormStateSynchronizer (Singleton)               │   ││
│  │  │  • Form registration/unregistration                          │   ││
│  │  │  • Field-level updates                                       │   ││
│  │  │  • Event pub/sub                                             │   ││
│  │  └─────────────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                    │                                     │
│  ┌────────────────────────────────▼────────────────────────────────────┐│
│  │                        TYPES & SYMBOLS LAYER                        ││
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ││
│  │  │ Connection Types │  │  Agent State     │  │ Injection Keys   │  ││
│  │  │ • ConnectionState│  │ • TodoItem       │  │ • 40+ type-safe  │  ││
│  │  │ • PageContext    │  │ • ToolActivity   │  │   symbols        │  ││
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    @ccaas/common                                        │
│                    (Shared Protocol Definitions)                        │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. useAIEditing - AI Editing Mode Management

**Purpose**: Manages AI-generated content with section-based editing, supports progress tracking and callbacks.

```typescript
// Usage example
const sectionIds = ['intro', 'body', 'conclusion'] as const

const {
  aiEditingMode,        // Whether in AI editing mode
  aiCurrentSection,     // Currently editing section
  aiCompletedSections,  // Completed sections set
  aiPendingSections,    // Pending sections set
  progress,             // Progress percentage (0-100)
  startAIEditing,       // Start AI editing
  updateFromAI,         // Update section from AI
  completeAISection,    // Mark section complete
  finishAIEditing,      // Finish AI editing
  cancelAIEditing,      // Cancel AI editing
} = useAIEditing({
  allSections: sectionIds,
  onSectionUpdate: (id, content) => {
    // Update section content
    form[id] = content
  },
  onComplete: () => {
    // Callback when all sections complete
    toast.success('AI generation complete')
  }
})
```

**State Flow Diagram**:

```
  startAIEditing()
        │
        ▼
┌───────────────────┐
│   aiEditingMode   │◄──────────────────┐
│      = true       │                   │
│                   │                   │
│ aiCurrentSection  │                   │
│   = sections[0]   │                   │
│                   │                   │
│ aiPendingSections │                   │
│   = all sections  │                   │
└───────────────────┘                   │
        │                               │
        │ updateFromAI(id, content)     │
        ▼                               │
┌───────────────────┐                   │
│ onSectionUpdate() │                   │
│    callback       │                   │
└───────────────────┘                   │
        │                               │
        │ completeAISection(id)         │
        ▼                               │
┌───────────────────┐                   │
│ Remove from       │                   │
│ pending, add to   │───► More pending?─┘
│ completed         │         │
└───────────────────┘         │ No
                              ▼
                    ┌───────────────────┐
                    │  onComplete()     │
                    │    callback       │
                    └───────────────────┘
```

### 2. FormStateSynchronizer - Form State Synchronization Service

**Purpose**: Bridges Vue reactivity system with external form updates, provides centralized form state management.

```typescript
// Service singleton
const sync = getFormStateSynchronizer()

// Register form
sync.registerForm('lesson-plan-form', reactiveFormState)

// Update fields from Agent
sync.updateFields('lesson-plan-form', {
  title: 'New Title',
  objectives: ['Objective 1', 'Objective 2']
}, 'agent')

// Subscribe to update events
const unsubscribe = sync.onFormUpdated((event) => {
  console.log(`${event.formId}.${event.field} updated`)
  // Can be used to highlight changed fields
})
```

### 3. useFormBridge - Form Bridge Composable

**Purpose**: Simplifies component-Agent form interaction, automatically handles registration/unregistration lifecycle.

```typescript
// Usage in component
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

// isActive indicates whether this form is the current active form
```

### 4. Injection Symbols

The SDK exports 40+ type-safe injection symbols for Vue's provide/inject pattern:

```typescript
// Connection state
AgentClientIdKey      // Client ID
AgentSessionIdKey     // Session ID
AgentConnectedKey     // Connection status

// Processing state
IsAgentProcessingKey  // Whether processing
CurrentToolNameKey    // Current tool name
CurrentSkillNameKey   // Current skill name

// Todo tracking
TodoItemsKey          // Todo list
SubagentTodosKey      // SubAgent todos
TodoStatsKey          // Todo statistics

// Plan mode
PendingPlanProposalKey   // Pending plan proposal
ConfirmPlanProposalKey   // Confirm function
RejectPlanProposalKey    // Reject function

// Output generation
AiOutputGeneratingKey    // Whether generating
AiOutputProgressKey      // Generation progress

// Form bridge
RegisterAgentFormKey     // Register form function
UnregisterAgentFormKey   // Unregister form function
ActiveFormIdKey          // Current active form ID
```

## Type System

### Core Type Definitions

```typescript
// Connection state
interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  error?: string
  reconnectAttempts: number
}

// Todo item
interface TodoItem {
  id?: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

// Tool activity
interface ToolActivity {
  toolName: string
  toolId: string
  phase: 'start' | 'end'
  description: string
  agentType?: string
  duration?: number
  success?: boolean
}

// Plan proposal
interface PlanProposal {
  traceId: string
  sections: PlanProposalSection[]
  context: PlanProposalContext
}
```

## Backend Integration

### Socket.io Event Mapping

| Backend Event | SDK Handler | Updated State |
|---------------|-------------|---------------|
| `agent_status` | AgentListener | `isProcessing`, `currentToolName` |
| `tool_activity` | AgentListener | `toolActivityHistory` |
| `todo_update` | AgentListener | `todoItems`, `todoStats` |
| `output_update` | AgentListener | Triggers `onSectionUpdate` |
| `plan_proposal` | AgentListener | `pendingPlanProposal` |

### Page Context Synchronization

```typescript
interface PageContext {
  route: string           // Current route
  pageType: string        // Page type
  entityId?: string       // Entity ID
  entityType?: string     // Entity type
  editMode?: boolean      // Edit mode
  selectedFields?: string[]  // Selected fields
  dirtyFields?: string[]     // Dirty fields
  currentData?: Record<string, unknown>  // Current data
}
```

## Test Coverage

### Test Statistics

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `useAIEditing.spec.ts` | 21 | State transitions, progress calculation, callback triggers |
| `FormStateSynchronizer.spec.ts` | 18 | Registration/unregistration, field updates, event publishing |
| `useTodoProgress.spec.ts` | 11 | Statistics calculation, progress, filters |
| `exports.spec.ts` | 14 | Export completeness validation |
| **Total** | **64** | |

### Key Test Scenarios

1. **AI Editing Lifecycle**
   - Sets first section as current when editing starts
   - Automatically advances to next section when one completes
   - Triggers onComplete when all sections complete
   - Cleans up all state when editing is cancelled

2. **Form Synchronization**
   - Field updates trigger events
   - Events include old/new values for diff display
   - Handler errors don't affect other handlers

## Build Artifacts

```
dist/
├── index.js      (20.04 KB) - ESM module
├── index.cjs     (22.57 KB) - CommonJS module
├── index.d.ts    (32.98 KB) - TypeScript declarations
└── index.d.cts   (32.98 KB) - CTS declarations
```

## Usage Examples

### Basic Integration

```vue
<!-- App.vue -->
<template>
  <AgentListener>
    <RouterView />
  </AgentListener>
</template>
```

### Consuming State in Components

```vue
<script setup lang="ts">
import { useAgentState, useTodoProgress } from '@ccaas/vue-sdk'

const { isProcessing, currentToolName } = useAgentState()
const { progress, currentTodo, isComplete } = useTodoProgress()
</script>

<template>
  <div v-if="isProcessing" class="agent-status">
    <span>Executing: {{ currentToolName }}</span>
    <ProgressBar :value="progress" />
    <span v-if="currentTodo">{{ currentTodo.content }}</span>
  </div>
  <div v-if="isComplete" class="success">
    All tasks completed!
  </div>
</template>
```

### Using AI Editing in Pinia Store

```typescript
// stores/lessonPlanStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAIEditing } from '@ccaas/vue-sdk'

export const useLessonPlanStore = defineStore('lessonPlan', () => {
  const sections = ref({
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
    finishAIEditing
  } = useAIEditing({
    allSections: ['objectives', 'activities', 'assessment'],
    onSectionUpdate: (id, content) => {
      sections.value[id] = content as string
    }
  })

  return {
    sections,
    aiEditingMode,
    aiCurrentSection,
    progress,
    startAIEditing,
    updateFromAI,
    completeAISection,
    finishAIEditing
  }
})
```

## Migration Guide

### Migrating from Direct inject to Composables

**Before**:
```typescript
const isProcessing = inject(IsAgentProcessingKey)
const todoItems = inject(TodoItemsKey)
const stats = computed(() => /* manually calculate stats */)
```

**After**:
```typescript
const { todoItems, stats, progress, currentTodo } = useTodoProgress()
```

### Migrating from Manual Form Registration

**Before**:
```typescript
const registerForm = inject(RegisterAgentFormKey)
const unregisterForm = inject(UnregisterAgentFormKey)

onMounted(() => registerForm('my-form', handlers))
onUnmounted(() => unregisterForm('my-form'))
```

**After**:
```typescript
const { isActive } = useFormBridge({
  formId: 'my-form',
  ...handlers
})
// Lifecycle handled automatically
```

## Version Compatibility

| Dependency | Minimum Version |
|------------|-----------------|
| Vue | 3.3.0+ |
| socket.io-client | 4.0.0+ |
| TypeScript | 5.0.0+ |

## License

MIT
