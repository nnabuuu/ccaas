import { useState, useEffect, useCallback } from 'react'
import type { ReadingManifest, ReadingStep, TeacherQuickAction, TeacherCueCard, TeacherView } from '../../types/reading'
import { useTeacherStream, type ClassroomState } from '../../hooks/useClassroom'

const API_BASE = 'http://localhost:3007/api/classroom'

interface Props {
  manifest: ReadingManifest
  lessonId: string
  sessionCode: string
  embed?: boolean
}

export default function TeacherShell({ manifest, lessonId, sessionCode, embed }: Props) {
  const [step, setStep] = useState(0)
  const [ovTab, setOvTab] = useState(0)

  const { state: classroomState, activeNotificationIds } = useTeacherStream(sessionCode)

  const currentStep = manifest.readingSteps[step]

  // Derive metrics from live data (fallback to 0 when no stream yet)
  const total = classroomState?.metrics.total ?? 0
  const submitted = classroomState?.metrics.submitted ?? 0

  // ── Timer state ──
  const [stepStartedAt, setStepStartedAt] = useState(Date.now())
  const [extraMinutes, setExtraMinutes] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  // Reset timer when step changes
  useEffect(() => {
    setStepStartedAt(Date.now())
    setExtraMinutes(0)
  }, [step])

  // Countdown interval
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stepStartedAt) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [stepStartedAt])

  const stepDuration = currentStep?.duration ?? 0
  const totalSeconds = (stepDuration + extraMinutes) * 60
  const remaining = Math.max(0, totalSeconds - elapsed)
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  // ── API calls ──
  const apiSetStep = useCallback(async (newStep: number) => {
    setStep(newStep)
    try {
      await fetch(`${API_BASE}/${sessionCode}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: newStep }),
      })
    } catch { /* noop */ }
  }, [sessionCode])

  const apiNotify = useCallback(async (message: string, type: string) => {
    try {
      await fetch(`${API_BASE}/${sessionCode}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, type }),
      })
    } catch { /* noop */ }
  }, [sessionCode])

  // Listen for sync messages from parent
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') apiSetStep(d.step)
    }
    window.addEventListener('message', onMessage)
    try { window.parent?.postMessage({ type: 'ready', role: 'teacher' }, window.location.origin) } catch { /* noop */ }
    return () => window.removeEventListener('message', onMessage)
  }, [apiSetStep])

  const tv = currentStep?.teacherView

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>
      {/* Ambient band */}
      {!embed && (
        <div className="tch-band">
          <div className="tch-band-mark">R</div>
          <div className="tch-band-title">课堂控制台</div>
          <div className="tch-band-class">高一(3)班 · {manifest.title} · {total} 人</div>
          <div className="session-code">{sessionCode}</div>
          <div className="tch-band-step">
            <span className="lb">Step</span>
            <span className="n">{step + 1}</span>
            <span className="sl">/</span>
            <span className="tot">{manifest.readingSteps.length}</span>
            <span className="sep">·</span>
            <span className="lb">Time</span>
            <span className="n">{mm}:{ss}</span>
            <span className="sl">/</span>
            <span className="tot">{String(stepDuration).padStart(2, '0')}:00</span>
          </div>
        </div>
      )}

      {/* Step rail */}
      <div className="tch-rail">
        {manifest.readingSteps.map((s, i) => (
          <button
            key={s.id}
            className={`tch-rstep${i < step ? ' done' : ''}${i === step ? ' act' : ''}`}
            onClick={() => apiSetStep(i)}
          >
            <div className="rn">{i + 1}</div>
            {s.label}
            <div className="rt">{s.duration}&apos;</div>
          </button>
        ))}
      </div>

      <div className="tch-body">
        {/* ── Focus column ── */}
        <div className="tch-focus">
          {/* Hero */}
          {currentStep && (
            <HeroSection step={currentStep} stepIdx={step} submitted={submitted} total={total} timerDisplay={`${mm}:${ss}`} />
          )}

          {/* Primary grid: focus panel + speech line */}
          <div className="tch-primary">
            {tv && (
              <FocusPanel
                focusType={tv.focusType}
                focusTitle={tv.focusTitle}
                focusSubtitle={tv.focusSubtitle}
                manifest={manifest}
                currentStep={currentStep}
                classroomState={classroomState}
                submitted={submitted}
                total={total}
              />
            )}
            <div className="tch-line-wrap">
              {tv && <StepSpeechLine text={tv.speechLine} />}
              <div className="tch-sh" style={{ margin: '2px 0 6px' }}><span className="tch-sh-lb">快捷推送</span></div>
              {tv && <StepQuickActions actions={tv.quickActions} onNotify={apiNotify} activeNotificationIds={activeNotificationIds} />}
            </div>
          </div>

          {/* Cue cards */}
          {tv && <StepCueCards cards={tv.cueCards} />}

          {/* Actions */}
          <div className="tch-actions">
            <button className="tch-btn ghost" onClick={() => step > 0 && apiSetStep(step - 1)}>← 上一步</button>
            <button className="tch-btn" onClick={() => setExtraMinutes(m => m + 2)}>延长 2 min</button>
            <button className="tch-btn" onClick={() => apiNotify(`Step ${step + 1} 提示: ${currentStep?.description || ''}`, 'general')}>推送提示给全班</button>
            <div style={{ flex: 1 }} />
            <button className="tch-btn pri" onClick={() => step < manifest.readingSteps.length - 1 && apiSetStep(step + 1)}>
              进入 Step {step + 2} →
            </button>
          </div>
        </div>

        {/* ── Overview column ── */}
        <div className="tch-overview">
          <div className="tch-ov-tabs">
            {['待处理', '全部对话', '已解决'].map((label, i) => (
              <button
                key={i}
                className={`tch-ov-tab${ovTab === i ? ' act' : ''}`}
                onClick={() => setOvTab(i)}
              >
                {label} <span className="cnt">0</span>
              </button>
            ))}
          </div>
          <div className="tch-ov-body">
            <PulseStats submitted={submitted} total={total} />
            <QueueFilter />
            <QueueList />
            <StudentList classroomState={classroomState} total={total} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Step-aware sub-components ──

function parseBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <span key={i} className="k">{part.slice(2, -2)}</span>
    }
    return part
  })
}

function StepSpeechLine({ text }: { text: string }) {
  return (
    <div className="tch-line">
      <div className="tch-line-lb">你的下一句话 · say out loud</div>
      <div className="tch-line-text">&ldquo;{parseBold(text)}&rdquo;</div>
    </div>
  )
}

function StepQuickActions({ actions, onNotify, activeNotificationIds }: { actions: TeacherQuickAction[]; onNotify: (msg: string, type: string) => void; activeNotificationIds: Set<string> }) {
  return (
    <div className="tch-quick">
      {actions.map((a, i) => {
        const id = `${a.type}::${a.message}`
        const isPushed = activeNotificationIds.has(id)
        return (
          <button key={i} className={`tch-qbtn${isPushed ? ' pushed' : ''}`} onClick={() => onNotify(a.message, a.type)}>
            {isPushed ? '✓' : a.emoji} {isPushed ? '已推送' : a.label}
          </button>
        )
      })}
    </div>
  )
}

function StepCueCards({ cards }: { cards: TeacherCueCard[] }) {
  return (
    <>
      <div className="tch-sh"><span className="tch-sh-lb">参考要点</span><span className="tch-sh-meta">{cards.length} cards</span></div>
      <div className="tch-cues">
        {cards.map((card, i) => (
          <div key={i} className="tch-cue">
            <div className={`tch-cue-h${card.warn ? ' warn' : ''}`}><span className="dot" /> {card.title}</div>
            <div className="tch-cue-body" style={{ whiteSpace: 'pre-line' }}>{card.body}</div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Focus Panel (switches on focusType) ──

interface FocusPanelProps {
  focusType: TeacherView['focusType']
  focusTitle: string
  focusSubtitle?: string
  manifest: ReadingManifest
  currentStep: ReadingStep
  classroomState: ClassroomState | null
  submitted: number
  total: number
}

function FocusPanel({ focusType, focusTitle, focusSubtitle, manifest, currentStep, classroomState, submitted, total }: FocusPanelProps) {
  switch (focusType) {
    case 'article-excerpt':
      return <ArticleExcerptPanel manifest={manifest} step={currentStep} title={focusTitle} subtitle={focusSubtitle} />
    case 'signal-words':
      return <SignalWordsPanel manifest={manifest} title={focusTitle} subtitle={focusSubtitle} />
    case 'matrix':
      return <MatrixPanel submitted={submitted} total={total} classroomState={classroomState} />
    case 'rubric':
      return <RubricPanel title={focusTitle} subtitle={focusSubtitle} />
    case 'strategy-recap':
      return <StrategyRecapPanel manifest={manifest} title={focusTitle} subtitle={focusSubtitle} />
  }
}

// ── Focus Panel variants ──

function ArticleExcerptPanel({ manifest, step, title, subtitle }: { manifest: ReadingManifest; step: ReadingStep; title: string; subtitle?: string }) {
  const paragraphs = manifest.article.paragraphs.filter(p => step.focusParagraphs.includes(p.id))

  return (
    <div className="tch-mat-card">
      <div className="tch-mat-head">
        <span className="lb">{title}</span>
        {subtitle && <span className="ti">{subtitle}</span>}
      </div>
      <div style={{ padding: '8px 12px', fontSize: 13, lineHeight: 1.7 }}>
        {paragraphs.map(p => (
          <div key={p.id} style={{ marginBottom: 10 }}>
            <span style={{ color: 'var(--t3)', fontSize: 11, marginRight: 6 }}>{p.id}</span>
            {renderHighlightedText(p.text, p.highlights)}
          </div>
        ))}
      </div>
    </div>
  )
}

function renderHighlightedText(text: string, highlights?: string[]): React.ReactNode {
  if (!highlights || highlights.length === 0) return text
  let result: React.ReactNode[] = [text]
  for (const hl of highlights) {
    const next: React.ReactNode[] = []
    for (const part of result) {
      if (typeof part !== 'string') { next.push(part); continue }
      const idx = part.indexOf(hl)
      if (idx === -1) { next.push(part); continue }
      if (idx > 0) next.push(part.slice(0, idx))
      next.push(<mark key={hl} style={{ background: 'var(--ac, #ffe066)', borderRadius: 2, padding: '0 2px' }}>{hl}</mark>)
      if (idx + hl.length < part.length) next.push(part.slice(idx + hl.length))
    }
    result = next
  }
  return result
}

function SignalWordsPanel({ manifest, title, subtitle }: { manifest: ReadingManifest; title: string; subtitle?: string }) {
  const allSignals: { word: string; paraId: string }[] = []
  for (const p of manifest.article.paragraphs) {
    if (p.signals) {
      for (const s of p.signals) {
        allSignals.push({ word: s, paraId: p.id })
      }
    }
  }

  const structureSteps = [
    { label: 'Phenomenon', sub: '¶1-2', color: 'var(--cool, #7eb8da)' },
    { label: 'History', sub: '¶3-4', color: 'var(--warm, #e8a87c)' },
    { label: 'Culture', sub: '¶5-7', color: 'var(--ac, #c3aed6)' },
    { label: 'Conclusion', sub: '¶8', color: 'var(--ok, #81c784)' },
  ]

  return (
    <div className="tch-mat-card">
      <div className="tch-mat-head">
        <span className="lb">{title}</span>
        {subtitle && <span className="ti">{subtitle}</span>}
      </div>
      <div style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {allSignals.map((s, i) => (
            <span key={i} style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 12, background: 'var(--s2, #f0f0f0)', fontSize: 12, fontWeight: 500 }}>
              {s.word} <span style={{ color: 'var(--t3)', fontSize: 10, marginLeft: 4 }}>{s.paraId}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {structureSteps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: '6px 12px', borderRadius: 8, background: s.color, color: '#fff', fontSize: 12, fontWeight: 600, textAlign: 'center', minWidth: 70 }}>
                <div>{s.label}</div>
                <div style={{ fontSize: 10, opacity: 0.85, fontWeight: 400 }}>{s.sub}</div>
              </div>
              {i < structureSteps.length - 1 && (
                <span style={{ margin: '0 4px', color: 'var(--t3)', fontSize: 14 }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MatrixPanel({ submitted, total, classroomState }: { submitted: number; total: number; classroomState: ClassroomState | null }) {
  const matrixRows = buildAggregatedMatrix(classroomState)

  return (
    <div className="tch-mat-card">
      <div className="tch-mat-head">
        <span className="lb">Class matrix</span>
        <span className="ti">Ideas about physical beauty</span>
        <span className="meta">live · {submitted} / {total} 提交</span>
      </div>
      <table className="tch-matrix">
        <thead>
          <tr>
            <th style={{ width: '24%' }}>Place</th>
            <th style={{ width: '32%' }}>Practice</th>
            <th style={{ width: '44%' }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {matrixRows.map((r, i) => (
            <tr key={i} className={r.demo ? 'demo-row' : ''}>
              <td className="place">
                {r.place}
                <span className="para">{r.para}</span>
              </td>
              <td className={r.empty ? 'empty-cell' : r.partial ? 'partial-cell' : ''}>
                {r.practice}
                {r.demo && <span className="tch-matrix demo-tag">MODEL</span>}
              </td>
              <td className={r.empty ? 'empty-cell' : r.partial ? 'partial-cell' : ''}>
                {r.reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RubricPanel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="tch-mat-card">
      <div className="tch-mat-head">
        <span className="lb">{title}</span>
        {subtitle && <span className="ti">{subtitle}</span>}
      </div>
      <div style={{ padding: '8px 12px', fontSize: 13, lineHeight: 1.7 }}>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>评分标准</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
            <li>立场清晰 (agree / disagree / partly agree)</li>
            <li>引用 ≥ 2 条矩阵事实作为证据</li>
            <li>用 First / Second / Therefore 组织段落</li>
          </ol>
        </div>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--t2)', marginBottom: 4 }}>议论段模板</div>
          <div style={{ padding: '8px 10px', background: 'var(--s2, #f5f5f5)', borderRadius: 6, fontSize: 12, fontFamily: 'var(--mono, monospace)', lineHeight: 1.6 }}>
            I [agree/disagree] that beauty ideals are shallow.<br />
            First, in [Place], [Practice] because [Reason].<br />
            Second, in [Place], [Practice] because [Reason].<br />
            Therefore, beauty is [not] shallow.
          </div>
        </div>
      </div>
    </div>
  )
}

function StrategyRecapPanel({ manifest, title, subtitle }: { manifest: ReadingManifest; title: string; subtitle?: string }) {
  const strategies = [
    { num: '1', label: 'Predict', sub: '激活图式' },
    { num: '2', label: 'Skim', sub: '抓骨架' },
    { num: '3', label: 'Scan', sub: '填矩阵' },
    { num: '4', label: 'Evaluate', sub: '批判质疑' },
  ]

  const p8 = manifest.article.paragraphs.find(p => p.id === 'p8')

  return (
    <div className="tch-mat-card">
      <div className="tch-mat-head">
        <span className="lb">{title}</span>
        {subtitle && <span className="ti">{subtitle}</span>}
      </div>
      <div style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 12 }}>
          {strategies.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: '6px 14px', borderRadius: 8, background: 'var(--ac, #e8d5b7)', fontSize: 12, fontWeight: 600, textAlign: 'center', minWidth: 60 }}>
                <div style={{ fontSize: 10, opacity: 0.7 }}>Step {s.num}</div>
                <div>{s.label}</div>
                <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{s.sub}</div>
              </div>
              {i < strategies.length - 1 && (
                <span style={{ margin: '0 4px', color: 'var(--t3)', fontSize: 14 }}>→</span>
              )}
            </div>
          ))}
        </div>
        {p8 && (
          <div style={{ padding: '8px 10px', background: 'var(--s2, #f5f5f5)', borderRadius: 6, fontSize: 12, lineHeight: 1.6, borderLeft: '3px solid var(--ac, #c3aed6)' }}>
            <span style={{ color: 'var(--t3)', fontSize: 10 }}>¶8</span>{' '}
            {renderHighlightedText(p8.text, p8.highlights)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Unchanged sub-components ──

function HeroSection({ step, stepIdx, submitted, total, timerDisplay }: { step: ReadingStep; stepIdx: number; submitted: number; total: number; timerDisplay: string }) {
  return (
    <div className="tch-hero">
      <div className="tch-hero-main">
        <div className="tch-hero-eyebrow">
          <span className="pill">STEP {stepIdx + 1}</span>
          现在进行中 · {step.description}
        </div>
        <div className="tch-hero-title">
          {step.label}<span className="en">{step.labelEn}</span>
        </div>
        <div className="tch-hero-brief">{step.description}</div>
      </div>
      <div className="tch-hero-side">
        <div className="tch-hs-pair">
          <span className="tch-hs-lb">Step time</span>
          <span className="tch-hs-v">
            <span className="n">{timerDisplay}</span><span className="sl">/</span><span className="tot">{String(step.duration).padStart(2, '0')}:00</span>
          </span>
        </div>
        <div className="tch-hs-pair">
          <span className="tch-hs-lb">Submitted</span>
          <span className="tch-hs-v">
            <span className="n">{submitted}</span><span className="sl">/</span><span className="tot">{total}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

interface AggMatrixRow {
  place: string
  para: string
  practice: string
  reason: string
  demo: boolean
  partial?: boolean
  empty?: boolean
}

function buildAggregatedMatrix(state: ClassroomState | null): AggMatrixRow[] {
  const defaults: AggMatrixRow[] = [
    { place: 'Ancient Egypt', para: '¶3 · 示范', practice: 'kohl eye makeup', reason: 'wealth & status', demo: true },
    { place: 'Borneo', para: '¶5', practice: '— 待填', reason: '— 待填', demo: false, empty: true },
    { place: 'NZ Maori', para: '¶6', practice: '— 待填', reason: '— 待填', demo: false, empty: true },
    { place: 'Myanmar', para: '¶7a', practice: '— 待填', reason: '— 待填', demo: false, empty: true },
    { place: 'Indonesia', para: '¶7b', practice: '— 待填', reason: '— 待填', demo: false, empty: true },
  ]

  if (!state || state.students.length === 0) return defaults

  const places = ['Borneo', 'NZ Maori', 'Myanmar', 'Indonesia']
  const aggregated: Record<string, { practice: string; reason: string }> = {}

  for (const student of state.students) {
    const sub = student.submissions[2]
    if (!sub?.data?.matrix) continue
    for (const place of places) {
      const entry = sub.data.matrix[place]
      if (!entry) continue
      if (!aggregated[place] && (entry.practice || entry.reason)) {
        aggregated[place] = { practice: entry.practice || '', reason: entry.reason || '' }
      }
    }
  }

  return defaults.map(row => {
    if (row.demo) return row
    const data = aggregated[row.place]
    if (!data) return row
    const hasPractice = !!data.practice
    const hasReason = !!data.reason
    return {
      ...row,
      practice: hasPractice ? data.practice : '— 待填',
      reason: hasReason ? data.reason : '— 待填',
      empty: !hasPractice && !hasReason,
      partial: (hasPractice && !hasReason) || (!hasPractice && hasReason),
    }
  })
}

function PulseStats({ submitted, total }: { submitted: number; total: number }) {
  const inProgress = Math.max(0, total - submitted)
  return (
    <div className="tch-pulse">
      <div className="tch-pulse-cell">
        <div className="tch-pulse-n">{submitted}</div>
        <div className="tch-pulse-row"><span className="tch-pulse-dot done" /><span className="tch-pulse-lb">已提交</span></div>
      </div>
      <div className="tch-pulse-cell">
        <div className="tch-pulse-n">{inProgress}</div>
        <div className="tch-pulse-row"><span className="tch-pulse-dot prog" /><span className="tch-pulse-lb">填写中</span></div>
      </div>
      <div className="tch-pulse-cell">
        <div className="tch-pulse-n">0</div>
        <div className="tch-pulse-row"><span className="tch-pulse-dot idle" /><span className="tch-pulse-lb">未开始</span></div>
      </div>
    </div>
  )
}

function QueueFilter() {
  return (
    <div className="tch-q-filter">
      <input className="tch-q-search" placeholder="搜索聚类 / 学生姓名..." />
      <button className="tch-q-chip act">按影响</button>
      <button className="tch-q-chip">按时间</button>
      <button className="tch-q-chip">仅高频</button>
    </div>
  )
}

function QueueList() {
  return (
    <div className="tch-queue">
      <div className="tch-q-group-h" style={{ color: 'var(--t3)', fontStyle: 'italic' }}>
        暂无学生提问
      </div>
    </div>
  )
}

interface StudentListProps {
  classroomState: ClassroomState | null
  total: number
}

function StudentList({ classroomState, total }: StudentListProps) {
  const students = classroomState?.students ?? []

  return (
    <div className="tch-stu-view">
      <div className="tch-stu-h">
        <span className="lb">班级视图</span>
        <span className="total">{total} 人</span>
      </div>
      <div className="tch-stu-list">
        {students.length === 0 && (
          <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--t3)', fontStyle: 'italic' }}>
            等待学生加入...
          </div>
        )}
        {students.map((s) => {
          const hasSubmissions = Object.keys(s.submissions).length > 0
          const status = hasSubmissions ? 'done' : 'prog'
          return (
            <div key={s.id} className="tch-sl-row">
              <span className={`tch-sl-dot ${status}`} />
              <span className="tch-sl-name">{s.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
