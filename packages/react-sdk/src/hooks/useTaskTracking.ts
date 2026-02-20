import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ActiveSubAgent, EventTodoItem } from '@kedge-agentic/common'
import type {
  UnifiedTask,
  TaskGroups,
  TaskBadgeState,
  UseTaskTrackingOptions,
  UseTaskTrackingReturn,
} from '../types'

/**
 * Converts a SubAgent to UnifiedTask
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
 * Converts a TodoItem to UnifiedTask
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
 * Hook for tracking and aggregating tasks from multiple sources (SubAgents, TodoItems).
 *
 * Features:
 * - Unified task interface for both SubAgents and TodoItems
 * - Groups tasks by status (active, completed, failed)
 * - Calculates badge state with priority logic
 * - Maintains recent task history (time-based and count-based cleanup)
 *
 * @example
 * ```tsx
 * const taskTracking = useTaskTracking({
 *   activeSubAgents,
 *   todoItems,
 * })
 *
 * return (
 *   <div>
 *     <TaskBadge state={taskTracking.badgeState} />
 *     <TasksView groups={taskTracking.groups} />
 *   </div>
 * )
 * ```
 */
export function useTaskTracking(options: UseTaskTrackingOptions): UseTaskTrackingReturn {
  const { activeSubAgents, todoItems, maxHistorySize = 50 } = options

  // History: stores completed/failed tasks with timestamps
  const [taskHistory, setTaskHistory] = useState<Map<string, { task: UnifiedTask; timestamp: number }>>(new Map())

  // Convert and merge current tasks
  const currentTasks = useMemo(() => {
    const subAgentTasks = activeSubAgents.map(convertSubAgentToTask)
    const todoTasks = todoItems.map(convertTodoToTask)
    return [...subAgentTasks, ...todoTasks]
  }, [activeSubAgents, todoItems])

  // Track completed/failed tasks in history
  useEffect(() => {
    setTaskHistory(prev => {
      const updated = new Map(prev)
      const now = Date.now()

      currentTasks.forEach(task => {
        if (task.status === 'completed' || task.status === 'failed') {
          if (!updated.has(task.id)) {
            updated.set(task.id, { task, timestamp: now })
          }
        }
      })

      return updated
    })
  }, [currentTasks])

  // Cleanup old history (time-based: 30 minutes, count-based: max 50 items)
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now()
      const thirtyMinutesAgo = now - 30 * 60 * 1000

      setTaskHistory(prev => {
        const updated = new Map(prev)

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

        return updated
      })
    }, 10 * 60 * 1000) // Check every 10 minutes

    return () => clearInterval(cleanupInterval)
  }, [maxHistorySize])

  // Group tasks
  const groups = useMemo<TaskGroups>(() => {
    const active: UnifiedTask[] = []
    const recentCompleted: UnifiedTask[] = []
    const recentFailed: UnifiedTask[] = []

    // Add current active tasks
    currentTasks.forEach(task => {
      if (task.status === 'running' || task.status === 'in_progress' || task.status === 'pending') {
        active.push(task)
      }
    })

    // Add recent completed/failed from history (last 30 minutes - matches history retention)
    const now = Date.now()
    const thirtyMinutesAgo = now - 30 * 60 * 1000

    taskHistory.forEach(entry => {
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
  }, [currentTasks, taskHistory])

  // Calculate badge state
  const badgeState = useMemo<TaskBadgeState>(() => {
    // Priority: Failed > Active > Completed > Pending
    if (groups.recentFailed.length > 0) {
      return {
        show: true,
        color: 'red',
        count: groups.recentFailed.length,
        label: `${groups.recentFailed.length} failed`,
      }
    }

    const runningTasks = groups.active.filter(t => t.status === 'running' || t.status === 'in_progress')
    if (runningTasks.length > 0) {
      return {
        show: true,
        color: 'green',
        count: runningTasks.length,
        label: `${runningTasks.length} running`,
      }
    }

    if (groups.recentCompleted.length > 0) {
      return {
        show: true,
        color: 'blue',
        count: groups.recentCompleted.length,
        label: `${groups.recentCompleted.length} completed`,
      }
    }

    const pendingTasks = groups.active.filter(t => t.status === 'pending')
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
  }, [groups])

  // All tasks (current + history)
  const allTasks = useMemo(() => {
    const historyTasks = Array.from(taskHistory.values()).map(entry => entry.task)
    const allTasksMap = new Map<string, UnifiedTask>()

    // Add history first (will be overwritten by current if exists)
    historyTasks.forEach(task => allTasksMap.set(task.id, task))

    // Add/update with current tasks
    currentTasks.forEach(task => allTasksMap.set(task.id, task))

    return Array.from(allTasksMap.values())
  }, [currentTasks, taskHistory])

  // Find task by ID
  const findTask = useCallback((id: string) => {
    return allTasks.find(task => task.id === id)
  }, [allTasks])

  // Clear history
  const clearHistory = useCallback(() => {
    setTaskHistory(new Map())
  }, [])

  return {
    groups,
    badgeState,
    allTasks,
    findTask,
    clearHistory,
  }
}
