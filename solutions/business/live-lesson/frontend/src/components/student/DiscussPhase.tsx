import { useState, useEffect, useContext, useRef } from 'react'
import HelpButton from './HelpButton'

import { renderMd } from './renderMd'
import { useAiAsk, useAiDiscuss } from '../../hooks/useClassroom'
import { SessionCtx } from './TaskPanel'

import type { Task } from './task-data'

/* ═══ TYPING INDICATOR ═══ */
export function TypingIndicator() {
  return (
    <div className="stu-ai-reply">
      <div className="stu-ai-dot" />
      <div className="stu-typing">
        <div className="stu-typing-dot" />
        <div className="stu-typing-dot" />
        <div className="stu-typing-dot" />
      </div>
    </div>
  )
}

/* ═══ DISCUSS PHASE ═══ */
export function DiscussPhase({ task, onDone }: { task: Task; onDone: () => void }) {
  const { sessionCode, studentId, submit, config } = useContext(SessionCtx)
  const enableMath = config.enableMath
  const md = task.manifestDiscuss
  const d = task.discuss

  const probeQ = md?.probe?.q || d.probe.q
  const probeTranslate = md?.probe?.translate || d.probe.translate
  const insightText = md?.insight || d.insight
  const insightZh = md?.insightZh || d.insightZh

  const useAi = !!(md && sessionCode && studentId)

  const [step, setStep] = useState(0)
  const [input1, setI1] = useState('')
  const [input2, setI2] = useState('')
  const [aiReply1, setAiReply1] = useState<string | null>(null)
  const [followUpQ, setFollowUpQ] = useState<string | null>(null)
  const [aiReply2, setAiReply2] = useState<string | null>(null)
  const [discussing, setDiscussing] = useState(false)
  const [extraMsgs, setEM] = useState<Array<{ t: string; x: string; loading?: boolean; id?: number }>>([])
  const [extraIn, setEI] = useState('')
  const [showSkip, setShowSkip] = useState(false)
  const [done, setDone] = useState(false)
  const calledDone = useRef(false)
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { ask, loading: aiLoading } = useAiAsk(sessionCode || '')
  const { discuss } = useAiDiscuss(sessionCode || '')

  const finishDiscuss = (data: { phase: string; skipped: boolean; quality?: string; rounds?: number; taskId: number }) => {
    if (calledDone.current) return
    calledDone.current = true
    setDone(true)
    submit?.(task.id, data)
    onDone()
  }

  // 15s timeout: show skip if AI never responds after probe submit
  useEffect(() => {
    if (step >= 1 && !aiReply1 && !showSkip) {
      skipTimerRef.current = setTimeout(() => setShowSkip(true), 15_000)
    }
    return () => { if (skipTimerRef.current) clearTimeout(skipTimerRef.current) }
  }, [step, aiReply1, showSkip])

  // Show skip button once first AI reply arrives
  useEffect(() => {
    if (aiReply1 && !showSkip) {
      setShowSkip(true)
      if (skipTimerRef.current) { clearTimeout(skipTimerRef.current); skipTimerRef.current = null }
    }
  }, [aiReply1, showSkip])

  const handleSkip = () => {
    finishDiscuss({ phase: 'discuss', skipped: true, taskId: task.id })
  }

  const handleProbeSubmit = async () => {
    if (!input1.trim()) return
    if (useAi) {
      setDiscussing(true)
      setStep(1)
      const result = await discuss(studentId!, task.id, 'probeReply', input1.trim())
      if (result) {
        setAiReply1(result.reply)
        setFollowUpQ(result.followUpQuestion || null)
        // Unlock if AI says pass, OR if retry but no follow-up question
        // (retry is meaningless without a follow-up for the student to answer)
        if (result.quality === 'pass' || !result.followUpQuestion) {
          finishDiscuss({ phase: 'discuss', skipped: false, quality: result.quality, rounds: 1, taskId: task.id })
        }
      } else {
        setAiReply1('Sorry, AI is unavailable right now. Please try again later.')
        setFollowUpQ(null)
      }
      setDiscussing(false)
    } else {
      setStep(1)
      setAiReply1('AI discussion requires an active classroom session.')
      setFollowUpQ(null)
      finishDiscuss({ phase: 'discuss', skipped: false, quality: 'pass', rounds: 1, taskId: task.id })
    }
  }

  const handleFollowUpSubmit = async () => {
    if (!input2.trim()) return
    if (useAi) {
      setDiscussing(true)
      setStep(3)
      const result = await discuss(studentId!, task.id, 'followUpReply', input2.trim())
      if (result) {
        setAiReply2(result.reply)
        // Round 2 complete — always unlock regardless of quality
        finishDiscuss({ phase: 'discuss', skipped: false, quality: result.quality, rounds: 2, taskId: task.id })
      } else {
        setAiReply2('Sorry, AI is unavailable right now. Please try again later.')
        finishDiscuss({ phase: 'discuss', skipped: false, quality: 'pass', rounds: 2, taskId: task.id })
      }
      setDiscussing(false)
    } else {
      setStep(3)
      setAiReply2('AI discussion requires an active classroom session.')
      finishDiscuss({ phase: 'discuss', skipped: false, quality: 'pass', rounds: 2, taskId: task.id })
    }
  }

  const sendExtra = async () => {
    if (!extraIn.trim() || aiLoading) return
    const question = extraIn.trim()
    const placeholderId = Date.now()
    setEI('')
    setEM(m => [...m, { t: 'q', x: question }, { t: 'a', x: 'Thinking...', loading: true, id: placeholderId }])
    const reply = sessionCode && studentId
      ? (await ask(studentId, task.id, question))?.answer || 'Sorry, AI is unavailable right now. Try again later.'
      : 'AI discussion requires an active classroom session.'
    setEM(m => m.map(msg => msg.id === placeholderId ? { t: 'a', x: reply, id: placeholderId } : msg))
  }

  return (
    <div id="phase-discuss">
      <div className="stu-section-label"><span>Discuss</span><div className="stu-section-line" /></div>

      {/* Probe */}
      <div className="stu-probe-box">
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div className="stu-ai-dot" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.5 }}>{renderMd(probeQ, { math: enableMath })}</div>
            {probeTranslate && <div style={{ marginTop: 4 }}><HelpButton translate={probeTranslate} /></div>}
          </div>
        </div>
        {step === 0 && (
          <div>
            <textarea className="stu-free-input" placeholder="Share your thoughts... (English or Chinese)" value={input1} onChange={e => setI1(e.target.value)} />
            <button
              className="stu-btn pri"
              style={{ marginTop: 8, fontSize: 13, ...(input1.trim().length === 0 || discussing ? { opacity: 0.35, cursor: 'default' } : {}) }}
              onClick={input1.trim() && !discussing ? handleProbeSubmit : undefined}
            >{discussing ? 'Sending...' : 'Submit'}</button>
          </div>
        )}
      </div>

      {/* Typing indicator while waiting for AI reply 1 */}
      {step >= 1 && !aiReply1 && <TypingIndicator />}

      {/* AI Reply 1 */}
      {aiReply1 && (
        <div className="stu-ai-reply">
          <div className="stu-ai-dot" />
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.7, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{renderMd(aiReply1, { math: enableMath })}</div>
        </div>
      )}

      {/* Follow-up probe */}
      {aiReply1 && followUpQ && (
        <div className="stu-probe-box">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div className="stu-ai-dot" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.5 }}>{renderMd(followUpQ, { math: enableMath })}</div>
            </div>
          </div>
          {step < 3 && (
            <div>
              <textarea className="stu-free-input" placeholder="Continue..." value={input2} onChange={e => setI2(e.target.value)} />
              <button
                className="stu-btn pri"
                style={{ marginTop: 8, fontSize: 13, ...(input2.trim().length === 0 || discussing ? { opacity: 0.35, cursor: 'default' } : {}) }}
                onClick={input2.trim() && !discussing ? handleFollowUpSubmit : undefined}
              >{discussing ? 'Sending...' : 'Submit'}</button>
            </div>
          )}
        </div>
      )}

      {/* Typing indicator while waiting for AI reply 2 */}
      {step >= 3 && !aiReply2 && <TypingIndicator />}

      {/* AI Reply 2 (follow-up) */}
      {aiReply2 && (
        <div className="stu-ai-reply">
          <div className="stu-ai-dot" />
          <div style={{ flex: 1, fontSize: 13, lineHeight: 1.7, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{renderMd(aiReply2, { math: enableMath })}</div>
        </div>
      )}

      {/* Skip button — visible after first AI reply or 15s timeout */}
      {showSkip && !done && (
        <div style={{ textAlign: 'center', margin: '10px 0' }}>
          <button
            className="stu-btn"
            style={{ fontSize: 12, color: 'var(--t2)', background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={handleSkip}
          >Skip discussion →</button>
        </div>
      )}

      {/* Insight */}
      {step >= 1 && (
        <div className="stu-insight-box">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Key Insight</div>
          {renderMd(insightText, { math: enableMath })}
          {insightZh && <div style={{ marginTop: 4 }}><HelpButton translate={insightZh} /></div>}
        </div>
      )}

      {/* Extra discussion */}
      {step >= 1 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--purple)', marginBottom: 6 }}>Want to discuss more?</div>
          {extraMsgs.map((m, i) => (
            <div key={i} className={m.t === 'q' ? 'stu-extra-q' : 'stu-extra-a'} style={m.loading ? { opacity: 0.6, fontStyle: 'italic' } : undefined}>{m.x}</div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', background: 'var(--bg)' }}
              placeholder={aiLoading ? 'Waiting for AI...' : 'Ask anything...'}
              value={extraIn}
              disabled={aiLoading}
              onChange={e => setEI(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendExtra() }}
            />
            <button
              style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--t1)', color: 'var(--surface)', cursor: 'pointer', fontSize: 12 }}
              onClick={sendExtra}
            >→</button>
          </div>
        </div>
      )}
    </div>
  )
}
