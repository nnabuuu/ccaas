/* practice-squarediff-app.jsx — Main app + stage timeline
   Single source of truth: `stage` (0-6). Everything else is derived.

   Loaded AFTER:
     practice-squarediff-marks.jsx     → DoubleUnderline, WavyUnderline, Marked, StaticMarked
     practice-squarediff-demo.jsx      → AIDemoCard
     practice-squarediff-sidebar.jsx   → LectureSidebar
*/
const { useState, useEffect, useRef } = React;

function PracticeApp() {
  const [stage, setStage] = useState(0);
  const timerRef = useRef(null);

  /* Auto-advance delays per stage transition (ms).
     IMPORTANT: every value must be ≥ longest CSS transition in that stage
     (currently 650ms for wavy draw). All values ≥ 900ms = safe. */
  const delays = [900, 2200, 1600, 1700, 1500, 1200];

  useEffect(() => {
    if (stage < 6) {
      timerRef.current = setTimeout(() => setStage(s => s + 1), delays[stage]);
      return () => clearTimeout(timerRef.current);
    }
  }, [stage]);

  const replay = () => {
    /* Must clear timer explicitly before resetting — otherwise
       a queued setStage(stage+1) can fire AFTER setStage(0). */
    clearTimeout(timerRef.current);
    setStage(0);
  };

  /* Derived flags (do NOT split into more useStates) */
  const sameVisible = stage >= 2;  // y, y — double underline
  const oppVisible = stage >= 3;   // 1, 1 — wavy underline
  const legendVisible = stage >= 2;

  /* Map stage → which sidebar step is active */
  let activeStep = 0;
  if (stage === 0 || stage === 1) activeStep = 0;
  else if (stage === 2) activeStep = 1;
  else if (stage === 3) activeStep = 2;
  else if (stage === 4 || stage === 5) activeStep = 3;
  else activeStep = 4;

  return (
    <div className="app">
      {/* ── Top Bar ── */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">多项式乘法 · 平方差公式</span>
          <span className="topbar-class">高一(3)班 · 数学</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: -1 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            AI 示范
          </span>
          <span className="topbar-timer">04:12</span>
          <span className="topbar-timer-of">/ 15'</span>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="main-row">

        {/* ── Task Column ── */}
        <div className="task-col">
          <div className="task-scroll">
            <div className="section-label-row">PRACTICE · 例题示范</div>

            {/* Problem card with animated annotations on y and 1 */}
            <div className="problem-card">
              <div className="problem-header">
                <span className="problem-num">例题</span>
                <span className="problem-badge">
                  <span className="ai-dot"></span>
                  AI 示范中
                </span>
              </div>
              <div className="problem-text">用 <strong>平方差公式</strong> 计算下式：</div>
              <div className="problem-expr">
                <span className="expr-paren">(</span>
                <Marked kind="double" visible={sameVisible} color="var(--teal)" padX={3}>y</Marked>
                <span className="expr-op">+</span>
                <Marked kind="wavy" visible={oppVisible} color="var(--coral)" padX={3}>1</Marked>
                <span className="expr-paren">)</span>
                <span className="expr-paren">(</span>
                <Marked kind="double" visible={sameVisible} color="var(--teal)" padX={3}>y</Marked>
                <span className="expr-op">−</span>
                <Marked kind="wavy" visible={oppVisible} color="var(--coral)" padX={3}>1</Marked>
                <span className="expr-paren">)</span>
              </div>
              <div className={'legend-row' + (legendVisible ? ' vis' : '')}>
                <span className="legend-chip same">
                  <svg className="legend-swatch" viewBox="0 0 16 6" preserveAspectRatio="none">
                    <line x1="1" y1="1.5" x2="15" y2="1.5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
                    <line x1="1" y1="4.5" x2="15" y2="4.5" stroke="var(--teal)" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  相同项 y
                </span>
                <span className="legend-chip opp">
                  <svg className="legend-swatch" viewBox="0 0 16 6" preserveAspectRatio="none">
                    <path d="M 0 3 Q 2 0 4 3 T 8 3 T 12 3 T 16 3" fill="none" stroke="var(--coral)" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  相反项 1
                </span>
              </div>
            </div>

            {/* AI walkthrough */}
            <AIDemoCard stage={stage} />

            {/* Action row after completion */}
            <div className={'action-row' + (stage >= 6 ? ' vis' : '')}>
              <button className="replay-btn" onClick={replay}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
                重新演示
              </button>
              <button className="next-btn">
                我来试试 ›
              </button>
            </div>
          </div>
        </div>

        {/* ── Lecture Sidebar ── */}
        <LectureSidebar activeStep={activeStep} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PracticeApp />);
