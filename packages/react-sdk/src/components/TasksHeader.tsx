import React from 'react'
import type { TaskGroups, TodoStats } from '../types'

export interface TasksHeaderProps {
  groups: TaskGroups
  todoStats: TodoStats | null
  showCompleted: boolean
  onToggleCompleted: () => void
}

/**
 * Header section for TasksView showing summary information.
 *
 * Displays:
 * - Active task count with pulse indicator
 * - Todo progress bar (if todos exist)
 * - Current running task preview
 * - Toggle button to show/hide completed tasks
 */
export function TasksHeader({ groups, todoStats, showCompleted, onToggleCompleted }: TasksHeaderProps) {
  const hasActiveTasks = groups.active.length > 0
  const hasTodos = todoStats && todoStats.total > 0
  const currentTask = groups.active[0]

  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
      {/* Header row: Active tasks indicator + Toggle button */}
      <div className="flex items-center justify-between mb-3">
        {/* Left side: Active tasks indicator */}
        <div className="flex items-center gap-2">
          {hasActiveTasks && (
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
          <span className="text-sm font-medium text-gray-700">
            {hasActiveTasks
              ? `${groups.active.length} 个任务运行中`
              : '暂无活跃任务'}
          </span>
        </div>

        {/* Right side: Toggle button */}
        <button
          onClick={onToggleCompleted}
          className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-700 rounded hover:bg-white/50 transition-colors"
          title={showCompleted ? "隐藏已完成任务" : "显示已完成任务"}
        >
          {showCompleted ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          )}
          <span className="text-xs hidden sm:inline">
            {showCompleted ? '隐藏已完成' : '显示已完成'}
          </span>
        </button>
      </div>

      {/* Todo progress bar */}
      {hasTodos && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-600">
            <span>任务进度</span>
            <span>
              {todoStats.completed} / {todoStats.total}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${(todoStats.completed / todoStats.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Current running task preview */}
      {currentTask && (
        <div className="mt-3 p-2 bg-white rounded-lg border border-blue-200">
          <div className="text-xs text-gray-500 mb-1">当前执行</div>
          <div className="text-sm font-medium text-gray-800 truncate">
            {currentTask.title}
          </div>
        </div>
      )}
    </div>
  )
}
