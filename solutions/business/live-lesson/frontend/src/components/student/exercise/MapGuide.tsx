import { useState, useEffect } from 'react'

/* ── SVG Illustrations ── */

function SelectChipSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="140" y="26" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#9c9a92" textAnchor="middle" letterSpacing=".6">CHIP TRAY</text>
      {/* Chips */}
      <rect x="26" y="34" width="72" height="22" rx="11" fill="#fbfaf7" stroke="#e4e2d8"/>
      <circle cx="38" cy="45" r="3" fill="#9c9a92"/>
      <text x="46" y="49" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="500" fill="#5c5b56">Tradition</text>
      <rect x="106" y="34" width="82" height="22" rx="11" fill="#ddf1eb" stroke="#0d5245" strokeWidth="1.5"/>
      <circle cx="118" cy="45" r="3" fill="#0d5245"/>
      <text x="126" y="49" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#0d5245">Innovation ✓</text>
      <rect x="196" y="34" width="58" height="22" rx="11" fill="#fbfaf7" stroke="#e4e2d8"/>
      <circle cx="208" cy="45" r="3" fill="#9c9a92"/>
      <text x="216" y="49" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="500" fill="#5c5b56">Risk</text>
      {/* Arrow */}
      <text x="140" y="74" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#0d5245" textAnchor="middle">↓ click to select</text>
      {/* Highlight box */}
      <rect x="72" y="82" width="136" height="22" rx="6" fill="#ddf1eb" stroke="#0d5245"/>
      <text x="140" y="96" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#0d5245" textAnchor="middle">Selected — now click on plane</text>
      {/* Plane preview */}
      <rect x="42" y="112" width="196" height="28" rx="4" fill="var(--surface, #f8f7f2)" stroke="#e4e2d8"/>
      <line x1="140" y1="112" x2="140" y2="140" stroke="#e4e2d8" strokeWidth=".5"/>
      <line x1="42" y1="126" x2="238" y2="126" stroke="#e4e2d8" strokeWidth=".5"/>
      <circle cx="170" cy="120" r="3" fill="#0d5245" opacity=".3"/>
      <text x="140" y="148" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#9c9a92" textAnchor="middle">coordinate plane</text>
    </svg>
  )
}

function PlaceChipSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Coordinate plane */}
      <rect x="30" y="16" width="220" height="120" rx="4" fill="#f8f7f2" stroke="#e4e2d8"/>
      <line x1="140" y1="16" x2="140" y2="136" stroke="#e4e2d8" strokeWidth="1"/>
      <line x1="30" y1="76" x2="250" y2="76" stroke="#e4e2d8" strokeWidth="1"/>
      {/* Axis labels */}
      <text x="140" y="14" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="600" fill="#9c9a92" textAnchor="middle">High</text>
      <text x="140" y="146" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="600" fill="#9c9a92" textAnchor="middle">Low</text>
      <text x="28" y="78" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="600" fill="#9c9a92" textAnchor="end">Neg</text>
      <text x="254" y="78" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="600" fill="#9c9a92">Pos</text>
      {/* Placed chip with crosshair */}
      <circle cx="180" cy="50" r="4" fill="#0d5245" opacity=".15"/>
      <rect x="160" y="42" width="56" height="16" rx="8" fill="#ddf1eb" stroke="#0d5245" strokeWidth="1.5"/>
      <circle cx="168" cy="50" r="2.5" fill="#0d5245"/>
      <text x="175" y="54" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#0d5245">Innovation</text>
      {/* Drag arrow */}
      <path d="M180 60 L180 70 M176 66 L180 70 L184 66" stroke="#0d5245" strokeWidth="1" fill="none"/>
      <text x="180" y="82" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#0d5245" textAnchor="middle">drag to adjust</text>
      {/* Out-of-bounds hint */}
      <text x="140" y="130" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92" textAnchor="middle">drag outside → auto remove</text>
    </svg>
  )
}

function WriteReasonSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Reasoning card */}
      <rect x="26" y="16" width="228" height="96" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Card header */}
      <rect x="36" y="24" width="64" height="16" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <circle cx="44" cy="32" r="2.5" fill="#9c9a92"/>
      <text x="50" y="36" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="500" fill="#5c5b56">Innovation</text>
      <text x="220" y="36" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92" textAnchor="end">(0.40, 0.65)</text>
      {/* Axis summary */}
      <rect x="36" y="46" width="100" height="18" rx="4" fill="#f8f7f2" stroke="#e4e2d8"/>
      <text x="42" y="53" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="700" fill="#9c9a92">X: Impact</text>
      <text x="42" y="61" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#5c5b56">Positive</text>
      <rect x="144" y="46" width="100" height="18" rx="4" fill="#f8f7f2" stroke="#e4e2d8"/>
      <text x="150" y="53" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="700" fill="#9c9a92">Y: Certainty</text>
      <text x="150" y="61" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#5c5b56">High</text>
      {/* Textarea */}
      <rect x="36" y="70" width="208" height="32" rx="4" fill="#e6f2dc" stroke="#2d6612"/>
      <text x="42" y="84" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56">Innovation drives positive change because</text>
      <text x="42" y="96" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56">it opens up new possibilities and...</text>
      {/* Progress bar */}
      <text x="36" y="122" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92">45 chars · need ≥20</text>
      <rect x="36" y="126" width="208" height="4" rx="2" fill="#edece7"/>
      <rect x="36" y="126" width="156" height="4" rx="2" fill="#2d6612"/>
      <text x="140" y="142" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#2d6612" textAnchor="middle">3/4 reasoned</text>
    </svg>
  )
}

/* ── Guide Card config ── */

const cards = [
  {
    num: 1,
    title: '选芯片',
    color: 'teal' as const,
    Svg: SelectChipSvg,
    desc: '从上方托盘点选一个标签，它会高亮等待放置。',
  },
  {
    num: 2,
    title: '放坐标',
    color: 'teal' as const,
    Svg: PlaceChipSvg,
    desc: '点击坐标平面将标签放到合适位置，也可以拖动调整；拖出边界自动移除。',
  },
  {
    num: 3,
    title: '写理由',
    color: 'teal' as const,
    Svg: WriteReasonSvg,
    desc: '在下方卡片写为什么放在这里，字数达标后进度条更新。',
  },
]

/* ── Component ── */

export default function MapGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h3>Map Exercise 小帮手</h3>
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
