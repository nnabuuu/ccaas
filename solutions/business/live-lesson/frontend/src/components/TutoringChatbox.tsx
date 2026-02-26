import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react'
import { PaperPlaneRight } from '@phosphor-icons/react'
import type { Message } from '@kedge-agentic/react-sdk'
import type { Beat } from '../types'
import type { TutoringMode, SelectionMode } from '../hooks/useLiveLesson'

interface TutoringChatboxProps {
  tutoringMode: TutoringMode
  currentBeat: Beat | null
  suggestedQuestions: string[]
  selectionMode: SelectionMode
  messages: Message[]
  isProcessing: boolean
  isThinking: boolean
  thinkingContent: string
  currentStreamContent: string
  connected: boolean
  onRaiseHand: () => void
  onDismissTutoring: () => void
  onSendExplainRequest: (question: string) => void
  onSendFollowUp: (text: string) => void
  onRequestMoreQuestions: () => void
  canAdvanceBeat: boolean
  onContinueLearning: () => void
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-0.5 py-0.5">
      <span className="w-1 h-1 rounded-full bg-accent/60 thinking-dot" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 rounded-full bg-accent/60 thinking-dot" style={{ animationDelay: '200ms' }} />
      <span className="w-1 h-1 rounded-full bg-accent/60 thinking-dot" style={{ animationDelay: '400ms' }} />
    </div>
  )
}

/** Filter messages to only show tutoring-related conversations */
function useTutoringMessages(messages: Message[]) {
  return useMemo(() => {
    const result: Array<{ role: 'user' | 'assistant'; content: string; id: string }> = []
    const skipIndices = new Set<number>()

    // First pass: identify user messages to skip and their subsequent assistant responses
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.role === 'user') {
        if (msg.content === '开始上课' || msg.content.startsWith('/suggest-questions')) {
          skipIndices.add(i)
          // Also skip the subsequent assistant message
          if (i + 1 < messages.length && messages[i + 1].role === 'assistant') {
            skipIndices.add(i + 1)
          }
        }
      }
    }

    // Second pass: build filtered list
    for (let i = 0; i < messages.length; i++) {
      if (skipIndices.has(i)) continue
      const msg = messages[i]

      if (msg.role === 'user') {
        let content = msg.content
        // Extract question from /explain format
        if (content.startsWith('/explain')) {
          const match = content.match(/\[QUESTION\]\s*([\s\S]*?)\s*\[\/QUESTION\]/)
          content = match?.[1]?.trim() ?? content
        }
        result.push({ role: 'user', content, id: msg.id })
      } else if (msg.role === 'assistant' && msg.content.trim() && !msg.isStreaming) {
        result.push({ role: 'assistant', content: msg.content, id: msg.id })
      }
    }

    return result
  }, [messages])
}

export function TutoringChatbox({
  tutoringMode,
  currentBeat,
  suggestedQuestions,
  selectionMode,
  messages,
  isProcessing,
  isThinking,
  thinkingContent,
  currentStreamContent,
  connected,
  onRaiseHand,
  onDismissTutoring,
  onSendExplainRequest,
  onSendFollowUp,
  onRequestMoreQuestions,
  canAdvanceBeat,
  onContinueLearning,
}: TutoringChatboxProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const questionsEndRef = useRef<HTMLDivElement>(null)
  const [freeText, setFreeText] = useState('')

  const tutoringMessages = useTutoringMessages(messages)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [tutoringMessages, currentStreamContent])

  // Auto-scroll question list when new questions appear
  const prevQuestionsCount = useRef(0)
  useLayoutEffect(() => {
    const count = suggestedQuestions.length + (currentBeat?.expectedQuestions?.length ?? 0)
    if (count > prevQuestionsCount.current && prevQuestionsCount.current > 0) {
      questionsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevQuestionsCount.current = count
  }, [suggestedQuestions, currentBeat?.expectedQuestions])

  // All free text input sends as plain text (no /explain wrapper).
  // /explain wrapping is only for question card clicks (onSendExplainRequest).
  const handleFreeTextSend = useCallback(() => {
    const text = freeText.trim()
    if (!text) return
    onSendFollowUp(text)
    setFreeText('')
  }, [freeText, onSendFollowUp])

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleFreeTextSend()
      }
    },
    [handleFreeTextSend],
  )

  const isAiActive = isProcessing || isThinking
  const expectedQuestions = currentBeat?.expectedQuestions ?? []
  const allQuestions = [
    ...expectedQuestions.map(q => ({ text: q, source: 'manifest' as const })),
    ...suggestedQuestions.map(q => ({ text: q, source: 'ai' as const })),
  ]
  const showPicker = tutoringMode === 'picking' || tutoringMode === 'suggesting'

  return (
    <div className="flex flex-col h-full border-t border-white/[0.04]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">AI 辅导</span>
          <span
            className={[
              'w-1.5 h-1.5 rounded-full transition-colors duration-300',
              connected ? 'bg-success' : 'bg-text-tertiary',
            ].join(' ')}
          />
        </div>
      </div>

      {showPicker ? (
        <>
          {/* Picking mode: label + cancel */}
          <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0">
            <span className="text-[11px] text-text-secondary">选择你的困惑点</span>
            <button
              onClick={onDismissTutoring}
              className="text-[11px] text-text-tertiary hover:text-text-primary transition-colors"
            >
              取消
            </button>
          </div>

          {/* Question list occupies main area */}
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2">
            {allQuestions.map((item, i) => (
              <button
                key={`q-${i}`}
                onClick={() => onSendExplainRequest(item.text)}
                className={[
                  'w-full px-3 py-2.5 rounded-lg text-[13px] text-left border',
                  'border-white/[0.05] text-text-secondary',
                  'hover:border-accent/40 hover:text-text-primary hover:bg-accent/5',
                  'transition-all duration-200',
                ].join(' ')}
              >
                <span className="leading-relaxed">{item.text}</span>
              </button>
            ))}

            {/* "Other questions" button */}
            {tutoringMode === 'picking' && (
              <button
                onClick={onRequestMoreQuestions}
                className={[
                  'w-full text-center px-3 py-2.5 rounded-lg text-[13px] border',
                  'border-white/[0.05] text-text-tertiary',
                  'hover:border-white/[0.10] hover:text-text-secondary',
                  'transition-all duration-200',
                ].join(' ')}
              >
                其他问题...
              </button>
            )}

            {/* Suggesting spinner */}
            {tutoringMode === 'suggesting' && (
              <div className="flex items-center justify-center gap-2 py-2">
                <ThinkingDots />
                <span className="text-[11px] text-text-tertiary">AI 正在思考更多问题...</span>
              </div>
            )}

            <div ref={questionsEndRef} />
          </div>

          {/* Free text input pinned at bottom */}
          <div className="px-3 py-2.5 border-t border-white/[0.04] flex-shrink-0">
            <div className="flex gap-1.5 items-end">
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                onKeyDown={handleKey}
                placeholder="或输入你的问题..."
                rows={1}
                className={[
                  'flex-1 resize-none rounded-lg px-3 py-2 text-[13px]',
                  'bg-surface-2 border border-white/[0.05] text-text-primary',
                  'placeholder:text-text-tertiary focus:outline-none focus:border-accent/40',
                  'transition-colors duration-200',
                ].join(' ')}
              />
              <button
                onClick={handleFreeTextSend}
                disabled={!freeText.trim()}
                className={[
                  'flex-shrink-0 p-2 rounded-lg',
                  'bg-accent/10 text-accent',
                  'hover:bg-accent/20',
                  'disabled:opacity-25 disabled:cursor-not-allowed',
                ].join(' ')}
              >
                <PaperPlaneRight size={13} weight="regular" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Messages area (non-picking modes) */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {/* Empty state */}
            {tutoringMessages.length === 0 && tutoringMode === 'idle' && !currentStreamContent && !isThinking && (
              <div className="flex h-full items-center justify-center pointer-events-none">
                <p className="text-xs text-text-tertiary text-center leading-relaxed px-4">
                  遇到不懂的？<br />点击下方「举手提问」
                </p>
              </div>
            )}

            {/* Tutoring message history */}
            {tutoringMessages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-2.5`}>
                {msg.role === 'assistant' && (
                  <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center mr-1.5 flex-shrink-0 mt-0.5">
                    <span className="text-[8px] font-medium text-text-secondary">AI</span>
                  </div>
                )}
                <div
                  className={[
                    'max-w-[85%] px-3 py-2 rounded-xl text-[13px] leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-accent text-white'
                      : 'bg-surface-2 text-text-primary',
                  ].join(' ')}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Thinking dots */}
            {isThinking && !currentStreamContent && (
              <div className="flex justify-start mb-2.5">
                <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center mr-1.5 flex-shrink-0 mt-0.5">
                  <ThinkingDots />
                </div>
                {thinkingContent && (
                  <div className="max-w-[80%] px-3 py-2 rounded-xl bg-surface-2 text-text-tertiary text-[11px] italic leading-relaxed">
                    {thinkingContent}
                  </div>
                )}
              </div>
            )}

            {/* Streaming content */}
            {currentStreamContent && (
              <div className="flex justify-start mb-2.5">
                <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center mr-1.5 flex-shrink-0 mt-0.5">
                  <span className="text-[8px] font-medium text-text-secondary">AI</span>
                </div>
                <div className="max-w-[85%] px-3 py-2 rounded-xl bg-surface-2 text-text-primary text-[13px] leading-relaxed">
                  {currentStreamContent}
                </div>
              </div>
            )}

            {/* Waiting for AI (processing started but no thinking/streaming yet) */}
            {isAiActive && !isThinking && !currentStreamContent && tutoringMode === 'explaining' && (
              <div className="flex justify-start mb-2.5">
                <div className="w-5 h-5 rounded-full bg-surface-3 flex items-center justify-center mr-1.5 flex-shrink-0 mt-0.5">
                  <ThinkingDots />
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Explaining mode: text input + continue button */}
          {tutoringMode === 'explaining' && (
            <div className="px-3 py-2.5 border-t border-white/[0.04] flex-shrink-0 space-y-2">
              <div className="flex gap-1.5 items-end">
                <textarea
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="回答AI的问题或继续提问..."
                  rows={1}
                  disabled={isAiActive}
                  className={[
                    'flex-1 resize-none rounded-lg px-3 py-2 text-[13px]',
                    'bg-surface-2 border border-white/[0.05] text-text-primary',
                    'placeholder:text-text-tertiary focus:outline-none focus:border-accent/40',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    'transition-colors duration-200',
                  ].join(' ')}
                />
                <button
                  onClick={handleFreeTextSend}
                  disabled={!freeText.trim() || isAiActive}
                  className={[
                    'flex-shrink-0 p-2 rounded-lg',
                    'bg-accent/10 text-accent',
                    'hover:bg-accent/20',
                    'disabled:opacity-25 disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  <PaperPlaneRight size={13} weight="regular" />
                </button>
              </div>
              {/* Continue learning button (only when AI finished) */}
              {!isAiActive && !currentStreamContent && (
                <button
                  onClick={onContinueLearning}
                  className={[
                    'w-full py-2.5 rounded-lg text-sm font-medium',
                    'bg-accent text-white',
                    'hover:bg-accent-muted',
                    'transition-all duration-200',
                    'flex items-center justify-center gap-1.5',
                  ].join(' ')}
                >
                  继续学习{canAdvanceBeat ? ' →' : ''}
                </button>
              )}
            </div>
          )}

          {/* Idle mode: raise hand button */}
          {tutoringMode === 'idle' && (
            <div className="px-3 py-3 border-t border-white/[0.04] flex-shrink-0">
              <button
                onClick={onRaiseHand}
                disabled={!connected || !currentBeat}
                className={[
                  'w-full py-2.5 rounded-lg text-sm font-medium',
                  'border border-accent/30 text-accent',
                  'hover:bg-accent/10 hover:border-accent/50',
                  'disabled:opacity-25 disabled:cursor-not-allowed',
                  'transition-all duration-200',
                  'flex items-center justify-center gap-2',
                ].join(' ')}
              >
                举手提问
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default TutoringChatbox
