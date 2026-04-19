import { useState, useEffect } from 'react'
import type { ReadingManifest, ReadingStep } from '../../types/reading'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
}

// Mock queue data (static demo)
interface QueueItem {
  count: number
  question: string
  names: string
  time: string
  priority: 'high' | 'medium' | 'low'
}

const MOCK_QUEUE: QueueItem[] = [
  { count: 8, question: 'Myanmar 在哪里？地理位置不明，影响理解 ¶7。', names: '陈昕 · 赵雪 · 王译 · 李奕 +4', time: '', priority: 'high' },
  { count: 4, question: 'Practice 栏怎样写才算对？能直接写 tattoos 吗？', names: '李奕 · 孙楠 · 徐然 · 郭斐', time: '2m', priority: 'high' },
  { count: 3, question: 'Borneo 的 "diary" 比喻不懂', names: '周航 · 黄婉晴 · 邓梓涵', time: '1m', priority: 'medium' },
  { count: 2, question: 'sharpening teeth 是生词', names: '黄婉晴 · 周航', time: '3m', priority: 'medium' },
  { count: 2, question: 'Reason 列应该写中文还是英文？', names: '曾以柔 · 蔡明轩', time: '4m', priority: 'medium' },
  { count: 1, question: 'metal rings 怎么读？', names: '程一', time: '5m', priority: 'low' },
  { count: 1, question: 'wealth 是什么意思', names: '韩思远', time: '6m', priority: 'low' },
]

const MOCK_STUDENTS = [
  { name: '陈昕妍', status: 'done' as const },
  { name: '李奕辰', status: 'done' as const },
  { name: '王译文', status: 'prog' as const, ai: true },
  { name: '张皓月', status: 'done' as const },
  { name: '刘子墨', status: 'prog' as const },
  { name: '赵雪莉', status: 'idle' as const },
  { name: '孙楠语', status: 'prog' as const, ai: true },
  { name: '周航宇', status: 'done' as const },
  { name: '吴思涵', status: 'prog' as const },
  { name: '郑若曦', status: 'done' as const },
  { name: '黄婉晴', status: 'prog' as const, ai: true },
  { name: '马乐瑶', status: 'done' as const },
]

export default function TeacherShell({ manifest, embed }: Props) {
  const [step, setStep] = useState(2) // default to step 3 (index 2) for demo
  const [ovTab, setOvTab] = useState(0)

  const currentStep = manifest.readingSteps[step]

  // Listen for sync messages from parent
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') setStep(d.step)
    }
    window.addEventListener('message', onMessage)
    try { window.parent?.postMessage({ type: 'ready', role: 'teacher' }, '*') } catch { /* noop */ }
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const submitted = 12
  const total = 42

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--rd-bg)', color: 'var(--rd-t1)', fontVariantNumeric: 'tabular-nums' }}>
      {/* Ambient band */}
      {!embed && (
        <div className="tch-band">
          <div className="tch-band-mark">R</div>
          <div className="tch-band-title">课堂控制台</div>
          <div className="tch-band-class">高一(3)班 · {manifest.title} · {total} 人</div>
          <div className="tch-band-step">
            <span className="lb">Step</span>
            <span className="n">{step + 1}</span>
            <span className="sl">/</span>
            <span className="tot">{manifest.readingSteps.length}</span>
            <span className="sep">·</span>
            <span className="lb">Time</span>
            <span className="n">12:48</span>
            <span className="sl">/</span>
            <span className="tot">45:00</span>
          </div>
        </div>
      )}

      {/* Step rail */}
      <div className="tch-rail">
        {manifest.readingSteps.map((s, i) => (
          <button
            key={s.id}
            className={`tch-rstep${i < step ? ' done' : ''}${i === step ? ' act' : ''}`}
            onClick={() => setStep(i)}
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
            <HeroSection step={currentStep} stepIdx={step} submitted={submitted} total={total} />
          )}

          {/* Primary grid: matrix + speech line */}
          <div className="tch-primary">
            <MatrixCard submitted={submitted} total={total} />
            <div className="tch-line-wrap">
              <SpeechLine stepIdx={step} />
              <div className="tch-sh" style={{ margin: '2px 0 6px' }}><span className="tch-sh-lb">快捷推送</span></div>
              <div className="tch-quick">
                <button className="tch-qbtn">📍 Myanmar 位置提示</button>
                <button className="tch-qbtn">🎯 Practice 写法示例</button>
                <button className="tch-qbtn">📝 tā moko 生词卡</button>
                <button className="tch-qbtn">⏱ 再给 2 分钟</button>
              </div>
            </div>
          </div>

          {/* Cue cards */}
          <CueCards />

          {/* Actions */}
          <div className="tch-actions">
            <button className="tch-btn ghost" onClick={() => step > 0 && setStep(step - 1)}>← 上一步</button>
            <button className="tch-btn">延长 2 min</button>
            <button className="tch-btn">推送提示给全班</button>
            <div style={{ flex: 1 }} />
            <button className="tch-btn pri" onClick={() => step < manifest.readingSteps.length - 1 && setStep(step + 1)}>
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
                {label} <span className="cnt">{i === 0 ? 14 : i === 1 ? 38 : 6}</span>
              </button>
            ))}
          </div>
          <div className="tch-ov-body">
            <PulseStats submitted={submitted} total={total} />
            <QueueFilter />
            <QueueList items={MOCK_QUEUE} />
            <StudentList students={MOCK_STUDENTS} total={total} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

function HeroSection({ step, stepIdx, submitted, total }: { step: ReadingStep; stepIdx: number; submitted: number; total: number }) {
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
            <span className="n">7:23</span><span className="sl">/</span><span className="tot">{step.duration}:00</span>
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

function MatrixCard({ submitted, total }: { submitted: number; total: number }) {
  const rows = [
    { place: 'Ancient Egypt', para: '¶3 · 示范', practice: 'kohl eye makeup', reason: 'wealth & status', demo: true },
    { place: 'Borneo', para: '¶5', practice: 'tattoos as diary', reason: '记录重要事件', demo: false },
    { place: 'NZ Maori', para: '¶6', practice: 'tā moko', reason: 'position in society', demo: false, partial: true },
    { place: 'Myanmar', para: '¶7a', practice: 'wearing metal rings', reason: '— 待填', demo: false, empty: true },
    { place: 'Indonesia', para: '¶7b', practice: '— 待填', reason: '— 待填', demo: false, empty: true },
  ]

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
          {rows.map((r, i) => (
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

function SpeechLine({ stepIdx }: { stepIdx: number }) {
  const lines: Record<number, string> = {
    0: '"Look at the title — Ideal Beauty. Before reading, what comes to mind?"',
    1: '"Now read only the <span class="k">first sentence</span> of each paragraph. Find the <span class="k">signal words</span>."',
    2: '"Good, we now have the <span class="k">skeleton</span>. Let\'s fill in the <span class="k">flesh</span>. Each group focuses on 2–3 paragraphs and builds a matrix: <span class="k">Place × Practice × Reason</span>."',
    3: '"Look at the <span class="k">Reason column</span> in your matrix. Are these really <span class="k">shallow beauty ideals</span>?"',
    4: '"Let\'s recap. We used <span class="k">4 strategies</span> today: Predicting, Skimming, Scanning, and Evaluating."',
  }

  return (
    <div className="tch-line">
      <div className="tch-line-lb">你的下一句话 · say out loud</div>
      <div className="tch-line-text" dangerouslySetInnerHTML={{ __html: lines[stepIdx] || '' }} />
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
  const inProgress = total - submitted - 4
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
        <div className="tch-pulse-n">4</div>
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

function QueueList({ items }: { items: QueueItem[] }) {
  const high = items.filter(i => i.priority === 'high')
  const medium = items.filter(i => i.priority === 'medium')
  const low = items.filter(i => i.priority === 'low')

  return (
    <div className="tch-queue">
      {high.length > 0 && (
        <>
          <div className="tch-q-group-h hi">高优先级 · 影响 ≥ 4 人<span className="tot">{high.length}</span></div>
          {high.map((item, i) => <QueueRow key={`h${i}`} item={item} hi />)}
        </>
      )}
      {medium.length > 0 && (
        <>
          <div className="tch-q-group-h">中优先级 · 影响 2–3 人<span className="tot">{medium.length}</span></div>
          {medium.map((item, i) => <QueueRow key={`m${i}`} item={item} />)}
        </>
      )}
      {low.length > 0 && (
        <>
          <div className="tch-q-group-h">低优先级 · 单人提问<span className="tot">{low.length}</span></div>
          {low.map((item, i) => <QueueRow key={`l${i}`} item={item} />)}
        </>
      )}
    </div>
  )
}

function QueueRow({ item, hi }: { item: QueueItem; hi?: boolean }) {
  return (
    <div className={`tch-qrow${hi ? ' hi' : ''}`}>
      <div className="qn">{item.count}</div>
      <div className="qtext">
        <div className="qq">{item.question}</div>
        <div className="qnames">{item.names}</div>
      </div>
      <div className="qmeta">{item.time && <span>{item.time}</span>}</div>
    </div>
  )
}

function StudentList({ students, total }: { students: typeof MOCK_STUDENTS; total: number }) {
  return (
    <div className="tch-stu-view">
      <div className="tch-stu-h">
        <span className="lb">班级视图</span>
        <span className="total">{total} 人</span>
      </div>
      <div className="tch-stu-list">
        {students.map((s, i) => (
          <div key={i} className={`tch-sl-row${s.status === 'idle' ? ' idle' : ''}`}>
            <span className={`tch-sl-dot ${s.status}`} />
            <span className="tch-sl-name">{s.name}</span>
            {s.ai && <span className="tch-sl-ai" />}
          </div>
        ))}
      </div>
    </div>
  )
}
