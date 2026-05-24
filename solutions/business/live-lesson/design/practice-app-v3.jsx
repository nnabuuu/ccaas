/* practice-app-v3.jsx — handwriting canvas with integrated photo upload */
const { useState, useRef, useEffect, useCallback, Fragment } = React;

/* ═══ Handwriting Canvas — mixed canvas + photo pages ═══ */
function HandwritingCanvas({ onContentChange }) {
  const canvasRefs = useRef({});
  const strokesRef = useRef({});     // keyed by page id
  const drawingRef = useRef(false);
  const pathRef = useRef([]);
  const activePageIdRef = useRef(null);
  const nextIdRef = useRef(1);
  const fileInputRef = useRef(null);

  const makeCanvasPage = () => {
    const id = nextIdRef.current++;
    strokesRef.current[id] = [];
    return { id, type: 'canvas' };
  };
  const makePhotoPage = (data) => {
    const id = nextIdRef.current++;
    return { id, type: 'photo', photoData: data };
  };

  const [pages, setPages] = useState([]);
  const [activePageId, setActivePageId] = useState(null);
  const [tool, setTool] = useState('pen');
  const [redrawTick, setRedrawTick] = useState(0);
  const [contentTick, setContentTick] = useState(0);
  const W = 1200, H = 480;

  const setActive = (id) => { activePageIdRef.current = id; setActivePageId(id); };
  const bumpContent = () => setContentTick(t => t + 1);

  /* Notify parent when content changes */
  useEffect(() => {
    const hasPhotos = pages.some(p => p.type === 'photo' && p.photoData);
    const hasStrokes = pages.some(p => p.type === 'canvas' && strokesRef.current[p.id]?.length > 0);
    const has = pages.length > 0 && (hasPhotos || hasStrokes);
    if (onContentChange) onContentChange(has);
  }, [pages, contentTick, onContentChange]);

  const redrawPage = useCallback((pageId) => {
    const c = canvasRefs.current[pageId]; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    (strokesRef.current[pageId] || []).forEach(s => {
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
    if (pages.length === 0) return;
    requestAnimationFrame(() => { pages.forEach(p => { if (p.type === 'canvas') redrawPage(p.id); }); });
  }, [pages, redrawTick, redrawPage]);

  const getPos = (e, pageId) => {
    const c = canvasRefs.current[pageId]; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  };

  const handleStart = (e, pageId) => {
    e.preventDefault();
    activePageIdRef.current = pageId; setActivePageId(pageId);
    drawingRef.current = true;
    const pos = getPos(e, pageId); pathRef.current = [pos];
    const ctx = canvasRefs.current[pageId].getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 28; ctx.strokeStyle = 'rgba(0,0,0,1)'; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#1c1c1a'; ctx.lineWidth = 2.5; }
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(pos.x + 0.1, pos.y); ctx.stroke();
  };
  const handleMove = (e, pageId) => {
    if (!drawingRef.current || pageId !== activePageIdRef.current) return;
    e.preventDefault();
    const pos = getPos(e, pageId); pathRef.current.push(pos);
    const ctx = canvasRefs.current[pageId].getContext('2d');
    ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  };
  const handleEnd = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pid = activePageIdRef.current;
    const ctx = canvasRefs.current[pid]?.getContext('2d');
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    if (pathRef.current.length > 0) {
      if (!strokesRef.current[pid]) strokesRef.current[pid] = [];
      strokesRef.current[pid].push({ tool, color: '#1c1c1a', points: [...pathRef.current] });
      bumpContent();
    }
    pathRef.current = [];
  };

  /* Active canvas page for undo/clear */
  const activeCanvasPage = pages.find(p => p.id === activePageId && p.type === 'canvas');

  const undo = () => {
    if (!activeCanvasPage) return;
    const s = strokesRef.current[activeCanvasPage.id];
    if (!s || !s.length) return; s.pop(); setRedrawTick(t => t + 1); bumpContent();
  };
  const clearPage = () => {
    if (!activeCanvasPage) return;
    strokesRef.current[activeCanvasPage.id] = []; setRedrawTick(t => t + 1); bumpContent();
  };

  const addCanvasPage = () => {
    const p = makeCanvasPage();
    setPages(prev => [...prev, p]);
    setActive(p.id);
    setTimeout(() => { const el = document.querySelector('.hw-pages-scroll'); if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, 80);
  };

  const triggerPhotoUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handlePhotoFiles = (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const p = makePhotoPage(ev.target.result);
        setPages(prev => [...prev, p]);
        setActive(p.id);
        setTimeout(() => { const el = document.querySelector('.hw-pages-scroll'); if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }, 80);
      };
      reader.readAsDataURL(file);
    });
  };

  const replacePhotoPage = (pageId) => {
    // Create a temp input for replacing a specific photo page
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
    input.onchange = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPages(prev => prev.map(p => p.id === pageId ? { ...p, photoData: ev.target.result } : p));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const deletePage = (pageId) => {
    const idx = pages.findIndex(p => p.id === pageId);
    const newPages = pages.filter(p => p.id !== pageId);
    delete strokesRef.current[pageId];
    delete canvasRefs.current[pageId];
    setPages(newPages);
    if (newPages.length === 0) {
      setActive(null);
    } else if (activePageId === pageId) {
      const nextIdx = Math.min(idx, newPages.length - 1);
      setActive(newPages[nextIdx].id);
    }
    setRedrawTick(t => t + 1);
  };

  /* Handle drag-and-drop on the whole area */
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) handlePhotoFiles(e.dataTransfer.files);
  };

  /* Hidden file input for camera / photo upload */
  const photoInput = (
    <input
      ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple
      onChange={(e) => { handlePhotoFiles(e.target.files); e.target.value = ''; }}
      style={{ display: 'none' }}
    />
  );

  /* ── Choose input method (empty state) ── */
  if (pages.length === 0) return (
    <div>
      {photoInput}
      <div className="input-methods">
        <button className="im-btn" onClick={addCanvasPage}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>手写作答
        </button>
        <button className="im-btn" onClick={triggerPhotoUpload}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>拍照上传
        </button>
      </div>
    </div>
  );

  const activePageNum = pages.findIndex(p => p.id === activePageId) + 1;
  const activePageType = pages.find(p => p.id === activePageId)?.type;

  return (
    <div
      className="hw-area"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={dragOver ? { borderColor: 'var(--teal)', background: 'var(--teal-bg)' } : undefined}
    >
      {photoInput}
      <div className="hw-toolbar">
        <div className="hw-tools">
          <button className={'hw-btn' + (tool === 'pen' ? ' active' : '')} onClick={() => setTool('pen')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔
          </button>
          <button className={'hw-btn' + (tool === 'eraser' ? ' active' : '')} onClick={() => setTool('eraser')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>橡皮
          </button>
          <div className="hw-sep"></div>
          <button className="hw-btn" onClick={undo} title="撤销（当前画布页）">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>撤销
          </button>
          <button className="hw-btn" onClick={clearPage} title="清除（当前画布页）">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>清除
          </button>
          <div className="hw-sep"></div>
          <button className="hw-btn" onClick={triggerPhotoUpload} title="拍照 / 上传照片">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>拍照
          </button>
          {activeCanvasPage && activePageNum > 1 && <span className="hw-active-hint">操作：第{activePageNum}页</span>}
          {activePageType === 'photo' && <span className="hw-active-hint" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>当前：照片页</span>}
        </div>
      </div>
      <div className="hw-pages-scroll">
        {pages.map((page, idx) => (
          <div
            key={page.id}
            className={'hw-page-block' + (page.id === activePageId ? ' active' : '')}
            onClick={() => setActive(page.id)}
          >
            <div className="hw-page-hd">
              <span className="hw-page-num">
                第{idx + 1}页
                <span className={'hw-page-type-badge ' + (page.type === 'canvas' ? 'type-canvas' : 'type-photo')}>
                  {page.type === 'canvas' ? '手写' : '照片'}
                </span>
              </span>
              {pages.length > 1 && (
                <button className="hw-page-del" onClick={(e) => { e.stopPropagation(); deletePage(page.id); }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                  删除
                </button>
              )}
            </div>

            {page.type === 'canvas' ? (
              <div className="hw-canvas-wrap">
                <canvas
                  ref={el => { canvasRefs.current[page.id] = el; }}
                  width={W} height={H}
                  onMouseDown={e => handleStart(e, page.id)}
                  onMouseMove={e => handleMove(e, page.id)}
                  onMouseUp={handleEnd}
                  onMouseLeave={handleEnd}
                  onTouchStart={e => handleStart(e, page.id)}
                  onTouchMove={e => handleMove(e, page.id)}
                  onTouchEnd={handleEnd}
                  style={{ touchAction: 'none' }}
                />
              </div>
            ) : (
              <div className="hw-photo-wrap">
                {page.photoData ? (
                  <img src={page.photoData} alt={`照片 ${idx + 1}`} />
                ) : (
                  <div className="hw-photo-empty" onClick={(e) => { e.stopPropagation(); replacePhotoPage(page.id); }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    <span className="hw-photo-empty-text">点击选择照片</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Bottom: add canvas page + add photo */}
        <div className="hw-add-row">
          <button className="hw-add-btn" onClick={addCanvasPage}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>新增手写页</span>
          </button>
          <button className="hw-add-btn" onClick={triggerPhotoUpload}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <span>拍照上传</span>
          </button>
        </div>
      </div>
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
  // Flow states
  const [phase, setPhase] = useState('work');
  const [panelOpen, setPanelOpen] = useState(false);
  const [hasContent, setHasContent] = useState(false);

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
    setPanelOpen(true);
  };

  const isChecking = phase === 'checking' || phase === 'checking2';
  const showPanel = panelOpen && (phase === 'wrong1' || phase === 'retry' || phase === 'wrong2' || phase === 'passed');
  const showStep3 = phase === 'wrong2' || phase === 'passed';
  const canSubmit = hasContent && (phase === 'work' || phase === 'retry');

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

            {/* Unified handwriting + photo canvas */}
            <HandwritingCanvas onContentChange={setHasContent} />

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
