import { useState, useEffect, useContext, useRef, useCallback } from 'react'
import { renderMd } from '../renderMd'
import { useAiAsk, useAiDiscuss, useDiscussComplete, useChatHistory, useDiscussProgress } from '../../../hooks/useClassroom'
import type { ClusterProgress } from '../../../hooks/useClassroom'
import { SessionCtx } from '../TaskPanel'
import type { Task, FallbackMC } from '../task-data'
import DiscussGuide from './DiscussGuide'
import { formatTime, computeUrgency, determineInitialPhase, detectFallbackOnRestore, deriveCompletionType, filterMessagesForApi, findNewHits, mcOptionClass } from './discuss-helpers'
import { runStarAnimation } from './star-animation'

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

/* ═══ STATUS BAR ═══ */
function StatusBar({ round, maxRounds, elapsed, maxTime }: { round: number; maxRounds: number; elapsed: number; maxTime: number }) {
  const { color } = computeUrgency(round, maxRounds, elapsed, maxTime)
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
        const cls = mcOptionClass(i, selected, submitted, config.correctIndex)
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
          placeholder={loading ? 'Waiting for AI...' : 'Ask anything...'}
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

/* ═══ CLUSTER TRACKER (bar-style + star slot) ═══ */
function ClusterTracker({ clusters, starSlotRef, countRef }: {
  clusters: ClusterProgress[]
  starSlotRef: React.RefObject<HTMLDivElement>
  countRef: React.RefObject<HTMLSpanElement>
}) {
  if (clusters.length === 0) return null
  const hitCount = clusters.filter(c => c.hit).length
  const allHit = hitCount === clusters.length
  return (
    <div className="sd-tracker">
      <div className="sd-tracker-label" style={allHit ? { color: 'var(--green)' } : undefined}>
        {allHit ? 'All Points Discovered!' : 'Discussion Points'}
      </div>
      <div className="sd-tracker-bar">
        {clusters.map(c => (
          <div key={c.id} className={`sd-tracker-point${c.hit ? ' hit' : ''}`} title={c.label} />
        ))}
        {/* Star slot: .visible added imperatively by animation */}
        <div ref={starSlotRef} className="sd-star-slot">
          {/* count-num textContent is managed imperatively by star-animation.ts — do not add React children */}
          <span className="sd-star-count">✦ <span className="count-num" ref={countRef} /></span>
        </div>
      </div>
    </div>
  )
}

/* ═══ MAIN: DISCUSS PHASE ═══ */
type Phase = 'chat' | 'fallback' | 'done'
type Msg = { role: 'ai' | 'student' | 'notification'; text: string; highlight?: { score: number; gist: string } }

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
  const [phase, setPhase] = useState<Phase>(() => determineInitialPhase(!!isRevisit, !!discussMeta?.goalReached, discussMeta?.completionType))
  const [fallbackReason, setFallbackReason] = useState<'rounds' | 'time' | ''>('')
  const [, setMcAnswer] = useState<number | null>(null)
  const calledDone = useRef(!!isRevisit)
  const submittedRef = useRef(!!isRevisit)
  const sendingRef = useRef(false)
  const msgEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [guideOpen, setGuideOpen] = useState(false)
  const guideSeen = useRef((() => { try { return !!localStorage.getItem('guide-seen-discuss') } catch { return false } })())
  const [clusters, setClusters] = useState<ClusterProgress[]>([])
  const [nudge, setNudge] = useState<string | null>(null)

  // Star animation refs (imperative — not tied to React render cycle)
  const starSlotRef = useRef<HTMLDivElement>(null)
  const countRef = useRef<HTMLSpanElement>(null)
  const starCountRef = useRef(0)
  const animAbortRef = useRef<AbortController | null>(null)

  // Abort any running star animation on unmount
  useEffect(() => () => animAbortRef.current?.abort(), [])

  const { discuss, loading } = useAiDiscuss(sessionCode || '')
  const { complete } = useDiscussComplete(sessionCode || '')
  const { fetchHistory } = useChatHistory(sessionCode || '')
  const { fetchProgress } = useDiscussProgress(sessionCode || '')
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
      // Ensure opening question is present (may be missing from chat_messages)
      if (restored[0]?.text !== d.openingQ) {
        restored.unshift({ role: 'ai', text: d.openingQ })
      }
      setMessages(restored)
      const studentMsgCount = restored.filter(m => m.role === 'student').length
      setRound(studentMsgCount)

      // ── fallback detection on restore ──
      const fallback = detectFallbackOnRestore({
        studentMsgCount,
        maxRounds: d.maxRounds,
        startedAt: discussMeta?.startedAt,
        goalReached: discussMeta?.goalReached,
        completionType: discussMeta?.completionType,
        maxTimeSeconds: d.maxTimeSeconds,
      })
      if (fallback.phase === 'fallback') {
        setFallbackReason(fallback.reason)
        setPhase('fallback')
      }
    })
  }, [sessionCode, studentId, task.id, fetchHistory])

  // Fetch target point progress on mount — restore star slot if hits exist
  useEffect(() => {
    if (!sessionCode || !studentId) return
    fetchProgress(studentId, task.id).then(data => {
      if (data?.targetPoints) {
        setClusters(data.targetPoints)
        const hitCount = data.targetPoints.filter((c: ClusterProgress) => c.hit).length
        if (hitCount > 0) {
          starCountRef.current = hitCount
          requestAnimationFrame(() => {
            if (starSlotRef.current) starSlotRef.current.classList.add('visible')
            if (countRef.current) countRef.current.textContent = String(hitCount)
          })
        }
      }
    })
  }, [sessionCode, studentId, task.id, fetchProgress])

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
        completionType: deriveCompletionType(goalReached, fallbackReason as 'rounds' | 'time' | ''),
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
    if (!text || loading || sendingRef.current || phase !== 'chat') return
    sendingRef.current = true
    try {
      const newRound = round + 1
      setRound(newRound)
      setInput('')
      const studentMsg: Msg = { role: 'student', text }
      setMessages(m => [...m, studentMsg])
      // Filter to only ai/student messages (strip notifications + extra fields) for backend
      const allMsgs = filterMessagesForApi([...messages, studentMsg])

      if (!useAi) {
        setMessages(m => [...m, { role: 'ai', text: 'AI discussion requires an active classroom session.' }])
        return
      }

      const prevHitIds = new Set(clusters.filter(c => c.hit).map(c => c.id))

      const result = await discuss(studentId!, task.id, allMsgs, newRound, getElapsed())
      if (!result) {
        setRound(round)
        setMessages(m => [...m, { role: 'ai', text: 'Sorry, let me think about that differently. Could you rephrase your answer?' }])
        return
      }

      if (result.llmFailed) setRound(round)

      // Fetch target point progress (awaited so we can detect new hits for inline notifications)
      let newHits: ClusterProgress[] = []
      let updatedClusters = clusters
      if (studentId) {
        const data = await fetchProgress(studentId, task.id)
        if (data?.targetPoints) {
          updatedClusters = data.targetPoints
          newHits = findNewHits(prevHitIds, updatedClusters)
          setClusters(updatedClusters)
        }
      }

      // Nudge
      if (result.nudge?.hint) setNudge(result.nudge.hint)
      else setNudge(null)

      // Single batch: highlight + point-discovered notifications + AI reply
      setMessages(m => {
        const updated = [...m]
        if (result.highlight) {
          const lastStudentIdx = updated.findLastIndex(msg => msg.role === 'student')
          if (lastStudentIdx >= 0) {
            updated[lastStudentIdx] = { ...updated[lastStudentIdx], highlight: result.highlight }
          }
        }
        for (let i = 0; i < newHits.length; i++) {
          updated.push({ role: 'notification', text: `Point ${prevHitIds.size + i + 1} discovered` })
        }
        updated.push({ role: 'ai', text: result.reply })
        return updated
      })

      // ── Animation orchestration (imperative, after React renders) ──
      // Scope all queries to #phase-discuss to avoid matching elements from other components
      const scope = document.getElementById('phase-discuss')

      if (result.highlight) {
        requestAnimationFrame(() => {
          const bubbles = scope?.querySelectorAll('.sd-bubble.student')
          const last = bubbles?.[bubbles.length - 1]
          if (last) {
            last.classList.add('flash')
            setTimeout(() => last.classList.remove('flash'), 650)
          }
        })
      }

      if (newHits.length > 0) {
        // Dot nudge animation (use updatedClusters, not stale `clusters` closure)
        const bar = scope?.querySelector('.sd-tracker-bar')
        if (bar) {
          newHits.forEach(hit => {
            const idx = updatedClusters.findIndex(c => c.id === hit.id)
            const dot = bar.querySelectorAll('.sd-tracker-point')[idx]
            if (dot) {
              dot.classList.add('animating')
              setTimeout(() => dot.classList.remove('animating'), 450)
            }
          })
        }

        // Star fly-in animation (runs after React paints the notification)
        animAbortRef.current?.abort()
        animAbortRef.current = new AbortController()
        const signal = animAbortRef.current.signal
        const newTotal = updatedClusters.filter(c => c.hit).length
        starCountRef.current = newTotal
        requestAnimationFrame(() => {
          const notifs = scope?.querySelectorAll('.sd-notif')
          const latestNotif = notifs?.[notifs.length - 1] as HTMLSpanElement | undefined
          runStarAnimation(
            starSlotRef.current,
            countRef.current,
            latestNotif ?? null,
            newTotal,
            newHits.length,
            signal,
          )
        })
      }

      if (result.goalReached) {
        setGoalReached(true)
        setPhase('done')
      } else if (!result.llmFailed && newRound >= d.maxRounds) {
        setFallbackReason('rounds')
        setPhase('fallback')
      }
    } finally {
      sendingRef.current = false
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
    <div id="phase-discuss" data-translate-ctx="discuss">
      <div className="stu-section-label"><span>Discuss</span><div className="stu-section-line" /></div>

      <div className="sd-chat-area">
        {/* Header */}
        <div className="sd-chat-header">
          <div className="sd-ai-dot" />
          <div className="sd-chat-title">Socratic Discussion</div>
          {d.openingQZh && (
            <button className="sd-help-btn" title={d.openingQZh} onClick={() => alert(d.openingQZh)}>中文</button>
          )}
          <button className={`sd-guide-btn${phase === 'chat' && round === 0 && !guideOpen && !guideSeen.current ? ' pulse' : ''}`} onClick={() => {
            setGuideOpen(true)
            try { localStorage.setItem('guide-seen-discuss', '1') } catch { /* */ }
            guideSeen.current = true
          }} aria-label="Discussion guide">?</button>
        </div>
        <DiscussGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

        {/* Status bar */}
        {phase === 'chat' && <StatusBar round={round} maxRounds={d.maxRounds} elapsed={elapsed} maxTime={d.maxTimeSeconds} />}

        {/* Cluster progress tracker (visible in all phases) */}
        <ClusterTracker clusters={clusters} starSlotRef={starSlotRef} countRef={countRef} />

        {/* Messages */}
        <div className="sd-msg-list">
          {messages.map((msg, i) => msg.role === 'notification' ? (
            <div key={i} className="sd-point-discovered">
              <span className="sd-notif">
                <span className="sd-notif-star left">✦</span>
                {msg.text}
                <span className="sd-notif-star right">✦</span>
              </span>
            </div>
          ) : msg.role === 'ai' ? (
            <div key={i} className="sd-msg-row">
              <div className="sd-avatar ai">S</div>
              <div className="sd-bubble ai">{renderMd(msg.text, { math: enableMath })}</div>
            </div>
          ) : (
            <div key={i} className="sd-msg-row student">
              <div className="sd-bubble student" style={{ position: 'relative' }}>
                {msg.text}
                {msg.highlight && (
                  <span className="sd-highlight-badge" title={msg.highlight.gist}>
                    ✦ +{msg.highlight.score}
                  </span>
                )}
              </div>
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

        {/* Nudge chip */}
        {phase === 'chat' && nudge && (
          <div className="sd-nudge-chip">
            <span>💡</span>
            <span className="sd-nudge-text">{nudge}</span>
            <button className="sd-nudge-close" onClick={() => setNudge(null)}>×</button>
          </div>
        )}

        {/* Input */}
        {phase === 'chat' && (
          <div className="sd-input-row">
            <textarea
              ref={inputRef}
              className="sd-input"
              placeholder="Share your thinking..."
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
