import { useState, useEffect, useContext } from 'react'
import { SessionCtx } from '../TaskPanel'
import AudioButton from '../AudioButton'
import { renderMd } from '../renderMd'

interface RecapHighlight {
  taskNum: number
  gist: string
  evidenceSpan: string
}

interface RecapData {
  tier: { label: string; labelEn: string; tone: string } | null
  highlights: RecapHighlight[]
  aiStats: { translateCount: number; askCount: number; discussRounds: number }
  totalTime: number | null
  bonusCompleted: boolean
  aiRecap: string
}

function tierEmoji(tone: string): string {
  if (tone === 'gold') return '\u2B50'
  if (tone === 'blue' || tone === 'teal') return '\uD83D\uDCAA'
  return '\uD83D\uDCDA'
}

function formatMinutes(totalSeconds: number): string {
  const min = Math.round(totalSeconds / 60)
  if (min < 1) return '< 1 min'
  return `${min} min`
}

export function SummaryScreen({ lessonSummary, lessonId, enableMath, onReviewBonus }: {
  lessonSummary: string
  lessonId?: string
  enableMath?: boolean
  onReviewBonus?: () => void
}) {
  const ctx = useContext(SessionCtx)
  const [recap, setRecap] = useState<RecapData | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!ctx.sessionCode || !ctx.studentId) { setFailed(true); return }
    const ac = new AbortController()
    fetch(`/api/classroom/${ctx.sessionCode}/students/${ctx.studentId}/recap`, { signal: ac.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setRecap(d); else setFailed(true) })
      .catch(e => { if (e.name !== 'AbortError') setFailed(true) })
    return () => ac.abort()
  }, [ctx.sessionCode, ctx.studentId])

  const hasStats = recap && (recap.aiStats.translateCount > 0 || recap.aiStats.askCount > 0 || recap.aiStats.discussRounds > 0)

  return (
    <div className="stu-task-inner" style={{ paddingTop: 32 }}>
      {/* Section 1 — Header */}
      <div className="sum-header">
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Complete</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 12, color: 'var(--t1)' }}>Great job today!</div>
        {recap?.tier && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span className={`sum-tier ${recap.tier.tone === 'gold' ? 'gold' : recap.tier.tone === 'blue' ? 'teal' : 'neutral'}`}>
              {tierEmoji(recap.tier.tone)} {recap.tier.labelEn} {recap.tier.label}
            </span>
            {recap.totalTime !== null && recap.totalTime > 0 && (
              <span style={{ fontSize: 12, color: 'var(--t3)' }}>{formatMinutes(recap.totalTime)}</span>
            )}
          </div>
        )}
        {!recap?.tier && recap?.totalTime != null && recap.totalTime > 0 && (
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 8 }}>{formatMinutes(recap.totalTime)}</div>
        )}
      </div>

      {/* Section 2 — AI Recap */}
      {recap && !failed && recap.aiRecap && (
        <div className="sum-section" style={{ animationDelay: '80ms', marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Your Recap</div>
          <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)' }}>
            {renderMd(recap.aiRecap, { math: enableMath })}
          </div>
        </div>
      )}

      {/* Section 3 — Highlights */}
      {recap && !failed && (
        <div className="sum-section" style={{ animationDelay: recap.aiRecap ? '160ms' : '80ms', marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Your Best Moments</div>
          {recap.highlights.length > 0 ? (
            recap.highlights.map((h, i) => (
              <div key={i} className="sum-hl-card">
                <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.7 }}>
                  <span style={{ color: 'var(--amber)', fontWeight: 700 }}>&#10022; </span>
                  <span style={{ fontStyle: 'italic' }}>"{h.evidenceSpan}"</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>Task {h.taskNum}</div>
              </div>
            ))
          ) : (
            <div style={{ padding: '12px 14px', background: 'var(--teal-bg)', borderRadius: 8, fontSize: 13, color: 'var(--teal)', lineHeight: 1.65 }}>
              Next time, try expressing more of your ideas during discussions — your best moments will show up here!
            </div>
          )}
        </div>
      )}

      {/* Section 4 — AI Stats */}
      {recap && !failed && (
        <div className="sum-section" style={{ animationDelay: recap.aiRecap ? '240ms' : '160ms', marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Your AI Engagement</div>
          {hasStats ? (
            <div className="sum-stats">
              <div className="sum-stat amber">
                <div className="num">{recap.aiStats.translateCount}</div>
                <div className="label">Translate</div>
              </div>
              <div className="sum-stat purple">
                <div className="num">{recap.aiStats.askCount}</div>
                <div className="label">AI Ask</div>
              </div>
              <div className="sum-stat teal">
                <div className="num">{recap.aiStats.discussRounds}</div>
                <div className="label">Discuss</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', background: 'var(--teal-bg)', borderRadius: 8, fontSize: 13, color: 'var(--teal)', lineHeight: 1.65 }}>
              Next time, try the Translate and AI Ask features to deepen your understanding!
            </div>
          )}
        </div>
      )}

      {/* Section 5 — Takeaway (always shown) */}
      <div className="sum-section" style={{ animationDelay: recap && !failed ? (recap.aiRecap ? '320ms' : '240ms') : '0ms', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 10 }}>Takeaway</div>
        {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/lesson-summary.mp3`} />}
        <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>
          {renderMd(lessonSummary, { math: enableMath })}
        </div>
      </div>

      {/* Review Bonus — only if student completed bonus */}
      {recap?.bonusCompleted && onReviewBonus && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button className="stu-btn ghost" onClick={onReviewBonus}>
            Review Bonus →
          </button>
        </div>
      )}
    </div>
  )
}
