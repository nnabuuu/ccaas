/* ═══════════════════════════════════════════════════════════
   Teacher Console v6 — Main Layout (Redesigned)
   - Attention funnel: collapse done, highlight urgent
   - Readable badges, embedded actions
   - Better component rows
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

/* ─── Health Cards (unchanged) ─── */
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

/* ─── Collapsed Step (done/future — single line) ─── */
function CollapsedStep({ step, onClick }) {
  const status = stepStatus(step);
  const isDone = status === 'done';
  const isFuture = status === 'future';

  return React.createElement('div', {
    onClick,
    style:{
      display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
      background: 'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
      cursor:'pointer', opacity: isFuture ? 0.5 : 0.75, transition:'all .2s',
    },
    onMouseEnter: e => { e.currentTarget.style.opacity = '1'; },
    onMouseLeave: e => { e.currentTarget.style.opacity = isFuture ? '0.5' : '0.75'; },
  },
    React.createElement('span', { style:{
      width:20, height:20, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:9, fontWeight:700, flexShrink:0,
      background: isDone ? 'var(--green)' : 'var(--surface2)',
      color: isDone ? '#fff' : 'var(--t3)',
    } }, isDone ? '✓' : step.id),
    React.createElement('span', { style:{ fontSize:12, fontWeight:600, color: isDone ? 'var(--t2)' : 'var(--t3)' } }, step.name),
    React.createElement('span', { style:{ fontSize:10, color:'var(--t3)' } }, `${step.time} · ${step.type}`),
    /* Mini component dots */
    React.createElement('div', { style:{ display:'flex', gap:3, marginLeft:'auto' } },
      step.components.map(comp => {
        const ct = COMP_TYPES[comp.type];
        return React.createElement('span', { key:comp.id, style:{
          fontSize:8, fontWeight:600, padding:'2px 6px', borderRadius:3,
          background: isDone ? 'var(--green-soft)' : 'var(--surface2)',
          color: isDone ? 'var(--green)' : 'var(--t3)',
        } }, ct.label);
      }),
    ),
    React.createElement('span', { style:{ fontSize:9, color:'var(--t3)', marginLeft:4 } }, '▶'),
  );
}

/* ─── Component Row (bigger, readable) ─── */
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
    /* Type badge */
    React.createElement('span', { style:{ fontSize:10, fontWeight:700, color:ct.color, background:ct.bg, padding:'3px 8px', borderRadius:4, flexShrink:0 } }, ct.label),
    /* Label */
    React.createElement('span', { style:{ fontSize:11, fontWeight:500, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, comp.label),
    /* Progress bar */
    total > 0 && React.createElement('div', { style:{ display:'flex', height:8, width:64, borderRadius:4, overflow:'hidden', background:'var(--surface2)', flexShrink:0 } },
      comp.students.done > 0 && React.createElement('div', { style:{ width:`${comp.students.done/42*100}%`, background:'var(--green)' } }),
      comp.students.prog > 0 && React.createElement('div', { style:{ width:`${comp.students.prog/42*100}%`, background:'var(--blue)' } }),
      comp.students.stuck > 0 && React.createElement('div', { style:{ width:`${comp.students.stuck/42*100}%`, background:'var(--amber)' } }),
    ),
    /* Metric */
    comp.type === 'discuss' && comp.metrics.goalRate !== undefined && React.createElement('span', { style:{ fontSize:10, fontWeight:600, color: comp.metrics.goalRate > 70 ? 'var(--green)' : comp.metrics.goalRate > 40 ? 'var(--amber)' : 'var(--red)', flexShrink:0 } }, `${comp.metrics.goalRate}%达标`),
    comp.type === 'practice' && comp.metrics.accuracy !== undefined && React.createElement('span', { style:{ fontSize:10, fontWeight:600, color: comp.metrics.accuracy > 70 ? 'var(--green)' : comp.metrics.accuracy > 40 ? 'var(--amber)' : 'var(--red)', flexShrink:0 } }, `${comp.metrics.accuracy}%正确`),
    /* Alert count */
    alerts.length > 0 && React.createElement('span', { style:{
      fontSize:9, fontWeight:700, minWidth:18, height:18, borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 5px',
      background: alerts.some(a => a.severity==='urg') ? 'var(--red)' : 'var(--amber)', color:'#fff', flexShrink:0,
    } }, alerts.length),
    /* Arrow for discuss */
    isClickable && React.createElement('span', { style:{ fontSize:10, color:'var(--t3)', flexShrink:0 } }, '→'),
  );
}

/* ─── Urgent Alert Inline (embedded in step card) ─── */
function InlineAlert({ obs }) {
  return React.createElement('div', { style:{
    display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px',
    background: obs.severity === 'urg' ? 'var(--red-bg)' : 'var(--amber-bg)',
    border: `1px solid ${obs.severity === 'urg' ? 'rgba(148,41,41,.15)' : 'rgba(122,77,14,.15)'}`,
    borderRadius:7,
  } },
    React.createElement('span', { style:{
      width:7, height:7, borderRadius:'50%', marginTop:5, flexShrink:0,
      background: obs.severity === 'urg' ? 'var(--red)' : 'var(--amber)',
      animation: obs.severity === 'urg' ? 'sig-pulse 2s infinite' : 'none',
    } }),
    React.createElement('div', { style:{ flex:1, minWidth:0 } },
      React.createElement('div', { style:{ fontSize:11, fontWeight:700, color:'var(--t1)', marginBottom:3 } }, obs.title),
      React.createElement('div', { style:{ fontSize:10, color:'var(--t2)', lineHeight:1.5, marginBottom:6 } }, obs.detail),
      React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', gap:3, marginBottom:8 } },
        obs.students.map(name => React.createElement('span', { key:name, style:{
          fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3,
          background: obs.severity==='urg' ? 'rgba(148,41,41,.1)' : 'rgba(122,77,14,.1)',
          color: obs.severity==='urg' ? 'var(--red)' : 'var(--amber)',
        } }, name)),
      ),
      /* Inline actions */
      React.createElement('div', { style:{ display:'flex', gap:6 } },
        obs.actions.map((act, ai) => React.createElement('button', { key:ai, onClick:e=>e.stopPropagation(), style:{
          fontSize:10, fontWeight:600, padding:'5px 12px', borderRadius:5,
          border: ai===0 ? 'none' : '1px solid var(--border)',
          background: ai===0 ? 'var(--t1)' : 'var(--surface)',
          color: ai===0 ? '#fff' : 'var(--t1)', cursor:'pointer', fontFamily:'inherit',
        } }, act)),
      ),
    ),
  );
}

/* ─── Active Step Card (expanded, prominent) ─── */
function ActiveStepCard({ step, selectedSignal, onCompClick, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const sev = stepSeverity(step);
  const stepObs = OBSERVATIONS.filter(o => o.stepId === step.id);
  const urgObs = stepObs.filter(o => o.severity === 'urg');
  const warnObs = stepObs.filter(o => o.severity === 'warn');
  const highlightedCompId = selectedSignal ? OBSERVATIONS.find(o => o.id === selectedSignal)?.componentId : null;
  const isStepHighlighted = selectedSignal && stepObs.some(o => o.id === selectedSignal);

  const borderColor = sev === 'urg' ? 'rgba(148,41,41,.25)' : sev === 'warn' ? 'rgba(122,77,14,.2)' : isStepHighlighted ? 'rgba(26,95,160,.35)' : 'var(--border)';
  const leftBorder = sev === 'urg' ? '3px solid var(--red)' : sev === 'warn' ? '3px solid var(--amber)' : '3px solid var(--t1)';

  return React.createElement('div', { style:{
    background: sev === 'urg' ? 'rgba(148,41,41,.02)' : 'var(--surface)',
    border: `1px solid ${borderColor}`, borderLeft: leftBorder,
    borderRadius:10, overflow:'hidden', transition:'all .2s',
    animation: sev === 'urg' ? 'gentle-pulse 3s infinite' : 'none',
  } },
    /* Header */
    React.createElement('div', { onClick:()=>setExpanded(!expanded), style:{ padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:12 } },
      React.createElement('span', { style:{ width:26, height:26, borderRadius:'50%', background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 } }, step.id),
      React.createElement('div', { style:{ flex:1, minWidth:0 } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:8 } },
          React.createElement('span', { style:{ fontSize:14, fontWeight:700 } }, step.name),
          React.createElement('span', { style:{ fontSize:10, color:'var(--t2)' } }, `${step.time} · ${step.type}`),
        ),
      ),
      /* Badges — FIXED: larger, readable, horizontal with gap */
      (urgObs.length + warnObs.length) > 0 && React.createElement('div', { style:{ display:'flex', gap:6, alignItems:'center', flexShrink:0 } },
        urgObs.length > 0 && React.createElement('span', { style:{
          fontSize:11, fontWeight:700, color:'#fff', background:'var(--red)',
          padding:'3px 10px', borderRadius:12, display:'flex', alignItems:'center', gap:4,
          whiteSpace:'nowrap',
        } },
          React.createElement('span', { style:{ width:5, height:5, borderRadius:'50%', background:'#fff', animation:'pulse-dot 1.5s infinite' } }),
          `${urgObs.length} 紧急`
        ),
        warnObs.length > 0 && React.createElement('span', { style:{
          fontSize:11, fontWeight:600, color:'var(--amber)', background:'var(--amber-bg)',
          padding:'3px 10px', borderRadius:12, whiteSpace:'nowrap',
          border:'1px solid rgba(122,77,14,.15)',
        } }, `${warnObs.length} 注意`),
      ),
      React.createElement('span', { style:{ fontSize:9, color:'var(--t3)', transform: expanded ? 'rotate(90deg)' : 'none', transition:'transform .15s', flexShrink:0 } }, '▶'),
    ),

    /* Expanded content */
    expanded && React.createElement('div', { style:{ padding:'0 16px 14px', display:'flex', flexDirection:'column', gap:6, borderTop:'1px solid var(--border)', paddingTop:12 } },
      /* Component rows */
      step.components.map(comp => React.createElement(ComponentRow, {
        key:comp.id, comp, onCompClick,
        isHighlighted: highlightedCompId === comp.id,
      })),
      /* Inline urgent alerts */
      urgObs.length > 0 && React.createElement('div', { style:{ marginTop:4, display:'flex', flexDirection:'column', gap:6 } },
        urgObs.map(obs => React.createElement(InlineAlert, { key:obs.id, obs })),
      ),
      /* Inline warn alerts (compact) */
      warnObs.length > 0 && React.createElement('div', { style:{ marginTop:2, display:'flex', flexDirection:'column', gap:4 } },
        warnObs.map(obs => React.createElement(InlineAlert, { key:obs.id, obs })),
      ),
    ),
  );
}

/* ─── Steps Section ─── */
function StepsSection({ selectedSignal, onCompClick }) {
  const [forceExpand, setForceExpand] = useState(null); // step id to force-show collapsed

  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:6 } },
    React.createElement('div', { style:{ fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', padding:'4px 0 6px', display:'flex', alignItems:'center', gap:8 } },
      React.createElement('span', null, '课堂进程'),
      React.createElement('span', { style:{ fontSize:9, color:'var(--t3)', fontWeight:400, textTransform:'none', letterSpacing:0 } }, '已用 18:22 / 45:00'),
    ),
    STEPS.map(step => {
      const status = stepStatus(step);
      // Collapse done & future steps unless force-expanded
      if ((status === 'done' || status === 'future') && forceExpand !== step.id) {
        return React.createElement(CollapsedStep, {
          key:step.id, step,
          onClick:() => setForceExpand(forceExpand === step.id ? null : step.id),
        });
      }
      // If force-expanded, show as active card but not auto-expanded
      if (forceExpand === step.id) {
        return React.createElement('div', { key:step.id },
          React.createElement(ActiveStepCard, { step, selectedSignal, onCompClick, defaultExpanded:true }),
          React.createElement('button', { onClick:()=>setForceExpand(null), style:{
            fontSize:9, color:'var(--t3)', background:'none', border:'none', cursor:'pointer', padding:'4px 14px', fontFamily:'inherit',
          } }, '← 收起'),
        );
      }
      // Active steps: auto-expand the most urgent one
      const sev = stepSeverity(step);
      return React.createElement(ActiveStepCard, {
        key:step.id, step, selectedSignal, onCompClick,
        defaultExpanded: sev === 'urg' || sev === 'warn',
      });
    }),
  );
}

Object.assign(window, { HealthCards, StepsSection });
