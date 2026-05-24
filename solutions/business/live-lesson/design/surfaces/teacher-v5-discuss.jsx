/* ═══════════════════════════════════════════════════════════
   Teacher Console v5 — Discuss Deep-Dive View
   Class overview + student conversation drill-down
   ═══════════════════════════════════════════════════════════ */

/* ─── Class Overview ─── */
function DiscussClassView({ componentId, onSelectStudent, onBack }) {
  const students = DISCUSS_STUDENTS;
  const total = students.length;
  const goalReached = students.filter(s=>s.goalReached).length;
  const fallback = students.filter(s=>!s.goalReached).length;
  const fallbackCorrect = students.filter(s=>!s.goalReached && s.mcCorrect).length;
  const fallbackWrong = students.filter(s=>!s.goalReached && s.mcCorrect===false).length;
  const avgRounds = (students.reduce((a,s)=>a+s.rounds,0)/total).toFixed(1);

  const step = STEPS.find(s => s.components.some(c => c.id === componentId));
  const comp = step?.components.find(c => c.id === componentId);

  return React.createElement('div', { style:{ flex:1, overflowY:'auto', padding:'20px 24px 40px' } },
    React.createElement('div', { style:{ maxWidth:900, margin:'0 auto' } },

      /* Back + title */
      React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:12, marginBottom:16 } },
        React.createElement('button', { onClick:onBack, style:{
          fontSize:11, fontWeight:500, color:'var(--t2)', cursor:'pointer', padding:'4px 10px', borderRadius:6,
          border:'1px solid var(--border)', background:'var(--surface)', fontFamily:'inherit',
        } }, '← 返回课堂'),
        React.createElement('div', null,
          React.createElement('div', { style:{ fontSize:15, fontWeight:700 } }, comp?.label || 'Discuss 观察'),
          React.createElement('div', { style:{ fontSize:11, color:'var(--t3)', marginTop:2 } }, `T${step?.id} ${step?.name} · ${total} 人参与讨论`),
        ),
      ),

      /* Health Cards */
      React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 } },
        React.createElement('div', { className:'hcard good' },
          React.createElement('div', { className:'hcard-lb' }, '对话达标'),
          React.createElement('div', { className:'hcard-v' }, `${goalReached}/${total}`),
          React.createElement('div', { className:'hcard-sub' }, `${Math.round(goalReached/total*100)}% 通过苏格拉底对话`),
        ),
        React.createElement('div', { className:'hcard warn' },
          React.createElement('div', { className:'hcard-lb' }, '兜底选择题'),
          React.createElement('div', { className:'hcard-v' }, fallback),
          React.createElement('div', { className:'hcard-sub' }, React.createElement('span', null, `答对 ${fallbackCorrect} · 答错 `, React.createElement('strong', { style:{color:'var(--red)'} }, fallbackWrong))),
        ),
        React.createElement('div', { className:'hcard' },
          React.createElement('div', { className:'hcard-lb' }, '平均轮次'),
          React.createElement('div', { className:'hcard-v' }, avgRounds),
        ),
        React.createElement('div', { className:'hcard' },
          React.createElement('div', { className:'hcard-lb' }, '误解聚类'),
          React.createElement('div', { className:'hcard-v' }, MISCONCEPTIONS.length),
        ),
      ),

      /* Outcome Funnel */
      React.createElement(SectionHeader, { label:'结果分布' }),
      React.createElement('div', { style:{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 20px', marginBottom:16 } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:12, marginBottom:12 } },
          React.createElement('div', { style:{ fontSize:11, fontWeight:600, color:'var(--t2)', width:80 } }, `全部 ${total} 人`),
          React.createElement('div', { style:{ display:'flex', height:24, borderRadius:4, overflow:'hidden', flex:1, background:'var(--surface2)' } },
            React.createElement('div', { style:{ width:`${goalReached/total*100}%`, background:'var(--green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' } }, `${goalReached} 达标`),
            React.createElement('div', { style:{ width:`${fallbackCorrect/total*100}%`, background:'var(--amber)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' } }, `${fallbackCorrect} 选对`),
            React.createElement('div', { style:{ width:`${fallbackWrong/total*100}%`, background:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff' } }, `${fallbackWrong} 选错`),
          ),
        ),
      ),

      /* Round-by-Round */
      React.createElement(SectionHeader, { label:'逐轮理解变化' }),
      React.createElement(RoundByRound, { students, onSelectStudent }),

      /* Misconceptions */
      React.createElement(SectionHeader, { label:'误解聚类' }),
      MISCONCEPTIONS.map(m => React.createElement('div', { key:m.id, style:{
        background:'var(--surface)', border:`1px solid ${m.severity==='high' ? 'rgba(148,41,41,.2)' : m.severity==='medium' ? 'rgba(196,138,30,.2)' : 'var(--border)'}`,
        borderRadius:8, padding:'12px 14px', marginBottom:8,
        background: m.severity==='high' ? 'rgba(148,41,41,.03)' : m.severity==='medium' ? 'rgba(196,138,30,.03)' : 'var(--surface)',
      } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:8, marginBottom:6 } },
          React.createElement('span', { style:{ fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3, color:'#fff', background: m.severity==='high' ? 'var(--red)' : m.severity==='medium' ? 'var(--amber)' : 'var(--t3)' } }, m.severity==='high' ? '高频' : m.severity==='medium' ? '中频' : '低频'),
          React.createElement('span', { style:{ fontSize:12, fontWeight:700, color:'var(--t1)' } }, m.label),
          React.createElement('span', { style:{ marginLeft:'auto', fontSize:11, fontWeight:600, color:'var(--t2)' } }, `${m.count} 人`),
        ),
        React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', gap:4 } },
          m.students.map(name => React.createElement('span', { key:name, onClick:()=>{ const s=students.find(st=>st.name===name); if(s) onSelectStudent(s); },
            style:{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:4, background:'var(--surface2)', color:'var(--t2)', cursor:'pointer' } }, name)),
        ),
      )),

      /* Student List */
      React.createElement(SectionHeader, { label:'全部学生' }),
      React.createElement('div', { style:{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' } },
        React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 80px 60px 60px 80px', gap:8, padding:'8px 14px', fontSize:9, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', borderBottom:'1px solid var(--border)' } },
          React.createElement('span', null, '学生'), React.createElement('span', null, '结果'), React.createElement('span', null, '轮次'), React.createElement('span', null, '用时'), React.createElement('span', null, '最终理解'),
        ),
        students.map(s => {
          const finalU = s.understanding[s.understanding.length-1];
          return React.createElement('div', { key:s.id, onClick:()=>onSelectStudent(s),
            style:{ display:'grid', gridTemplateColumns:'1fr 80px 60px 60px 80px', gap:8, padding:'8px 14px', fontSize:11, alignItems:'center', cursor:'pointer', borderBottom:'1px solid var(--border)' },
            onMouseEnter:e=>e.currentTarget.style.background='var(--surface2)',
            onMouseLeave:e=>e.currentTarget.style.background='transparent',
          },
            React.createElement('span', { style:{ fontWeight:600 } }, s.name),
            React.createElement('span', null, React.createElement('span', { style:{
              fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3, display:'inline-flex', alignItems:'center', gap:3,
              background: s.goalReached ? 'var(--green-soft)' : 'var(--amber-soft)',
              color: s.goalReached ? 'var(--green)' : 'var(--amber)',
            } }, s.goalReached ? '✓ 达标' : s.mcCorrect ? '△ 选对' : '✕ 选错')),
            React.createElement('span', { style:{ color:'var(--t2)' } }, s.rounds),
            React.createElement('span', { style:{ color:'var(--t2)' } }, formatTime(s.time)),
            React.createElement('span', null,
              React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6 } },
                React.createElement('div', { style:{ flex:1, height:4, background:'var(--surface2)', borderRadius:2, overflow:'hidden' } },
                  React.createElement('div', { style:{ width:`${finalU*100}%`, height:'100%', borderRadius:2, background: finalU>0.8 ? 'var(--green)' : finalU>0.5 ? 'var(--blue)' : 'var(--amber)' } }),
                ),
                React.createElement('span', { style:{ fontSize:9, fontWeight:600, color:'var(--t2)', width:28 } }, `${Math.round(finalU*100)}%`),
              ),
            ),
          );
        }),
      ),
    ),
  );
}

/* ─── Round-by-Round ─── */
function RoundByRound({ students, onSelectStudent }) {
  const [openRound, setOpenRound] = useState(null);
  const maxR = Math.max(...students.map(s => s.understanding.length));

  const rounds = Array.from({ length:maxR }, (_, i) => {
    const active = students.filter(s => s.understanding.length > i);
    const vals = active.map(s => s.understanding[i]);
    const avg = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    const high = active.filter(s => s.understanding[i] > 0.7);
    const mid = active.filter(s => s.understanding[i] > 0.3 && s.understanding[i] <= 0.7);
    const low = active.filter(s => s.understanding[i] <= 0.3);
    return { round:i+1, avg, active:active.length, high, mid, low };
  });

  return React.createElement('div', { style:{ marginBottom:16 } },
    React.createElement('div', { style:{ display:'flex', gap:14, fontSize:10, color:'var(--t3)', marginBottom:10 } },
      [{c:'var(--green)', l:'理解 >70%'},{c:'var(--blue)', l:'30-70%'},{c:'var(--amber)', l:'<30%'}].map((lg,i) =>
        React.createElement('span', { key:i, style:{ display:'flex', alignItems:'center', gap:4 } },
          React.createElement('span', { style:{ width:10, height:10, borderRadius:2, background:lg.c, display:'inline-block' } }), lg.l),
      ),
    ),
    rounds.map(rd => {
      const isOpen = openRound === rd.round;
      return React.createElement('div', { key:rd.round, style:{ background:'var(--surface)', border:`1px solid ${isOpen ? 'var(--border-strong)' : 'var(--border)'}`, borderRadius:8, marginBottom:6, overflow:'hidden' } },
        React.createElement('div', { onClick:()=>setOpenRound(isOpen ? null : rd.round), style:{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer' } },
          React.createElement('div', { style:{ fontSize:12, fontWeight:700, width:56, flexShrink:0 } }, `Round ${rd.round}`),
          React.createElement('div', { style:{ flex:1, display:'flex', height:18, borderRadius:3, overflow:'hidden', background:'var(--surface2)' } },
            rd.high.length > 0 && React.createElement('div', { style:{ width:`${rd.high.length/rd.active*100}%`, background:'var(--green)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' } }, rd.high.length),
            rd.mid.length > 0 && React.createElement('div', { style:{ width:`${rd.mid.length/rd.active*100}%`, background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' } }, rd.mid.length),
            rd.low.length > 0 && React.createElement('div', { style:{ width:`${rd.low.length/rd.active*100}%`, background:'var(--amber)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700, color:'#fff' } }, rd.low.length),
          ),
          React.createElement('div', { style:{ fontSize:12, fontWeight:700, width:40, textAlign:'right' } }, `${Math.round(rd.avg*100)}%`),
          React.createElement('div', { style:{ fontSize:10, color:'var(--t3)', width:40, textAlign:'right' } }, `${rd.active}人`),
          React.createElement('span', { style:{ fontSize:8, color:'var(--t3)', transition:'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' } }, '▶'),
        ),
        isOpen && React.createElement('div', { style:{ padding:'0 14px 12px', borderTop:'1px solid var(--border)' } },
          [{label:'理解良好', arr:rd.high, bg:'var(--green-soft)', color:'var(--green)'}, {label:'部分理解', arr:rd.mid, bg:'var(--blue-soft)', color:'var(--blue)'}, {label:'理解困难', arr:rd.low, bg:'var(--amber-soft)', color:'var(--amber)'}]
            .filter(g => g.arr.length > 0).map(g => React.createElement(Fragment, { key:g.label },
              React.createElement('div', { style:{ fontSize:9, fontWeight:700, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', marginTop:10, marginBottom:6 } }, `${g.label} · ${g.arr.length}人`),
              React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', gap:4 } },
                g.arr.map(s => React.createElement('span', { key:s.id, onClick:()=>onSelectStudent(s), style:{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:4, background:g.bg, color:g.color, cursor:'pointer' } },
                  `${s.name} ${Math.round(s.understanding[rd.round-1]*100)}%`)),
              ),
            )),
        ),
      );
    }),
  );
}

/* ─── Student Detail View ─── */
function DiscussStudentView({ student, onBack }) {
  const s = student;
  const finalU = s.understanding[s.understanding.length-1];
  const hasConvo = s.conversation.length > 0;

  // Group conversation into rounds
  const rounds = [];
  let cur = [], ri = 0;
  s.conversation.forEach((msg, i) => {
    cur.push(msg);
    if (msg.role === 'student' || i === s.conversation.length-1) {
      rounds.push({ idx:ri, messages:[...cur], understanding:s.understanding[ri]||0 });
      cur = []; ri++;
    }
  });
  if (cur.length > 0) rounds.push({ idx:ri, messages:[...cur], understanding:s.understanding[ri]||s.understanding[s.understanding.length-1] });

  return React.createElement('div', { style:{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' } },
    /* Header */
    React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:14, padding:'14px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 } },
      React.createElement('button', { onClick:onBack, style:{ fontSize:11, fontWeight:500, color:'var(--t2)', cursor:'pointer', padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', fontFamily:'inherit' } }, '← 返回班级'),
      React.createElement('div', { style:{ width:36, height:36, borderRadius:8, background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 } }, s.name[0]),
      React.createElement('div', { style:{ flex:1 } },
        React.createElement('div', { style:{ fontSize:15, fontWeight:600 } }, s.name),
        React.createElement('div', { style:{ fontSize:11, color:'var(--t3)', marginTop:2 } }, `Task 3 · Discuss`),
      ),
      React.createElement('span', { style:{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:4, background: s.goalReached ? 'var(--green-soft)' : 'var(--amber-soft)', color: s.goalReached ? 'var(--green)' : 'var(--amber)' } },
        s.goalReached ? '✓ 对话达标' : s.mcCorrect ? '△ 选择题答对' : '✕ 选择题答错'),
    ),

    /* Body */
    React.createElement('div', { style:{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', overflow:'hidden', minHeight:0 } },
      /* Left: Stats + Conversation */
      React.createElement('div', { style:{ overflowY:'auto', padding:'20px 24px 40px' } },
        /* Stats */
        React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 } },
          [{n:s.rounds, l:'对话轮次'}, {n:formatTime(s.time), l:'讨论用时'}, {n:`${Math.round(finalU*100)}%`, l:'最终理解度', color: finalU>0.8 ? 'var(--green)' : finalU>0.5 ? 'var(--blue)' : 'var(--amber)'}]
            .map((st,i) => React.createElement('div', { key:i, style:{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', textAlign:'center' } },
              React.createElement('div', { style:{ fontSize:20, fontWeight:700, lineHeight:1, color:st.color||'var(--t1)' } }, st.n),
              React.createElement('div', { style:{ fontSize:8, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.3px', marginTop:3 } }, st.l),
            )),
        ),

        /* Understanding trajectory */
        React.createElement('div', { style:{ display:'flex', alignItems:'flex-end', gap:3, height:40, marginBottom:16, padding:'0 4px' } },
          s.understanding.map((u, i) => React.createElement('div', { key:i, style:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2 } },
            React.createElement('div', { style:{ fontSize:8, fontWeight:600, color:'var(--t3)' } }, `${Math.round(u*100)}%`),
            React.createElement('div', { style:{ width:'100%', height:`${u*30}px`, minHeight:2, borderRadius:2, background: u>0.8 ? 'var(--green)' : u>0.5 ? 'var(--blue)' : 'var(--amber)' } }),
            React.createElement('div', { style:{ fontSize:8, color:'var(--t3)' } }, `R${i+1}`),
          )),
        ),

        /* Conversation */
        hasConvo ? rounds.map((round, ri) => React.createElement(Fragment, { key:ri },
          React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:8, margin:'14px 0 10px' } },
            React.createElement('span', { style:{ fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:10, background:'var(--surface2)', color:'var(--t2)' } }, `Round ${ri+1}`),
            React.createElement('div', { style:{ flex:1, height:1, background:'var(--border)' } }),
            React.createElement('span', { style:{ fontSize:9, fontWeight:600, color: round.understanding>0.8 ? 'var(--green)' : round.understanding>0.5 ? 'var(--blue)' : 'var(--amber)' } }, `理解 ${Math.round(round.understanding*100)}%`),
          ),
          round.messages.map((msg, mi) => msg.role === 'ai'
            ? React.createElement('div', { key:`${ri}-${mi}`, style:{ display:'flex', gap:10, marginBottom:12, alignItems:'flex-start' } },
                React.createElement('div', { style:{ width:26, height:26, borderRadius:'50%', background:'var(--ai-soft)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--ai)', fontWeight:700, flexShrink:0 } }, 'S'),
                React.createElement('div', { style:{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'2px 10px 10px 10px', padding:'9px 13px', fontSize:12, lineHeight:1.7, color:'var(--t2)', maxWidth:'88%' } },
                  msg.text.replace('[GOAL_REACHED]','').trim(),
                  msg.text.includes('[GOAL_REACHED]') && React.createElement('div', { style:{ marginTop:8, padding:'6px 10px', borderRadius:6, background:'var(--green-soft)', border:'1px solid rgba(45,102,18,.15)', fontSize:11, fontWeight:600, color:'var(--green)' } }, '学生达标'),
                  msg.mc && React.createElement('div', { style:{ marginTop:8, padding:'6px 10px', borderRadius:6, background:'var(--amber-soft)', border:'1px solid rgba(122,77,14,.15)', fontSize:11, fontWeight:600, color:'var(--amber)' } }, '触发兜底选择题'),
                ),
              )
            : React.createElement('div', { key:`${ri}-${mi}`, style:{ display:'flex', justifyContent:'flex-end', marginBottom:12 } },
                React.createElement('div', { style:{ background:'var(--t1)', color:'var(--surface)', borderRadius:'10px 2px 10px 10px', padding:'9px 13px', fontSize:12, lineHeight:1.6, maxWidth:'85%' } }, msg.text),
              )
          ),
        ))
        : React.createElement('div', { style:{ padding:40, textAlign:'center', color:'var(--t3)', fontSize:12 } }, '该学生对话记录未加载'),
      ),

      /* Right: Key findings */
      React.createElement('div', { style:{ overflowY:'auto', padding:'20px 24px 40px', background:'var(--surface)', borderLeft:'1px solid var(--border)' } },
        React.createElement(SectionHeader, { label:'关键发现' }),
        React.createElement('div', { style:{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:12 } },
          s.keyInsights.map((ins, i) => React.createElement('div', { key:i, style:{ fontSize:11, color:'var(--t2)', lineHeight:1.6, padding:'3px 0', display:'flex', gap:6 } },
            React.createElement('span', { style:{ color:'var(--t3)', flexShrink:0 } }, '·'),
            React.createElement('span', null, ins),
          )),
        ),

        /* Method card */
        React.createElement('div', { style:{ background: s.goalReached ? 'var(--green-soft)' : 'var(--amber-soft)', border:`1px solid ${s.goalReached ? 'rgba(45,102,18,.15)' : 'rgba(122,77,14,.15)'}`, borderRadius:8, padding:'12px 14px', marginBottom:12 } },
          React.createElement('div', { style:{ fontSize:10, fontWeight:700, color: s.goalReached ? 'var(--green)' : 'var(--amber)', marginBottom:4 } },
            s.goalReached ? '通过苏格拉底对话达标' : '通过兜底选择题完成'),
          React.createElement('div', { style:{ fontSize:11, color:'var(--t2)', lineHeight:1.6 } },
            s.goalReached ? `在第 ${s.rounds} 轮对话中展示了完整理解。` : s.mcCorrect ? `${s.rounds} 轮对话后未自主达标，选择题答对。` : `${s.rounds} 轮对话后未自主达标，选择题也选错。需额外关注。`),
        ),

        /* Round understanding */
        React.createElement(SectionHeader, { label:'逐轮理解度' }),
        s.understanding.map((u, i) => React.createElement('div', { key:i, style:{ display:'flex', alignItems:'center', gap:8, marginBottom:4 } },
          React.createElement('span', { style:{ fontSize:10, fontWeight:600, color:'var(--t2)', width:28, flexShrink:0 } }, `R${i+1}`),
          React.createElement('div', { style:{ flex:1, height:6, background:'var(--surface2)', borderRadius:3, overflow:'hidden' } },
            React.createElement('div', { style:{ height:'100%', width:`${u*100}%`, borderRadius:3, background: u>0.8 ? 'var(--green)' : u>0.5 ? 'var(--blue)' : 'var(--amber)' } }),
          ),
          React.createElement('span', { style:{ fontSize:10, fontWeight:600, color:'var(--t2)', width:32, textAlign:'right' } }, `${Math.round(u*100)}%`),
          i > 0 && React.createElement('span', { style:{ fontSize:9, fontWeight:600, width:36, color: (u-s.understanding[i-1])>0 ? 'var(--green)' : 'var(--red)' } },
            `${(u-s.understanding[i-1])>0 ? '+' : ''}${Math.round((u-s.understanding[i-1])*100)}%`),
        )),
      ),
    ),
  );
}

/* ─── Helper: Section Header ─── */
function SectionHeader({ label }) {
  return React.createElement('div', { style:{ fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:10, marginTop:16, display:'flex', alignItems:'center', gap:8 } },
    React.createElement('span', null, label),
    React.createElement('div', { style:{ flex:1, height:1, background:'var(--border)' } }),
  );
}

Object.assign(window, { DiscussClassView, DiscussStudentView, SectionHeader });
