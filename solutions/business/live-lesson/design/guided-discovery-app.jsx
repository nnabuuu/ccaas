/* guided-discovery-app.jsx — 平方差公式 引导探究 */
const { useState, useRef, useEffect, useCallback, Fragment } = React;

/* ═══ Fade-in hook — replaces CSS animations that don't run in iframe ═══ */
function useFadeIn(delay) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const t = setTimeout(() => el.classList.add('visible'), (delay || 0) + 20);
    return () => clearTimeout(t);
  }, []);
  return ref;
}

/* ═══ KaTeX helper — use tex prop, not children ═══ */
function K({ tex, display }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.katex && typeof tex === 'string') {
      katex.render(tex, ref.current, { throwOnError: false, displayMode: !!display });
    }
  }, [tex, display]);
  return <span ref={ref}></span>;
}

/* ═══ MathInput — multi-mode input (keyboard / handwriting / photo) ═══ */
/* Handwriting matches Practice v3 (single-page variant) */
function MathInput({ placeholder, value, onChange, disabled, status, label }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState('keyboard'); // keyboard | handwrite | photo
  const [textVal, setTextVal] = useState(value || '');
  const [photoData, setPhotoData] = useState(null);
  const [hasStrokes, setHasStrokes] = useState(false);
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const drawingRef = useRef(false);
  const pathRef = useRef([]);
  const [tool, setTool] = useState('pen');
  const [redrawTick, setRedrawTick] = useState(0);
  const fileRef = useRef(null);
  /* Match Practice v3 canvas dimensions */
  const W = 1200, H = 480;

  // Sync text value up
  useEffect(() => {
    if (mode === 'keyboard') onChange(textVal);
  }, [textVal, mode]);

  // Notify parent of non-keyboard content
  useEffect(() => {
    if (mode === 'handwrite' && hasStrokes) onChange('__handwrite__');
    if (mode === 'photo' && photoData) onChange('__photo__');
  }, [mode, hasStrokes, photoData]);

  // Canvas drawing — identical to Practice v3
  const redraw = useCallback(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    strokesRef.current.forEach(s => {
      if (s.points.length < 1) return;
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 28; ctx.strokeStyle = 'rgba(0,0,0,1)'; }
      else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = s.color || '#1c1c1a'; ctx.lineWidth = 2.5; }
      ctx.beginPath(); ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke(); ctx.restore();
    });
  }, []);

  useEffect(() => { redraw(); }, [redrawTick, redraw]);

  const getPos = (e) => {
    const c = canvasRef.current; if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) };
  };
  const onStart = (e) => {
    e.preventDefault(); drawingRef.current = true;
    const pos = getPos(e); pathRef.current = [pos];
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = 28; ctx.strokeStyle = 'rgba(0,0,0,1)'; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#1c1c1a'; ctx.lineWidth = 2.5; }
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y); ctx.lineTo(pos.x + 0.1, pos.y); ctx.stroke();
  };
  const onMove = (e) => {
    if (!drawingRef.current) return; e.preventDefault();
    const pos = getPos(e); pathRef.current.push(pos);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(pos.x, pos.y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  };
  const onEnd = () => {
    if (!drawingRef.current) return; drawingRef.current = false;
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    if (pathRef.current.length > 0) {
      strokesRef.current.push({ tool, color: '#1c1c1a', points: [...pathRef.current] });
      setHasStrokes(true);
    }
    pathRef.current = [];
  };
  const undo = () => { strokesRef.current.pop(); setRedrawTick(t => t + 1); setHasStrokes(strokesRef.current.length > 0); };
  const clearCanvas = () => { strokesRef.current = []; setRedrawTick(t => t + 1); setHasStrokes(false); };

  // Export canvas to thumbnail dataURL for preview
  const [canvasThumb, setCanvasThumb] = useState(null);
  useEffect(() => {
    if (!hasStrokes) { setCanvasThumb(null); return; }
    // Debounce thumbnail generation
    const timer = setTimeout(() => {
      const c = canvasRef.current; if (!c) return;
      try { setCanvasThumb(c.toDataURL('image/png')); } catch(e) {}
    }, 200);
    return () => clearTimeout(timer);
  }, [hasStrokes, redrawTick]);

  // Photo — drag-and-drop support
  const [dragOver, setDragOver] = useState(false);
  const handlePhoto = (files) => {
    const f = Array.from(files).find(f => f.type.startsWith('image/'));
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoData(ev.target.result);
    reader.readAsDataURL(f);
  };

  // Status classes for the collapsed blank
  const statusCls = status === 'correct' ? ' correct' : status === 'wrong' ? ' wrong' : '';
  const hasContent = (mode === 'keyboard' && textVal.trim()) || (mode === 'handwrite' && hasStrokes) || (mode === 'photo' && photoData);

  // Render content preview for collapsed state
  const renderPreview = () => {
    if (mode === 'keyboard' && textVal.trim()) {
      return <span className="math-input-text-preview">{textVal}</span>;
    }
    if (mode === 'handwrite' && canvasThumb) {
      return <img className="math-input-thumb" src={canvasThumb} alt="手写" />;
    }
    if (mode === 'photo' && photoData) {
      return <img className="math-input-thumb" src={photoData} alt="照片" />;
    }
    return <span className="math-input-ph">{label || '点击作答'}</span>;
  };

  // Confirm handler — collapse panel, generate thumbnail
  const confirmInput = () => {
    // Generate canvas thumbnail before closing
    if (mode === 'handwrite' && canvasRef.current && hasStrokes) {
      try { setCanvasThumb(canvasRef.current.toDataURL('image/png')); } catch(e) {}
    }
    setExpanded(false);
  };

  // Whether current mode has content to confirm
  const canConfirm = (mode === 'keyboard' && textVal.trim()) || (mode === 'handwrite' && hasStrokes) || (mode === 'photo' && photoData);

  if (disabled) {
    return (
      <span className={'math-input-collapsed has-content' + statusCls} style={{ cursor: 'default' }}>
        {renderPreview()}
      </span>
    );
  }

  return (
    <span className="math-input-root">
      <span className={'math-input-collapsed' + statusCls + (expanded ? ' active' : '') + (hasContent ? ' has-content' : ' empty')} onClick={() => setExpanded(!expanded)}>
        {renderPreview()}
        {hasContent && !expanded && <span className="math-input-edit-hint">点击修改</span>}
      </span>

      {expanded && (
        <div className="math-input-panel">
          {/* Tab bar — matches v3 input-methods style */}
          <div className="math-input-tabs">
            {[['keyboard', '键盘', 'M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z|||M8 12h8|||M8 15h5'],
              ['handwrite', '手写', 'M12 20h9|||M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z'],
              ['photo', '拍照', 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z']
            ].map(([m, l, paths]) => (
              <button key={m} className={'math-input-tab' + (mode === m ? ' active' : '')} onClick={() => setMode(m)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {paths.split('|||').map((d, pi) => <path key={pi} d={d} />)}
                  {m === 'photo' && <circle cx="12" cy="13" r="4" />}
                </svg>
                {l}
              </button>
            ))}
            <button className="math-input-close" onClick={() => setExpanded(false)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
              收起
            </button>
          </div>

          {mode === 'keyboard' && (
            <div className="math-input-kb">
              <input
                className="math-input-field"
                value={textVal}
                onChange={e => setTextVal(e.target.value)}
                placeholder={placeholder}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && textVal.trim()) confirmInput(); }}
              />
              <div className="math-input-kb-hint">提示：² 可输入 ^2，× 可用 *</div>
            </div>
          )}

          {mode === 'handwrite' && (
            <div className="hw-area" style={{ margin: 0, borderRadius: 0, border: 'none', animation: 'none' }}>
              {/* Toolbar — identical to Practice v3 */}
              <div className="hw-toolbar">
                <div className="hw-tools">
                  <button className={'hw-btn' + (tool === 'pen' ? ' active' : '')} onClick={() => setTool('pen')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>笔
                  </button>
                  <button className={'hw-btn' + (tool === 'eraser' ? ' active' : '')} onClick={() => setTool('eraser')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>橡皮
                  </button>
                  <div className="hw-sep"></div>
                  <button className="hw-btn" onClick={undo} title="撤销">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>撤销
                  </button>
                  <button className="hw-btn" onClick={clearCanvas} title="清除">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>清除
                  </button>
                </div>
              </div>
              {/* Single-page canvas — same grid paper bg as v3 */}
              <div className="hw-canvas-wrap">
                <canvas
                  ref={canvasRef} width={W} height={H}
                  onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
                  onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
                  style={{ touchAction: 'none' }}
                />
              </div>
            </div>
          )}

          {mode === 'photo' && (
            <div className="math-input-photo"
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) handlePhoto(e.dataTransfer.files); }}
            >
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { handlePhoto(e.target.files); e.target.value = ''; }} />
              {photoData ? (
                <div className="math-input-photo-preview">
                  <img src={photoData} alt="上传的照片" />
                  <button className="math-input-photo-change" onClick={() => fileRef.current?.click()}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    重新选择
                  </button>
                </div>
              ) : (
                <div className={'math-input-photo-drop' + (dragOver ? ' drag-over' : '')} onClick={() => fileRef.current?.click()}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <span>点击拍照或上传，也可拖拽图片到此处</span>
                </div>
              )}
            </div>
          )}

          {/* ── Confirm button ── */}
          {canConfirm && (
            <div className="math-input-confirm-row">
              <button className="math-input-confirm" onClick={confirmInput}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                确认输入
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

/* ═══ Inline 2-choice ═══ */
function InlineChoice({ options, correctIdx, id, answered, onAnswer }) {
  const picked = answered[id];
  const hasPicked = picked != null;
  const isCorrect = hasPicked && picked === correctIdx;
  // "locked" = answered correctly (no more changes); wrong answers are NOT locked
  const locked = hasPicked && isCorrect;

  const handlePick = (i) => {
    if (locked) return;
    onAnswer(id, i);
  };

  return (
    <span className={'inline-choice-wrap' + (!hasPicked ? ' awaiting' : '')}>
      {options.map((opt, i) => {
        let cls = 'inline-choice';
        if (locked) {
          cls += ' locked';
          if (i === correctIdx) cls += ' correct';
        } else if (hasPicked) {
          // Wrong state — highlight wrong pick, show correct
          if (i === picked) cls += ' wrong';
        } else if (i === picked) {
          cls += ' selected';
        }
        return <button key={i} className={cls} onClick={() => handlePick(i)}>{opt}</button>;
      })}
      {!hasPicked && <span className="inline-choice-tag">选一个</span>}
      {hasPicked && !isCorrect && <span className="inline-choice-retry">再选 ↻</span>}
    </span>
  );
}

/* ═══ Q1: Observation ═══ */
function Question1({ active, onComplete }) {
  const [answers, setAnswers] = useState({});
  const fadeRef = useFadeIn(0);
  const choiceKeys = ['c1a', 'c1b', 'c2a', 'c2b'];
  const correctMap = { c1a: 0, c1b: 1, c2a: 0, c2b: 1 };

  const handleAnswer = (id, val) => {
    setAnswers(prev => ({ ...prev, [id]: val }));
  };

  const allAnswered = choiceKeys.every(k => answers[k] != null);
  const allCorrect = choiceKeys.every(k => answers[k] === correctMap[k]);

  return (
    <div ref={fadeRef} className={'q-card' + (!active ? ' locked' : '')}>
      <div className="q-header">
        <div className="q-num">1</div>
        <div className="q-title">观察下面的乘法算式与结果，看看能发现什么？</div>
      </div>

      <div className="q-body">
        <table className="obs-table">
          <thead>
            <tr><th>乘法算式</th><th>结果</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span style={{ fontSize: '1.1em' }}>
                  (<span className="hl-same"><K tex="x" /></span>
                  <span className="hl-opp"><K tex="+2" /></span>)(<span className="hl-same"><K tex="x" /></span>
                  <span className="hl-opp"><K tex="-2" /></span>)
                </span>
              </td>
              <td><K tex="x^2 - 4" /></td>
            </tr>
            <tr>
              <td>
                <span style={{ fontSize: '1.1em' }}>
                  (<span className="hl-same"><K tex="3" /></span>
                  <span className="hl-opp"><K tex="+y" /></span>)(<span className="hl-same"><K tex="3" /></span>
                  <span className="hl-opp"><K tex="-y" /></span>)
                </span>
              </td>
              <td><K tex="9 - y^2" /></td>
            </tr>
            <tr>
              <td>
                <span style={{ fontSize: '1.1em' }}>
                  (<span className="hl-same"><K tex="2a" /></span>
                  <span className="hl-opp"><K tex="+b" /></span>)(<span className="hl-same"><K tex="2a" /></span>
                  <span className="hl-opp"><K tex="-b" /></span>)
                </span>
              </td>
              <td><K tex="4a^2 - b^2" /></td>
            </tr>
          </tbody>
        </table>

        <p style={{ marginTop: 14, marginBottom: 6, fontSize: 13, color: 'var(--t2)', lineHeight: 1.8 }}>
          <span className="hl-same" style={{ marginRight: 4 }}>标红</span>的项：
          <K tex="x" /> 和 <K tex="x" />、<K tex="3" /> 和 <K tex="3" />、<K tex="2a" /> 和 <K tex="2a" />，
          这些完全相同的项我们称为{' '}
          <InlineChoice options={['相同项', '相反项']} correctIdx={0} id="c1a" answered={answers} onAnswer={handleAnswer} />
        </p>

        <p style={{ marginBottom: 6, fontSize: 13, color: 'var(--t2)', lineHeight: 1.8 }}>
          <span className="hl-opp" style={{ marginRight: 4 }}>标蓝</span>的项：
          <K tex="+2" /> 和 <K tex="-2" />、<K tex="+y" /> 和 <K tex="-y" />、<K tex="+b" /> 和 <K tex="-b" />，
          这些只有符号相反的项叫做{' '}
          <InlineChoice options={['相同项', '相反项']} correctIdx={1} id="c1b" answered={answers} onAnswer={handleAnswer} />
        </p>

        <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }}></div>

        <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.8 }}>
          最后的结果可以看成是：
          <InlineChoice options={['相同项', '相反项']} correctIdx={0} id="c2a" answered={answers} onAnswer={handleAnswer} />
          {' '}的平方 减{' '}
          <InlineChoice options={['相同项', '相反项']} correctIdx={1} id="c2b" answered={answers} onAnswer={handleAnswer} />
          {' '}的平方。
        </p>

        {allCorrect && (
          <div className="ai-fb fb-correct">
            <div className="ai-fb-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
            <div className="ai-fb-body">
              <strong>全部正确！</strong> 你发现了规律：两个括号中，一项相同、一项相反，结果是相同项的平方减去相反项的平方。
            </div>
          </div>
        )}

        {allCorrect && (
          <button className="next-step-btn" onClick={onComplete}>继续下一问 →</button>
        )}
      </div>
    </div>
  );
}

/* ═══ Q2: Write the formula ═══ */
function Question2({ active, onComplete }) {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const fadeRef = useFadeIn(100);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const normalize = (s) => s.replace(/\s+/g, '').replace(/（/g, '(').replace(/）/g, ')');

  const checkAnswer = () => {
    // For handwrite/photo, auto-pass (AI will grade asynchronously)
    if (left === '__handwrite__' || left === '__photo__' || right === '__handwrite__' || right === '__photo__') {
      setSubmitted(true);
      setIsCorrect(true); // Accept non-keyboard input
      return;
    }
    const l = normalize(left);
    const r = normalize(right);
    const leftOk = ['(a+b)(a-b)', '(a-b)(a+b)'].includes(l);
    const rightOk = ['a²-b²', 'a^2-b^2', 'a2-b2'].includes(r.replace(/²/g, '2').replace(/\^/g, ''));
    const wrongOrder = ['b²-a²', 'b^2-a^2', 'b2-a2'].includes(r.replace(/²/g, '2').replace(/\^/g, ''));

    setSubmitted(true);
    setIsCorrect(leftOk && rightOk && !wrongOrder);
  };

  const hasContent = left.trim() && right.trim();

  return (
    <div ref={fadeRef} className={'q-card' + (!active ? ' locked' : '')}>
      <div className="q-header">
        <div className="q-num">2</div>
        <div className="q-title">你能将发现的规律用符号 <K tex="a, b" /> 表示出来吗？</div>
      </div>

      <div className="q-body">
        <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--t2)', textAlign: 'center' }}>请填写等式的两边：</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', margin: '8px 0 4px', padding: '16px 0' }}>
          <MathInput
            placeholder="(a+b)(a-b)"
            label="等号左边"
            value={left}
            onChange={setLeft}
            disabled={submitted && isCorrect}
            status={submitted ? (isCorrect ? 'correct' : 'wrong') : null}
          />
          <span style={{ fontSize: 24, color: 'var(--t3)', fontWeight: 400 }}>=</span>
          <MathInput
            placeholder="a²-b²"
            label="等号右边"
            value={right}
            onChange={setRight}
            disabled={submitted && isCorrect}
            status={submitted ? (isCorrect ? 'correct' : 'wrong') : null}
          />
        </div>

        {!submitted && (
          <div className="submit-row" style={{ marginTop: 8 }}>
            <button className="submit-sm" disabled={!hasContent} onClick={checkAnswer}>确认</button>
          </div>
        )}

        {submitted && isCorrect && (
          <div className="ai-fb fb-correct" style={{ marginTop: 12 }}>
            <div className="ai-fb-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
            <div className="ai-fb-body">
              <strong>正确！</strong> <K tex="(a+b)(a-b) = a^2 - b^2" />，注意等号右边是 <K tex="a^2 - b^2" /> 而不是 <K tex="b^2 - a^2" />，顺序很重要。
            </div>
          </div>
        )}
        {submitted && !isCorrect && (
          <div className="ai-fb fb-wrong" style={{ marginTop: 12 }}>
            <div className="ai-fb-icon"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
            <div className="ai-fb-body">
              <strong>请检查。</strong> 左边应该写 <K tex="(a+b)(a-b)" />，右边应该写 <K tex="a^2 - b^2" />。注意是 <K tex="a^2" /> 减 <K tex="b^2" />，顺序不能反。
              <button style={{ display: 'block', marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11, fontWeight: 500, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={() => { setSubmitted(false); }}>修改答案</button>
            </div>
          </div>
        )}

        {submitted && isCorrect && (
          <button className="next-step-btn" onClick={onComplete}>继续下一问 →</button>
        )}
      </div>
    </div>
  );
}

/* ═══ Q3: Verify with polynomial multiplication ═══ */
function Question3({ active, onComplete }) {
  const [cells, setCells] = useState(['', '', '', '']);
  const [cellStatus, setCellStatus] = useState([null, null, null, null]);
  const [phase, setPhase] = useState('input'); // input | expand | cancel | result
  const fadeRef = useFadeIn(200);
  const inputRefs = useRef([]);

  const normalize = s => s.replace(/\s/g, '').replace(/²/g, '^2').replace(/\^2/g, '2').toLowerCase();
  const validAnswers = [['a2'], ['-ab', '-ba'], ['ab', 'ba', '+ab', '+ba'], ['-b2']];
  const checkCell = (val, idx) => validAnswers[idx].includes(normalize(val));

  const updateCell = (idx, val) => {
    if (phase !== 'input') return;
    const nc = [...cells]; nc[idx] = val; setCells(nc);
    if (cellStatus[idx]) { const ns = [...cellStatus]; ns[idx] = null; setCellStatus(ns); }
  };

  const handleSubmit = () => {
    const ns = cells.map((c, i) => c.trim() ? (checkCell(c, i) ? 'correct' : 'wrong') : 'wrong');
    setCellStatus(ns);
    if (ns.every(s => s === 'correct')) {
      setPhase('expand');
      setTimeout(() => setPhase('cancel'), 900);
      setTimeout(() => setPhase('result'), 1700);
    }
  };

  const handleRetry = () => {
    const nc = cells.map((c, i) => cellStatus[i] === 'wrong' ? '' : c);
    setCells(nc);
    setCellStatus(nc.map(c => c ? 'correct' : null));
    setTimeout(() => {
      const emptyIdx = nc.findIndex(c => !c);
      if (emptyIdx >= 0 && inputRefs.current[emptyIdx]) inputRefs.current[emptyIdx].focus();
    }, 50);
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx < 3) inputRefs.current[idx + 1]?.focus();
    }
  };

  const canSubmit = cells.every(c => c.trim());
  const hasWrong = cellStatus.some(s => s === 'wrong');
  const hints = ['a \\cdot a', 'a \\cdot (-b)', 'b \\cdot a', 'b \\cdot (-b)'];

  useEffect(() => {
    if (active && phase === 'input') {
      setTimeout(() => inputRefs.current[0]?.focus(), 350);
    }
  }, [active]);

  const retryBtnStyle = { display: 'block', marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11, fontWeight: 500, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div ref={fadeRef} className={'q-card' + (!active ? ' locked' : '')}>
      <div className="q-header">
        <div className="q-num">3</div>
        <div className="q-title">用多项式乘法验证上面的规律</div>
      </div>

      <div className="q-body">
        <p style={{ marginBottom: 4, fontSize: 13, color: 'var(--t2)', lineHeight: 1.7 }}>
          用乘法分配律展开 <K tex="(a+b)(a-b)" />，在表格中填入每一项的乘积：
        </p>

        {/* Multiplication Grid */}
        <div className="mg-grid">
          <div className="mg-corner">×</div>
          <div className="mg-colh"><K tex="a" /></div>
          <div className="mg-colh"><K tex="-b" /></div>
          <div className="mg-rowh"><K tex="a" /></div>
          {[0, 1].map(i => (
            <div className="mg-cell" key={i}>
              <span className="mg-hint"><K tex={hints[i]} /></span>
              <input ref={el => { inputRefs.current[i] = el; }}
                className={'mg-input' + (cellStatus[i] ? (' ' + cellStatus[i]) : '')}
                value={cells[i]} onChange={e => updateCell(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                placeholder="?" disabled={phase !== 'input'} autoComplete="off" />
            </div>
          ))}
          <div className="mg-rowh"><K tex="+b" /></div>
          {[2, 3].map(i => (
            <div className="mg-cell" key={i}>
              <span className="mg-hint"><K tex={hints[i]} /></span>
              <input ref={el => { inputRefs.current[i] = el; }}
                className={'mg-input' + (cellStatus[i] ? (' ' + cellStatus[i]) : '')}
                value={cells[i]} onChange={e => updateCell(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                placeholder="?" disabled={phase !== 'input'} autoComplete="off" />
            </div>
          ))}
        </div>

        {/* Submit */}
        {phase === 'input' && !hasWrong && (
          <div className="submit-row">
            <button className="submit-sm" disabled={!canSubmit} onClick={handleSubmit}>确认</button>
          </div>
        )}

        {/* Wrong feedback */}
        {phase === 'input' && hasWrong && (
          <div className="ai-fb fb-wrong" style={{ marginTop: 12 }}>
            <div className="ai-fb-icon"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
            <div className="ai-fb-body">
              <strong>部分有误。</strong> 红色标记的格子需要重新填写，注意乘法运算时<strong>正负号</strong>的处理。
              <button style={retryBtnStyle} onClick={handleRetry}>修改答案</button>
            </div>
          </div>
        )}

        {/* Expansion + Cancellation */}
        {phase !== 'input' && (
          <div className="exp-box">
            <div className="exp-label">合并所有项</div>
            <div className="exp-line">
              <span className="exp-eq">=</span>
              <span className="exp-term"><K tex="a^2" /></span>
              <span className={'exp-term exp-cancel' + (phase === 'cancel' || phase === 'result' ? ' struck' : '')}>
                <K tex="- ab" />
              </span>
              <span className={'exp-term exp-cancel' + (phase === 'cancel' || phase === 'result' ? ' struck' : '')}>
                <K tex="+ ab" />
              </span>
              <span className="exp-term"><K tex="- b^2" /></span>
            </div>
            {(phase === 'cancel' || phase === 'result') && (
              <div className="exp-cancel-note">
                <K tex="-ab + ab = 0" />
                <span>，互相抵消！</span>
              </div>
            )}
            {phase === 'result' && (
              <div className="exp-line exp-final" className="exp-line exp-final">
                <span className="exp-eq">=</span>
                <span className="exp-term"><K tex="a^2 - b^2" /></span>
              </div>
            )}
          </div>
        )}

        {/* Success feedback */}
        {phase === 'result' && (
          <Fragment>
            <div className="ai-fb fb-correct" style={{ marginTop: 12 }}>
              <div className="ai-fb-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
              <div className="ai-fb-body">
                <strong>验证成功！</strong> 展开后，中间的 <K tex="-ab" /> 和 <K tex="+ab" /> 互相抵消，最终得到 <K tex="a^2 - b^2" />，与我们发现的规律完全一致。
              </div>
            </div>
            <button className="next-step-btn" onClick={onComplete}>继续下一问 →</button>
          </Fragment>
        )}
      </div>
    </div>
  );
}

/* ═══ Q4: Describe in words ═══ */
function Question4({ active, onComplete }) {
  const [blank1, setBlank1] = useState('');
  const [blank2, setBlank2] = useState('');
  const fadeRef = useFadeIn(300);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const checkAnswer = () => {
    const b1 = blank1.trim();
    const b2 = blank2.trim();
    const ok = b1 === '和' && b2 === '差';
    setSubmitted(true);
    setIsCorrect(ok);
  };

  return (
    <div ref={fadeRef} className={'q-card' + (!active ? ' locked' : '')}>
      <div className="q-header">
        <div className="q-num">4</div>
        <div className="q-title">用文字语言来描述上面的规律</div>
      </div>

      <div className="q-body">
        <p style={{ marginBottom: 10, fontSize: 13, color: 'var(--t2)' }}>请在横线上填入合适的字：</p>
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px 18px', fontSize: 14, lineHeight: 2, color: 'var(--t1)', fontWeight: 500 }}>
          两个数的
          <input
            className={'blank-input' + (submitted ? (isCorrect ? ' correct' : ' wrong') : '')}
            value={blank1}
            onChange={e => setBlank1(e.target.value)}
            placeholder="___"
            disabled={submitted && isCorrect}
            style={{ minWidth: 48, fontSize: 14, background: 'var(--surface)' }}
          />
          与这两个数的
          <input
            className={'blank-input' + (submitted ? (isCorrect ? ' correct' : ' wrong') : '')}
            value={blank2}
            onChange={e => setBlank2(e.target.value)}
            placeholder="___"
            disabled={submitted && isCorrect}
            style={{ minWidth: 48, fontSize: 14, background: 'var(--surface)' }}
          />
          的乘积等于这两个数的<strong>平方差</strong>。
        </div>

        {!submitted && (
          <div className="submit-row">
            <button className="submit-sm" disabled={!blank1.trim() || !blank2.trim()} onClick={checkAnswer}>确认</button>
          </div>
        )}

        {submitted && isCorrect && (
          <div className="ai-fb fb-correct" style={{ marginTop: 12 }}>
            <div className="ai-fb-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
            <div className="ai-fb-body">
              <strong>正确！</strong> 两个数的<strong>和</strong>与这两个数的<strong>差</strong>的乘积等于这两个数的平方差。
            </div>
          </div>
        )}
        {submitted && !isCorrect && (
          <div className="ai-fb fb-wrong" style={{ marginTop: 12 }}>
            <div className="ai-fb-icon"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
            <div className="ai-fb-body">
              <strong>再想想。</strong> <K tex="(a+b)" /> 是两个数的「和」，<K tex="(a-b)" /> 是两个数的「差」。
              <button style={{ display: 'block', marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11, fontWeight: 500, color: 'var(--t2)', cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={() => { setSubmitted(false); }}>修改答案</button>
            </div>
          </div>
        )}

        {submitted && isCorrect && onComplete && (
          <button className="next-step-btn" onClick={onComplete}>查看总结 →</button>
        )}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
function GuidedDiscoveryApp() {
  // Step 0 = Q1 active, step 1 = Q2 active, etc.
  const [step, setStep] = useState(0);
  const scrollRef = useRef(null);

  const advance = (nextStep) => {
    setStep(nextStep);
    // Scroll to new card
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div className="app">
      {/* ── Top Bar ── */}
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">多项式乘法 · 平方差公式</span>
          <span className="topbar-class">初二(3)班 · 数学</span>
        </div>
        <div className="topbar-right">
          <span className="topbar-badge">课堂讲解</span>
          <span className="topbar-timer">08:45</span>
          <span className="topbar-timer-of">/ 15'</span>
        </div>
      </div>

      {/* ── Main ── */}
      <div className="main-row">
        <div className="task-col">
          <div className="task-scroll" ref={scrollRef}>
            <div className="section-label-row">引导探究 · 平方差公式</div>

            {/* Progress — sticky, full-width */}
            <div className="step-progress">
              {[
                { label: '观察规律' },
                { label: '符号表示' },
                { label: '验证公式' },
                { label: '文字描述' },
              ].map((s, i) => (
                <span key={i} style={{ display: 'contents' }}>
                  {i > 0 && <div className={'step-connector' + (step > i - 1 ? ' filled' : '')}></div>}
                  <div className="step-item">
                    <div className={'step-dot' + (step === i ? ' active' : '') + (step > i ? ' done' : '')}>
                      {step > i ? '✓' : i + 1}
                    </div>
                    <span className={'step-label' + (step === i ? ' active' : '') + (step > i ? ' done' : '')}>{s.label}</span>
                  </div>
                </span>
              ))}
            </div>

            {/* Q1 */}
            <Question1 active={step >= 0} onComplete={() => advance(1)} />

            {/* Q2 */}
            {step >= 1 && <Question2 active={step >= 1} onComplete={() => advance(2)} />}

            {/* Q3 */}
            {step >= 2 && <Question3 active={step >= 2} onComplete={() => advance(3)} />}

            {/* Q4 */}
            {step >= 3 && <Question4 active={step >= 3} onComplete={() => advance(4)} />}

            {/* Summary */}
            {step >= 4 && (
              <div className="summary-card">
                <div className="summary-label">公式总结</div>
                <K display tex="(a+b)(a-b) = a^2 - b^2" />
                <div className="summary-title">平方差公式</div>
                <p style={{ fontSize: 13, color: 'var(--teal)', lineHeight: 1.7, marginTop: 8 }}>
                  两个数的和与这两个数的差的乘积等于这两个数的平方差。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<GuidedDiscoveryApp />);
