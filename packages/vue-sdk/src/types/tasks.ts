/**
 * Task Tracking Types
 *
 * Unified task, task groups, and badge state types.
 * Mirrors react-sdk/src/types.ts task tracking section.
 */

import type { Ref, ComputedRef } from 'vue'
import type { ActiveSubAgent, EventTodoItem } from '@kedge-agentic/common'

export interface JobInfo {
  id: string
  sessionId?: string
  messageId?: string
  type: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt?: string
  completedAt?: string
  progress?: { step: string; percent: number }
  metadata?: Record<string, unknown>
  resultFiles?: { name: string; path: string; size: number; mimeType: string }[]
  errorMessage?: string
}

export interface TodoStats {
  completed: number
  inProgress: number
  pending: number
  total: number
}

export interface UnifiedTask {
  id: string
  type: 'subagent' | 'todo' | 'job'
  status: 'running' | 'completed' | 'failed' | 'pending' | 'in_progress' | 'cancelled'
  title: string
  description?: string
  startedAt?: Date
  completedAt?: Date
  duration?: number
  agentType?: string
  progress?: number
  activeForm?: string
  nestingLevel?: number
  jobId?: string
  jobType?: string
  resultFiles?: { name: string; path: string; size: number; mimeType: string }[]
  messageId?: string
  raw: ActiveSubAgent | EventTodoItem | JobInfo
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
  jobs?: Ref<JobInfo[]> | JobInfo[]
  maxHistorySize?: number
}

export interface UseTaskTrackingReturn {
  groups: ComputedRef<TaskGroups>
  badgeState: ComputedRef<TaskBadgeState>
  allTasks: ComputedRef<UnifiedTask[]>
  findTask: (id: string) => UnifiedTask | undefined
  clearHistory: () => void
}
