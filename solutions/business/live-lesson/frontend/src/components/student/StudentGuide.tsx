import { useState, useEffect } from 'react'
import type { ReadingManifest } from '../../types/reading'

/* ── Reading strategy one-liner explanations ── */

const strategyDesc: Record<string, string> = {
  Predict: '看标题猜内容',
  Skim: '抓首句理骨架',
  Scan: '找证据填表格',
  Evaluate: '用证据写观点',
  Synthesizing: '整合多源信息',
  Orientation: '了解学习目标',
}

/* ── SVG Illustrations (from student-guide.html design) ── */

function TaskAreaSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="16" y="8" width="248" height="26" rx="8" fill="#fbfaf7"/>
      <rect x="16" y="28" width="248" height="6" fill="#fbfaf7"/>
      <text x="30" y="26" fontFamily="Plus Jakarta Sans" fontSize="9" fontWeight="700" fill="#1c1c1a">Task 1</text>
      <line x1="16" y1="34" x2="264" y2="34" stroke="#e4e2d8" strokeWidth=".5"/>
      <rect x="24" y="40" width="240" height="18" rx="4" fill="#edece7"/>
      <rect x="26" y="42" width="54" height="14" rx="3" fill="#1a6e5e"/>
      <text x="53" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#fff" textAnchor="middle">Listen</text>
      <text x="112" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">Practice</text>
      <text x="172" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">Discuss</text>
      <text x="232" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">Takeaway</text>
      <rect x="30" y="68" width="224" height="32" rx="6" fill="#edece7"/>
      <text x="142" y="87" fontFamily="Plus Jakarta Sans" fontSize="8" fill="#5c5b56" textAnchor="middle">Read carefully, then click below</text>
      <rect x="30" y="108" width="80" height="22" rx="6" fill="#1c1c1a"/>
      <text x="70" y="122" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="700" fill="#fff" textAnchor="middle">I understand</text>
    </svg>
  )
}

function TextPanelSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="130" height="140" rx="8" fill="#edece7" stroke="#e4e2d8"/>
      <rect x="28" y="28" width="106" height="6" rx="2" fill="#d8d6d0"/>
      <rect x="28" y="40" width="88" height="6" rx="2" fill="#d8d6d0"/>
      <rect x="28" y="52" width="96" height="6" rx="2" fill="#d8d6d0"/>
      <rect x="28" y="64" width="80" height="6" rx="2" fill="#d8d6d0"/>
      <rect x="150" y="8" width="28" height="140" rx="0" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="157" y="58" width="14" height="36" rx="4" fill="#dbeafe" stroke="#1a5fb4" strokeWidth=".8"/>
      <text x="164" y="81" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="800" fill="#1a5fb4" textAnchor="middle">T</text>
      <path d="M182 78 L198 78" stroke="#1a5fb4" strokeWidth="1.5" strokeDasharray="4,3"/>
      <polygon points="198,75 204,78 198,81" fill="#1a5fb4"/>
      <rect x="208" y="8" width="58" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="216" y="22" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#1c1c1a">Text</text>
      <text x="258" y="22" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#9c9a92" textAnchor="end">&times;</text>
      <line x1="208" y1="28" x2="266" y2="28" stroke="#e4e2d8" strokeWidth=".5"/>
      <text x="214" y="40" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#d8d6d0">&#182;1</text>
      <rect x="226" y="34" width="32" height="4" rx="1" fill="#e4e2d8"/>
      <rect x="226" y="42" width="28" height="4" rx="1" fill="#e4e2d8"/>
      <rect x="211" y="54" width="52" height="38" rx="4" fill="#dbeafe" fillOpacity=".5"/>
      <text x="214" y="66" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#1a5fb4">&#182;2</text>
      <rect x="226" y="60" width="32" height="4" rx="1" fill="#1a5fb4" fillOpacity=".4"/>
      <rect x="226" y="68" width="28" height="4" rx="1" fill="#1a5fb4" fillOpacity=".4"/>
      <rect x="226" y="76" width="30" height="4" rx="1" fill="#1a5fb4" fillOpacity=".4"/>
      <rect x="226" y="84" width="26" height="4" rx="1" fill="#1a5fb4" fillOpacity=".4"/>
      <rect x="215" y="98" width="42" height="12" rx="4" fill="#dbeafe"/>
      <text x="236" y="107" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#1a5fb4" textAnchor="middle">Focus &#182;2</text>
      <text x="214" y="122" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#d8d6d0">&#182;3</text>
      <rect x="226" y="116" width="30" height="4" rx="1" fill="#e4e2d8"/>
      <rect x="226" y="124" width="26" height="4" rx="1" fill="#e4e2d8"/>
    </svg>
  )
}

function ToolbarSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="88" rx="8" fill="#edece7" stroke="#e4e2d8"/>
      <rect x="56" y="36" width="168" height="20" rx="5" fill="#dbeafe" stroke="#1a5fb4" strokeWidth=".8"/>
      <text x="140" y="50" fontFamily="Plus Jakarta Sans" fontSize="8" fill="#1a5fb4" textAnchor="middle">a paradigm shift in thinking</text>
      <line x1="140" y1="58" x2="140" y2="96" stroke="#7a4d0e" strokeWidth="1" strokeDasharray="4,3"/>
      <polygon points="137,96 140,102 143,96" fill="#7a4d0e"/>
      <rect x="16" y="104" width="248" height="44" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <circle cx="42" cy="126" r="14" fill="#edece7"/>
      <text x="42" y="131" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="800" fill="#9c9a92" textAnchor="middle">?</text>
      <rect x="66" y="112" width="44" height="28" rx="7" fill="#f6edda" stroke="rgba(122,77,14,.15)"/>
      <text x="88" y="130" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="800" fill="#7a4d0e" textAnchor="middle">译</text>
      <rect x="120" y="112" width="44" height="28" rx="7" fill="#eceafe" stroke="rgba(58,49,133,.15)"/>
      <text x="142" y="130" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="800" fill="#3a3185" textAnchor="middle">&#x2726;</text>
      <text x="42" y="148" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92" textAnchor="middle">帮助</text>
      <text x="88" y="148" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#7a4d0e" textAnchor="middle">翻译</text>
      <text x="142" y="148" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185" textAnchor="middle">AI 提问</text>
    </svg>
  )
}

/* ── Card config ── */

const cards = [
  {
    num: 1,
    title: '左侧 · 任务区',
    color: 'teal' as const,
    Svg: TaskAreaSvg,
    desc: '课程内容、练习、讨论都在左侧完成。每个任务按 Listen → Practice → Discuss → Takeaway 顺序推进，完成前一步才能解锁下一步。',
  },
  {
    num: 2,
    title: '右侧 · 课文原文',
    color: 'blue' as const,
    Svg: TextPanelSvg,
    desc: '点击右侧「T」展开课文原文。做题时会自动高亮相关段落，帮你快速定位需要关注的内容。其他段落会变暗。',
  },
  {
    num: 3,
    title: '工具栏 · 翻译与 AI',
    color: 'amber' as const,
    Svg: ToolbarSvg,
    desc: '选中课文词句后点「译」即时翻译，点「✦」向 AI 提问。工具栏在底部，随时可用。',
  },
]

/* ── Component ── */

interface Props {
  open: boolean
  onClose: () => void
  manifest: ReadingManifest
}

export default function StudentGuide({ open, onClose, manifest }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) setVisible(true)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!visible) return null

  const handleAnimEnd = () => {
    if (!open) setVisible(false)
  }

  // Extract reading strategy steps (filter out Orientation/Synthesizing)
  const steps = (manifest.readingSteps || []).filter(
    s => s.type === 'task' && s.strategy !== 'Orientation' && s.strategy !== 'Synthesizing',
  )

  return (
    <div
      className={`sd-guide-backdrop${open ? '' : ' closing'}`}
      onClick={onClose}
      onAnimationEnd={handleAnimEnd}
    >
      <div
        className={`sd-guide-popup${open ? '' : ' closing'}`}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sd-guide-header">
          <h3>欢迎来到学习空间</h3>
        </div>

        {/* Mission Box */}
        <div className="stu-guide-mission">
          <div className="stu-guide-mission-box">
            <div className="stu-guide-mission-title">Today&apos;s Mission</div>
            <div className="stu-guide-mission-topic">{manifest.title}</div>
            <div className="stu-guide-mission-meta">
              围绕课文 <strong>{manifest.article.title}</strong>，依次练习 {steps.length} 种阅读技巧。每个任务包含 听讲 → 练习 → 讨论 → 总结 四个阶段。
            </div>
            {steps.length > 0 && (
              <div className="stu-guide-mission-steps">
                {steps.map((s, i) => (
                  <span key={s.idx} className="stu-guide-step-tag">
                    <span className="num">{i + 1}</span>{' '}
                    {s.displayName || s.strategy}
                    {strategyDesc[s.strategy] ? ` — ${strategyDesc[s.strategy]}` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section label */}
        <div className="sd-guide-section-label">你的学习区域</div>

        {/* Cards */}
        <div className="sd-guide-cards">
          {cards.map((c, i) => (
            <div key={c.num} className="sd-guide-card" style={{ animationDelay: `${i * 80 + 100}ms` }}>
              <div className="sd-guide-card-hd">
                <div className={`stu-guide-card-num ${c.color}`}>{c.num}</div>
                <h4>{c.title}</h4>
              </div>
              <div className="sd-guide-card-illust"><c.Svg /></div>
              <p className="sd-guide-card-desc">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* AI + Reward strip */}
        <div className="stu-guide-strip">
          <div className="stu-guide-callout purple">
            <span className="stu-guide-callout-icon">&#x2726;</span>
            <span><strong>多和 AI 互动！</strong> 遇到不懂的词句随时翻译，有想法就向 AI 提问。讨论环节中，AI 会引导你深入思考——越主动交流，收获越多。</span>
          </div>
          <div className="stu-guide-callout amber">
            <span className="stu-guide-callout-icon">&#x1F3C6;</span>
            <span><strong>深度互动奖</strong> 课程结束后，我们会评选 <strong>5 位与 AI 互动最有深度的同学</strong>，给予奖励。不是比谁说得多，而是比谁想得深！</span>
          </div>
        </div>

        {/* Tip */}
        <div className="stu-guide-tip">
          <div className="stu-guide-callout teal">
            <span className="stu-guide-callout-icon">&#x1F4A1;</span>
            <span>随时点击底部的 <strong>&ldquo;?&rdquo;</strong> 按钮可以重新打开这个指南。</span>
          </div>
        </div>

        {/* Footer */}
        <div className="sd-guide-footer">
          <button className="stu-btn pri" onClick={onClose}>开始学习</button>
        </div>
      </div>
    </div>
  )
}
