const {useState, useCallback, useRef, useEffect, Fragment, useMemo} = React;

/* ═══════════════════════════════════════════════════════════
   DISCUSS OBSERVATION — Teacher Console
   Two views: Class Overview + Individual Student Deep-dive
   ═══════════════════════════════════════════════════════════ */

/* ─── MOCK DATA ─── */
const STUDENTS = [
  { id:1, name:'王译文', task:3, method:'socratic', goalReached:true, rounds:5, time:267, mcCorrect:null,
    keyInsights:['识别了冲突开头手法','理解了文化深意但表述不够完整','第4轮突破：将beauty与identity关联'],
    understanding: [0.2, 0.35, 0.5, 0.7, 0.95],
    conversation:[
      {role:'ai', text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student', text:"I think humans care about looking good, but also about culture."},
      {role:'ai', text:"Interesting! You mentioned culture. Can you pick one specific example from your matrix and tell me — what does that beauty practice say about culture?"},
      {role:'student', text:"In Borneo, tattoos record life events. So it's not just about beauty, it's about their history."},
      {role:'ai', text:"Exactly! So the Borneo tattoo isn't really about 'looking good' at all — it's about recording identity. Now, does this pattern hold for the other examples too?"},
      {role:'student', text:"Yes! Maori tā moko shows social position, and in Myanmar, the neck rings show cultural identity. So beauty practices are really about identity and status and belonging."},
      {role:'ai', text:"[GOAL_REACHED] Brilliant! You've discovered something really important — beauty across cultures is a language that communicates identity, status, and belonging, not just appearance."},
    ]
  },
  { id:2, name:'黄婉晴', task:3, method:'fallback', goalReached:false, rounds:6, time:312, mcCorrect:true,
    keyInsights:['将Myanmar和Indonesia内容合并','未能区分tā moko与generic tattoos','兜底选择题答对'],
    understanding: [0.1, 0.15, 0.2, 0.25, 0.3, 0.35],
    conversation:[
      {role:'ai', text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student', text:"我觉得人类在乎好看吧。"},
      {role:'ai', text:"That's a natural first reaction! But let's look more carefully at one example. Take the Borneo tattoo — is getting a tattoo really about 'looking good'?"},
      {role:'student', text:"Maybe not. The tattoo records things about their life."},
      {role:'ai', text:"Good observation! So if the tattoo records life events, what is it really communicating?"},
      {role:'student', text:"It communicates... their experience? Like a diary on skin?"},
      {role:'ai', text:"I like that metaphor — 'a diary on skin'! So beauty here is more like a language. Now, does this idea — beauty as communication — apply to the other cultures in your matrix?"},
      {role:'student', text:"Um... I think so but I'm not sure about the Myanmar and Indonesia ones. They seem similar to me."},
      {role:'ai', text:"Let me give you a question to help:", mc:true},
    ],
    mcAnswer: 2, mcCorrectIndex: 2,
  },
  { id:3, name:'徐晨曦', task:3, method:'fallback', goalReached:false, rounds:6, time:300, mcCorrect:false,
    keyInsights:['始终停留在表面理解','混淆了Myanmar和Indonesia','兜底选择题选错(选A)'],
    understanding: [0.1, 0.12, 0.15, 0.18, 0.2, 0.22],
    conversation:[
      {role:'ai', text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student', text:"Humans care about looking good."},
      {role:'ai', text:"Okay! Can you look at one specific row in your matrix — say, the Maori tā moko — and tell me, is it really about 'looking good'?"},
      {role:'student', text:"Yes, the tattoo looks cool."},
      {role:'ai', text:"It does look impressive! But the text says something specific about what the tā moko represents. Can you find that detail in ¶5?"},
      {role:'student', text:"It shows their family and rank."},
      {role:'ai', text:"Right! So if it shows family and rank, is the tā moko mainly about beauty, or about something else?"},
      {role:'student', text:"I guess about family? But it's still about looking good too."},
      {role:'ai', text:"Let me give you a question to help:", mc:true},
    ],
    mcAnswer: 0, mcCorrectIndex: 2,
  },
  { id:4, name:'陈昕妍', task:3, method:'socratic', goalReached:true, rounds:3, time:145,mcCorrect:null,
    keyInsights:['快速理解文化语言概念','第2轮就开始归纳','表达流畅，英文输出质量高'],
    understanding: [0.4, 0.75, 0.95],
    conversation:[
      {role:'ai', text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student', text:"I think there's something deeper. Each practice has a cultural meaning — like identity or social status. It's not just about appearance."},
      {role:'ai', text:"That's a really strong observation! Can you give me a specific example from the matrix to support that idea?"},
      {role:'student', text:"For example, Maori tā moko shows social position and family history. And Borneo tattoos record life experiences. So beauty is like a cultural language — it communicates who you are, not just how you look."},
      {role:'ai', text:"[GOAL_REACHED] Wow, you nailed it! Beauty IS a cultural language — it communicates identity, status, and belonging. That's the key insight of this entire section."},
    ]
  },
  { id:5, name:'李奕辰', task:3, method:'socratic', goalReached:true, rounds:4, time:198,mcCorrect:null,
    keyInsights:['用中文回答但理解准确','第3轮开始用英文','理解了文化深意'],
    understanding: [0.25, 0.45, 0.7, 0.9],
    conversation:[
      {role:'ai', text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student', text:"有更深层的东西。每种美的实践背后都有文化含义。"},
      {role:'ai', text:"I can see you understand there's something deeper! Can you pick one example and explain what that cultural meaning is — in English this time?"},
      {role:'student', text:"In Borneo, the tattoo is about recording life events. It's like... a personal history on the body."},
      {role:'ai', text:"Great English expression! So beauty in Borneo is about personal history. Does the same pattern — beauty = meaning beyond appearance — apply to the other cultures?"},
      {role:'student', text:"Yes. Maori tā moko = social identity. Myanmar neck rings = cultural belonging. Indonesia teeth sharpening = cultural identity. They all use beauty to show who they are."},
      {role:'ai', text:"[GOAL_REACHED] Excellent summary! You've identified the key pattern — beauty practices across cultures are a form of cultural language expressing identity, status, and belonging."},
    ]
  },
  { id:6, name:'郭斐然', task:3, method:'fallback', goalReached:false, rounds:6, time:305, mcCorrect:true,
    keyInsights:['理解碎片化，无法归纳','混淆了different practices的purpose','兜底选择题答对但理解仍浅'],
    understanding: [0.1, 0.2, 0.25, 0.3, 0.28, 0.32],
    conversation:[
      {role:'ai', text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student', text:"Humans care about beauty."},
      {role:'ai', text:"True! But what KIND of beauty? Is it the same idea of beauty everywhere?"},
      {role:'student', text:"No, different places have different beauty."},
      {role:'ai', text:"Good! So beauty isn't universal. But WHY do these different cultures have such different beauty practices? What's behind them?"},
      {role:'student', text:"Because they have different culture."},
      {role:'ai', text:"Right, different cultures! But let's go deeper — take one example. The Maori tā moko. What does it specifically communicate about a person?"},
      {role:'student', text:"It shows they are Maori."},
      {role:'ai', text:"Let me give you a question to help:", mc:true},
    ],
    mcAnswer: 2, mcCorrectIndex: 2,
  },
  // More students for class stats
  { id:7, name:'张皓月', task:3, method:'socratic', goalReached:true, rounds:4, time:210, mcCorrect:null, keyInsights:['理解较好'], understanding:[0.3,0.5,0.75,0.92], conversation:[] },
  { id:8, name:'周航宇', task:3, method:'socratic', goalReached:true, rounds:5, time:250, mcCorrect:null, keyInsights:['稳步提升'], understanding:[0.2,0.35,0.55,0.8,0.93], conversation:[] },
  { id:9, name:'郑若曦', task:3, method:'socratic', goalReached:true, rounds:4, time:195, mcCorrect:null, keyInsights:['表达流畅'], understanding:[0.35,0.55,0.8,0.95], conversation:[] },
  { id:10, name:'邓梓涵', task:3, method:'fallback', goalReached:false, rounds:6, time:300, mcCorrect:true, keyInsights:['理解困难'], understanding:[0.1,0.15,0.2,0.22,0.25,0.3], conversation:[] },
  { id:11, name:'董思齐', task:3, method:'fallback', goalReached:false, rounds:6, time:295, mcCorrect:false, keyInsights:['完全卡住'], understanding:[0.1,0.1,0.12,0.15,0.15,0.18], conversation:[] },
  { id:12, name:'冯璐', task:3, method:'fallback', goalReached:false, rounds:6, time:310, mcCorrect:true, keyInsights:['混淆概念'], understanding:[0.15,0.2,0.25,0.2,0.25,0.3], conversation:[] },
  { id:13, name:'谢安然', task:3, method:'fallback', goalReached:false, rounds:6, time:298, mcCorrect:false, keyInsights:['语言障碍'], understanding:[0.1,0.12,0.15,0.18,0.2,0.2], conversation:[] },
  { id:14, name:'马乐瑶', task:3, method:'socratic', goalReached:true, rounds:5, time:275, mcCorrect:null, keyInsights:['后半段突破'], understanding:[0.15,0.25,0.4,0.65,0.9], conversation:[] },
  { id:15, name:'林澜', task:3, method:'socratic', goalReached:true, rounds:5, time:260, mcCorrect:null, keyInsights:['稳步进步'], understanding:[0.2,0.35,0.5,0.7,0.88], conversation:[] },
  { id:16, name:'朱思语', task:3, method:'socratic', goalReached:true, rounds:3, time:160, mcCorrect:null, keyInsights:['快速达标'], understanding:[0.4,0.7,0.92], conversation:[] },
];

const MISCONCEPTIONS = [
  { id:1, label:'Myanmar/Indonesia 内容合并', count:7, students:['黄婉晴','徐晨曦','郭斐然','邓梓涵','董思齐','冯璐','谢安然'], severity:'high' },
  { id:2, label:'tā moko 与 generic tattoos 混淆', count:4, students:['王译文','郭斐然','徐晨曦','冯璐'], severity:'medium' },
  { id:3, label:'停留在 "looking good" 表面理解', count:5, students:['徐晨曦','董思齐','谢安然','郭斐然','邓梓涵'], severity:'medium' },
  { id:4, label:'无法从具体例子归纳到抽象概念', count:3, students:['郭斐然','邓梓涵','冯璐'], severity:'low' },
];

function formatTime(s) { const m=Math.floor(s/60),ss=s%60; return `${m}:${ss<10?'0':''}${ss}`; }

/* ─── STYLES ─── */
const S = {
  shell: { display:'flex', flexDirection:'column', height:'100vh' },
  band: { display:'flex', alignItems:'center', gap:12, padding:'0 20px', height:44, background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  bandMark: { width:22, height:22, borderRadius:6, background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 },
  bandTitle: { fontSize:13, fontWeight:600, letterSpacing:'-.1px' },
  bandTag: { fontSize:10, fontWeight:600, color:'var(--purple)', background:'var(--purple-bg)', padding:'2px 8px', borderRadius:3, letterSpacing:'.3px' },
  bandMeta: { fontSize:12, color:'var(--t2)', paddingLeft:12, borderLeft:'1px solid var(--border-strong)', marginLeft:2 },
  bandRight: { marginLeft:'auto', display:'flex', alignItems:'center', gap:12 },
  tabs: { display:'flex', gap:0, padding:'0 20px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  tab: { padding:'10px 18px', fontSize:12, fontWeight:500, color:'var(--t3)', cursor:'pointer', borderBottom:'2px solid transparent', background:'none', border:'none', borderBottomWidth:2, borderBottomStyle:'solid', borderBottomColor:'transparent', fontFamily:'inherit', transition:'all .12s' },
  tabActive: { color:'var(--t1)', fontWeight:600, borderBottomColor:'var(--t1)' },
  main: { flex:1, overflow:'hidden', display:'flex' },
};

/* ═══ CLASS VIEW ═══ */
function ClassView({ onSelectStudent }) {
  const total = STUDENTS.length;
  const goalReached = STUDENTS.filter(s=>s.goalReached).length;
  const fallback = STUDENTS.filter(s=>!s.goalReached).length;
  const fallbackCorrect = STUDENTS.filter(s=>!s.goalReached && s.mcCorrect).length;
  const fallbackWrong = STUDENTS.filter(s=>!s.goalReached && !s.mcCorrect).length;
  const [expandedMiscon, setExpandedMiscon] = useState(null);
  const avgRounds = (STUDENTS.reduce((a,s)=>a+s.rounds,0)/total).toFixed(1);
  const avgTime = Math.round(STUDENTS.reduce((a,s)=>a+s.time,0)/total);
  const medianTime = (() => { const sorted = STUDENTS.map(s=>s.time).sort((a,b)=>a-b); return sorted[Math.floor(sorted.length/2)]; })();

  const cs = {
    wrap: { flex:1, overflowY:'auto', padding:'20px 24px 40px' },
    inner: { maxWidth:900, margin:'0 auto' },
    grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 },
    hcard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px' },
    hcardLabel: { fontSize:9, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 },
    hcardVal: { fontSize:24, fontWeight:700, letterSpacing:'-.5px', lineHeight:1 },
    hcardSub: { fontSize:10, color:'var(--t2)', marginTop:4, lineHeight:1.4 },
    sectionH: { fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:10, marginTop:20, display:'flex', alignItems:'center', gap:8 },
    sectionLine: { flex:1, height:1, background:'var(--border)' },
    // Outcome funnel
    funnel: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 20px', marginBottom:16 },
    funnelRow: { display:'flex', alignItems:'center', gap:12, marginBottom:8 },
    funnelBar: { flex:1, height:24, background:'var(--surface2)', borderRadius:4, overflow:'hidden', display:'flex' },
    funnelSeg: { height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', transition:'width .3s' },
    // Understanding curve
    curveWrap: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 20px', marginBottom:16 },
    // Misconceptions
    misconCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:8, cursor:'pointer', transition:'all .12s' },
    misconHigh: { borderColor:'rgba(148,41,41,.2)', background:'rgba(148,41,41,.03)' },
    misconMed: { borderColor:'rgba(196,138,30,.2)', background:'rgba(196,138,30,.03)' },
    // Student list
    studentRow: { display:'flex', alignItems:'center', gap:10, padding:'8px 12px', borderRadius:6, cursor:'pointer', transition:'all .1s' },
    dot: { width:8, height:8, borderRadius:'50%', flexShrink:0 },
    chipSmall: { fontSize:9, fontWeight:600, padding:'2px 6px', borderRadius:3, display:'inline-flex', alignItems:'center', gap:3 },
  };

  return React.createElement('div', { style:cs.wrap },
    React.createElement('div', { style:cs.inner },

      /* ── Health Cards ── */
      React.createElement('div', { style:cs.grid4 },
        React.createElement('div', { style:{ ...cs.hcard, borderColor:'rgba(45,102,18,.15)', background:'var(--green-bg)' } },
          React.createElement('div', { style:{ ...cs.hcardLabel, color:'var(--green)' } }, '对话达标'),
          React.createElement('div', { style:{ ...cs.hcardVal, color:'var(--green)' } }, `${goalReached}/${total}`),
          React.createElement('div', { style:cs.hcardSub }, `${Math.round(goalReached/total*100)}% 通过苏格拉底对话达标`),
        ),
        React.createElement('div', { style:{ ...cs.hcard, borderColor:'rgba(122,77,14,.15)', background:'var(--amber-bg)' } },
          React.createElement('div', { style:{ ...cs.hcardLabel, color:'var(--amber)' } }, '兜底选择题'),
          React.createElement('div', { style:{ ...cs.hcardVal, color:'var(--amber)' } }, fallback),
          React.createElement('div', { style:cs.hcardSub }, React.createElement('span', null, `答对 ${fallbackCorrect} · 答错 `, React.createElement('strong', { style:{color:'var(--red)'} }, fallbackWrong))),
        ),
        React.createElement('div', { style:cs.hcard },
          React.createElement('div', { style:cs.hcardLabel }, '平均轮次'),
          React.createElement('div', { style:cs.hcardVal }, avgRounds),
          React.createElement('div', { style:cs.hcardSub }, `中位用时 ${formatTime(medianTime)}`),
        ),
        React.createElement('div', { style:cs.hcard },
          React.createElement('div', { style:cs.hcardLabel }, '误解聚类'),
          React.createElement('div', { style:cs.hcardVal }, MISCONCEPTIONS.length),
          React.createElement('div', { style:cs.hcardSub }, `高频误解 ${MISCONCEPTIONS.filter(m=>m.severity==='high').length} 个`),
        ),
      ),

      /* ── Outcome Funnel ── */
      React.createElement('div', { style:cs.sectionH },
        React.createElement('span', null, '结果分布'),
        React.createElement('div', { style:cs.sectionLine }),
      ),
      React.createElement('div', { style:cs.funnel },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:12, marginBottom:12 } },
          React.createElement('div', { style:{ fontSize:11, fontWeight:600, color:'var(--t2)', width:80 } }, `全部 ${total} 人`),
          React.createElement('div', { style:cs.funnelBar },
            React.createElement('div', { style:{ ...cs.funnelSeg, width:`${goalReached/total*100}%`, background:'var(--green)' } }, `${goalReached} 对话达标`),
            React.createElement('div', { style:{ ...cs.funnelSeg, width:`${fallbackCorrect/total*100}%`, background:'var(--amber)' } }, `${fallbackCorrect} 选择题答对`),
            React.createElement('div', { style:{ ...cs.funnelSeg, width:`${fallbackWrong/total*100}%`, background:'var(--red)' } }, `${fallbackWrong} 选择题答错`),
          ),
        ),
        React.createElement('div', { style:{ display:'flex', gap:16, fontSize:10, color:'var(--t3)', marginTop:4 } },
          React.createElement('span', { style:{ display:'flex', alignItems:'center', gap:4 } }, React.createElement('span', { style:{ ...cs.dot, background:'var(--green)' } }), '对话达标 — 学生自主思考得出答案'),
          React.createElement('span', { style:{ display:'flex', alignItems:'center', gap:4 } }, React.createElement('span', { style:{ ...cs.dot, background:'var(--amber)' } }), '选择题答对 — 兜底选择题选对'),
          React.createElement('span', { style:{ display:'flex', alignItems:'center', gap:4 } }, React.createElement('span', { style:{ ...cs.dot, background:'var(--red)' } }), '选择题答错 — 需额外关注'),
        ),
      ),

      /* ── Understanding Rounds (expandable) ── */
      React.createElement('div', { style:cs.sectionH },
        React.createElement('span', null, '逐轮理解变化'),
        React.createElement('div', { style:cs.sectionLine }),
      ),
      React.createElement(RoundByRoundCards, { students:STUDENTS, onSelectStudent }),

      /* ── Misconceptions ── */
      React.createElement('div', { style:cs.sectionH },
        React.createElement('span', null, '误解聚类'),
        React.createElement('div', { style:cs.sectionLine }),
      ),
      MISCONCEPTIONS.map(m =>
        React.createElement('div', { key:m.id, style:{ ...cs.misconCard, ...(m.severity==='high'?cs.misconHigh:m.severity==='medium'?cs.misconMed:{}) } },
          React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:8, marginBottom:6 } },
            React.createElement('span', { style:{ ...cs.chipSmall, background: m.severity==='high'?'var(--red)':m.severity==='medium'?'var(--amber)':'var(--t3)', color:'#fff' } },
              m.severity==='high'?'高频':m.severity==='medium'?'中频':'低频'),
            React.createElement('span', { style:{ fontSize:12, fontWeight:700, color:'var(--t1)' } }, m.label),
            React.createElement('span', { style:{ marginLeft:'auto', fontSize:11, fontWeight:600, color:'var(--t2)' } }, `${m.count} 人`),
          ),
          React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 } },
            m.students.map(name =>
              React.createElement('span', { key:name, onClick:()=>onSelectStudent(STUDENTS.find(s=>s.name===name)), style:{ fontSize:10, fontWeight:600, padding:'3px 8px', borderRadius:4, background:'var(--surface2)', color:'var(--t2)', cursor:'pointer' } }, name)
            ),
          ),
        )
      ),

      /* ── Student List ── */
      React.createElement('div', { style:cs.sectionH },
        React.createElement('span', null, '全部学生'),
        React.createElement('div', { style:cs.sectionLine }),
      ),
      React.createElement('div', { style:{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' } },
        React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1fr 80px 60px 60px 80px 1fr', gap:8, padding:'8px 14px', fontSize:9, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.4px', borderBottom:'1px solid var(--border)' } },
          React.createElement('span', null, '学生'),
          React.createElement('span', null, '结果'),
          React.createElement('span', null, '轮次'),
          React.createElement('span', null, '用时'),
          React.createElement('span', null, '最终理解'),
          React.createElement('span', null, '关键发现'),
        ),
        STUDENTS.map(s => {
          const finalU = s.understanding[s.understanding.length-1];
          return React.createElement('div', { key:s.id, onClick:()=>onSelectStudent(s),
            style:{ display:'grid', gridTemplateColumns:'1fr 80px 60px 60px 80px 1fr', gap:8, padding:'8px 14px', fontSize:11, alignItems:'center', cursor:'pointer', borderBottom:'1px solid var(--border)', transition:'background .1s' },
            onMouseEnter:e=>e.currentTarget.style.background='var(--surface2)',
            onMouseLeave:e=>e.currentTarget.style.background='transparent',
          },
            React.createElement('span', { style:{ fontWeight:600 } }, s.name),
            React.createElement('span', null,
              React.createElement('span', { style:{ ...cs.chipSmall, background: s.goalReached?'var(--green-bg)':'var(--amber-bg)', color: s.goalReached?'var(--green)':'var(--amber)' } },
                s.goalReached ? '✓ 对话达标' : s.mcCorrect ? '△ 选择题对' : '✕ 选择题错')
            ),
            React.createElement('span', { style:{ color:'var(--t2)' } }, s.rounds),
            React.createElement('span', { style:{ color:'var(--t2)' } }, formatTime(s.time)),
            React.createElement('span', null,
              React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:6 } },
                React.createElement('div', { style:{ flex:1, height:4, background:'var(--surface2)', borderRadius:2, overflow:'hidden' } },
                  React.createElement('div', { style:{ width:`${finalU*100}%`, height:'100%', borderRadius:2, background: finalU>0.8?'var(--green)':finalU>0.5?'var(--blue)':'var(--amber)' } }),
                ),
                React.createElement('span', { style:{ fontSize:9, fontWeight:600, color:'var(--t2)', width:28 } }, `${Math.round(finalU*100)}%`),
              ),
            ),
            React.createElement('span', { style:{ fontSize:10, color:'var(--t3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, s.keyInsights[0]),
          );
        }),
      ),
    ),
  );
}

/* ── Round-by-Round Cards (expandable) ── */
function RoundByRoundCards({ students, onSelectStudent }) {
  const [expandedRound, setExpandedRound] = useState(null);
  const maxR = Math.max(...students.map(s => s.understanding.length));

  const roundData = Array.from({ length: maxR }, (_, i) => {
    const active = students.filter(s => s.understanding.length > i);
    const vals = active.map(s => s.understanding[i]);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const high = active.filter(s => s.understanding[i] > 0.7);
    const mid = active.filter(s => s.understanding[i] > 0.3 && s.understanding[i] <= 0.7);
    const low = active.filter(s => s.understanding[i] <= 0.3);
    // Delta from previous round
    const prevVals = i > 0 ? active.filter(s => s.understanding.length > i - 1).map(s => s.understanding[i - 1]) : vals;
    const prevAvg = prevVals.length ? prevVals.reduce((a, b) => a + b, 0) / prevVals.length : 0;
    const delta = avg - prevAvg;
    return { round: i + 1, avg, delta, active: active.length, high, mid, low };
  });

  const rcS = {
    card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6, overflow: 'hidden', cursor: 'pointer', transition: 'all .12s' },
    cardOpen: { borderColor: 'var(--border-strong)', boxShadow: '0 2px 8px rgba(28,28,26,.06)' },
    row: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' },
    roundLabel: { fontSize: 12, fontWeight: 700, color: 'var(--t1)', width: 56, flexShrink: 0 },
    barWrap: { flex: 1, display: 'flex', alignItems: 'center', gap: 8 },
    bar: { flex: 1, height: 18, borderRadius: 3, overflow: 'hidden', display: 'flex', background: 'var(--surface2)' },
    seg: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', transition: 'width .3s' },
    avgVal: { fontSize: 12, fontWeight: 700, color: 'var(--t1)', width: 40, textAlign: 'right' },
    delta: { fontSize: 10, fontWeight: 600, width: 40, textAlign: 'right' },
    count: { fontSize: 10, color: 'var(--t3)', width: 40, textAlign: 'right' },
    detail: { padding: '0 14px 12px', borderTop: '1px solid var(--border)' },
    groupH: { fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.4px', marginTop: 10, marginBottom: 6 },
    chips: { display: 'flex', flexWrap: 'wrap', gap: 4 },
    chip: { fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, cursor: 'pointer' },
  };

  return React.createElement('div', null,
    /* Legend */
    React.createElement('div', { style: { display: 'flex', gap: 14, fontSize: 10, color: 'var(--t3)', marginBottom: 10 } },
      React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement('span', { style: { width: 10, height: 10, borderRadius: 2, background: 'var(--green)', display: 'inline-block' } }), '理解 >70%'),
      React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement('span', { style: { width: 10, height: 10, borderRadius: 2, background: 'var(--blue)', display: 'inline-block' } }), '30-70%'),
      React.createElement('span', { style: { display: 'flex', alignItems: 'center', gap: 4 } },
        React.createElement('span', { style: { width: 10, height: 10, borderRadius: 2, background: 'var(--amber)', display: 'inline-block' } }), '<30%'),
    ),
    roundData.map(rd => {
      const isOpen = expandedRound === rd.round;
      const totalActive = rd.active;
      return React.createElement('div', { key: rd.round, style: { ...rcS.card, ...(isOpen ? rcS.cardOpen : {}) } },
        React.createElement('div', { style: rcS.row, onClick: () => setExpandedRound(isOpen ? null : rd.round) },
          React.createElement('div', { style: rcS.roundLabel }, `Round ${rd.round}`),
          React.createElement('div', { style: rcS.barWrap },
            React.createElement('div', { style: rcS.bar },
              rd.high.length > 0 && React.createElement('div', { style: { ...rcS.seg, width: `${rd.high.length / totalActive * 100}%`, background: 'var(--green)' } }, rd.high.length),
              rd.mid.length > 0 && React.createElement('div', { style: { ...rcS.seg, width: `${rd.mid.length / totalActive * 100}%`, background: 'var(--blue)' } }, rd.mid.length),
              rd.low.length > 0 && React.createElement('div', { style: { ...rcS.seg, width: `${rd.low.length / totalActive * 100}%`, background: 'var(--amber)' } }, rd.low.length),
            ),
          ),
          React.createElement('div', { style: rcS.avgVal }, `${Math.round(rd.avg * 100)}%`),
          React.createElement('div', { style: { ...rcS.delta, color: rd.delta > 0 ? 'var(--green)' : rd.delta < 0 ? 'var(--red)' : 'var(--t3)' } },
            rd.round > 1 ? `${rd.delta > 0 ? '+' : ''}${Math.round(rd.delta * 100)}%` : '—'),
          React.createElement('div', { style: rcS.count }, `${totalActive}人`),
          React.createElement('span', { style: { fontSize: 8, color: 'var(--t3)', transition: 'transform .2s', transform: isOpen ? 'rotate(90deg)' : 'none' } }, '▶'),
        ),
        isOpen && React.createElement('div', { style: rcS.detail },
          rd.high.length > 0 && React.createElement(Fragment, null,
            React.createElement('div', { style: rcS.groupH }, `理解良好 · ${rd.high.length}人`),
            React.createElement('div', { style: rcS.chips },
              rd.high.map(s => React.createElement('span', { key: s.id, onClick: () => onSelectStudent(s), style: { ...rcS.chip, background: 'var(--green-bg)', color: 'var(--green)' } },
                `${s.name} ${Math.round(s.understanding[rd.round - 1] * 100)}%`))
            ),
          ),
          rd.mid.length > 0 && React.createElement(Fragment, null,
            React.createElement('div', { style: rcS.groupH }, `部分理解 · ${rd.mid.length}人`),
            React.createElement('div', { style: rcS.chips },
              rd.mid.map(s => React.createElement('span', { key: s.id, onClick: () => onSelectStudent(s), style: { ...rcS.chip, background: 'var(--blue-soft)', color: 'var(--blue)' } },
                `${s.name} ${Math.round(s.understanding[rd.round - 1] * 100)}%`))
            ),
          ),
          rd.low.length > 0 && React.createElement(Fragment, null,
            React.createElement('div', { style: rcS.groupH }, `理解困难 · ${rd.low.length}人`),
            React.createElement('div', { style: rcS.chips },
              rd.low.map(s => React.createElement('span', { key: s.id, onClick: () => onSelectStudent(s), style: { ...rcS.chip, background: 'var(--amber-bg)', color: 'var(--amber)' } },
                `${s.name} ${Math.round(s.understanding[rd.round - 1] * 100)}%`))
            ),
          ),
        ),
      );
    }),
  );
}


/* ═══ STUDENT VIEW ═══ */
function StudentView({ student, onBack }) {
  const [activeRound, setActiveRound] = useState(null); // null = show all
  const s = student;
  const finalU = s.understanding[s.understanding.length-1];
  const hasConvo = s.conversation.length > 0;

  const sv = {
    wrap: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
    header: { display:'flex', alignItems:'center', gap:14, padding:'14px 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 },
    backBtn: { fontSize:11, fontWeight:500, color:'var(--t2)', cursor:'pointer', padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', fontFamily:'inherit' },
    avatar: { width:36, height:36, borderRadius:8, background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 },
    body: { flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', overflow:'hidden' },
    col: { overflowY:'auto', padding:'20px 24px 40px' },
    colRight: { overflowY:'auto', padding:'20px 24px 40px', background:'var(--surface)', borderLeft:'1px solid var(--border)' },
    sectionH: { fontSize:10, fontWeight:600, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:10, marginTop:16, display:'flex', alignItems:'center', gap:8 },
    sectionLine: { flex:1, height:1, background:'var(--border)' },
    statGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:16 },
    stat: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', textAlign:'center' },
    statN: { fontSize:20, fontWeight:700, lineHeight:1 },
    statL: { fontSize:8, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'.3px', marginTop:3 },
    // Chat
    msgAi: { display:'flex', gap:10, marginBottom:12, alignItems:'flex-start' },
    msgStudent: { display:'flex', justifyContent:'flex-end', marginBottom:12 },
    aiAvatar: { width:26, height:26, borderRadius:'50%', background:'var(--purple-bg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'var(--purple)', fontWeight:700, flexShrink:0 },
    aiBubble: { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'2px 10px 10px 10px', padding:'9px 13px', fontSize:12, lineHeight:1.7, color:'var(--t2)', maxWidth:'88%' },
    studentBubble: { background:'var(--t1)', color:'var(--surface)', borderRadius:'10px 2px 10px 10px', padding:'9px 13px', fontSize:12, lineHeight:1.6, maxWidth:'85%' },
    roundMarker: { display:'flex', alignItems:'center', gap:8, margin:'14px 0 10px', cursor:'pointer' },
    roundPill: { fontSize:9, fontWeight:700, padding:'2px 8px', borderRadius:10, background:'var(--surface2)', color:'var(--t2)' },
    roundPillActive: { background:'var(--t1)', color:'var(--surface)' },
    roundLine: { flex:1, height:1, background:'var(--border)' },
    // Understanding gauge
    gaugeWrap: { display:'flex', alignItems:'center', gap:8, marginBottom:4 },
    gaugeBar: { flex:1, height:6, background:'var(--surface2)', borderRadius:3, overflow:'hidden' },
    gaugeFill: { height:'100%', borderRadius:3, transition:'width .3s' },
    // Key info card
    kiCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:8 },
    kiTitle: { fontSize:10, fontWeight:700, color:'var(--t1)', marginBottom:6 },
    kiItem: { fontSize:11, color:'var(--t2)', lineHeight:1.6, padding:'3px 0', display:'flex', gap:6 },
    kiBullet: { color:'var(--t3)', flexShrink:0 },
  };

  // Group conversation into rounds (ai+student pairs)
  const rounds = [];
  let currentRound = [];
  let roundIdx = 0;
  s.conversation.forEach((msg, i) => {
    currentRound.push(msg);
    if (msg.role === 'student' || i === s.conversation.length-1) {
      rounds.push({ idx: roundIdx, messages: [...currentRound], understanding: s.understanding[roundIdx] || 0 });
      currentRound = [];
      roundIdx++;
    }
  });
  // If last message is AI (goal reached or MC prompt), add as final round
  if (currentRound.length > 0) {
    rounds.push({ idx: roundIdx, messages: [...currentRound], understanding: s.understanding[roundIdx] || s.understanding[s.understanding.length-1] });
  }

  const visibleRounds = activeRound !== null ? rounds.slice(0, activeRound+1) : rounds;

  return React.createElement('div', { style:sv.wrap },
    /* Header */
    React.createElement('div', { style:sv.header },
      React.createElement('button', { style:sv.backBtn, onClick:onBack }, '← 返回班级'),
      React.createElement('div', { style:sv.avatar }, s.name[0]),
      React.createElement('div', { style:{ flex:1 } },
        React.createElement('div', { style:{ fontSize:15, fontWeight:600 } }, s.name),
        React.createElement('div', { style:{ fontSize:11, color:'var(--t3)', marginTop:2 } }, `Task ${s.task} · Discuss`),
      ),
      React.createElement('span', { style:{ fontSize:10, fontWeight:600, padding:'3px 10px', borderRadius:4, background: s.goalReached?'var(--green-bg)':'var(--amber-bg)', color: s.goalReached?'var(--green)':'var(--amber)' } },
        s.goalReached ? '✓ 对话达标' : s.mcCorrect ? '△ 选择题答对' : '✕ 选择题答错'),
    ),

    /* Body */
    React.createElement('div', { style:sv.body },
      /* Left: Stats + Conversation */
      React.createElement('div', { style:sv.col },
        /* Stats */
        React.createElement('div', { style:sv.statGrid },
          React.createElement('div', { style:sv.stat },
            React.createElement('div', { style:sv.statN }, s.rounds),
            React.createElement('div', { style:sv.statL }, '对话轮次'),
          ),
          React.createElement('div', { style:sv.stat },
            React.createElement('div', { style:sv.statN }, formatTime(s.time)),
            React.createElement('div', { style:sv.statL }, '讨论用时'),
          ),
          React.createElement('div', { style:sv.stat },
            React.createElement('div', { style:{ ...sv.statN, color: finalU>0.8?'var(--green)':finalU>0.5?'var(--blue)':'var(--amber)' } }, `${Math.round(finalU*100)}%`),
            React.createElement('div', { style:sv.statL }, '最终理解度'),
          ),
        ),

        /* Understanding trajectory mini chart */
        React.createElement('div', { style:{ ...sv.sectionH, marginTop:0 } },
          React.createElement('span', null, '理解力变化'),
          React.createElement('div', { style:sv.sectionLine }),
        ),
        React.createElement('div', { style:{ display:'flex', alignItems:'flex-end', gap:3, height:40, marginBottom:16, padding:'0 4px' } },
          s.understanding.map((u, i) =>
            React.createElement('div', { key:i, onClick:()=>setActiveRound(activeRound===i?null:i),
              style:{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, cursor:'pointer' } },
              React.createElement('div', { style:{ fontSize:8, fontWeight:600, color: activeRound===i?'var(--t1)':'var(--t3)' } }, `${Math.round(u*100)}%`),
              React.createElement('div', { style:{ width:'100%', height:`${u*30}px`, minHeight:2, borderRadius:2, background: activeRound===i?'var(--t1)': u>0.8?'var(--green)':u>0.5?'var(--blue)':'var(--amber)', transition:'all .15s', opacity: activeRound!==null&&activeRound!==i?0.3:1 } }),
              React.createElement('div', { style:{ fontSize:8, color:'var(--t3)' } }, `R${i+1}`),
            )
          ),
        ),
        activeRound !== null && React.createElement('div', { style:{ fontSize:10, color:'var(--t2)', textAlign:'center', marginBottom:12, fontStyle:'italic' } },
          `查看截止第 ${activeRound+1} 轮的对话状态`,
          React.createElement('span', { onClick:()=>setActiveRound(null), style:{ color:'var(--blue)', cursor:'pointer', marginLeft:8, fontStyle:'normal', fontWeight:600 } }, '显示全部'),
        ),

        /* Conversation */
        React.createElement('div', { style:{ ...sv.sectionH } },
          React.createElement('span', null, '完整对话'),
          React.createElement('div', { style:sv.sectionLine }),
        ),

        hasConvo ? visibleRounds.map((round, ri) =>
          React.createElement(Fragment, { key:ri },
            /* Round marker */
            React.createElement('div', { style:sv.roundMarker, onClick:()=>setActiveRound(activeRound===ri?null:ri) },
              React.createElement('span', { style:{ ...sv.roundPill, ...(activeRound===ri?sv.roundPillActive:{}) } }, `Round ${ri+1}`),
              React.createElement('div', { style:sv.roundLine }),
              React.createElement('span', { style:{ fontSize:9, color: round.understanding>0.8?'var(--green)':round.understanding>0.5?'var(--blue)':'var(--amber)', fontWeight:600 } },
                `理解 ${Math.round(round.understanding*100)}%`),
            ),
            /* Messages in this round */
            round.messages.map((msg, mi) =>
              msg.role === 'ai'
                ? React.createElement('div', { key:`${ri}-${mi}`, style:sv.msgAi },
                    React.createElement('div', { style:sv.aiAvatar }, 'S'),
                    React.createElement('div', { style:sv.aiBubble },
                      msg.text.replace('[GOAL_REACHED]','').trim(),
                      msg.text.includes('[GOAL_REACHED]') && React.createElement('div', { style:{ marginTop:8, padding:'6px 10px', borderRadius:6, background:'var(--green-bg)', border:'1px solid rgba(45,102,18,.15)', fontSize:11, fontWeight:600, color:'var(--green)' } }, '🎉 学生达标！'),
                      msg.mc && React.createElement('div', { style:{ marginTop:8, padding:'6px 10px', borderRadius:6, background:'var(--amber-bg)', border:'1px solid rgba(122,77,14,.15)', fontSize:11, fontWeight:600, color:'var(--amber)' } }, '⏱ 触发兜底选择题'),
                    ),
                  )
                : React.createElement('div', { key:`${ri}-${mi}`, style:sv.msgStudent },
                    React.createElement('div', { style:sv.studentBubble }, msg.text),
                  )
            ),
          )
        )
        : React.createElement('div', { style:{ padding:40, textAlign:'center', color:'var(--t3)', fontSize:12 } }, '该学生对话记录未加载（仅展示有详细记录的学生）'),
      ),

      /* Right: Key Information + Class Comparison */
      React.createElement('div', { style:sv.colRight },
        /* Key Information */
        React.createElement('div', { style:{ ...sv.sectionH, marginTop:0 } },
          React.createElement('span', null, '关键发现'),
          React.createElement('div', { style:sv.sectionLine }),
        ),
        React.createElement('div', { style:sv.kiCard },
          React.createElement('div', { style:sv.kiTitle }, '学习状态摘要'),
          s.keyInsights.map((insight, i) =>
            React.createElement('div', { key:i, style:sv.kiItem },
              React.createElement('span', { style:sv.kiBullet }, '·'),
              React.createElement('span', null, insight),
            )
          ),
        ),

        /* Method card */
        React.createElement('div', { style:{ ...sv.kiCard, background: s.goalReached?'var(--green-bg)':'var(--amber-bg)', borderColor: s.goalReached?'rgba(45,102,18,.15)':'rgba(122,77,14,.15)' } },
          React.createElement('div', { style:{ ...sv.kiTitle, color: s.goalReached?'var(--green)':'var(--amber)' } },
            s.goalReached ? '通过苏格拉底对话达标' : '通过兜底选择题完成'),
          React.createElement('div', { style:{ fontSize:10, color:'var(--t3)', marginTop:4 } }, s.goalReached ? '学生在与AI的引导对话中自主得出了正确理解' : '讨论未能自主达标，系统提供了选择题辅助完成'),
          React.createElement('div', { style:{ fontSize:11, color:'var(--t2)', lineHeight:1.6 } },
            s.goalReached
              ? `在第 ${s.rounds} 轮对话中展示了对学习目标的完整理解。`
              : s.mcCorrect
                ? `在 ${s.rounds} 轮对话后未能自主达标，选择题选择了正确答案。`
                : `在 ${s.rounds} 轮对话后未能自主达标，选择题也选错。需要额外关注。`,
          ),
        ),

        /* Understanding breakdown per round */
        React.createElement('div', { style:{ ...sv.sectionH, marginTop:16 } },
          React.createElement('span', null, '逐轮理解度'),
          React.createElement('div', { style:sv.sectionLine }),
        ),
        s.understanding.map((u, i) =>
          React.createElement('div', { key:i, style:{ ...sv.gaugeWrap, cursor:'pointer', opacity: activeRound!==null&&activeRound!==i?0.3:1, transition:'opacity .15s' }, onClick:()=>setActiveRound(activeRound===i?null:i) },
            React.createElement('span', { style:{ fontSize:10, fontWeight:600, color:'var(--t2)', width:28, flexShrink:0 } }, `R${i+1}`),
            React.createElement('div', { style:sv.gaugeBar },
              React.createElement('div', { style:{ ...sv.gaugeFill, width:`${u*100}%`, background: u>0.8?'var(--green)':u>0.5?'var(--blue)':'var(--amber)' } }),
            ),
            React.createElement('span', { style:{ fontSize:10, fontWeight:600, color:'var(--t2)', width:32, textAlign:'right' } }, `${Math.round(u*100)}%`),
            i>0 && React.createElement('span', { style:{ fontSize:9, fontWeight:600, color: (u-s.understanding[i-1])>0?'var(--green)':'var(--red)', width:36 } },
              `${(u-s.understanding[i-1])>0?'+':''}${Math.round((u-s.understanding[i-1])*100)}%`),
          )
        ),

        /* Class comparison */
        React.createElement('div', { style:{ ...sv.sectionH, marginTop:20 } },
          React.createElement('span', null, '班级对比'),
          React.createElement('div', { style:sv.sectionLine }),
        ),
        React.createElement('div', { style:sv.kiCard },
          [
            { label:'轮次', val:s.rounds, avg:parseFloat((STUDENTS.reduce((a,st)=>a+st.rounds,0)/STUDENTS.length).toFixed(1)), max:8, unit:'' },
            { label:'用时', val:s.time, avg:Math.round(STUDENTS.reduce((a,st)=>a+st.time,0)/STUDENTS.length), max:360, unit:'s', format:formatTime },
            { label:'最终理解', val:Math.round(finalU*100), avg:Math.round(STUDENTS.reduce((a,st)=>a+st.understanding[st.understanding.length-1],0)/STUDENTS.length*100), max:100, unit:'%' },
          ].map((row, i) =>
            React.createElement('div', { key:i, style:{ display:'flex', alignItems:'center', gap:8, marginBottom:8 } },
              React.createElement('span', { style:{ fontSize:10, color:'var(--t3)', width:50, flexShrink:0 } }, row.label),
              React.createElement('div', { style:{ flex:1, height:14, background:'var(--surface2)', borderRadius:3, position:'relative', overflow:'visible' } },
                /* Class avg marker */
                React.createElement('div', { style:{ position:'absolute', left:`${row.avg/row.max*100}%`, top:-2, width:2, height:18, background:'var(--border-strong)', borderRadius:1, zIndex:1 } }),
                /* Student bar */
                React.createElement('div', { style:{ height:'100%', width:`${row.val/row.max*100}%`, borderRadius:3, background: row.val>row.avg?'var(--green)':'var(--amber)', opacity:0.7 } }),
              ),
              React.createElement('span', { style:{ fontSize:10, fontWeight:600, color:'var(--t1)', width:40, textAlign:'right' } }, row.format ? row.format(row.val) : `${row.val}${row.unit}`),
            )
          ),
          React.createElement('div', { style:{ display:'flex', gap:12, marginTop:4, fontSize:9, color:'var(--t3)' } },
            React.createElement('span', { style:{ display:'flex', alignItems:'center', gap:3 } }, React.createElement('span', { style:{ width:8, height:4, borderRadius:2, background:'var(--green)', display:'inline-block', opacity:.7 } }), '该学生'),
            React.createElement('span', { style:{ display:'flex', alignItems:'center', gap:3 } }, React.createElement('span', { style:{ width:2, height:10, borderRadius:1, background:'var(--border-strong)', display:'inline-block' } }), '班级均值'),
          ),
        ),
      ),
    ),
  );
}


/* ═══ TIMELINE SCRUBBER ═══ */
function TimelineScrubber({ elapsed, total, onSeek, isLive, onToggleLive }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const pct = Math.min(elapsed / total * 100, 100);

  const handleTrackClick = (e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(Math.round(x * total));
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    const onMove = (ev) => {
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      onSeek(Math.round(x * total));
    };
    const onUp = () => { setDragging(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const tlS = {
    wrap: { display:'flex', alignItems:'center', height:40, padding:'0 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 },
    time: { fontSize:12, fontWeight:700, color:'var(--t1)', minWidth:42, textAlign:'center', fontVariantNumeric:'tabular-nums' },
    trackWrap: { flex:1, position:'relative', height:24, display:'flex', alignItems:'center', cursor:'pointer' },
    track: { width:'100%', height:6, background:'var(--surface2)', borderRadius:3, position:'relative', overflow:'visible' },
    fill: { height:'100%', borderRadius:3, background:'var(--t1)', position:'absolute', top:0, left:0, transition: dragging?'none':'width .15s' },
    thumb: { width:14, height:14, borderRadius:'50%', background:'var(--t1)', border:'2px solid var(--surface)', boxShadow:'0 1px 4px rgba(0,0,0,.2)', position:'absolute', top:'50%', transform:'translate(-50%,-50%)', cursor:'grab', zIndex:2, transition: dragging?'none':'left .15s' },
    total: { fontSize:12, color:'var(--t3)', minWidth:42, textAlign:'center' },
    liveTag: { fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:3, cursor:'pointer', border:'none', fontFamily:'inherit' },
  };

  // Round markers at ~each minute
  const markers = [];
  for (let t=60; t<total; t+=60) markers.push(t/total*100);

  return React.createElement('div', { style:tlS.wrap },
    React.createElement('div', { style:tlS.time }, formatTime(elapsed)),
    React.createElement('div', { ref:trackRef, style:tlS.trackWrap, onClick:handleTrackClick },
      React.createElement('div', { style:tlS.track },
        markers.map((m,i) => React.createElement('div', { key:i, style:{ position:'absolute', top:'50%', transform:'translate(-50%,-50%)', left:`${m}%`, width:1.5, height:10, borderRadius:1, background:'var(--t1)', opacity:0.12 } })),
        React.createElement('div', { style:{ ...tlS.fill, width:`${pct}%` } }),
      ),
      React.createElement('div', { style:{ ...tlS.thumb, left:`${pct}%` }, onMouseDown:handleMouseDown }),
    ),
    React.createElement('div', { style:tlS.total }, formatTime(total)),
    React.createElement('button', { style:{ ...tlS.liveTag, background: isLive?'var(--green-bg)':'var(--amber-bg)', color: isLive?'var(--green)':'var(--amber)' }, onClick:onToggleLive },
      isLive ? '● 实时' : '回放'),
  );
}

/* ═══ MAIN APP ═══ */
function DiscussObserveApp() {
  const [view, setView] = useState('class'); // 'class' | 'student'
  const [selectedStudent, setSelectedStudent] = useState(null);
  const STEP_TOTAL = 360; // 6 min max for this discuss step
  const [elapsed, setElapsed] = useState(312); // current playback position
  const [isLive, setIsLive] = useState(true);

  const handleSeek = (t) => { setElapsed(t); setIsLive(false); };
  const handleToggleLive = () => { if (!isLive) { setElapsed(312); setIsLive(true); } };

  const selectStudent = (s) => {
    if (!s) return;
    setSelectedStudent(s);
    setView('student');
  };

  return React.createElement('div', { style:S.shell },
    /* Band */
    React.createElement('div', { style:S.band },
      React.createElement('div', { style:S.bandMark }, 'R'),
      React.createElement('div', { style:S.bandTitle }, 'Discuss 观察'),
      React.createElement('div', { style:S.bandTag }, 'Task 3 · Scan & Build'),
      React.createElement('div', { style:S.bandMeta }, '高一(3)班 · 16 人已完成讨论'),
      React.createElement('div', { style:S.bandRight },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--green)' } },
          React.createElement('span', { style:{ width:6, height:6, borderRadius:'50%', background:'var(--green)', animation:'pulse-dot 2s infinite' } }),
          '实时',
        ),
      ),
    ),

    /* Timeline */
    React.createElement(TimelineScrubber, { elapsed, total:STEP_TOTAL, onSeek:handleSeek, isLive, onToggleLive:handleToggleLive }),

    /* Tabs */
    React.createElement('div', { style:S.tabs },
      React.createElement('button', { style:{ ...S.tab, ...(view==='class'?S.tabActive:{}) }, onClick:()=>setView('class') }, `班级总览 · ${STUDENTS.length}人`),
      selectedStudent && React.createElement('button', { style:{ ...S.tab, ...(view==='student'?S.tabActive:{}) }, onClick:()=>setView('student') }, `📋 ${selectedStudent.name}`),
    ),

    /* Main content */
    React.createElement('div', { style:S.main },
      view === 'class'
        ? React.createElement(ClassView, { onSelectStudent:selectStudent })
        : selectedStudent
          ? React.createElement(StudentView, { student:selectedStudent, onBack:()=>setView('class') })
          : null,
    ),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(DiscussObserveApp));
