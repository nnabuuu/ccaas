const {useState, useCallback, useRef, useEffect, Fragment, useMemo} = React;

/* ═══════════════════════════════════════════════════════════
   MAP IT OBSERVATION — Teacher Console
   Observe student placements on the 2D coordinate plane
   Class Overview + Individual Student Deep-dive
   ═══════════════════════════════════════════════════════════ */

/* ─── AXIS CONFIG (matches student side) ─── */
const AXIS = {
  x:{neg:'Just appearance',pos:'Cultural meaning',label:'Why is it done?'},
  y:{neg:'Temporary',pos:'Permanent',label:'How lasting is it?'},
};
const ITEMS = [
  {id:'kohl',  label:'Egyptian kohl'},
  {id:'plump', label:'1600s plump & pale'},
  {id:'borneo',label:'Borneo tattoos'},
  {id:'maori', label:'Maori tā moko'},
  {id:'rings', label:'Myanmar neck rings'},
  {id:'teeth', label:'Indonesia teeth'},
  {id:'media', label:'Modern media slim'},
];
const EXPECTED = {
  kohl:[.55,-.2], plump:[-.4,-.5], borneo:[.7,.85],
  maori:[.85,.9], rings:[.55,.55], teeth:[.6,.8], media:[-.7,-.7],
};

/* ─── MOCK STUDENT DATA ─── */
const STUDENTS = [
  {id:1,name:'王译文',placed:7,reasoned:7,time:285,submitted:true,
   placements:{kohl:[.5,-.3],plump:[-.5,-.6],borneo:[.65,.9],maori:[.8,.85],rings:[.6,.5],teeth:[.55,.75],media:[-.65,-.65]},
   reasons:{kohl:'¶3 says kohl had "protective and spiritual meaning", so it goes slightly towards cultural meaning, but it was temporary — painted on daily.',plump:'¶4: being pale showed wealth ("only the poor had to work outdoors"). It\'s about appearance/status, not deep culture, and it changed with fashion.',borneo:'¶5: tattoos are "a diary of important events" — deeply personal cultural meaning and permanent on skin.',maori:'¶6: tā moko shows "position in society: family, achievements, and rank" — the deepest cultural meaning, permanent.',rings:'¶7: neck rings are cultural but I\'m not sure how permanent — you can\'t really remove them though.',teeth:'¶7: teeth sharpening is "cultural identity" — permanent and culturally meaningful.',media:'¶2: "shallow beauty ideals" — temporary trends from magazines, no cultural depth.'},
   accuracy:.88,keyInsights:['准确区分了cultural meaning vs appearance','对kohl的temporal维度判断精确','整体布局与参考高度一致']},
  {id:2,name:'黄婉晴',placed:7,reasoned:5,time:340,submitted:true,
   placements:{kohl:[.3,-.1],plump:[-.2,-.3],borneo:[.4,.6],maori:[.5,.7],rings:[.3,.4],teeth:[.4,.5],media:[-.5,-.5]},
   reasons:{kohl:'Kohl is used in Egypt for eyes.',plump:'People in 1600s liked being plump.',borneo:'Borneo people have tattoos that are important.',maori:'Maori tattoos show family history.',rings:'',teeth:'',media:'Media shows slim models.'},
   accuracy:.52,keyInsights:['所有placement都偏向中间——缺乏信心做极端判断','reasoning浅层，缺少课文引用','5/7有reasoning但质量不足']},
  {id:3,name:'徐晨曦',placed:5,reasoned:3,time:360,submitted:false,
   placements:{kohl:[0,0],plump:[-.1,-.1],borneo:[.2,.3],maori:[.3,.4],rings:[.1,.2]},
   reasons:{kohl:'I don\'t know where to put this.',plump:'Plump is old fashion.',borneo:'Tattoos are permanent.'},
   accuracy:.31,keyInsights:['只放了5/7个items','几乎所有都在原点附近——没有理解axes含义','未提交，时间用完']},
  {id:4,name:'陈昕妍',placed:7,reasoned:7,time:198,submitted:true,
   placements:{kohl:[.6,-.15],plump:[-.45,-.55],borneo:[.75,.88],maori:[.9,.92],rings:[.5,.6],teeth:[.65,.82],media:[-.75,-.72]},
   reasons:{kohl:'¶3: kohl had "protective and spiritual meaning" — cultural but temporary (painted daily). X-axis: cultural meaning. Y-axis: temporary.',plump:'¶4: pale skin = sign of wealth, but it\'s about social appearance, not deep identity. Changed with era → temporary.',borneo:'¶5: "diary of important events" — extremely personal cultural meaning, permanently inked on skin.',maori:'¶6: shows "position in society: family, achievements, and rank" — the most culturally encoded, permanent by nature.',rings:'¶7: cultural practice in Myanmar, semi-permanent — can\'t easily remove rings. Cultural but perhaps less encoded than tattoos.',teeth:'¶7: "cultural identity" — the text literally says so. Permanent body modification.',media:'¶2: "shallow beauty ideals" — no cultural depth, changes with magazine covers. Most temporary and least meaningful.'},
   accuracy:.95,keyInsights:['最高准确度——几乎完美匹配参考位置','每个reasoning都引用了段落号','完成速度最快(3:18)']},
  {id:5,name:'李奕辰',placed:7,reasoned:7,time:255,submitted:true,
   placements:{kohl:[.4,-.4],plump:[-.3,-.4],borneo:[.6,.8],maori:[.7,.85],rings:[.45,.5],teeth:[.5,.7],media:[-.6,-.6]},
   reasons:{kohl:'Ancient Egypt used kohl for spiritual protection (¶3). Cultural meaning but temporary.',plump:'¶4 fashion trend — about looking wealthy, not deep identity. Temporary.',borneo:'¶5: permanent tattoos recording life events. Cultural diary.',maori:'¶6: tā moko encodes family and rank. Very permanent and cultural.',rings:'¶7: Myanmar cultural practice. Hard to remove.',teeth:'¶7: cultural identity. Permanent change.',media:'¶2: shallow, temporary. Magazine trends.'},
   accuracy:.78,keyInsights:['整体准确，但x轴偏保守','reasoning简洁但有引用','用中英混合回答']},
  {id:6,name:'郭斐然',placed:7,reasoned:4,time:350,submitted:true,
   placements:{kohl:[.2,.3],plump:[.1,-.2],borneo:[.3,.5],maori:[.4,.6],rings:[.6,.7],teeth:[.3,.4],media:[-.3,-.2]},
   reasons:{kohl:'Kohl is from Egypt.',plump:'',borneo:'Tattoos are about events.',maori:'Maori have tattoos for family.',rings:'Neck rings are very long — they keep adding more rings so it\'s permanent and cultural.',teeth:'',media:''},
   accuracy:.38,keyInsights:['对rings的判断异常偏高(x=.6)','plump被放在了cultural meaning侧——误解','只有4个有reasoning']},
  {id:7,name:'张皓月',placed:7,reasoned:7,time:230,submitted:true,
   placements:{kohl:[.5,-.25],plump:[-.35,-.45],borneo:[.7,.82],maori:[.82,.88],rings:[.5,.52],teeth:[.58,.78],media:[-.68,-.68]},
   reasons:{kohl:'Spiritual meaning but painted daily.',plump:'Fashion trend, not identity.',borneo:'Life diary, permanent ink.',maori:'Social rank encoded permanently.',rings:'Cultural, hard to remove.',teeth:'Cultural identity, permanent.',media:'Shallow, trend-based.'},
   accuracy:.85,keyInsights:['准确度高','reasoning简短但准确']},
  {id:8,name:'周航宇',placed:7,reasoned:6,time:270,submitted:true,
   placements:{kohl:[.45,-.2],plump:[-.4,-.5],borneo:[.65,.85],maori:[.8,.9],rings:[.5,.55],teeth:[.55,.75],media:[-.7,-.65]},
   reasons:{kohl:'¶3 protective spiritual meaning. Temporary.',plump:'¶4 social status display. Not permanent.',borneo:'¶5 diary of events. Permanent.',maori:'¶6 family rank. Most permanent.',rings:'¶7 cultural.',teeth:'¶7 cultural identity. Permanent.',media:'¶2 shallow. Temporary trends.'},
   accuracy:.82,keyInsights:['稳定准确','rings的reasoning最弱']},
  {id:9,name:'郑若曦',placed:7,reasoned:7,time:210,submitted:true,
   placements:{kohl:[.55,-.18],plump:[-.42,-.52],borneo:[.72,.86],maori:[.88,.91],rings:[.52,.58],teeth:[.62,.8],media:[-.72,-.7]},
   reasons:{kohl:'Spiritual + protective (¶3). Daily application = temporary.',plump:'Wealth signal (¶4). Fashion changes = temporary.',borneo:'Personal history diary (¶5). Ink = permanent.',maori:'Social position encoded (¶6). Most cultural + permanent.',rings:'Myanmar cultural (¶7). Semi-permanent.',teeth:'Cultural identity (¶7). Body modification = permanent.',media:'"Shallow beauty ideals" (¶2). Trend-based = temporary.'},
   accuracy:.92,keyInsights:['第二高准确度','所有reasoning都有段落引用','表达流畅']},
  {id:10,name:'邓梓涵',placed:6,reasoned:3,time:355,submitted:true,
   placements:{kohl:[.1,0],plump:[0,-.1],borneo:[.3,.4],maori:[.4,.5],rings:[.2,.3],teeth:[.3,.4]},
   reasons:{kohl:'Egypt eye paint.',plump:'Old fashion.',borneo:'Tattoos.'},
   accuracy:.28,keyInsights:['未放置media','所有placement极度偏中间','reasoning极短无实质']},
  {id:11,name:'董思齐',placed:4,reasoned:2,time:360,submitted:false,
   placements:{kohl:[0,.1],plump:[-.1,0],borneo:[.1,.2],maori:[.2,.3]},
   reasons:{kohl:'Ancient.',plump:'Old.'},
   accuracy:.15,keyInsights:['只放了4个items','完全卡住——axes理解困难','未提交']},
  {id:12,name:'冯璐',placed:7,reasoned:5,time:320,submitted:true,
   placements:{kohl:[.3,-.1],plump:[-.2,-.3],borneo:[.5,.7],maori:[.6,.75],rings:[.7,.8],teeth:[.2,.3],media:[-.4,-.4]},
   reasons:{kohl:'Eye paint in Egypt for spiritual reasons.',plump:'Fashion in 1600s Europe.',borneo:'Diary tattoos, permanent.',maori:'Family and rank tattoos.',rings:'Very permanent cultural practice.'},
   accuracy:.55,keyInsights:['rings放得偏高(x=.7)而teeth偏低(x=.2)——可能混淆了两者','media偏中间']},
  {id:13,name:'谢安然',placed:5,reasoned:2,time:358,submitted:false,
   placements:{kohl:[.1,-.1],plump:[0,0],borneo:[.2,.3],maori:[.3,.4],rings:[.1,.2]},
   reasons:{kohl:'Egypt.',borneo:'Tattoo diary.'},
   accuracy:.22,keyInsights:['语言障碍影响理解','只放5个items','几乎无reasoning']},
  {id:14,name:'马乐瑶',placed:7,reasoned:7,time:280,submitted:true,
   placements:{kohl:[.5,-.2],plump:[-.38,-.48],borneo:[.68,.84],maori:[.83,.88],rings:[.48,.52],teeth:[.58,.76],media:[-.66,-.66]},
   reasons:{kohl:'Protective and spiritual (¶3). Painted on = temporary.',plump:'Wealth sign (¶4). Era-specific = temporary.',borneo:'Life events diary (¶5). Permanent tattoo.',maori:'Social rank + family (¶6). Most encoded.',rings:'Myanmar cultural (¶7). Hard to remove.',teeth:'Cultural identity per ¶7. Permanent.',media:'Shallow ideals (¶2). Magazine-driven.'},
   accuracy:.84,keyInsights:['后半段加速完成','reasoning质量好']},
  {id:15,name:'林澜',placed:7,reasoned:6,time:265,submitted:true,
   placements:{kohl:[.45,-.25],plump:[-.35,-.42],borneo:[.62,.8],maori:[.78,.85],rings:[.48,.5],teeth:[.55,.72],media:[-.62,-.6]},
   reasons:{kohl:'Spiritual meaning, daily paint.',plump:'Social wealth signal, not permanent.',borneo:'Life diary, permanent ink.',maori:'Rank and family. Permanent.',rings:'Cultural. Semi-permanent.',teeth:'Identity. Permanent body change.'},
   accuracy:.76,keyInsights:['稳定准确','reasoning中等长度']},
  {id:16,name:'朱思语',placed:7,reasoned:7,time:175,submitted:true,
   placements:{kohl:[.58,-.2],plump:[-.42,-.52],borneo:[.72,.88],maori:[.88,.92],rings:[.55,.58],teeth:[.62,.82],media:[-.72,-.72]},
   reasons:{kohl:'¶3: "protective and spiritual meaning" — cultural but temporary (reapplied daily). Placed right-of-center on X, below center on Y.',plump:'¶4: pale = wealth. Social appearance not deep culture. Fashion era = temporary. Placed left on X, below on Y.',borneo:'¶5: "diary of important events" — strong cultural significance, permanently marked. Upper-right.',maori:'¶6: "position in society: family, achievements, and rank" — maximum cultural encoding, permanent. Furthest upper-right.',rings:'¶7: cultural practice, semi-permanent (can\'t easily remove). Mid-right, mid-upper.',teeth:'¶7: "cultural identity" — direct cultural signal. Permanent body modification. Right, upper.',media:'¶2: "shallow beauty ideals" — lowest cultural meaning, most transient. Lower-left.'},
   accuracy:.94,keyInsights:['几乎完美','速度最快(2:55)','reasoning极其详细，包含坐标说明']},
];

/* Placement clustering / misconceptions */
const MISCONCEPTIONS = [
  {id:1, label:'所有items堆在中间 (0±0.3)', count:4, students:['黄婉晴','徐晨曦','邓梓涵','董思齐'], severity:'high'},
  {id:2, label:'rings与teeth混淆/互换', count:3, students:['郭斐然','冯璐','黄婉晴'], severity:'medium'},
  {id:3, label:'plump放在cultural meaning侧', count:2, students:['郭斐然','徐晨曦'], severity:'medium'},
  {id:4, label:'media偏中间(不够extreme)', count:3, students:['黄婉晴','郭斐然','冯璐'], severity:'low'},
];

function formatTime(s) { const m=Math.floor(s/60),ss=s%60; return `${m}:${ss<10?'0':''}${ss}`; }

/* Euclidean distance between student placement and expected */
function dist(a, b) { return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2); }

/* ─── STYLES ─── */
const S = {
  shell: {display:'flex',flexDirection:'column',height:'100vh'},
  band: {display:'flex',alignItems:'center',gap:12,padding:'0 20px',height:44,background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  bandMark: {width:22,height:22,borderRadius:6,background:'var(--t1)',color:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700},
  bandTitle: {fontSize:13,fontWeight:600,letterSpacing:'-.1px'},
  bandTag: {fontSize:10,fontWeight:600,color:'var(--teal)',background:'var(--teal-bg)',padding:'2px 8px',borderRadius:3,letterSpacing:'.3px'},
  bandMeta: {fontSize:12,color:'var(--t2)',paddingLeft:12,borderLeft:'1px solid var(--border-strong)',marginLeft:2},
  bandRight: {marginLeft:'auto',display:'flex',alignItems:'center',gap:12},
  tabs: {display:'flex',gap:0,padding:'0 20px',background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  tab: {padding:'10px 18px',fontSize:12,fontWeight:500,color:'var(--t3)',cursor:'pointer',borderBottom:'2px solid transparent',background:'none',border:'none',borderBottomWidth:2,borderBottomStyle:'solid',borderBottomColor:'transparent',fontFamily:'inherit',transition:'all .12s'},
  tabActive: {color:'var(--t1)',fontWeight:600,borderBottomColor:'var(--t1)'},
  main: {flex:1,overflow:'hidden',display:'flex'},
};

/* ═══ MINI PLANE (for class heatmap & student detail) ═══ */
function MiniPlane({size, placements, expected, activeItem, highlightStudents, showExpected}) {
  const s = size || 280;
  const toPct = (n) => ((n+1)/2)*100;
  return React.createElement('div', {style:{width:s,height:s,position:'relative',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,flexShrink:0,overflow:'hidden'}},
    /* grid */
    [1,2,3].map(i=> React.createElement(Fragment,{key:'g'+i},
      React.createElement('div',{style:{position:'absolute',left:`${i*25}%`,top:0,bottom:0,width:1,background:'var(--border)',pointerEvents:'none'}}),
      React.createElement('div',{style:{position:'absolute',top:`${i*25}%`,left:0,right:0,height:1,background:'var(--border)',pointerEvents:'none'}}),
    )),
    React.createElement('div',{style:{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'rgba(28,28,26,.14)',pointerEvents:'none'}}),
    React.createElement('div',{style:{position:'absolute',top:'50%',left:0,right:0,height:1,background:'rgba(28,28,26,.14)',pointerEvents:'none'}}),
    /* axis labels */
    React.createElement('div',{style:{position:'absolute',top:4,left:'50%',transform:'translateX(-50%)',fontSize:8,fontWeight:600,color:'var(--t3)'}},AXIS.y.pos+' ↑'),
    React.createElement('div',{style:{position:'absolute',bottom:4,left:'50%',transform:'translateX(-50%)',fontSize:8,fontWeight:600,color:'var(--t3)'}},AXIS.y.neg+' ↓'),
    React.createElement('div',{style:{position:'absolute',left:4,top:'50%',transform:'translateY(-50%)',fontSize:8,fontWeight:600,color:'var(--t3)'}}, '← '+AXIS.x.neg),
    React.createElement('div',{style:{position:'absolute',right:4,top:'50%',transform:'translateY(-50%)',fontSize:8,fontWeight:600,color:'var(--t3)'}}, AXIS.x.pos+' →'),
    /* expected zones */
    showExpected && Object.entries(expected||EXPECTED).map(([id,[x,y]]) =>
      React.createElement('div',{key:'e'+id, style:{position:'absolute',left:`${toPct(x)}%`,top:`${toPct(-y)}%`,transform:'translate(-50%,-50%)',width:28,height:28,borderRadius:'50%',background:'radial-gradient(circle,rgba(122,77,14,.2) 0%,rgba(122,77,14,0) 70%)',pointerEvents:'none'}},
        React.createElement('div',{style:{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:7,fontWeight:700,color:'var(--amber)'}}, ITEMS.find(it=>it.id===id)?.label.slice(0,3)),
      )
    ),
    /* student placements */
    (placements||[]).map((p,i) => {
      const isActive = activeItem ? p.itemId === activeItem : true;
      const isHighlight = highlightStudents ? highlightStudents.includes(p.studentName) : true;
      return React.createElement('div',{key:i, style:{position:'absolute',left:`${toPct(p.x)}%`,top:`${toPct(-p.y)}%`,transform:'translate(-50%,-50%)',width:8,height:8,borderRadius:'50%',background: p.color||'var(--purple)',opacity: (isActive&&isHighlight)?1:0.15,transition:'opacity .2s',zIndex:isActive?2:1}},
        p.label && React.createElement('div',{style:{position:'absolute',top:-14,left:'50%',transform:'translateX(-50%)',fontSize:7,fontWeight:600,color:'var(--t2)',whiteSpace:'nowrap',opacity: (isActive&&isHighlight)?1:0}},p.label)
      );
    }),
  );
}

/* ═══ CLASS VIEW ═══ */
function ClassView({onSelectStudent}) {
  const total = STUDENTS.length;
  const submitted = STUDENTS.filter(s=>s.submitted).length;
  const notSubmitted = total - submitted;
  const allPlaced = STUDENTS.filter(s=>s.placed===7).length;
  const allReasoned = STUDENTS.filter(s=>s.reasoned===7).length;
  const avgAccuracy = (STUDENTS.reduce((a,s)=>a+s.accuracy,0)/total*100).toFixed(0);
  const avgTime = Math.round(STUDENTS.reduce((a,s)=>a+s.time,0)/total);
  const [heatmapItem, setHeatmapItem] = useState(null);
  const [expandedMiscon, setExpandedMiscon] = useState(null);

  /* Build all-student placements for heatmap */
  const allPlacements = useMemo(()=>{
    const out = [];
    STUDENTS.forEach(s=>{
      Object.entries(s.placements).forEach(([itemId,[x,y]])=>{
        const good = s.accuracy > .7;
        out.push({x,y,itemId,studentName:s.name,color: good?'var(--green)':s.accuracy>.4?'var(--blue)':'var(--red)',label:s.name[0]});
      });
    });
    return out;
  },[]);

  const cs = {
    wrap: {flex:1,overflowY:'auto',padding:'20px 24px 40px'},
    inner: {maxWidth:960,margin:'0 auto'},
    grid4: {display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:20},
    hcard: {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'12px 14px'},
    hcardLabel: {fontSize:9,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:4},
    hcardVal: {fontSize:24,fontWeight:700,letterSpacing:'-.5px',lineHeight:1},
    hcardSub: {fontSize:10,color:'var(--t2)',marginTop:4,lineHeight:1.4},
    sectionH: {fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10,marginTop:20,display:'flex',alignItems:'center',gap:8},
    sectionLine: {flex:1,height:1,background:'var(--border)'},
    dot: {width:8,height:8,borderRadius:'50%',flexShrink:0},
    chipSmall: {fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:3,display:'inline-flex',alignItems:'center',gap:3},
    misconCard: {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8,cursor:'pointer',transition:'all .12s'},
    misconHigh: {borderColor:'rgba(148,41,41,.2)',background:'rgba(148,41,41,.03)'},
    misconMed: {borderColor:'rgba(196,138,30,.2)',background:'rgba(196,138,30,.03)'},
  };

  return React.createElement('div',{style:cs.wrap},
    React.createElement('div',{style:cs.inner},

      /* Health Cards */
      React.createElement('div',{style:cs.grid4},
        React.createElement('div',{style:{...cs.hcard,borderColor:'rgba(45,102,18,.15)',background:'var(--green-bg)'}},
          React.createElement('div',{style:{...cs.hcardLabel,color:'var(--green)'}}, '已提交'),
          React.createElement('div',{style:{...cs.hcardVal,color:'var(--green)'}}, `${submitted}/${total}`),
          React.createElement('div',{style:cs.hcardSub}, `${notSubmitted} 人未提交`),
        ),
        React.createElement('div',{style:cs.hcard},
          React.createElement('div',{style:cs.hcardLabel}, '全部放置'),
          React.createElement('div',{style:cs.hcardVal}, `${allPlaced}/${total}`),
          React.createElement('div',{style:cs.hcardSub}, `7/7 items placed`),
        ),
        React.createElement('div',{style:cs.hcard},
          React.createElement('div',{style:cs.hcardLabel}, '平均准确度'),
          React.createElement('div',{style:{...cs.hcardVal,color: avgAccuracy>70?'var(--green)':avgAccuracy>40?'var(--blue)':'var(--amber)'}}, `${avgAccuracy}%`),
          React.createElement('div',{style:cs.hcardSub}, `vs 参考位置`),
        ),
        React.createElement('div',{style:{...cs.hcard,borderColor:'rgba(148,41,41,.15)',background:notSubmitted>0?'var(--red-bg)':'var(--surface)'}},
          React.createElement('div',{style:{...cs.hcardLabel,color: notSubmitted>0?'var(--red)':'var(--t3)'}}, '误解聚类'),
          React.createElement('div',{style:cs.hcardVal}, MISCONCEPTIONS.length),
          React.createElement('div',{style:cs.hcardSub}, `高频 ${MISCONCEPTIONS.filter(m=>m.severity==='high').length} 个`),
        ),
      ),

      /* Class Heatmap */
      React.createElement('div',{style:cs.sectionH},
        React.createElement('span',null,'班级热力图'),
        React.createElement('div',{style:cs.sectionLine}),
      ),
      React.createElement('div',{style:{display:'flex',gap:20,marginBottom:20}},
        React.createElement(MiniPlane,{size:340,placements:allPlacements,activeItem:heatmapItem,showExpected:true}),
        React.createElement('div',{style:{flex:1,display:'flex',flexDirection:'column',gap:6}},
          React.createElement('div',{style:{fontSize:11,fontWeight:600,color:'var(--t2)',marginBottom:4}}, '按 item 筛选'),
          React.createElement('div',{style:{display:'flex',flexWrap:'wrap',gap:4}},
            React.createElement('button',{onClick:()=>setHeatmapItem(null),style:{fontSize:10,fontWeight:600,padding:'4px 10px',borderRadius:4,background:heatmapItem===null?'var(--t1)':'var(--surface2)',color:heatmapItem===null?'var(--surface)':'var(--t2)',border:'none',cursor:'pointer',fontFamily:'inherit'}},'All'),
            ITEMS.map(it=>
              React.createElement('button',{key:it.id,onClick:()=>setHeatmapItem(heatmapItem===it.id?null:it.id),style:{fontSize:10,fontWeight:500,padding:'4px 10px',borderRadius:4,background:heatmapItem===it.id?'var(--purple)':'var(--surface2)',color:heatmapItem===it.id?'#fff':'var(--t2)',border:'none',cursor:'pointer',fontFamily:'inherit'}},it.label)
            ),
          ),
          React.createElement('div',{style:{fontSize:10,color:'var(--t3)',marginTop:8,lineHeight:1.5}},
            '每个点代表一个学生对该item的放置位置。',
            React.createElement('br'),
            React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:4}}, React.createElement('span',{style:{...cs.dot,background:'var(--green)',width:6,height:6}}), '准确度>70%'),
            ' · ',
            React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:4}}, React.createElement('span',{style:{...cs.dot,background:'var(--blue)',width:6,height:6}}), '40-70%'),
            ' · ',
            React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:4}}, React.createElement('span',{style:{...cs.dot,background:'var(--red)',width:6,height:6}}), '<40%'),
            ' · ',
            React.createElement('span',{style:{display:'inline-flex',alignItems:'center',gap:4}}, React.createElement('span',{style:{width:10,height:10,borderRadius:'50%',background:'radial-gradient(circle,rgba(122,77,14,.3),transparent)',display:'inline-block'}}), '参考位置'),
          ),
          /* Per-item spread summary */
          React.createElement('div',{style:{marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}},
            ITEMS.map(it=>{
              const ps = STUDENTS.filter(s=>s.placements[it.id]).map(s=>s.placements[it.id]);
              const avgDist = ps.length ? (ps.reduce((a,p)=>a+dist(p,EXPECTED[it.id]),0)/ps.length).toFixed(2) : '—';
              return React.createElement('div',{key:it.id,style:{display:'flex',alignItems:'center',gap:6,fontSize:10,color:'var(--t2)'}},
                React.createElement('span',{style:{fontWeight:600,width:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, it.label),
                React.createElement('div',{style:{flex:1,height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}},
                  React.createElement('div',{style:{width:`${Math.max(5,100-avgDist*50)}%`,height:'100%',borderRadius:2,background:avgDist<0.4?'var(--green)':avgDist<0.8?'var(--blue)':'var(--amber)'}}),
                ),
                React.createElement('span',{style:{fontSize:9,color:'var(--t3)',width:24}}, avgDist),
              );
            }),
          ),
        ),
      ),

      /* Accuracy distribution */
      React.createElement('div',{style:cs.sectionH},
        React.createElement('span',null,'准确度分布'),
        React.createElement('div',{style:cs.sectionLine}),
      ),
      React.createElement('div',{style:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:'16px 20px',marginBottom:16}},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:12,marginBottom:12}},
          React.createElement('div',{style:{fontSize:11,fontWeight:600,color:'var(--t2)',width:80}}, `全部 ${total} 人`),
          React.createElement('div',{style:{flex:1,height:24,background:'var(--surface2)',borderRadius:4,overflow:'hidden',display:'flex'}},
            React.createElement('div',{style:{height:'100%',width:`${STUDENTS.filter(s=>s.accuracy>.7).length/total*100}%`,background:'var(--green)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff'}}, `${STUDENTS.filter(s=>s.accuracy>.7).length} 高`),
            React.createElement('div',{style:{height:'100%',width:`${STUDENTS.filter(s=>s.accuracy>.4&&s.accuracy<=.7).length/total*100}%`,background:'var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff'}}, `${STUDENTS.filter(s=>s.accuracy>.4&&s.accuracy<=.7).length} 中`),
            React.createElement('div',{style:{height:'100%',width:`${STUDENTS.filter(s=>s.accuracy<=.4).length/total*100}%`,background:'var(--amber)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:'#fff'}}, `${STUDENTS.filter(s=>s.accuracy<=.4).length} 低`),
          ),
        ),
        React.createElement('div',{style:{display:'flex',gap:16,fontSize:10,color:'var(--t3)'}},
          React.createElement('span',{style:{display:'flex',alignItems:'center',gap:4}}, React.createElement('span',{style:{...cs.dot,background:'var(--green)'}}), '>70% — 位置准确'),
          React.createElement('span',{style:{display:'flex',alignItems:'center',gap:4}}, React.createElement('span',{style:{...cs.dot,background:'var(--blue)'}}), '40-70% — 部分准确'),
          React.createElement('span',{style:{display:'flex',alignItems:'center',gap:4}}, React.createElement('span',{style:{...cs.dot,background:'var(--amber)'}}), '<40% — 需关注'),
        ),
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
        React.createElement('div',{style:{display:'grid',gridTemplateColumns:'1fr 60px 60px 60px 80px 1fr',gap:8,padding:'8px 14px',fontSize:9,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.4px',borderBottom:'1px solid var(--border)'}},
          React.createElement('span',null,'学生'),
          React.createElement('span',null,'已放置'),
          React.createElement('span',null,'已解释'),
          React.createElement('span',null,'用时'),
          React.createElement('span',null,'准确度'),
          React.createElement('span',null,'关键发现'),
        ),
        STUDENTS.map(s=>{
          return React.createElement('div',{key:s.id,onClick:()=>onSelectStudent(s),
            style:{display:'grid',gridTemplateColumns:'1fr 60px 60px 60px 80px 1fr',gap:8,padding:'8px 14px',fontSize:11,alignItems:'center',cursor:'pointer',borderBottom:'1px solid var(--border)',transition:'background .1s'},
            onMouseEnter:e=>e.currentTarget.style.background='var(--surface2)',
            onMouseLeave:e=>e.currentTarget.style.background='transparent',
          },
            React.createElement('span',{style:{fontWeight:600,display:'flex',alignItems:'center',gap:6}},
              s.name,
              !s.submitted && React.createElement('span',{style:{fontSize:8,color:'var(--red)',fontWeight:700}},'未交'),
            ),
            React.createElement('span',{style:{color:'var(--t2)'}}, `${s.placed}/7`),
            React.createElement('span',{style:{color:'var(--t2)'}}, `${s.reasoned}/7`),
            React.createElement('span',{style:{color:'var(--t2)'}}, formatTime(s.time)),
            React.createElement('span',null,
              React.createElement('div',{style:{display:'flex',alignItems:'center',gap:6}},
                React.createElement('div',{style:{flex:1,height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'}},
                  React.createElement('div',{style:{width:`${s.accuracy*100}%`,height:'100%',borderRadius:2,background:s.accuracy>.7?'var(--green)':s.accuracy>.4?'var(--blue)':'var(--amber)'}}),
                ),
                React.createElement('span',{style:{fontSize:9,fontWeight:600,color:'var(--t2)',width:28}}, `${Math.round(s.accuracy*100)}%`),
              ),
            ),
            React.createElement('span',{style:{fontSize:10,color:'var(--t3)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}, s.keyInsights[0]),
          );
        }),
      ),
    ),
  );
}

/* ═══ STUDENT VIEW ═══ */
function StudentView({student, onBack}) {
  const s = student;
  const [activeItem, setActiveItem] = useState(null);

  /* Build student placements for mini plane */
  const studentPlacements = useMemo(()=>{
    return Object.entries(s.placements).map(([id,[x,y]])=>{
      const item = ITEMS.find(it=>it.id===id);
      const d = dist([x,y], EXPECTED[id]);
      return {x,y,itemId:id,label:item?.label?.slice(0,6),color: d<0.3?'var(--green)':d<0.6?'var(--blue)':'var(--red)'};
    });
  },[s]);

  const sv = {
    wrap: {flex:1,display:'flex',flexDirection:'column',overflow:'hidden'},
    header: {display:'flex',alignItems:'center',gap:14,padding:'14px 24px',background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
    backBtn: {fontSize:11,fontWeight:500,color:'var(--t2)',cursor:'pointer',padding:'4px 10px',borderRadius:6,border:'1px solid var(--border)',background:'var(--surface)',fontFamily:'inherit'},
    avatar: {width:36,height:36,borderRadius:8,background:'var(--t1)',color:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:700},
    body: {flex:1,display:'grid',gridTemplateColumns:'1fr 1fr',overflow:'hidden'},
    col: {overflowY:'auto',padding:'20px 24px 40px'},
    colRight: {overflowY:'auto',padding:'20px 24px 40px',background:'var(--surface)',borderLeft:'1px solid var(--border)'},
    sectionH: {fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.6px',marginBottom:10,marginTop:16,display:'flex',alignItems:'center',gap:8},
    sectionLine: {flex:1,height:1,background:'var(--border)'},
    statGrid: {display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16},
    stat: {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',textAlign:'center'},
    statN: {fontSize:18,fontWeight:700,lineHeight:1},
    statL: {fontSize:8,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.3px',marginTop:3},
    kiCard: {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8},
    kiTitle: {fontSize:10,fontWeight:700,color:'var(--t1)',marginBottom:6},
    kiItem: {fontSize:11,color:'var(--t2)',lineHeight:1.6,padding:'3px 0',display:'flex',gap:6},
    kiBullet: {color:'var(--t3)',flexShrink:0},
    reasonCard: {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',marginBottom:6,cursor:'pointer',transition:'all .12s'},
    reasonCardActive: {borderColor:'var(--purple)',boxShadow:'0 0 0 3px var(--purple-bg)'},
  };

  return React.createElement('div',{style:sv.wrap},
    /* Header */
    React.createElement('div',{style:sv.header},
      React.createElement('button',{style:sv.backBtn,onClick:onBack},'← 返回班级'),
      React.createElement('div',{style:sv.avatar}, s.name[0]),
      React.createElement('div',{style:{flex:1}},
        React.createElement('div',{style:{fontSize:15,fontWeight:600}}, s.name),
        React.createElement('div',{style:{fontSize:11,color:'var(--t3)',marginTop:2}}, `Task 4 · Map It`),
      ),
      React.createElement('span',{style:{fontSize:10,fontWeight:600,padding:'3px 10px',borderRadius:4,background:s.submitted?'var(--green-bg)':'var(--red-bg)',color:s.submitted?'var(--green)':'var(--red)'}},
        s.submitted?'✓ 已提交':'✕ 未提交'),
    ),

    React.createElement('div',{style:sv.body},
      /* Left: Stats + Map + Placements */
      React.createElement('div',{style:sv.col},
        React.createElement('div',{style:sv.statGrid},
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:sv.statN}, `${s.placed}/7`),
            React.createElement('div',{style:sv.statL}, '已放置'),
          ),
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:sv.statN}, `${s.reasoned}/7`),
            React.createElement('div',{style:sv.statL}, '已解释'),
          ),
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:{...sv.statN,color:s.accuracy>.7?'var(--green)':s.accuracy>.4?'var(--blue)':'var(--amber)'}}, `${Math.round(s.accuracy*100)}%`),
            React.createElement('div',{style:sv.statL}, '准确度'),
          ),
          React.createElement('div',{style:sv.stat},
            React.createElement('div',{style:sv.statN}, formatTime(s.time)),
            React.createElement('div',{style:sv.statL}, '用时'),
          ),
        ),

        /* Student's map */
        React.createElement('div',{style:{...sv.sectionH,marginTop:0}},
          React.createElement('span',null,'学生地图'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        React.createElement('div',{style:{display:'flex',justifyContent:'center',marginBottom:16}},
          React.createElement(MiniPlane,{size:300,placements:studentPlacements,activeItem:activeItem,showExpected:true}),
        ),

        /* Per-item detail */
        React.createElement('div',{style:sv.sectionH},
          React.createElement('span',null,'逐项放置'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        ITEMS.map(it=>{
          const p = s.placements[it.id];
          const reason = s.reasons[it.id];
          const exp = EXPECTED[it.id];
          const d = p ? dist(p, exp) : null;
          const isActive = activeItem===it.id;
          return React.createElement('div',{key:it.id,
            style:{...sv.reasonCard,...(isActive?sv.reasonCardActive:{})},
            onClick:()=>setActiveItem(isActive?null:it.id),
            onMouseEnter:()=>setActiveItem(it.id),
          },
            React.createElement('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:4}},
              React.createElement('span',{style:{fontSize:11,fontWeight:600,color:'var(--t1)'}}, it.label),
              p && React.createElement('span',{style:{fontFamily:'ui-monospace,monospace',fontSize:9,color:'var(--t3)',marginLeft:'auto'}}, `(${p[0].toFixed(2)}, ${p[1].toFixed(2)})`),
              p && React.createElement('span',{style:{fontSize:9,fontWeight:600,padding:'2px 6px',borderRadius:3,marginLeft:6,background:d<0.3?'var(--green-bg)':d<0.6?'var(--blue-bg)':'var(--amber-bg)',color:d<0.3?'var(--green)':d<0.6?'var(--blue)':'var(--amber)'}}, d<0.3?'准确':d<0.6?'偏差':' 偏差大'),
            ),
            p && React.createElement('div',{style:{fontSize:9,color:'var(--t3)',marginBottom:4}},
              `参考: (${exp[0].toFixed(2)}, ${exp[1].toFixed(2)}) · 距离: ${d.toFixed(2)}`),
            reason ? React.createElement('div',{style:{fontSize:11,color:'var(--t2)',lineHeight:1.6,padding:'6px 0',borderTop:'1px solid var(--border)',marginTop:4}}, reason)
              : p ? React.createElement('div',{style:{fontSize:10,color:'var(--t3)',fontStyle:'italic',marginTop:4}}, '未写理由')
              : React.createElement('div',{style:{fontSize:10,color:'var(--red)',fontStyle:'italic'}}, '未放置'),
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
        React.createElement('div',{style:{...sv.kiCard,background:s.accuracy>.7?'var(--green-bg)':s.accuracy>.4?'var(--blue-bg)':'var(--amber-bg)',borderColor:s.accuracy>.7?'rgba(45,102,18,.15)':s.accuracy>.4?'rgba(26,95,160,.15)':'rgba(122,77,14,.15)'}},
          React.createElement('div',{style:{...sv.kiTitle,color:s.accuracy>.7?'var(--green)':s.accuracy>.4?'var(--blue)':'var(--amber)'}},
            s.accuracy>.7?'位置准确 — 理解良好':s.accuracy>.4?'部分准确 — 需加强':'位置偏差大 — 需重点关注'),
          React.createElement('div',{style:{fontSize:11,color:'var(--t2)',lineHeight:1.6}},
            s.accuracy>.7
              ? `放置了 ${s.placed}/7 个items，${s.reasoned}/7 有reasoning。整体位置与参考高度吻合。`
              : s.accuracy>.4
                ? `放置了 ${s.placed}/7 个items，${s.reasoned}/7 有reasoning。部分items位置偏差较大，reasoning质量需提升。`
                : `放置了 ${s.placed}/7 个items，${s.reasoned}/7 有reasoning。多数位置偏差大，可能未理解axes含义。`),
        ),

        /* Class comparison */
        React.createElement('div',{style:{...sv.sectionH,marginTop:20}},
          React.createElement('span',null,'班级对比'),
          React.createElement('div',{style:sv.sectionLine}),
        ),
        React.createElement('div',{style:sv.kiCard},
          [{label:'准确度',val:Math.round(s.accuracy*100),avg:Math.round(STUDENTS.reduce((a,st)=>a+st.accuracy,0)/STUDENTS.length*100),max:100,unit:'%'},
           {label:'放置数',val:s.placed,avg:+(STUDENTS.reduce((a,st)=>a+st.placed,0)/STUDENTS.length).toFixed(1),max:7,unit:''},
           {label:'解释数',val:s.reasoned,avg:+(STUDENTS.reduce((a,st)=>a+st.reasoned,0)/STUDENTS.length).toFixed(1),max:7,unit:''},
           {label:'用时',val:s.time,avg:Math.round(STUDENTS.reduce((a,st)=>a+st.time,0)/STUDENTS.length),max:360,unit:'s',format:formatTime},
          ].map((row,i)=>
            React.createElement('div',{key:i,style:{display:'flex',alignItems:'center',gap:8,marginBottom:8}},
              React.createElement('span',{style:{fontSize:10,color:'var(--t3)',width:50,flexShrink:0}}, row.label),
              React.createElement('div',{style:{flex:1,height:14,background:'var(--surface2)',borderRadius:3,position:'relative',overflow:'visible'}},
                React.createElement('div',{style:{position:'absolute',left:`${row.avg/row.max*100}%`,top:-2,width:2,height:18,background:'var(--border-strong)',borderRadius:1,zIndex:1}}),
                React.createElement('div',{style:{height:'100%',width:`${row.val/row.max*100}%`,borderRadius:3,background:row.val>row.avg?'var(--green)':'var(--amber)',opacity:0.7}}),
              ),
              React.createElement('span',{style:{fontSize:10,fontWeight:600,color:'var(--t1)',width:40,textAlign:'right'}}, row.format?row.format(row.val):`${row.val}${row.unit}`),
            )
          ),
          React.createElement('div',{style:{display:'flex',gap:12,marginTop:4,fontSize:9,color:'var(--t3)'}},
            React.createElement('span',{style:{display:'flex',alignItems:'center',gap:3}}, React.createElement('span',{style:{width:8,height:4,borderRadius:2,background:'var(--green)',display:'inline-block',opacity:.7}}), '该学生'),
            React.createElement('span',{style:{display:'flex',alignItems:'center',gap:3}}, React.createElement('span',{style:{width:2,height:10,borderRadius:1,background:'var(--border-strong)',display:'inline-block'}}), '班级均值'),
          ),
        ),
      ),
    ),
  );
}


/* ═══ TIMELINE SCRUBBER ═══ */
function MapTimelineScrubber({elapsed,total,onSeek,isLive,onToggleLive}) {
  const trackRef = useRef(null);
  const [dragging,setDragging] = useState(false);
  const pct = Math.min(elapsed/total*100,100);
  const handleTrackClick = (e) => {const rect=trackRef.current.getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));onSeek(Math.round(x*total));};
  const handleMouseDown = (e) => {e.preventDefault();setDragging(true);const onMove=(ev)=>{const rect=trackRef.current.getBoundingClientRect();const x=Math.max(0,Math.min(1,(ev.clientX-rect.left)/rect.width));onSeek(Math.round(x*total));};const onUp=()=>{setDragging(false);window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);};
  const tlS = {
    wrap: {display:'flex',alignItems:'center',height:40,padding:'0 24px',background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0,gap:12},
    time: {fontSize:12,fontWeight:700,color:'var(--t1)',minWidth:42,textAlign:'center',fontVariantNumeric:'tabular-nums'},
    trackWrap: {flex:1,position:'relative',height:24,display:'flex',alignItems:'center',cursor:'pointer'},
    track: {width:'100%',height:6,background:'var(--surface2)',borderRadius:3,position:'relative',overflow:'visible'},
    fill: {height:'100%',borderRadius:3,background:'var(--t1)',position:'absolute',top:0,left:0,transition:dragging?'none':'width .15s'},
    thumb: {width:14,height:14,borderRadius:'50%',background:'var(--t1)',border:'2px solid var(--surface)',boxShadow:'0 1px 4px rgba(0,0,0,.2)',position:'absolute',top:'50%',transform:'translate(-50%,-50%)',cursor:'grab',zIndex:2,transition:dragging?'none':'left .15s'},
    total: {fontSize:12,color:'var(--t3)',minWidth:42,textAlign:'center'},
    liveTag: {fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:3,cursor:'pointer',border:'none',fontFamily:'inherit'},
  };
  return React.createElement('div',{style:tlS.wrap},
    React.createElement('div',{style:tlS.time},formatTime(elapsed)),
    React.createElement('div',{ref:trackRef,style:tlS.trackWrap,onClick:handleTrackClick},
      React.createElement('div',{style:tlS.track},
        React.createElement('div',{style:{...tlS.fill,width:`${pct}%`}}),
      ),
      React.createElement('div',{style:{...tlS.thumb,left:`${pct}%`},onMouseDown:handleMouseDown}),
    ),
    React.createElement('div',{style:tlS.total},formatTime(total)),
    React.createElement('button',{style:{...tlS.liveTag,background:isLive?'var(--green-bg)':'var(--amber-bg)',color:isLive?'var(--green)':'var(--amber)'},onClick:onToggleLive},
      isLive?'● 实时':'回放'),
  );
}

/* ═══ MAIN APP ═══ */
function MapObserveApp() {
  const [view,setView] = useState('class');
  const [selectedStudent,setSelectedStudent] = useState(null);
  const STEP_TOTAL = 420;
  const [elapsed,setElapsed] = useState(350);
  const [isLive,setIsLive] = useState(true);
  const handleSeek = (t)=>{setElapsed(t);setIsLive(false);};
  const handleToggleLive = ()=>{if(!isLive){setElapsed(350);setIsLive(true);}};
  const selectStudent = (s)=>{if(!s)return;setSelectedStudent(s);setView('student');};

  return React.createElement('div',{style:S.shell},
    React.createElement('div',{style:S.band},
      React.createElement('div',{style:S.bandMark},'M'),
      React.createElement('div',{style:S.bandTitle},'Map It 观察'),
      React.createElement('div',{style:S.bandTag},'Task 4 · Evaluate'),
      React.createElement('div',{style:S.bandMeta},`高一(3)班 · ${STUDENTS.filter(s=>s.submitted).length}/${STUDENTS.length} 人已提交`),
      React.createElement('div',{style:S.bandRight},
        React.createElement('div',{style:{display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:600,color:'var(--green)'}},
          React.createElement('span',{style:{width:6,height:6,borderRadius:'50%',background:'var(--green)'}}),
          '实时',
        ),
      ),
    ),
    React.createElement(MapTimelineScrubber,{elapsed,total:STEP_TOTAL,onSeek:handleSeek,isLive,onToggleLive:handleToggleLive}),
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

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(MapObserveApp));
