import React, { useEffect, useRef, useState, useCallback } from 'react'
import { BookOpen, ArrowCounterClockwise, PaperPlaneRight, ArrowRight } from '@phosphor-icons/react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import type { Message } from '@kedge-agentic/react-sdk'
import type { TimelineItem } from '../types/blackboard-actions'
import type { Beat } from '../types'

function MagneticButton({ children, className, ...props }: React.ComponentPropsWithoutRef<typeof motion.button>) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const moveX = useTransform(x, [-50, 50], [-8, 8])
  const moveY = useTransform(y, [-50, 50], [-4, 4])

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    x.set(e.clientX - rect.left - rect.width / 2)
    y.set(e.clientY - rect.top - rect.height / 2)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.button
      style={{ x: moveX, y: moveY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: 0.97 }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  )
}

interface InteractionPanelProps {
  timeline: TimelineItem[]
  currentBeat: Beat | null
  isActive: boolean
  connected: boolean
  messages: Message[]
  isThinking: boolean
  thinkingContent: string
  currentStreamContent: string
  onSendMessage: (content: string) => void
  onClearConversation: () => void
  canContinue: boolean
  onContinue: () => void
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  const isRight = item.type === 'user_input' || item.type === 'student_ack'

  const bgClass = {
    narrator: 'bg-teal-900/25 border-teal-400/15 text-teal-100',
    student_ack: 'bg-white/[0.04] border-white/8 text-gray-500 italic',
    ai_response: 'bg-chalkboard border-white/8 text-gray-100',
    user_input: 'bg-blue-900/15 border-blue-400/15 text-blue-200',
  }[item.type]

  const label = {
    narrator: '师',
    student_ack: '本',
    ai_response: 'AI',
    user_input: '我',
  }[item.type]

  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'} mb-2`}>
      {!isRight && (
        <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center mr-1.5 flex-shrink-0 mt-0.5">
          <span className="text-[8px] font-bold text-primary">{label}</span>
        </div>
      )}
      <div className={`max-w-[88%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed border ${bgClass}`}>
        {item.content}
      </div>
      {isRight && (
        <div className="w-5 h-5 rounded-full bg-white/8 border border-white/15 flex items-center justify-center ml-1.5 flex-shrink-0 mt-0.5">
          <span className="text-[8px] font-bold text-gray-500">{label}</span>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const isAsk = isUser && message.content.startsWith('[ASK]')
  // Strip [ASK] prefix — no emoji replacement
  const displayContent = isAsk
    ? message.content.replace(/^\[ASK\]\s*[^:]+:\s*/, '')
    : message.content

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-2`}>
      {!isUser && (
        <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mr-1.5 flex-shrink-0 mt-0.5">
          <span className="text-[8px] font-bold text-primary">AI</span>
        </div>
      )}
      <div
        className={[
          'max-w-[88%] px-2.5 py-1.5 rounded-xl text-xs leading-relaxed',
          isUser && isAsk
            ? 'bg-blue-900/20 border border-blue-400/20 text-blue-200'
            : isUser
              ? 'bg-white/8 border border-white/10 text-gray-200'
              : 'bg-chalkboard border border-white/8 text-gray-100',
        ].join(' ')}
      >
        {displayContent}
      </div>
    </div>
  )
}

// CSS dots thinking indicator — no Loader2 spinner
function ThinkingDots() {
  return (
    <div className="flex items-center gap-0.5 py-0.5">
      <span className="w-1 h-1 rounded-full bg-primary/60 thinking-dot" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 rounded-full bg-primary/60 thinking-dot" style={{ animationDelay: '200ms' }} />
      <span className="w-1 h-1 rounded-full bg-primary/60 thinking-dot" style={{ animationDelay: '400ms' }} />
    </div>
  )
}

export function InteractionPanel({
  timeline,
  currentBeat,
  isActive,
  connected,
  messages,
  isThinking,
  thinkingContent,
  currentStreamContent,
  onSendMessage,
  onClearConversation,
  canContinue,
  onContinue,
}: InteractionPanelProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const [freeText, setFreeText] = useState('')

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [timeline, messages, currentStreamContent])

  const handleSend = useCallback(() => {
    const text = freeText.trim()
    if (!text || isActive) return
    onSendMessage(text)
    setFreeText('')
  }, [freeText, isActive, onSendMessage])

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const expectedQuestions = currentBeat?.expectedQuestions ?? []

  return (
    <div className="flex flex-col h-full bg-background-dark border-l border-white/8">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <BookOpen size={13} weight="regular" className="text-primary/70" />
          <span className="text-xs font-medium text-gray-400">教学互动</span>
          <span
            className={[
              'text-[9px] transition-colors duration-300',
              connected ? 'text-primary/60' : 'text-gray-600',
            ].join(' ')}
          >
            {connected ? '● 已连接' : '○ 连接中'}
          </span>
        </div>
        <button
          onClick={onClearConversation}
          className="text-gray-700 hover:text-gray-400 transition-colors duration-[200ms]"
          title="清空对话"
        >
          <ArrowCounterClockwise size={11} weight="regular" />
        </button>
      </div>

      {/* Timeline + Messages */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {/* Empty state: shown before lesson starts */}
        {timeline.length === 0 && messages.length === 0 && !isThinking && !currentStreamContent && (
          <div className="flex h-full items-center justify-center pointer-events-none">
            <p className="text-xs text-gray-700 text-center leading-relaxed px-4">
              点击"开始课程"<br />开启 AI 互动教学
            </p>
          </div>
        )}

        {timeline.map(item => (
          <TimelineEntry key={item.id} item={item} />
        ))}

        {timeline.length > 0 && messages.length > 0 && (
          <div className="my-2 border-t border-white/[0.04]" />
        )}

        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Thinking indicator — CSS dots, no spinner */}
        {isThinking && !currentStreamContent && (
          <div className="flex justify-start mb-2">
            <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center mr-1.5 flex-shrink-0 mt-0.5">
              <ThinkingDots />
            </div>
            {thinkingContent && (
              <div className="max-w-[80%] px-2.5 py-1.5 rounded-xl bg-chalkboard border border-white/8 text-gray-600 text-[10px] italic leading-relaxed">
                {thinkingContent}
              </div>
            )}
          </div>
        )}

        {/* Streaming content */}
        {currentStreamContent && (
          <div className="flex justify-start mb-2">
            <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mr-1.5 flex-shrink-0 mt-0.5">
              <span className="text-[8px] font-bold text-primary">AI</span>
            </div>
            <div className="max-w-[88%] px-2.5 py-1.5 rounded-xl bg-chalkboard border border-white/8 text-gray-100 text-xs leading-relaxed">
              {currentStreamContent}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Expected questions */}
      {expectedQuestions.length > 0 && (
        <div className="px-2.5 py-2 border-t border-white/[0.05] space-y-1.5 flex-shrink-0">
          <div className="text-[10px] text-gray-500 mb-1.5">💬 点击提问</div>
          {expectedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => !isActive && onSendMessage(q)}
              disabled={isActive}
              className={[
                'w-full text-left px-2.5 py-2 rounded-lg text-xs border',
                'border-teal-500/30 text-teal-300 bg-teal-900/15',
                'hover:bg-teal-900/30 hover:border-teal-400/50',
                'transition-all duration-[250ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                isActive ? 'opacity-25 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Free text input */}
      <div className="border-t border-white/8 px-2.5 pt-2.5 pb-2.5 flex-shrink-0">
        {canContinue && !isActive && (
          <div className="mb-2">
            <button
              onClick={onContinue}
              className={[
                'w-full py-2 rounded-xl text-sm font-semibold',
                'bg-primary/15 border border-primary/35 text-primary',
                'hover:bg-primary/25 hover:border-primary/50',
                'transition-all duration-[200ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
                'flex items-center justify-center gap-1.5',
              ].join(' ')}
            >
              继续下一步 <ArrowRight size={13} weight="bold" />
            </button>
          </div>
        )}
        <div className="flex gap-1.5 items-end">
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value)}
            onKeyDown={handleKey}
            disabled={isActive}
            placeholder="输入问题... (Enter 发送)"
            rows={2}
            className={[
              'flex-1 resize-none rounded-xl px-3 py-2 text-xs',
              'bg-white/[0.04] border border-white/10 text-gray-200',
              'placeholder:text-gray-700 focus:outline-none focus:border-primary/30',
              'transition-colors duration-[200ms]',
              'disabled:opacity-30 disabled:cursor-not-allowed',
            ].join(' ')}
          />
          <MagneticButton
            onClick={handleSend}
            disabled={isActive || !freeText.trim()}
            className={[
              'flex-shrink-0 p-2 rounded-xl',
              'bg-primary/10 border border-primary/25 text-primary/80',
              'hover:bg-primary/20 hover:text-primary',
              'disabled:opacity-25 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            <PaperPlaneRight size={13} weight="regular" />
          </MagneticButton>
        </div>
      </div>
    </div>
  )
}

export default InteractionPanel
