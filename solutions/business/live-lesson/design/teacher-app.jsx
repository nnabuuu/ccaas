/* teacher-app.jsx — Teacher Observation View for 多项式乘法 Practice */
const { useState, useRef, useEffect, useCallback, Fragment } = React;

/* ═══ Mock Data ═══ */
/* Solutions — each is [page1Lines, page2Lines, ...] */
const CORRECT_1P = [['(y + 2)(y − 2)','= y·y + y·(−2) + 2·y + 2·(−2)','= y² − 2y + 2y − 4','= y² − 4']];
const CORRECT_2P = [['(y + 2)(y − 2)','= y·y + y·(−2) + 2·y + 2·(−2)'],['= y² − 2y + 2y − 4','= y² − 4']];
const SIGN_ERR_1P = [['(y + 2)(y − 2)','= y·y + y·(−2) + 2·y + 2·(−2)','= y² − 2y + 2y + 4','= y² + 4']];
const SIGN_ERR_2P = [['(y + 2)(y − 2)','= y·y + y·(−2) + 2·y + 2·(−2)'],['= y² − 2y + 2y + 4','= y² + 4']];
const INCOMPLETE_1P = [['(y + 2)(y − 2)','= y² + y·(−2) + 2·(−2)','= y² − 2y − 4']];
const COMBINE_ERR_2P = [['(y + 2)(y − 2)','= y·y + y·(−2) + 2·y + 2·(−2)'],['= y² − 2y + 2y − 4','= y² − 4y − 4']];

const S = [
  { id:1,  n:'陈昕妍', st:'done', h:0, m:'hw', ok:true,  t:272, sol:CORRECT_1P },
  { id:2,  n:'李奕辰', st:'done', h:0, m:'hw', ok:true,  t:315, sol:CORRECT_2P },
  { id:3,  n:'王译文', st:'done', h:1, m:'hw', ok:false, t:523, sol:SIGN_ERR_2P, err:'符号错误：最后一项 2·(−2) 应得 −4' },
  { id:4,  n:'张皓月', st:'done', h:0, m:'photo', ok:true, t:198, sol:CORRECT_1P },
  { id:5,  n:'刘子墨', st:'prog', h:1, m:'hw' },
  { id:6,  n:'赵雪莉', st:'idle' },
  { id:7,  n:'孙楠语', st:'done', h:2, m:'hw', ok:true,  t:487, sol:CORRECT_2P },
  { id:8,  n:'周航宇', st:'done', h:0, m:'photo', ok:true, t:245, sol:CORRECT_1P },
  { id:9,  n:'吴思涵', st:'prog', h:0, m:'hw' },
  { id:10, n:'郑若曦', st:'done', h:1, m:'hw', ok:true,  t:398, sol:CORRECT_1P },
  { id:11, n:'黄婉晴', st:'done', h:1, m:'photo', ok:false, t:456, sol:INCOMPLETE_1P, err:'展开不完整：漏掉 2·y 项' },
  { id:12, n:'马乐瑶', st:'done', h:0, m:'hw', ok:true,  t:210, sol:CORRECT_1P },
  { id:13, n:'胡恩齐', st:'prog', h:0, m:'hw' },
  { id:14, n:'林澜',   st:'done', h:2, m:'hw', ok:true,  t:510, sol:CORRECT_2P },
  { id:15, n:'徐晨曦', st:'done', h:0, m:'photo', ok:true, t:278, sol:CORRECT_1P },
  { id:16, n:'高远航', st:'done', h:1, m:'hw', ok:false, t:445, sol:COMBINE_ERR_2P, err:'合并同类项错误：−2y+2y≠−4y' },
  { id:17, n:'朱思语', st:'done', h:0, m:'hw', ok:true,  t:189, sol:CORRECT_1P },
  { id:18, n:'何子睿', st:'idle' },
  { id:19, n:'郭斐然', st:'done', h:2, m:'photo', ok:false, t:502, sol:SIGN_ERR_1P, err:'符号错误：最后一项符号弄反' },
  { id:20, n:'罗婉儿', st:'prog', h:1, m:'hw' },
  { id:21, n:'曾以柔', st:'done', h:0, m:'hw', ok:true,  t:325, sol:CORRECT_1P },
  { id:22, n:'蔡明轩', st:'done', h:1, m:'hw', ok:true,  t:410, sol:CORRECT_2P },
  { id:23, n:'邓梓涵', st:'prog', h:0, m:'photo' },
  { id:24, n:'程一帆', st:'done', h:2, m:'hw', ok:false, t:530, sol:INCOMPLETE_1P, err:'展开不完整：少写了 2·y 项' },
  { id:25, n:'韩思远', st:'done', h:0, m:'hw', ok:true,  t:156, sol:CORRECT_1P },
  { id:26, n:'董思齐', st:'done', h:1, m:'hw', ok:true,  t:388, sol:CORRECT_1P },
  { id:27, n:'袁朗',   st:'prog', h:1, m:'hw' },
  { id:28, n:'谢宇航', st:'done', h:0, m:'photo', ok:true, t:267, sol:CORRECT_1P },
  { id:29, n:'唐诗雅', st:'done', h:2, m:'hw', ok:true,  t:495, sol:CORRECT_2P },
  { id:30, n:'姚明泽', st:'prog', h:0, m:'hw' },
  { id:31, n:'彭雨萱', st:'done', h:1, m:'photo', ok:false, t:478, sol:SIGN_ERR_1P, err:'符号错误：2·(−2)=+4' },
  { id:32, n:'潘若水', st:'done', h:0, m:'hw', ok:true,  t:340, sol:CORRECT_1P },
  { id:33, n:'冯子涵', st:'idle' },
  { id:34, n:'贾小诺', st:'done', h:2, m:'hw', ok:false, t:515, sol:INCOMPLETE_1P, err:'展开不完整：只写了前两项' },
  { id:35, n:'夏天依', st:'done', h:0, m:'hw', ok:true,  t:223, sol:CORRECT_1P },
  { id:36, n:'石嘉禾', st:'prog', h:1, m:'hw' },
  { id:37, n:'钟意',   st:'done', h:1, m:'photo', ok:true, t:402, sol:CORRECT_1P },
  { id:38, n:'方晓晨', st:'done', h:0, m:'hw', ok:true,  t:295, sol:CORRECT_1P },
  { id:39, n:'丁一凡', st:'prog', h:0, m:'hw' },
  { id:40, n:'秦若兰', st:'done', h:1, m:'hw', ok:false, t:460, sol:COMBINE_ERR_2P, err:'合并同类项错误' },
  { id:41, n:'田佳怡', st:'done', h:0, m:'photo', ok:true, t:310, sol:CORRECT_1P },
  { id:42, n:'严子轩', st:'idle' },
];

const done = S.filter(s => s.st === 'done');
const prog = S.filter(s => s.st === 'prog');
const idle = S.filter(s => s.st === 'idle');
const correctCount = done.filter(s => s.ok).length;
const wrongCount = done.filter(s => !s.ok).length;
const h0 = done.filter(s => s.h === 0).length;
const h1 = done.filter(s => s.h === 1).length;
const h2 = done.filter(s => s.h === 2).length;

function fmtTime(sec) {
  if (!sec) return '—';
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}

/* ═══ Stroke Replay Canvas ═══ */
function ReplayCanvas({ lines }) {
  const canvasRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(1);
  const animRef = useRef(null);
  const charsRef = useRef([]);
  const W = 520, H = 200;

  useEffect(() => {
    document.fonts.ready.then(() => { calcChars(); drawAll(); });
  }, [lines]);

  const calcChars = () => {
    const c = canvasRef.current; if (!c || !lines) return;
    const ctx = c.getContext('2d');
    const font = "22px 'Caveat','PingFang SC',sans-serif";
    ctx.font = font;
    const chars = [];
    (lines || []).forEach((line, li) => {
      let x = 28; const y = 40 + li * 44;
      for (const ch of line) { const w = ctx.measureText(ch).width; chars.push({ ch, x, y, w, lineEnd: false }); x += w; }
      if (chars.length > 0) chars[chars.length - 1].lineEnd = true;
    });
    charsRef.current = chars;
  };

  const drawUpTo = (n, cursor) => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.font = "22px 'Caveat','PingFang SC',sans-serif";
    ctx.fillStyle = '#1c1c1a';
    const chars = charsRef.current;
    for (let i = 0; i < Math.min(n, chars.length); i++) ctx.fillText(chars[i].ch, chars[i].x, chars[i].y);
    if (cursor && n > 0 && n < chars.length) {
      const last = chars[n - 1];
      ctx.beginPath(); ctx.arc(last.x + last.w + 3, last.y - 5, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#942929'; ctx.fill();
    }
  };

  const drawAll = () => { drawUpTo(charsRef.current.length, false); setProgress(1); };

  const startReplay = () => {
    if (playing) { stopReplay(); return; }
    setPlaying(true);
    const total = charsRef.current.length; if (total === 0) return;
    let idx = 0; drawUpTo(0, false); setProgress(0);
    const tick = () => {
      idx++; drawUpTo(idx, true); setProgress(idx / total);
      if (idx < total) { const isEnd = charsRef.current[idx - 1]?.lineEnd; animRef.current = setTimeout(tick, isEnd ? 380 : 55 + Math.random() * 35); }
      else setPlaying(false);
    };
    animRef.current = setTimeout(tick, 400);
  };

  const stopReplay = () => { clearTimeout(animRef.current); setPlaying(false); drawAll(); };

  if (!lines) return <div className="replay-empty">拍照提交 · 无书写数据</div>;

  return (
    <div className="replay-wrap">
      <div className="replay-canvas-box">
        <canvas ref={canvasRef} width={W} height={H} />
      </div>
      <div className="replay-controls">
        <button className="replay-btn" onClick={startReplay}>
          {playing ? <span>⏸ 暂停</span> : <span>▶ 回放书写过程</span>}
        </button>
        <div className="replay-bar"><div className="replay-fill" style={{ width: (progress * 100) + '%' }}></div></div>
      </div>
    </div>
  );
}

/* ═══ Multi-page Replay View ═══ */
function MultiPageReplay({ pages }) {
  if (!pages || pages.length === 0) return <div className="replay-empty">无作答数据</div>;
  if (pages.length === 1) return <ReplayCanvas lines={pages[0]} />;
  return (
    <div className="multi-page-view">
      {pages.map((pageLines, i) => (
        <div key={i} className="mp-page">
          <div className="mp-page-hd">第{i + 1}页</div>
          <ReplayCanvas lines={pageLines} />
        </div>
      ))}
    </div>
  );
}

/* ═══ Student Detail Modal ═══ */
function StudentModal({ student, onClose }) {
  if (!student) return null;
  const s = student;
  const hintLabels = ['未使用提示（独立完成）', '使用了第1+2步提示', '使用了全部提示（含解题过程）'];
  const isHw = s.m === 'hw';

  return (
    <div className="overlay open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="mod-hd">
          <div className="mod-av">{s.n[0]}</div>
          <div className="mod-ti">
            <div className="mod-ti-n">{s.n}</div>
            <div className="mod-ti-m">
              {s.st === 'done' ? '已提交' : s.st === 'prog' ? '填写中' : '未开始'}
              {s.m && (' · ' + (isHw ? '手写作答' : '拍照上传'))}
              {s.sol && s.sol.length > 1 && (' · ' + s.sol.length + '页')}
              {s.t && (' · 用时 ' + fmtTime(s.t))}
            </div>
          </div>
          <div className="mod-cls" onClick={onClose}>关闭 ✕</div>
        </div>

        <div className="mod-body">
          {/* Left: Answer content */}
          <div className="mod-col">
            <div className="mod-h">
              {s.st === 'done' ? '提交内容' : '当前进度'}
            </div>
            {s.st === 'idle' ? (
              <div className="empty-state">该学生尚未开始作答</div>
            ) : isHw ? (
              <MultiPageReplay pages={s.sol} />
            ) : (
              <div className="photo-preview-box">
                <div className="photo-placeholder">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>拍照提交的作业照片</span>
                </div>
              </div>
            )}
            {s.st === 'done' && (
              <div className="mod-answer-meta">
                <span className="mod-method-badge">
                  {isHw ? '手写' : '拍照'}
                </span>
                <span className="mod-time">用时 {fmtTime(s.t)}</span>
              </div>
            )}
          </div>

          {/* Right: Learning status */}
          <div className="mod-col right">
            {/* Correctness */}
            {s.st === 'done' && (
              <div className="mod-section">
                <div className="mod-h">答案判定</div>
                <div className={'mod-verdict ' + (s.ok ? 'correct' : 'wrong')}>
                  <span className="verdict-icon">{s.ok ? '✓' : '✗'}</span>
                  <span className="verdict-text">{s.ok ? '正确' : '错误'}</span>
                  <span className="verdict-answer">{s.ok ? 'y² − 4' : s.sol?.[s.sol.length - 1]?.[s.sol[s.sol.length - 1].length - 1]}</span>
                </div>
                {s.err && (
                  <div className="mod-error-detail">
                    <span className="err-dot"></span>
                    {s.err}
                  </div>
                )}
              </div>
            )}

            {/* Hint usage */}
            <div className="mod-section">
              <div className="mod-h">提示使用</div>
              <div className="hint-usage-list">
                <div className={'hint-usage-item' + (s.h >= 1 ? ' used' : '')}>
                  <span className="hu-dot">{s.h >= 1 ? '●' : '○'}</span>
                  <span className="hu-label">第1步：理思路</span>
                  {s.h >= 1 && <span className="hu-tag">已查看</span>}
                </div>
                <div className={'hint-usage-item' + (s.h >= 1 ? ' used' : '')}>
                  <span className="hu-dot">{s.h >= 1 ? '●' : '○'}</span>
                  <span className="hu-label">第2步：列公式</span>
                  {s.h >= 1 && <span className="hu-tag">已查看</span>}
                </div>
                <div className={'hint-usage-item' + (s.h >= 2 ? ' used' : '')}>
                  <span className="hu-dot">{s.h >= 2 ? '●' : '○'}</span>
                  <span className="hu-label">第3步：写过程（完整解答）</span>
                  {s.h >= 2 && <span className="hu-tag warn">已查看</span>}
                </div>
              </div>
            </div>

            {/* AI analysis */}
            {s.st === 'done' && (
              <div className="mod-section">
                <div className="mod-h">AI 助教分析</div>
                <div className="ai-analysis">
                  {s.ok ? (
                    <p>该生{s.h === 0 ? '独立' : '在提示辅助下'}正确完成了多项式展开，分配律运用准确，同类项合并无误。</p>
                  ) : (
                    <Fragment>
                      <p className="ai-err-line"><strong>错误类型：</strong>{s.err}</p>
                      <p>建议在课堂总结时针对此类错误做重点讲解，帮助学生理解负号在乘法中的传递规则。</p>
                    </Fragment>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Hint Distribution Bar ═══ */
function HintDistBar() {
  const total = done.length || 1;
  return (
    <div className="hint-dist">
      <div className="hd-row">
        <span className="hd-label">独立完成</span>
        <div className="hd-bar-wrap">
          <div className="hd-bar hd-green" style={{ width: (h0/total*100) + '%' }}></div>
        </div>
        <span className="hd-val">{h0}</span>
      </div>
      <div className="hd-row">
        <span className="hd-label">提示 1+2</span>
        <div className="hd-bar-wrap">
          <div className="hd-bar hd-amber" style={{ width: (h1/total*100) + '%' }}></div>
        </div>
        <span className="hd-val">{h1}</span>
      </div>
      <div className="hd-row">
        <span className="hd-label">完整提示</span>
        <div className="hd-bar-wrap">
          <div className="hd-bar hd-red" style={{ width: (h2/total*100) + '%' }}></div>
        </div>
        <span className="hd-val">{h2}</span>
      </div>
    </div>
  );
}

/* ═══ Error Cluster Cards ═══ */
function ErrorClusters() {
  const errors = [
    { label: '符号错误', desc: '2·(−2) 计算为 +4 而非 −4', count: 3, names: '王译文 · 郭斐然 · 彭雨萱', severity: 'hi' },
    { label: '展开不完整', desc: '漏掉 2·y 项，只展开了三项', count: 3, names: '黄婉晴 · 程一帆 · 贾小诺', severity: 'hi' },
    { label: '合并同类项', desc: '−2y + 2y 误合为 −4y', count: 2, names: '高远航 · 秦若兰', severity: 'mid' },
  ];
  return (
    <div className="err-clusters">
      {errors.map((e, i) => (
        <div key={i} className="err-card">
          <div className="err-card-hd">
            <span className={'err-sev ' + e.severity}>{e.count}人</span>
            <span className="err-card-label">{e.label}</span>
          </div>
          <div className="err-card-desc">{e.desc}</div>
          <div className="err-card-names">{e.names}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══ Student List (right column) ═══ */
function StudentList({ filter, onSelect }) {
  const filtered = filter === 'all' ? S : filter === 'done' ? done : filter === 'prog' ? prog : filter === 'wrong' ? done.filter(s => !s.ok) : S;
  return (
    <div className="stu-list">
      {filtered.map(s => (
        <div key={s.id} className={'sl-row ' + s.st} onClick={() => onSelect(s)}>
          <span className={'sl-dot ' + s.st}></span>
          <span className="sl-name">{s.n}</span>
          {s.st === 'done' && s.ok && <span className="sl-ok">✓</span>}
          {s.st === 'done' && !s.ok && <span className="sl-err">✗</span>}
          {s.st === 'done' && <span className={'sl-hint-tag h' + s.h}>{s.h === 0 ? '独立' : s.h === 1 ? '提示' : '全部'}</span>}
          {s.st === 'prog' && <span className="sl-prog-tag">...</span>}
        </div>
      ))}
    </div>
  );
}

/* ═══ Main App ═══ */
function TeacherApp() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');

  return (
    <div className="app">
      {/* Band */}
      <div className="band">
        <div className="band-mark">T</div>
        <div className="band-title">课堂控制台</div>
        <div className="band-class">高一(3)班 · 多项式乘法 · 42 人</div>
        <div className="band-step">
          <span className="lb">Task</span><span className="num">1</span>
          <span className="sep">·</span>
          <span className="lb">Time</span><span className="num">12:30</span><span className="sl">/</span><span className="tot">15:00</span>
        </div>
      </div>

      <div className="body">
        {/* ── FOCUS COLUMN ── */}
        <div className="focus">
          {/* Hero */}
          <div className="hero">
            <div className="hero-main">
              <div className="hero-eyebrow"><span className="pill">PRACTICE</span>学生独立练习中</div>
              <div className="hero-title">多项式的积<span className="en">(y + 2)(y − 2)</span></div>
              <div className="hero-brief">学生先独立完成，需要时可逐步查看 AI 提示（理思路 → 列公式 → 写过程）。提交后由 AI Skill 自动判定。</div>
            </div>
            <div className="hero-side">
              <div className="hs-pair"><span className="hs-lb">已提交</span><span className="hs-v"><span className="n">{done.length}</span><span className="sl">/</span><span className="tot">{S.length}</span></span></div>
              <div className="hs-pair"><span className="hs-lb">正确率</span><span className="hs-v"><span className="n">{Math.round(correctCount/done.length*100)}%</span></span></div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="stats-grid">
            {/* Hint distribution */}
            <div className="stat-card">
              <div className="stat-card-hd">
                <span className="stat-label">提示使用分布</span>
                <span className="stat-meta">已提交 {done.length} 人</span>
              </div>
              <HintDistBar />
            </div>

            {/* Answer stats */}
            <div className="stat-card">
              <div className="stat-card-hd">
                <span className="stat-label">答案统计</span>
              </div>
              <div className="answer-stats">
                <div className="as-item correct">
                  <span className="as-n">{correctCount}</span>
                  <span className="as-label">正确</span>
                </div>
                <div className="as-item wrong">
                  <span className="as-n">{wrongCount}</span>
                  <span className="as-label">错误</span>
                </div>
                <div className="as-item pending">
                  <span className="as-n">{prog.length}</span>
                  <span className="as-label">填写中</span>
                </div>
                <div className="as-item idle-stat">
                  <span className="as-n">{idle.length}</span>
                  <span className="as-label">未开始</span>
                </div>
              </div>
            </div>
          </div>

          {/* Error clusters */}
          <div className="section-hd">
            <span className="section-label">常见错误聚类</span>
            <span className="section-meta">{wrongCount} 人出错 · 3 类</span>
          </div>
          <ErrorClusters />

          {/* Teacher suggestion */}
          <div className="teacher-line">
            <div className="line-lb">建议讲解要点</div>
            <div className="line-text">
              <strong>重点关注负号传递：</strong>展开 (y+2)(y−2) 时，最后一项 2·(−2) 的负号是最常见的出错点。建议在黑板上用<span className="k">颜色标注</span>负号的传递过程。
            </div>
          </div>

          {/* Actions */}
          <div className="actions">
            <button className="btn ghost">← 上一题</button>
            <button className="btn">延长 2 min</button>
            <button className="btn">推送提示给全班</button>
            <div style={{ flex: 1 }}></div>
            <button className="btn pri">下一题 →</button>
          </div>
        </div>

        {/* ── OVERVIEW COLUMN ── */}
        <div className="overview">
          {/* Pulse */}
          <div className="pulse">
            <div className="pulse-cell">
              <div className="pulse-n">{done.length}</div>
              <div className="pulse-row"><span className="pulse-dot done"></span><span className="pulse-lb">已提交</span></div>
            </div>
            <div className="pulse-cell">
              <div className="pulse-n">{prog.length}</div>
              <div className="pulse-row"><span className="pulse-dot prog"></span><span className="pulse-lb">填写中</span></div>
            </div>
            <div className="pulse-cell">
              <div className="pulse-n">{idle.length}</div>
              <div className="pulse-row"><span className="pulse-dot idle"></span><span className="pulse-lb">未开始</span></div>
            </div>
          </div>

          {/* Filter chips */}
          <div className="q-filter">
            {[
              { key: 'all', label: '全部', n: S.length },
              { key: 'done', label: '已提交', n: done.length },
              { key: 'wrong', label: '出错', n: wrongCount },
              { key: 'prog', label: '填写中', n: prog.length },
            ].map(f => (
              <button key={f.key} className={'q-chip' + (filter === f.key ? ' act' : '')} onClick={() => setFilter(f.key)}>
                {f.label}<span className="chip-n">{f.n}</span>
              </button>
            ))}
          </div>

          {/* Student list */}
          <div className="stu-scroll">
            <StudentList filter={filter} onSelect={setSelected} />
          </div>
        </div>
      </div>

      {/* Modal */}
      <StudentModal student={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<TeacherApp />);
