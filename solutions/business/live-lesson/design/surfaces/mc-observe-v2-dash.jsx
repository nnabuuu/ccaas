/* ═══════════════════════════════════════════
   MC OBSERVE v2 — Dashboard Background (Layer 0)
   ═══════════════════════════════════════════ */

function DashboardBackground({ onOpenObserve }) {
  const steps = [
    { n:1, name:'Predict', type:'MC 选择题', count:0, pct:'95%', done:true },
    { n:2, name:'Skim', type:'Select Evidence', count:4, pct:'—', done:false },
    { n:3, name:'Close Read', type:'Map It · 信息矩阵', count:26, pct:'62%', done:false, current:true },
    { n:4, name:'Analyze', type:'Select Evidence', count:2, pct:'—', done:false },
    { n:5, name:'Respond', type:'MC 选择题', count:0, pct:'—', done:false },
  ];

  const subtasks = [
    { phase:'Listen', label:'阅读课文', meta:'8 人', color:'var(--lecture)', bg:'rgba(107,91,58,.08)' },
    { phase:'Practice', label:'选择题 MC', meta:'16 人 · 72%', color:'var(--blue)', bg:'rgba(26,95,160,.08)', clickable:true },
    { phase:'Discuss', label:'AI 对话', meta:'2 人', color:'var(--ai)', bg:'rgba(74,67,135,.08)' },
  ];

  return React.createElement('div', { style: { display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)' } },
    /* Band */
    React.createElement('div', { style: { display:'flex', alignItems:'center', gap:12, padding:'0 24px', height:44, background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 } },
      React.createElement('div', { style: { width:22, height:22, borderRadius:6, background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 } }, 'E'),
      React.createElement('span', { style: { fontSize:13, fontWeight:600, letterSpacing:'-.1px' } }, 'Beauty & Identity'),
      React.createElement('span', { style: { fontSize:10, fontWeight:600, color:'var(--teal)', background:'var(--teal-bg)', padding:'2px 8px', borderRadius:3 } }, 'Self-paced'),
      React.createElement('span', { style: { fontSize:12, color:'var(--t2)', paddingLeft:12, borderLeft:'1px solid rgba(28,28,26,.14)', marginLeft:2 } }, '高一(3)班 · 32人'),
      React.createElement('div', { style: { marginLeft:'auto', display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--green)' } },
        React.createElement('span', { style: { width:6, height:6, borderRadius:'50%', background:'var(--green)' } }), '实时'),
    ),
    /* Timeline */
    React.createElement('div', { style: { display:'flex', alignItems:'center', height:40, padding:'0 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 } },
      React.createElement('span', { style: { fontSize:12, fontWeight:700, minWidth:42 } }, '28:40'),
      React.createElement('div', { style: { flex:1, height:6, background:'var(--surface2)', borderRadius:3, position:'relative' } },
        React.createElement('div', { style: { width:'72%', height:'100%', borderRadius:3, background:'var(--t1)' } })),
      React.createElement('span', { style: { fontSize:12, color:'var(--t3)', minWidth:42 } }, '40:00'),
    ),
    /* Body */
    React.createElement('div', { style: { flex:1, display:'grid', gridTemplateColumns:'1fr 340px', minHeight:0 } },
      /* Left */
      React.createElement('div', { style: { padding:'18px 24px', overflowY:'auto', display:'flex', flexDirection:'column', gap:12 } },
        steps.map(step => {
          const bg = step.done?'var(--green)':step.current?'var(--blue)':'var(--t3)';
          return React.createElement('div', { key:step.n, style: { background:'var(--surface)', border:`1px solid ${step.current?'rgba(26,95,160,.18)':'var(--border)'}`, borderRadius:10, overflow:'hidden' } },
            React.createElement('div', { style: { display:'flex', alignItems:'center', gap:10, padding:'10px 14px' } },
              React.createElement('div', { style: { width:22, height:22, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', background:bg, flexShrink:0 } }, step.n),
              React.createElement('span', { style: { fontSize:13, fontWeight:600, flex:1 } }, step.name),
              React.createElement('span', { style: { fontSize:10, color:'var(--t3)' } }, step.type),
              React.createElement('span', { style: { fontSize:10, fontWeight:600, color:step.done?'var(--green)':'var(--t2)', padding:'2px 8px', borderRadius:3, background:step.done?'var(--green-bg)':'var(--surface2)' } },
                step.done ? '✓ 完成' : `${step.count} 人`),
            ),
            step.current && React.createElement('div', { style: { borderTop:'1px solid var(--border)', padding:'4px 0' } },
              subtasks.map((sub,si) =>
                React.createElement('div', { key:si,
                  onClick: sub.clickable ? onOpenObserve : undefined,
                  style: { display:'flex', alignItems:'center', gap:8, padding:'7px 14px 7px 48px', cursor:sub.clickable?'pointer':'default', transition:'background .1s', borderRadius:4 },
                  onMouseEnter: sub.clickable ? e=>e.currentTarget.style.background='var(--surface2)' : undefined,
                  onMouseLeave: sub.clickable ? e=>e.currentTarget.style.background='transparent' : undefined,
                },
                  React.createElement('span', { style: { fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3, background:sub.bg, color:sub.color } }, sub.phase),
                  React.createElement('span', { style: { fontSize:11, color:'var(--t2)', flex:1 } }, sub.label),
                  React.createElement('span', { style: { fontSize:10, color:'var(--t3)' } }, sub.meta),
                  sub.clickable && React.createElement('span', { style: { fontSize:9, fontWeight:600, color:'var(--blue)', opacity:.7 } }, '查看 →'),
                )
              ),
            ),
          );
        }),
      ),
      /* Right */
      React.createElement('div', { style: { background:'var(--surface)', borderLeft:'1px solid var(--border)', padding:'14px 16px', overflowY:'auto' } },
        React.createElement('div', { style: { fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12 } }, '问题聚类'),
        [1,2,3].map(i => React.createElement('div', { key:i, style: { background:'var(--surface2)', borderRadius:8, height:56, marginBottom:8 } })),
        React.createElement('div', { style: { fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:12, marginTop:20 } }, '观察要点'),
        React.createElement('div', { style: { background:'var(--amber-bg)', border:'1px solid rgba(122,77,14,.12)', borderRadius:8, padding:12 } },
          React.createElement('div', { style: { fontSize:11, fontWeight:600, color:'var(--amber)' } }, '3名学生可能随机作答'),
          React.createElement('div', { style: { fontSize:10, color:'var(--t2)', marginTop:4 } }, '徐晨曦、邓梓涵 全部选A'),
        ),
      ),
    ),
  );
}

Object.assign(window, { DashboardBackground });
