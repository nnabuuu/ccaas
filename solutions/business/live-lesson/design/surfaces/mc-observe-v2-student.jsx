/* ═══════════════════════════════════════════
   MC OBSERVE v2 — Student Detail Panel (Layer 2)
   ═══════════════════════════════════════════ */

function StudentDetailPanel({ student, onClose, allStudents, onSwitchStudent }) {
  if (!student) return null;
  const s = student;
  const score = QUESTIONS.reduce((a,q)=>a+(s.answers[q.id]===q.correct?1:0),0);
  const idx = allStudents.findIndex(st=>st.id===s.id);
  const prev = idx>0 ? allStudents[idx-1] : null;
  const next = idx<allStudents.length-1 ? allStudents[idx+1] : null;

  return React.createElement(React.Fragment, null,
    /* Header */
    React.createElement('div', { style: { display:'flex', alignItems:'center', gap:12, padding:'0 20px', height:52, background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 } },
      React.createElement('button', { onClick:onClose, style: { fontSize:18, color:'var(--t3)', cursor:'pointer', background:'none', border:'none', padding:'4px 8px', borderRadius:6, lineHeight:1 } }, '✕'),
      React.createElement('div', { style: { width:32, height:32, borderRadius:8, background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 } }, s.name[0]),
      React.createElement('div', { style: { flex:1 } },
        React.createElement('div', { style: { fontSize:14, fontWeight:600 } }, s.name),
        React.createElement('div', { style: { fontSize:10, color:'var(--t3)', marginTop:1 } }, 'MC · 选择题 · Step 3'),
      ),
      React.createElement('span', { style: { fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:4, background:score===5?'var(--green-bg)':score>=3?'var(--blue-bg)':'var(--red-bg)', color:score===5?'var(--green)':score>=3?'var(--blue)':'var(--red)' } }, `${score}/5 正确`),
      React.createElement('div', { style: { display:'flex', gap:4, marginLeft:8 } },
        React.createElement('button', { disabled:!prev, onClick:()=>prev&&onSwitchStudent(prev), style: { width:28, height:28, borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', cursor:prev?'pointer':'default', opacity:prev?1:.3, fontSize:14, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t2)' } }, '‹'),
        React.createElement('button', { disabled:!next, onClick:()=>next&&onSwitchStudent(next), style: { width:28, height:28, borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', cursor:next?'pointer':'default', opacity:next?1:.3, fontSize:14, fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t2)' } }, '›'),
      ),
    ),

    /* Body */
    React.createElement('div', { style: { flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', overflow:'hidden' } },
      /* Left: stats + questions */
      React.createElement('div', { style: { overflowY:'auto', padding:'16px 20px 40px' } },
        React.createElement('div', { style: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 } },
          React.createElement(MiniStat, { label:'正确', value:`${score}/5`, color:score===5?'var(--green)':score>=3?'var(--blue)':'var(--red)' }),
          React.createElement(MiniStat, { label:'用时', value:formatTime(s.time) }),
          React.createElement(MiniStat, { label:'改答案', value:Object.values(s.changed).filter(Boolean).length }),
        ),
        React.createElement(SectionHeader, { text:'逐题详情' }),
        QUESTIONS.map((q,qi) => {
          const correct = s.answers[q.id]===q.correct;
          const changed = s.changed[q.id];
          return React.createElement('div', { key:q.id, style: { background:correct?'rgba(45,102,18,.02)':'rgba(148,41,41,.02)', border:`1px solid ${correct?'rgba(45,102,18,.15)':'rgba(148,41,41,.15)'}`, borderRadius:8, padding:'12px 14px', marginBottom:8 } },
            React.createElement('div', { style: { display:'flex', alignItems:'center', gap:8, marginBottom:6 } },
              React.createElement('span', { style: { fontSize:11, fontWeight:700, color:correct?'var(--green)':'var(--red)' } }, `Q${qi+1} ${correct?'✓':'✕'}`),
              React.createElement('span', { style: { fontSize:9, color:'var(--t3)', background:'var(--surface2)', padding:'2px 6px', borderRadius:3 } }, q.tag),
              React.createElement('span', { style: { marginLeft:'auto', fontSize:9, color:'var(--t3)' } }, `${formatTime(s.times[q.id])}${changed?' · 改过':''}`)),
            React.createElement('div', { style: { fontSize:11, color:'var(--t2)', lineHeight:1.6, marginBottom:6 } }, q.stem),
            q.options.map((opt,oi) => {
              const isChoice = s.answers[q.id]===oi;
              const isCorr = q.correct===oi;
              const bg = isChoice&&isCorr?'var(--green-bg)':isChoice?'var(--red-bg)':isCorr?'rgba(45,102,18,.06)':'transparent';
              const clr = isChoice&&isCorr?'var(--green)':isChoice?'var(--red)':isCorr?'var(--green)':'var(--t2)';
              return React.createElement('div', { key:oi, style: { display:'flex', alignItems:'center', gap:8, padding:'4px 8px', borderRadius:4, background:bg, marginBottom:2 } },
                React.createElement('span', { style: { fontSize:10, fontWeight:700, color:clr, width:14 } }, OPT[oi]),
                React.createElement('span', { style: { fontSize:11, color:clr, fontWeight:(isChoice||isCorr)?600:400, flex:1 } }, opt),
                isChoice && React.createElement('span', { style: { fontSize:9, fontWeight:700, color:clr } }, isCorr?'✓ 选对':'✕ 选了'),
                !isChoice && isCorr && React.createElement('span', { style: { fontSize:9, color:'var(--green)' } }, '← 正确'),
              );
            }),
          );
        }),
      ),

      /* Right: insights + comparison */
      React.createElement('div', { style: { overflowY:'auto', padding:'16px 20px 40px', background:'var(--surface)', borderLeft:'1px solid var(--border)' } },
        React.createElement(SectionHeader, { text:'关键发现' }),
        React.createElement('div', { style: { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:12 } },
          React.createElement('div', { style: { fontSize:10, fontWeight:700, marginBottom:6 } }, '学习状态摘要'),
          s.keyInsights.map((ins,i) =>
            React.createElement('div', { key:i, style: { fontSize:11, color:'var(--t2)', lineHeight:1.6, padding:'2px 0', display:'flex', gap:6 } },
              React.createElement('span', { style: { color:'var(--t3)', flexShrink:0 } }, '·'),
              React.createElement('span', null, ins)))),

        /* Status */
        React.createElement('div', { style: { background:score===5?'var(--green-bg)':score>=3?'var(--blue-bg)':'var(--red-bg)', border:`1px solid ${score===5?'rgba(45,102,18,.15)':score>=3?'rgba(26,95,160,.15)':'rgba(148,41,41,.15)'}`, borderRadius:8, padding:'12px 14px', marginBottom:16 } },
          React.createElement('div', { style: { fontSize:10, fontWeight:700, color:score===5?'var(--green)':score>=3?'var(--blue)':'var(--red)' } },
            score===5?'全部正确':score>=3?'大部分正确':'需重点关注'),
          React.createElement('div', { style: { fontSize:11, color:'var(--t2)', lineHeight:1.6, marginTop:4 } },
            `正确 ${score}/5，用时 ${formatTime(s.time)}。${Object.values(s.changed).filter(Boolean).length>0?`改过 ${Object.values(s.changed).filter(Boolean).length} 题答案。`:''}`)),

        /* Time bars */
        React.createElement(SectionHeader, { text:'每题用时' }),
        React.createElement('div', { style: { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:16 } },
          QUESTIONS.map((q,qi) => {
            const t = s.times[q.id]; const c = s.answers[q.id]===q.correct;
            return React.createElement('div', { key:q.id, style: { display:'flex', alignItems:'center', gap:8, marginBottom:6 } },
              React.createElement('span', { style: { fontSize:10, fontWeight:600, color:'var(--t2)', width:24 } }, `Q${qi+1}`),
              React.createElement('div', { style: { flex:1, height:14, background:'var(--surface2)', borderRadius:3, overflow:'hidden' } },
                React.createElement('div', { style: { width:`${Math.min(t/45*100,100)}%`, height:'100%', borderRadius:3, background:c?'var(--green)':'var(--red)', opacity:.6 } })),
              React.createElement('span', { style: { fontSize:9, fontWeight:600, color:'var(--t2)', width:24 } }, `${t}s`),
              React.createElement('span', { style: { fontSize:9, color:c?'var(--green)':'var(--red)' } }, c?'✓':'✕'));
          })),

        /* Class comparison */
        React.createElement(SectionHeader, { text:'班级对比' }),
        React.createElement('div', { style: { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' } },
          [{label:'得分',val:score,avg:+(STUDENTS.reduce((a,st)=>a+QUESTIONS.reduce((b,q)=>b+(st.answers[q.id]===q.correct?1:0),0),0)/STUDENTS.length).toFixed(1),max:5,unit:'/5'},
           {label:'用时',val:s.time,avg:Math.round(STUDENTS.reduce((a,st)=>a+st.time,0)/STUDENTS.length),max:180,unit:'s',format:formatTime,invert:true},
          ].map((row,i) =>
            React.createElement('div', { key:i, style: { display:'flex', alignItems:'center', gap:8, marginBottom:8 } },
              React.createElement('span', { style: { fontSize:10, color:'var(--t3)', width:40, flexShrink:0 } }, row.label),
              React.createElement('div', { style: { flex:1, height:14, background:'var(--surface2)', borderRadius:3, position:'relative', overflow:'visible' } },
                React.createElement('div', { style: { position:'absolute', left:`${row.avg/row.max*100}%`, top:-2, width:2, height:18, background:'rgba(28,28,26,.14)', borderRadius:1, zIndex:1 } }),
                React.createElement('div', { style: { height:'100%', width:`${row.val/row.max*100}%`, borderRadius:3, background:(row.invert?(row.val<row.avg):(row.val>row.avg))?'var(--green)':'var(--amber)', opacity:.7 } })),
              React.createElement('span', { style: { fontSize:10, fontWeight:600, width:36, textAlign:'right' } }, row.format?row.format(row.val):`${row.val}${row.unit}`))),
          React.createElement('div', { style: { display:'flex', gap:12, marginTop:4, fontSize:9, color:'var(--t3)' } },
            React.createElement('span', { style: { display:'flex', alignItems:'center', gap:3 } },
              React.createElement('span', { style: { width:8, height:4, borderRadius:2, background:'var(--green)', display:'inline-block', opacity:.7 } }), '该学生'),
            React.createElement('span', { style: { display:'flex', alignItems:'center', gap:3 } },
              React.createElement('span', { style: { width:2, height:10, borderRadius:1, background:'rgba(28,28,26,.14)', display:'inline-block' } }), '班级均值'))),
      ),
    ),
  );
}

Object.assign(window, { StudentDetailPanel });
