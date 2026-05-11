import { useState } from 'react'

export default function HelpGuide() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button className="stu-help-guide-btn" onClick={() => setOpen(true)}>操作说明</button>

      {open && (
        <div className="stu-help-guide-backdrop" onClick={() => setOpen(false)} onKeyDown={e => e.key === 'Escape' && setOpen(false)}>
          <div className="stu-help-guide-modal" role="dialog" aria-modal="true" aria-labelledby="help-guide-title" onClick={e => e.stopPropagation()}>
            <div className="stu-help-guide-hd">
              <div id="help-guide-title" className="stu-help-guide-title">操作说明</div>
            </div>

            <div className="stu-help-guide-grid">
              {/* Translate */}
              <div className="stu-help-guide-card">
                <div className="stu-help-guide-card-hd">
                  <div className="stu-help-guide-icon amber">译</div>
                  <div className="stu-help-guide-card-title">翻译功能</div>
                </div>
                <div className="stu-help-guide-illust">
                  <svg viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Step 1: Select text */}
                    <text x="8" y="12" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#7a4d0e">① 选中文字</text>
                    <rect x="8" y="18" width="120" height="56" rx="5" fill="#fbfaf7" stroke="#e4e2d8" />
                    <text x="16" y="34" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#1c1c1a">The concept of</text>
                    <rect x="16" y="38" width="56" height="11" rx="2" fill="#f6edda" opacity=".8" />
                    <text x="16" y="47" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="600" fill="#7a4d0e">ideal beauty</text>
                    <text x="74" y="47" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#1c1c1a"> has</text>
                    <text x="16" y="60" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#1c1c1a">been debated for</text>
                    <text x="16" y="70" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#1c1c1a">centuries.</text>
                    {/* Arrow */}
                    <line x1="136" y1="46" x2="152" y2="46" stroke="#9c9a92" strokeWidth="1" markerEnd="url(#arr)" />
                    <defs><marker id="arr" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L5,2 L0,4" fill="#9c9a92" /></marker></defs>
                    {/* Step 2: Click FAB */}
                    <text x="158" y="12" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#7a4d0e">② 点击「译」</text>
                    <circle cx="190" cy="46" r="14" fill="#7a4d0e" />
                    <text x="190" y="51" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#fff" textAnchor="middle" fontWeight="700">译</text>
                    {/* Finger pointer */}
                    <text x="202" y="60" fontSize="12">👆</text>
                    {/* Step 3: See result */}
                    <text x="158" y="82" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#7a4d0e">③ 查看释义</text>
                    <rect x="158" y="88" width="114" height="44" rx="6" fill="#fbfaf7" stroke="#e4e2d8" />
                    <rect x="164" y="94" width="14" height="14" rx="3" fill="#f6edda" />
                    <text x="171" y="104" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#7a4d0e" textAnchor="middle" fontWeight="700">译</text>
                    <text x="184" y="103" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="600" fill="#1c1c1a">释义</text>
                    <text x="164" y="117" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">理想的美；完美的</text>
                    <text x="164" y="127" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">审美标准</text>
                  </svg>
                </div>
                <div className="stu-help-guide-steps">
                  <span>选中课文中的单词或句子</span>
                  <span className="stu-help-guide-arrow">→</span>
                  <span>点击「译」按钮</span>
                  <span className="stu-help-guide-arrow">→</span>
                  <span>查看释义，还可追问</span>
                </div>
              </div>

              {/* AI Assistant */}
              <div className="stu-help-guide-card">
                <div className="stu-help-guide-card-hd">
                  <div className="stu-help-guide-icon purple">✦</div>
                  <div className="stu-help-guide-card-title">AI 助手</div>
                </div>
                <div className="stu-help-guide-illust">
                  <svg viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Step 1: Click FAB */}
                    <text x="8" y="12" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#3a3185">① 点击星星按钮</text>
                    <circle cx="40" cy="46" r="14" fill="#3a3185" />
                    <text x="40" y="51" fontFamily="Plus Jakarta Sans" fontSize="10" fill="#fff" textAnchor="middle">✦</text>
                    <text x="52" y="60" fontSize="12">👆</text>
                    {/* Arrow */}
                    <line x1="62" y1="46" x2="78" y2="46" stroke="#9c9a92" strokeWidth="1" markerEnd="url(#arr2)" />
                    <defs><marker id="arr2" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L5,2 L0,4" fill="#9c9a92" /></marker></defs>
                    {/* Step 2: Panel opens */}
                    <text x="84" y="12" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#3a3185">② 打开助手面板</text>
                    <rect x="84" y="18" width="110" height="80" rx="6" fill="#fbfaf7" stroke="#e4e2d8" />
                    <rect x="84" y="18" width="110" height="18" rx="6" fill="#e9e7f3" />
                    <rect x="84" y="30" width="110" height="6" fill="#e9e7f3" />
                    <circle cx="94" cy="28" r="5" fill="#3a3185" />
                    <text x="94" y="30" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#fff" textAnchor="middle">✦</text>
                    <text x="104" y="30" fontFamily="Plus Jakarta Sans" fontSize="6" fontWeight="600" fill="#1c1c1a">AI 助手</text>
                    {/* Chips */}
                    <rect x="90" y="42" width="46" height="12" rx="6" fill="#e9e7f3" />
                    <text x="113" y="51" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#3a3185" textAnchor="middle">解释一下</text>
                    <rect x="140" y="42" width="46" height="12" rx="6" fill="#e9e7f3" />
                    <text x="163" y="51" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#3a3185" textAnchor="middle">给个提示</text>
                    {/* Input */}
                    <rect x="90" y="80" width="80" height="12" rx="4" fill="#f4f3ef" stroke="#e4e2d8" />
                    <text x="96" y="89" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#9c9a92">输入问题...</text>
                    <rect x="174" y="80" width="14" height="12" rx="4" fill="#1c1c1a" />
                    <text x="181" y="89" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#fbfaf7" textAnchor="middle">→</text>
                    {/* Step 3 */}
                    <text x="84" y="114" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#3a3185">③ 输入问题或点击建议</text>
                    <text x="84" y="126" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">可以用中文或英文提问</text>
                    <text x="84" y="136" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">AI 会根据课文内容回答</text>
                  </svg>
                </div>
                <div className="stu-help-guide-steps">
                  <span>点击右下角 ✦ 按钮</span>
                  <span className="stu-help-guide-arrow">→</span>
                  <span>输入问题或点建议</span>
                  <span className="stu-help-guide-arrow">→</span>
                  <span>AI 基于课文回答</span>
                </div>
              </div>

              {/* Text Panel */}
              <div className="stu-help-guide-card">
                <div className="stu-help-guide-card-hd">
                  <div className="stu-help-guide-icon teal">T</div>
                  <div className="stu-help-guide-card-title">课文面板</div>
                </div>
                <div className="stu-help-guide-illust">
                  <svg viewBox="0 0 280 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Collapsed state */}
                    <text x="8" y="12" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#0d5245">① 收起状态</text>
                    <rect x="8" y="18" width="80" height="70" rx="5" fill="#f4f3ef" stroke="#e4e2d8" />
                    <text x="48" y="50" fontFamily="Plus Jakarta Sans" fontSize="7" fill="#9c9a92" textAnchor="middle">任务区</text>
                    <rect x="90" y="18" width="20" height="70" rx="4" fill="#edece7" stroke="#e4e2d8" />
                    <rect x="94" y="24" width="12" height="12" rx="3" fill="#dfece8" />
                    <text x="100" y="33" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#0d5245" textAnchor="middle" fontWeight="700">T</text>
                    <text x="100" y="56" fontFamily="Plus Jakarta Sans" fontSize="4" fill="#9c9a92" textAnchor="middle" writingMode="tb">课文</text>
                    <text x="100" y="80" fontFamily="Plus Jakarta Sans" fontSize="5" fill="#0d5245" textAnchor="middle" fontWeight="600">¶12</text>
                    {/* Click hint */}
                    <text x="96" y="100" fontSize="10">👆</text>
                    <text x="8" y="118" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">点击「T」展开</text>
                    <text x="8" y="130" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">或按键盘 T 键</text>
                    {/* Arrow */}
                    <line x1="118" y1="52" x2="138" y2="52" stroke="#9c9a92" strokeWidth="1" markerEnd="url(#arr3)" />
                    <defs><marker id="arr3" markerWidth="5" markerHeight="4" refX="5" refY="2" orient="auto"><path d="M0,0 L5,2 L0,4" fill="#9c9a92" /></marker></defs>
                    {/* Expanded state */}
                    <text x="144" y="12" fontFamily="Plus Jakarta Sans" fontSize="7" fontWeight="700" fill="#0d5245">② 展开状态</text>
                    <rect x="144" y="18" width="60" height="70" rx="5" fill="#f4f3ef" stroke="#e4e2d8" />
                    <text x="174" y="50" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#9c9a92" textAnchor="middle">任务区</text>
                    <rect x="206" y="18" width="66" height="70" rx="5" fill="#fbfaf7" stroke="#e4e2d8" />
                    {/* Mini text lines */}
                    <rect x="212" y="28" width="6" height="6" rx="1" fill="#dfece8" />
                    <text x="222" y="34" fontFamily="Plus Jakarta Sans" fontSize="4" fill="#0d5245" fontWeight="600">¶1</text>
                    <rect x="230" y="29" width="36" height="3" rx="1" fill="#edece7" />
                    <rect x="212" y="40" width="6" height="6" rx="1" fill="#dfece8" />
                    <text x="222" y="46" fontFamily="Plus Jakarta Sans" fontSize="4" fill="#0d5245" fontWeight="600">¶2</text>
                    <rect x="230" y="41" width="36" height="3" rx="1" fill="#edece7" />
                    <rect x="230" y="46" width="28" height="3" rx="1" fill="#edece7" />
                    <rect x="212" y="56" width="6" height="6" rx="1" fill="#f6edda" />
                    <text x="222" y="62" fontFamily="Plus Jakarta Sans" fontSize="4" fill="#0d5245" fontWeight="600">¶3</text>
                    <rect x="230" y="57" width="36" height="3" rx="1" fill="#edece7" />
                    <rect x="230" y="62" width="32" height="3" rx="1" fill="#edece7" />
                    <text x="144" y="106" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">课文原文逐段展示</text>
                    <text x="144" y="118" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">带段落编号和音频</text>
                    <text x="144" y="130" fontFamily="Plus Jakarta Sans" fontSize="6" fill="#5c5b56">做题时自动高亮相关段落</text>
                  </svg>
                </div>
                <div className="stu-help-guide-steps">
                  <span>点击右侧「T」或按 T 键</span>
                  <span className="stu-help-guide-arrow">→</span>
                  <span>展开课文原文</span>
                  <span className="stu-help-guide-arrow">→</span>
                  <span>做题时自动高亮</span>
                </div>
              </div>
            </div>

            <button className="stu-btn pri stu-help-guide-dismiss" onClick={() => setOpen(false)}>我知道了</button>
          </div>
        </div>
      )}
    </>
  )
}
