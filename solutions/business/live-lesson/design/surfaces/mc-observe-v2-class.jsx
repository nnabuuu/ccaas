/* ═══════════════════════════════════════════
   MC OBSERVE v2 — Class Observe Panel (Layer 1)
   ═══════════════════════════════════════════ */

function ClassObservePanel({ onSelectStudent, onClose }) {
  const [expandedQ, setExpandedQ] = React.useState(null);
  const total = STUDENTS.length;
  const totalCorrect = STUDENTS.reduce((a,s)=>a+QUESTIONS.reduce((b,q)=>b+(s.answers[q.id]===q.correct?1:0),0),0);
  const totalQs = total * QUESTIONS.length;
  const perfect = STUDENTS.filter(s=>QUESTIONS.every(q=>s.answers[q.id]===q.correct)).length;
  const zero = STUDENTS.filter(s=>QUESTIONS.every(q=>s.answers[q.id]!==q.correct)).length;
  const avgTime = Math.round(STUDENTS.reduce((a,s)=>a+s.time,0)/total);
  const avgScore = (STUDENTS.reduce((a,s)=>a+QUESTIONS.reduce((b,q)=>b+(s.answers[q.id]===q.correct?1:0),0),0)/total).toFixed(1);

  return React.createElement(React.Fragment, null,
    /* Header */
    React.createElement('div', { style: { display:'flex', alignItems:'center', gap:12, padding:'0 20px', height:52, background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 } },
      React.createElement('button', { onClick:onClose, style: { fontSize:18, color:'var(--t3)', cursor:'pointer', background:'none', border:'none', padding:'4px 8px', borderRadius:6, lineHeight:1 } }, '✕'),
      React.createElement('div', { style: { width:28, height:28, borderRadius:7, background:'var(--blue)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700 } }, 'Q'),
      React.createElement('div', { style: { flex:1 } },
        React.createElement('div', { style: { fontSize:14, fontWeight:600, letterSpacing:'-.2px' } }, '选择题 · MC 观察'),
        React.createElement('div', { style: { fontSize:10, color:'var(--t3)', marginTop:1 } }, 'Step 3: Close Read → Practice'),
      ),
      React.createElement('div', { style: { display:'flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, color:'var(--green)' } },
        React.createElement('span', { style: { width:6, height:6, borderRadius:'50%', background:'var(--green)' } }), '实时'),
      React.createElement('span', { style: { fontSize:11, color:'var(--t2)', marginLeft:8 } }, `${total}/${total} 已提交`),
    ),

    /* Body */
    React.createElement('div', { style: { flex:1, overflowY:'auto', padding:'16px 20px 40px' } },
      React.createElement('div', { style: { maxWidth:860, margin:'0 auto' } },

        /* Stats */
        React.createElement('div', { style: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 } },
          React.createElement(StatCard, { label:'班级正确率', value:`${Math.round(totalCorrect/totalQs*100)}%`, sub:`${totalCorrect}/${totalQs} · avg ${avgScore}/5`, accent:'green' }),
          React.createElement(StatCard, { label:'满分', value:perfect, sub:`${zero} 人零分`, accent:'purple' }),
          React.createElement(StatCard, { label:'平均用时', value:formatTime(avgTime), sub:`${formatTime(Math.min(...STUDENTS.map(s=>s.time)))} ~ ${formatTime(Math.max(...STUDENTS.map(s=>s.time)))}` }),
          React.createElement(StatCard, { label:'误解模式', value:MISCONCEPTIONS.length, sub:`高频 ${MISCONCEPTIONS.filter(m=>m.severity==='high').length} 个` }),
        ),

        /* Per-question */
        React.createElement(SectionHeader, { text:'逐题分析' }),
        QUESTIONS.map((q,qi) => {
          const stats = getQuestionStats(q.id);
          const isOpen = expandedQ === q.id;
          const pct = Math.round(stats.correct/stats.total*100);
          return React.createElement('div', { key:q.id, style: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:8, cursor:'pointer', transition:'box-shadow .12s', boxShadow:isOpen?'0 2px 8px rgba(28,28,26,.06)':'none' } },
            React.createElement('div', { onClick:()=>setExpandedQ(isOpen?null:q.id), style: { display:'flex', alignItems:'center', gap:10 } },
              React.createElement('span', { style: { fontSize:12, fontWeight:700, width:28 } }, `Q${qi+1}`),
              React.createElement('div', { style: { flex:1, minWidth:0 } },
                React.createElement('div', { style: { fontSize:11, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, q.stem),
                React.createElement('div', { style: { fontSize:9, color:'var(--t3)', marginTop:2 } }, q.tag),
              ),
              React.createElement('div', { style: { display:'flex', alignItems:'center', gap:6, flexShrink:0 } },
                React.createElement('div', { style: { width:60, height:6, background:'var(--surface2)', borderRadius:3, overflow:'hidden' } },
                  React.createElement('div', { style: { width:`${pct}%`, height:'100%', borderRadius:3, background:pct>80?'var(--green)':pct>50?'var(--blue)':'var(--red)' } })),
                React.createElement('span', { style: { fontSize:11, fontWeight:700, color:pct>80?'var(--green)':pct>50?'var(--blue)':'var(--red)', width:32 } }, `${pct}%`),
              ),
              React.createElement('span', { style: { fontSize:8, color:'var(--t3)', transition:'transform .2s', transform:isOpen?'rotate(90deg)':'none' } }, '▶'),
            ),
            isOpen && React.createElement('div', { style: { marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' } },
              React.createElement('div', { style: { fontSize:10, fontWeight:600, color:'var(--t3)', marginBottom:8 } }, '选项分布'),
              q.options.map((opt,oi) => {
                const count = stats.distrib[oi]; const isCorrect = oi===stats.correctIdx; const barPct = count/total*100;
                return React.createElement('div', { key:oi, style: { display:'flex', alignItems:'center', gap:8, marginBottom:4 } },
                  React.createElement('span', { style: { fontSize:10, fontWeight:700, color:isCorrect?'var(--green)':'var(--t2)', width:16 } }, OPT[oi]),
                  React.createElement('div', { style: { flex:1, height:18, background:'var(--surface2)', borderRadius:3, overflow:'hidden', position:'relative' } },
                    React.createElement('div', { style: { width:`${barPct}%`, height:'100%', borderRadius:3, background:isCorrect?'var(--green)':count>0?'var(--red)':'transparent', opacity:.7 } }),
                    React.createElement('span', { style: { position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:9, fontWeight:500, maxWidth:'90%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, opt)),
                  React.createElement('span', { style: { fontSize:10, fontWeight:700, color:isCorrect?'var(--green)':'var(--t2)', width:24, textAlign:'right' } }, count),
                );
              }),
              React.createElement('div', { style: { display:'flex', flexWrap:'wrap', gap:4, marginTop:8 } },
                STUDENTS.filter(s=>s.answers[q.id]!==q.correct).map(s =>
                  React.createElement('span', { key:s.id, onClick:e=>{e.stopPropagation();onSelectStudent(s);}, style: { fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3, background:'var(--red-bg)', color:'var(--red)', cursor:'pointer' } },
                    `${s.name} → ${OPT[s.answers[q.id]]}`))),
            ),
          );
        }),

        /* Misconceptions */
        React.createElement(SectionHeader, { text:'误解聚类' }),
        MISCONCEPTIONS.map(m =>
          React.createElement('div', { key:m.id, style: { background:m.severity==='high'?'rgba(148,41,41,.03)':'rgba(196,138,30,.03)', border:`1px solid ${m.severity==='high'?'rgba(148,41,41,.18)':'rgba(196,138,30,.18)'}`, borderRadius:8, padding:'12px 14px', marginBottom:8 } },
            React.createElement('div', { style: { display:'flex', alignItems:'center', gap:8, marginBottom:6 } },
              React.createElement('span', { style: { fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3, background:m.severity==='high'?'var(--red)':'var(--amber)', color:'#fff' } }, m.severity==='high'?'高频':'中频'),
              React.createElement('span', { style: { fontSize:12, fontWeight:700 } }, m.label),
              React.createElement('span', { style: { marginLeft:'auto', fontSize:11, fontWeight:600, color:'var(--t2)' } }, `${m.count} 人`)),
            React.createElement('div', { style: { display:'flex', flexWrap:'wrap', gap:4 } },
              m.students.map(name =>
                React.createElement('span', { key:name, onClick:()=>onSelectStudent(STUDENTS.find(s=>s.name===name)), style: { fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:4, background:'var(--surface2)', color:'var(--t2)', cursor:'pointer' } }, name))),
          )
        ),

        /* Student table */
        React.createElement(SectionHeader, { text:'全部学生' }),
        React.createElement('div', { style: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' } },
          React.createElement('div', { style: { display:'grid', gridTemplateColumns:'1fr 50px repeat(5,1fr) 60px', gap:6, padding:'8px 14px', fontSize:9, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', borderBottom:'1px solid var(--border)' } },
            React.createElement('span',null,'学生'), React.createElement('span',null,'用时'),
            ...QUESTIONS.map((_,i)=>React.createElement('span',{key:i},`Q${i+1}`)),
            React.createElement('span',null,'得分')),
          STUDENTS.map(s => {
            const score = QUESTIONS.reduce((a,q)=>a+(s.answers[q.id]===q.correct?1:0),0);
            return React.createElement('div', { key:s.id, onClick:()=>onSelectStudent(s),
              style: { display:'grid', gridTemplateColumns:'1fr 50px repeat(5,1fr) 60px', gap:6, padding:'8px 14px', fontSize:11, alignItems:'center', cursor:'pointer', borderBottom:'1px solid var(--border)', transition:'background .1s' },
              onMouseEnter:e=>e.currentTarget.style.background='var(--surface2)',
              onMouseLeave:e=>e.currentTarget.style.background='transparent' },
              React.createElement('span', { style: { fontWeight:600 } }, s.name),
              React.createElement('span', { style: { color:'var(--t2)', fontSize:10 } }, formatTime(s.time)),
              ...QUESTIONS.map(q => {
                const c = s.answers[q.id]===q.correct;
                return React.createElement('span', { key:q.id, style: { fontSize:10, fontWeight:600, textAlign:'center', color:c?'var(--green)':'var(--red)' } }, (c?'✓':'✕')+(s.changed[q.id]?' ↺':''));
              }),
              React.createElement('span', { style: { fontSize:11, fontWeight:700, color:score===5?'var(--green)':score>=3?'var(--blue)':'var(--red)' } }, `${score}/5`),
            );
          }),
        ),
      ),
    ),
  );
}

Object.assign(window, { ClassObservePanel });
