/**
 * Task Tracking Types
 *
 * Unified task, task groups, and badge state types.
 * Mirrors react-sdk/src/types.ts task tracking section.
 */

import type { Ref, ComputedRef } from 'vue'
import type { ActiveSubAgent, EventTodoItem } from '@kedge-agentic/common'

export interface TodoStats {
  completed: number
  inProgress: number
  pending: number
  total: number
}

export interface UnifiedTask {
  id: string
  type: 'subagent' | 'todo'
  status: 'running' | 'completed' | 'failed' | 'pending' | 'in_progress'
  title: string
  description?: string
  startedAt?: Date
  completedAt?: Date
  duration?: number
  agentType?: string
  progress?: number
  activeForm?: string
  nestingLevel?: number
  raw: ActiveSubAgent | EventTodoItem
}

export interface TaskGroups {
  active: UnifiedTask[]
  recentCompleted: UnifiedTask[]
  recentFailed: UnifiedTask[]
}

export interface TaskBadgeState {
  show: boolean
  color: 'green' | 'red' | 'amber' | 'blue'
  count?: number
  label: string
}

export interface UseTaskTrackingOptions {
  activeSubAgents: Ref<ActiveSubAgent[]> | ActiveSubAgent[]
  todoItems: Ref<EventTodoItem[]> | EventTodoItem[]
  maxHistorySize?: number
}

export interface UseTaskTrackingReturn {
  groups: ComputedRef<TaskGroups>
  badgeState: ComputedRef<TaskBadgeState>
  allTasks: ComputedRef<UnifiedTask[]>
  findTask: (id: string) => UnifiedTask | undefined
  clearHistory: () => void
}
