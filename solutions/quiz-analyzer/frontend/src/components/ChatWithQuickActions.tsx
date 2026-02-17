/**
 * Chat with Quick Actions Component
 *
 * Features:
 * - "开始分析" quick action button
 * - Full-height chat panel
 * - Integrated message display
 */

import { RocketLaunchIcon } from '@heroicons/react/24/solid'
import { ChatPanel, type Message, type TodoItem, type TodoStats } from '@ccaas/react-sdk'
import type { ToolActivity, ActiveSubAgent } from '@ccaas/react-sdk'

interface ChatWithQuickActionsProps {
  // Quick action
  onStartAnalysis: () => void
  canAnalyze: boolean

  // Chat props
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  onSendMessage: (content: string) => void
  activeTools: Map<string, ToolActivity>
  activeSubAgents: ActiveSubAgent[]
  todoItems: TodoItem[]
  todoStats: TodoStats | null
}

export default function ChatWithQuickActions({
  onStartAnalysis,
  canAnalyze,
  messages,
  isProcessing,
  isThinking,
  thinkingContent,
  onSendMessage,
  activeTools,
  activeSubAgents,
  todoItems,
  todoStats,
}: ChatWithQuickActionsProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Quick Action Button */}
      <div className="mb-4 flex-shrink-0">
        <button
          onClick={onStartAnalysis}
          disabled={!canAnalyze || isProcessing}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:shadow-none"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              分析中...
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
            请先填写题目内容和参考答案
          </p>
        )}
      </div>

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
          onCancel={() => {}}
          title="AI 对话"
          placeholder="问我任何关于题目的问题..."
        />
      </div>

      {/* Status indicator */}
      {isProcessing && (
        <div className="mt-2 flex-shrink-0 text-xs text-slate-500 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          AI 正在分析...
        </div>
      )}
    </div>
  )
}
