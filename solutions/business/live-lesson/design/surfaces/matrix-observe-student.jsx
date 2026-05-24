/* ═══════════════════════════════════════════
   MATRIX OBSERVE — Student Detail Panel (Layer 2)
   ═══════════════════════════════════════════ */

function MatrixStudentPanel({ student, onClose, allStudents, onSwitchStudent }) {
  if (!student) return null;
  const s = student;
  const sc = getStudentScore(s);
  const comp = getStudentCompletion(s);
  const idx = allStudents.findIndex(st=>st.id===s.id);
  const prev = idx>0 ? allStudents[idx-1] : null;
  const next = idx<allStudents.length-1 ? allStudents[idx+1] : null;

  return React.createElement(React.Fragment, null,
    /* Header */
    React.createElement('div', {style:{display:'flex',alignItems:'center',gap:12,padding:'0 20px',height:52,background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('button', {onClick:onClose,style:{fontSize:18,color:'var(--t3)',cursor:'pointer',background:'none',border:'none',padding:'4px 8px',borderRadius:6,lineHeight:1}}, '✕'),
      React.createElement('div', {style:{width:32,height:32,borderRadius:8,background:'var(--t1)',color:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700}}, s.name[0]),
      React.createElement('div', {style:{flex:1}},
        React.createElement('div', {style:{fontSize:14,fontWeight:600}}, s.name),
        React.createElement('div', {style:{fontSize:10,color:'var(--t3)',marginTop:1}}, 'Matrix · 矩阵填空 · Step 3'),
      ),
      React.createElement('span', {style:{fontSize:10,fontWeight:600,padding:'3px 10px',borderRadius:4,background:comp.pct===100?'var(--green-bg)':comp.pct>50?'var(--blue-bg)':'var(--red-bg)',color:comp.pct===100?'var(--green)':comp.pct>50?'var(--blue)':'var(--red)'}}, `${comp.pct}% 完成`),
      React.createElement('div', {style:{display:'flex',gap:4,marginLeft:8}},
        React.createElement('button', {disabled:!prev,onClick:()=>prev&&onSwitchStudent(prev),style:{width:28,height:28,borderRadius:6,border:'1px solid var(--border)',background:'var(--surface)',cursor:prev?'pointer':'default',opacity:prev?1:.3,fontSize:14,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--t2)'}}, '‹'),
        React.createElement('button', {disabled:!next,onClick:()=>next&&onSwitchStudent(next),style:{width:28,height:28,borderRadius:6,border:'1px solid var(--border)',background:'var(--surface)',cursor:next?'pointer':'default',opacity:next?1:.3,fontSize:14,fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--t2)'}}, '›'),
      ),
    ),

    /* Body: two columns */
    React.createElement('div', {style:{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'hidden'}},

      /* ── Left: Stats + Full Matrix ── */
      React.createElement('div', {style:{overflowY:'auto',padding:'16px 20px 40px'}},
        /* Mini stats */
        React.createElement('div', {style:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}},
          React.createElement(MiniStat, {label:'完成',value:`${comp.filled}/${comp.total}`,color:comp.pct===100?'var(--green)':comp.pct>50?'var(--blue)':'var(--red)'}),
          React.createElement(MiniStat, {label:'质量',value:sc.avg.toFixed(1),color:sc.avg>=2.5?'var(--green)':sc.avg>=1.5?'var(--blue)':'var(--amber)'}),
          React.createElement(MiniStat, {label:'用时',value:formatTime(s.time)}),
          React.createElement(MiniStat, {label:'状态',value:s.submitted?'已交':'未交',color:s.submitted?'var(--green)':'var(--red)'}),
        ),

        /* Full matrix responses */
        React.createElement(SectionHeader, {text:'矩阵回答详情'}),
        MATRIX_ROWS.map((row,ri)=>{
          const rp = s.responses[row.id];
          const whatQ = rp?.whatQ||0;
          const whyQ = rp?.whyQ||0;
          const rowAvg = ((whatQ+whyQ)/2);
          const borderClr = rowAvg>=2.5?'rgba(45,102,18,.15)':rowAvg>=1.5?'rgba(26,95,160,.15)':rowAvg>0?'rgba(196,138,30,.15)':'rgba(148,41,41,.15)';
          const bgClr = rowAvg>=2.5?'rgba(45,102,18,.02)':rowAvg>=1.5?'rgba(26,95,160,.02)':rowAvg>0?'rgba(196,138,30,.02)':'rgba(148,41,41,.02)';

          return React.createElement('div', {key:row.id,style:{background:bgClr,border:`1px solid ${borderClr}`,borderRadius:8,padding:'14px 16px',marginBottom:10}},
            /* Row header */
            React.createElement('div', {style:{display:'flex',alignItems:'center',gap:8,marginBottom:10}},
              React.createElement('span', {style:{fontSize:11,fontWeight:700,color:'var(--teal)'}}, `R${ri+1}`),
              React.createElement('span', {style:{fontSize:11,fontWeight:600}}, row.concept),
              React.createElement('span', {style:{fontSize:9,color:'var(--t3)',background:'var(--surface2)',padding:'2px 6px',borderRadius:3}}, row.para),
              React.createElement('span', {style:{marginLeft:'auto',fontSize:10,fontWeight:700,color:rowAvg>=2.5?'var(--green)':rowAvg>=1.5?'var(--blue)':rowAvg>0?'var(--amber)':'var(--red)'}},
                rowAvg>0?rowAvg.toFixed(1):'—'),
            ),
            /* What */
            React.createElement('div', {style:{marginBottom:8}},
              React.createElement('div', {style:{display:'flex',alignItems:'center',gap:6,marginBottom:4}},
                React.createElement('span', {style:{fontSize:9,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px'}}, 'What 是什么'),
                React.createElement('span', {style:{fontSize:8,fontWeight:600,padding:'1px 5px',borderRadius:3,background:qBg(whatQ),color:qColor(whatQ)}}, qLabel(whatQ)),
              ),
              rp?.what
                ? React.createElement('div', {style:{fontSize:12,color:'var(--t1)',lineHeight:1.7,padding:'8px 10px',background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}}, rp.what)
                : React.createElement('div', {style:{fontSize:11,color:'var(--t3)',fontStyle:'italic',padding:'8px 10px',background:'var(--surface2)',borderRadius:6}}, '未填写'),
            ),
            /* Why */
            React.createElement('div', null,
              React.createElement('div', {style:{display:'flex',alignItems:'center',gap:6,marginBottom:4}},
                React.createElement('span', {style:{fontSize:9,fontWeight:700,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px'}}, 'Why 为什么'),
                React.createElement('span', {style:{fontSize:8,fontWeight:600,padding:'1px 5px',borderRadius:3,background:qBg(whyQ),color:qColor(whyQ)}}, qLabel(whyQ)),
              ),
              rp?.why
                ? React.createElement('div', {style:{fontSize:12,color:'var(--t1)',lineHeight:1.7,padding:'8px 10px',background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}}, rp.why)
                : React.createElement('div', {style:{fontSize:11,color:'var(--t3)',fontStyle:'italic',padding:'8px 10px',background:'var(--surface2)',borderRadius:6}}, '未填写'),
            ),
          );
        }),
      ),

      /* ── Right: Insights + Comparison ── */
      React.createElement('div', {style:{overflowY:'auto',padding:'16px 20px 40px',background:'var(--surface)',borderLeft:'1px solid var(--border)'}},
        /* Key insights */
        React.createElement(SectionHeader, {text:'关键发现'}),
        React.createElement('div', {style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:12}},
          React.createElement('div', {style:{fontSize:10,fontWeight:700,marginBottom:6}}, '学习状态摘要'),
          s.keyInsights.map((ins,i)=>
            React.createElement('div', {key:i,style:{fontSize:11,color:'var(--t2)',lineHeight:1.6,padding:'2px 0',display:'flex',gap:6}},
              React.createElement('span', {style:{color:'var(--t3)',flexShrink:0}}, '·'),
              React.createElement('span', null, ins)))),

        /* Status card */
        React.createElement('div', {style:{background:sc.avg>=2.5?'var(--green-bg)':sc.avg>=1.5?'var(--blue-bg)':'var(--red-bg)',border:`1px solid ${sc.avg>=2.5?'rgba(45,102,18,.15)':sc.avg>=1.5?'rgba(26,95,160,.15)':'rgba(148,41,41,.15)'}`,borderRadius:8,padding:'12px 14px',marginBottom:16}},
          React.createElement('div', {style:{fontSize:10,fontWeight:700,color:sc.avg>=2.5?'var(--green)':sc.avg>=1.5?'var(--blue)':'var(--red)'}},
            sc.avg>=2.5?'质量优秀':sc.avg>=1.5?'质量良好':'需重点关注'),
          React.createElement('div', {style:{fontSize:11,color:'var(--t2)',lineHeight:1.6,marginTop:4}},
            `完成 ${comp.filled}/${comp.total} 格，平均质量 ${sc.avg.toFixed(1)}/3.0。用时 ${formatTime(s.time)}。`),
        ),

        /* Per-row quality bars */
        React.createElement(SectionHeader, {text:'逐行质量'}),
        React.createElement('div', {style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:16}},
          MATRIX_ROWS.map((row,ri)=>{
            const rp = s.responses[row.id];
            const wq = rp?.whatQ||0, yq = rp?.whyQ||0;
            return React.createElement('div', {key:row.id,style:{marginBottom:ri<MATRIX_ROWS.length-1?10:0}},
              React.createElement('div', {style:{display:'flex',alignItems:'center',gap:8,marginBottom:4}},
                React.createElement('span', {style:{fontSize:10,fontWeight:600,color:'var(--teal)',width:22}}, `R${ri+1}`),
                React.createElement('span', {style:{fontSize:10,color:'var(--t2)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, row.concept),
              ),
              React.createElement('div', {style:{display:'flex',alignItems:'center',gap:6}},
                React.createElement('span', {style:{fontSize:8,color:'var(--t3)',width:26}}, 'What'),
                React.createElement('div', {style:{flex:1,height:12,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}},
                  React.createElement('div', {style:{width:`${wq/3*100}%`,height:'100%',borderRadius:3,background:qColor(wq),opacity:.7}})),
                React.createElement('span', {style:{fontSize:9,fontWeight:700,color:qColor(wq),width:18,textAlign:'right'}}, wq||'—'),
              ),
              React.createElement('div', {style:{display:'flex',alignItems:'center',gap:6,marginTop:2}},
                React.createElement('span', {style:{fontSize:8,color:'var(--t3)',width:26}}, 'Why'),
                React.createElement('div', {style:{flex:1,height:12,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}},
                  React.createElement('div', {style:{width:`${yq/3*100}%`,height:'100%',borderRadius:3,background:qColor(yq),opacity:.7}})),
                React.createElement('span', {style:{fontSize:9,fontWeight:700,color:qColor(yq),width:18,textAlign:'right'}}, yq||'—'),
              ),
            );
          }),
        ),

        /* What vs Why comparison */
        React.createElement(SectionHeader, {text:'What vs Why 对比'}),
        React.createElement('div', {style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:16}},
          (()=>{
            const wa = MATRIX_ROWS.reduce((a,r)=>a+(s.responses[r.id]?.whatQ||0),0)/MATRIX_ROWS.length;
            const ya = MATRIX_ROWS.reduce((a,r)=>a+(s.responses[r.id]?.whyQ||0),0)/MATRIX_ROWS.length;
            const gap = Math.abs(wa-ya);
            return React.createElement(React.Fragment, null,
              React.createElement('div', {style:{display:'flex',gap:12,marginBottom:8}},
                React.createElement('div', {style:{flex:1,textAlign:'center',padding:'8px',background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}},
                  React.createElement('div', {style:{fontSize:18,fontWeight:700,color:wa>=2?'var(--green)':wa>=1?'var(--blue)':'var(--amber)'}}, wa.toFixed(1)),
                  React.createElement('div', {style:{fontSize:9,color:'var(--t3)',textTransform:'uppercase',marginTop:2}}, 'What 均分'),
                ),
                React.createElement('div', {style:{flex:1,textAlign:'center',padding:'8px',background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}},
                  React.createElement('div', {style:{fontSize:18,fontWeight:700,color:ya>=2?'var(--green)':ya>=1?'var(--blue)':'var(--amber)'}}, ya.toFixed(1)),
                  React.createElement('div', {style:{fontSize:9,color:'var(--t3)',textTransform:'uppercase',marginTop:2}}, 'Why 均分'),
                ),
              ),
              React.createElement('div', {style:{fontSize:10,color:'var(--t2)',lineHeight:1.5}},
                gap<0.3 ? 'What和Why水平均衡。' : wa>ya ? `What (${wa.toFixed(1)}) 明显优于 Why (${ya.toFixed(1)})——能描述现象但难以解释原因。` : `Why (${ya.toFixed(1)}) 优于 What (${wa.toFixed(1)})——分析能力较好但描述不够具体。`),
            );
          })(),
        ),

        /* Class comparison */
        React.createElement(SectionHeader, {text:'班级对比'}),
        React.createElement('div', {style:{background:'var(--bg)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px'}},
          [{label:'质量',val:sc.avg,avg:STUDENTS.reduce((a,st)=>a+getStudentScore(st).avg,0)/STUDENTS.length,max:3,unit:''},
           {label:'完成率',val:comp.pct,avg:STUDENTS.reduce((a,st)=>a+getStudentCompletion(st).pct,0)/STUDENTS.length,max:100,unit:'%'},
           {label:'用时',val:s.time,avg:Math.round(STUDENTS.reduce((a,st)=>a+st.time,0)/STUDENTS.length),max:650,unit:'s',format:formatTime,invert:true},
          ].map((row,i)=>
            React.createElement('div', {key:i,style:{display:'flex',alignItems:'center',gap:8,marginBottom:8}},
              React.createElement('span', {style:{fontSize:10,color:'var(--t3)',width:44,flexShrink:0}}, row.label),
              React.createElement('div', {style:{flex:1,height:14,background:'var(--surface2)',borderRadius:3,position:'relative',overflow:'visible'}},
                React.createElement('div', {style:{position:'absolute',left:`${row.avg/row.max*100}%`,top:-2,width:2,height:18,background:'rgba(28,28,26,.14)',borderRadius:1,zIndex:1}}),
                React.createElement('div', {style:{height:'100%',width:`${row.val/row.max*100}%`,borderRadius:3,background:(row.invert?(row.val<row.avg):(row.val>row.avg))?'var(--green)':'var(--amber)',opacity:.7}})),
              React.createElement('span', {style:{fontSize:10,fontWeight:600,width:36,textAlign:'right'}}, row.format?row.format(row.val):`${row.val}${row.unit}`),
            )),
          React.createElement('div', {style:{display:'flex',gap:12,marginTop:4,fontSize:9,color:'var(--t3)'}},
            React.createElement('span', {style:{display:'flex',alignItems:'center',gap:3}},
              React.createElement('span', {style:{width:8,height:4,borderRadius:2,background:'var(--green)',display:'inline-block',opacity:.7}}), '该学生'),
            React.createElement('span', {style:{display:'flex',alignItems:'center',gap:3}},
              React.createElement('span', {style:{width:2,height:10,borderRadius:1,background:'rgba(28,28,26,.14)',display:'inline-block'}}), '班级均值'),
          ),
        ),
      ),
    ),
  );
}

Object.assign(window, { MatrixStudentPanel });
