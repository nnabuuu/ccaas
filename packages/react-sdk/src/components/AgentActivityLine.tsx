/**
 * Agent Activity Line
 *
 * Modern status bar showing current agent activity with collapsible details.
 * Features smooth animations, priority-based display, and polished UI.
 */

import { useState, useMemo } from 'react'
import type { EventTodoItem, ActiveSubAgent } from '@ccaas/common'
import type { TodoStats, ToolActivity } from '../types'
import { SubAgentCard } from './SubAgentCard'

export interface AgentActivityLineProps {
  isProcessing: boolean
  isThinking?: boolean
  thinkingContent?: string
  todoItems: EventTodoItem[]
  todoStats: TodoStats | null
  activeTools: Map<string, ToolActivity>
  activeSubAgents?: ActiveSubAgent[]
  onCancel?: () => void
}

export function AgentActivityLine({
  isProcessing,
  isThinking = false,
  thinkingContent = '',
  todoItems,
  todoStats,
  activeTools,
  activeSubAgents = [],
  onCancel,
}: AgentActivityLineProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

  const hasActiveSubAgents = activeSubAgents.length > 0

  // Helper: Check if tool has parent (nested tool)
  const hasParent = (tool: ToolActivity): boolean => {
    return (tool.nestingLevel ?? 0) > 0
  }

  // Helper: Check if tool is a Task
  const isTaskTool = (tool: ToolActivity): boolean => {
    return tool.toolName === 'Task'
  }

  // Build child tools map: Map<parentToolId, childTools[]>
  const childToolsMap = useMemo(() => {
    const map = new Map<string, ToolActivity[]>()

    for (const tool of activeTools.values()) {
      if (hasParent(tool)) {
        // Try to find parent by nesting level
        const parentLevel = (tool.nestingLevel ?? 0) - 1
        const parent = Array.from(activeTools.values()).find(
          (t) => (t.nestingLevel ?? 0) === parentLevel && t.phase !== 'end'
        )
        if (parent) {
          const children = map.get(parent.toolId) || []
          children.push(tool)
          map.set(parent.toolId, children)
        }
      }
    }

    return map
  }, [activeTools])

  // Filter: Only keep top-level Task tools (nesting level 0)
  const topLevelTasks = useMemo(() => {
    return Array.from(activeTools.values()).filter(
      (tool) => !hasParent(tool) && isTaskTool(tool) && tool.phase !== 'end'
    )
  }, [activeTools])

  const hasDetails =
    hasActiveSubAgents ||
    topLevelTasks.length > 0 ||
    (isThinking && thinkingContent) ||
    todoItems.length > 0

  if (!isProcessing && !hasActiveSubAgents) {
    return null
  }

  const toggleTaskExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const updated = new Set(prev)
      if (updated.has(taskId)) {
        updated.delete(taskId)
      } else {
        updated.add(taskId)
      }
      return updated
    })
  }

  // Helper function to truncate text
  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // Get status label with priority logic
  const getStatusLabel = (): { primary: string; secondary?: string } => {
    const activeTodo = todoItems.find((t) => t.status === 'in_progress')
    const firstTask = topLevelTasks[0]

    // Priority 1: Active Todo
    if (activeTodo?.activeForm) {
      return {
        primary: activeTodo.activeForm,
        secondary: todoStats ? `${todoStats.completed}/${todoStats.total}` : undefined,
      }
    }

    // Priority 2: Thinking state
    if (isThinking && thinkingContent) {
      return {
        primary: '正在思考...',
        secondary: truncate(thinkingContent, 50),
      }
    }

    // Priority 3: Task execution
    if (firstTask) {
      return {
        primary: firstTask.description || firstTask.toolName,
        secondary:
          firstTask.agentType && firstTask.agentType !== 'main'
            ? `[${firstTask.agentType}]`
            : undefined,
      }
    }

    // Priority 4: SubAgent background tasks
    if (hasActiveSubAgents) {
      const count = activeSubAgents.length
      const descriptions = activeSubAgents.map((a) => a.description || a.agentType).join(', ')
      return {
        primary: `${count}个后台任务运行中`,
        secondary: truncate(descriptions, 60),
      }
    }

    // Priority 5: Main processing
    if (isProcessing) {
      return { primary: '处理中...' }
    }

    return { primary: '' }
  }

  const { primary: label, secondary: detail } = getStatusLabel()
  const progress =
    todoStats && todoStats.total > 0 ? `${todoStats.completed}/${todoStats.total}` : null

  return (
    <div className="border-t border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      {/* Collapsed view */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Animated spinner */}
          {isProcessing && (
            <div className="relative flex-shrink-0">
              <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <div className="absolute inset-0 animate-ping opacity-20">
                <div className="w-5 h-5 rounded-full bg-blue-600"></div>
              </div>
            </div>
          )}

          {/* Status content */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-900">{label}</span>
              {progress && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {progress}
                </span>
              )}
            </div>
            {detail && <span className="text-xs text-gray-600 truncate mt-0.5">{detail}</span>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
              aria-label={isExpanded ? '收起详情' : '展开详情'}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
              <span>{isExpanded ? '收起' : '详情'}</span>
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 hover:text-red-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500"
              aria-label="取消处理"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span>取消</span>
            </button>
          )}
        </div>
      </div>

      {/* Expanded view with smooth animation */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pb-4 pt-2 space-y-4 bg-white border-t border-gray-200">
          {/* SubAgent tasks list */}
          {hasActiveSubAgents && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 bg-blue-600 rounded-full"></div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  后台任务
                </h4>
                <span className="text-xs text-gray-500">({activeSubAgents.length})</span>
              </div>
              <div className="space-y-2 pl-3">
                {activeSubAgents.map((agent) => (
                  <SubAgentCard key={agent.subAgentId} subAgent={agent} />
                ))}
              </div>
            </div>
          )}

          {/* Task tools with nested children */}
          {topLevelTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 bg-blue-600 rounded-full"></div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  任务工具
                </h4>
                <span className="text-xs text-gray-500">({topLevelTasks.length})</span>
              </div>
              <div className="space-y-2 pl-3">
                {topLevelTasks.map((task) => {
                  const isExpanded = expandedTasks.has(task.toolId)
                  const childTools = childToolsMap.get(task.toolId) || []

                  return (
                    <div
                      key={task.toolId}
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Task header */}
                      <div
                        className="flex items-center gap-2.5 p-2.5 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                        onClick={() => childTools.length > 0 && toggleTaskExpand(task.toolId)}
                      >
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {task.description || task.toolName}
                          </div>
                          {task.agentType && task.agentType !== 'main' && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Agent: {task.agentType}
                            </div>
                          )}
                        </div>

                        {/* Expand/collapse button */}
                        {childTools.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleTaskExpand(task.toolId)
                            }}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            aria-label={isExpanded ? '收起工具' : '展开工具'}
                          >
                            <svg
                              className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Child tools (collapsed by default) */}
                      {isExpanded && childTools.length > 0 && (
                        <div className="border-t border-gray-200 bg-gray-50 p-3">
                          <div className="text-xs font-medium text-gray-600 mb-2">
                            内部工具调用 ({childTools.length})
                          </div>
                          <div className="space-y-1.5">
                            {childTools.map((child) => (
                              <div
                                key={child.toolId}
                                className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200"
                              >
                                <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-medium text-gray-700">
                                    {child.toolName}
                                  </div>
                                  {child.description && (
                                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                                      {child.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Thinking content */}
          {isThinking && thinkingContent && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 bg-purple-600 rounded-full"></div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  思考内容
                </h4>
              </div>
              <div className="pl-3">
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {thinkingContent.slice(-200)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Todo list */}
          {todoItems && todoItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-4 w-1 bg-green-600 rounded-full"></div>
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  任务进度
                </h4>
                {todoStats && (
                  <span className="text-xs text-gray-500">
                    ({todoStats.completed}/{todoStats.total})
                  </span>
                )}
              </div>
              <div className="space-y-1.5 pl-3">
                {todoItems.slice(0, 5).map((item) => {
                  const icons = {
                    completed: (
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ),
                    in_progress: (
                      <svg
                        className="w-4 h-4 text-blue-600 animate-spin"
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
                    ),
                    pending: (
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    ),
                    failed: (
                      <svg
                        className="w-4 h-4 text-red-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ),
                  }

                  return (
                    <div
                      key={item.id || item.content}
                      className="flex items-center gap-2.5 p-2 rounded-md hover:bg-gray-50 transition-colors duration-150"
                    >
                      <div className="flex-shrink-0">
                        {icons[item.status as keyof typeof icons]}
                      </div>
                      <span
                        className={`text-sm ${
                          item.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'
                        }`}
                      >
                        {item.content}
                      </span>
                    </div>
                  )
                })}
                {todoItems.length > 5 && (
                  <div className="text-xs text-gray-500 pl-6 pt-1">
                    ...还有 {todoItems.length - 5} 个任务
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AgentActivityLine
