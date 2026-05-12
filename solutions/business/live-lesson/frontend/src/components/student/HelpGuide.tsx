import { useState } from 'react'

/* ── SVG illustrations (from design/student-guide.html sections 05 & 06) ── */

function TranslateSvg1() {
  return (
    <svg className="anim-trans-1" viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="66" y="10" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#9c9a92" textAnchor="middle" letterSpacing=".5">BEFORE</text>
      <rect x="8" y="16" width="120" height="100" rx="5" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="8" y="16" width="120" height="16" rx="5" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="8" y="26" width="120" height="1" fill="#e4e2d8"/>
      <text x="16" y="27" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="600" fill="#1c1c1a">Ideal Beauty</text>
      <rect x="14" y="36" width="108" height="2.5" rx="1" fill="#edece7"/>
      <rect x="14" y="42" width="96" height="2.5" rx="1" fill="#edece7"/>
      <rect x="14" y="48" width="102" height="2.5" rx="1" fill="#edece7"/>
      <rect x="14" y="54" width="88" height="2.5" rx="1" fill="#edece7"/>
      <rect x="14" y="60" width="100" height="2.5" rx="1" fill="#edece7"/>
      <circle cx="112" cy="102" r="10" fill="#7a4d0e"/>
      <text x="112" y="106" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="800" fill="#f0efe8" textAnchor="middle">译</text>
      <circle className="anim-fab" cx="112" cy="102" r="13" fill="none" stroke="#7a4d0e" strokeWidth=".6" opacity=".4"/>
      <text x="140" y="70" fontFamily="Plus Jakarta Sans" fontSize="16" fill="#0d5245">→</text>
      <text x="210" y="10" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#0d5245" textAnchor="middle" letterSpacing=".5">AFTER</text>
      <rect x="152" y="16" width="120" height="100" rx="5" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="152" y="16" width="120" height="16" rx="5" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="152" y="26" width="120" height="1" fill="#e4e2d8"/>
      <text x="160" y="27" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="600" fill="#1c1c1a">Ideal Beauty</text>
      <rect x="152" y="28" width="120" height="14" fill="#f6edda"/>
      <text x="212" y="38" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="600" fill="#7a4d0e" textAnchor="middle">请选择需要翻译的文字</text>
      <rect x="158" y="48" width="108" height="2.5" rx="1" fill="#edece7"/>
      <rect x="158" y="54" width="96" height="2.5" rx="1" fill="#edece7"/>
      <rect x="158" y="60" width="102" height="2.5" rx="1" fill="#edece7"/>
      <line x1="192" y1="58" x2="192" y2="70" stroke="#7a4d0e" strokeWidth="1"/>
      <line x1="189" y1="58" x2="195" y2="58" stroke="#7a4d0e" strokeWidth=".8"/>
      <line x1="189" y1="70" x2="195" y2="70" stroke="#7a4d0e" strokeWidth=".8"/>
      <circle cx="256" cy="102" r="10" fill="#1c1c1a"/>
      <text x="256" y="106" fontFamily="Plus Jakarta Sans" fontSize="8" fontWeight="800" fill="#f0efe8" textAnchor="middle">译</text>
      <g transform="translate(8,124)">
        <circle cx="4" cy="4" r="3" fill="#7a4d0e"/><text x="10" y="7" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#5c5b56">空闲</text>
        <text x="26" y="7" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#9c9a92">→</text>
        <circle cx="38" cy="4" r="3" fill="#1c1c1a"/><text x="44" y="7" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#5c5b56">激活</text>
        <rect x="68" y="0" width="40" height="9" rx="2" fill="#f6edda"/>
        <text x="72" y="7" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="600" fill="#7a4d0e">顶部横幅</text>
        <text x="120" y="7" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#5c5b56">光标变为 I 型</text>
      </g>
    </svg>
  )
}

function TranslateSvg2() {
  return (
    <svg className="anim-trans-2" viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="pop-shadow" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1c1c1a" floodOpacity=".08"/></filter>
      </defs>
      <rect x="8" y="2" width="264" height="14" rx="4" fill="#f6edda"/>
      <text x="140" y="12" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="600" fill="#7a4d0e" textAnchor="middle">请选择需要翻译的文字（最多500字）</text>
      <text x="14" y="30" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#7a4d0e" letterSpacing=".4">选单词</text>
      <rect className="anim-word-hl" x="86.2" y="33.7" width="0" height="14.6" rx="1.5" fill="#338fff" opacity=".22"/>
      <text x="14" y="45" fontFamily="Plus Jakarta Sans" fontSize="10">
        <tspan fill="#5c5b56">The concept of </tspan><tspan fill="#1c1c1a" fontWeight="700">shallow</tspan><tspan fill="#5c5b56"> beauty has</tspan>
      </text>
      <g className="anim-word-pop" transform="translate(68,52)">
        <rect x="0" y="0" width="170" height="30" rx="5" fill="#fbfaf7" stroke="#e4e2d8" filter="url(#pop-shadow)"/>
        <rect x="6" y="5" width="16" height="10" rx="2" fill="#f6edda"/>
        <text x="14" y="13" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="800" fill="#7a4d0e" textAnchor="middle">译</text>
        <text x="26" y="13" fontFamily="Plus Jakarta Sans" fontSize="6.5" fontWeight="700" fill="#1c1c1a">shallow</text>
        <text x="66" y="13" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#0d5245">adj. 浅的；肤浅的</text>
        <text x="26" y="24" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#9c9a92">语境: 此处指"表面的"审美观</text>
      </g>
      <line x1="14" y1="88" x2="266" y2="88" stroke="#e4e2d8" strokeWidth=".5" strokeDasharray="3"/>
      <text x="14" y="102" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#7a4d0e" letterSpacing=".4">选长句</text>
      <rect className="anim-phrase-hl" x="69" y="105.7" width="0" height="14.6" rx="1.5" fill="#338fff" opacity=".22"/>
      <text x="14" y="117" fontFamily="Plus Jakarta Sans" fontSize="10">
        <tspan fill="#5c5b56">Many argue </tspan><tspan fill="#1c1c1a" fontWeight="700">beauty standards differ across cultures</tspan>
      </text>
      <g className="anim-phrase-pop" transform="translate(30,123)">
        <rect x="0" y="0" width="226" height="34" rx="5" fill="#fbfaf7" stroke="#e4e2d8" filter="url(#pop-shadow)"/>
        <rect x="6" y="5" width="16" height="10" rx="2" fill="#f6edda"/>
        <text x="14" y="13" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="800" fill="#7a4d0e" textAnchor="middle">译</text>
        <text x="26" y="13" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#1c1c1a">beauty standards differ across cultures</text>
        <text x="26" y="25" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#0d5245">审美标准因文化而异</text>
        <rect x="160" y="17" width="58" height="12" rx="3" fill="#dfece8"/>
        <text x="168" y="26" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#0d5245">为什么这么说？</text>
      </g>
    </svg>
  )
}

function TranslateSvg3() {
  return (
    <svg className="anim-trans-3" viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="4" width="248" height="146" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="16" y="4" width="248" height="20" rx="8" fill="#fbfaf7"/>
      <rect x="16" y="18" width="248" height="6" fill="#fbfaf7"/>
      <rect x="22" y="8" width="16" height="12" rx="3" fill="#f6edda"/>
      <text x="30" y="17" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="800" fill="#7a4d0e" textAnchor="middle">译</text>
      <text x="42" y="17" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#1c1c1a">释义</text>
      <text x="252" y="17" fontFamily="Plus Jakarta Sans" fontSize="9" fill="#9c9a92" textAnchor="end">&times;</text>
      <line x1="16" y1="24" x2="264" y2="24" stroke="#e4e2d8" strokeWidth=".5"/>
      <text x="26" y="37" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#1c1c1a">shallow</text>
      <text x="68" y="37" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#0d5245">adj. 浅的；肤浅的；浅薄的</text>
      <text x="26" y="50" fontFamily="Plus Jakarta Sans" fontSize="6.5" fill="#5c5b56">语境: 此处指"表面化的"审美观，与 inner beauty 形成对比。</text>
      <rect className="anim-chip" x="26" y="58" width="62" height="14" rx="7" fill="none" stroke="#7a4d0e" strokeWidth="1"/>
      <text x="36" y="68" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#7a4d0e">shallow 的同义词？</text>
      <rect x="94" y="58" width="78" height="14" rx="7" fill="none" stroke="#7a4d0e" strokeWidth="1"/>
      <text x="102" y="68" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#7a4d0e">和 superficial 有何区别？</text>
      <g className="ab1">
        <rect x="166" y="78" width="88" height="20" rx="5" fill="#1c1c1a"/>
        <text x="174" y="91" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#f0efe8">shallow 的同义词有哪些？</text>
      </g>
      <g className="ab1" style={{ animationDelay: '.6s' }}>
        <rect x="26" y="104" width="152" height="30" rx="5" fill="#e9e7f3"/>
        <text x="34" y="116" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185">常见同义词：superficial（肤浅的）、surface-level</text>
        <text x="34" y="126" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185">（表面的）。此处 shallow 强调缺乏深度。</text>
      </g>
      <rect x="22" y="138" width="200" height="10" rx="3" fill="#edece7"/>
      <text x="28" y="146" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#9c9a92">继续追问...</text>
      <rect x="226" y="138" width="28" height="10" rx="3" fill="#0d5245"/>
      <text x="240" y="146" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#f0efe8" textAnchor="middle">&uarr;</text>
    </svg>
  )
}

function AiSvg1() {
  return (
    <svg className="anim-ai-1" viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="8" width="260" height="80" rx="6" fill="#edece7" opacity=".4"/>
      <g transform="translate(210,40)">
        <circle cx="16" cy="16" r="16" fill="#3a3185"/>
        <path d="M16 5 L18 12 L25 12 L19.5 16 L21.5 23 L16 19 L10.5 23 L12.5 16 L7 12 L14 12 Z" fill="#f0efe8" opacity=".9"/>
      </g>
      <g className="anim-panel">
      <rect x="30" y="60" width="220" height="90" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <circle cx="46" cy="76" r="10" fill="#3a3185"/>
      <path d="M46 71 L47 74 L50 74 L47.5 76 L48.5 79 L46 77 L43.5 79 L44.5 76 L42 74 L45 74 Z" fill="#fff" opacity=".9"/>
      <text x="60" y="80" fontFamily="Plus Jakarta Sans" fontSize="9" fontWeight="700" fill="#3a3185">AI Assistant</text>
      <rect x="138" y="72" width="42" height="12" rx="3" fill="#e9e7f3"/>
      <text x="159" y="81" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#3a3185" textAnchor="middle">Practice</text>
      <text x="46" y="96" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92">有什么问题需要帮助？</text>
      <rect x="46" y="104" width="52" height="16" rx="4" fill="none" stroke="#3a3185" strokeWidth="1"/>
      <text x="54" y="115" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185">解释这个概念</text>
      <rect x="104" y="104" width="52" height="16" rx="4" fill="none" stroke="#3a3185" strokeWidth="1"/>
      <text x="112" y="115" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185">帮我理解题目</text>
      <rect x="46" y="128" width="164" height="16" rx="4" fill="#edece7"/>
      <text x="54" y="139" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92">输入问题...</text>
      </g>
    </svg>
  )
}

function AiSvg2() {
  return (
    <svg className="anim-ai-2" viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="8" width="240" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <circle cx="36" cy="24" r="10" fill="#3a3185"/>
      <path d="M36 19 L37 22 L40 22 L37.5 24 L38.5 27 L36 25 L33.5 27 L34.5 24 L32 22 L35 22 Z" fill="#fff" opacity=".9"/>
      <text x="50" y="28" fontFamily="Plus Jakarta Sans" fontSize="9" fontWeight="700" fill="#3a3185">AI Assistant</text>
      <rect x="128" y="20" width="42" height="12" rx="3" fill="#e9e7f3"/>
      <text x="149" y="29" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#3a3185" textAnchor="middle">Practice</text>
      <circle cx="36" cy="50" r="7" fill="#3a3185"/>
      <text x="36" y="53" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="700" fill="#fff" textAnchor="middle">★</text>
      <rect x="48" y="40" width="90" height="22" rx="5" fill="#e9e7f3"/>
      <rect x="48" y="40" width="2" height="22" rx="1" fill="#3a3185"/>
      <text x="56" y="55" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#3a3185">你好！需要什么帮助？</text>
      <rect x="36" y="100" width="190" height="28" rx="6" fill="#fff" stroke="#e4e2d8"/>
      <text className="anim-code" x="46" y="118" fontFamily="Plus Jakarta Sans" fontSize="8" fill="#1c1c1a">什么是 shallow beauty?</text>
      <rect x="196" y="104" width="24" height="20" rx="4" fill="#3a3185"/>
      <text x="208" y="118" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#f0efe8" textAnchor="middle">&uarr;</text>
      <rect x="36" y="70" width="58" height="16" rx="4" fill="none" stroke="#3a3185" strokeWidth="1"/>
      <text x="44" y="81" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185">这道题怎么做？</text>
      <rect x="100" y="70" width="76" height="16" rx="4" fill="none" stroke="#3a3185" strokeWidth="1"/>
      <text x="108" y="81" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185">解释一下 paragraph 2</text>
    </svg>
  )
}

function AiSvg3() {
  return (
    <svg className="anim-ai-3" viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="8" width="240" height="140" rx="8" fill="#fbfaf7" stroke="#e4e2d8"/>
      <circle cx="36" cy="24" r="10" fill="#3a3185"/>
      <path d="M36 19 L37 22 L40 22 L37.5 24 L38.5 27 L36 25 L33.5 27 L34.5 24 L32 22 L35 22 Z" fill="#fff" opacity=".9"/>
      <text x="50" y="28" fontFamily="Plus Jakarta Sans" fontSize="9" fontWeight="700" fill="#3a3185">AI Assistant</text>
      <rect x="100" y="38" width="120" height="22" rx="5" fill="#1c1c1a"/>
      <text x="110" y="53" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#f0efe8">什么是 shallow beauty?</text>
      <g className="anim-dots" transform="translate(52,68)">
        <circle cx="0" cy="4" r="2.5" fill="#9c9a92"/>
        <circle cx="8" cy="4" r="2.5" fill="#9c9a92" opacity=".6"/>
        <circle cx="16" cy="4" r="2.5" fill="#9c9a92" opacity=".3"/>
      </g>
      <g className="anim-reply">
        <circle cx="36" cy="80" r="7" fill="#3a3185"/>
        <text x="36" y="83" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="700" fill="#fff" textAnchor="middle">★</text>
        <rect x="48" y="66" width="120" height="52" rx="5" fill="#e9e7f3"/>
        <rect x="48" y="66" width="2" height="52" rx="1" fill="#3a3185"/>
        <text x="56" y="80" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#3a3185">"Shallow beauty" 指的是仅关注</text>
        <text x="56" y="92" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#3a3185">外在容貌的审美观，与 "inner</text>
        <text x="56" y="104" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#3a3185">beauty" 形成对比。你觉得呢？</text>
      </g>
      <rect x="36" y="124" width="190" height="18" rx="4" fill="#edece7"/>
      <text x="46" y="136" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92">继续追问...</text>
    </svg>
  )
}

function TextbookSvg1() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="66" y="10" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#9c9a92" textAnchor="middle" letterSpacing=".5">收起状态</text>
      <rect x="8" y="16" width="100" height="90" rx="5" fill="#f4f3ef" stroke="#e4e2d8"/>
      <text x="58" y="58" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92" textAnchor="middle">任务区</text>
      <rect x="112" y="16" width="22" height="90" rx="4" fill="#edece7" stroke="#e4e2d8"/>
      <rect x="117" y="24" width="12" height="12" rx="3" fill="#dfece8"/>
      <text x="123" y="33" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#0d5245" textAnchor="middle" fontWeight="700">T</text>
      <text x="123" y="56" fontFamily="Plus Jakarta Sans" fontSize="4" fill="#9c9a92" textAnchor="middle" writingMode="tb">课文</text>
      <text x="123" y="90" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#0d5245" textAnchor="middle" fontWeight="600">¶12</text>
      <text x="119" y="112" fontSize="10">👆</text>
      <text x="140" y="60" fontFamily="Plus Jakarta Sans" fontSize="16" fill="#0d5245">→</text>
      <text x="210" y="10" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="700" fill="#0d5245" textAnchor="middle" letterSpacing=".5">展开状态</text>
      <rect x="152" y="16" width="56" height="90" rx="5" fill="#f4f3ef" stroke="#e4e2d8"/>
      <text x="180" y="58" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92" textAnchor="middle">任务区</text>
      <rect x="212" y="16" width="60" height="90" rx="5" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="218" y="28" width="6" height="6" rx="1" fill="#dfece8"/>
      <text x="228" y="34" fontFamily="Plus Jakarta Sans" fontSize="4" fill="#0d5245" fontWeight="600">¶1</text>
      <rect x="236" y="29" width="30" height="3" rx="1" fill="#edece7"/>
      <rect x="218" y="40" width="6" height="6" rx="1" fill="#dfece8"/>
      <text x="228" y="46" fontFamily="Plus Jakarta Sans" fontSize="4" fill="#0d5245" fontWeight="600">¶2</text>
      <rect x="236" y="41" width="30" height="3" rx="1" fill="#edece7"/>
      <rect x="236" y="46" width="22" height="3" rx="1" fill="#edece7"/>
      <rect x="218" y="56" width="6" height="6" rx="1" fill="#f6edda"/>
      <text x="228" y="62" fontFamily="Plus Jakarta Sans" fontSize="4" fill="#0d5245" fontWeight="600">¶3</text>
      <rect x="236" y="57" width="30" height="3" rx="1" fill="#edece7"/>
      <rect x="236" y="62" width="26" height="3" rx="1" fill="#edece7"/>
      <g transform="translate(8,116)">
        <text x="0" y="8" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#5c5b56">点击「T」或按键盘 T 键展开</text>
      </g>
    </svg>
  )
}

function TextbookSvg2() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="138" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="22" y="18" width="8" height="8" rx="2" fill="#dfece8"/>
      <text x="34" y="26" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#0d5245" fontWeight="600">¶1</text>
      <rect x="46" y="19" width="160" height="3" rx="1" fill="#edece7"/>
      <rect x="46" y="24" width="140" height="3" rx="1" fill="#edece7"/>
      <rect x="22" y="36" width="8" height="8" rx="2" fill="#dfece8"/>
      <text x="34" y="44" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#0d5245" fontWeight="600">¶2</text>
      <rect x="46" y="37" width="150" height="3" rx="1" fill="#edece7"/>
      <rect x="46" y="42" width="170" height="3" rx="1" fill="#edece7"/>
      <rect x="46" y="47" width="120" height="3" rx="1" fill="#edece7"/>
      <rect x="22" y="58" width="8" height="8" rx="2" fill="#f6edda"/>
      <text x="34" y="66" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#7a4d0e" fontWeight="700">¶3</text>
      <rect x="22" y="56" width="236" height="30" rx="4" fill="#f6edda" opacity=".15"/>
      <rect x="46" y="59" width="180" height="3" rx="1" fill="#d4c9a8"/>
      <rect x="46" y="64" width="160" height="3" rx="1" fill="#d4c9a8"/>
      <rect x="46" y="69" width="140" height="3" rx="1" fill="#d4c9a8"/>
      <rect x="46" y="74" width="100" height="3" rx="1" fill="#d4c9a8"/>
      <rect x="22" y="92" width="8" height="8" rx="2" fill="#dfece8"/>
      <text x="34" y="100" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#0d5245" fontWeight="600">¶4</text>
      <rect x="46" y="93" width="150" height="3" rx="1" fill="#edece7"/>
      <rect x="46" y="98" width="130" height="3" rx="1" fill="#edece7"/>
      <g transform="translate(22,118)">
        <rect x="0" y="0" width="80" height="16" rx="4" fill="#f6edda"/>
        <text x="40" y="11" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="600" fill="#7a4d0e" textAnchor="middle">当前任务相关段落 ¶3</text>
      </g>
    </svg>
  )
}

function TextbookSvg3() {
  return (
    <svg viewBox="0 0 280 158" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="8" width="248" height="138" rx="6" fill="#fbfaf7" stroke="#e4e2d8"/>
      <rect x="22" y="18" width="8" height="8" rx="2" fill="#dfece8"/>
      <text x="34" y="26" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#0d5245" fontWeight="600">¶3</text>
      <rect x="46" y="19" width="180" height="3" rx="1" fill="#edece7"/>
      <rect x="46" y="24" width="160" height="3" rx="1" fill="#edece7"/>
      <text x="46" y="42" fontFamily="Plus Jakarta Sans" fontSize="9">
        <tspan fill="#5c5b56">...concept of </tspan>
        <tspan fill="#1c1c1a" fontWeight="700">ideal beauty</tspan>
        <tspan fill="#5c5b56"> has...</tspan>
      </text>
      <rect x="100" y="33" width="60" height="13" rx="2" fill="#338fff" opacity=".18"/>
      <g transform="translate(90,50)">
        <rect x="0" y="0" width="150" height="26" rx="5" fill="#fbfaf7" stroke="#e4e2d8"/>
        <rect x="6" y="5" width="14" height="9" rx="2" fill="#f6edda"/>
        <text x="13" y="12" fontFamily="Plus Jakarta Sans" fontSize="5" fontWeight="800" fill="#7a4d0e" textAnchor="middle">译</text>
        <text x="24" y="12" fontFamily="Plus Jakarta Sans" fontSize="5.5" fontWeight="700" fill="#1c1c1a">ideal beauty</text>
        <text x="24" y="22" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#0d5245">理想的美；完美的审美标准</text>
      </g>
      <g transform="translate(22,90)">
        <circle cx="10" cy="10" r="10" fill="#3a3185"/>
        <path d="M10 5 L11 8 L14 8 L11.5 10 L12.5 13 L10 11 L7.5 13 L8.5 10 L6 8 L9 8 Z" fill="#fff" opacity=".9"/>
        <rect x="24" y="0" width="130" height="32" rx="5" fill="#e9e7f3"/>
        <rect x="24" y="0" width="2" height="32" rx="1" fill="#3a3185"/>
        <text x="32" y="14" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185">ideal beauty 在文中指古典时期</text>
        <text x="32" y="26" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#3a3185">的审美理想，强调比例与和谐。</text>
      </g>
      <g transform="translate(22,130)">
        <text x="0" y="10" fontFamily="Plus Jakarta Sans" fontSize="5.5" fill="#5c5b56">选中文字后，点「译」翻译或 ✦ 向 AI 提问</text>
      </g>
    </svg>
  )
}

/* ── Feature config ── */

interface StepCard {
  num: number
  title: string
  desc: string
  Svg: () => JSX.Element
}

interface Feature {
  id: string
  num: string
  title: string
  en: string
  hint: string
  color: string
  steps: StepCard[]
}

const features: Feature[] = [
  {
    id: 'translate',
    num: '01',
    title: '翻译助手',
    en: 'Translate Tool',
    hint: '三步翻译 · 不仅是词典',
    color: 'amber',
    steps: [
      { num: 1, title: '点击「译」进入翻译模式', desc: '点击右下角「译」按钮 — FAB 变深色，顶部出现琥珀色横幅，光标变为文字选择模式。', Svg: TranslateSvg1 },
      { num: 2, title: '划选单词或长句', desc: '在课文中划选单个单词查释义，或划选整句看翻译 — 弹窗含释义、语境分析、推荐追问。', Svg: TranslateSvg2 },
      { num: 3, title: '释义 + 追问', desc: '弹窗内点击推荐问题或输入追问，AI 在弹窗内即时回答，可多轮对话。', Svg: TranslateSvg3 },
    ],
  },
  {
    id: 'ai',
    num: '02',
    title: 'AI 助教',
    en: 'AI Tutor',
    hint: '三步使用 · 你的随身助教',
    color: 'purple',
    steps: [
      { num: 1, title: '打开面板', desc: '点击右下角 AI 图标打开助教面板。', Svg: AiSvg1 },
      { num: 2, title: '提出问题', desc: '输入问题或点击推荐问题。', Svg: AiSvg2 },
      { num: 3, title: '获得回答', desc: 'AI 助教给出解答，可继续追问。', Svg: AiSvg3 },
    ],
  },
  {
    id: 'textbook',
    num: '03',
    title: '课文面板',
    en: 'Text Panel',
    hint: '随时查看 · 做题自动高亮',
    color: 'teal',
    steps: [
      { num: 1, title: '展开课文', desc: '点击右侧「T」按钮或按键盘 T 键，展开课文原文面板。', Svg: TextbookSvg1 },
      { num: 2, title: '自动高亮', desc: '做题时，当前任务相关的段落自动高亮标记，方便定位。', Svg: TextbookSvg2 },
      { num: 3, title: '划选互动', desc: '在课文中选中文字，可用「译」翻译或 ✦ 向 AI 提问。', Svg: TextbookSvg3 },
    ],
  },
]

/* ── Component ── */

export default function HelpGuide({ onReplayTour, open: controlledOpen, onOpenChange }: {
  onReplayTour?: () => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = controlledOpen ?? internalOpen
  const setIsOpen = onOpenChange ?? setInternalOpen
  const [expanded, setExpanded] = useState<string | null>(null)

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id)

  return (
    <>
      <button className="stu-help-guide-btn" onClick={() => setIsOpen(true)}>操作说明</button>

      {isOpen && (
        <div className="stu-help-guide-backdrop" onClick={() => setIsOpen(false)} onKeyDown={e => e.key === 'Escape' && setIsOpen(false)}>
          <div className="stu-help-guide-modal" role="dialog" aria-modal="true" aria-labelledby="help-guide-title" onClick={e => e.stopPropagation()}>
            <div className="stu-help-guide-hd">
              <div id="help-guide-title" className="stu-help-guide-title">操作说明</div>
            </div>

            <div className="stu-hg-accordion">
              {features.map(f => {
                const isExp = expanded === f.id
                return (
                  <div key={f.id} className={`stu-hg-item${isExp ? ' open' : ''}`}>
                    <button className="stu-hg-item-hd" onClick={() => toggle(f.id)}>
                      <div className="stu-hg-item-left">
                        <span className="stu-hg-num">{f.num} —</span>
                        <span className="stu-hg-item-title">{f.title}</span>
                        <span className="stu-hg-item-en">{f.en}</span>
                      </div>
                      <span className="stu-hg-item-hint">{f.hint}</span>
                    </button>
                    {isExp && (
                      <div className="stu-hg-item-body">
                        <div className="stu-hg-steps-grid">
                          {f.steps.map(s => (
                            <div key={s.num} className="stu-hg-scard">
                              <div className="stu-hg-scard-hd">
                                <div className={`stu-hg-scard-num ${f.color}`}>{s.num}</div>
                                <div className="stu-hg-scard-title">{s.title}</div>
                              </div>
                              <div className="stu-hg-scard-illust"><s.Svg /></div>
                              <div className="stu-hg-scard-desc">{s.desc}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="stu-help-guide-footer">
              {onReplayTour && (
                <button className="stu-btn sec stu-help-guide-replay" onClick={() => { setIsOpen(false); onReplayTour() }}>重看引导</button>
              )}
              <button className="stu-btn pri stu-help-guide-dismiss" onClick={() => setIsOpen(false)}>我知道了</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
