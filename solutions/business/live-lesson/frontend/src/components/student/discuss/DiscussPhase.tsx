import { useState, useEffect, useContext, useRef, useCallback } from 'react'
import { renderMd } from '../renderMd'
import { useAiAsk, useAiDiscuss, useDiscussComplete, useChatHistory } from '../../../hooks/useClassroom'
import { SessionCtx } from '../TaskPanel'
import type { Task, FallbackMC } from '../task-data'

/* ═══ TYPING INDICATOR ═══ */
export function TypingIndicator() {
  return (
    <div className="sd-msg-row">
      <div className="sd-avatar ai">S</div>
      <div className="sd-bubble ai" style={{ padding: '12px 18px' }}>
        <div className="stu-typing">
          <div className="stu-typing-dot" />
          <div className="stu-typing-dot" />
          <div className="stu-typing-dot" />
        </div>
      </div>
    </div>
  )
}

/* ═══ TIME FORMATTER ═══ */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

/* ═══ STATUS BAR ═══ */
function StatusBar({ round, maxRounds, elapsed, maxTime }: { round: number; maxRounds: number; elapsed: number; maxTime: number }) {
  const urgency = Math.max(round / maxRounds, elapsed / maxTime)
  const color = urgency < 0.5 ? 'var(--green)' : urgency < 0.8 ? 'var(--amber)' : 'var(--red)'
  return (
    <div className="sd-status-bar">
      <div className="sd-status-pill" style={{ background: color + '18', color }}>{`Round ${round}/${maxRounds}`}</div>
      <div className="sd-status-pill" style={{ background: color + '18', color }}>{formatTime(elapsed)} / {formatTime(maxTime)}</div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 10, color: 'var(--t3)' }}>Think deeply — no rush!</span>
    </div>
  )
}

/* ═══ SCAFFOLD CHIPS ═══ */
function ScaffoldChips({ scaffolds, onPick }: { scaffolds: string[]; onPick: (s: string) => void }) {
  return (
    <div className="sd-scaffold-wrap">
      {scaffolds.map((s, i) => (
        <button key={i} className="sd-scaffold-chip" onClick={() => onPick(s)}>{s}</button>
      ))}
    </div>
  )
}

/* ═══ FALLBACK MC ═══ */
function FallbackMCView({ config, onComplete }: { config: FallbackMC; onComplete: (selectedIndex: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (selected === null) return
    setSubmitted(true)
    setTimeout(() => onComplete(selected), 1200)
  }

  return (
    <div className="sd-mc-wrap">
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>Let's try a different approach</div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 12 }}>Pick the best answer to show your understanding.</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 12, lineHeight: 1.5 }}>
        {config.question}
        {config.questionZh && <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 400, marginTop: 4 }}>{config.questionZh}</div>}
      </div>
      {config.options.map((opt, i) => {
        const isRight = i === config.correctIndex
        let cls = 'sd-mc-option'
        if (submitted && isRight) cls += ' correct'
        else if (submitted && selected === i && !isRight) cls += ' wrong'
        else if (selected === i) cls += ' selected'
        return (
          <div key={i} className={cls} style={submitted ? { cursor: 'default' } : undefined} onClick={submitted ? undefined : () => setSelected(i)}>
            <span className="sd-mc-radio" style={
              submitted && isRight ? { borderColor: 'var(--green)', borderWidth: 5 } :
              submitted && selected === i ? { borderColor: 'var(--red)', borderWidth: 5 } :
              selected === i ? { borderColor: 'var(--teal)', borderWidth: 5 } : undefined
            } />
            {opt}
          </div>
        )
      })}
      {!submitted && (
        <button
          className="stu-btn pri"
          disabled={selected === null}
          style={{ marginTop: 8, ...(selected === null ? { opacity: 0.35, cursor: 'default' } : {}) }}
          onClick={handleSubmit}
        >Submit</button>
      )}
      {submitted && selected !== config.correctIndex && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--red)', fontWeight: 500, lineHeight: 1.6 }}>
          Not quite. The correct answer is highlighted in green above.
        </div>
      )}
    </div>
  )
}

/* ═══ CONTINUE CHAT ═══ */
function ContinueChat({ taskId }: { taskId: number }) {
  const { sessionCode, studentId } = useContext(SessionCtx)
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Array<{ role: 'q' | 'a'; text: string; loading?: boolean; id?: number }>>([])
  const [input, setInput] = useState('')
  const { ask, loading } = useAiAsk(sessionCode || '')
  const { fetchHistory } = useChatHistory(sessionCode || '')
  const endRef = useRef<HTMLDivElement>(null)
  const restoredRef = useRef(false)

  useEffect(() => {
    if (restoredRef.current || !sessionCode || !studentId) return
    restoredRef.current = true
    fetchHistory(studentId, `continue:${taskId}`).then(data => {
      if (!data) return
      const thread = data[`continue:${taskId}`]
      if (!thread || thread.length === 0) return
      const restored = thread.map(m => ({
        role: (m.role === 'student' ? 'q' : 'a') as 'q' | 'a',
        text: m.content,
      }))
      setMsgs(restored)
      setOpen(true)
    })
  }, [sessionCode, studentId, taskId, fetchHistory])

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [msgs, loading])

  const send = async () => {
    if (!input.trim() || loading) return
    const q = input.trim()
    const pid = Date.now()
    setInput('')
    setMsgs(m => [...m, { role: 'q', text: q }, { role: 'a', text: 'Thinking...', loading: true, id: pid }])
    const history = [...msgs.filter(m => !m.loading), { role: 'q' as const, text: q }]
      .map(m => ({ role: m.role === 'q' ? 'student' : 'ai', text: m.text }))
    const reply = sessionCode && studentId
      ? (await ask(studentId, taskId, q, history))?.answer || 'Sorry, AI is unavailable right now.'
      : 'AI discussion requires an active session.'
    setMsgs(m => m.map(msg => msg.id === pid ? { role: 'a' as const, text: reply, id: pid } : msg))
  }

  if (!open) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <button className="sd-continue-btn" onClick={() => setOpen(true)}>Still have questions? Keep discussing</button>
      </div>
    )
  }

  return (
    <div className="sd-chat-area" style={{ marginTop: 4 }}>
      <div className="sd-chat-header">
        <div className="sd-ai-dot" />
        <div className="sd-chat-title">Continue Discussion</div>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>Ask anything about this topic</span>
      </div>
      <div className="sd-continue-area">
        {msgs.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: 16 }}>Ask a follow-up question.</div>}
        {msgs.map((m, i) => m.role === 'a' ? (
          <div key={i} className="sd-msg-row">
            <div className="sd-avatar ai">S</div>
            <div className="sd-bubble ai" style={m.loading ? { opacity: 0.6, fontStyle: 'italic' } : undefined}>{m.text}</div>
          </div>
        ) : (
          <div key={i} className="sd-msg-row student">
            <div className="sd-bubble student">{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="sd-input-row">
        <textarea
          className="sd-input"
          placeholder={loading ? 'Waiting for AI...' : 'Ask anything... (English or 中文)'}
          value={input}
          rows={1}
          disabled={loading}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        />
        <button className="sd-send-btn" disabled={!input.trim() || loading} style={!input.trim() || loading ? { opacity: 0.3, cursor: 'default' } : undefined} onClick={send}>→</button>
      </div>
    </div>
  )
}

/* ═══ MAIN: DISCUSS PHASE ═══ */
type Phase = 'chat' | 'fallback' | 'done'
type Msg = { role: 'ai' | 'student'; text: string }

export function DiscussPhase({ task, onDone, isRevisit }: { task: Task; onDone: () => void; isRevisit?: boolean }) {
  const { sessionCode, studentId, submit, config, discussMeta } = useContext(SessionCtx)
  const enableMath = config.enableMath
  const d = task.discuss
  const [messages, setMessages] = useState<Msg[]>([{ role: 'ai', text: d.openingQ }])
  const [input, setInput] = useState('')
  const [round, setRound] = useState(0)
  const [startTime] = useState(() =>
    discussMeta?.startedAt ? new Date(discussMeta.startedAt).getTime() : Date.now()
  )
  const [elapsed, setElapsed] = useState(0)
  const [goalReached, setGoalReached] = useState(!!discussMeta?.goalReached)
  const [phase, setPhase] = useState<Phase>(() => {
    if (isRevisit) return 'done'
    if (discussMeta?.goalReached) return 'done'
    return 'chat'
  })
  const [fallbackReason, setFallbackReason] = useState<'rounds' | 'time' | ''>('')
  const [, setMcAnswer] = useState<number | null>(null)
  const calledDone = useRef(!!isRevisit)
  const submittedRef = useRef(!!isRevisit)
  const msgEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { discuss, loading } = useAiDiscuss(sessionCode || '')
  const { complete } = useDiscussComplete(sessionCode || '')
  const { fetchHistory } = useChatHistory(sessionCode || '')
  const useAi = !!(sessionCode && studentId)

  const getElapsed = useCallback(() => Math.floor((Date.now() - startTime) / 1000), [startTime])

  // Restore discuss thread on mount
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || !sessionCode || !studentId) return
    restoredRef.current = true
    fetchHistory(studentId, `discuss:${task.id}`).then(data => {
      if (!data) return
      const thread = data[`discuss:${task.id}`]
      if (!thread || thread.length === 0) return
      const restored: Msg[] = thread.map(m => ({
        role: m.role as 'ai' | 'student',
        text: m.content,
      }))
      setMessages(restored)
      const studentMsgCount = restored.filter(m => m.role === 'student').length
      setRound(studentMsgCount)

      // ── fallback detection on restore ──
      if (studentMsgCount >= d.maxRounds) {
        setFallbackReason('rounds')
        setPhase('fallback')
      } else if (discussMeta?.startedAt && !discussMeta.goalReached) {
        const elapsedSec = Math.floor((Date.now() - new Date(discussMeta.startedAt).getTime()) / 1000)
        if (elapsedSec >= d.maxTimeSeconds) {
          setFallbackReason('time')
          setPhase('fallback')
        }
      }
    })
  }, [sessionCode, studentId, task.id, fetchHistory])

  // Timer — pauses while AI is loading so students aren't penalised for latency
  useEffect(() => {
    if (phase === 'done' || loading) return
    const id = setInterval(() => {
      const s = getElapsed()
      setElapsed(s)
      if (s >= d.maxTimeSeconds && phase === 'chat') {
        setFallbackReason('time')
        setPhase('fallback')
      }
    }, 1000)
    return () => clearInterval(id)
  }, [phase, d.maxTimeSeconds, getElapsed, loading])

  // Auto-scroll
  useEffect(() => {
    msgEndRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [messages, loading, phase])

  // Persist submission data when done (but don't unlock next phase yet)
  useEffect(() => {
    if (phase === 'done' && !submittedRef.current) {
      submittedRef.current = true
      submit?.(task.id, {
        phase: 'discuss',
        skipped: false,
        rounds: round,
        goalReached,
        completionType: goalReached ? 'goal_reached' : (fallbackReason === 'rounds' ? 'fallback_rounds' : 'fallback_time'),
        taskId: task.id,
      })
    }
  }, [phase, round, goalReached, fallbackReason, submit, task.id])

  // Student clicks "Continue" to unlock Takeaway
  const handleContinue = useCallback(() => {
    if (!calledDone.current) {
      calledDone.current = true
      onDone()
    }
  }, [onDone])

  // Send message
  const send = async () => {
    const text = input.trim()
    if (!text || loading || phase !== 'chat') return

    const newRound = round + 1
    setRound(newRound)
    setInput('')
    const studentMsg: Msg = { role: 'student', text }
    const allMsgs = [...messages, studentMsg]
    setMessages(allMsgs)

    if (!useAi) {
      setMessages(m => [...m, { role: 'ai', text: 'AI discussion requires an active classroom session.' }])
      return
    }

    const result = await discuss(studentId!, task.id, allMsgs, newRound, getElapsed())
    if (result) {
      if (result.goalReached) {
        setMessages(m => [...m, { role: 'ai', text: result.reply }])
        setGoalReached(true)
        setPhase('done')
      } else {
        setMessages(m => [...m, { role: 'ai', text: result.reply }])
        if (newRound >= d.maxRounds) {
          setFallbackReason('rounds')
          setPhase('fallback')
        }
      }
    } else {
      setMessages(m => [...m, { role: 'ai', text: 'Sorry, let me think about that differently. Could you rephrase your answer?' }])
    }
  }

  const handleScaffold = (text: string) => {
    setInput(text)
    inputRef.current?.focus()
  }

  const handleMCComplete = async (selectedIndex: number) => {
    setMcAnswer(selectedIndex)
    if (useAi) {
      const ct = fallbackReason === 'time' ? 'fallback_time' : 'fallback_rounds' as const
      await complete({
        studentId: studentId!,
        taskNum: task.id,
        completionType: ct,
        roundsUsed: round,
        timeUsedSeconds: getElapsed(),
        mcSelectedIndex: selectedIndex,
      })
    }
    setPhase('done')
  }

  return (
    <div id="phase-discuss">
      <div className="stu-section-label"><span>Discuss</span><div className="stu-section-line" /></div>

      <div className="sd-chat-area">
        {/* Header */}
        <div className="sd-chat-header">
          <div className="sd-ai-dot" />
          <div className="sd-chat-title">Socratic Discussion</div>
          {d.openingQZh && (
            <button className="sd-help-btn" title={d.openingQZh} onClick={() => alert(d.openingQZh)}>中文</button>
          )}
        </div>

        {/* Status bar */}
        {phase === 'chat' && <StatusBar round={round} maxRounds={d.maxRounds} elapsed={elapsed} maxTime={d.maxTimeSeconds} />}

        {/* Messages */}
        <div className="sd-msg-list">
          {messages.map((msg, i) => msg.role === 'ai' ? (
            <div key={i} className="sd-msg-row">
              <div className="sd-avatar ai">S</div>
              <div className="sd-bubble ai">{renderMd(msg.text, { math: enableMath })}</div>
            </div>
          ) : (
            <div key={i} className="sd-msg-row student">
              <div className="sd-bubble student">{msg.text}</div>
            </div>
          ))}

          {loading && <TypingIndicator />}

          {/* Fallback MC */}
          {phase === 'fallback' && (
            <div className="sd-msg-row">
              <div className="sd-avatar ai">S</div>
              <div className="sd-bubble ai" style={{ maxWidth: '92%' }}>
                <div style={{ marginBottom: 10, lineHeight: 1.6 }}>
                  {fallbackReason === 'time'
                    ? "Time's up! You've been thinking hard. Let me give you a question to help:"
                    : 'Great discussion! Let\'s check your understanding:'}
                </div>
                <FallbackMCView config={d.fallbackMC} onComplete={handleMCComplete} />
              </div>
            </div>
          )}

          {/* Goal reached celebration */}
          {goalReached && (
            <div className="sd-msg-row">
              <div className="sd-avatar" style={{ background: 'var(--green-bg)', fontSize: 16 }}>🎉</div>
              <div className="sd-bubble sd-celebration">
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
                  Amazing! You figured it out all by yourself!
                </div>
                <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
                  {`That's real critical thinking — ${round} round${round > 1 ? 's' : ''} in ${formatTime(elapsed)}. You should be proud!`}
                </div>
              </div>
            </div>
          )}

          {/* Explanation + insight */}
          {phase === 'done' && (
            <div className="sd-msg-row">
              <div className="sd-avatar ai">S</div>
              <div className="sd-bubble ai" style={{ maxWidth: '92%' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>
                  {goalReached ? "Here's a summary" : 'Full explanation'}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--t1)' }}>{renderMd(d.fallbackMC.explanation, { math: enableMath })}</div>
                {d.fallbackMC.explanationZh && (
                  <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6, fontStyle: 'italic' }}>{d.fallbackMC.explanationZh}</div>
                )}
                <div className="sd-insight-card">
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', marginBottom: 2 }}>Key Insight</div>
                  <div style={{ fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>{d.insight}</div>
                  {d.insightZh && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{d.insightZh}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Unlock notice / Continue button */}
          {phase === 'done' && (
            <div className="sd-unlock-notice">
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              {isRevisit ? (
                <div className="sd-unlock-pill">✓ Discuss complete</div>
              ) : (
                <button type="button" className="sd-unlock-pill sd-continue-action" onClick={handleContinue}>
                  Continue to Takeaway →
                </button>
              )}
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )}

          <div ref={msgEndRef} />
        </div>

        {/* Scaffold chips */}
        {phase === 'chat' && round === 0 && d.scaffolds && d.scaffolds.length > 0 && (
          <ScaffoldChips scaffolds={d.scaffolds} onPick={handleScaffold} />
        )}

        {/* Input */}
        {phase === 'chat' && (
          <div className="sd-input-row">
            <textarea
              ref={inputRef}
              className="sd-input"
              placeholder="Share your thinking... (English or 中文 both OK)"
              value={input}
              rows={1}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            />
            <button
              className="sd-send-btn"
              disabled={!input.trim() || loading}
              style={!input.trim() || loading ? { opacity: 0.3, cursor: 'default' } : undefined}
              onClick={send}
            >→</button>
          </div>
        )}
      </div>

      {/* Continue chat after completion */}
      {phase === 'done' && <ContinueChat taskId={task.id} />}
    </div>
  )
}
