import React, { useState } from 'react'
import type { TaskGroups, TodoStats } from '../types'
import { TasksHeader } from './TasksHeader'
import { TasksList } from './TasksList'

export interface TasksViewProps {
  groups: TaskGroups
  todoStats: TodoStats | null
  highlightedTaskId?: string | null
}

/**
 * Main container for the Tasks view.
 * Displays a header with summary stats and a list of grouped tasks.
 *
 * Shows an empty state when there are no tasks.
 */
export function TasksView({ groups, todoStats, highlightedTaskId }: TasksViewProps) {
  const [showCompleted, setShowCompleted] = useState(true)

  // Empty state
  const hasNoTasks =
    groups.active.length === 0 &&
    groups.recentCompleted.length === 0 &&
    groups.recentFailed.length === 0

  if (hasNoTasks) {
    return <EmptyState />
  }

  return (
    <div className="h-full flex flex-col">
      <TasksHeader
        groups={groups}
        todoStats={todoStats}
        showCompleted={showCompleted}
        onToggleCompleted={() => setShowCompleted(!showCompleted)}
      />
      <div className="flex-1 overflow-y-auto p-4">
        <TasksList
          groups={groups}
          showCompleted={showCompleted}
          highlightedTaskId={highlightedTaskId}
        />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <svg
        className="w-24 h-24 mb-4 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <p className="text-lg font-medium text-gray-700">暂无任务</p>
      <p className="mt-2 text-sm text-gray-500 max-w-xs">
        当 AI 开始处理您的请求时，相关任务会在这里显示
      </p>
    </div>
  )
}
