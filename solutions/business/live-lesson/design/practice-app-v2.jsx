/* practice-app-v2.jsx — submit-driven hint flow */
const { useState, useRef, useEffect, useCallback, Fragment } = React;

/* ═══ Handwriting Canvas — vertical multi-page scroll ═══ */
function HandwritingCanvas({ expanded, onToggle }) {
  const canvasRefs = useRef({});
  const strokesRef = useRef([[]]);
  const drawingRef = useRef(false);
  const pathRef = useRef([]);
  const activePageRef = useRef(0);
  const [pageCount, setPageCount] = useState(1);
  const [activePage, setActivePage] = useState(0);
  const [tool, setTool] = useState('pen');
  const [redrawTick, setRedrawTick] = useState(0);
  const W = 1200, H = 480;

  const redrawPage = useCallback((pi) => {
    const c = canvasRefs.current[pi]; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    (strokesRef.current[pi] || []).forEach(s => {
      if (s.points.length < 1) return;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 28; ctx.strokeStyle = 'rgba(0,0,0,1)'; }
      else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = s.color || '#1c1c1a'; ctx.lineWidth = 2.5; }
      ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke(); ctx.restore();
    });
  }, []);

  useEffect(() => {
    if (!expanded) return;
    requestAnimationFrame(() => { for (let i = 0; i < pageCount; i++) redrawPage(i); });
  }, [expanded, pageCount, redrawTick, redrawPage]);

  const getPos = (e, pi) => {
    const c = canvasRefs.current[pi]; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  };

  const handleStart = (e, pi) => {
    e.preventDefault();
    activePageRef.current = pi; setActivePage(pi);
    drawingRef.current = true;
    const pos = getPos(e, pi); pathRef.current = [pos];
    const ctx = canvasRefs.current[pi].getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 28; ctx.strokeStyle = 'rgba(0,0,0,1)'; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#1c1c1a'; ctx.lineWidth = 2.5; }
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(pos.x + 0.1, pos.y); ctx.stroke();
  };
  const handleMove = (e, pi) => {
    if (!drawingRef.current || pi !== activePageRef.current) return;
    e.preventDefault();
    const pos = getPos(e, pi); pathRef.current.push(pos);
    const ctx = canvasRefs.current[pi].getContext('2d');
    ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  };
  const handleEnd = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pi = activePageRef.current;
    const ctx = canvasRefs.current[pi]?.getContext('2d');
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    if (pathRef.current.length > 0) {
      if (!strokesRef.current[pi]) strokesRef.current[pi] = [];
      strokesRef.current[pi].push({ tool, color: '#1c1c1a', points: [...pathRef.current] });
    }
    pathRef.current = [];
  };

  const undo = () => { const s = strokesRef.current[activePage]; if (!s || !s.length) return; s.pop(); setRedrawTick(t => t + 1); };
  const clearPage = () => { strokesRef.current[activePage] = []; setRedrawTick(t => t + 1); };
  const addPage = () => {
    strokesRef.current.push([]);
    setPageCount(p => p + 1);
    setTimeout(() => { const el = document.querySelector('.hw-pages-scroll'); if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, 80);
  };
  const deletePage = (idx) => {
    if (pageCount <= 1) return;
    strokesRef.current.splice(idx, 1);
    const nl = strokesRef.current.length;
    setPageCount(nl);
    if (activePage >= nl) setActivePage(nl - 1);
    else if (activePage > idx) setActivePage(a => a - 1);
    setRedrawTick(t => t + 1);
  };

  if (!expanded) return (
    <div className="hw-collapsed" onClick={onToggle}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
      <span>点击展开手写区域</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
  );

  return (
    <div className="hw-area">
      <div className="hw-toolbar">
        <div className="hw-tools">
          <button className={'hw-btn' + (tool === 'pen' ? ' active' : '')} onClick={() => setTool('pen')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔
          </button>
          <button className={'hw-btn' + (tool === 'eraser' ? ' active' : '')} onClick={() => setTool('eraser')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>橡皮
          </button>
          <div className="hw-sep"></div>
          <button className="hw-btn" onClick={undo}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>撤销
          </button>
          <button className="hw-btn" onClick={clearPage}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>清除
          </button>
          {activePage > 0 && <span className="hw-active-hint">操作：第{activePage + 1}页</span>}
        </div>
        <button className="hw-btn hw-collapse" onClick={onToggle}>收起 ▲</button>
      </div>
      <div className="hw-pages-scroll">
        {Array.from({ length: pageCount }).map((_, i) => (
          <div key={i} className={'hw-page-block' + (i === activePage ? ' active' : '')} onClick={() => setActivePage(i)}>
            <div className="hw-page-hd">
              <span className="hw-page-num">第{i + 1}页</span>
              {pageCount > 1 && (
                <button className="hw-page-del" onClick={(e) => { e.stopPropagation(); deletePage(i); }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                  删除
                </button>
              )}
            </div>
            <div className="hw-canvas-wrap">
              <canvas
                ref={el => { canvasRefs.current[i] = el; }}
                width={W} height={H}
                onMouseDown={e => handleStart(e, i)}
                onMouseMove={e => handleMove(e, i)}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={e => handleStart(e, i)}
                onTouchMove={e => handleMove(e, i)}
                onTouchEnd={handleEnd}
                style={{ touchAction: 'none' }}
              />
            </div>
          </div>
        ))}
        <div className="hw-add-bottom" onClick={addPage}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          <span>新增一页</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ Photo Upload ═══ */
function PhotoUpload() {
  const [photos, setPhotos] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const processFiles = (files) => { Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => { const r = new FileReader(); r.onload = (ev) => setPhotos(p => [...p, { data: ev.target.result, name: file.name }]); r.readAsDataURL(file); }); };
  return (
    <div className="photo-area">
      <div className={'photo-dropzone' + (dragOver ? ' drag-over' : '')} onClick={() => fileRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <div className="photo-dz-text">点击拍照或上传照片</div>
        <div className="photo-dz-hint">支持 JPG、PNG · 也可拖入此区域</div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} multiple />
      </div>
      {photos.length > 0 && <div className="photo-grid">{photos.map((p, i) => (<div key={i} className="photo-thumb"><img src={p.data} alt={p.name} /><button className="photo-rm" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}>✕</button></div>))}</div>}
    </div>
  );
}

/* ═══ Formula Animation ═══ */
function FormulaAnimation({ autoStart }) {
  const [stage, setStage] = useState(-1);
  const timerRef = useRef(null);
  const pairs = [
    { vars: ['a', 'm'], label: ['a', 'm'], cls: 'pair-blue' },
    { vars: ['a', 'n'], label: ['a', 'n'], cls: 'pair-green' },
    { vars: ['b', 'm'], label: ['b', 'm'], cls: 'pair-amber' },
    { vars: ['b', 'n'], label: ['b', 'n'], cls: 'pair-coral' },
  ];
  useEffect(() => { if (autoStart && stage === -1) { const t = setTimeout(() => setStage(0), 600); return () => clearTimeout(t); } }, [autoStart]);
  useEffect(() => { if (stage >= 0 && stage < 5) { timerRef.current = setTimeout(() => setStage(s => s + 1), stage === 0 ? 800 : 1000); return () => clearTimeout(timerRef.current); } }, [stage]);
  const play = () => setStage(0);
  const varClass = (v) => { if (stage < 0) return ''; if (stage >= 4) return 'fv-done'; const p = pairs[stage]; if (p && p.vars.includes(v)) return p.cls; return 'fv-dim'; };

  return (
    <div className="formula-box">
      <div className="formula-label-row"><span className="formula-rule-label">乘法分配律</span></div>
      <div className="formula-main">
        <span className="fp">(</span><span className={'fv ' + varClass('a')}>a</span><span className="fo">+</span><span className={'fv ' + varClass('b')}>b</span><span className="fp">)</span>
        <span className="fp">(</span><span className={'fv ' + varClass('m')}>m</span><span className="fo">+</span><span className={'fv ' + varClass('n')}>n</span><span className="fp">)</span>
      </div>
      {stage >= 1 && (
        <div className="formula-expand">
          <span className="feq">=</span>
          {pairs.map((p, i) => (
            <Fragment key={i}>
              {i > 0 && <span className={'fplus' + (stage > i ? ' vis' : '')}> + </span>}
              <span className={'ft ' + p.cls + (stage > i ? ' vis' : '')}>{p.label[0]}{p.label[1]}</span>
            </Fragment>
          ))}
        </div>
      )}
      {stage >= 5 && <div className="formula-subst"><div className="formula-subst-label">代入本题：a = y，b = 2，m = y，n = −2</div></div>}
      <button className="formula-play" onClick={play}>
        {stage < 0 ? <span>▶ 演示展开过程</span> : stage >= 5 ? <span>↻ 重新演示</span> : <span className="formula-playing">演示中…</span>}
      </button>
    </div>
  );
}

/* ═══ Solution Display ═══ */
function SolutionDisplay({ visible }) {
  const [visLines, setVisLines] = useState(0);
  useEffect(() => { if (!visible) { setVisLines(0); return; } let i = 0; const tick = () => { i++; setVisLines(i); if (i < 4) setTimeout(tick, 500); }; setTimeout(tick, 300); }, [visible]);
  const lines = [
    { prefix: '解：', text: '原式' },
    { prefix: '= ', text: <span>y · y + y · (−2) + 2 · y + 2 · (−2)</span> },
    { prefix: '= ', text: <span>y² − 2y + 2y − 4</span> },
    { prefix: '= ', text: <span className="sol-answer">y² − 4</span>, isFinal: true },
  ];
  return (
    <div className="solution">
      {lines.map((l, i) => (
        <div key={i} className={'sol-line' + (i < visLines ? ' vis' : '') + (l.isFinal ? ' sol-final' : '')}>
          <span className="sol-prefix">{l.prefix}</span>{l.text}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP — submit-driven hint flow
   ═══════════════════════════════════════════ */
function PracticeApp() {
  const [inputMode, setInputMode] = useState(null);
  const [hwExpanded, setHwExpanded] = useState(false);

  // Flow states
  // phase: 'work' | 'checking' | 'wrong1' | 'retry' | 'checking2' | 'wrong2' | 'passed'
  const [phase, setPhase] = useState('work');
  const [panelOpen, setPanelOpen] = useState(false);

  const handleSubmit = () => {
    if (phase === 'work') {
      setPhase('checking');
      setTimeout(() => { setPhase('wrong1'); setPanelOpen(true); }, 1800);
    } else if (phase === 'retry') {
      setPhase('checking2');
      setTimeout(() => { setPhase('wrong2'); }, 1500);
    }
  };

  const startRetry = () => {
    setPhase('retry');
    setPanelOpen(true); // keep panel open for reference
  };

  const isChecking = phase === 'checking' || phase === 'checking2';
  const showPanel = panelOpen && (phase === 'wrong1' || phase === 'retry' || phase === 'wrong2' || phase === 'passed');
  const showStep3 = phase === 'wrong2' || phase === 'passed';
  const canSubmit = inputMode && (phase === 'work' || phase === 'retry');

  return (
    <div className="app">
      {/* ── Top Bar ── */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">多项式乘法</span>
          <span className="topbar-class">高一(3)班 · 数学</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-badge">练习</span>
          <span className="topbar-timer">12:30</span>
          <span className="topbar-timer-of">/ 15'</span>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="main-row">

        {/* ── Task Column ── */}
        <div className="task-col">
          <div className="task-scroll">
            <div className="section-label-row">PRACTICE · 多项式的积</div>

            <div className="problem-card">
              <div className="problem-header">
                <span className="problem-num">任务一</span>
                {phase === 'work' && <span className="problem-badge">独立完成</span>}
                {(phase === 'wrong1' || phase === 'retry') && <span className="problem-badge badge-retry">第二次机会</span>}
                {(phase === 'wrong2' || phase === 'passed') && <span className="problem-badge badge-done">已完成</span>}
              </div>
              <div className="problem-text">计算下列多项式的积：</div>
              <div className="problem-expr">
                <span className="expr-paren">(</span><span className="expr-var">y</span><span className="expr-op"> + </span><span className="expr-num">2</span><span className="expr-paren">)</span>
                <span className="expr-paren">(</span><span className="expr-var">y</span><span className="expr-op"> − </span><span className="expr-num">2</span><span className="expr-paren">)</span>
              </div>
            </div>

            {/* Input method */}
            <div className="input-methods">
              <button className={'im-btn' + (inputMode === 'handwrite' ? ' active' : '')} onClick={() => { setInputMode('handwrite'); setHwExpanded(true); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>手写作答
              </button>
              <button className={'im-btn' + (inputMode === 'photo' ? ' active' : '')} onClick={() => setInputMode('photo')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>拍照上传
              </button>
            </div>

            {inputMode === 'handwrite' && <HandwritingCanvas expanded={hwExpanded} onToggle={() => setHwExpanded(!hwExpanded)} />}
            {inputMode === 'photo' && <PhotoUpload />}

            {/* Submit / action button */}
            {canSubmit && (
              <button className="submit-btn" onClick={handleSubmit}>
                {phase === 'retry' ? '重新提交 (v2)' : '提交答案'}
              </button>
            )}

            {/* Checking state */}
            {isChecking && (
              <div className="checking-card">
                <div className="checking-dot"></div>
                <span>AI 助教正在批改…</span>
              </div>
            )}

            {/* Result: first attempt wrong */}
            {(phase === 'wrong1') && (
              <div className="result-card result-wrong">
                <div className="result-icon">✗</div>
                <div className="result-body">
                  <div className="result-title">答案不正确</div>
                  <div className="result-desc">展开过程有误，请参考右侧提示修改后重新提交。</div>
                </div>
              </div>
            )}
            {phase === 'wrong1' && (
              <button className="retry-btn" onClick={startRetry}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                修改答案，再试一次
              </button>
            )}

            {/* Result: second attempt wrong → passed */}
            {phase === 'wrong2' && (
              <div className="result-card result-final">
                <div className="result-icon">→</div>
                <div className="result-body">
                  <div className="result-title">已展示完整解答</div>
                  <div className="result-desc">请仔细阅读右侧解题过程，理解后继续下一题。</div>
                </div>
              </div>
            )}
            {phase === 'wrong2' && (
              <button className="next-btn" onClick={() => setPhase('passed')}>
                已理解，继续下一题 →
              </button>
            )}

            {phase === 'passed' && (
              <div className="passed-card">
                <span>✓ 本题已完成</span>
              </div>
            )}

            {/* Link to reopen panel if closed */}
            {!panelOpen && (phase === 'retry' || phase === 'wrong2') && (
              <button className="reopen-link" onClick={() => setPanelOpen(true)}>
                查看解题思路 →
              </button>
            )}
          </div>
        </div>

        {/* ── Hint Panel (right, slide-in) ── */}
        {showPanel && (
          <div className="hint-panel">
            <div className="hint-panel-hd">
              <div className="hint-panel-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="hint-panel-title">解题思路</div>
              <div className="hint-panel-badge">{showStep3 ? '完整解答' : '提示 1-2'}</div>
              <div className="hint-panel-close" onClick={() => setPanelOpen(false)}>✕</div>
            </div>

            <div className="hint-panel-scroll">
              {/* Step 1 */}
              <div className="hint-card hint-enter">
                <div className="hint-hd">
                  <div className="hint-step-badge">1</div>
                  <span className="hint-title">第1步：理思路</span>
                </div>
                <div className="hint-body">
                  <p>这道题需要用到上节课学过的<strong>多项式乘法</strong>法则。</p>
                  <p><span className="hl-expr">(y + 2)(y − 2)</span> 是两个多项式相乘的形式。</p>
                  <p>用<strong>乘法分配律</strong>把每一项逐个相乘再相加。</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="hint-card hint-enter" style={{ animationDelay: '.15s' }}>
                <div className="hint-hd">
                  <div className="hint-step-badge">2</div>
                  <span className="hint-title">第2步：列公式</span>
                </div>
                <div className="hint-body">
                  <FormulaAnimation autoStart={true} />
                </div>
              </div>

              {/* Step 3 — only after second wrong */}
              {showStep3 && (
                <div className="hint-card hint-card-solution hint-enter">
                  <div className="hint-hd">
                    <div className="hint-step-badge badge-amber">3</div>
                    <span className="hint-title">第3步：完整解答</span>
                  </div>
                  <div className="hint-body">
                    <SolutionDisplay visible={true} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PracticeApp />);
