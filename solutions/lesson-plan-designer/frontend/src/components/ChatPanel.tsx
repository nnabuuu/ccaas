import { useState, useRef, useEffect } from 'react'
import type { Message, SyncField, ToolActivityEvent } from '../types'
import MessageBubble from './MessageBubble'
import QuickPrompts from './QuickPrompts'
import ToolActivityIndicator from './ToolActivityIndicator'
import ThinkingIndicator from './ThinkingIndicator'

interface ChatPanelProps {
  messages: Message[]
  isProcessing: boolean
  connected: boolean
  activeTools?: Map<string, ToolActivityEvent>
  isThinking?: boolean
  thinkingContent?: string
  onSendMessage: (content: string) => void
  onSync: (field: SyncField) => void
  onDiscard: (field: SyncField) => void
}

export function ChatPanel({
  messages,
  isProcessing,
  connected,
  activeTools = new Map(),
  isThinking = false,
  thinkingContent = '',
  onSendMessage,
  onSync,
  onDiscard,
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    if (isProcessing || !connected) return
    onSendMessage(prompt)
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <h2 className="font-semibold text-gray-800">AI 备课助手</h2>
        <div className="flex items-center gap-2 text-sm">
          {isProcessing && (
            <span className="flex items-center gap-1 text-primary-600">
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
            <p className="text-lg font-medium">开始备课对话</p>
            <p className="mt-1 text-sm">向AI助手描述您的备课需求</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onSync={onSync}
              onDiscard={onDiscard}
            />
          ))
        )}
        {/* Activity indicators */}
        <ThinkingIndicator isThinking={isThinking} content={thinkingContent} />
        <ToolActivityIndicator activeTools={activeTools} />
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts */}
      <div className="px-4 py-2 bg-white border-t border-gray-100">
        <QuickPrompts onSelect={handleQuickPrompt} disabled={isProcessing || !connected} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected ? '输入您的备课需求...' : '正在连接服务器...'}
              disabled={!connected}
              rows={1}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing || !connected}
            className="flex-shrink-0 btn-primary px-4 rounded-xl"
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

export default ChatPanel
