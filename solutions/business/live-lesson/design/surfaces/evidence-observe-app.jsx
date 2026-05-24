const {useState, useCallback, useRef, useEffect, Fragment, useMemo} = React;

/* ═══════════════════════════════════════════════════════════
   SELECT EVIDENCE OBSERVATION — Teacher Console
   Observe students picking function labels + evidence phrases
   Class Overview + Individual Student Deep-dive
   ═══════════════════════════════════════════════════════════ */

const SECTIONS = [
  {id:'p12', label:'¶1-2', func:'Phenomenon', funcZh:'现象'},
  {id:'p34', label:'¶3-4', func:'History', funcZh:'历史'},
  {id:'p57', label:'¶5-7', func:'Culture', funcZh:'文化'},
  {id:'p8',  label:'¶8',   func:'Conclusion', funcZh:'结论'},
];

const EVIDENCE_COUNTS = {p12:4, p34:4, p57:6, p8:3}; // total evidence tokens per section

function formatTime(s){const m=Math.floor(s/60),ss=s%60;return `${m}:${ss<10?'0':''}${ss}`;}

/* ─── MOCK STUDENT DATA ─── */
const STUDENTS = [
  {id:1,name:'王译文',time:245,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:5,evidenceTotal:6,wrongPicks:1,perfect:false,
      wrongDetails:['picked "tattoos" (¶5) — a practice, not a structural signal'],
      missed:['"cultural identity" (¶7)']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['3/4 sections perfect','¶5-7误选了"tattoos"(practice而非signal)','整体表现优秀']},
  {id:2,name:'黄婉晴',time:320,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:4,wrongPicks:1,perfect:false,
      wrongDetails:['picked "many parts of Nigeria" — a place, not the conflict signal'],
      missed:['"shallow beauty ideals"']},
    p34:{func:'Culture',funcCorrect:false,attempts:2,evidenceHit:2,evidenceTotal:4,wrongPicks:2,perfect:false,
      wrongDetails:['picked "paint dark kohl" — a practice','picked "plump and pale-skinned" — a description'],
      missed:['"change over time"','"different periods of history"']},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:6,wrongPicks:2,perfect:false,
      wrongDetails:['picked "tattoos"','picked "diary of important events"'],
      missed:['"Indonesia"','"cultural identity"','"New Zealand"']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:2,evidenceTotal:3,wrongPicks:0,perfect:false,
      missed:['"cultural values, not just vanity"']},
   },
   keyInsights:['¶3-4先选错function(Culture→History)','混淆practice和structural signal','多次选到描述性内容而非结构信号']},
  {id:3,name:'徐晨曦',time:358,completed:3,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:2,evidenceHit:2,evidenceTotal:4,wrongPicks:1,perfect:false,
      wrongDetails:['picked "many parts of Nigeria"'],
      missed:['"what about the rest of the world?"','"shallow beauty ideals"']},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:2,evidenceTotal:4,wrongPicks:2,perfect:false,
      wrongDetails:['picked "paint dark kohl"','picked "plump and pale-skinned"'],
      missed:['"ancient Egypt"','"different periods of history"']},
    p57:{func:'History',funcCorrect:false,attempts:3,evidenceHit:2,evidenceTotal:6,wrongPicks:3,perfect:false,
      wrongDetails:['picked "tattoos"','picked "tā moko"','picked "wearing metal rings"'],
      missed:['"different cultures around the world"','"New Zealand"','"Indonesia"','"cultural identity"']},
    p8:{func:null,funcCorrect:false,attempts:0,evidenceHit:0,evidenceTotal:3,wrongPicks:0,perfect:false},
   },
   keyInsights:['¶5-7先选错History(3次尝试才对)','大量选practice而非signal','¶8未完成']},
  {id:4,name:'陈昕妍',time:185,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:6,evidenceTotal:6,wrongPicks:0,perfect:true},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['4/4 sections perfect','速度最快(3:05)','零误选']},
  {id:5,name:'李奕辰',time:260,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:4,wrongPicks:0,perfect:false,missed:['"what about the rest of the world?"']},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:5,evidenceTotal:6,wrongPicks:0,perfect:false,missed:['"cultural identity" (¶7)']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['2/4 perfect','漏选了pivot句和cultural identity','无误选——保守策略']},
  {id:6,name:'郭斐然',time:348,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:2,evidenceHit:2,evidenceTotal:4,wrongPicks:1,perfect:false,
      wrongDetails:['picked "many parts of Nigeria"'],missed:['"what about the rest of the world?"','"shallow beauty ideals"']},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:4,wrongPicks:1,perfect:false,
      wrongDetails:['picked "paint dark kohl"'],missed:['"different periods of history"']},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:6,wrongPicks:2,perfect:false,
      wrongDetails:['picked "tattoos"','picked "wearing metal rings"'],missed:['"different cultures around the world"','"Indonesia"','"cultural identity"']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:2,evidenceTotal:3,wrongPicks:0,perfect:false,missed:['"cultural values, not just vanity"']},
   },
   keyInsights:['0/4 perfect','反复选practice而非signal','function选择基本正确']},
  {id:7,name:'张皓月',time:230,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:4,wrongPicks:0,perfect:false,missed:['"ancient Egypt"']},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:5,evidenceTotal:6,wrongPicks:0,perfect:false,missed:['"cultural identity"']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['2/4 perfect','无误选','漏了两个evidence']},
  {id:8,name:'周航宇',time:250,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:6,wrongPicks:1,perfect:false,
      wrongDetails:['picked "diary of important events"'],missed:['"Indonesia"','"cultural identity"']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['3/4 perfect','¶5-7有一个distractor误选']},
  {id:9,name:'郑若曦',time:200,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:6,evidenceTotal:6,wrongPicks:0,perfect:true},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['4/4 perfect','全部正确——顶尖表现']},
  {id:10,name:'邓梓涵',time:355,completed:3,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:2,evidenceHit:2,evidenceTotal:4,wrongPicks:2,perfect:false,
      wrongDetails:['picked "many parts of Nigeria"','picked "fattening rooms"'],missed:['"what about the rest of the world?"','"shallow beauty ideals"']},
    p34:{func:'Culture',funcCorrect:false,attempts:3,evidenceHit:1,evidenceTotal:4,wrongPicks:2,perfect:false,
      wrongDetails:['picked "paint dark kohl"','picked "plump and pale-skinned"'],missed:['"change over time"','"different periods of history"','"Elizabethan England"']},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:2,evidenceTotal:6,wrongPicks:3,perfect:false,
      wrongDetails:['picked "tattoos"','picked "tā moko"','picked "diary of important events"'],missed:['"different cultures around the world"','"New Zealand"','"Indonesia"','"cultural identity"']},
    p8:{func:null,funcCorrect:false,attempts:0,evidenceHit:0,evidenceTotal:3,wrongPicks:0,perfect:false},
   },
   keyInsights:['0/4 perfect','¶3-4 function选错3次','大量practice误选','¶8未完成']},
  {id:11,name:'董思齐',time:360,completed:2,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:2,evidenceHit:1,evidenceTotal:4,wrongPicks:1,perfect:false,
      wrongDetails:['picked "fattening rooms"'],missed:['"what about the rest of the world?"','"slim and fair"','"shallow beauty ideals"']},
    p34:{func:'History',funcCorrect:true,attempts:2,evidenceHit:2,evidenceTotal:4,wrongPicks:1,perfect:false,
      wrongDetails:['picked "plump and pale-skinned"'],missed:['"change over time"','"ancient Egypt"']},
    p57:{func:null,funcCorrect:false,attempts:0,evidenceHit:0,evidenceTotal:6,wrongPicks:0,perfect:false},
    p8:{func:null,funcCorrect:false,attempts:0,evidenceHit:0,evidenceTotal:3,wrongPicks:0,perfect:false},
   },
   keyInsights:['只完成2/4 sections','完全卡住后半部分','时间用完']},
  {id:12,name:'冯璐',time:310,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:4,wrongPicks:0,perfect:false,missed:['"what about the rest of the world?"']},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:4,wrongPicks:1,perfect:false,
      wrongDetails:['picked "plump and pale-skinned"'],missed:['"different periods of history"']},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:6,wrongPicks:1,perfect:false,
      wrongDetails:['picked "tā moko"'],missed:['"Indonesia"','"cultural identity"','"different cultures around the world"']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:2,evidenceTotal:3,wrongPicks:0,perfect:false,missed:['"cultural values, not just vanity"']},
   },
   keyInsights:['0/4 perfect但全部完成','各section都有小误差','function选择全对']},
  {id:13,name:'谢安然',time:358,completed:2,
   sections:{
    p12:{func:'History',funcCorrect:false,attempts:3,evidenceHit:1,evidenceTotal:4,wrongPicks:2,perfect:false,
      wrongDetails:['picked "many parts of Nigeria"','picked "fattening rooms"'],missed:['"slim and fair"','"what about the rest of the world?"','"shallow beauty ideals"']},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:2,evidenceTotal:4,wrongPicks:1,perfect:false,
      wrongDetails:['picked "paint dark kohl"'],missed:['"change over time"','"different periods of history"']},
    p57:{func:null,funcCorrect:false,attempts:0,evidenceHit:0,evidenceTotal:6,wrongPicks:0,perfect:false},
    p8:{func:null,funcCorrect:false,attempts:0,evidenceHit:0,evidenceTotal:3,wrongPicks:0,perfect:false},
   },
   keyInsights:['¶1-2选错function 3次(History)','语言障碍导致理解困难','只完成2/4']},
  {id:14,name:'马乐瑶',time:270,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:4,wrongPicks:0,perfect:false,missed:['"ancient Egypt"']},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:5,evidenceTotal:6,wrongPicks:0,perfect:false,missed:['"cultural identity"']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['2/4 perfect','无误选，保守策略']},
  {id:15,name:'林澜',time:258,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:4,wrongPicks:0,perfect:false,missed:['"shallow beauty ideals"']},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:6,wrongPicks:1,perfect:false,
      wrongDetails:['picked "tattoos"'],missed:['"Indonesia"','"cultural identity"']},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['2/4 perfect','¶5-7选了"tattoos"']},
  {id:16,name:'朱思语',time:170,completed:4,
   sections:{
    p12:{func:'Phenomenon',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p34:{func:'History',funcCorrect:true,attempts:1,evidenceHit:4,evidenceTotal:4,wrongPicks:0,perfect:true},
    p57:{func:'Culture',funcCorrect:true,attempts:1,evidenceHit:6,evidenceTotal:6,wrongPicks:0,perfect:true},
    p8:{func:'Conclusion',funcCorrect:true,attempts:1,evidenceHit:3,evidenceTotal:3,wrongPicks:0,perfect:true},
   },
   keyInsights:['4/4 perfect','最快完成(2:50)','零误选——与陈昕妍并列最佳']},
];

/* Common wrong-pick patterns */
const MISCONCEPTIONS = [
  {id:1, label:'选practice而非structural signal (如"tattoos","kohl")', count:9, students:['黄婉晴','徐晨曦','郭斐然','周航宇','邓梓涵','董思齐','冯璐','谢安然','林澜'], severity:'high'},
  {id:2, label:'¶3-4 function选错 (Culture而非History)', count:3, students:['黄婉晴','徐晨曦','邓梓涵'], severity:'medium'},
  {id:3, label:'¶1-2 选"many parts of Nigeria"(地点而非conflict)', count:4, students:['黄婉晴','徐晨曦','郭斐然','邓梓涵'], severity:'medium'},
  {id:4, label:'漏选"cultural identity" (¶7)', count:7, students:['王译文','李奕辰','张皓月','周航宇','冯璐','马乐瑶','林澜'], severity:'low'},
];

/* ─── STYLES ─── */
const S = {
  shell:{display:'flex',flexDirection:'column',height:'100vh'},
  band:{display:'flex',alignItems:'center',gap:12,padding:'0 20px',height:44,background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  bandMark:{width:22,height:22,borderRadius:6,background:'var(--t1)',color:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700},
  bandTitle:{fontSize:13,fontWeight:600,letterSpacing:'-.1px'},
  bandTag:{fontSize:10,fontWeight:600,color:'var(--teal)',background:'var(--teal-bg)',padding:'2px 8px',borderRadius:3,letterSpacing:'.3px'},
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
  const allDone = STUDENTS.filter(s=>s.completed===4).length;
  const perfectAll = STUDENTS.filter(s=> Object.values(s.sections).every(sec=>sec.perfect)).length;
  const avgTime = Math.round(STUDENTS.reduce((a,s)=>a+s.time,0)/total);
  /* total evidence accuracy */
  const totalHit = STUDENTS.reduce((a,s)=>a+Object.values(s.sections).reduce((b,sec)=>b+sec.evidenceHit,0),0);
  const totalEv = STUDENTS.reduce((a,s)=>a+Object.values(s.sections).reduce((b,sec)=>b+sec.evidenceTotal,0),0);
  const totalWrong = STUDENTS.reduce((a,s)=>a+Object.values(s.sections).reduce((b,sec)=>b+sec.wrongPicks,0),0);
  const funcWrongCount = STUDENTS.reduce((a,s)=>a+Object.values(s.sections).filter(sec=>!sec.funcCorrect).length,0);

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
  };

  return React.createElement('div',{style:cs.wrap},
    React.createElement('div',{style:cs.inner},

      /* Health Cards */
      React.createElement('div',{style:cs.grid4},
        React.createElement('div',{style:{...cs.hcard,borderColor:'rgba(45,102,18,.15)',background:'var(--green-bg)'}},
          React.createElement('div',{style:{...cs.hcardLabel,color:'var(--green)'}}, '全部完成'),
          React.createElement('div',{style:{...cs.hcardVal,color:'var(--green)'}}, `${allDone}/${total}`),
          React.createElement('div',{style:cs.hcardSub}, `${total-allDone} 人未完成全部 4 sections`),
        ),
        React.createElement('div',{style:{...cs.hcard,borderColor:'rgba(58,49,133,.15)',background:'var(--purple-bg)'}},
          React.createElement('div',{style:{...cs.hcardLabel,color:'var(--purple)'}}, '全 Perfect'),
          React.createElement('div',{style:{...cs.hcardVal,color:'var(--purple)'}}, perfectAll),
          React.createElement('div',{style:cs.hcardSub}, '4/4 sections 零误选'),
        ),
        React.createElement('div',{style:cs.hcard},
          React.createElement('div',{style:cs.hcardLabel}, 'Evidence 命中率'),
          React.createElement('div',{style:cs.hcardVal}, `${Math.round(totalHit/totalEv*100)}%`),
          React.createElement('div',{style:cs.hcardSub}, `${totalHit}/${totalEv} signals found · ${totalWrong} 误选`),
        ),
        React.createElement('div',{style:{...cs.hcard,borderColor:'rgba(148,41,41,.15)',background:funcWrongCount>0?'var(--red-bg)':'var(--surface)'}},
          React.createElement('div',{style:{...cs.hcardLabel,color:funcWrongCount>0?'var(--red)':'var(--t3)'}}, 'Function 选错'),
          React.createElement('div',{style:cs.hcardVal}, funcWrongCount),
          React.createElement('div',{style:cs.hcardSub}, `${MISCONCEPTIONS.filter(m=>m.severity==='high').length} 个高频误解`),
        ),
      ),

      /* Per-section breakdown */
      React.createElement('div',{style:cs.sectionH},
        React.createElement('span',null,'按 Section 统计'),
        React.createElement('div',{style:cs.sectionLine}),
      ),
      React.createElement('div',{style:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20}},
        SECTIONS.map(sec=>{
          const data = STUDENTS.map(s=>s.sections[sec.id]);
          const funcRight = data.filter(d=>d.funcCorrect).length;
          const perfectCount = data.filter(d=>d.perfect).length;
          const avgHit = data.reduce((a,d)=>a+d.evidenceHit,0);
          const avgTotal = data.reduce((a,d)=>a+d.evidenceTotal,0);
          return React.createElement('div',{key:sec.id,style:{...cs.hcard}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:6,marginBottom:8}},
              React.createElement('span',{style:{fontSize:10,fontWeight:700,color:'var(--teal)',background:'var(--teal-bg)',padding:'2px 6px',borderRadius:3}}, sec.label),
              React.createElement('span',{style:{fontSize:12,fontWeight:700}}, sec.func),
              React.createElement('span',{style:{fontSize:10,color:'var(--t3)'}}, sec.funcZh),
            ),
            React.createElement('div',{style:{fontSize:11,color:'var(--t2)',lineHeight:1.8}},
              React.createElement('div',null, `Function 正确: `, React.createElement('strong',null,`${funcRight}/${total}`)),
              React.createElement('div',null, `Evidence 命中: `, React.createElement('strong',null,`${avgHit}/${avgTotal}`), ` (${Math.round(avgHit/avgTotal*100)}%)`),
              React.createElement('div',null, `Perfect: `, React.createElement('strong',{style:{color:'var(--green)'}},perfectCount)),
            ),
            React.createElement('div',{style:{marginTop:8,height:6,background:'var(--surface2)',borderRadius:3,overflow:'hidden'}},
              React.createElement('div',{style:{width:`${avgHit/avgTotal*100}%`,height:'100%',borderRadius:3,background:avgHit/avgTotal>.8?'var(--green)':avgHit/avgTotal>.5?'var(--blue)':'var(--amber)'}}),
            ),
          );
        }),
      ),

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
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 70px repeat(4,1fr) 60px',gap:6,padding:'8px 14px',fontSize:9,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'1px solid var(--border)'}},
          React.createElement('span',null,'学生'),
          React.createElement('span',null,'用时'),
          ...SECTIONS.map(sec=>React.createElement('span',{key:sec.id},sec.label)),
          React.createElement('span',null,'完成'),
        ),
        STUDENTS.map(s=>{
          return React.createElement('div',{key:s.id,onClick:()=>onSelectStudent(s),
            style:{display:'grid',gridTemplateColumns:'1fr 70px repeat(4,1fr) 60px',gap:6,padding:'8px 14px',fontSize:11,alignItems:'center',cursor:'pointer',borderBottom:'1px solid var(--border)',transition:'background .1s'},
            onMouseEnter:e=>e.currentTarget.style.background='var(--surface2)',
            onMouseLeave:e=>e.currentTarget.style.background='transparent',
          },
            React.createElement('span',{style:{fontWeight:600}},s.name),
            React.createElement('span',{style:{color:'var(--t2)',fontSize:10}},formatTime(s.time)),
            ...SECTIONS.map(sec=>{
              const d = s.sections[sec.id];
              const bg = d.perfect?'var(--green-bg)':d.funcCorrect&&d.evidenceHit>0?'var(--blue-bg)':d.func===null?'var(--surface2)':'var(--amber-bg)';
              const color = d.perfect?'var(--green)':d.funcCorrect&&d.evidenceHit>0?'var(--blue)':d.func===null?'var(--t3)':'var(--amber)';
              return React.createElement('span',{key:sec.id,style:{fontSize:9,fontWeight:600,padding:'3px 6px',borderRadius:3,background:bg,color:color,textAlign:'center'}},
                d.perfect?'✓ Perfect':d.func===null?'—':`${d.evidenceHit}/${d.evidenceTotal}${d.wrongPicks>0?' ✕'+d.wrongPicks:''}`
              );
            }),
            React.createElement('span',{style:{fontSize:10,fontWeight:600,color:s.completed===4?'var(--green)':'var(--amber)'}}, `${s.completed}/4`),
          );
        }),
      ),
    ),
  );
}

/* ═══ STUDENT VIEW ═══ */
function StudentView({student,onBack}) {
  const s = student;

  const totalHit = Object.values(s.sections).reduce((a,sec)=>a+sec.evidenceHit,0);
  const totalEv = Object.values(s.sections).reduce((a,sec)=>a+sec.evidenceTotal,0);
  const totalWrong = Object.values(s.sections).reduce((a,sec)=>a+sec.wrongPicks,0);
  const perfectCount = Object.values(s.sections).filter(sec=>sec.perfect).length;

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
    statGrid:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16},
    stat:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',textAlign:'center'},
    statN:{fontSize:18,fontWeight:700,lineHeight:1},
    statL:{fontSize:8,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.3px',marginTop:3},
    secCard:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8},
    kiCard:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8},
    kiTitle:{fontSize:10,fontWeight:700,color:'var(--t1)',marginBottom:6},
    kiItem:{fontSize:11,color:'var(--t2)',lineHeight:1.6,padding:'3px 0',display:'flex',gap:6},
    kiBullet:{color:'var(--t3)',flexShrink:0},
  };

  return React.createElement('div',{style:sv.wrap},
    React.createElement('div',{style:sv.header},
      React.createElement('button',{style:sv.backBtn,onClick:onBack},'← 返回班级'),
      React.createElement('div',{style:sv.avatar}, s.name[0]),
      React.createElement('div',{style:{flex:1}},
        React.createElement('div',{style:{fontSize:15,fontWeight:600}}, s.name),
        React.createElement('div',{style:{fontSize:11,color:'var(--t3)',marginTop:2}}, 'Skim · Select Evidence'),
      ),
      React.createElement('span',{style:{fontSize:10,fontWeight:600,padding:'3px 10px',borderRadius:4,background:s.completed===4?'var(--green-bg)':'var(--amber-bg)',color:s.completed===4?'var(--green)':'var(--amber)'}},
        s.completed===4?`✓ 全部完成`:`${s.completed}/4 完成`),
    ),

    React.createElement('div',{style:sv.body},
      /* Left: Stats + Per-section detail */
      React.createElement('div',{style:sv.col},
        React.createElement('div',{style:sv.statGrid},
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:sv.statN}, `${s.completed}/4`),
            React.createElement('div',{style:sv.statL}, 'Sections'),
          ),
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:{...sv.statN,color:perfectCount>=3?'var(--green)':perfectCount>=1?'var(--blue)':'var(--amber)'}}, perfectCount),
            React.createElement('div',{style:sv.statL}, 'Perfect'),
          ),
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:sv.statN}, `${totalHit}/${totalEv}`),
            React.createElement('div',{style:sv.statL}, 'Evidence Hit'),
          ),
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:{...sv.statN,color:totalWrong>0?'var(--red)':'var(--green)'}}, totalWrong),
            React.createElement('div',{style:sv.statL}, '误选'),
          ),
        ),

        /* Per-section detail */
        React.createElement('div',{style:{...sv.sectionH,marginTop:0}},
          React.createElement('span',null,'逐 Section 详情'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        SECTIONS.map(sec=>{
          const d = s.sections[sec.id];
          const borderColor = d.perfect?'rgba(45,102,18,.2)':d.funcCorrect&&d.evidenceHit>0?'rgba(26,95,160,.15)':'rgba(122,77,14,.15)';
          const bg = d.perfect?'rgba(45,102,18,.03)':d.func===null?'var(--surface)':'transparent';
          return React.createElement('div',{key:sec.id,style:{...sv.secCard,borderColor,background:bg}},
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:8}},
              React.createElement('span',{style:{fontSize:10,fontWeight:700,color:'var(--teal)',background:'var(--teal-bg)',padding:'2px 6px',borderRadius:3}}, sec.label),
              React.createElement('span',{style:{fontSize:12,fontWeight:700}}, sec.func),
              d.perfect && React.createElement('span',{style:{fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:3,background:'var(--green-bg)',color:'var(--green)',marginLeft:'auto'}}, '✓ Perfect'),
              !d.perfect && d.func && React.createElement('span',{style:{marginLeft:'auto',fontSize:9,color:'var(--t3)'}}, `${d.evidenceHit}/${d.evidenceTotal} signals`),
            ),
            /* Function choice */
            React.createElement('div',{style:{fontSize:11,color:'var(--t2)',lineHeight:1.7}},
              d.func===null
                ? React.createElement('span',{style:{color:'var(--t3)',fontStyle:'italic'}}, '未开始')
                : React.createElement(Fragment,null,
                    React.createElement('div',null,
                      'Function: ',
                      React.createElement('strong',{style:{color:d.funcCorrect?'var(--green)':'var(--red)'}}, d.func),
                      !d.funcCorrect && React.createElement('span',{style:{color:'var(--red)',fontSize:10}}, ` ✕ (正确: ${sec.func})`),
                      d.attempts>1 && React.createElement('span',{style:{color:'var(--amber)',fontSize:10,marginLeft:6}}, `${d.attempts}次尝试`),
                    ),
                    React.createElement('div',{style:{marginTop:4}},
                      `Evidence: ${d.evidenceHit}/${d.evidenceTotal}`,
                      d.wrongPicks>0 && React.createElement('span',{style:{color:'var(--red)',marginLeft:6}}, `+ ${d.wrongPicks} 误选`),
                    ),
                    /* Wrong picks */
                    d.wrongDetails && d.wrongDetails.length>0 && React.createElement('div',{style:{marginTop:6,padding:'6px 10px',background:'var(--red-bg)',borderRadius:6,fontSize:10,color:'var(--red)',lineHeight:1.6}},
                      React.createElement('strong',null,'误选: '),
                      d.wrongDetails.join(' · '),
                    ),
                    /* Missed */
                    d.missed && d.missed.length>0 && React.createElement('div',{style:{marginTop:4,padding:'6px 10px',background:'var(--amber-bg)',borderRadius:6,fontSize:10,color:'var(--amber)',lineHeight:1.6}},
                      React.createElement('strong',null,'漏选: '),
                      d.missed.join(' · '),
                    ),
                  ),
            ),
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
              React.createElement('span',{style:sv.kiBullet}, '·'),
              React.createElement('span',null, insight),
            )
          ),
        ),

        /* Status card */
        React.createElement('div',{style:{...sv.kiCard,background:perfectCount>=3?'var(--green-bg)':perfectCount>=1?'var(--blue-bg)':'var(--amber-bg)',borderColor:perfectCount>=3?'rgba(45,102,18,.15)':perfectCount>=1?'rgba(26,95,160,.15)':'rgba(122,77,14,.15)'}},
          React.createElement('div',{style:{...sv.kiTitle,color:perfectCount>=3?'var(--green)':perfectCount>=1?'var(--blue)':'var(--amber)'}},
            perfectCount>=3?'表现优秀':perfectCount>=1?'部分掌握':'需重点关注'),
          React.createElement('div',{style:{fontSize:11,color:'var(--t2)',lineHeight:1.6}},
            `完成 ${s.completed}/4 sections，${perfectCount} 个 perfect。Evidence 命中 ${totalHit}/${totalEv}，误选 ${totalWrong} 次。`),
        ),

        /* Evidence hit bar chart per section */
        React.createElement('div',{style:{...sv.sectionH,marginTop:20}},
          React.createElement('span',null,'Evidence 命中对比'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        React.createElement('div',{style:sv.kiCard},
          SECTIONS.map(sec=>{
            const d = s.sections[sec.id];
            const pct = d.evidenceTotal>0 ? d.evidenceHit/d.evidenceTotal*100 : 0;
            return React.createElement('div',{key:sec.id,style:{display:'flex',alignItems:'center',gap:8,marginBottom:8}},
              React.createElement('span',{style:{fontSize:10,fontWeight:600,color:'var(--t2)',width:32,flexShrink:0}}, sec.label),
              React.createElement('div',{style:{flex:1,height:14,background:'var(--surface2)',borderRadius:3,overflow:'hidden',position:'relative'}},
                React.createElement('div',{style:{height:'100%',width:`${pct}%`,borderRadius:3,background:d.perfect?'var(--green)':pct>60?'var(--blue)':'var(--amber)'}}),
                d.wrongPicks>0 && React.createElement('div',{style:{position:'absolute',right:4,top:'50%',transform:'translateY(-50%)',fontSize:8,fontWeight:700,color:'var(--red)'}}, `✕${d.wrongPicks}`),
              ),
              React.createElement('span',{style:{fontSize:9,fontWeight:600,color:'var(--t2)',width:32}}, `${d.evidenceHit}/${d.evidenceTotal}`),
            );
          }),
        ),

        /* Class comparison */
        React.createElement('div',{style:{...sv.sectionH,marginTop:20}},
          React.createElement('span',null,'班级对比'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        React.createElement('div',{style:sv.kiCard},
          [{label:'命中率',val:Math.round(totalHit/totalEv*100),avg:Math.round(STUDENTS.reduce((a,st)=>a+Object.values(st.sections).reduce((b,sec)=>b+sec.evidenceHit,0),0)/(STUDENTS.reduce((a,st)=>a+Object.values(st.sections).reduce((b,sec)=>b+sec.evidenceTotal,0),0))*100),max:100,unit:'%'},
           {label:'Perfect',val:perfectCount,avg:+(STUDENTS.reduce((a,st)=>a+Object.values(st.sections).filter(sec=>sec.perfect).length,0)/total).toFixed(1),max:4,unit:''},
           {label:'误选',val:totalWrong,avg:+(STUDENTS.reduce((a,st)=>a+Object.values(st.sections).reduce((b,sec)=>b+sec.wrongPicks,0),0)/total).toFixed(1),max:10,unit:'',invert:true},
           {label:'用时',val:s.time,avg:Math.round(STUDENTS.reduce((a,st)=>a+st.time,0)/total),max:360,unit:'s',format:formatTime,invert:true},
          ].map((row,i)=>
            React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:8,marginBottom:8}},
              React.createElement('span',{style:{fontSize:10,color:'var(--t3)',width:50,flexShrink:0}}, row.label),
              React.createElement('div',{style:{flex:1,height:14,background:'var(--surface2)',borderRadius:3,position:'relative',overflow:'visible'}},
                React.createElement('div',{style:{position:'absolute',left:`${row.avg/row.max*100}%`,top:-2,width:2,height:18,background:'rgba(28,28,26,.14)',borderRadius:1,zIndex:1}}),
                React.createElement('div',{style:{height:'100%',width:`${row.val/row.max*100}%`,borderRadius:3,background:(row.invert?(row.val<row.avg):(row.val>row.avg))?'var(--green)':'var(--amber)',opacity:0.7}}),
              ),
              React.createElement('span',{style:{fontSize:10,fontWeight:600,color:'var(--t1)',width:40,textAlign:'right'}}, row.format?row.format(row.val):`${row.val}${row.unit}`),
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
function EvTimelineScrubber({elapsed,total,onSeek,isLive,onToggleLive}) {
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
function EvidenceObserveApp() {
  const [view,setView] = useState('class');
  const [selectedStudent,setSelectedStudent] = useState(null);
  const STEP_TOTAL = 360;
  const [elapsed,setElapsed] = useState(320);
  const [isLive,setIsLive] = useState(true);
  const handleSeek=(t)=>{setElapsed(t);setIsLive(false);};
  const handleToggleLive=()=>{if(!isLive){setElapsed(320);setIsLive(true);}};
  const selectStudent=(s)=>{if(!s)return;setSelectedStudent(s);setView('student');};

  return React.createElement('div',{style:S.shell},
    React.createElement('div',{style:S.band},
      React.createElement('div',{style:S.bandMark},'E'),
      React.createElement('div',{style:S.bandTitle},'Select Evidence 观察'),
      React.createElement('div',{style:S.bandTag},'Skim · Practice 2'),
      React.createElement('div',{style:S.bandMeta},`高一(3)班 · ${STUDENTS.filter(s=>s.completed===4).length}/${STUDENTS.length} 人已完成`),
      React.createElement('div',{style:S.bandRight},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,color:'var(--green)'}},
          React.createElement('span',{style:{width:6,height:6,borderRadius:'50%',background:'var(--green)'}}),
          '实时',
        ),
      ),
    ),
    React.createElement(EvTimelineScrubber,{elapsed,total:STEP_TOTAL,onSeek:handleSeek,isLive,onToggleLive:handleToggleLive}),
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

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(EvidenceObserveApp));
