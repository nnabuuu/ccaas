import { useState, useEffect, useContext } from 'react'
import { useT, LocaleScope, type Locale } from '../../../i18n'
import { SessionCtx } from '../TaskPanel'

interface StrategyResult {
  task: number
  strategy: string
  score: number
  attempts: number
}

interface PersonalTouchData {
  strategies: StrategyResult[]
  tier: { label: string; labelEn: string; tone: string }
  aiComment: string
  bonusUnlocked: boolean
}

const STRATEGY_EMOJIS: Record<string, string> = {
  Predicting: '🔮',
  Skimming: '👁',
  Scanning: '🎯',
  Evaluating: '⚖️',
}

function scoreColor(score: number): string {
  if (score >= 85) return 'var(--green)'
  if (score >= 60) return 'var(--teal)'
  return 'var(--t3)'
}

function tierBorderColor(tone: string): string {
  if (tone === 'gold') return '#d4a017'
  if (tone === 'blue') return 'var(--teal)'
  return 'var(--t3)'
}

export function PersonalTouchScreen({ onContinue, locale }: {
  onContinue: (bonusUnlocked: boolean) => void
  locale?: Locale
}) {
  const t = useT(locale)
  const ctx = useContext(SessionCtx)
  const [data, setData] = useState<PersonalTouchData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ctx.sessionCode || !ctx.studentId) return
    fetch(`/api/classroom/${ctx.sessionCode}/personal-touch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: ctx.studentId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [ctx.sessionCode, ctx.studentId])

  if (loading) {
    return (
      <LocaleScope locale={locale}>
      <div className="stu-task-inner" style={{ paddingTop: 32 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{t('personalTouch.loading')}</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ width: 72, height: 80, borderRadius: 12, background: 'var(--bg2)', animation: 'pulse 1.2s ease-in-out infinite' }} />
          ))}
        </div>
        <div style={{ height: 80, borderRadius: 12, background: 'var(--bg2)', animation: 'pulse 1.2s ease-in-out infinite' }} />
      </div>
      </LocaleScope>
    )
  }

  if (!data) {
    return (
      <LocaleScope locale={locale}>
      <div className="stu-task-inner" style={{ paddingTop: 32 }}>
        <p style={{ color: 'var(--t3)' }}>{t('personalTouch.loadError')}</p>
        <button className="stu-btn pri" onClick={() => onContinue(false)}>{t('personalTouch.continue')}</button>
      </div>
      </LocaleScope>
    )
  }

  return (
    <LocaleScope locale={locale}>
    <div className="stu-task-inner" style={{ paddingTop: 32 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{t('personalTouch.complete')}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', lineHeight: 1.3, marginBottom: 20, color: 'var(--t1)' }}>
        {t('personalTouch.title')}
      </div>

      {/* Strategy cards */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {data.strategies.map(s => (
          <div key={s.task} style={{
            flex: '1 1 60px',
            minWidth: 64,
            padding: '12px 8px',
            borderRadius: 12,
            border: `2px solid ${scoreColor(s.score)}`,
            textAlign: 'center',
            background: 'var(--bg1)',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{STRATEGY_EMOJIS[s.strategy] || '📖'}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: scoreColor(s.score) }}>{s.score}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{s.strategy}</div>
          </div>
        ))}
      </div>

      {/* Tier badge + AI comment */}
      <div style={{
        padding: '16px 18px',
        borderRadius: 12,
        border: `2px solid ${tierBorderColor(data.tier.tone)}`,
        background: 'var(--bg1)',
        marginBottom: 24,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: tierBorderColor(data.tier.tone),
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span>{data.tier.tone === 'gold' ? '⭐' : data.tier.tone === 'blue' ? '💪' : '📚'}</span>
          <span>{data.tier.labelEn}</span>
          <span style={{ fontWeight: 400, color: 'var(--t3)' }}>— {data.tier.label}</span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--t1)' }}>
          {data.aiComment}
        </div>
      </div>

      <button className="stu-btn pri" onClick={() => onContinue(data.bonusUnlocked)}>
        {t('personalTouch.continue')}
      </button>
    </div>
    </LocaleScope>
  )
}
