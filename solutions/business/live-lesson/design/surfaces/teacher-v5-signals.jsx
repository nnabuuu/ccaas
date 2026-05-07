/* ═══════════════════════════════════════════════════════════
   Teacher Console v5 — Signal Stream + Question Queue (Right Panel)
   ═══════════════════════════════════════════════════════════ */

function SignalStream({ selectedSignal, onSelectSignal, onExpandStep }) {
  const [filterMode, setFilterMode] = useState('all');
  const [watched, setWatched] = useState(new Set([1]));

  const toggleWatch = (id, e) => {
    e.stopPropagation();
    setWatched(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const filtered = OBSERVATIONS.filter(obs => {
    if (filterMode === 'watched') return watched.has(obs.id);
    if (filterMode === 'urg') return obs.severity === 'urg';
    return true;
  });

  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', flex:1, minHeight:0 } },
    /* Header + filter */
    React.createElement('div', { style:{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8, flexShrink:0 } },
      React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6 } },
        React.createElement('span', { style:{ fontSize:11, fontWeight:700, letterSpacing:'-.1px' } }, '观察信号'),
        React.createElement('span', { style:{ fontSize:9, fontWeight:600, background:'var(--surface2)', padding:'1px 6px', borderRadius:8, color:'var(--t3)' } }, OBSERVATIONS.length),
        watched.size > 0 && React.createElement('span', { style:{ fontSize:9, fontWeight:600, background:'var(--amber-soft)', padding:'1px 6px', borderRadius:8, color:'var(--amber)' } }, `${watched.size} 关注`),
      ),
      React.createElement('div', { style:{ display:'flex', gap:3 } },
        [{key:'all',label:'全部'},{key:'watched',label:'关注中'},{key:'urg',label:'仅紧急'}].map(f =>
          React.createElement('button', { key:f.key, onClick:()=>setFilterMode(f.key), style:{
            fontSize:9, fontWeight:600, padding:'3px 8px', borderRadius:4, cursor:'pointer', fontFamily:'inherit', flex:1,
            border:`1px solid ${filterMode===f.key ? 'var(--t1)' : 'var(--border)'}`,
            background: filterMode===f.key ? 'var(--t1)' : 'var(--surface)',
            color: filterMode===f.key ? 'var(--surface)' : 'var(--t2)',
          } }, f.label)
        ),
      ),
    ),

    /* Cards */
    React.createElement('div', { style:{ padding:'8px 10px', display:'flex', flexDirection:'column', gap:6, flex:1, overflowY:'auto' } },
      filtered.length === 0 && React.createElement('div', { style:{ padding:20, textAlign:'center', color:'var(--t3)', fontSize:11 } }, '暂无匹配信号'),
      filtered.map(obs => {
        const step = STEPS.find(s => s.id === obs.stepId);
        const comp = step?.components.find(c => c.id === obs.componentId);
        const ct = comp ? COMP_TYPES[comp.type] : null;
        const isSelected = selectedSignal === obs.id;
        const isWatched = watched.has(obs.id);

        return React.createElement('div', { key:obs.id,
          onClick:() => { onSelectSignal(isSelected ? null : obs.id); onExpandStep && onExpandStep(obs.stepId); },
          style:{
            padding:'10px 12px', borderRadius:8, cursor:'pointer',
            background: isSelected ? 'var(--bg)' : 'var(--surface)',
            border:`1px solid ${isSelected ? 'rgba(26,95,160,.25)' : isWatched ? 'rgba(196,138,30,.2)' : 'var(--border)'}`,
            transition:'all .15s',
          }
        },
          /* Row 1: breadcrumb + watch */
          React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:4, marginBottom:6 } },
            React.createElement('span', { style:{ fontSize:8, fontWeight:700, color:'var(--t3)' } }, `T${step.id}`),
            React.createElement('span', { style:{ fontSize:8, color:'var(--t3)' } }, '·'),
            ct && React.createElement('span', { style:{ fontSize:8, fontWeight:700, color:ct.color, background:ct.bg, padding:'1px 4px', borderRadius:2 } }, ct.label),
            React.createElement('div', { style:{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 } },
              React.createElement('span', { style:{ fontSize:8, color:'var(--t3)' } }, obs.time),
              React.createElement('button', { onClick:e=>toggleWatch(obs.id,e), style:{
                width:18, height:18, borderRadius:4, border:`1.5px solid ${isWatched ? 'var(--amber)' : 'var(--border)'}`,
                background: isWatched ? 'var(--amber-soft)' : 'var(--surface)', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:10,
                color: isWatched ? 'var(--amber)' : 'var(--t3)', flexShrink:0,
              } }, isWatched ? '★' : '☆'),
            ),
          ),
          /* Row 2: severity + title */
          React.createElement('div', { style:{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:6 } },
            React.createElement('span', { style:{
              width:6, height:6, borderRadius:'50%', marginTop:5, flexShrink:0,
              background: obs.severity==='urg' ? 'var(--red)' : obs.severity==='warn' ? 'var(--amber)' : 'var(--t3)',
              animation: obs.severity==='urg' ? 'sig-pulse 2s infinite' : 'none',
            } }),
            React.createElement('span', { style:{ fontSize:11, fontWeight:700, color:'var(--t1)', lineHeight:1.4 } }, obs.title),
          ),
          /* Detail when selected */
          isSelected && React.createElement('div', { style:{ fontSize:10, color:'var(--t2)', lineHeight:1.5, marginBottom:8, paddingLeft:12 } }, obs.detail),
          /* Students always visible */
          React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', gap:3, marginBottom: isSelected ? 8 : 0, paddingLeft:12 } },
            obs.students.map(name => React.createElement('span', { key:name, style:{
              fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3,
              background: obs.severity==='urg' ? 'rgba(148,41,41,.12)' : 'rgba(196,138,30,.12)',
              color: obs.severity==='urg' ? 'var(--red)' : 'var(--amber)',
            } }, name)),
          ),
          /* Actions when selected */
          isSelected && React.createElement('div', { style:{ display:'flex', gap:4, paddingLeft:12, paddingTop:4, borderTop:'1px dashed var(--border)', marginTop:4 } },
            obs.actions.map((act, ai) => React.createElement('button', { key:ai, onClick:e=>e.stopPropagation(), style:{
              fontSize:9, fontWeight:600, padding:'4px 10px', borderRadius:4,
              border: ai===0 ? 'none' : '1px solid var(--border)',
              background: ai===0 ? 'var(--t1)' : 'var(--surface)',
              color: ai===0 ? 'var(--surface)' : 'var(--t1)', cursor:'pointer', fontFamily:'inherit',
            } }, act)),
          ),
        );
      }),
    ),

    /* Bottom watched summary */
    watched.size > 0 && React.createElement('div', { style:{
      padding:'10px 14px', borderTop:'1px solid var(--border)', background:'var(--amber-soft)',
      display:'flex', flexDirection:'column', gap:4, flexShrink:0,
    } },
      React.createElement('div', { style:{ fontSize:9, fontWeight:700, color:'var(--amber)', textTransform:'uppercase', letterSpacing:'.4px' } }, `${watched.size} 个关注中的信号`),
      [...watched].map(id => {
        const obs = OBSERVATIONS.find(o => o.id === id);
        if (!obs) return null;
        return React.createElement('div', { key:id, style:{ display:'flex', alignItems:'center', gap:4, fontSize:9 } },
          React.createElement('span', { style:{ width:5, height:5, borderRadius:'50%', background: obs.severity==='urg' ? 'var(--red)' : 'var(--amber)', flexShrink:0 } }),
          React.createElement('span', { style:{ fontWeight:600, color:'var(--t1)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, obs.title),
          React.createElement('span', { style:{ color:'var(--t3)' } }, `${obs.students.length} 人`),
        );
      }),
    ),
  );
}

/* ─── Question Queue ─── */
function QuestionQueue() {
  const [expanded, setExpanded] = useState(null);
  const catStyles = {
    concept: { label:'概念理解', bg:'var(--blue-soft)', color:'var(--blue)' },
    content: { label:'课文内容', bg:'var(--ai-soft)', color:'var(--ai)' },
    task:    { label:'解题求助', bg:'var(--amber-soft)', color:'var(--amber)' },
    strategy:{ label:'阅读策略', bg:'var(--green-soft)', color:'var(--green)' },
  };

  // Group by category
  const groups = {};
  QUESTIONS.forEach((q,i) => {
    if (!groups[q.cat]) groups[q.cat] = [];
    groups[q.cat].push({...q, idx:i});
  });

  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', flex:1, minHeight:0 } },
    React.createElement('div', { style:{ padding:'10px 14px', borderBottom:'1px solid var(--border)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:6, flexShrink:0 } },
      React.createElement('span', { style:{ fontSize:11, fontWeight:700 } }, '问题聚类'),
      React.createElement('span', { style:{ fontSize:9, fontWeight:600, background:'var(--surface2)', padding:'1px 6px', borderRadius:8, color:'var(--t3)' } }, QUESTIONS.length),
    ),
    React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'4px 8px 8px' } },
      Object.entries(groups).map(([cat, qs]) => {
        const cs = catStyles[cat] || catStyles.concept;
        return React.createElement(Fragment, { key:cat },
          React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6, padding:'8px 6px 4px', fontSize:9, fontWeight:700, color:'var(--t2)' } },
            React.createElement('span', { style:{ padding:'1px 6px', borderRadius:4, fontSize:10, fontWeight:500, background:cs.bg, color:cs.color } }, cs.label),
            React.createElement('span', { style:{ fontWeight:500, color:'var(--t3)' } }, qs.length),
          ),
          qs.map(q => React.createElement(Fragment, { key:q.idx },
            React.createElement('div', { onClick:()=>setExpanded(expanded===q.idx ? null : q.idx),
              style:{ display:'flex', alignItems:'flex-start', gap:5, padding:'4px 6px 4px 12px', borderRadius:4, cursor:'pointer' },
              onMouseEnter:e=>e.currentTarget.style.background='var(--bg)',
              onMouseLeave:e=>e.currentTarget.style.background='transparent',
            },
              React.createElement('span', { style:{ fontSize:10, fontWeight:600, color:'var(--t2)', flexShrink:0, minWidth:48 } }, q.student),
              React.createElement('div', { style:{ fontSize:10, fontWeight:500, color:'var(--t1)', lineHeight:1.35, flex:1, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' } }, q.q),
              React.createElement('span', { style:{ fontSize:8, color:'var(--t3)', flexShrink:0 } }, q.time),
            ),
            expanded === q.idx && React.createElement('div', { style:{ padding:'6px 12px 8px', fontSize:11, color:'var(--t2)', lineHeight:1.55, background:'var(--bg)', borderRadius:'0 0 4px 4px', margin:'-2px 6px 4px 6px' } },
              React.createElement('span', { style:{ fontSize:9, fontWeight:600, color:'var(--ai)', textTransform:'uppercase', letterSpacing:'.3px', display:'block', marginBottom:3 } }, 'AI 回答：'),
              q.answer,
            ),
          )),
        );
      }),
    ),
  );
}

/* ─── Right Panel (combines signals + questions) ─── */
function RightPanel({ selectedSignal, onSelectSignal, onExpandStep }) {
  const [tab, setTab] = useState('signals');

  return React.createElement('div', { style:{ borderLeft:'1px solid var(--border)', background:'var(--surface)', display:'flex', flexDirection:'column', overflow:'hidden' } },
    /* Tabs */
    React.createElement('div', { style:{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 } },
      [{key:'signals', label:'观察信号', count:OBSERVATIONS.length}, {key:'questions', label:'问题聚类', count:QUESTIONS.length}].map(t =>
        React.createElement('button', { key:t.key, onClick:()=>setTab(t.key), style:{
          flex:1, padding:'10px 14px', fontSize:11, fontWeight: tab===t.key ? 700 : 500,
          color: tab===t.key ? 'var(--t1)' : 'var(--t3)', cursor:'pointer',
          borderBottom: tab===t.key ? '2px solid var(--t1)' : '2px solid transparent',
          background:'none', border:'none', borderBottomWidth:2, borderBottomStyle:'solid',
          borderBottomColor: tab===t.key ? 'var(--t1)' : 'transparent', fontFamily:'inherit',
        } }, `${t.label} · ${t.count}`)
      ),
    ),
    tab === 'signals'
      ? React.createElement(SignalStream, { selectedSignal, onSelectSignal, onExpandStep })
      : React.createElement(QuestionQueue),
  );
}

Object.assign(window, { RightPanel });
