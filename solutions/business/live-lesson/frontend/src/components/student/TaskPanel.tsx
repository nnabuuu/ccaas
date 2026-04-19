import { useState, useCallback } from 'react'
import type { ReadingStep } from '../../types/reading'

interface Props {
  step: ReadingStep
  stepIdx: number
  onJumpTo: (paraId: string) => void
}

export default function TaskPanel({ step, stepIdx, onJumpTo }: Props) {
  switch (stepIdx) {
    case 0: return <Step1Task step={step} onJumpTo={onJumpTo} />
    case 1: return <Step2Task step={step} onJumpTo={onJumpTo} />
    case 2: return <Step3Task step={step} onJumpTo={onJumpTo} />
    case 3: return <Step4Task step={step} onJumpTo={onJumpTo} />
    case 4: return <Step5Task step={step} />
    default: return <div className="stu-card">Unknown step</div>
  }
}

// ── Step 1: Schema Activation ──
function Step1Task({ step, onJumpTo }: { step: ReadingStep; onJumpTo: (id: string) => void }) {
  const [submitted, setSubmitted] = useState(false)
  return (
    <div>
      <div className="stu-step-hd"><span className="stu-step-label">Step 1 · {step.label}</span></div>
      <div className="stu-step-title">{step.labelEn || 'Ideal Beauty'}</div>
      <div className="stu-step-sub">
        扫读{' '}
        <button className="stu-pref" onClick={() => onJumpTo('p1')}>¶1-2</button>
        ，找核心冲突。
      </div>
      <div className="stu-card">
        <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>1. What is Happiness Edem's aim?</div>
        <input className="stu-input" placeholder="Keywords..." />
        <div style={{ fontSize: 11, fontWeight: 500, margin: '10px 0 4px' }}>2. What does modern media promote?</div>
        <input className="stu-input" placeholder="Keywords..." />
      </div>
      <button
        className={`stu-btn ${submitted ? 'done' : 'pri'}`}
        onClick={() => setSubmitted(true)}
        disabled={submitted}
      >
        {submitted ? '✓ 已提交' : '提交'}
      </button>
    </div>
  )
}

// ── Step 2: Structure Decode ──
function Step2Task({ step, onJumpTo }: { step: ReadingStep; onJumpTo: (id: string) => void }) {
  const [selections, setSelections] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)

  const items = [
    { paraRef: 'p3', paraLabel: '¶3-4', quote: 'Ideas about beauty change over time and different periods of history had their own idea.', signal: 'change over time', options: ['History', 'Culture', 'Conclusion'] },
    { paraRef: 'p5', paraLabel: '¶5-7', quote: 'Within different cultures around the world, we can find diverse ideas about physical beauty.', signal: 'around the world', options: ['History', 'Culture', 'Conclusion'] },
    { paraRef: 'p8', paraLabel: '¶8', quote: 'It appears that people change their appearance to tell the world about their culture.', signal: 'It appears that', options: ['History', 'Culture', 'Conclusion'] },
  ]

  const pick = useCallback((cardIdx: number, option: string) => {
    if (submitted) return
    setSelections(prev => ({ ...prev, [cardIdx]: option }))
  }, [submitted])

  const allPicked = items.every((_, i) => selections[i])

  return (
    <div>
      <div className="stu-step-hd"><span className="stu-step-label">Step 2 · {step.label} · {step.duration} min</span></div>
      <div className="stu-step-title">读首句，找骨架</div>
      <div className="stu-step-sub">
        读{' '}
        <button className="stu-pref" onClick={() => onJumpTo('p3')}>¶3-8</button>
        {' '}首句，判断结构
      </div>
      <div className="stu-match-grid">
        {items.map((item, i) => (
          <div key={i} className={`stu-mc${selections[i] ? ' assigned' : ''}`}>
            <div className="stu-mc-hd">
              <button className="stu-mc-para" onClick={() => onJumpTo(item.paraRef)}>{item.paraLabel}</button>
              <span className="stu-mc-arrow">—</span>
              <div className="stu-mc-quote">
                &ldquo;{renderQuoteSignal(item.quote, item.signal)}&rdquo;
              </div>
            </div>
            <div className="stu-mc-opts">
              {item.options.map(opt => (
                <button
                  key={opt}
                  className={`stu-mo${selections[i] === opt ? ' selected' : ''}`}
                  onClick={() => pick(i, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button
        className={`stu-btn ${submitted ? 'done' : 'pri'}`}
        onClick={() => allPicked && setSubmitted(true)}
        disabled={submitted || !allPicked}
      >
        {submitted ? '✓ 已提交' : '提交'}
      </button>
    </div>
  )
}

// ── Step 3: Matrix Building ──
function Step3Task({ step, onJumpTo }: { step: ReadingStep; onJumpTo: (id: string) => void }) {
  const [submitted, setSubmitted] = useState(false)

  const rows = [
    { place: 'Ancient Egypt', demo: true, practice: 'Eye makeup', reason: 'Status' },
    { place: 'Borneo', demo: false },
    { place: 'NZ Maori', demo: false },
    { place: 'Myanmar', demo: false },
    { place: 'Indonesia', demo: false },
  ]

  return (
    <div>
      <div className="stu-step-hd"><span className="stu-step-label">Step 3 · {step.label} · {step.duration} min</span></div>
      <div className="stu-step-title">Build Your Matrix</div>
      <div className="stu-step-sub">
        你是 <strong>Group B</strong>. Scanning{' '}
        <button className="stu-pref" onClick={() => onJumpTo('p5')}>¶5-7</button>
        {' '}填矩阵。
      </div>
      <div className="stu-card" style={{ padding: 12, overflowX: 'auto' }}>
        <table className="stu-matrix">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Place</th>
              <th style={{ width: '38%' }}>Practice</th>
              <th style={{ width: '40%' }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={r.demo ? 'demo-row' : ''}>
                <td className="place">
                  {r.place}
                  {r.demo && <span className="demo-label">示范</span>}
                </td>
                <td>{r.demo ? r.practice : <input placeholder="What?" />}</td>
                <td>{r.demo ? r.reason : <input placeholder="Why?" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stu-pattern">
        句型: &ldquo;In <strong>[Place]</strong>, people like <strong>[Practice]</strong> because it means <strong>[Reason]</strong>.&rdquo;
      </div>
      <button
        className={`stu-btn ${submitted ? 'done' : 'pri'}`}
        onClick={() => setSubmitted(true)}
        disabled={submitted}
      >
        {submitted ? '✓ 已提交' : '提交矩阵表'}
      </button>
    </div>
  )
}

// ── Step 4: Critical Thinking ──
function Step4Task({ step, onJumpTo }: { step: ReadingStep; onJumpTo: (id: string) => void }) {
  const [submitted, setSubmitted] = useState(false)
  void onJumpTo // available for future use
  return (
    <div>
      <div className="stu-step-hd"><span className="stu-step-label">Step 4 · {step.label} · {step.duration} min</span></div>
      <div className="stu-step-title">Challenge the Media</div>
      <div className="stu-step-sub">&ldquo;shallow beauty ideals&rdquo; — 你同意吗？引用 Matrix 的至少 2 条事实。</div>
      <textarea
        className="stu-textarea"
        placeholder={'I agree / disagree that...\nFirst, in [Place]...\nSecond...'}
      />
      <button
        className={`stu-btn ${submitted ? 'done' : 'pri'}`}
        style={{ marginTop: 8 }}
        onClick={() => setSubmitted(true)}
        disabled={submitted}
      >
        {submitted ? '✓ 已提交' : '提交观点'}
      </button>
    </div>
  )
}

// ── Step 5: Review ──
function Step5Task({ step }: { step: ReadingStep }) {
  void step
  return (
    <div>
      <div className="stu-step-hd"><span className="stu-step-label">Step 5 · 复盘</span></div>
      <div className="stu-step-title">4 Strategies</div>
      <div className="stu-card">
        <div style={{ fontSize: 14, lineHeight: 2.2, color: 'var(--rd-t2)' }}>
          <strong style={{ color: 'var(--rd-t1)' }}>1.</strong> Predicting →{' '}
          <strong style={{ color: 'var(--rd-t1)' }}>2.</strong> Skimming →{' '}
          <strong style={{ color: 'var(--rd-t1)' }}>3.</strong> Scanning + Matrix →{' '}
          <strong style={{ color: 'var(--rd-t1)' }}>4.</strong> Evaluating
        </div>
      </div>
      <div className="stu-card" style={{ background: 'var(--rd-green-bg)', borderColor: 'rgba(45,102,18,.15)' }}>
        <div style={{ color: 'var(--rd-green)', fontSize: 12, lineHeight: 1.6 }}>
          <strong>HW:</strong> &ldquo;Beyond the Plate&rdquo; — structure map + matrix.
        </div>
      </div>
    </div>
  )
}

function renderQuoteSignal(text: string, signal: string) {
  const idx = text.indexOf(signal)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="sig">{signal}</span>
      {text.slice(idx + signal.length)}
    </>
  )
}
