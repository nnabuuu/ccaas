/**
 * Agent Activity Line
 *
 * Simplified status bar showing current agent activity.
 * Features priority-based display, enhanced thinking content visibility, and cancel button.
 * Detailed task information is now shown in the dedicated Tasks tab.
 */

import { useMemo, useState, useEffect } from 'react'
import type { EventTodoItem, ActiveSubAgent } from '@kedge-agentic/common'
import type { TodoStats, ToolActivity } from '../types'
import { formatDuration } from '../utils/formatDuration'
import { getToolActivityDescription } from '../utils/toolActivityMapping'

export interface AgentActivityLineProps {
  isProcessing: boolean
  isThinking?: boolean
  thinkingContent?: string
  thinkingStartTime?: number | null
  thinkingVerb?: string
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
  thinkingStartTime,
  thinkingVerb,
  todoItems,
  todoStats,
  activeTools,
  activeSubAgents = [],
  onCancel,
}: AgentActivityLineProps) {
  const hasActiveSubAgents = activeSubAgents.length > 0

  // 实时更新当前时间（用于计算思考持续时间）
  const [currentTime, setCurrentTime] = useState(Date.now())

  useEffect(() => {
    if (!isThinking || !thinkingStartTime) return

    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)  // 每秒更新

    return () => clearInterval(timer)
  }, [isThinking, thinkingStartTime])

  // 计算思考持续时间
  const thinkingDuration = thinkingStartTime
    ? currentTime - thinkingStartTime
    : 0

  // Helper: Check if tool has parent (nested tool)
  const hasParent = (tool: ToolActivity): boolean => {
    return (tool.nestingLevel ?? 0) > 0
  }

  // Helper: Check if tool is a Task
  const isTaskTool = (tool: ToolActivity): boolean => {
    return tool.toolName === 'Task'
  }

  // Filter: Only keep top-level Task tools (nesting level 0)
  const topLevelTasks = useMemo(() => {
    return Array.from(activeTools.values()).filter(
      (tool) => !hasParent(tool) && isTaskTool(tool) && tool.phase !== 'end'
    )
  }, [activeTools])

  if (!isProcessing && !hasActiveSubAgents) {
    return null
  }

  // Helper function to truncate text
  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // Get status label with priority logic
  const getStatusLabel = (): { primary: string; secondary?: string; isThinking?: boolean } => {
    const activeTodo = todoItems.find((t) => t.status === 'in_progress')
    const firstTask = topLevelTasks[0]
    const firstTool = Array.from(activeTools.values())[0]  // 新增：获取第一个工具

    // Priority 1: Active Todo
    if (activeTodo?.activeForm) {
      return {
        primary: activeTodo.activeForm,
        secondary: todoStats ? `${todoStats.completed}/${todoStats.total}` : undefined,
      }
    }

    // Priority 2: Thinking state（新增动态文案）
    if (isThinking && thinkingStartTime) {
      return {
        primary: `${thinkingVerb}了 ${formatDuration(thinkingDuration)}`,
        isThinking: true,  // 标记为思考状态，用于样式
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

    // Priority 3.5: 工具活动（包括刚结束的，保持显示 2 秒）
    if (firstTool) {
      const shouldShow =
        firstTool.phase !== 'end' ||  // 工具还在执行
        (firstTool.endTime && (Date.now() - firstTool.endTime < 2000))  // 或刚结束 2 秒内

      if (shouldShow) {
        return {
          primary: getToolActivityDescription(firstTool.toolName, firstTool.description),
        }
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

    // Priority 5: Main processing (最后的 fallback)
    if (isProcessing) {
      return { primary: '正在响应...' }  // 改为更友好的文案
    }

    return { primary: '' }
  }

  const { primary: label, secondary: detail, isThinking: labelIsThinking } = getStatusLabel()
  const progress =
    todoStats && todoStats.total > 0 ? `${todoStats.completed}/${todoStats.total}` : null

  return (
    <div className={`border-t ${labelIsThinking ? 'border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50' : 'border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50'}`}>
      <div className="px-4 py-3 space-y-2">
        {/* Status line */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Animated spinner - 改为紫色（思考时） */}
            {isProcessing && (
              <div className="relative flex-shrink-0">
                <svg
                  className={`w-5 h-5 animate-spin ${labelIsThinking ? 'text-purple-600' : 'text-blue-600'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
                  <div className={`w-5 h-5 rounded-full ${labelIsThinking ? 'bg-purple-600' : 'bg-blue-600'}`}></div>
                </div>
              </div>
            )}

            {/* Status label */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`text-sm font-medium truncate ${labelIsThinking ? 'bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent' : 'text-gray-700'}`}>
                  {label}
                </span>

                {/* 动态 dots（只在思考时显示） */}
                {labelIsThinking && (
                  <span className="inline-flex ml-0.5">
                    <span className="animate-pulse text-purple-600" style={{ animationDelay: '0ms', animationDuration: '1.5s' }}>.</span>
                    <span className="animate-pulse text-purple-600" style={{ animationDelay: '500ms', animationDuration: '1.5s' }}>.</span>
                    <span className="animate-pulse text-purple-600" style={{ animationDelay: '1000ms', animationDuration: '1.5s' }}>.</span>
                  </span>
                )}
              </div>
              {detail && <span className="text-xs text-gray-600 truncate mt-0.5">{detail}</span>}
              {progress && !labelIsThinking && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                  {progress}
                </span>
              )}
            </div>
          </div>

          {/* Cancel button */}
          {onCancel && (
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
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
            </div>
          )}
        </div>

        {/* Thinking content preview - 调整为紫色 */}
        {isThinking && thinkingContent && (
          <div className="pl-8 pr-4">
            <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-xs text-purple-900 leading-relaxed whitespace-pre-wrap break-words">
                {thinkingContent.length > 150 && '...'}
                {thinkingContent.slice(-150)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentActivityLine
