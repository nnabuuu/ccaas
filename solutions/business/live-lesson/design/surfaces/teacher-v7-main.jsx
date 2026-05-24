/* ═══════════════════════════════════════════════════════════
   Teacher Console v7 — Main Content Area
   Shows either:
   - Global overview (HealthCards + all active steps collapsed)
   - Selected step detail (expanded components + inline alerts)
   
   Report insights applied:
   - Healthy items visually muted (attention economy)
   - Action buttons differentiated by severity (destructive = red, separated)
   - Signal freshness: "刚刚" items get pulse, older items fade
   ═══════════════════════════════════════════════════════════ */
const { useState, useCallback, Fragment } = React;

/* ─── Helpers ─── */
function stepSeverity(step) {
  const obs = OBSERVATIONS.filter(o => o.stepId === step.id);
  if (obs.some(o => o.severity === 'urg')) return 'urg';
  if (obs.some(o => o.severity === 'warn')) return 'warn';
  return 'none';
}
function stepStatus(step) {
  if (step.components.every(c => c.status === 'done')) return 'done';
  if (step.components.every(c => c.status === 'future' || c.status === 'waiting')) return 'future';
  return 'active';
}

/* ─── Health Cards ─── */
function HealthCards() {
  const cards = [
    { label:'最快进度', value:'T5', sub:'2 人已到达', cls:'good' },
    { label:'中位进度', value:'T3', sub:'62% 学生在此', cls:'' },
    { label:'卡点学生', value:'7', sub:'集中在 T3', cls:'warn' },
    { label:'AI 对话', value:'52 轮', sub:'18 人触发', cls:'' },
  ];
  return React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 } },
    cards.map((c,i) => React.createElement('div', { key:i, className:`hcard ${c.cls}` },
      React.createElement('div', { className:'hcard-lb' }, c.label),
      React.createElement('div', { className:'hcard-v' }, c.value),
      React.createElement('div', { className:'hcard-sub', dangerouslySetInnerHTML:{__html:c.sub} }),
    ))
  );
}

/* ─── Component Row ─── */
function ComponentRow({ comp, onCompClick, isHighlighted }) {
  const ct = COMP_TYPES[comp.type];
  const isActive = comp.status === 'active';
  const isDone = comp.status === 'done';
  const isFuture = comp.status === 'future' || comp.status === 'waiting';
  const total = comp.students.done + comp.students.prog + comp.students.stuck;
  const alerts = OBSERVATIONS.filter(o => o.componentId === comp.id);
  const isClickable = comp.type === 'discuss' && (isActive || isDone);

  return React.createElement('div', {
    onClick: isClickable ? () => onCompClick && onCompClick(comp) : undefined,
    style:{
      display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:7,
      background: isHighlighted ? ct.bg : 'transparent',
      border: `1px solid ${isHighlighted ? ct.color + '25' : 'transparent'}`,
      borderLeft: `3px solid ${isActive ? ct.color : isDone ? 'var(--green)' : 'var(--surface2)'}`,
      cursor: isClickable ? 'pointer' : 'default',
      opacity: isFuture ? 0.4 : 1, transition:'all .15s',
    },
    onMouseEnter: e => { if (isClickable) e.currentTarget.style.background = ct.bg; },
    onMouseLeave: e => { if (isClickable && !isHighlighted) e.currentTarget.style.background = 'transparent'; },
  },
    React.createElement('span', { style:{ fontSize:10, fontWeight:700, color:ct.color, background:ct.bg, padding:'3px 8px', borderRadius:4, flexShrink:0 } }, ct.label),
    React.createElement('span', { style:{ fontSize:11, fontWeight:500, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, comp.label),
    total > 0 && React.createElement('div', { style:{ display:'flex', height:8, width:64, borderRadius:4, overflow:'hidden', background:'var(--surface2)', flexShrink:0 } },
      comp.students.done > 0 && React.createElement('div', { style:{ width:`${comp.students.done/42*100}%`, background:'var(--green)' } }),
      comp.students.prog > 0 && React.createElement('div', { style:{ width:`${comp.students.prog/42*100}%`, background:'var(--blue)' } }),
      comp.students.stuck > 0 && React.createElement('div', { style:{ width:`${comp.students.stuck/42*100}%`, background:'var(--amber)' } }),
    ),
    comp.type === 'discuss' && comp.metrics.goalRate !== undefined && React.createElement('span', { style:{ fontSize:10, fontWeight:600, color: comp.metrics.goalRate > 70 ? 'var(--green)' : comp.metrics.goalRate > 40 ? 'var(--amber)' : 'var(--red)', flexShrink:0 } }, `${comp.metrics.goalRate}%达标`),
    comp.type === 'practice' && comp.metrics.accuracy !== undefined && React.createElement('span', { style:{ fontSize:10, fontWeight:600, color: comp.metrics.accuracy > 70 ? 'var(--green)' : comp.metrics.accuracy > 40 ? 'var(--amber)' : 'var(--red)', flexShrink:0 } }, `${comp.metrics.accuracy}%正确`),
    alerts.length > 0 && React.createElement('span', { style:{
      fontSize:9, fontWeight:700, minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px',
      background: alerts.some(a => a.severity==='urg') ? 'var(--red)' : 'var(--amber)', color:'#fff', flexShrink:0,
    } }, alerts.length),
    isClickable && React.createElement('span', { style:{ fontSize:10, color:'var(--t3)', flexShrink:0 } }, '→'),
  );
}

/* ─── Inline Alert (with severity-aware action buttons) ─── */
function InlineAlert({ obs }) {
  const [confirming, setConfirming] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());

  // Classify actions by destructiveness
  const classifyAction = (action) => {
    if (action.includes('暂停')) return 'destructive';
    if (action.includes('加入')) return 'medium';
    return 'light';
  };

  const handleAction = (act, idx) => {
    const cls = classifyAction(act);
    if (cls === 'destructive' && confirming !== idx) {
      setConfirming(idx);
      return;
    }
    // Execute
    setDismissed(prev => { const n = new Set(prev); n.add(idx); return n; });
    setConfirming(null);
  };

  return React.createElement('div', { style:{
    display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px',
    background: obs.severity === 'urg' ? 'var(--red-bg)' : 'var(--amber-bg)',
    border: `1px solid ${obs.severity === 'urg' ? 'rgba(148,41,41,.15)' : 'rgba(122,77,14,.15)'}`,
    borderRadius:7,
  } },
    React.createElement('span', { style:{
      width:7, height:7, borderRadius:'50%', marginTop:5, flexShrink:0,
      background: obs.severity === 'urg' ? 'var(--red)' : 'var(--amber)',
      animation: obs.time === '刚刚' ? 'sig-pulse 2s infinite' : 'none',
    } }),
    React.createElement('div', { style:{ flex:1, minWidth:0 } },
      React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6, marginBottom:3 } },
        React.createElement('span', { style:{ fontSize:11, fontWeight:700, color:'var(--t1)' } }, obs.title),
        React.createElement('span', { style:{ fontSize:9, color:'var(--t3)', marginLeft:'auto', flexShrink:0 } }, obs.time),
      ),
      React.createElement('div', { style:{ fontSize:10, color:'var(--t2)', lineHeight:1.5, marginBottom:6 } }, obs.detail),
      React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 } },
        obs.students.map(name => React.createElement('span', { key:name, style:{
          fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3,
          background: obs.severity==='urg' ? 'rgba(148,41,41,.1)' : 'rgba(122,77,14,.1)',
          color: obs.severity==='urg' ? 'var(--red)' : 'var(--amber)',
        } }, name)),
      ),
      /* Actions with severity differentiation */
      React.createElement('div', { style:{ display:'flex', gap:6, flexWrap:'wrap' } },
        obs.actions.map((act, ai) => {
          if (dismissed.has(ai)) return React.createElement('span', { key:ai, style:{ fontSize:10, color:'var(--green)', fontWeight:600, display:'flex', alignItems:'center', gap:3 } }, '✓ 已执行');
          const cls = classifyAction(act);
          const isConfirm = confirming === ai;

          if (cls === 'destructive') {
            return React.createElement('div', { key:ai, style:{ display:'flex', flexDirection:'column', gap:3 } },
              React.createElement('button', { onClick:e=>{e.stopPropagation(); handleAction(act, ai);}, style:{
                fontSize:10, fontWeight:600, padding:'5px 12px', borderRadius:5,
                border: isConfirm ? 'none' : '1px solid rgba(148,41,41,.3)',
                background: isConfirm ? 'var(--red)' : 'transparent',
                color: isConfirm ? '#fff' : 'var(--red)', cursor:'pointer', fontFamily:'inherit',
              } }, isConfirm ? `确认${act}？（影响全班 42 人）` : act),
              isConfirm && React.createElement('button', { onClick:e=>{e.stopPropagation(); setConfirming(null);}, style:{
                fontSize:9, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0,
              } }, '取消'),
            );
          }

          return React.createElement('button', { key:ai, onClick:e=>{e.stopPropagation(); handleAction(act, ai);}, style:{
            fontSize:10, fontWeight:600, padding:'5px 12px', borderRadius:5,
            border: cls === 'light' ? 'none' : '1px solid var(--border)',
            background: cls === 'light' ? 'var(--t1)' : 'var(--surface)',
            color: cls === 'light' ? '#fff' : 'var(--t1)', cursor:'pointer', fontFamily:'inherit',
          } }, act);
        }),
      ),
    ),
  );
}

/* ─── Global Overview (when no step selected) ─── */
function GlobalOverview({ selectedSignal, onCompClick }) {
  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:14 } },
    /* Only show active steps with alerts prominently */
    React.createElement('div', { style:{ fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', padding:'4px 0 2px' } }, '需要关注'),
    STEPS.filter(step => {
      const obs = OBSERVATIONS.filter(o => o.stepId === step.id);
      return obs.some(o => o.severity === 'urg' || o.severity === 'warn');
    }).map(step => {
      const obs = OBSERVATIONS.filter(o => o.stepId === step.id);
      const urgObs = obs.filter(o => o.severity === 'urg');
      const warnObs = obs.filter(o => o.severity === 'warn');
      return React.createElement('div', { key:step.id, style:{
        background: urgObs.length > 0 ? 'rgba(148,41,41,.02)' : 'var(--surface)',
        border: `1px solid ${urgObs.length > 0 ? 'rgba(148,41,41,.15)' : 'rgba(122,77,14,.15)'}`,
        borderLeft: `3px solid ${urgObs.length > 0 ? 'var(--red)' : 'var(--amber)'}`,
        borderRadius:10, padding:'14px 16px',
      } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:10, marginBottom:10 } },
          React.createElement('span', { style:{ fontSize:12, fontWeight:700 } }, `T${step.id} ${step.name}`),
          React.createElement('span', { style:{ fontSize:10, color:'var(--t3)' } }, step.type),
          urgObs.length > 0 && React.createElement('span', { style:{ marginLeft:'auto', fontSize:10, fontWeight:700, color:'#fff', background:'var(--red)', padding:'2px 8px', borderRadius:10 } }, `${urgObs.length} 紧急`),
          warnObs.length > 0 && React.createElement('span', { style:{ marginLeft: urgObs.length ? 0 : 'auto', fontSize:10, fontWeight:600, color:'var(--amber)', background:'var(--amber-bg)', padding:'2px 8px', borderRadius:10, border:'1px solid rgba(122,77,14,.12)' } }, `${warnObs.length} 注意`),
        ),
        [...urgObs, ...warnObs].map(o => React.createElement(InlineAlert, { key:o.id, obs:o })),
      );
    }),

    /* Quiet steps summary */
    React.createElement('div', { style:{ fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', padding:'8px 0 2px' } }, '正常运行'),
    React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:4 } },
      STEPS.filter(step => {
        const obs = OBSERVATIONS.filter(o => o.stepId === step.id);
        return !obs.some(o => o.severity === 'urg' || o.severity === 'warn');
      }).map(step => {
        const status = stepStatus(step);
        const isDone = status === 'done';
        return React.createElement('div', { key:step.id, style:{
          display:'flex', alignItems:'center', gap:10, padding:'7px 12px',
          background:'var(--surface)', border:'1px solid var(--border)', borderRadius:6, opacity: isDone ? 0.6 : 0.8,
        } },
          React.createElement('span', { style:{ width:18, height:18, borderRadius:'50%', background: isDone ? 'var(--green)' : 'var(--surface2)', color: isDone ? '#fff' : 'var(--t3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:700 } }, isDone ? '✓' : `T${step.id}`),
          React.createElement('span', { style:{ fontSize:11, fontWeight:500, color:'var(--t2)' } }, step.name),
          React.createElement('span', { style:{ fontSize:10, color:'var(--t3)', marginLeft:'auto' } }, isDone ? '已完成' : status === 'future' ? '未开始' : '进行中'),
        );
      }),
    ),
  );
}

/* ─── Step Detail (when a step is selected) ─── */
function StepDetail({ step, selectedSignal, onCompClick }) {
  const sev = stepSeverity(step);
  const stepObs = OBSERVATIONS.filter(o => o.stepId === step.id);
  const urgObs = stepObs.filter(o => o.severity === 'urg');
  const warnObs = stepObs.filter(o => o.severity === 'warn');
  const infoObs = stepObs.filter(o => o.severity === 'info');
  const highlightedCompId = selectedSignal ? OBSERVATIONS.find(o => o.id === selectedSignal)?.componentId : null;
  const status = stepStatus(step);

  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:12 } },
    /* Step header */
    React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:12 } },
      React.createElement('span', { style:{ width:32, height:32, borderRadius:'50%', background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 } }, `T${step.id}`),
      React.createElement('div', { style:{ flex:1 } },
        React.createElement('div', { style:{ fontSize:16, fontWeight:700 } }, step.name),
        React.createElement('div', { style:{ fontSize:11, color:'var(--t3)', marginTop:2 } }, `${step.type} · ${step.time} · ${step.components.length} 组件`),
      ),
      (urgObs.length + warnObs.length) > 0 && React.createElement('div', { style:{ display:'flex', gap:6 } },
        urgObs.length > 0 && React.createElement('span', { style:{ fontSize:11, fontWeight:700, color:'#fff', background:'var(--red)', padding:'3px 10px', borderRadius:12, display:'flex', alignItems:'center', gap:4 } },
          React.createElement('span', { style:{ width:5, height:5, borderRadius:'50%', background:'#fff', animation:'pulse-dot 1.5s infinite' } }),
          `${urgObs.length} 紧急`,
        ),
        warnObs.length > 0 && React.createElement('span', { style:{ fontSize:11, fontWeight:600, color:'var(--amber)', background:'var(--amber-bg)', padding:'3px 10px', borderRadius:12, border:'1px solid rgba(122,77,14,.15)' } }, `${warnObs.length} 注意`),
      ),
    ),

    /* Components */
    React.createElement('div', { style:{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' } },
      React.createElement('div', { style:{ padding:'10px 14px', fontSize:9, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', borderBottom:'1px solid var(--border)' } }, '组件'),
      React.createElement('div', { style:{ padding:'6px 8px', display:'flex', flexDirection:'column', gap:2 } },
        step.components.map(comp => React.createElement(ComponentRow, {
          key:comp.id, comp, onCompClick,
          isHighlighted: highlightedCompId === comp.id,
        })),
      ),
    ),

    /* Alerts — urgent first, then warn, then info */
    urgObs.length > 0 && React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:6 } },
      React.createElement('div', { style:{ fontSize:9, fontWeight:600, color:'var(--red)', textTransform:'uppercase', letterSpacing:'.5px' } }, '紧急'),
      urgObs.map(obs => React.createElement(InlineAlert, { key:obs.id, obs })),
    ),
    warnObs.length > 0 && React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:6 } },
      React.createElement('div', { style:{ fontSize:9, fontWeight:600, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.5px' } }, '注意'),
      warnObs.map(obs => React.createElement(InlineAlert, { key:obs.id, obs })),
    ),
    infoObs.length > 0 && React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:6 } },
      React.createElement('div', { style:{ fontSize:9, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px' } }, '信息'),
      infoObs.map(obs => React.createElement(InlineAlert, { key:obs.id, obs })),
    ),

    /* Empty state */
    stepObs.length === 0 && status !== 'future' && React.createElement('div', { style:{
      padding:'24px 16px', textAlign:'center', color:'var(--t3)', fontSize:12,
      background:'var(--green-bg)', border:'1px solid rgba(45,102,18,.1)', borderRadius:8,
    } },
      React.createElement('div', { style:{ fontSize:14, marginBottom:4 } }, '✓'),
      '当前步骤运行正常，暂无异常信号',
    ),
  );
}

/* ─── Main Content (exported) ─── */
function MainContent({ selectedStepId, selectedSignal, onCompClick }) {
  const step = selectedStepId ? STEPS.find(s => s.id === selectedStepId) : null;

  return React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'18px 24px 40px', display:'flex', flexDirection:'column', gap:14 } },
    /* HealthCards always visible */
    React.createElement(HealthCards),
    step
      ? React.createElement(StepDetail, { step, selectedSignal, onCompClick })
      : React.createElement(GlobalOverview, { selectedSignal, onCompClick }),
  );
}

Object.assign(window, { HealthCards, MainContent, StepDetail, GlobalOverview });
