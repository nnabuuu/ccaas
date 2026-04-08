import { useState, useRef, useEffect } from 'react'
import type { ChatPanelProps } from '../types'
import { COLOR_MAP } from '../types'
import { MessageBubble } from './MessageBubble'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ToolActivityIndicator } from './ToolActivityIndicator'
import { AgentActivityLine } from './AgentActivityLine'

export function ChatPanel({
  messages,
  isProcessing,
  connected,
  colorScheme = 'blue',
  title = 'AI 助手',
  emptyStateText = '开始对话',
  emptyStateSubtext,
  placeholder,
  activeTools = new Map(),
  isThinking = false,
  thinkingContent = '',
  thinkingStartTime,
  thinkingVerb,
  todoItems = [],
  todoStats = null,
  activeSubAgents = [],
  tokenUsage = null,
  onSendMessage,
  onCancel,
  renderMessage,
  renderQuickActions,
  renderActivityDetails,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const colors = COLOR_MAP[colorScheme]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!inputValue.trim() || isProcessing || !connected) return
    onSendMessage(inputValue.trim())
    setInputValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const defaultPlaceholder = connected ? '输入消息...' : '正在连接服务器...'

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <h2 className="font-semibold text-gray-800">{title}</h2>
        <div className="flex items-center gap-3 text-sm">
          {tokenUsage && (
            <span className="text-xs text-gray-500">
              Tokens: {tokenUsage.inputTokens.toLocaleString()} in / {tokenUsage.outputTokens.toLocaleString()} out
            </span>
          )}
          {isProcessing && (
            <span className={`flex items-center gap-1 ${colors.text}`}>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              思考中...
            </span>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">{emptyStateText}</p>
            {emptyStateSubtext && <p className="mt-1 text-sm">{emptyStateSubtext}</p>}
          </div>
        ) : (
          messages.map((message) =>
            renderMessage ? (
              <div key={message.id}>{renderMessage(message)}</div>
            ) : (
              <MessageBubble key={message.id} message={message} colorScheme={colorScheme} />
            )
          )
        )}
        {/* Activity indicators */}
        <ThinkingIndicator isThinking={isThinking} content={thinkingContent} />
        <ToolActivityIndicator activeTools={activeTools} colorScheme={colorScheme} />
        <div ref={messagesEndRef} />
      </div>

      {/* Activity Status Line */}
      <AgentActivityLine
        isProcessing={isProcessing}
        isThinking={isThinking}
        thinkingContent={thinkingContent}
        thinkingStartTime={thinkingStartTime}
        thinkingVerb={thinkingVerb}
        todoItems={todoItems}
        todoStats={todoStats}
        activeTools={activeTools}
        activeSubAgents={activeSubAgents}
        onCancel={onCancel}
      />

      {/* Optional custom activity details slot */}
      {renderActivityDetails && renderActivityDetails()}

      {/* Quick Actions slot */}
      {renderQuickActions && (
        <div className="px-4 py-2 bg-white border-t border-gray-100">
          {renderQuickActions()}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || defaultPlaceholder}
              disabled={!connected}
              rows={1}
              className={`w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:${colors.ring} focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed`}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing || !connected}
            className={`flex-shrink-0 px-4 rounded-xl ${colors.bg} text-white ${colors.hover} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
