import { ref, computed, watch, onUnmounted, toValue } from 'vue'
import type { ComputedRef } from 'vue'
import type { ActiveSubAgent, EventTodoItem } from '@kedge-agentic/common'
import type {
  UnifiedTask,
  TaskGroups,
  TaskBadgeState,
  UseTaskTrackingOptions,
  UseTaskTrackingReturn,
} from '../types/tasks'

/**
 * Converts a SubAgent to UnifiedTask.
 */
function convertSubAgentToTask(agent: ActiveSubAgent): UnifiedTask {
  return {
    id: agent.subAgentId,
    type: 'subagent',
    status: agent.status,
    title: agent.description || agent.agentType,
    description: agent.agentType,
    startedAt: new Date(agent.startedAt),
    agentType: agent.agentType,
    nestingLevel: agent.nestingLevel,
    raw: agent,
  }
}

/**
 * Converts a TodoItem to UnifiedTask.
 */
function convertTodoToTask(todo: EventTodoItem, index: number): UnifiedTask {
  return {
    id: todo.id || `todo-${index}`,
    type: 'todo',
    status: todo.status,
    title: todo.content,
    activeForm: todo.activeForm,
    progress: todo.progress,
    raw: todo,
  }
}

/**
 * Composable for tracking and aggregating tasks from multiple sources (SubAgents, TodoItems).
 *
 * Features:
 * - Unified task interface for both SubAgents and TodoItems
 * - Groups tasks by status (active, completed, failed)
 * - Calculates badge state with priority logic
 * - Maintains recent task history (time-based and count-based cleanup)
 *
 * Options accept Ref or raw arrays for activeSubAgents and todoItems.
 * Returns computed properties for groups, badgeState, and allTasks.
 *
 * @example
 * ```vue
 * <script setup>
 * const taskTracking = useTaskTracking({
 *   activeSubAgents: agentStatus.activeSubAgents,
 *   todoItems: agentStatus.todoItems,
 * })
 *
 * // Use in template
 * // taskTracking.badgeState.value
 * // taskTracking.groups.value
 * </script>
 * ```
 */
export function useTaskTracking(options: UseTaskTrackingOptions): UseTaskTrackingReturn {
  const { activeSubAgents, todoItems, maxHistorySize = 50 } = options

  // History: stores completed/failed tasks with timestamps
  const taskHistory = ref<Map<string, { task: UnifiedTask; timestamp: number }>>(new Map())

  // Convert and merge current tasks (reactive via toValue)
  const currentTasks = computed<UnifiedTask[]>(() => {
    const agents = toValue(activeSubAgents)
    const todos = toValue(todoItems)
    const subAgentTasks = agents.map(convertSubAgentToTask)
    const todoTasks = todos.map(convertTodoToTask)
    return [...subAgentTasks, ...todoTasks]
  })

  // Track completed/failed tasks in history
  watch(currentTasks, (tasks) => {
    const updated = new Map(taskHistory.value)
    const now = Date.now()

    tasks.forEach(task => {
      if (task.status === 'completed' || task.status === 'failed') {
        if (!updated.has(task.id)) {
          updated.set(task.id, { task, timestamp: now })
        }
      }
    })

    taskHistory.value = updated
  }, { immediate: true })

  // Cleanup old history (time-based: 30 minutes, count-based: maxHistorySize)
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    const thirtyMinutesAgo = now - 30 * 60 * 1000

    const updated = new Map(taskHistory.value)

    // Remove entries older than 30 minutes
    for (const [id, entry] of updated.entries()) {
      if (entry.timestamp < thirtyMinutesAgo) {
        updated.delete(id)
      }
    }

    // If still over limit, remove oldest entries
    if (updated.size > maxHistorySize) {
      const sorted = Array.from(updated.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)

      const toRemove = sorted.slice(0, updated.size - maxHistorySize)
      toRemove.forEach(([id]) => updated.delete(id))
    }

    taskHistory.value = updated
  }, 10 * 60 * 1000) // Check every 10 minutes

  onUnmounted(() => {
    clearInterval(cleanupInterval)
  })

  // Group tasks
  const groups: ComputedRef<TaskGroups> = computed(() => {
    const active: UnifiedTask[] = []
    const recentCompleted: UnifiedTask[] = []
    const recentFailed: UnifiedTask[] = []

    // Add current active tasks
    currentTasks.value.forEach(task => {
      if (task.status === 'running' || task.status === 'in_progress' || task.status === 'pending') {
        active.push(task)
      }
    })

    // Add recent completed/failed from history (last 30 minutes)
    const now = Date.now()
    const thirtyMinutesAgo = now - 30 * 60 * 1000

    taskHistory.value.forEach(entry => {
      if (entry.timestamp >= thirtyMinutesAgo) {
        if (entry.task.status === 'completed') {
          recentCompleted.push(entry.task)
        } else if (entry.task.status === 'failed') {
          recentFailed.push(entry.task)
        }
      }
    })

    // Sort by timestamp (most recent first)
    const sortByTime = (a: UnifiedTask, b: UnifiedTask) => {
      const timeA = a.startedAt?.getTime() || 0
      const timeB = b.startedAt?.getTime() || 0
      return timeB - timeA
    }

    return {
      active: active.sort(sortByTime),
      recentCompleted: recentCompleted.sort(sortByTime),
      recentFailed: recentFailed.sort(sortByTime),
    }
  })

  // Calculate badge state
  const badgeState: ComputedRef<TaskBadgeState> = computed(() => {
    // Priority: Failed > Active > Completed > Pending
    if (groups.value.recentFailed.length > 0) {
      return {
        show: true,
        color: 'red',
        count: groups.value.recentFailed.length,
        label: `${groups.value.recentFailed.length} failed`,
      }
    }

    const runningTasks = groups.value.active.filter(
      t => t.status === 'running' || t.status === 'in_progress'
    )
    if (runningTasks.length > 0) {
      return {
        show: true,
        color: 'green',
        count: runningTasks.length,
        label: `${runningTasks.length} running`,
      }
    }

    if (groups.value.recentCompleted.length > 0) {
      return {
        show: true,
        color: 'blue',
        count: groups.value.recentCompleted.length,
        label: `${groups.value.recentCompleted.length} completed`,
      }
    }

    const pendingTasks = groups.value.active.filter(t => t.status === 'pending')
    if (pendingTasks.length > 0) {
      return {
        show: true,
        color: 'amber',
        count: pendingTasks.length,
        label: `${pendingTasks.length} pending`,
      }
    }

    return {
      show: false,
      color: 'blue',
      label: 'No tasks',
    }
  })

  // All tasks (current + history)
  const allTasks: ComputedRef<UnifiedTask[]> = computed(() => {
    const historyTasks = Array.from(taskHistory.value.values()).map(entry => entry.task)
    const allTasksMap = new Map<string, UnifiedTask>()

    // Add history first (will be overwritten by current if exists)
    historyTasks.forEach(task => allTasksMap.set(task.id, task))

    // Add/update with current tasks
    currentTasks.value.forEach(task => allTasksMap.set(task.id, task))

    return Array.from(allTasksMap.values())
  })

  // Find task by ID
  function findTask(id: string): UnifiedTask | undefined {
    return allTasks.value.find(task => task.id === id)
  }

  // Clear history
  function clearHistory(): void {
    taskHistory.value = new Map()
  }

  return {
    groups,
    badgeState,
    allTasks,
    findTask,
    clearHistory,
  }
}
