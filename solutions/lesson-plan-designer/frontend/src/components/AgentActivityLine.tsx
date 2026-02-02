/**
 * Agent Activity Line
 *
 * Shows a single-line status bar with the current agent activity.
 * Priority: todo activeForm > tool description > "处理中..."
 * Can be expanded to show active subagent details.
 * Hidden when agent is idle.
 */

import { useState } from 'react'
import type { TodoItem, TodoStats, ToolActivityEvent, ActiveSubAgent } from '../types'
import { SubAgentCard } from './SubAgentCard'

interface AgentActivityLineProps {
  isProcessing: boolean
  todoItems: TodoItem[]
  todoStats: TodoStats | null
  activeTools: Map<string, ToolActivityEvent>
  activeSubAgents: ActiveSubAgent[]
  onCancel?: () => void
}

export function AgentActivityLine({
  isProcessing,
  todoItems,
  todoStats,
  activeTools,
  activeSubAgents,
  onCancel,
}: AgentActivityLineProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasActiveSubAgents = activeSubAgents.length > 0

  if (!isProcessing && !hasActiveSubAgents) {
    return null
  }

  const activeTodo = todoItems.find((t) => t.status === 'in_progress')
  const firstTool = activeTools.values().next().value

  let label = ''
  if (activeTodo?.activeForm) {
    label = activeTodo.activeForm
  } else if (firstTool?.description) {
    const prefix =
      firstTool.nestingLevel && firstTool.nestingLevel >= 1 && firstTool.agentType
        ? `[${firstTool.agentType}] `
        : ''
    label = prefix + firstTool.description
  } else if (hasActiveSubAgents) {
    label = `后台运行中 (${activeSubAgents.length}个任务)`
  } else {
    label = '处理中...'
  }

  const progress =
    todoStats && todoStats.total > 0 ? `[${todoStats.completed}/${todoStats.total}]` : null

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      {/* Collapsed view */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isProcessing && (
            <svg
              className="w-4 h-4 animate-spin text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          <span className="text-sm text-gray-700">{label}</span>
          {progress && <span className="text-xs text-gray-500">{progress}</span>}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveSubAgents && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? '▲收起' : '▼展开'}
            </button>
          )}
          {onCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCancel()
              }}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              ×取消
            </button>
          )}
        </div>
      </div>

      {/* Expanded view */}
      {isExpanded && hasActiveSubAgents && (
        <div className="border-t border-gray-200 bg-white">
          {activeSubAgents.map((agent) => (
            <SubAgentCard key={agent.subAgentId} {...agent} />
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentActivityLine
