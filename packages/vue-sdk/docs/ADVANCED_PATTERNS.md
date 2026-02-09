# Advanced Patterns Guide

This guide covers advanced usage patterns for @ccaas/vue-sdk, including composable composition, provide/inject patterns, reactivity optimization, and state management integration.

## Table of Contents

- [Composable Composition Patterns](#composable-composition-patterns)
- [Provide/Inject Advanced Usage](#provideinject-advanced-usage)
- [Reactive Best Practices](#reactive-best-practices)
- [Watch and Computed Optimization](#watch-and-computed-optimization)
- [Custom Composables](#custom-composables)
- [State Management Integration](#state-management-integration)
- [Performance Patterns](#performance-patterns)

## Composable Composition Patterns

### Pattern 1: Layered Composables

Build higher-level composables by composing lower-level ones.

```typescript
// Low-level composable
import { useAgentState, useTodoProgress } from '@ccaas/vue-sdk'

export function useAgentProgress() {
  const { isProcessing, currentToolName } = useAgentState()
  const { progress, currentTodo, stats } = useTodoProgress()

  const detailedStatus = computed(() => {
    if (!isProcessing.value) return 'Idle'
    if (currentTodo.value) {
      return `${currentToolName.value}: ${currentTodo.value.content}`
    }
    return currentToolName.value || 'Processing'
  })

  return {
    isProcessing,
    currentToolName,
    progress,
    currentTodo,
    stats,
    detailedStatus
  }
}
```

### Pattern 2: Domain-Specific Wrappers

Wrap SDK composables with domain logic.

```typescript
import { useAIEditing } from '@ccaas/vue-sdk'
import { useNotification } from './useNotification'

export function useLessonPlanAIEditing(form: Ref<LessonPlanForm>) {
  const { toast } = useNotification()

  const {
    aiEditingMode,
    progress,
    startAIEditing,
    updateFromAI,
    completeAISection,
    finishAIEditing,
    cancelAIEditing
  } = useAIEditing({
    allSections: ['objectives', 'activities', 'assessment', 'materials'],
    onSectionUpdate: (id, content) => {
      // Domain-specific validation
      if (typeof content === 'string' && content.length > 5000) {
        toast.warning(`${id} content is very long`)
      }
      form.value[id] = content
    },
    onComplete: () => {
      toast.success('Lesson plan generated successfully')
    },
    onCancel: () => {
      toast.info('AI editing cancelled')
    }
  })

  // Domain-specific methods
  const generateFullPlan = () => {
    startAIEditing() // All sections
  }

  const regenerateSection = (sectionId: string) => {
    startAIEditing([sectionId])
  }

  return {
    aiEditingMode,
    progress,
    generateFullPlan,
    regenerateSection,
    updateFromAI,
    completeAISection,
    finishAIEditing,
    cancelAIEditing
  }
}
```

### Pattern 3: Multi-Composable Orchestration

Coordinate multiple composables in a single orchestrator.

```typescript
import {
  useAgentState,
  useTodoProgress,
  usePlanMode,
  useFormBridge
} from '@ccaas/vue-sdk'

export function useDocumentEditor(documentId: string) {
  const form = reactive<DocumentForm>({
    title: '',
    content: '',
    tags: []
  })

  // Compose multiple SDK composables
  const agentState = useAgentState()
  const todoProgress = useTodoProgress()
  const planMode = usePlanMode()
  const formBridge = useFormBridge({
    formId: `document-${documentId}`,
    getFormState: () => ({ ...form }),
    applyFormData: async (data) => {
      Object.assign(form, data)
      return { success: true, appliedFields: Object.keys(data) }
    }
  })

  // Orchestration logic
  const canEdit = computed(() => {
    return !agentState.isProcessing.value && formBridge.isActive.value
  })

  const needsReview = computed(() => {
    return planMode.hasPendingProposal.value
  })

  const saveDocument = async () => {
    if (!canEdit.value) {
      throw new Error('Cannot save while agent is processing')
    }
    // Save logic
  }

  return {
    form,
    canEdit,
    needsReview,
    saveDocument,
    agentState,
    todoProgress,
    planMode
  }
}
```

## Provide/Inject Advanced Usage

### Pattern 1: Scoped Injection Context

Create isolated injection contexts for different parts of your app.

```typescript
// ParentComponent.vue
<script setup lang="ts">
import { provide, InjectionKey } from 'vue'

interface DocumentContext {
  documentId: string
  permissions: string[]
}

export const DocumentContextKey: InjectionKey<DocumentContext> =
  Symbol('DocumentContext')

const props = defineProps<{ documentId: string }>()

provide(DocumentContextKey, {
  documentId: props.documentId,
  permissions: ['read', 'write']
})
</script>

// ChildComponent.vue
<script setup lang="ts">
import { inject } from 'vue'
import { useFormBridge } from '@ccaas/vue-sdk'
import { DocumentContextKey } from './ParentComponent.vue'

const context = inject(DocumentContextKey)
if (!context) throw new Error('DocumentContext not provided')

const { isActive } = useFormBridge({
  formId: `doc-${context.documentId}`,
  readonly: !context.permissions.includes('write'),
  // ...
})
</script>
```

### Pattern 2: Default Values with Type Safety

Provide default values while maintaining type safety.

```typescript
import { inject, InjectionKey } from 'vue'

// Define typed injection key with default
interface FeatureFlags {
  enableAI: boolean
  enableCollaboration: boolean
}

const FeatureFlagsKey: InjectionKey<FeatureFlags> = Symbol('FeatureFlags')

const defaultFlags: FeatureFlags = {
  enableAI: false,
  enableCollaboration: false
}

// In component
const flags = inject(FeatureFlagsKey, defaultFlags)

// Now flags is always defined with proper type
if (flags.enableAI) {
  // Use AI features
}
```

### Pattern 3: Computed Injection

Inject computed values that react to parent state changes.

```typescript
// ParentComponent.vue
<script setup lang="ts">
import { provide, computed } from 'vue'
import { useAgentState } from '@ccaas/vue-sdk'

const { isProcessing } = useAgentState()

const canEdit = computed(() => !isProcessing.value)

// Provide computed ref
provide('canEdit', canEdit)
</script>

// ChildComponent.vue
<script setup lang="ts">
import { inject } from 'vue'

const canEdit = inject<ComputedRef<boolean>>('canEdit')

// canEdit automatically updates when parent's isProcessing changes
</script>

<template>
  <button :disabled="!canEdit">Edit</button>
</template>
```

## Reactive Best Practices

### Practice 1: Avoid Reactivity Loss

```typescript
// ❌ Wrong: Destructuring loses reactivity
const { isProcessing } = useAgentState()
watch(isProcessing, () => {
  // This won't react to changes!
})

// ✅ Correct: Keep the ref
const agentState = useAgentState()
watch(() => agentState.isProcessing.value, () => {
  // This works
})

// ✅ Alternative: Use toRef
const { isProcessing } = toRefs(useAgentState())
watch(isProcessing, () => {
  // This also works
})
```

### Practice 2: Shallow vs Deep Reactivity

```typescript
import { reactive, shallowReactive } from 'vue'

// Deep reactivity (default) - all nested properties are reactive
const deepForm = reactive({
  user: {
    name: '',
    address: {
      street: '',
      city: ''
    }
  }
})

// Shallow reactivity - only top-level properties are reactive
const shallowForm = shallowReactive({
  user: {
    name: '',
    address: {
      street: '',
      city: ''
    }
  }
})

// Use shallow when:
// - You have large nested objects that rarely change
// - You replace entire objects rather than mutate nested properties
// - Performance is critical
```

### Practice 3: Readonly State Exposure

```typescript
import { ref, readonly, Ref } from 'vue'

export function useCounter() {
  const count = ref(0)
  const history = ref<number[]>([])

  const increment = () => {
    count.value++
    history.value.push(count.value)
  }

  // Expose readonly versions
  return {
    count: readonly(count),
    history: readonly(history),
    increment
  }
}

// Consumers can't mutate the state directly
const { count, increment } = useCounter()
// count.value++ // Error: readonly
increment() // ✅ Correct way
```

### Practice 4: Avoid Unnecessary Reactivity

```typescript
// ❌ Don't make constants reactive
const settings = reactive({
  API_URL: 'https://api.example.com', // This never changes
  MAX_RETRIES: 3                       // This never changes
})

// ✅ Use plain objects for constants
const SETTINGS = {
  API_URL: 'https://api.example.com',
  MAX_RETRIES: 3
} as const

// ✅ Only make dynamic data reactive
const state = reactive({
  retryCount: 0,
  lastError: null
})
```

## Watch and Computed Optimization

### Optimization 1: Lazy Watchers

```typescript
import { watch, ref } from 'vue'

const search = ref('')
const results = ref([])

// ❌ Immediate execution (runs on mount)
watch(search, async (newVal) => {
  results.value = await fetchResults(newVal)
}, { immediate: true })

// ✅ Lazy execution (only runs on change)
watch(search, async (newVal) => {
  if (newVal) {
    results.value = await fetchResults(newVal)
  }
})
```

### Optimization 2: Debounced Watchers

```typescript
import { watch, ref } from 'vue'
import { useDebounceFn } from '@vueuse/core'

const searchInput = ref('')
const searchResults = ref([])

const debouncedSearch = useDebounceFn(async (query: string) => {
  searchResults.value = await fetchResults(query)
}, 300)

watch(searchInput, (newVal) => {
  debouncedSearch(newVal)
})
```

### Optimization 3: Computed with Getter and Setter

```typescript
import { ref, computed } from 'vue'

const firstName = ref('John')
const lastName = ref('Doe')

// Read-write computed
const fullName = computed({
  get() {
    return `${firstName.value} ${lastName.value}`
  },
  set(newValue: string) {
    const parts = newValue.split(' ')
    firstName.value = parts[0] || ''
    lastName.value = parts[1] || ''
  }
})

// Usage
console.log(fullName.value) // "John Doe"
fullName.value = "Jane Smith" // Updates firstName and lastName
```

### Optimization 4: Selective Watch Triggers

```typescript
import { watch, reactive } from 'vue'

const state = reactive({
  count: 0,
  name: 'Test',
  config: { theme: 'dark' }
})

// ❌ Watches entire object (triggers on any change)
watch(state, () => {
  console.log('State changed')
})

// ✅ Watch specific properties
watch(() => state.count, (newCount) => {
  console.log('Count changed:', newCount)
})

// ✅ Watch multiple specific properties
watch([() => state.count, () => state.name], ([newCount, newName]) => {
  console.log('Count or name changed:', newCount, newName)
})
```

### Optimization 5: Computed Caching

```typescript
import { computed, ref } from 'vue'

const items = ref([1, 2, 3, 4, 5])

// ❌ Function: Recalculates every access
const sumFunction = () => items.value.reduce((a, b) => a + b, 0)

// ✅ Computed: Cached until dependencies change
const sumComputed = computed(() =>
  items.value.reduce((a, b) => a + b, 0)
)

// Multiple accesses to sumComputed only calculate once
console.log(sumComputed.value) // Calculates
console.log(sumComputed.value) // Returns cached value
console.log(sumComputed.value) // Returns cached value
```

## Custom Composables

### Pattern 1: Composable with Cleanup

```typescript
import { ref, onUnmounted } from 'vue'

export function useWebSocket(url: string) {
  const socket = ref<WebSocket | null>(null)
  const messages = ref<string[]>([])
  const isConnected = ref(false)

  const connect = () => {
    socket.value = new WebSocket(url)

    socket.value.onopen = () => {
      isConnected.value = true
    }

    socket.value.onmessage = (event) => {
      messages.value.push(event.data)
    }

    socket.value.onclose = () => {
      isConnected.value = false
    }
  }

  const disconnect = () => {
    socket.value?.close()
    socket.value = null
  }

  // Automatic cleanup
  onUnmounted(() => {
    disconnect()
  })

  return {
    messages: readonly(messages),
    isConnected: readonly(isConnected),
    connect,
    disconnect
  }
}
```

### Pattern 2: Async Composable with Loading State

```typescript
import { ref, Ref } from 'vue'

interface UseAsyncResult<T> {
  data: Ref<T | null>
  error: Ref<Error | null>
  loading: Ref<boolean>
  execute: (...args: any[]) => Promise<void>
}

export function useAsync<T>(
  asyncFn: (...args: any[]) => Promise<T>
): UseAsyncResult<T> {
  const data = ref<T | null>(null)
  const error = ref<Error | null>(null)
  const loading = ref(false)

  const execute = async (...args: any[]) => {
    loading.value = true
    error.value = null

    try {
      data.value = await asyncFn(...args)
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
    } finally {
      loading.value = false
    }
  }

  return {
    data,
    error,
    loading,
    execute
  }
}

// Usage
const { data, loading, error, execute } = useAsync(fetchUserData)

await execute(userId)
```

### Pattern 3: Composable with Event Emitter

```typescript
import { ref, Ref } from 'vue'

type EventCallback<T> = (data: T) => void

export function useEventEmitter<T>() {
  const listeners = ref<EventCallback<T>[]>([])

  const on = (callback: EventCallback<T>) => {
    listeners.value.push(callback)

    // Return unsubscribe function
    return () => {
      const index = listeners.value.indexOf(callback)
      if (index > -1) {
        listeners.value.splice(index, 1)
      }
    }
  }

  const emit = (data: T) => {
    listeners.value.forEach(callback => callback(data))
  }

  const clear = () => {
    listeners.value = []
  }

  return {
    on,
    emit,
    clear
  }
}

// Usage
const formEvents = useEventEmitter<{ field: string; value: any }>()

const unsubscribe = formEvents.on((data) => {
  console.log('Field changed:', data.field, data.value)
})

formEvents.emit({ field: 'title', value: 'New Title' })

// Cleanup
unsubscribe()
```

## State Management Integration

### Pattern 1: Pinia Store with SDK Composables

```typescript
// stores/agentStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  useAgentState,
  useTodoProgress,
  usePlanMode
} from '@ccaas/vue-sdk'

export const useAgentStore = defineStore('agent', () => {
  // SDK composables
  const agentState = useAgentState()
  const todoProgress = useTodoProgress()
  const planMode = usePlanMode()

  // Store-specific state
  const history = ref<string[]>([])
  const preferences = ref({
    autoConfirmPlans: false,
    showDetailedProgress: true
  })

  // Computed
  const isIdle = computed(() =>
    !agentState.isProcessing.value &&
    todoProgress.progress.value === 100
  )

  // Actions
  const recordAction = (action: string) => {
    history.value.push(`${new Date().toISOString()}: ${action}`)
  }

  const handlePlanProposal = () => {
    if (planMode.hasPendingProposal.value) {
      if (preferences.value.autoConfirmPlans) {
        planMode.confirm()
        recordAction('Auto-confirmed plan')
      }
    }
  }

  return {
    // SDK state
    ...agentState,
    ...todoProgress,
    ...planMode,

    // Store state
    history,
    preferences,
    isIdle,

    // Store actions
    recordAction,
    handlePlanProposal
  }
})
```

### Pattern 2: Vuex Module with SDK Integration

```typescript
// store/modules/agent.ts
import { Module } from 'vuex'
import {
  useAgentState,
  useTodoProgress
} from '@ccaas/vue-sdk'

// Create composables outside component context
let agentStateInstance: ReturnType<typeof useAgentState>
let todoProgressInstance: ReturnType<typeof useTodoProgress>

export const agentModule: Module<any, any> = {
  namespaced: true,

  state: () => ({
    sessionHistory: [],
    userPreferences: {}
  }),

  getters: {
    isProcessing: () => agentStateInstance?.isProcessing.value ?? false,
    progress: () => todoProgressInstance?.progress.value ?? 0,

    sessionStatus: (state, getters) => {
      if (getters.isProcessing) {
        return `Processing (${getters.progress}%)`
      }
      return 'Idle'
    }
  },

  actions: {
    // Initialize SDK composables
    initializeSDK() {
      agentStateInstance = useAgentState()
      todoProgressInstance = useTodoProgress()
    },

    recordSession({ state }, sessionData) {
      state.sessionHistory.push(sessionData)
    }
  }
}
```

### Pattern 3: Hybrid Pinia + SDK Pattern

```typescript
// stores/documentStore.ts
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useFormBridge, useAIEditing } from '@ccaas/vue-sdk'

export const useDocumentStore = defineStore('document', () => {
  const document = ref({
    id: '',
    title: '',
    content: '',
    sections: []
  })

  // SDK composables
  const formBridge = useFormBridge({
    formId: 'document-editor',
    getFormState: () => ({ ...document.value }),
    applyFormData: async (data) => {
      Object.assign(document.value, data)
      return { success: true, appliedFields: Object.keys(data) }
    }
  })

  const aiEditing = useAIEditing({
    allSections: ['title', 'content'],
    onSectionUpdate: (id, content) => {
      document.value[id] = content
    }
  })

  // Watch SDK state and update store
  watch(() => formBridge.isActive.value, (isActive) => {
    if (isActive) {
      console.log('Document form is now active')
    }
  })

  // Store actions
  const loadDocument = async (id: string) => {
    const data = await fetchDocument(id)
    document.value = data
  }

  const saveDocument = async () => {
    await updateDocument(document.value)
  }

  return {
    document,
    formBridge,
    aiEditing,
    loadDocument,
    saveDocument
  }
})
```

## Performance Patterns

### Pattern 1: Lazy Component Loading with SDK

```vue
<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { useAgentState } from '@ccaas/vue-sdk'

const { isProcessing } = useAgentState()

// Lazy load heavy component
const AgentDashboard = defineAsyncComponent(() =>
  import('./components/AgentDashboard.vue')
)

const showDashboard = ref(false)
</script>

<template>
  <div>
    <button @click="showDashboard = !showDashboard">
      Toggle Dashboard
    </button>

    <!-- Only load when needed -->
    <Suspense v-if="showDashboard">
      <AgentDashboard :is-processing="isProcessing" />
      <template #fallback>
        Loading dashboard...
      </template>
    </Suspense>
  </div>
</template>
```

### Pattern 2: Virtual Scrolling for Large Lists

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTodoProgress } from '@ccaas/vue-sdk'
import { useVirtualList } from '@vueuse/core'

const { todoItems } = useTodoProgress()

// Virtual scrolling for performance
const { list, containerProps, wrapperProps } = useVirtualList(
  todoItems,
  {
    itemHeight: 50,
    overscan: 5
  }
)
</script>

<template>
  <div v-bind="containerProps" style="height: 400px; overflow-y: auto">
    <div v-bind="wrapperProps">
      <div
        v-for="{ data: todo, index } in list"
        :key="index"
        style="height: 50px"
      >
        {{ todo.content }}
      </div>
    </div>
  </div>
</template>
```

### Pattern 3: Memoization for Expensive Computations

```typescript
import { computed, ref } from 'vue'
import { useTodoProgress } from '@ccaas/vue-sdk'

export function useTaskAnalytics() {
  const { todoItems } = useTodoProgress()

  // Memoized expensive computation
  const analytics = computed(() => {
    // Only recalculates when todoItems changes
    const completed = todoItems.value?.filter(t => t.status === 'completed') || []
    const pending = todoItems.value?.filter(t => t.status === 'pending') || []

    return {
      completionRate: completed.length / (todoItems.value?.length || 1),
      averageCompletionTime: calculateAverage(completed),
      estimatedTimeRemaining: estimateTimeRemaining(pending),
      // More expensive calculations...
    }
  })

  return {
    analytics
  }
}
```

### Pattern 4: Throttled Updates

```typescript
import { ref, watch } from 'vue'
import { useThrottleFn } from '@vueuse/core'
import { useAgentState } from '@ccaas/vue-sdk'

export function useActivityMonitor() {
  const { currentToolName } = useAgentState()
  const activityLog = ref<string[]>([])

  // Throttle log updates to avoid performance issues
  const throttledLog = useThrottleFn((toolName: string) => {
    activityLog.value.push(`${new Date().toISOString()}: ${toolName}`)

    // Keep only last 100 entries
    if (activityLog.value.length > 100) {
      activityLog.value = activityLog.value.slice(-100)
    }
  }, 1000)

  watch(() => currentToolName.value, (newTool) => {
    if (newTool) {
      throttledLog(newTool)
    }
  })

  return {
    activityLog: readonly(activityLog)
  }
}
```

## Best Practices Summary

1. **Composable Design**
   - Keep composables focused and single-purpose
   - Compose smaller composables into larger ones
   - Use TypeScript for type safety
   - Document composable APIs

2. **Reactivity Management**
   - Avoid destructuring reactive objects
   - Use `readonly()` to prevent unwanted mutations
   - Prefer shallow reactivity for large objects
   - Don't make constants reactive

3. **Performance**
   - Use computed for derived state
   - Debounce/throttle expensive operations
   - Lazy load components and data
   - Use virtual scrolling for large lists

4. **State Management**
   - Integrate SDK with Pinia/Vuex stores
   - Keep SDK composables and store state separate
   - Use watchers to sync SDK state with store
   - Expose combined state through store getters

5. **Testing**
   - Mock injection keys in tests
   - Test composables in isolation
   - Use Vue Test Utils for component tests
   - Test cleanup behavior (onUnmounted)
