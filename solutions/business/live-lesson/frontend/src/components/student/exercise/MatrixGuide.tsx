import { useState, useEffect } from 'react'

/* ── SVG Illustrations ── */

function DemoRowSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Table header */}
      <rect x="26" y="16" width="228" height="20" rx="4" fill="#f4f3ef"/>
      <text x="60" y="30" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#9c9a92" textAnchor="middle">Where / When</text>
      <text x="140" y="30" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#9c9a92" textAnchor="middle">What</text>
      <text x="218" y="30" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#9c9a92" textAnchor="middle">Why</text>
      {/* Demo row - light green background */}
      <rect x="26" y="40" width="228" height="30" rx="0" fill="rgba(13,82,69,.03)" stroke="#e4e2d8" strokeWidth=".5"/>
      <text x="60" y="56" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="500" fill="#5c5b56" textAnchor="middle">Tang Dynasty</text>
      <text x="140" y="56" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56" textAnchor="middle">Silk Road trade</text>
      <text x="218" y="56" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56" textAnchor="middle">Cultural exchange</text>
      {/* Demo indicator */}
      <rect x="26" y="74" width="228" height="30" rx="0" fill="rgba(13,82,69,.03)" stroke="#e4e2d8" strokeWidth=".5"/>
      <text x="60" y="90" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="500" fill="#5c5b56" textAnchor="middle">Song Dynasty</text>
      <text x="140" y="90" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56" textAnchor="middle">Compass invention</text>
      <text x="218" y="90" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56" textAnchor="middle">Navigation advance</text>
      {/* Label */}
      <rect x="56" y="108" width="168" height="18" rx="6" fill="#ddf1eb"/>
      <text x="140" y="120" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#0d5245" textAnchor="middle">浅绿色行 = 示例，参考格式和长度</text>
      <text x="140" y="138" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92" textAnchor="middle">Demo rows are read-only references</text>
    </svg>
  )
}

function FillRowSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Active row */}
      <rect x="26" y="16" width="228" height="40" rx="4" fill="rgba(58,49,133,.03)" stroke="rgba(58,49,133,.12)"/>
      <text x="60" y="30" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="500" fill="#5c5b56" textAnchor="middle">Ming Dynasty</text>
      {/* What input */}
      <rect x="96" y="22" width="78" height="14" rx="3" fill="#fff" stroke="#3a3185"/>
      <text x="100" y="32" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#3a3185">Great Wall expand...</text>
      <text x="100" y="50" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#2d6612">✓ What filled</text>
      {/* Why input */}
      <rect x="180" y="22" width="68" height="14" rx="3" fill="#fff" stroke="#e4e2d8"/>
      <text x="184" y="32" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#9c9a92">Why?</text>
      <text x="184" y="50" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#9c9a92">← fill next</text>
      {/* Arrow showing unlock */}
      <text x="140" y="66" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#0d5245" textAnchor="middle">↓ both filled → unlock next row</text>
      {/* Locked row */}
      <rect x="26" y="74" width="228" height="30" rx="0" fill="#fbfaf7" stroke="#e4e2d8" strokeWidth=".5" opacity=".4"/>
      <text x="60" y="90" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="500" fill="#9c9a92" textAnchor="middle">Qing Dynasty</text>
      <text x="170" y="90" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92" textAnchor="middle" fontStyle="italic">Complete above first</text>
      {/* Explanation */}
      <rect x="42" y="112" width="196" height="28" rx="6" fill="#eceafe" stroke="rgba(58,49,133,.12)"/>
      <text x="140" y="126" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#3a3185" textAnchor="middle">先填 What，再填 Why</text>
      <text x="140" y="136" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185" textAnchor="middle">两格都写够 → 自动解锁下一行</text>
    </svg>
  )
}

function LookUpTextSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Table row with book button */}
      <rect x="26" y="16" width="228" height="36" rx="4" fill="rgba(58,49,133,.03)" stroke="rgba(58,49,133,.12)"/>
      <text x="40" y="34" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="500" fill="#5c5b56">Ming Dynasty</text>
      {/* Book button */}
      <rect x="96" y="24" width="22" height="18" rx="4" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="107" y="37" fontFamily="Plus Jakarta Sans" fontSize="10" textAnchor="middle">📖</text>
      {/* Arrow pointing down to text panel */}
      <path d="M107 52 L107 68 M103 64 L107 68 L111 64" stroke="#0d5245" strokeWidth="1.5" fill="none"/>
      {/* Text panel representation */}
      <rect x="36" y="74" width="208" height="58" rx="6" fill="#fff" stroke="#e4e2d8"/>
      <text x="46" y="88" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92">¶5</text>
      <text x="58" y="88" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#5c5b56">During the Ming Dynasty, the emperor</text>
      <text x="58" y="100" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#5c5b56">ordered massive expansion of the Great</text>
      <text x="58" y="112" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#5c5b56">Wall to defend against northern...</text>
      {/* Highlight flash */}
      <rect x="54" y="82" width="186" height="34" rx="3" fill="#0d5245" opacity=".06"/>
      <text x="46" y="124" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#0d5245">↑ highlighted paragraph</text>
      {/* Hint */}
      <text x="140" y="142" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#0d5245" textAnchor="middle">点 📖 跳到原文段落，找到答案再回来填</text>
    </svg>
  )
}

/* ── Guide Card config ── */

const cards = [
  {
    num: 1,
    title: '看示例',
    color: 'teal' as const,
    Svg: DemoRowSvg,
    desc: '浅绿色行是示例，参考它们的格式和长度。',
  },
  {
    num: 2,
    title: '逐行填写',
    color: 'teal' as const,
    Svg: FillRowSvg,
    desc: '先填 What，再填 Why，两格都写够后自动解锁下一行。',
  },
  {
    num: 3,
    title: '查原文',
    color: 'teal' as const,
    Svg: LookUpTextSvg,
    desc: '点 📖 按钮跳到原文段落，找到答案再回来填。',
  },
]

/* ── Component ── */

export default function MatrixGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h3>Matrix Exercise 小帮手</h3>
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
