import { useState, useEffect } from 'react'

/* ── SVG Illustrations (from discuss-guide.html design) ── */

function ProgressSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="16" y="8" width="248" height="22" rx="8" fill="#fbfaf7"/>
      <rect x="16" y="24" width="248" height="6" fill="#fbfaf7"/>
      <circle cx="30" cy="19" r="4" fill="#3a3185"/>
      <text x="40" y="23" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#3a3185">Socratic Discussion</text>
      <line x1="16" y1="30" x2="264" y2="30" stroke="#e4e2d8" strokeWidth=".5"/>
      <text x="26" y="42" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="700" fill="#9c9a92" letterSpacing=".6">DISCUSSION POINTS</text>
      <rect x="26" y="46" width="52" height="6" rx="3" fill="#2d6612"/>
      <rect x="84" y="46" width="52" height="6" rx="3" fill="#2d6612"/>
      <rect x="142" y="46" width="52" height="6" rx="3" fill="#7a4d0e" opacity=".5"/>
      <rect x="200" y="46" width="52" height="6" rx="3" fill="#edece7"/>
      <text x="258" y="52" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#9c9a92" textAnchor="end"><tspan fill="#2d6612">2</tspan>/4</text>
      <line x1="16" y1="58" x2="264" y2="58" stroke="#e4e2d8" strokeWidth=".5"/>
      <line x1="52" y1="54" x2="52" y2="66" stroke="#2d6612" strokeWidth="1"/>
      <text x="52" y="76" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#2d6612" textAnchor="middle">已探索</text>
      <line x1="168" y1="54" x2="168" y2="66" stroke="#7a4d0e" strokeWidth="1"/>
      <text x="168" y="76" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#7a4d0e" textAnchor="middle">靠近中</text>
      <line x1="226" y1="54" x2="226" y2="66" stroke="#9c9a92" strokeWidth="1"/>
      <text x="226" y="76" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#9c9a92" textAnchor="middle">未触及</text>
      <rect x="42" y="88" width="140" height="18" rx="8" fill="#f4f3ef" stroke="#e4e2d8"/>
      <text x="50" y="100" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#5c5b56">Why does the author say...</text>
      <rect x="100" y="112" width="130" height="18" rx="8" fill="#1a6e5e"/>
      <text x="108" y="124" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#f0efe8">Because it's a bigger shift</text>
      <rect x="80" y="134" width="80" height="12" rx="6" fill="#e6f2dc"/>
      <text x="120" y="143" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="700" fill="#2d6612" textAnchor="middle">Point 2 discovered</text>
    </svg>
  )
}

function HighlightSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="16" y="8" width="248" height="22" rx="8" fill="#fbfaf7"/>
      <rect x="16" y="24" width="248" height="6" fill="#fbfaf7"/>
      <circle cx="30" cy="19" r="4" fill="#3a3185"/>
      <text x="40" y="23" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#3a3185">Socratic Discussion</text>
      <text x="240" y="23" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="700" fill="#7a4d0e" textAnchor="end">✦ 3</text>
      <line x1="16" y1="30" x2="264" y2="30" stroke="#e4e2d8" strokeWidth=".5"/>
      <rect x="60" y="38" width="190" height="28" rx="8" fill="#1a6e5e"/>
      <text x="68" y="50" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#f0efe8">The shift to AI as a collaborator changes</text>
      <text x="68" y="60" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#f0efe8">not just what we do, but how we see ourselves.</text>
      <rect x="100" y="70" width="150" height="16" rx="4" fill="#f6edda" stroke="rgba(122,77,14,.12)"/>
      <text x="110" y="81" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#7a4d0e">✦</text>
      <text x="122" y="81" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="600" fill="#7a4d0e">Great insight · saved to highlights</text>
      <rect x="30" y="94" width="220" height="22" rx="6" fill="#eceafe" stroke="rgba(58,49,133,.12)"/>
      <text x="40" y="106" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#3a3185">✦</text>
      <text x="52" y="106" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#3a3185">You went beyond the lesson · +2</text>
      <g transform="translate(30,124)">
        <rect x="0" y="0" width="50" height="16" rx="4" fill="#f6edda"/>
        <text x="25" y="11" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#7a4d0e" textAnchor="middle">✦ +1 亮点</text>
        <text x="56" y="11" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92">课内好想法</text>
      </g>
      <g transform="translate(150,124)">
        <rect x="0" y="0" width="56" height="16" rx="4" fill="#eceafe"/>
        <text x="28" y="11" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#3a3185" textAnchor="middle">✦ +2 发现</text>
        <text x="62" y="11" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92">超纲洞察</text>
      </g>
    </svg>
  )
}

function StuckSvg() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="130" y="16" width="120" height="16" rx="6" fill="#1a6e5e"/>
      <text x="138" y="27" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#f0efe8">I think it just means different.</text>
      <rect x="160" y="38" width="90" height="16" rx="6" fill="#1a6e5e"/>
      <text x="168" y="49" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#f0efe8">I don't know, maybe?</text>
      <text x="140" y="65" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#9c9a92">连续卡住 2 轮 ↓</text>
      <rect x="26" y="72" width="228" height="30" rx="6" fill="#f6edda" stroke="rgba(122,77,14,.12)"/>
      <text x="36" y="86" fontFamily="Plus Jakarta Sans" fontSize="10">💡</text>
      <text x="52" y="84" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#7a4d0e">The author spends a whole paragraph on what</text>
      <text x="52" y="95" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#7a4d0e">happened <tspan fontWeight="700">after</tspan> the shift. What does that tell you?</text>
      <rect x="26" y="110" width="86" height="14" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="34" y="120" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#5c5b56">Before the shift...</text>
      <rect x="118" y="110" width="76" height="14" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="126" y="120" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#5c5b56">I notice that...</text>
      <rect x="200" y="110" width="52" height="14" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <text x="208" y="120" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#5c5b56">结果是…</text>
      <g transform="translate(26,130)">
        <rect x="0" y="0" width="50" height="14" rx="3" fill="#f6edda"/>
        <text x="25" y="10" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="700" fill="#7a4d0e" textAnchor="middle">💡 提示</text>
        <text x="56" y="10" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#9c9a92">指方向，不给答案</text>
      </g>
      <g transform="translate(160,130)">
        <rect x="0" y="0" width="56" height="14" rx="3" fill="#edece7"/>
        <text x="28" y="10" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="700" fill="#5c5b56" textAnchor="middle">Scaffold</text>
        <text x="62" y="10" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#9c9a92">帮你组织语言</text>
      </g>
    </svg>
  )
}

/* ── Guide Card config ── */

const cards = [
  {
    num: 1,
    title: '讨论进度',
    color: 'green' as const,
    Svg: ProgressSvg,
    desc: '每个方块代表一个讨论方向。亮了 = 你探索到了。不用猜方向——只管说你想说的。',
  },
  {
    num: 2,
    title: '亮点标记',
    color: 'amber' as const,
    Svg: HighlightSvg,
    desc: '说得好 AI 会标 ✦ +1。超出课程范围的发现是 ✦ +2。都会记录到你的 portfolio。',
  },
  {
    num: 3,
    title: '卡住了？',
    color: 'purple' as const,
    Svg: StuckSvg,
    desc: '连续卡住两轮会出现提示 + scaffold。不是答案，是帮你找到切入点。',
  },
]

/* ── Component ── */

export default function DiscussGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        {/* Header */}
        <div className="sd-guide-header">
          <h3>讨论小帮手</h3>
        </div>

        {/* Intro */}
        <div className="sd-guide-intro">
          <p>接下来是一场<strong>苏格拉底式讨论</strong>——AI 会围绕你刚刚完成的练习和课文内容向你提问，引导你一步步深入思考。</p>
          <p>AI <strong>不会给你答案</strong>，只会追问和引导。它会问"为什么？""你能举例吗？"——这些追问是帮你打开思路，不是在刁难你。</p>
          <div className="sd-guide-callout">
            <span className="sd-guide-callout-icon">👀</span>
            <span>你的回答<strong>老师全程可见</strong>，精彩的想法有机会被<strong>展示给全班同学</strong>。认真说出你的真实想法！</span>
          </div>
        </div>

        {/* Section label */}
        <div className="sd-guide-section-label">讨论中你会看到这些</div>

        {/* Cards */}
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

        {/* Footer */}
        <div className="sd-guide-footer">
          <button className="stu-btn pri" onClick={onClose}>我知道了</button>
        </div>
      </div>
    </div>
  )
}
