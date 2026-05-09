import { useState, useRef, useCallback, useContext, useEffect } from 'react'
import { useAiAsk } from '../../../hooks/useClassroom'
import { SessionCtx } from '../TaskPanel'

interface ChatMsg {
  t: 'q' | 'a'
  x: string
}

interface Props {
  taskId: number
  taskName?: string
  phase?: string
  aiHints?: Array<{ q: string; label: string }>
}

export default function AIFloat({ taskId, taskName, phase, aiHints }: Props) {
  const { sessionCode, studentId } = useContext(SessionCtx)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)
  const { ask, loading } = useAiAsk(sessionCode || '')

  const hints = aiHints || []
  const isDiscuss = phase === 'discuss'

  // Storage key for session persistence
  const storageKey = `ai-chat-${sessionCode || 'local'}-${taskId}`

  // Restore chat from sessionStorage on mount / taskId change
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey)
    if (saved) {
      try { setMsgs(JSON.parse(saved)) } catch { /* ignore corrupt data */ }
    } else {
      setMsgs([])
    }
  }, [storageKey])

  // Persist chat to sessionStorage on change
  useEffect(() => {
    if (msgs.length > 0) {
      sessionStorage.setItem(storageKey, JSON.stringify(msgs))
    }
  }, [msgs, storageKey])

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  const sendQuestion = useCallback(async (question: string) => {
    if (!question.trim() || isDiscuss) return

    setMsgs(m => [...m, { t: 'q', x: question.trim() }])
    setInput('')
    scrollToBottom()

    if (sessionCode && studentId) {
      const result = await ask(studentId, taskId, question.trim())
      setMsgs(m => [...m, { t: 'a', x: result?.answer || 'AI assistant is temporarily unavailable.' }])
    } else {
      setMsgs(m => [...m, { t: 'a', x: 'Think about how the evidence in the text connects to your idea. Try using the pattern: "Based on the text, I think... because..."' }])
    }
    scrollToBottom()
  }, [sessionCode, studentId, taskId, ask, isDiscuss])

  const handleSend = () => {
    if (!input.trim() || loading || isDiscuss) return
    sendQuestion(input.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Phase label for header badge
  const phaseLabel = phase === 'discuss' ? 'Discuss'
    : phase === 'practice' ? 'Practice'
    : phase === 'takeaway' ? 'Takeaway'
    : phase === 'listen' ? 'Listen'
    : null

  const stepLabel = taskName
    ? `Step ${taskId}` + (phaseLabel ? ` · ${phaseLabel}` : '')
    : phaseLabel || undefined

  return (
    <>
      {/* Pulse ring (only when closed) */}
      {!open && <div className="stu-ai-fab-ring" />}

      {/* FAB button */}
      <button
        className={`stu-ai-fab${open ? ' open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
      />

      {/* Floating panel */}
      {open && (
        <div className="stu-ai-panel" data-translate-ctx="ai-chat">
          {/* Header */}
          <div className="stu-ai-hd">
            <div className="stu-ai-avatar" />
            <span className="stu-ai-title">AI Assistant</span>
            {stepLabel && <span className="stu-ai-phase-badge">{stepLabel}</span>}
            <button className="stu-ai-close" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>

          {/* Suggestion chips */}
          {hints.length > 0 && !isDiscuss && (
            <div className="stu-ai-chips">
              {hints.map((h, i) => (
                <button
                  key={i}
                  className="stu-ai-chip"
                  onClick={() => sendQuestion(h.q)}
                  disabled={loading}
                >{h.label}</button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          <div ref={chatRef} className="stu-ai-chat">
            {msgs.length === 0 && !isDiscuss && (
              <div className="stu-ai-empty">
                {taskName
                  ? `Ask me anything about "${taskName}"!`
                  : 'Ask me anything about the text!'}
              </div>
            )}
            {msgs.length === 0 && isDiscuss && (
              <div className="stu-ai-empty">
                Chat history will be shown here.
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`stu-ai-msg${m.t === 'q' ? ' student' : ''}`}>
                {m.t === 'a' && <div className="stu-ai-msg-avatar" />}
                <div className={`stu-ai-bubble ${m.t === 'q' ? 'student' : 'ai'}`}>{m.x}</div>
              </div>
            ))}
            {loading && (
              <div className="stu-ai-typing">
                <div className="stu-ai-msg-avatar" />
                <div className="stu-ai-typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          {/* Discuss phase hint */}
          {isDiscuss && (
            <div className="stu-ai-discuss-hint">
              正在 Socratic 讨论中，可以在讨论窗口直接对话
            </div>
          )}

          {/* Input area */}
          {!isDiscuss && (
            <div className="stu-ai-input">
              <textarea
                placeholder="Type your question..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={1}
              />
              <button
                className="stu-ai-send"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                aria-label="Send"
              >→</button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
