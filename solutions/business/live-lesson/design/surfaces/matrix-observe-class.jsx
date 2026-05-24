/* ═══════════════════════════════════════════
   MATRIX OBSERVE — Class Observe Panel (Layer 1)
   ═══════════════════════════════════════════ */

function MatrixClassPanel({ onSelectStudent, onClose }) {
  const [expandedRow, setExpandedRow] = React.useState(null);
  const total = STUDENTS.length;
  const submitted = STUDENTS.filter(s=>s.submitted).length;

  /* Aggregate stats */
  const allScores = STUDENTS.map(s=>getStudentScore(s));
  const avgQuality = (allScores.reduce((a,s)=>a+s.avg,0)/total).toFixed(1);
  const allCompletions = STUDENTS.map(s=>getStudentCompletion(s));
  const avgCompletion = Math.round(allCompletions.reduce((a,c)=>a+c.pct,0)/total);
  const whatAvgAll = STUDENTS.reduce((a,s)=>a+MATRIX_ROWS.reduce((b,r)=>b+(s.responses[r.id]?.whatQ||0),0),0)/(total*MATRIX_ROWS.length);
  const whyAvgAll  = STUDENTS.reduce((a,s)=>a+MATRIX_ROWS.reduce((b,r)=>b+(s.responses[r.id]?.whyQ||0),0),0)/(total*MATRIX_ROWS.length);
  const needAttention = STUDENTS.filter(s=>getStudentScore(s).avg<1.5).length;

  return React.createElement(React.Fragment, null,
    /* Header */
    React.createElement('div', {style:{display:'flex',alignItems:'center',gap:12,padding:'0 20px',height:52,background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button', {onClick:onClose,style:{fontSize:18,color:'var(--t3)',cursor:'pointer',background:'none',border:'none',padding:'4px 8px',borderRadius:6,lineHeight:1}}, '✕'),
      React.createElement('div', {style:{width:28,height:28,borderRadius:7,background:'var(--teal)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700}}, 'M'),
      React.createElement('div', {style:{flex:1}},
        React.createElement('div', {style:{fontSize:14,fontWeight:600,letterSpacing:'-.2px'}}, '矩阵填空 · Matrix 观察'),
        React.createElement('div', {style:{fontSize:10,color:'var(--t3)',marginTop:1}}, 'Step 3: Close Read → Practice'),
      ),
      React.createElement('div', {style:{display:'flex',alignItems:'center',gap:4,fontSize:10,fontWeight:600,color:'var(--green)'}},
        React.createElement('span', {style:{width:6,height:6,borderRadius:'50%',background:'var(--green)'}}), '实时'),
      React.createElement('span', {style:{fontSize:11,color:'var(--t2)',marginLeft:8}}, `${submitted}/${total} 已提交`),
    ),

    /* Body */
    React.createElement('div', {style:{flex:1,overflowY:'auto',padding:'16px 20px 40px'}},
      React.createElement('div', {style:{maxWidth:900,margin:'0 auto'}},

        /* Stats row */
        React.createElement('div', {style:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}},
          React.createElement(StatCard, {label:'完成率',value:`${avgCompletion}%`,sub:`${allCompletions.filter(c=>c.pct===100).length}/${total} 人全部完成`,accent:'green'}),
          React.createElement(StatCard, {label:'平均质量',value:`${avgQuality}`,sub:`满分 3.0 · ${Q_LABELS[3-Math.round(Number(avgQuality))]}水平`,accent:'purple'}),
          React.createElement(StatCard, {label:'What vs Why',value: whatAvgAll>whyAvgAll?'What ↑':'What ≈ Why',sub:`What ${whatAvgAll.toFixed(1)} · Why ${whyAvgAll.toFixed(1)}`}),
          React.createElement(StatCard, {label:'需关注',value:needAttention,sub:`质量 < 1.5 的学生`}),
        ),

        /* Quality Heatmap */
        React.createElement(SectionHeader, {text:'质量热力图'}),
        React.createElement('div', {style:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'14px 16px',marginBottom:20,overflowX:'auto'}},
          /* Column headers */
          React.createElement('div', {style:{display:'grid',gridTemplateColumns:'80px repeat(8,1fr)',gap:3,marginBottom:6,paddingBottom:6,borderBottom:'1px solid var(--border)'}},
            React.createElement('span', {style:{fontSize:9,fontWeight:600,color:'var(--t3)'}}),
            MATRIX_ROWS.flatMap(r=>[
              React.createElement('span', {key:r.id+'w',style:{fontSize:8,fontWeight:600,color:'var(--t3)',textAlign:'center',letterSpacing:'.3px'}}, `${r.para} W`),
              React.createElement('span', {key:r.id+'y',style:{fontSize:8,fontWeight:600,color:'var(--t3)',textAlign:'center',letterSpacing:'.3px'}}, `${r.para} Y`),
            ]),
          ),
          /* Student rows */
          STUDENTS.map(s=>{
            const comp = getStudentCompletion(s);
            return React.createElement('div', {key:s.id,
              onClick:()=>onSelectStudent(s),
              style:{display:'grid',gridTemplateColumns:'80px repeat(8,1fr)',gap:3,padding:'3px 0',cursor:'pointer',borderRadius:4,transition:'background .1s'},
              onMouseEnter:e=>e.currentTarget.style.background='var(--surface2)',
              onMouseLeave:e=>e.currentTarget.style.background='transparent',
            },
              React.createElement('span', {style:{fontSize:10,fontWeight:600,color:'var(--t1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:4}},
                s.name,
                !s.submitted && React.createElement('span',{style:{fontSize:7,color:'var(--red)',fontWeight:700}},'未交'),
              ),
              MATRIX_ROWS.flatMap(r=>{
                const rp = s.responses[r.id];
                return [
                  React.createElement('div', {key:r.id+'w',style:{display:'flex',justifyContent:'center',alignItems:'center'}},
                    React.createElement('div', {style:{width:20,height:16,borderRadius:3,background:qBg(rp?.whatQ||0),border:`1px solid ${(rp?.whatQ||0)>0?'transparent':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:qColor(rp?.whatQ||0)}},
                      (rp?.whatQ||0)>0?(rp?.whatQ||0):'·')),
                  React.createElement('div', {key:r.id+'y',style:{display:'flex',justifyContent:'center',alignItems:'center'}},
                    React.createElement('div', {style:{width:20,height:16,borderRadius:3,background:qBg(rp?.whyQ||0),border:`1px solid ${(rp?.whyQ||0)>0?'transparent':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,fontWeight:700,color:qColor(rp?.whyQ||0)}},
                      (rp?.whyQ||0)>0?(rp?.whyQ||0):'·')),
                ];
              }),
            );
          }),
          /* Legend */
          React.createElement('div', {style:{display:'flex',gap:12,marginTop:10,paddingTop:8,borderTop:'1px solid var(--border)',fontSize:9,color:'var(--t3)'}},
            [3,2,1,0].map(q=>
              React.createElement('span', {key:q,style:{display:'flex',alignItems:'center',gap:4}},
                React.createElement('span', {style:{width:12,height:10,borderRadius:2,background:qBg(q),border:`1px solid ${q>0?'transparent':'var(--border)'}`}}),
                `${q} ${qLabel(q)}`)),
            React.createElement('span', {style:{marginLeft:'auto',fontWeight:600}}, 'W = What · Y = Why'),
          ),
        ),

        /* Per-row analysis */
        React.createElement(SectionHeader, {text:'逐行分析'}),
        MATRIX_ROWS.map((row,ri)=>{
          const stats = getRowStats(row.id);
          const isOpen = expandedRow === row.id;
          const rowAvg = ((stats.whatAvg+stats.whyAvg)/2).toFixed(1);
          return React.createElement('div', {key:row.id,style:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8,cursor:'pointer',transition:'box-shadow .12s',boxShadow:isOpen?'0 2px 8px rgba(28,28,26,.06)':'none'}},
            React.createElement('div', {onClick:()=>setExpandedRow(isOpen?null:row.id),style:{display:'flex',alignItems:'center',gap:10}},
              React.createElement('span', {style:{fontSize:12,fontWeight:700,width:28,color:'var(--teal)'}}, `R${ri+1}`),
              React.createElement('div', {style:{flex:1,minWidth:0}},
                React.createElement('div', {style:{fontSize:11,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, row.concept),
                React.createElement('div', {style:{fontSize:9,color:'var(--t3)',marginTop:2}}, row.para),
              ),
              /* Mini quality bars */
              React.createElement('div', {style:{display:'flex',gap:8,alignItems:'center',flexShrink:0}},
                React.createElement('div', {style:{textAlign:'center'}},
                  React.createElement('div', {style:{fontSize:8,color:'var(--t3)',marginBottom:2}}, 'What'),
                  React.createElement('div', {style:{width:50,height:5,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}},
                    React.createElement('div', {style:{width:`${stats.whatAvg/3*100}%`,height:'100%',borderRadius:3,background:stats.whatAvg>2?'var(--green)':stats.whatAvg>1?'var(--blue)':'var(--amber)'}})),
                ),
                React.createElement('div', {style:{textAlign:'center'}},
                  React.createElement('div', {style:{fontSize:8,color:'var(--t3)',marginBottom:2}}, 'Why'),
                  React.createElement('div', {style:{width:50,height:5,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}},
                    React.createElement('div', {style:{width:`${stats.whyAvg/3*100}%`,height:'100%',borderRadius:3,background:stats.whyAvg>2?'var(--green)':stats.whyAvg>1?'var(--blue)':'var(--amber)'}})),
                ),
              ),
              React.createElement('span', {style:{fontSize:12,fontWeight:700,color:rowAvg>=2?'var(--green)':rowAvg>=1.2?'var(--blue)':'var(--amber)',width:28,textAlign:'right'}}, rowAvg),
              React.createElement('span', {style:{fontSize:8,color:'var(--t3)',transition:'transform .2s',transform:isOpen?'rotate(90deg)':'none'}}, '▶'),
            ),
            isOpen && React.createElement('div', {style:{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}},
              /* Distribution bars */
              React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:12}},
                ['What','Why'].map((col,ci)=>{
                  const dist = ci===0?stats.whatDist:stats.whyDist;
                  return React.createElement('div', {key:col},
                    React.createElement('div', {style:{fontSize:10,fontWeight:600,color:'var(--t2)',marginBottom:6}}, `${col} 分布`),
                    [3,2,1,0].map((q,qi)=>{
                      const cnt = dist[3-q]; const pct = cnt/total*100;
                      return React.createElement('div', {key:q,style:{display:'flex',alignItems:'center',gap:6,marginBottom:3}},
                        React.createElement('span', {style:{fontSize:9,fontWeight:600,color:qColor(q),width:20}}, qLabel(q)),
                        React.createElement('div', {style:{flex:1,height:14,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}},
                          React.createElement('div', {style:{width:`${pct}%`,height:'100%',borderRadius:3,background:qColor(q),opacity:.7}})),
                        React.createElement('span', {style:{fontSize:9,fontWeight:700,color:'var(--t2)',width:18,textAlign:'right'}}, cnt),
                      );
                    }),
                  );
                }),
              ),
              /* Students who scored 0-1 on this row */
              React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:4,marginTop:8}},
                STUDENTS.filter(s=>{const rp=s.responses[row.id]; return (rp?.whatQ||0)<=1||(rp?.whyQ||0)<=1;}).map(s=>{
                  const rp=s.responses[row.id];
                  const worstQ = Math.min(rp?.whatQ||0, rp?.whyQ||0);
                  return React.createElement('span', {key:s.id,onClick:e=>{e.stopPropagation();onSelectStudent(s);},style:{fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:3,background:worstQ===0?'var(--red-bg)':'var(--amber-bg)',color:worstQ===0?'var(--red)':'var(--amber)',cursor:'pointer'}}, s.name);
                }),
              ),
            ),
          );
        }),

        /* Patterns */
        React.createElement(SectionHeader, {text:'回答模式'}),
        PATTERNS.map(p=>
          React.createElement('div', {key:p.id,style:{background:p.severity==='high'?'rgba(148,41,41,.03)':p.severity==='medium'?'rgba(196,138,30,.03)':'var(--surface)',border:`1px solid ${p.severity==='high'?'rgba(148,41,41,.18)':p.severity==='medium'?'rgba(196,138,30,.18)':'var(--border)'}`,borderRadius:8,padding:'12px 14px',marginBottom:8}},
            React.createElement('div', {style:{display:'flex',alignItems:'center',gap:8,marginBottom:6}},
              React.createElement('span', {style:{fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:3,background:p.severity==='high'?'var(--red)':p.severity==='medium'?'var(--amber)':'var(--t3)',color:'#fff'}}, p.severity==='high'?'高频':p.severity==='medium'?'中频':'低频'),
              React.createElement('span', {style:{fontSize:12,fontWeight:700}}, p.label),
              React.createElement('span', {style:{marginLeft:'auto',fontSize:11,fontWeight:600,color:'var(--t2)'}}, `${p.count} 人`)),
            React.createElement('div', {style:{display:'flex',flexWrap:'wrap',gap:4}},
              p.students.map(name=>
                React.createElement('span', {key:name,onClick:()=>onSelectStudent(STUDENTS.find(s=>s.name===name)),style:{fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:4,background:'var(--surface2)',color:'var(--t2)',cursor:'pointer'}}, name))),
          )
        ),

        /* Student table */
        React.createElement(SectionHeader, {text:'全部学生'}),
        React.createElement('div', {style:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}},
          React.createElement('div', {style:{display:'grid',gridTemplateColumns:'1fr 56px 56px 56px 60px',gap:6,padding:'8px 14px',fontSize:9,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'1px solid var(--border)'}},
            React.createElement('span',null,'学生'),React.createElement('span',null,'完成'),React.createElement('span',null,'用时'),React.createElement('span',null,'质量'),React.createElement('span',null,'What/Why')),
          STUDENTS.map(s=>{
            const sc = getStudentScore(s);
            const comp = getStudentCompletion(s);
            return React.createElement('div', {key:s.id,onClick:()=>onSelectStudent(s),
              style:{display:'grid',gridTemplateColumns:'1fr 56px 56px 56px 60px',gap:6,padding:'8px 14px',fontSize:11,alignItems:'center',cursor:'pointer',borderBottom:'1px solid var(--border)',transition:'background .1s'},
              onMouseEnter:e=>e.currentTarget.style.background='var(--surface2)',
              onMouseLeave:e=>e.currentTarget.style.background='transparent'},
              React.createElement('span', {style:{fontWeight:600,display:'flex',alignItems:'center',gap:4}}, s.name,
                !s.submitted && React.createElement('span',{style:{fontSize:8,color:'var(--red)',fontWeight:700}},'未交')),
              React.createElement('span', {style:{fontSize:10,color:comp.pct===100?'var(--green)':comp.pct>50?'var(--t2)':'var(--red)',fontWeight:600}}, `${comp.pct}%`),
              React.createElement('span', {style:{color:'var(--t2)',fontSize:10}}, formatTime(s.time)),
              React.createElement('span', {style:{fontSize:10,fontWeight:700,color:sc.avg>=2.5?'var(--green)':sc.avg>=1.5?'var(--blue)':'var(--amber)'}}, sc.avg.toFixed(1)),
              React.createElement('span', {style:{fontSize:9,color:'var(--t3)'}}, (()=>{
                const wa=MATRIX_ROWS.reduce((a,r)=>a+(s.responses[r.id]?.whatQ||0),0)/MATRIX_ROWS.length;
                const ya=MATRIX_ROWS.reduce((a,r)=>a+(s.responses[r.id]?.whyQ||0),0)/MATRIX_ROWS.length;
                return `${wa.toFixed(1)} / ${ya.toFixed(1)}`;
              })()),
            );
          }),
        ),
      ),
    ),
  );
}

Object.assign(window, { MatrixClassPanel });
