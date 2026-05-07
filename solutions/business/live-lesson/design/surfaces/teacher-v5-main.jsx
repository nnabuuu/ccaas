/* ═══════════════════════════════════════════════════════════
   Teacher Console v5 — Main Layout
   Steps with component-level awareness
   ═══════════════════════════════════════════════════════════ */
const { useState, useCallback, Fragment } = React;

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

/* ─── Component Strip (mini bar inside step header) ─── */
function ComponentStrip({ components, highlightedCompId, onCompClick }) {
  return React.createElement('div', { style:{ display:'flex', gap:2, marginTop:6 } },
    components.map(comp => {
      const ct = COMP_TYPES[comp.type];
      const isActive = comp.status === 'active';
      const isDone = comp.status === 'done';
      const isFuture = comp.status === 'future' || comp.status === 'waiting';
      const isHL = highlightedCompId === comp.id;
      const total = comp.students.done + comp.students.prog + comp.students.stuck;
      const donePct = total > 0 ? comp.students.done / total * 100 : 0;
      const hasAlert = OBSERVATIONS.some(o => o.componentId === comp.id);
      const hasUrg = OBSERVATIONS.some(o => o.componentId === comp.id && o.severity === 'urg');

      return React.createElement('div', { key:comp.id, onClick:e => { e.stopPropagation(); onCompClick && onCompClick(comp); },
        style:{
          flex:1, height:28, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center', gap:3,
          background: isHL ? ct.color : isFuture ? 'var(--surface2)' : isActive ? ct.bg : 'var(--green-soft)',
          position:'relative', overflow:'hidden', cursor: comp.type==='discuss' ? 'pointer' : 'default',
          opacity: isFuture ? 0.4 : 1, transition:'all .2s',
          outline: isHL ? `2px solid ${ct.color}` : 'none', outlineOffset: -1,
        }
      },
        isActive && !isHL && React.createElement('div', { style:{
          position:'absolute', left:0, top:0, bottom:0,
          width:`${donePct}%`, background:ct.color, opacity:0.12,
        } }),
        React.createElement('span', { style:{ fontSize:9, fontWeight:700, color: isHL ? '#fff' : isFuture ? 'var(--t3)' : ct.color, position:'relative', zIndex:1 } }, ct.label),
        isActive && !isHL && comp.students.stuck > 0 && React.createElement('span', { style:{
          position:'absolute', top:2, right:3, width:12, height:12, borderRadius:'50%', fontSize:7, fontWeight:700,
          background:'var(--amber)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center',
        } }, comp.students.stuck),
        hasUrg && !isHL && React.createElement('span', { style:{ position:'absolute', top:2, left:3, width:6, height:6, borderRadius:'50%', background:'var(--red)' } }),
      );
    }),
  );
}

/* ─── Expanded Step Detail ─── */
function StepDetail({ step, highlightedCompId, onCompClick }) {
  return React.createElement('div', { style:{ padding:'0 14px 12px', borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', flexDirection:'column', gap:4 } },
    step.components.map(comp => {
      const ct = COMP_TYPES[comp.type];
      const total = comp.students.done + comp.students.prog + comp.students.stuck;
      const alerts = OBSERVATIONS.filter(o => o.componentId === comp.id);
      const isHL = highlightedCompId === comp.id;
      const isClickable = comp.type === 'discuss' && (comp.status === 'active' || comp.status === 'done');

      return React.createElement('div', { key:comp.id,
        onClick: isClickable ? () => onCompClick && onCompClick(comp) : undefined,
        style:{
          borderRadius:6, overflow:'hidden',
          background: isHL ? ct.bg : 'transparent',
          border: isHL ? `1px solid ${ct.color}30` : '1px solid transparent',
          transition:'all .2s',
          cursor: isClickable ? 'pointer' : 'default',
        }
      },
        React.createElement('div', { style:{
          display:'flex', alignItems:'center', gap:8, padding:'6px 10px',
          borderLeft:`3px solid ${comp.status==='active' ? ct.color : comp.status==='done' ? 'var(--green)' : 'var(--surface2)'}`,
        } },
          React.createElement('span', { style:{ fontSize:9, fontWeight:700, color:ct.color, background:ct.bg, padding:'2px 6px', borderRadius:3, flexShrink:0 } }, ct.label),
          React.createElement('span', { style:{ fontSize:10, fontWeight:500, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, comp.label),
          /* Mini progress bar */
          total > 0 && React.createElement('div', { style:{ display:'flex', height:10, width:54, borderRadius:2, overflow:'hidden', background:'var(--surface2)', flexShrink:0 } },
            comp.students.done > 0 && React.createElement('div', { style:{ width:`${comp.students.done/42*100}%`, background:'var(--green)', height:'100%' } }),
            comp.students.prog > 0 && React.createElement('div', { style:{ width:`${comp.students.prog/42*100}%`, background:'var(--blue)', height:'100%' } }),
            comp.students.stuck > 0 && React.createElement('div', { style:{ width:`${comp.students.stuck/42*100}%`, background:'var(--amber)', height:'100%' } }),
          ),
          /* Metrics */
          comp.type === 'discuss' && comp.metrics.goalRate !== undefined && React.createElement('span', { style:{ fontSize:9, fontWeight:600, color: comp.metrics.goalRate > 70 ? 'var(--green)' : comp.metrics.goalRate > 40 ? 'var(--amber)' : 'var(--red)', flexShrink:0 } }, `${comp.metrics.goalRate}%达标`),
          comp.type === 'practice' && comp.metrics.accuracy !== undefined && React.createElement('span', { style:{ fontSize:9, fontWeight:600, color: comp.metrics.accuracy > 70 ? 'var(--green)' : comp.metrics.accuracy > 40 ? 'var(--amber)' : 'var(--red)', flexShrink:0 } }, `${comp.metrics.accuracy}%正确`),
          alerts.length > 0 && React.createElement('span', { style:{
            fontSize:8, fontWeight:700, width:16, height:16, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
            background: alerts.some(a => a.severity==='urg') ? 'var(--red)' : 'var(--amber)', color:'#fff', flexShrink:0,
          } }, alerts.length),
          /* Drill-in arrow for discuss */
          isClickable && React.createElement('span', { style:{ fontSize:9, color:'var(--t3)', flexShrink:0 } }, '→'),
        ),
        /* Inline alert previews when highlighted */
        isHL && alerts.length > 0 && React.createElement('div', { style:{ padding:'4px 10px 8px 16px', display:'flex', flexDirection:'column', gap:4 } },
          alerts.map(obs => React.createElement('div', { key:obs.id, style:{ fontSize:10, color:'var(--t2)', display:'flex', alignItems:'center', gap:6 } },
            React.createElement('span', { style:{ width:5, height:5, borderRadius:'50%', background: obs.severity==='urg' ? 'var(--red)' : 'var(--amber)', flexShrink:0 } }),
            React.createElement('span', { style:{ fontWeight:600, color:'var(--t1)' } }, obs.title),
          )),
        ),
      );
    }),
  );
}

/* ─── Step Card ─── */
function StepCard({ step, isExpanded, onToggle, selectedSignal, onCompClick }) {
  const stepObs = OBSERVATIONS.filter(o => o.stepId === step.id);
  const urgCount = stepObs.filter(o => o.severity === 'urg').length;
  const warnCount = stepObs.filter(o => o.severity === 'warn').length;
  const highlightedCompId = selectedSignal ? OBSERVATIONS.find(o => o.id === selectedSignal)?.componentId : null;
  const isStepHighlighted = selectedSignal && stepObs.some(o => o.id === selectedSignal);

  return React.createElement('div', { style:{
    background:'var(--surface)', border:`1px solid ${isStepHighlighted ? 'rgba(26,95,160,.35)' : 'var(--border)'}`,
    borderRadius:10, overflow:'hidden', transition:'border-color .2s',
    boxShadow: isStepHighlighted ? '0 0 0 2px rgba(26,95,160,.08)' : 'none',
  } },
    /* Header */
    React.createElement('div', { onClick:onToggle, style:{ padding:'10px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:10 } },
      React.createElement('span', { style:{ width:22, height:22, borderRadius:'50%', background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, flexShrink:0 } }, step.id),
      React.createElement('div', { style:{ flex:1, minWidth:0 } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6 } },
          React.createElement('span', { style:{ fontSize:13, fontWeight:700 } }, step.name),
          React.createElement('span', { style:{ fontSize:9, color:'var(--t2)' } }, `${step.time} · ${step.type}`),
        ),
        React.createElement(ComponentStrip, { components:step.components, highlightedCompId, onCompClick }),
      ),
      (urgCount + warnCount) > 0 && React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:2, alignItems:'flex-end', flexShrink:0 } },
        urgCount > 0 && React.createElement('span', { style:{ fontSize:8, fontWeight:700, color:'#fff', background:'var(--red)', padding:'1px 5px', borderRadius:3 } }, `${urgCount} 紧急`),
        warnCount > 0 && React.createElement('span', { style:{ fontSize:8, fontWeight:600, color:'var(--amber)', background:'var(--amber-soft)', padding:'1px 5px', borderRadius:3 } }, `${warnCount} 注意`),
      ),
      React.createElement('span', { style:{ fontSize:8, color:'var(--t3)', transform: isExpanded ? 'rotate(90deg)' : 'none', transition:'transform .15s', flexShrink:0 } }, '▶'),
    ),
    /* Expanded */
    isExpanded && React.createElement(StepDetail, { step, highlightedCompId, onCompClick }),
  );
}

/* ─── Steps Section ─── */
function StepsSection({ selectedSignal, onCompClick }) {
  const [expandedStep, setExpandedStep] = useState(3);

  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', gap:6 } },
    React.createElement('div', { style:{ fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', padding:'4px 0 6px', display:'flex', alignItems:'center', gap:8 } },
      React.createElement('span', null, '课堂进程'),
      React.createElement('span', { style:{ fontSize:9, color:'var(--t3)', fontWeight:400, textTransform:'none', letterSpacing:0 } }, '已用 18:22 / 45:00'),
    ),
    STEPS.map(step => React.createElement(StepCard, {
      key:step.id, step, isExpanded:expandedStep===step.id,
      onToggle:() => setExpandedStep(expandedStep===step.id ? null : step.id),
      selectedSignal, onCompClick,
    })),
  );
}

Object.assign(window, { HealthCards, StepsSection });
