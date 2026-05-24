/* practice-squarediff-sidebar.jsx — Lecture Sidebar (RIGHT column)
   The persistent reference panel:
     - Rule card  ( a + b )( a − b ) = a² − b²    with built-in underline marks
     - Step ① 找相同项     (teal, double-underline mini)
     - Step ② 找相反项     (coral, wavy-underline mini)
     - Step ③ 套公式 + 警告 (amber callout: order matters)

   activeStep prop drives step-card highlight:
     0 = none yet
     1 = ① active
     2 = ② active
     3 = ③ active
     4 = all done (all three .done)
*/

function LectureSidebar({ activeStep }) {
  const stateOf = (n) => {
    if (activeStep === 4) return 'done';
    if (n < activeStep) return 'done';
    if (n === activeStep) return 'active';
    return '';
  };

  return (
    <div className="lecture-panel">
      <div className="lp-hd">
        <div className="lp-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <div className="lp-title">平方差公式 · 正确使用步骤</div>
        <div className="lp-badge">3 步</div>
      </div>

      <div className="lp-scroll">

        {/* Rule formula card — the key visual reference */}
        <div className="rule-card">
          <div className="rule-meta">
            <span className="rule-label">公式</span>
            <span className="rule-name">a² − b² 型</span>
          </div>
          <div className="rule-formula">
            <span className="paren">(</span>
            <StaticMarked kind="double" color="var(--teal)">a</StaticMarked>
            <span className="op"> + </span>
            <StaticMarked kind="wavy" color="var(--coral)">b</StaticMarked>
            <span className="paren">)(</span>
            <StaticMarked kind="double" color="var(--teal)">a</StaticMarked>
            <span className="op"> − </span>
            <StaticMarked kind="wavy" color="var(--coral)">b</StaticMarked>
            <span className="paren">)</span>
            <span className="eq"> = </span>
            <StaticMarked kind="double" color="var(--teal)">a</StaticMarked><span className="sup">2</span>
            <span className="op"> − </span>
            <StaticMarked kind="wavy" color="var(--coral)">b</StaticMarked><span className="sup">2</span>
          </div>
          <div className="rule-legend">
            <span className="rule-legend-chip same">
              <svg width="18" height="6" viewBox="0 0 18 6" preserveAspectRatio="none">
                <line x1="1" y1="1.5" x2="17" y2="1.5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
                <line x1="1" y1="4.5" x2="17" y2="4.5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              相同项 = a
            </span>
            <span className="rule-legend-chip opp">
              <svg width="20" height="6" viewBox="0 0 20 6" preserveAspectRatio="none">
                <path d="M 0 3 Q 2.5 0 5 3 T 10 3 T 15 3 T 20 3" fill="none" stroke="var(--coral)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              相反项 = b
            </span>
          </div>
        </div>

        {/* Step ① 找相同项 */}
        <div className={'step-card ' + stateOf(1)}>
          <div className="step-num">1</div>
          <div className="step-body">
            <div className="step-title">找<span style={{ color: 'var(--teal)' }}>相同项</span></div>
            <div className="step-desc">
              两个括号里<strong>完全一样</strong>的那一项 —— 对应公式里的 <span className="micro">a</span>。
              在题目上<strong>划双横线</strong>辅助识别。
            </div>
            <div className="step-mini">
              <span className="dim">(</span>
              <StaticMarked kind="double" color="var(--teal)">a</StaticMarked>
              <span className="op">+ b</span>
              <span className="dim">)(</span>
              <StaticMarked kind="double" color="var(--teal)">a</StaticMarked>
              <span className="op">− b</span>
              <span className="dim">)</span>
            </div>
          </div>
        </div>

        {/* Step ② 找相反项 */}
        <div className={'step-card ' + stateOf(2)}>
          <div className="step-num">2</div>
          <div className="step-body">
            <div className="step-title">找<span style={{ color: 'var(--coral)' }}>相反项</span></div>
            <div className="step-desc">
              两个括号里<strong>互为相反数</strong>的那一项（一个加、一个减）—— 对应公式里的 <span className="micro">b</span>。
              在题目上<strong>划波浪线</strong>辅助识别。
            </div>
            <div className="step-mini">
              <span className="dim">(a +</span>
              <StaticMarked kind="wavy" color="var(--coral)">b</StaticMarked>
              <span className="dim">)(a −</span>
              <StaticMarked kind="wavy" color="var(--coral)">b</StaticMarked>
              <span className="dim">)</span>
            </div>
          </div>
        </div>

        {/* Step ③ 代入公式 + 顺序警告 */}
        <div className={'step-card ' + stateOf(3)}>
          <div className="step-num">3</div>
          <div className="step-body">
            <div className="step-title">套公式：<span style={{ color: 'var(--teal)' }}>相同项</span><sup style={{ fontSize: 9 }}>2</sup> <span style={{ color: 'var(--t3)' }}>−</span> <span style={{ color: 'var(--coral)' }}>相反项</span><sup style={{ fontSize: 9 }}>2</sup></div>
            <div className="step-desc">
              用<strong>相同项的平方</strong>，<strong>减去相反项的平方</strong>。
            </div>
            <div className="step-mini">
              <StaticMarked kind="double" color="var(--teal)">a</StaticMarked><span className="sup">2</span>
              <span className="op"> − </span>
              <StaticMarked kind="wavy" color="var(--coral)">b</StaticMarked><span className="sup">2</span>
            </div>
            <div className="warn-callout">
              <div className="warn-icon">!</div>
              <div className="warn-body">
                <strong>顺序千万别错。</strong>必须是 <span className="warn-good">a² − b²</span>，不是 <span className="warn-bad">b² − a²</span>。
                相同项在前、相反项在后 —— 写反答案就错了。
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

Object.assign(window, { LectureSidebar });
