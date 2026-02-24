import React, { useEffect, useRef, useState, useCallback } from 'react'
import { BookOpen, RotateCcw, Loader2, Send } from 'lucide-react'
import type { Message } from '@kedge-agentic/react-sdk'
import type { BoardState } from '../types'

interface TeachingPanelProps {
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  currentStreamContent: string
  boardState: BoardState | null
  connected: boolean
  onSendMessage: (content: string) => void
  onProbeSelected: (probeId: string) => void
  onConfused: (nodeId: string) => void
  onClearConversation: () => void
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isConfused = isUser && message.content.startsWith('[CONFUSED]')
  const isProbeSelected = isUser && message.content.startsWith('[PROBE_SELECTED]')

  // Format special messages
  let displayContent = message.content
  if (isConfused) {
    const nodeId = message.content.replace('[CONFUSED] ', '')
    displayContent = `🙋 不明白：${nodeId.replace(/-/g, ' ')}`
  } else if (isProbeSelected) {
    const probeId = message.content.replace('[PROBE_SELECTED] ', '')
    displayContent = `✋ 选择：${probeId.replace(/probe-/, '').replace(/-/g, ' ')}`
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
          isUser && isConfused
            ? 'bg-warning-red/20 border border-warning-red/40 text-red-200'
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
  boardState,
  connected,
  onSendMessage,
  onProbeSelected,
  onConfused: _onConfused,
  onClearConversation,
}: TeachingPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [freeText, setFreeText] = useState('')

  const activeProbes = boardState?.activeProbes ?? []
  const hasProbes = activeProbes.length > 0
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendFreeText()
    }
  }, [handleSendFreeText])

  return (
    <div className="flex flex-col h-full bg-background-dark border-l border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-primary" />
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
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0">
        {messages.length === 0 && !isActive && (
          <div className="flex items-center justify-center h-full text-gray-600 text-sm text-center">
            <div>
              <p>等待教学开始...</p>
              <p className="mt-1 text-xs">AI 教师将引导你探索一元一次方程</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Thinking indicator */}
        {isThinking && !currentStreamContent && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
              <Loader2 size={12} className="text-primary animate-spin" />
            </div>
            <div className="px-3 py-2 rounded-xl bg-chalkboard border border-white/10 text-gray-500 text-xs italic">
              {thinkingContent || '思考中...'}
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
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Suggested Responses / Diagnostic Probes */}
      <div className="border-t border-white/10 p-3 space-y-2">
        {hasProbes ? (
          <>
            <p className="text-xs text-gray-500 mb-2">
              请选择你的困惑点，帮助老师精准解答：
            </p>
            <div className="grid grid-cols-1 gap-2">
              {activeProbes.map((probe) => (
                <button
                  key={probe.id}
                  onClick={() => onProbeSelected(probe.id)}
                  disabled={isActive}
                  className={[
                    'w-full text-left px-3 py-2 rounded-lg text-sm',
                    'border border-warning-red/40 bg-warning-red/10',
                    'text-red-200 hover:bg-warning-red/20',
                    'transition-colors',
                    isActive ? 'opacity-50 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {probe.label}
                </button>
              ))}
              <button
                onClick={() => onSendMessage('明白了，继续吧')}
                disabled={isActive}
                className={[
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'border border-primary/40 bg-primary/10',
                  'text-primary hover:bg-primary/20',
                  'transition-colors',
                  isActive ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                其实我明白了，继续 →
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSendMessage('明白了，继续')}
              disabled={isActive}
              className={[
                'col-span-2 px-3 py-2 rounded-lg text-sm font-medium',
                'border border-primary/50 bg-primary/10',
                'text-primary hover:bg-primary/20',
                'transition-colors',
                isActive ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {isActive ? (
                <span className="flex items-center justify-center gap-1">
                  <Loader2 size={12} className="animate-spin" /> 处理中...
                </span>
              ) : (
                '明白了，继续 →'
              )}
            </button>
            <button
              onClick={() => onSendMessage('我需要更多提示')}
              disabled={isActive}
              className={[
                'px-3 py-2 rounded-lg text-xs',
                'border border-white/20 bg-white/5',
                'text-gray-300 hover:bg-white/10',
                'transition-colors',
                isActive ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              再给个提示
            </button>
            <button
              onClick={() => onSendMessage('我不明白这道题')}
              disabled={isActive}
              className={[
                'px-3 py-2 rounded-lg text-xs',
                'border border-warning-red/30 bg-warning-red/5',
                'text-red-300 hover:bg-warning-red/10',
                'transition-colors',
                isActive ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              🙋 有地方不明白
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TeachingPanel
