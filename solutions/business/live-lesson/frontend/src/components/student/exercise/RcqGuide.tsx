import { useState, useEffect } from 'react'

/* ── SVG Illustrations ── */

function ReadProblemSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Problem card */}
      <rect x="26" y="16" width="228" height="64" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="36" y="24" width="40" height="14" rx="4" fill="#ddf1eb"/>
      <text x="56" y="34" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#0d5245" textAnchor="middle">第 1 题</text>
      <rect x="82" y="26" width="40" height="10" rx="3" fill="#ddf1eb"/>
      <text x="102" y="34" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="500" fill="#0d5245" textAnchor="middle">独立完成</text>
      {/* Problem text */}
      <text x="36" y="50" fontFamily="Plus Jakarta Sans" fontSize="7.5" fill="#5c5b56">计算下列各式：</text>
      <text x="140" y="70" fontFamily="Plus Jakarta Sans" fontSize="14" fontWeight="700" fill="#3a3185" textAnchor="middle">(a+b)(a−b) = ?</text>
      {/* Part dots */}
      <circle cx="120" cy="94" r="8" fill="#0d5245"/>
      <text x="120" y="97" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#fff" textAnchor="middle">1</text>
      <circle cx="140" cy="94" r="8" fill="#edece7"/>
      <text x="140" y="97" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">2</text>
      <circle cx="160" cy="94" r="8" fill="#edece7"/>
      <text x="160" y="97" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#9c9a92" textAnchor="middle">3</text>
      {/* Label */}
      <rect x="56" y="112" width="168" height="18" rx="6" fill="#ddf1eb"/>
      <text x="140" y="124" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#0d5245" textAnchor="middle">先读题目，看清要求再动笔</text>
    </svg>
  )
}

function WriteSolveSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Canvas area with grid */}
      <rect x="26" y="16" width="228" height="88" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Grid lines */}
      {[36, 56, 76].map(y => (
        <line key={y} x1="30" y1={y} x2="250" y2={y} stroke="#e4e2d8" strokeWidth=".3" strokeDasharray="4 3"/>
      ))}
      {/* Handwriting strokes */}
      <path d="M50 34 Q60 28 70 34 Q80 38 85 30" stroke="#3a3185" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M95 26 L95 42 M88 34 L102 34" stroke="#3a3185" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M55 52 Q65 46 75 52 Q85 56 90 48" stroke="#3a3185" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M100 48 L100 60" stroke="#3a3185" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <text x="120" y="40" fontFamily="Plus Jakarta Sans" fontSize="11" fontWeight="700" fill="#3a3185">= a² − b²</text>
      {/* Camera button */}
      <rect x="216" y="80" width="28" height="20" rx="4" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="230" y="94" fontFamily="Plus Jakarta Sans" fontSize="11" textAnchor="middle">📷</text>
      {/* Submit button */}
      <rect x="26" y="112" width="228" height="28" rx="8" fill="#3a3185"/>
      <text x="140" y="130" fontFamily="Plus Jakarta Sans" fontSize="9" fontWeight="600" fill="#fff" textAnchor="middle">提交</text>
    </svg>
  )
}

function AiFeedbackSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      {/* Wrong result card */}
      <rect x="26" y="16" width="228" height="48" rx="8" fill="rgba(148,41,41,.06)" stroke="rgba(148,41,41,.12)"/>
      <rect x="36" y="24" width="22" height="22" rx="6" fill="#942929"/>
      <text x="47" y="40" fontFamily="Plus Jakarta Sans" fontSize="11" fontWeight="700" fill="#fff" textAnchor="middle">✗</text>
      <text x="66" y="36" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="600" fill="#942929">再想想</text>
      <text x="66" y="50" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#5c5b56">展开式符号有误，注意正负号</text>
      {/* Arrow */}
      <text x="140" y="78" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#0d5245" textAnchor="middle">↓ 可以重试</text>
      {/* Retry flow */}
      <rect x="26" y="86" width="108" height="26" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="80" y="103" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#5c5b56" textAnchor="middle">🔄 重试修改</text>
      <rect x="146" y="86" width="108" height="26" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="200" y="103" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#5c5b56" textAnchor="middle">⏭ 跳过本题</text>
      {/* Label */}
      <rect x="42" y="120" width="196" height="18" rx="6" fill="#ddf1eb"/>
      <text x="140" y="132" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#0d5245" textAnchor="middle">AI 批改后可重写一次，或跳过继续</text>
    </svg>
  )
}

/* ── Guide Card config ── */

const cards = [
  {
    num: 1,
    title: '读题目',
    color: 'teal' as const,
    Svg: ReadProblemSvg,
    desc: '先看清题目要求，多题时按圆点顺序逐题作答。',
  },
  {
    num: 2,
    title: '写解答',
    color: 'teal' as const,
    Svg: WriteSolveSvg,
    desc: '在画布上手写解题过程，也可以拍照上传，写完点"提交"。',
  },
  {
    num: 3,
    title: 'AI 批改',
    color: 'teal' as const,
    Svg: AiFeedbackSvg,
    desc: 'AI 会批改你的答案并给出反馈，答错可重试一次，或跳过进入下一题。',
  },
]

/* ── Component ── */

export default function RcqGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <h3>手写解答 小帮手</h3>
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
