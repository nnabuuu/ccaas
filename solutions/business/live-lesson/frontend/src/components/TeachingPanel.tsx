import React, { useEffect, useRef, useState, useCallback } from 'react'
import { BookOpen, ArrowCounterClockwise, PaperPlaneRight } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import type { Message } from '@kedge-agentic/react-sdk'

const messageContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const messageItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 20 } },
}

interface TeachingPanelProps {
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  currentStreamContent: string
  connected: boolean
  onSendMessage: (content: string) => void
  onClearConversation: () => void
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isAsk = isUser && message.content.startsWith('[ASK]')

  // Format special messages
  let displayContent = message.content
  if (isAsk) {
    const rest = message.content.replace(/^\[ASK\]\s*[^:]+:\s*/, '')
    displayContent = `🙋 关于：${rest}`
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
          <span className="text-primary text-xs font-bold">AI</span>
        </div>
      )}
      <div
        className={[
          'max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed',
          isUser && isAsk
            ? 'bg-blue-900/30 border border-blue-400/30 text-blue-200'
            : isUser
              ? 'bg-white/10 text-gray-200'
              : 'bg-chalkboard border border-white/10 text-gray-100',
        ].join(' ')}
      >
        {displayContent}
      </div>
    </div>
  )
}

function TypingIndicator({ content }: { content: string }) {
  return (
    <div className="flex justify-start mb-3">
      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
        <span className="text-primary text-xs font-bold">AI</span>
      </div>
      <div className="max-w-[85%] px-3 py-2 rounded-xl bg-chalkboard border border-white/10 text-gray-100 text-sm leading-relaxed">
        {content || (
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        )}
      </div>
    </div>
  )
}

export function TeachingPanel({
  messages,
  isProcessing,
  isThinking,
  thinkingContent,
  currentStreamContent,
  connected,
  onSendMessage,
  onClearConversation,
}: TeachingPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [freeText, setFreeText] = useState('')

  const isActive = isProcessing || isThinking

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStreamContent])

  const handleSendFreeText = useCallback(() => {
    const text = freeText.trim()
    if (!text || isActive) return
    onSendMessage(text)
    setFreeText('')
  }, [freeText, isActive, onSendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSendFreeText()
    }
  }, [handleSendFreeText])

  return (
    <div className="flex flex-col h-full bg-background-dark border-l border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BookOpen size={16} weight="regular" className="text-primary" />
          <span className="text-sm font-medium text-gray-200">教学对话</span>
          {connected ? (
            <span className="text-xs text-primary">● 已连接</span>
          ) : (
            <span className="text-xs text-gray-500">○ 连接中...</span>
          )}
        </div>
        <button
          onClick={onClearConversation}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="新建会话"
        >
          <ArrowCounterClockwise size={14} weight="regular" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0">
        {messages.length === 0 && !isActive && (
          <div className="flex items-start pt-6 px-1 h-full text-gray-600 text-sm">
            <div>
              <p>等待教学开始...</p>
              <p className="mt-1 text-xs">AI 教师将引导你探索一元一次方程</p>
              <p className="mt-2 text-xs text-gray-700">点击板书上的节点可以提问</p>
              <p className="mt-2 text-xs text-gray-700">AI 讲完后，点黑板底部「继续」前进</p>
            </div>
          </div>
        )}

        <motion.div variants={messageContainer} initial="hidden" animate="show">
          {messages.map((msg) => (
            <motion.div key={msg.id} variants={messageItem}>
              <MessageBubble message={msg} />
            </motion.div>
          ))}
        </motion.div>

        {/* Thinking indicator — skeleton pulse */}
        {isThinking && !currentStreamContent && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
              <span className="text-primary text-xs font-bold">AI</span>
            </div>
            <div className="px-3 py-2 rounded-xl bg-chalkboard border border-white/10 text-gray-500 text-xs italic space-y-1.5">
              {thinkingContent ? (
                thinkingContent
              ) : (
                <>
                  <div className="h-2.5 w-32 skeleton-shimmer rounded" />
                  <div className="h-2.5 w-20 skeleton-shimmer rounded" />
                </>
              )}
            </div>
          </div>
        )}

        {/* Streaming content */}
        {currentStreamContent && (
          <TypingIndicator content={currentStreamContent} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Free-text input */}
      <div className="border-t border-white/10 px-3 pt-3 pb-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isActive}
            placeholder="输入你的问题... (Enter 发送)"
            rows={2}
            className={[
              'flex-1 resize-none rounded-lg px-3 py-2 text-sm',
              'bg-white/5 border border-white/20 text-gray-200',
              'placeholder:text-gray-600 focus:outline-none focus:border-primary/50',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          />
          <button
            onClick={handleSendFreeText}
            disabled={isActive || !freeText.trim()}
            className={[
              'flex-shrink-0 p-2 rounded-lg',
              'bg-primary/20 border border-primary/40 text-primary',
              'hover:bg-primary/30 transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            ].join(' ')}
            title="发送 (Enter)"
          >
            <PaperPlaneRight size={16} weight="regular" />
          </button>
        </div>
      </div>

      {/* Quick replies */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={() => onSendMessage('再解释一下')}
          disabled={isActive}
          className={[
            'w-full px-3 py-2 rounded-lg text-xs',
            'border border-white/20 bg-white/5',
            'text-gray-300 hover:bg-white/10',
            'transition-colors',
            isActive ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          再解释一下
        </button>
      </div>
    </div>
  )
}

export default TeachingPanel
