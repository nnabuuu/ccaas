/**
 * Chat with Quick Actions Component
 *
 * Features:
 * - Teacher mode: "开始分析" quick action button
 * - Student mode: "检查我的答案" quick action button
 * - Full-height chat panel
 * - Integrated message display
 */

import { RocketLaunchIcon, AcademicCapIcon } from '@heroicons/react/24/solid'
import { ChatPanel, type Message, type TodoItem, type TodoStats } from '@ccaas/react-sdk'
import type { ToolActivity, ActiveSubAgent } from '@ccaas/react-sdk'

interface ChatWithQuickActionsProps {
  // Quick action
  onStartAnalysis: () => void
  canAnalyze: boolean
  viewMode?: 'teacher' | 'student'

  // Chat props
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  onSendMessage: (content: string) => void
  onCancel: () => void
  activeTools: Map<string, ToolActivity>
  activeSubAgents: ActiveSubAgent[]
  todoItems: TodoItem[]
  todoStats: TodoStats | null
}

export default function ChatWithQuickActions({
  onStartAnalysis,
  canAnalyze,
  viewMode = 'teacher',
  messages,
  isProcessing,
  isThinking,
  thinkingContent,
  onSendMessage,
  onCancel,
  activeTools,
  activeSubAgents,
  todoItems,
  todoStats,
}: ChatWithQuickActionsProps) {
  const isStudent = viewMode === 'student'

  return (
    <div className="flex flex-col h-full">
      {/* Primary Quick Action Button */}
      <div className="mb-3 flex-shrink-0">
        <button
          onClick={onStartAnalysis}
          disabled={!canAnalyze || isProcessing}
          className={`w-full text-white py-3 rounded-lg font-medium disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:shadow-none ${
            isStudent
              ? 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-400'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isStudent ? '检查中...' : '分析中...'}
            </>
          ) : isStudent ? (
            <>
              <AcademicCapIcon className="w-5 h-5" />
              ✅ 检查我的答案
            </>
          ) : (
            <>
              <RocketLaunchIcon className="w-5 h-5" />
              🚀 开始分析
            </>
          )}
        </button>

        {/* Help text */}
        {!canAnalyze && !isProcessing && (
          <p className="mt-2 text-xs text-slate-500 text-center">
            {isStudent ? '请先填写题目内容和你的解答' : '请先填写题目内容和参考答案'}
          </p>
        )}
      </div>

      {/* Secondary quick action buttons */}
      {!isProcessing && messages.length > 0 && (
        <div className="mb-3 flex-shrink-0 flex gap-2">
          {isStudent ? (
            <>
              <button
                onClick={() => onSendMessage('给我一个提示，不要直接告诉我答案')}
                className="flex-1 text-xs px-2 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                💡 给我提示
              </button>
              <button
                onClick={() => onSendMessage('我哪里理解错了？')}
                className="flex-1 text-xs px-2 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
              >
                🔍 哪里错了
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onSendMessage('帮我生成几道举一反三的练习题')}
                className="flex-1 text-xs px-2 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
              >
                🔄 举一反三
              </button>
              <button
                onClick={() => onSendMessage('总结学生常见错误类型')}
                className="flex-1 text-xs px-2 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                📋 常见错误
              </button>
            </>
          )}
        </div>
      )}

      {/* Chat Panel */}
      <div className="flex-1 min-h-0">
        <ChatPanel
          messages={messages}
          isProcessing={isProcessing}
          connected={true}
          activeTools={activeTools}
          isThinking={isThinking}
          thinkingContent={thinkingContent}
          todoItems={todoItems}
          todoStats={todoStats}
          activeSubAgents={activeSubAgents}
          onSendMessage={onSendMessage}
          onCancel={onCancel}
          title={isStudent ? '辅导对话' : 'AI 对话'}
          placeholder={isStudent ? '问我任何关于这道题的问题...' : '问我任何关于题目的问题...'}
        />
      </div>

      {/* Status indicator */}
      {isProcessing && (
        <div className="mt-2 flex-shrink-0 text-xs text-slate-500 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full animate-pulse ${isStudent ? 'bg-green-500' : 'bg-blue-500'}`} />
          {isStudent ? 'AI 正在检查你的解答...' : 'AI 正在分析...'}
        </div>
      )}
    </div>
  )
}
