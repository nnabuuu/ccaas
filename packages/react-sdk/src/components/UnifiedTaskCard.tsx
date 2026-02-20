import React, { forwardRef } from 'react'
import type { UnifiedTask } from '../types'
import { SubAgentCard } from './SubAgentCard'
import type { ActiveSubAgent } from '@kedge-agentic/common'

export interface UnifiedTaskCardProps {
  task: UnifiedTask
  isHighlighted?: boolean
}

/**
 * Unified task card that renders different UI based on task type.
 *
 * For SubAgent tasks: uses existing SubAgentCard component
 * For Todo tasks: renders custom card with progress bar
 */
export const UnifiedTaskCard = forwardRef<HTMLDivElement, UnifiedTaskCardProps>(
  ({ task, isHighlighted }, ref) => {
    // For SubAgent type, use existing SubAgentCard
    if (task.type === 'subagent') {
      return (
        <div
          ref={ref}
          className={`transition-all duration-300 ${
            isHighlighted ? 'ring-2 ring-blue-500 bg-blue-50 shadow-lg' : ''
          }`}
        >
          <SubAgentCard subAgent={task.raw as ActiveSubAgent} />
        </div>
      )
    }

    // For Todo type, custom card
    return (
      <div
        ref={ref}
        className={`p-3 border rounded-lg transition-all duration-300 ${
          isHighlighted
            ? 'ring-2 ring-blue-500 bg-blue-50 shadow-lg border-blue-200'
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800 truncate">
              {task.activeForm || task.title}
            </div>
            {task.progress !== undefined && (
              <div className="mt-1.5 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            )}
          </div>
          <StatusBadge status={task.status} />
        </div>
      </div>
    )
  }
)

UnifiedTaskCard.displayName = 'UnifiedTaskCard'

/**
 * Status badge component
 */
function StatusBadge({ status }: { status: UnifiedTask['status'] }) {
  const config = getStatusConfig(status)

  return (
    <span
      className={`
        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
        ${config.bg} ${config.text}
      `}
    >
      {config.icon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </span>
  )
}

function getStatusConfig(status: UnifiedTask['status']) {
  switch (status) {
    case 'running':
    case 'in_progress':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: '⏳',
        label: '运行中',
      }
    case 'completed':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        icon: '✓',
        label: '完成',
      }
    case 'failed':
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: '✗',
        label: '失败',
      }
    case 'pending':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        icon: '⋯',
        label: '等待中',
      }
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        icon: '',
        label: status,
      }
  }
}
