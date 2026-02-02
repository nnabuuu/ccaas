import type { ToolActivity, TodoStats } from '../types'
import type { EventTodoItem } from '@ccaas/shared'

export interface AgentActivityLineProps {
  isProcessing: boolean
  todoItems: EventTodoItem[]
  todoStats: TodoStats | null
  activeTools: Map<string, ToolActivity>
  onCancel?: () => void
}

export function AgentActivityLine({ isProcessing, todoItems, todoStats, activeTools, onCancel }: AgentActivityLineProps) {
  if (!isProcessing) return null

  const activeTodo = todoItems.find(t => t.status === 'in_progress')
  const firstTool = activeTools.values().next().value

  let label = ''
  if (activeTodo?.activeForm) {
    label = activeTodo.activeForm
  } else if (firstTool?.description) {
    const prefix = firstTool.nestingLevel && firstTool.nestingLevel >= 1 && firstTool.agentType
      ? `[${firstTool.agentType}] `
      : ''
    label = prefix + firstTool.description
  } else {
    label = '处理中...'
  }

  const progress = todoStats && todoStats.total > 0
    ? `[${todoStats.completed}/${todoStats.total}]`
    : null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-xs text-gray-600 border-t border-gray-200">
      <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span className="truncate flex-1">{label}</span>
      {progress && <span className="text-gray-400 flex-shrink-0">{progress}</span>}
      {onCancel && (
        <button
          onClick={onCancel}
          className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-red-500 transition-colors"
          title="Stop processing"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      )}
    </div>
  )
}
