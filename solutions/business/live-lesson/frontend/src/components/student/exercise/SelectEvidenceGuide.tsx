import { useState, useEffect } from 'react'

/* ── SVG Illustrations ── */

function PickFunctionSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="140" y="28" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#9c9a92" textAnchor="middle" letterSpacing=".6">PICK THE FUNCTION</text>
      <rect x="26" y="38" width="110" height="28" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="81" y="56" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="500" fill="#5c5b56" textAnchor="middle">Introduction</text>
      <rect x="144" y="38" width="110" height="28" rx="6" fill="#e6f2dc" stroke="#2d6612" strokeWidth="1.5"/>
      <text x="199" y="56" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="600" fill="#2d6612" textAnchor="middle">History ✓</text>
      <rect x="26" y="72" width="110" height="28" rx="6" fill="#fbfaf7" stroke="rgba(28,28,26,.07)"/>
      <text x="81" y="90" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="500" fill="#5c5b56" textAnchor="middle">Culture</text>
      <rect x="144" y="72" width="110" height="28" rx="6" fill="#fbfaf7" stroke="rgba(28,28,26,.07)"/>
      <text x="199" y="90" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="500" fill="#5c5b56" textAnchor="middle">Conclusion</text>
      <text x="140" y="118" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#2d6612" textAnchor="middle">↓ auto-advance</text>
      <rect x="66" y="126" width="148" height="16" rx="4" fill="#ddf1eb"/>
      <text x="140" y="137" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#0d5245" textAnchor="middle">Step 2: Locate the why</text>
    </svg>
  )
}

function FindSignalsSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="26" y="30" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92">¶3</text>
      <text x="40" y="30" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56">The origins of this tradition</text>
      <rect x="40" y="38" width="72" height="14" rx="2" fill="#fef6c8"/>
      <text x="44" y="49" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#1c1c1a">date back to</text>
      <line x1="40" y1="52" x2="112" y2="52" stroke="#0d5245" strokeWidth="1" strokeDasharray="2,2"/>
      <text x="118" y="49" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56">the early Tang...</text>
      <text x="40" y="70" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56">artisans</text>
      <rect x="78" y="62" width="82" height="14" rx="2" fill="rgba(0,150,136,.07)"/>
      <text x="82" y="73" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56">first developed</text>
      <line x1="78" y1="76" x2="160" y2="76" stroke="rgba(0,150,136,.35)" strokeWidth="1" strokeDasharray="2,2"/>
      <text x="166" y="73" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56">techniques...</text>
      <g transform="translate(100,80)">
        <path d="M0 0 L0 14 L4 10 L8 16 L10 15 L6 9 L12 8 Z" fill="#0d5245" opacity=".7"/>
      </g>
      <rect x="86" y="102" width="108" height="16" rx="4" fill="#ddf1eb"/>
      <text x="140" y="113" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#0d5245" textAnchor="middle">1 phrase highlighted</text>
      <text x="140" y="136" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92" textAnchor="middle">click to select · click again to deselect</text>
    </svg>
  )
}

function SeeFeedbackSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="26" y="16" width="228" height="56" rx="6" fill="#eceafe" stroke="rgba(58,49,133,.12)"/>
      <circle cx="38" cy="30" r="3.5" fill="#3a3185"/>
      <text x="46" y="33" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#3a3185">You found 3 of 4 signals</text>
      <text x="36" y="50" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#3a3185">"date back to" (¶3) — Chronological marker</text>
      <text x="36" y="62" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#3a3185">"first developed" (¶3) — Historical start</text>
      <rect x="26" y="78" width="228" height="62" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="36" y="92" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="700" fill="#9c9a92" letterSpacing=".6">ALL SIGNALS IN THIS SECTION</text>
      <text x="36" y="107" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#2d6612">✓ "date back to"</text>
      <text x="36" y="120" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#2d6612">✓ "first developed"</text>
      <text x="36" y="133" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92">+ "over the centuries" (missed)</text>
    </svg>
  )
}

/* ── Guide Card config ── */

const cards = [
  {
    num: 1,
    title: '选功能',
    color: 'teal' as const,
    Svg: PickFunctionSvg,
    desc: '点击按钮即判断，对了自动进下一步，错了按钮抖动可重选。',
  },
  {
    num: 2,
    title: '找信号',
    color: 'teal' as const,
    Svg: FindSignalsSvg,
    desc: '在课文中点击虚线下划线短语，多选可取消。',
  },
  {
    num: 3,
    title: '看反馈',
    color: 'teal' as const,
    Svg: SeeFeedbackSvg,
    desc: 'AI 告诉你对/漏/错，不够满分可再试。',
  },
]

/* ── Component ── */

export default function SelectEvidenceGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        <div className="sd-guide-header">
          <h3>Select Evidence 小帮手</h3>
        </div>

        <div className="sd-guide-section-label">练习中你会看到这些</div>

        <div className="sd-guide-cards">
          {cards.map((c, i) => (
            <div key={c.num} className="sd-guide-card" style={{ animationDelay: `${i * 80 + 100}ms` }}>
              <div className="sd-guide-card-hd">
                <div className={`sd-guide-card-num ${c.color}`}>{c.num}</div>
                <h4>{c.title}</h4>
              </div>
              <div className="sd-guide-card-illust"><c.Svg /></div>
              <p className="sd-guide-card-desc">{c.desc}</p>
            </div>
          ))}
        </div>

        <div className="sd-guide-footer">
          <button className="stu-btn pri" onClick={onClose}>我知道了</button>
        </div>
      </div>
    </div>
  )
}
