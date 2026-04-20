import { useState, useEffect, useCallback } from 'react'
import type { ReadingManifest, ReadingStep } from '../../types/reading'
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

  const classroomState = useTeacherStream(sessionCode)

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

          {/* Primary grid: matrix + speech line */}
          <div className="tch-primary">
            <MatrixCard submitted={submitted} total={total} classroomState={classroomState} />
            <div className="tch-line-wrap">
              <SpeechLine stepIdx={step} />
              <div className="tch-sh" style={{ margin: '2px 0 6px' }}><span className="tch-sh-lb">快捷推送</span></div>
              <div className="tch-quick">
                <button className="tch-qbtn" onClick={() => apiNotify('Myanmar (¶7a): 缅甸的美容实践是长颈族用铜环拉长脖子，象征美丽和身份', 'hint')}>📍 Myanmar 位置提示</button>
                <button className="tch-qbtn" onClick={() => apiNotify('Practice 列要写具体做法，例如 "kohl eye makeup" 而不是 "makeup"', 'hint')}>🎯 Practice 写法示例</button>
                <button className="tch-qbtn" onClick={() => apiNotify('tā moko: 毛利人的传统面部纹身，表示社会地位和家族身份', 'vocab')}>📝 tā moko 生词卡</button>
                <button className="tch-qbtn" onClick={() => apiNotify('再给大家 2 分钟时间完成当前任务', 'time')}>⏱ 再给 2 分钟</button>
              </div>
            </div>
          </div>

          {/* Cue cards */}
          <CueCards />

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

// ── Sub-components ──

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

function MatrixCard({ submitted, total, classroomState }: { submitted: number; total: number; classroomState: ClassroomState | null }) {
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

interface MatrixRow {
  place: string
  para: string
  practice: string
  reason: string
  demo: boolean
  partial?: boolean
  empty?: boolean
}

function buildAggregatedMatrix(state: ClassroomState | null): MatrixRow[] {
  const defaults: MatrixRow[] = [
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

function SpeechLine({ stepIdx }: { stepIdx: number }) {
  const lines: Record<number, React.ReactNode> = {
    0: '"Look at the title — Ideal Beauty. Before reading, what comes to mind?"',
    1: <>&ldquo;Now read only the <span className="k">first sentence</span> of each paragraph. Find the <span className="k">signal words</span>.&rdquo;</>,
    2: <>&ldquo;Good, we now have the <span className="k">skeleton</span>. Let&rsquo;s fill in the <span className="k">flesh</span>. Each group focuses on 2–3 paragraphs and builds a matrix: <span className="k">Place × Practice × Reason</span>.&rdquo;</>,
    3: <>&ldquo;Look at the <span className="k">Reason column</span> in your matrix. Are these really <span className="k">shallow beauty ideals</span>?&rdquo;</>,
    4: <>&ldquo;Let&rsquo;s recap. We used <span className="k">4 strategies</span> today: Predicting, Skimming, Scanning, and Evaluating.&rdquo;</>,
  }

  return (
    <div className="tch-line">
      <div className="tch-line-lb">你的下一句话 · say out loud</div>
      <div className="tch-line-text">{lines[stepIdx] ?? ''}</div>
    </div>
  )
}

function CueCards() {
  return (
    <>
      <div className="tch-sh"><span className="tch-sh-lb">参考要点</span><span className="tch-sh-meta">3 cards</span></div>
      <div className="tch-cues">
        <div className="tch-cue">
          <div className="tch-cue-h"><span className="dot" /> 示范一行</div>
          <div className="tch-cue-body">
            用 <strong>Ancient Egypt (¶3)</strong> 打样：
            <ul className="tch-cue-list">
              <li><span className="q">&ldquo;What did Egyptians do?&rdquo;</span> → kohl makeup</li>
              <li><span className="q">&ldquo;Why?&rdquo;</span> → wealth &amp; status</li>
            </ul>
          </div>
        </div>
        <div className="tch-cue">
          <div className="tch-cue-h warn"><span className="dot" /> 易错点</div>
          <div className="tch-cue-body">
            <strong>¶6 Maori</strong>: Practice 写 &ldquo;tattoos&rdquo; 过泛 → <strong>tā moko</strong>；
            Reason 是 <strong>social position</strong>。<br /><br />
            <strong>¶7</strong>: Myanmar 与 Indonesia 是<strong>两行不同地方</strong>，常被合并。
          </div>
        </div>
        <div className="tch-cue">
          <div className="tch-cue-h"><span className="dot" /> 过渡到 Step 4</div>
          <div className="tch-cue-body">
            回到矩阵整体，指向 <strong>Reason 列</strong>：<br />
            <span className="q">&ldquo;Look at the Reason column. What do you see?&rdquo;</span>
          </div>
        </div>
      </div>
    </>
  )
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
