/**
 * useTodoProgress Composable
 *
 * Provides todo/task progress tracking with computed helpers.
 */

import { inject, computed, ref } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  TodoItemsKey,
  SubagentTodosKey,
  TodoStatsKey,
} from '../symbols'
import type { TodoItem } from '../types/agent-state'

/**
 * Return type for useTodoProgress
 */
export interface UseTodoProgressReturn {
  /** Main agent todo items */
  todoItems: Readonly<Ref<TodoItem[]>>
  /** Sub-agent specific todos */
  subagentTodos: Readonly<Ref<TodoItem[]>>
  /** Todo statistics */
  stats: Readonly<Ref<{
    completed: number
    inProgress: number
    pending: number
    total: number
  }>>
  /** Progress percentage (0-100) */
  progress: ComputedRef<number>
  /** Whether there are any todos */
  hasTodos: ComputedRef<boolean>
  /** Whether all todos are completed */
  isComplete: ComputedRef<boolean>
  /** Currently active todo */
  currentTodo: ComputedRef<TodoItem | undefined>
  /** Completed todos */
  completedTodos: ComputedRef<TodoItem[]>
  /** Pending todos */
  pendingTodos: ComputedRef<TodoItem[]>
}

// Default fallback values (created as functions to ensure fresh refs each time)
function createDefaultTodoItems(): Ref<TodoItem[]> {
  return ref<TodoItem[]>([])
}
function createDefaultTodoStats(): Ref<{ completed: number; inProgress: number; pending: number; total: number }> {
  return ref({ completed: 0, inProgress: 0, pending: 0, total: 0 })
}

/**
 * Todo progress composable
 *
 * @example
 * ```vue
 * <script setup>
 * import { useTodoProgress } from '@kedge-agentic/vue-sdk'
 *
 * const { todoItems, progress, currentTodo, isComplete } = useTodoProgress()
 * </script>
 *
 * <template>
 *   <div class="progress">
 *     <div class="progress-bar" :style="{ width: progress + '%' }"></div>
 *   </div>
 *   <div v-if="currentTodo">
 *     Currently: {{ currentTodo.activeForm || currentTodo.content }}
 *   </div>
 *   <div v-if="isComplete">All tasks completed!</div>
 * </template>
 * ```
 */
export function useTodoProgress(): UseTodoProgressReturn {
  // Inject values with fallbacks
  const todoItems = inject(TodoItemsKey) ?? createDefaultTodoItems()
  const subagentTodos = inject(SubagentTodosKey) ?? createDefaultTodoItems()
  const stats = inject(TodoStatsKey) ?? createDefaultTodoStats()

  // Computed values
  const progress = computed(() => {
    const total = stats.value.total
    if (total === 0) return 0
    return Math.round((stats.value.completed / total) * 100)
  })

  const hasTodos = computed(() => {
    return todoItems.value.length > 0
  })

  const isComplete = computed(() => {
    return stats.value.total > 0 && stats.value.completed === stats.value.total
  })

  const currentTodo = computed(() => {
    return todoItems.value.find((t) => t.status === 'in_progress')
  })

  const completedTodos = computed(() => {
    return todoItems.value.filter((t) => t.status === 'completed')
  })

  const pendingTodos = computed(() => {
    return todoItems.value.filter((t) => t.status === 'pending')
  })

  return {
    todoItems,
    subagentTodos,
    stats,
    progress,
    hasTodos,
    isComplete,
    currentTodo,
    completedTodos,
    pendingTodos,
  }
}

export default useTodoProgress
