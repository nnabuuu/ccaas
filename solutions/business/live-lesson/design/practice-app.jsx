/* practice-app.jsx — 多项式乘法 Practice Type */
const { useState, useRef, useEffect, useCallback, Fragment } = React;

/* ═══════════════════════════════════════════
   Handwriting Canvas — multi-page, pen/eraser
   ═══════════════════════════════════════════ */
function HandwritingCanvas({ expanded, onToggle }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([[]]);          // pages → strokes
  const drawingRef = useRef(false);
  const pathRef = useRef([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [tool, setTool] = useState('pen');
  const [redrawTick, setRedrawTick] = useState(0);

  const W = 1200, H = 560;

  /* ---- redraw ---- */
  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const strokes = strokesRef.current[currentPage] || [];
    strokes.forEach(s => {
      if (s.points.length < 1) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 28;
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color || '#1c1c1a';
        ctx.lineWidth = 2.5;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    });
  }, [currentPage]);

  useEffect(() => { if (expanded) requestAnimationFrame(redraw); }, [expanded, currentPage, redrawTick, redraw]);

  /* ---- helpers ---- */
  const getPos = (e) => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  };

  const handleStart = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    const pos = getPos(e);
    pathRef.current = [pos];
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 28;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = '#1c1c1a';
      ctx.lineWidth = 2.5;
    }
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 0.1, pos.y);
    ctx.stroke();
  };

  const handleMove = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    pathRef.current.push(pos);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handleEnd = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const ctx = canvasRef.current.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    if (pathRef.current.length > 0) {
      if (!strokesRef.current[currentPage]) strokesRef.current[currentPage] = [];
      strokesRef.current[currentPage].push({ tool, color: '#1c1c1a', points: [...pathRef.current] });
    }
    pathRef.current = [];
  };

  const undo = () => {
    const s = strokesRef.current[currentPage];
    if (!s || s.length === 0) return;
    s.pop();
    setRedrawTick(t => t + 1);
  };
  const clearPage = () => {
    strokesRef.current[currentPage] = [];
    setRedrawTick(t => t + 1);
  };
  const addPage = () => {
    strokesRef.current.push([]);
    const next = strokesRef.current.length - 1;
    setPageCount(strokesRef.current.length);
    setCurrentPage(next);
  };
  const deletePage = (idx) => {
    if (pageCount <= 1) return;
    strokesRef.current.splice(idx, 1);
    const newLen = strokesRef.current.length;
    setPageCount(newLen);
    if (currentPage >= newLen) setCurrentPage(newLen - 1);
    else if (currentPage > idx) setCurrentPage(currentPage - 1);
    else setRedrawTick(t => t + 1);
  };
  const goPage = (i) => setCurrentPage(i);

  /* ---- collapsed state ---- */
  if (!expanded) {
    return (
      <div className="hw-collapsed" onClick={onToggle}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        <span>点击展开手写区域</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    );
  }

  /* ---- expanded state ---- */
  return (
    <div className="hw-area">
      <div className="hw-toolbar">
        <div className="hw-tools">
          <button className={'hw-btn' + (tool === 'pen' ? ' active' : '')} onClick={() => setTool('pen')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            笔
          </button>
          <button className={'hw-btn' + (tool === 'eraser' ? ' active' : '')} onClick={() => setTool('eraser')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
            橡皮
          </button>
          <div className="hw-sep"></div>
          <button className="hw-btn" onClick={undo}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            撤销
          </button>
          <button className="hw-btn" onClick={clearPage}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            清除
          </button>
        </div>
        <div className="hw-pages">
          {Array.from({ length: pageCount }).map((_, i) => (
            <div key={i} className="hw-pg-wrap">
              <button className={'hw-pg' + (i === currentPage ? ' active' : '')} onClick={() => goPage(i)}>{i + 1}</button>
              {pageCount > 1 && (
                <button className="hw-pg-x" onClick={(e) => { e.stopPropagation(); deletePage(i); }} title="删除本页">✕</button>
              )}
            </div>
          ))}
          <button className="hw-pg hw-pg-add" onClick={addPage} title="添加新页">+</button>
        </div>
        <button className="hw-btn hw-collapse" onClick={onToggle}>收起 ▲</button>
      </div>
      <div className="hw-canvas-wrap">
        <canvas
          ref={canvasRef} width={W} height={H}
          onMouseDown={handleStart} onMouseMove={handleMove}
          onMouseUp={handleEnd} onMouseLeave={handleEnd}
          onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd}
          style={{ touchAction: 'none' }}
        />
      </div>
      <div className="hw-footer">
        <span className="hw-page-label">第 {currentPage + 1} / {pageCount} 页</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Photo Upload — click, camera, drag-and-drop
   ═══════════════════════════════════════════ */
function PhotoUpload() {
  const [photos, setPhotos] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const processFiles = (files) => {
    Array.from(files).filter(f => f.type.startsWith('image/')).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotos(p => [...p, { data: ev.target.result, name: file.name }]);
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); processFiles(e.dataTransfer.files); };

  return (
    <div className="photo-area">
      <div
        className={'photo-dropzone' + (dragOver ? ' drag-over' : '')}
        onClick={() => fileRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <div className="photo-dz-text">点击拍照或上传照片</div>
        <div className="photo-dz-hint">支持 JPG、PNG · 也可拖入此区域</div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e) => { processFiles(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} multiple />
      </div>
      {photos.length > 0 && (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <div key={i} className="photo-thumb">
              <img src={p.data} alt={p.name} />
              <button className="photo-rm" onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Formula Animation — FOIL color-coded
   ═══════════════════════════════════════════ */
function FormulaAnimation({ autoStart }) {
  const [stage, setStage] = useState(-1);
  const timerRef = useRef(null);

  const pairs = [
    { vars: ['a', 'm'], label: ['a', 'm'], cls: 'pair-blue' },
    { vars: ['a', 'n'], label: ['a', 'n'], cls: 'pair-green' },
    { vars: ['b', 'm'], label: ['b', 'm'], cls: 'pair-amber' },
    { vars: ['b', 'n'], label: ['b', 'n'], cls: 'pair-coral' },
  ];

  useEffect(() => {
    if (autoStart && stage === -1) {
      const t = setTimeout(() => setStage(0), 600);
      return () => clearTimeout(t);
    }
  }, [autoStart]);

  useEffect(() => {
    if (stage >= 0 && stage < 5) {
      timerRef.current = setTimeout(() => setStage(s => s + 1), stage === 0 ? 800 : 1000);
      return () => clearTimeout(timerRef.current);
    }
  }, [stage]);

  const play = () => setStage(0);

  const varClass = (v) => {
    if (stage < 0) return '';
    if (stage >= 4) return 'fv-done';
    const p = pairs[stage];
    if (p && p.vars.includes(v)) return p.cls;
    return 'fv-dim';
  };

  return (
    <div className="formula-box">
      <div className="formula-label-row">
        <span className="formula-rule-label">乘法分配律</span>
      </div>
      <div className="formula-main">
        <span className="fp">(</span>
        <span className={'fv ' + varClass('a')}>a</span>
        <span className="fo">+</span>
        <span className={'fv ' + varClass('b')}>b</span>
        <span className="fp">)</span>
        <span className="fp">(</span>
        <span className={'fv ' + varClass('m')}>m</span>
        <span className="fo">+</span>
        <span className={'fv ' + varClass('n')}>n</span>
        <span className="fp">)</span>
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

      {stage >= 5 && (
        <div className="formula-subst">
          <div className="formula-subst-label">代入本题：a = y，b = 2，m = y，n = −2</div>
        </div>
      )}

      <button className="formula-play" onClick={play}>
        {stage < 0 ? (
          <Fragment>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            演示展开过程
          </Fragment>
        ) : stage >= 5 ? (
          <Fragment>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            重新演示
          </Fragment>
        ) : (
          <span className="formula-playing">演示中…</span>
        )}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Solution Steps — animated line-by-line
   ═══════════════════════════════════════════ */
function SolutionDisplay({ visible }) {
  const [visLines, setVisLines] = useState(0);

  useEffect(() => {
    if (!visible) { setVisLines(0); return; }
    let i = 0;
    const tick = () => {
      i++;
      setVisLines(i);
      if (i < 4) setTimeout(tick, 500);
    };
    setTimeout(tick, 300);
  }, [visible]);

  const lines = [
    { prefix: '解：', text: '原式' },
    { prefix: '= ', text: (<span>y · y + y · (−2) + 2 · y + 2 · (−2)</span>) },
    { prefix: '= ', text: (<span>y² − 2y + 2y − 4</span>) },
    { prefix: '= ', text: (<span className="sol-answer">y² − 4</span>), isFinal: true },
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
   Hint Card
   ═══════════════════════════════════════════ */
function HintCard({ step, title, icon, children, visible }) {
  if (!visible) return null;
  return (
    <div className="hint-card hint-enter">
      <div className="hint-hd">
        <div className="hint-step-badge">{icon || step}</div>
        <span className="hint-title">第{step}步：{title}</span>
      </div>
      <div className="hint-body">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Main App
   ═══════════════════════════════════════════ */
function PracticeApp() {
  const [inputMode, setInputMode] = useState(null);
  const [hwExpanded, setHwExpanded] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);   // 0 = none, 1 = step1+2, 2 = step3
  const [submitted, setSubmitted] = useState(false);

  const revealHints12 = () => { setHintLevel(1); };
  const revealHint3 = () => { setHintLevel(2); };

  const chooseHandwrite = () => {
    setInputMode('handwrite');
    setHwExpanded(true);
  };

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

      {/* ── Main Content ── */}
      <div className="content-scroll">
        <div className="task-container">

          {/* Section label */}
          <div className="section-label-row">PRACTICE · 多项式的积</div>

          {/* Problem card */}
          <div className="problem-card">
            <div className="problem-header">
              <span className="problem-num">任务一</span>
              <span className="problem-badge">独立完成</span>
            </div>
            <div className="problem-text">计算下列多项式的积：</div>
            <div className="problem-expr">
              <span className="expr-paren">(</span>
              <span className="expr-var">y</span>
              <span className="expr-op"> + </span>
              <span className="expr-num">2</span>
              <span className="expr-paren">)</span>
              <span className="expr-paren">(</span>
              <span className="expr-var">y</span>
              <span className="expr-op"> − </span>
              <span className="expr-num">2</span>
              <span className="expr-paren">)</span>
            </div>
            <div className="problem-note">先独立完成，需要帮助时点击下方「需要提示」</div>
          </div>

          {/* Input method selection */}
          <div className="input-methods">
            <button className={'im-btn' + (inputMode === 'handwrite' ? ' active' : '')} onClick={chooseHandwrite}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              手写作答
            </button>
            <button className={'im-btn' + (inputMode === 'photo' ? ' active' : '')} onClick={() => setInputMode('photo')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              拍照上传
            </button>
          </div>

          {/* Active input area */}
          {inputMode === 'handwrite' && (
            <HandwritingCanvas expanded={hwExpanded} onToggle={() => setHwExpanded(!hwExpanded)} />
          )}
          {inputMode === 'photo' && <PhotoUpload />}

          {/* Submit */}
          {inputMode && (
            <button
              className={'submit-btn' + (submitted ? ' done' : '')}
              onClick={() => !submitted && setSubmitted(true)}
            >
              {submitted ? '✓ 已提交' : '提交答案'}
            </button>
          )}

          {/* ── Hint Section ── */}
          <div className="hint-section">
            {/* Trigger — reveal step 1+2 */}
            {hintLevel === 0 && (
              <button className="hint-trigger" onClick={revealHints12}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                需要提示？
              </button>
            )}

            {/* Step 1 — 理思路 */}
            <HintCard step={1} title="理思路" visible={hintLevel >= 1}>
              <p>这道题需要用到上节课学过的<strong>多项式乘法</strong>法则。</p>
              <p><span className="hl-expr">(y + 2)(y − 2)</span> 是两个多项式相乘的形式。</p>
              <p>想想看：如何用<strong>乘法分配律</strong>把每一项展开？</p>
            </HintCard>

            {/* Step 2 — 列公式 */}
            <HintCard step={2} title="列公式" visible={hintLevel >= 1}>
              <FormulaAnimation autoStart={hintLevel >= 1} />
            </HintCard>

            {/* Trigger — reveal step 3 */}
            {hintLevel === 1 && (
              <button className="hint-trigger hint-trigger-last" onClick={revealHint3}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>
                还是不会做？查看解题过程
              </button>
            )}

            {/* Step 3 — 写过程 */}
            <HintCard step={3} title="写过程" visible={hintLevel >= 2}>
              <SolutionDisplay visible={hintLevel >= 2} />
            </HintCard>
          </div>

        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<PracticeApp />);
