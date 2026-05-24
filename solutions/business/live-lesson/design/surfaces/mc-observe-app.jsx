const {useState, useCallback, useRef, useEffect, Fragment, useMemo} = React;

/* ═══════════════════════════════════════════════════════════
   MC (选择题) OBSERVATION — Teacher Console
   Observe students answering multiple-choice questions
   Class Overview + Individual Student Deep-dive
   ═══════════════════════════════════════════════════════════ */

function formatTime(s){const m=Math.floor(s/60),ss=s%60;return `${m}:${ss<10?'0':''}${ss}`;}

/* ─── QUESTIONS ─── */
const QUESTIONS = [
  {id:'q1', stem:'What is the main purpose of ¶1-2 in the article structure?',
   options:['To introduce the history of beauty standards','To present a conflict between two different beauty ideals','To describe Nigerian culture in detail','To argue that slim models are more beautiful'],
   correct:1, tag:'Text Structure'},
  {id:'q2', stem:'Which word best describes the organizational pattern of ¶3-4?',
   options:['Comparison','Problem-Solution','Chronological / Time-based','Cause and Effect'],
   correct:2, tag:'Text Structure'},
  {id:'q3', stem:'The phrase "different cultures around the world" (¶5) signals that ¶5-7 will organize examples by:',
   options:['Time period','Geographic location / Culture','Level of pain involved','Popularity among young people'],
   correct:1, tag:'Signal Words'},
  {id:'q4', stem:'"It appears that" (¶8) is a signal phrase for:',
   options:['Introducing a new example','Making a comparison','Drawing a conclusion','Asking a question'],
   correct:2, tag:'Signal Words'},
  {id:'q5', stem:'According to the text, beauty practices across cultures primarily communicate:',
   options:['How to look attractive to foreigners','Identity, status, and belonging','Medical or health benefits','Religious rules and obligations'],
   correct:1, tag:'Comprehension'},
];

/* ─── MOCK STUDENT DATA ─── */
const STUDENTS = [
  {id:1,name:'王译文',time:95,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:1},
   times:{q1:18,q2:22,q3:15,q4:12,q5:28},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:true},
   keyInsights:['全部正确','q5改过一次答案(从A改到B)','整体用时稳定']},
  {id:2,name:'黄婉晴',time:130,submitted:true,
   answers:{q1:1,q2:0,q3:1,q4:2,q5:1},
   times:{q1:25,q2:35,q3:22,q4:18,q5:30},
   changed:{q1:false,q2:true,q3:false,q4:false,q5:false},
   keyInsights:['q2选错(选了Comparison而非Chronological)','q2改答案但改错了','其余全对']},
  {id:3,name:'徐晨曦',time:155,submitted:true,
   answers:{q1:0,q2:0,q3:0,q4:0,q5:0},
   times:{q1:35,q2:40,q3:25,q4:28,q5:27},
   changed:{q1:true,q2:true,q3:false,q4:false,q5:false},
   keyInsights:['只对了0题——全部选A(可能放弃或随机选)','q1和q2改过答案','用时较长说明有尝试思考']},
  {id:4,name:'陈昕妍',time:72,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:1},
   times:{q1:12,q2:15,q3:14,q4:10,q5:21},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:false},
   keyInsights:['全部正确','速度最快——没有改答案','每题用时均匀']},
  {id:5,name:'李奕辰',time:110,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:0},
   times:{q1:20,q2:25,q3:18,q4:15,q5:32},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:true},
   keyInsights:['4/5正确','q5选错——选了"How to look attractive"','q5改过答案但改错了方向']},
  {id:6,name:'郭斐然',time:145,submitted:true,
   answers:{q1:1,q2:3,q3:3,q4:0,q5:1},
   times:{q1:25,q2:30,q3:32,q4:30,q5:28},
   changed:{q1:false,q2:false,q3:true,q4:true,q5:false},
   keyInsights:['2/5正确','q2选Cause and Effect','q3选Popularity','q4选Introducing a new example——信号词理解弱']},
  {id:7,name:'张皓月',time:88,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:1},
   times:{q1:16,q2:18,q3:15,q4:14,q5:25},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:false},
   keyInsights:['全部正确','用时短且稳定']},
  {id:8,name:'周航宇',time:100,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:0,q5:1},
   times:{q1:18,q2:22,q3:16,q4:20,q5:24},
   changed:{q1:false,q2:false,q3:false,q4:true,q5:false},
   keyInsights:['4/5正确','q4选错——"Introducing a new example"','改过q4但改错']},
  {id:9,name:'郑若曦',time:78,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:1},
   times:{q1:14,q2:16,q3:13,q4:12,q5:23},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:false},
   keyInsights:['全部正确','仅次于陈昕妍的速度']},
  {id:10,name:'邓梓涵',time:158,submitted:true,
   answers:{q1:2,q2:0,q3:0,q4:0,q5:3},
   times:{q1:35,q2:38,q3:30,q4:28,q5:27},
   changed:{q1:true,q2:false,q3:false,q4:false,q5:true},
   keyInsights:['0/5正确','可能存在阅读理解障碍','q1和q5都改过答案']},
  {id:11,name:'董思齐',time:165,submitted:true,
   answers:{q1:0,q2:2,q3:0,q4:3,q5:0},
   times:{q1:38,q2:30,q3:35,q4:32,q5:30},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:false},
   keyInsights:['1/5正确(只有q2对)','选项偏向A——可能未完全理解题意','用时长但准确率低']},
  {id:12,name:'冯璐',time:120,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:3},
   times:{q1:22,q2:25,q3:20,q4:18,q5:35},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:true},
   keyInsights:['4/5正确','q5选"Religious rules"——最后一题失误','前4题表现很好']},
  {id:13,name:'谢安然',time:170,submitted:true,
   answers:{q1:2,q2:0,q3:2,q4:3,q5:0},
   times:{q1:38,q2:35,q3:35,q4:30,q5:32},
   changed:{q1:true,q2:true,q3:false,q4:false,q5:false},
   keyInsights:['0/5正确','语言障碍严重影响理解','多次改答案']},
  {id:14,name:'马乐瑶',time:92,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:1},
   times:{q1:16,q2:20,q3:16,q4:14,q5:26},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:false},
   keyInsights:['全部正确','表现稳定']},
  {id:15,name:'林澜',time:105,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:0},
   times:{q1:20,q2:22,q3:18,q4:15,q5:30},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:true},
   keyInsights:['4/5正确','q5选错——和李奕辰相同错误','q5改过答案']},
  {id:16,name:'朱思语',time:68,submitted:true,
   answers:{q1:1,q2:2,q3:1,q4:2,q5:1},
   times:{q1:12,q2:14,q3:12,q4:10,q5:20},
   changed:{q1:false,q2:false,q3:false,q4:false,q5:false},
   keyInsights:['全部正确','最快完成(1:08)','零犹豫']},
];

/* Compute per-question stats */
function getQuestionStats(qid) {
  const q = QUESTIONS.find(qq=>qq.id===qid);
  const responses = STUDENTS.map(s=>s.answers[qid]);
  const correct = responses.filter(r=>r===q.correct).length;
  const distrib = [0,0,0,0];
  responses.forEach(r=>{ if(r>=0&&r<4) distrib[r]++; });
  return {correct, total:STUDENTS.length, distrib, correctIdx:q.correct};
}

const MISCONCEPTIONS = [
  {id:1, label:'q5: 选"How to look attractive" — 停留在表面理解', count:3, students:['李奕辰','林澜','徐晨曦'], severity:'medium'},
  {id:2, label:'q2: 选Comparison而非Chronological — 未识别时间信号', count:3, students:['黄婉晴','邓梓涵','徐晨曦'], severity:'medium'},
  {id:3, label:'q4: 未识别"It appears that"为conclusion信号', count:3, students:['郭斐然','周航宇','董思齐'], severity:'medium'},
  {id:4, label:'全部/大部分选A — 可能放弃或随机作答', count:2, students:['徐晨曦','邓梓涵'], severity:'high'},
];

/* ─── STYLES ─── */
const S = {
  shell:{display:'flex',flexDirection:'column',height:'100vh'},
  band:{display:'flex',alignItems:'center',gap:12,padding:'0 20px',height:44,background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  bandMark:{width:22,height:22,borderRadius:6,background:'var(--t1)',color:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700},
  bandTitle:{fontSize:13,fontWeight:600,letterSpacing:'-.1px'},
  bandTag:{fontSize:10,fontWeight:600,color:'var(--blue)',background:'var(--blue-bg)',padding:'2px 8px',borderRadius:3,letterSpacing:'.3px'},
  bandMeta:{fontSize:12,color:'var(--t2)',paddingLeft:12,borderLeft:'1px solid rgba(28,28,26,.14)',marginLeft:2},
  bandRight:{marginLeft:'auto',display:'flex',alignItems:'center',gap:12},
  tabs:{display:'flex',gap:0,padding:'0 20px',background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  tab:{padding:'10px 18px',fontSize:12,fontWeight:500,color:'var(--t3)',cursor:'pointer',borderBottom:'2px solid transparent',background:'none',border:'none',borderBottomWidth:2,borderBottomStyle:'solid',borderBottomColor:'transparent',fontFamily:'inherit',transition:'all .12s'},
  tabActive:{color:'var(--t1)',fontWeight:600,borderBottomColor:'var(--t1)'},
  main:{flex:1,overflow:'hidden',display:'flex'},
};

/* ═══ CLASS VIEW ═══ */
function ClassView({onSelectStudent}) {
  const total = STUDENTS.length;
  const [expandedQ, setExpandedQ] = useState(null);

  /* Overall stats */
  const totalCorrect = STUDENTS.reduce((a,s)=>{
    return a + QUESTIONS.reduce((b,q)=>b+(s.answers[q.id]===q.correct?1:0),0);
  },0);
  const totalQs = total * QUESTIONS.length;
  const perfect = STUDENTS.filter(s=>QUESTIONS.every(q=>s.answers[q.id]===q.correct)).length;
  const zero = STUDENTS.filter(s=>QUESTIONS.every(q=>s.answers[q.id]!==q.correct)).length;
  const avgTime = Math.round(STUDENTS.reduce((a,s)=>a+s.time,0)/total);
  const avgScore = (STUDENTS.reduce((a,s)=>a+QUESTIONS.reduce((b,q)=>b+(s.answers[q.id]===q.correct?1:0),0),0)/total).toFixed(1);

  const cs = {
    wrap:{flex:1,overflowY:'auto',padding:'20px 24px 40px'},
    inner:{maxWidth:920,margin:'0 auto'},
    grid4:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20},
    hcard:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px'},
    hcardLabel:{fontSize:9,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4},
    hcardVal:{fontSize:24,fontWeight:700,letterSpacing:'-.5px',lineHeight:1},
    hcardSub:{fontSize:10,color:'var(--t2)',marginTop:4,lineHeight:1.4},
    sectionH:{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10,marginTop:20,display:'flex',alignItems:'center',gap:8},
    sectionLine:{flex:1,height:1,background:'var(--border)'},
    dot:{width:8,height:8,borderRadius:'50%',flexShrink:0},
    chipSmall:{fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:3,display:'inline-flex',alignItems:'center',gap:3},
    misconCard:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8},
    misconHigh:{borderColor:'rgba(148,41,41,.2)',background:'rgba(148,41,41,.03)'},
    misconMed:{borderColor:'rgba(196,138,30,.2)',background:'rgba(196,138,30,.03)'},
    qCard:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8,cursor:'pointer',transition:'all .12s'},
    qCardOpen:{borderColor:'rgba(28,28,26,.14)',boxShadow:'0 2px 8px rgba(28,28,26,.06)'},
  };

  const optionLabels = ['A','B','C','D'];

  return React.createElement('div',{style:cs.wrap},
    React.createElement('div',{style:cs.inner},

      /* Health Cards */
      React.createElement('div',{style:cs.grid4},
        React.createElement('div',{style:{...cs.hcard,borderColor:'rgba(45,102,18,.15)',background:'var(--green-bg)'}},
          React.createElement('div',{style:{...cs.hcardLabel,color:'var(--green)'}}, '班级正确率'),
          React.createElement('div',{style:{...cs.hcardVal,color:'var(--green)'}}, `${Math.round(totalCorrect/totalQs*100)}%`),
          React.createElement('div',{style:cs.hcardSub}, `${totalCorrect}/${totalQs} correct · avg ${avgScore}/5`),
        ),
        React.createElement('div',{style:{...cs.hcard,borderColor:'rgba(58,49,133,.15)',background:'var(--purple-bg)'}},
          React.createElement('div',{style:{...cs.hcardLabel,color:'var(--purple)'}}, '满分'),
          React.createElement('div',{style:{...cs.hcardVal,color:'var(--purple)'}}, perfect),
          React.createElement('div',{style:cs.hcardSub}, `${zero} 人零分`),
        ),
        React.createElement('div',{style:cs.hcard},
          React.createElement('div',{style:cs.hcardLabel}, '平均用时'),
          React.createElement('div',{style:cs.hcardVal}, formatTime(avgTime)),
          React.createElement('div',{style:cs.hcardSub}, `最快 ${formatTime(Math.min(...STUDENTS.map(s=>s.time)))} · 最慢 ${formatTime(Math.max(...STUDENTS.map(s=>s.time)))}`),
        ),
        React.createElement('div',{style:cs.hcard},
          React.createElement('div',{style:cs.hcardLabel}, '误解模式'),
          React.createElement('div',{style:cs.hcardVal}, MISCONCEPTIONS.length),
          React.createElement('div',{style:cs.hcardSub}, `高频 ${MISCONCEPTIONS.filter(m=>m.severity==='high').length} 个`),
        ),
      ),

      /* Per-question analysis */
      React.createElement('div',{style:cs.sectionH},
        React.createElement('span',null,'逐题分析'),
        React.createElement('div',{style:cs.sectionLine}),
      ),
      QUESTIONS.map((q,qi)=>{
        const stats = getQuestionStats(q.id);
        const isOpen = expandedQ === q.id;
        const pct = Math.round(stats.correct/stats.total*100);
        return React.createElement('div',{key:q.id,style:{...cs.qCard,...(isOpen?cs.qCardOpen:{})}},
          React.createElement('div',{onClick:()=>setExpandedQ(isOpen?null:q.id),style:{display:'flex',alignItems:'center',gap:10}},
            React.createElement('span',{style:{fontSize:12,fontWeight:700,color:'var(--t1)',width:28}}, `Q${qi+1}`),
            React.createElement('div',{style:{flex:1,minWidth:0}},
              React.createElement('div',{style:{fontSize:11,fontWeight:600,color:'var(--t1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, q.stem),
              React.createElement('div',{style:{fontSize:9,color:'var(--t3)',marginTop:2}}, q.tag),
            ),
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:6,flexShrink:0}},
              React.createElement('div',{style:{width:60,height:6,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}},
                React.createElement('div',{style:{width:`${pct}%`,height:'100%',borderRadius:3,background:pct>80?'var(--green)':pct>50?'var(--blue)':'var(--red)'}}),
              ),
              React.createElement('span',{style:{fontSize:11,fontWeight:700,color:pct>80?'var(--green)':pct>50?'var(--blue)':'var(--red)',width:32}}, `${pct}%`),
            ),
            React.createElement('span',{style:{fontSize:8,color:'var(--t3)',transition:'transform .2s',transform:isOpen?'rotate(90deg)':'none'}}, '▶'),
          ),
          isOpen && React.createElement('div',{style:{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}},
            /* Option distribution */
            React.createElement('div',{style:{fontSize:10,fontWeight:600,color:'var(--t3)',marginBottom:8}}, '选项分布'),
            q.options.map((opt,oi)=>{
              const count = stats.distrib[oi];
              const isCorrect = oi === stats.correctIdx;
              const barPct = count/total*100;
              return React.createElement('div',{key:oi,style:{display:'flex',alignItems:'center',gap:8,marginBottom:4}},
                React.createElement('span',{style:{fontSize:10,fontWeight:700,color:isCorrect?'var(--green)':'var(--t2)',width:16}}, optionLabels[oi]),
                React.createElement('div',{style:{flex:1,height:18,background:'var(--surface2)',borderRadius:3,overflow:'hidden',position:'relative'}},
                  React.createElement('div',{style:{width:`${barPct}%`,height:'100%',borderRadius:3,background:isCorrect?'var(--green)':count>0?'var(--red)':'transparent',opacity:.7}}),
                  React.createElement('span',{style:{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',fontSize:9,fontWeight:500,color:'var(--t1)',maxWidth:'90%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, opt),
                ),
                React.createElement('span',{style:{fontSize:10,fontWeight:700,color:isCorrect?'var(--green)':'var(--t2)',width:24,textAlign:'right'}}, count),
                isCorrect && React.createElement('span',{style:{fontSize:8,color:'var(--green)'}}, '✓'),
              );
            }),
            /* Wrong students */
            React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:4,marginTop:8}},
              STUDENTS.filter(s=>s.answers[q.id]!==q.correct).map(s=>
                React.createElement('span',{key:s.id,onClick:(e)=>{e.stopPropagation();onSelectStudent(s);},style:{fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:3,background:'var(--red-bg)',color:'var(--red)',cursor:'pointer'}},
                  `${s.name} → ${optionLabels[s.answers[q.id]]}`)
              ),
            ),
          ),
        );
      }),

      /* Misconceptions */
      React.createElement('div',{style:cs.sectionH},
        React.createElement('span',null,'误解聚类'),
        React.createElement('div',{style:cs.sectionLine}),
      ),
      MISCONCEPTIONS.map(m=>
        React.createElement('div',{key:m.id,style:{...cs.misconCard,...(m.severity==='high'?cs.misconHigh:m.severity==='medium'?cs.misconMed:{})}},
          React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:6}},
            React.createElement('span',{style:{...cs.chipSmall,background:m.severity==='high'?'var(--red)':m.severity==='medium'?'var(--amber)':'var(--t3)',color:'#fff'}},
              m.severity==='high'?'高频':m.severity==='medium'?'中频':'低频'),
            React.createElement('span',{style:{fontSize:12,fontWeight:700,color:'var(--t1)'}},m.label),
            React.createElement('span',{style:{marginLeft:'auto',fontSize:11,fontWeight:600,color:'var(--t2)'}},`${m.count} 人`),
          ),
          React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:4,marginTop:6}},
            m.students.map(name=>
              React.createElement('span',{key:name,onClick:()=>onSelectStudent(STUDENTS.find(s=>s.name===name)),style:{fontSize:10,fontWeight:600,padding:'3px 8px',borderRadius:4,background:'var(--surface2)',color:'var(--t2)',cursor:'pointer'}},name)
            ),
          ),
        )
      ),

      /* Student List */
      React.createElement('div',{style:cs.sectionH},
        React.createElement('span',null,'全部学生'),
        React.createElement('div',{style:cs.sectionLine}),
      ),
      React.createElement('div',{style:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}},
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 50px repeat(5,1fr) 60px',gap:6,padding:'8px 14px',fontSize:9,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'1px solid var(--border)'}},
          React.createElement('span',null,'学生'),
          React.createElement('span',null,'用时'),
          ...QUESTIONS.map((_,i)=>React.createElement('span',{key:i},`Q${i+1}`)),
          React.createElement('span',null,'得分'),
        ),
        STUDENTS.map(s=>{
          const score = QUESTIONS.reduce((a,q)=>a+(s.answers[q.id]===q.correct?1:0),0);
          return React.createElement('div',{key:s.id,onClick:()=>onSelectStudent(s),
            style:{display:'grid',gridTemplateColumns:'1fr 50px repeat(5,1fr) 60px',gap:6,padding:'8px 14px',fontSize:11,alignItems:'center',cursor:'pointer',borderBottom:'1px solid var(--border)',transition:'background .1s'},
            onMouseEnter:e=>e.currentTarget.style.background='var(--surface2)',
            onMouseLeave:e=>e.currentTarget.style.background='transparent',
          },
            React.createElement('span',{style:{fontWeight:600}},s.name),
            React.createElement('span',{style:{color:'var(--t2)',fontSize:10}},formatTime(s.time)),
            ...QUESTIONS.map(q=>{
              const correct = s.answers[q.id]===q.correct;
              const changed = s.changed[q.id];
              return React.createElement('span',{key:q.id,style:{fontSize:10,fontWeight:600,textAlign:'center',color:correct?'var(--green)':'var(--red)'}},
                (correct?'✓':'✕') + (changed?' ↺':'')
              );
            }),
            React.createElement('span',{style:{fontSize:11,fontWeight:700,color:score===5?'var(--green)':score>=3?'var(--blue)':'var(--red)'}}, `${score}/5`),
          );
        }),
      ),
    ),
  );
}

/* ═══ STUDENT VIEW ═══ */
function StudentView({student,onBack}) {
  const s = student;
  const score = QUESTIONS.reduce((a,q)=>a+(s.answers[q.id]===q.correct?1:0),0);
  const optionLabels = ['A','B','C','D'];

  const sv = {
    wrap:{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'},
    header:{display:'flex',alignItems:'center',gap:14,padding:'14px 24px',background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
    backBtn:{fontSize:11,fontWeight:500,color:'var(--t2)',cursor:'pointer',padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface)',fontFamily:'inherit'},
    avatar:{width:36,height:36,borderRadius:8,background:'var(--t1)',color:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700},
    body:{flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'hidden'},
    col:{overflowY:'auto',padding:'20px 24px 40px'},
    colRight:{overflowY:'auto',padding:'20px 24px 40px',background:'var(--surface)',borderLeft:'1px solid var(--border)'},
    sectionH:{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10,marginTop:16,display:'flex',alignItems:'center',gap:8},
    sectionLine:{flex:1,height:1,background:'var(--border)'},
    statGrid:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16},
    stat:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',textAlign:'center'},
    statN:{fontSize:20,fontWeight:700,lineHeight:1},
    statL:{fontSize:8,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.3px',marginTop:3},
    qCard:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8},
    kiCard:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8},
    kiTitle:{fontSize:10,fontWeight:700,color:'var(--t1)',marginBottom:6},
    kiItem:{fontSize:11,color:'var(--t2)',lineHeight:1.6,padding:'3px 0',display:'flex',gap:6},
    kiBullet:{color:'var(--t3)',flexShrink:0},
  };

  return React.createElement('div',{style:sv.wrap},
    React.createElement('div',{style:sv.header},
      React.createElement('button',{style:sv.backBtn,onClick:onBack},'← 返回班级'),
      React.createElement('div',{style:sv.avatar},s.name[0]),
      React.createElement('div',{style:{flex:1}},
        React.createElement('div',{style:{fontSize:15,fontWeight:600}},s.name),
        React.createElement('div',{style:{fontSize:11,color:'var(--t3)',marginTop:2}}, 'MC · 选择题'),
      ),
      React.createElement('span',{style:{fontSize:10,fontWeight:600,padding:'3px 10px',borderRadius:4,background:score===5?'var(--green-bg)':score>=3?'var(--blue-bg)':'var(--red-bg)',color:score===5?'var(--green)':score>=3?'var(--blue)':'var(--red)'}},
        `${score}/5 正确`),
    ),

    React.createElement('div',{style:sv.body},
      /* Left: Stats + Per-question detail */
      React.createElement('div',{style:sv.col},
        React.createElement('div',{style:sv.statGrid},
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:{...sv.statN,color:score===5?'var(--green)':score>=3?'var(--blue)':'var(--red)'}}, `${score}/5`),
            React.createElement('div',{style:sv.statL},'正确'),
          ),
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:sv.statN},formatTime(s.time)),
            React.createElement('div',{style:sv.statL},'用时'),
          ),
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:sv.statN}, Object.values(s.changed).filter(Boolean).length),
            React.createElement('div',{style:sv.statL},'改答案'),
          ),
        ),

        React.createElement('div',{style:{...sv.sectionH,marginTop:0}},
          React.createElement('span',null,'逐题详情'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        QUESTIONS.map((q,qi)=>{
          const correct = s.answers[q.id]===q.correct;
          const changed = s.changed[q.id];
          return React.createElement('div',{key:q.id,style:{...sv.qCard,borderColor:correct?'rgba(45,102,18,.15)':'rgba(148,41,41,.15)',background:correct?'rgba(45,102,18,.02)':'rgba(148,41,41,.02)'}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:6}},
              React.createElement('span',{style:{fontSize:11,fontWeight:700,color:correct?'var(--green)':'var(--red)'}}, `Q${qi+1} ${correct?'✓':'✕'}`),
              React.createElement('span',{style:{fontSize:9,color:'var(--t3)',background:'var(--surface2)',padding:'2px 6px',borderRadius:3}}, q.tag),
              React.createElement('span',{style:{marginLeft:'auto',fontSize:9,color:'var(--t3)'}}, `${formatTime(s.times[q.id])}${changed?' · 改过':''}`)
            ),
            React.createElement('div',{style:{fontSize:11,color:'var(--t2)',lineHeight:1.6,marginBottom:6}}, q.stem),
            /* Options */
            q.options.map((opt,oi)=>{
              const isStudentChoice = s.answers[q.id]===oi;
              const isCorrectOpt = q.correct===oi;
              const bg = isStudentChoice&&isCorrectOpt?'var(--green-bg)':isStudentChoice?'var(--red-bg)':isCorrectOpt?'rgba(45,102,18,.06)':'transparent';
              const color = isStudentChoice&&isCorrectOpt?'var(--green)':isStudentChoice?'var(--red)':isCorrectOpt?'var(--green)':'var(--t2)';
              const fw = (isStudentChoice||isCorrectOpt)?600:400;
              return React.createElement('div',{key:oi,style:{display:'flex',alignItems:'center',gap:8,padding:'4px 8px',borderRadius:4,background:bg,marginBottom:2}},
                React.createElement('span',{style:{fontSize:10,fontWeight:700,color,width:14}}, optionLabels[oi]),
                React.createElement('span',{style:{fontSize:11,color,fontWeight:fw,flex:1}}, opt),
                isStudentChoice && React.createElement('span',{style:{fontSize:9,fontWeight:700,color}}, isCorrectOpt?'✓ 选对':'✕ 选了'),
                !isStudentChoice && isCorrectOpt && React.createElement('span',{style:{fontSize:9,color:'var(--green)'}}, '← 正确'),
              );
            }),
          );
        }),
      ),

      /* Right: Key Findings + Class Comparison */
      React.createElement('div',{style:sv.colRight},
        React.createElement('div',{style:{...sv.sectionH,marginTop:0}},
          React.createElement('span',null,'关键发现'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        React.createElement('div',{style:sv.kiCard},
          React.createElement('div',{style:sv.kiTitle}, '学习状态摘要'),
          s.keyInsights.map((insight,i)=>
            React.createElement('div',{key:i,style:sv.kiItem},
              React.createElement('span',{style:sv.kiBullet},'·'),
              React.createElement('span',null,insight),
            )
          ),
        ),

        /* Status card */
        React.createElement('div',{style:{...sv.kiCard,background:score===5?'var(--green-bg)':score>=3?'var(--blue-bg)':'var(--red-bg)',borderColor:score===5?'rgba(45,102,18,.15)':score>=3?'rgba(26,95,160,.15)':'rgba(148,41,41,.15)'}},
          React.createElement('div',{style:{...sv.kiTitle,color:score===5?'var(--green)':score>=3?'var(--blue)':'var(--red)'}},
            score===5?'全部正确':score>=3?'大部分正确':'需重点关注'),
          React.createElement('div',{style:{fontSize:11,color:'var(--t2)',lineHeight:1.6}},
            `正确 ${score}/5，用时 ${formatTime(s.time)}。${Object.values(s.changed).filter(Boolean).length>0?`改过 ${Object.values(s.changed).filter(Boolean).length} 题答案。`:''}`),
        ),

        /* Per-question time bar */
        React.createElement('div',{style:{...sv.sectionH,marginTop:20}},
          React.createElement('span',null,'每题用时'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        React.createElement('div',{style:sv.kiCard},
          QUESTIONS.map((q,qi)=>{
            const t = s.times[q.id];
            const correct = s.answers[q.id]===q.correct;
            const maxT = 45;
            return React.createElement('div',{key:q.id,style:{display:'flex',alignItems:'center',gap:8,marginBottom:6}},
              React.createElement('span',{style:{fontSize:10,fontWeight:600,color:'var(--t2)',width:24}}, `Q${qi+1}`),
              React.createElement('div',{style:{flex:1,height:14,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}},
                React.createElement('div',{style:{width:`${Math.min(t/maxT*100,100)}%`,height:'100%',borderRadius:3,background:correct?'var(--green)':'var(--red)',opacity:.6}}),
              ),
              React.createElement('span',{style:{fontSize:9,fontWeight:600,color:'var(--t2)',width:24}}, `${t}s`),
              React.createElement('span',{style:{fontSize:9,color:correct?'var(--green)':'var(--red)'}}, correct?'✓':'✕'),
            );
          }),
        ),

        /* Class comparison */
        React.createElement('div',{style:{...sv.sectionH,marginTop:20}},
          React.createElement('span',null,'班级对比'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        React.createElement('div',{style:sv.kiCard},
          [{label:'得分',val:score,avg:+(STUDENTS.reduce((a,st)=>a+QUESTIONS.reduce((b,q)=>b+(st.answers[q.id]===q.correct?1:0),0),0)/STUDENTS.length).toFixed(1),max:5,unit:'/5'},
           {label:'用时',val:s.time,avg:Math.round(STUDENTS.reduce((a,st)=>a+st.time,0)/STUDENTS.length),max:180,unit:'s',format:formatTime,invert:true},
          ].map((row,i)=>
            React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:8,marginBottom:8}},
              React.createElement('span',{style:{fontSize:10,color:'var(--t3)',width:40,flexShrink:0}},row.label),
              React.createElement('div',{style:{flex:1,height:14,background:'var(--surface2)',borderRadius:3,position:'relative',overflow:'visible'}},
                React.createElement('div',{style:{position:'absolute',left:`${row.avg/row.max*100}%`,top:-2,width:2,height:18,background:'rgba(28,28,26,.14)',borderRadius:1,zIndex:1}}),
                React.createElement('div',{style:{height:'100%',width:`${row.val/row.max*100}%`,borderRadius:3,background:(row.invert?(row.val<row.avg):(row.val>row.avg))?'var(--green)':'var(--amber)',opacity:.7}}),
              ),
              React.createElement('span',{style:{fontSize:10,fontWeight:600,color:'var(--t1)',width:36,textAlign:'right'}},row.format?row.format(row.val):`${row.val}${row.unit}`),
            )
          ),
          React.createElement('div',{style:{display:'flex',gap:12,marginTop:4,fontSize:9,color:'var(--t3)'}},
            React.createElement('span',{style:{display:'flex',alignItems:'center',gap:3}}, React.createElement('span',{style:{width:8,height:4,borderRadius:2,background:'var(--green)',display:'inline-block',opacity:.7}}), '该学生'),
            React.createElement('span',{style:{display:'flex',alignItems:'center',gap:3}}, React.createElement('span',{style:{width:2,height:10,borderRadius:1,background:'rgba(28,28,26,.14)',display:'inline-block'}}), '班级均值'),
          ),
        ),
      ),
    ),
  );
}

/* ═══ TIMELINE SCRUBBER ═══ */
function McTimelineScrubber({elapsed,total,onSeek,isLive,onToggleLive}) {
  const trackRef = useRef(null);
  const [dragging,setDragging] = useState(false);
  const pct = Math.min(elapsed/total*100,100);
  const handleTrackClick=(e)=>{const rect=trackRef.current.getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));onSeek(Math.round(x*total));};
  const handleMouseDown=(e)=>{e.preventDefault();setDragging(true);const onMove=(ev)=>{const rect=trackRef.current.getBoundingClientRect();const x=Math.max(0,Math.min(1,(ev.clientX-rect.left)/rect.width));onSeek(Math.round(x*total));};const onUp=()=>{setDragging(false);window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);};
  const tlS={wrap:{display:'flex',alignItems:'center',height:40,padding:'0 24px',background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0,gap:12},time:{fontSize:12,fontWeight:700,color:'var(--t1)',minWidth:42,textAlign:'center',fontVariantNumeric:'tabular-nums'},trackWrap:{flex:1,position:'relative',height:24,display:'flex',alignItems:'center',cursor:'pointer'},track:{width:'100%',height:6,background:'var(--surface2)',borderRadius:3,position:'relative'},fill:{height:'100%',borderRadius:3,background:'var(--t1)',position:'absolute',top:0,left:0,transition:dragging?'none':'width .15s'},thumb:{width:14,height:14,borderRadius:'50%',background:'var(--t1)',border:'2px solid var(--surface)',boxShadow:'0 1px 4px rgba(0,0,0,.2)',position:'absolute',top:'50%',transform:'translate(-50%,-50%)',cursor:'grab',zIndex:2,transition:dragging?'none':'left .15s'},total:{fontSize:12,color:'var(--t3)',minWidth:42,textAlign:'center'},liveTag:{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:3,cursor:'pointer',border:'none',fontFamily:'inherit'}};
  return React.createElement('div',{style:tlS.wrap},
    React.createElement('div',{style:tlS.time},formatTime(elapsed)),
    React.createElement('div',{ref:trackRef,style:tlS.trackWrap,onClick:handleTrackClick},
      React.createElement('div',{style:tlS.track},React.createElement('div',{style:{...tlS.fill,width:`${pct}%`}})),
      React.createElement('div',{style:{...tlS.thumb,left:`${pct}%`},onMouseDown:handleMouseDown}),
    ),
    React.createElement('div',{style:tlS.total},formatTime(total)),
    React.createElement('button',{style:{...tlS.liveTag,background:isLive?'var(--green-bg)':'var(--amber-bg)',color:isLive?'var(--green)':'var(--amber)'},onClick:onToggleLive},isLive?'● 实时':'回放'),
  );
}

/* ═══ MAIN APP ═══ */
function McObserveApp() {
  const [view,setView] = useState('class');
  const [selectedStudent,setSelectedStudent] = useState(null);
  const STEP_TOTAL = 180;
  const [elapsed,setElapsed] = useState(168);
  const [isLive,setIsLive] = useState(true);
  const handleSeek=(t)=>{setElapsed(t);setIsLive(false);};
  const handleToggleLive=()=>{if(!isLive){setElapsed(168);setIsLive(true);}};
  const selectStudent=(s)=>{if(!s)return;setSelectedStudent(s);setView('student');};

  return React.createElement('div',{style:S.shell},
    React.createElement('div',{style:S.band},
      React.createElement('div',{style:S.bandMark},'Q'),
      React.createElement('div',{style:S.bandTitle},'选择题 观察'),
      React.createElement('div',{style:S.bandTag},'Quiz · 5 Questions'),
      React.createElement('div',{style:S.bandMeta},`高一(3)班 · ${STUDENTS.length}/${STUDENTS.length} 人已提交`),
      React.createElement('div',{style:S.bandRight},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,color:'var(--green)'}},
          React.createElement('span',{style:{width:6,height:6,borderRadius:'50%',background:'var(--green)'}}),
          '实时',
        ),
      ),
    ),
    React.createElement(McTimelineScrubber,{elapsed,total:STEP_TOTAL,onSeek:handleSeek,isLive,onToggleLive:handleToggleLive}),
    React.createElement('div',{style:S.tabs},
      React.createElement('button',{style:{...S.tab,...(view==='class'?S.tabActive:{})},onClick:()=>setView('class')}, `班级总览 · ${STUDENTS.length}人`),
      selectedStudent && React.createElement('button',{style:{...S.tab,...(view==='student'?S.tabActive:{})},onClick:()=>setView('student')}, `📋 ${selectedStudent.name}`),
    ),
    React.createElement('div',{style:S.main},
      view==='class'
        ? React.createElement(ClassView,{onSelectStudent:selectStudent})
        : selectedStudent
          ? React.createElement(StudentView,{student:selectedStudent,onBack:()=>setView('class')})
          : null,
    ),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(McObserveApp));
