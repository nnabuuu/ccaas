/* practice-squarediff-demo.jsx — AI Demo Card (LEFT column walkthrough)
   Stage timeline:
     stage 0: idle
     stage 1: step 1 visible (理思路)         [active]
     stage 2: step 2 partial — y↔a mapping    [active]
     stage 3: step 2 full   — 1↔b mapping     [active]
     stage 4: step 3 — first solution line "解：原式 = y² − 1²"
     stage 5: step 3 final "= y² − 1"         [answer chip green]
     stage 6: complete

   The map diagram (step 2) is a 10-column grid:
     row 1 = problem   ( y + 1 )( y − 1 )
     row 2 = bridges   (dashed vertical lines on the term columns only)
     row 3 = formula   ( a + b )( a − b )
*/

function AIDemoCard({ stage }) {
  return (
    <div className="demo-card">
      <div className="demo-hd">
        <div className="demo-avatar">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div className="demo-title">AI 助教 · 解题示范</div>
        <div className="demo-stage">
          {Math.min(stage, 3) > 0 ? `进度 ${Math.min(stage, 3)} / 3` : '准备演示'}
        </div>
      </div>

      <div className="demo-body">

        {/* Step 1 — 理清思路 */}
        <div className={'demo-step' + (stage >= 1 ? ' vis' : '') + (stage === 1 ? ' active' : '')}>
          <div className="demo-step-tag">第一步</div>
          <div className="demo-step-body">
            <div><strong>理清思路</strong></div>
            <div className="narr">
              观察形式：两个括号，一个是 <span style={{ fontStyle: 'italic' }}>和</span>，一个是 <span style={{ fontStyle: 'italic' }}>差</span>，里面的字母数字一一对应 ——
              这正好满足本节课学的<strong>平方差公式</strong>的特征。
            </div>
          </div>
        </div>

        {/* Step 2 — 找相同项 + 相反项 (上下对照图) */}
        <div className={'demo-step' + (stage >= 2 ? ' vis' : '') + ((stage === 2 || stage === 3) ? ' active' : '')}>
          <div className="demo-step-tag">第二步</div>
          <div className="demo-step-body">
            <div><strong>找相同项、找相反项</strong></div>
            <div className="narr">把题目和公式上下对齐——每一项的对应关系一目了然：</div>

            <div className="demo-map">
              {/* Row 1: problem */}
              <span className="dim">(</span>
              <span className={'tok tok-same' + (stage >= 2 ? ' on' : '')}>y</span>
              <span className="dim">+</span>
              <span className={'tok tok-opp' + (stage >= 3 ? ' on' : '')}>1</span>
              <span className="dim">)</span>
              <span className="dim">(</span>
              <span className={'tok tok-same' + (stage >= 2 ? ' on' : '')}>y</span>
              <span className="dim">−</span>
              <span className={'tok tok-opp' + (stage >= 3 ? ' on' : '')}>1</span>
              <span className="dim">)</span>

              {/* Row 2: bridges — only the 4 term columns get dashed lines */}
              <span className="bridge"></span>
              <span className={'bridge bridge-same' + (stage >= 2 ? ' on' : '')}></span>
              <span className="bridge"></span>
              <span className={'bridge bridge-opp' + (stage >= 3 ? ' on' : '')}></span>
              <span className="bridge"></span>
              <span className="bridge"></span>
              <span className={'bridge bridge-same' + (stage >= 2 ? ' on' : '')}></span>
              <span className="bridge"></span>
              <span className={'bridge bridge-opp' + (stage >= 3 ? ' on' : '')}></span>
              <span className="bridge"></span>

              {/* Row 3: formula */}
              <span className="dim">(</span>
              <span className={'tok tok-same' + (stage >= 2 ? ' on' : '')}>a</span>
              <span className="dim">+</span>
              <span className={'tok tok-opp' + (stage >= 3 ? ' on' : '')}>b</span>
              <span className="dim">)</span>
              <span className="dim">(</span>
              <span className={'tok tok-same' + (stage >= 2 ? ' on' : '')}>a</span>
              <span className="dim">−</span>
              <span className={'tok tok-opp' + (stage >= 3 ? ' on' : '')}>b</span>
              <span className="dim">)</span>
            </div>

            <div className="demo-map-legend">
              <span className={'map-legend-item' + (stage >= 2 ? ' vis' : '')}>
                <span className="ref-same">y</span> 就是公式里的 <span className="ref-same">a</span>
              </span>
              <span className={'map-legend-item' + (stage >= 3 ? ' vis' : '')}>
                <span className="ref-opp">1</span> 就是公式里的 <span className="ref-opp">b</span>
              </span>
            </div>
          </div>
        </div>

        {/* Step 3 — 代入公式 (vertical solution, aligned =) */}
        <div className={'demo-step' + (stage >= 4 ? ' vis' : '') + (stage >= 4 ? ' active' : '')}>
          <div className="demo-step-tag">第三步</div>
          <div className="demo-step-body">
            <div><strong>代入公式</strong></div>
            <div className="narr">
              用 <span className="ref-same">相同项</span><sup>2</sup> <span style={{ color: 'var(--t3)' }}>−</span> <span className="ref-opp">相反项</span><sup>2</sup>：
            </div>
            <div className="demo-sol">
              <div className={'demo-sol-row' + (stage >= 4 ? ' vis' : '')}>
                <span className="demo-sol-label">解：原式</span>
                <span className="demo-sol-eq">=</span>
                <span className="demo-sol-expr">
                  y<sup>2</sup> <span className="op-minus">−</span> 1<sup>2</sup>
                </span>
              </div>
              <div className={'demo-sol-row' + (stage >= 5 ? ' vis' : '')} style={{ transitionDelay: '.15s' }}>
                <span className="demo-sol-label"></span>
                <span className="demo-sol-eq">=</span>
                <span className="demo-sol-expr demo-sol-final">
                  <span className="demo-sol-answer">y<sup>2</sup> − 1</span>
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

Object.assign(window, { AIDemoCard });
