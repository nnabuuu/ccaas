/* ═══════════════════════════════════════════════════════════
   Teacher Console v5 — Shared Mock Data
   Merges component-observation-v2 + discuss-observe data
   ═══════════════════════════════════════════════════════════ */

const COMP_TYPES = {
  lecture:  { label: '讲解', color: 'var(--teal)',   bg: 'var(--teal-soft)',   dotColor: '#0d5245' },
  practice: { label: '练习', color: 'var(--blue)',   bg: 'var(--blue-soft)',   dotColor: '#1a5fa0' },
  discuss:  { label: '讨论', color: 'var(--ai)',     bg: 'var(--ai-soft)',     dotColor: '#4a4387' },
  summary:  { label: '总结', color: 'var(--green)',  bg: 'var(--green-soft)',  dotColor: '#2d6612' },
};

const STEPS = [
  {
    id: 1, name: 'Predict', type: '图式激活', time: '5 min', studentCount: 0,
    components: [
      { id:'c1-1', type:'practice', label:'阅读前两段 + 回答', status:'done', students:{done:42,prog:0,stuck:0}, metrics:{accuracy:95} },
      { id:'c1-2', type:'discuss', label:'Discuss: 核心冲突', status:'done', students:{done:42,prog:0,stuck:0}, metrics:{goalRate:88,avgRounds:2.1} },
    ],
  },
  {
    id: 2, name: 'Skim', type: '结构解码', time: '8 min', studentCount: 4,
    components: [
      { id:'c2-1', type:'practice', label:'略读 + 结构匹配', status:'done', students:{done:38,prog:4,stuck:0}, metrics:{accuracy:83} },
      { id:'c2-2', type:'discuss', label:'Discuss: 语篇结构', status:'active', students:{done:36,prog:4,stuck:2}, metrics:{goalRate:72,avgRounds:3.1} },
    ],
  },
  {
    id: 3, name: 'Scan & Build', type: '信息矩阵', time: '15 min', studentCount: 26,
    components: [
      { id:'c3-1', type:'lecture', label:'讲解: 寻读策略', status:'done', students:{done:42,prog:0,stuck:0}, metrics:{} },
      { id:'c3-2', type:'practice', label:'填写信息矩阵', status:'active', students:{done:12,prog:10,stuck:4}, metrics:{accuracy:31, weakDim:'Why 列'} },
      { id:'c3-3', type:'discuss', label:'Discuss: 美的文化语言', status:'active', students:{done:10,prog:9,stuck:7}, metrics:{goalRate:38,avgRounds:4.2,fallback:7,fallbackCorrect:4} },
      { id:'c3-4', type:'summary', label:'任务总结', status:'future', students:{done:0,prog:0,stuck:0}, metrics:{} },
    ],
  },
  {
    id: 4, name: 'Evaluate', type: '批判质疑', time: '12 min', studentCount: 10,
    components: [
      { id:'c4-1', type:'practice', label:'观点 + 证据表达', status:'active', students:{done:4,prog:5,stuck:1}, metrics:{accuracy:40} },
      { id:'c4-2', type:'discuss', label:'Discuss: 评价作者观点', status:'waiting', students:{done:0,prog:3,stuck:0}, metrics:{goalRate:0,avgRounds:1.5} },
    ],
  },
  {
    id: 5, name: 'Wrap-up', type: '策略复盘', time: '5 min', studentCount: 2,
    components: [
      { id:'c5-1', type:'practice', label:'策略排序 + 迁移', status:'waiting', students:{done:1,prog:1,stuck:0}, metrics:{} },
    ],
  },
];

const OBSERVATIONS = [
  {
    id:1, severity:'urg', stepId:3, componentId:'c3-3', componentLabel:'Discuss',
    title:'7 人理解度 < 30%，触发兜底选择题',
    detail:'Myanmar/Indonesia 内容合并导致矩阵错误，Discuss 中无法归纳文化语言概念',
    students:['黄婉晴','徐晨曦','郭斐然','邓梓涵','董思齐','冯璐','谢安然'],
    time:'刚刚',
    actions:['推送 ¶7 分隔提示','暂停 T3.Discuss'],
  },
  {
    id:2, severity:'warn', stepId:3, componentId:'c3-2', componentLabel:'练习',
    title:'Why 列空缺率 58%',
    detail:'学生能提取 Where/What 但不能归纳 Hidden Reason',
    students:['王译文','刘子墨','孙楠语','蔡明轩','吴思涵','胡恩齐'],
    time:'3 分钟前',
    actions:['推送 Why 列支架句','加入 Discuss 引导'],
  },
  {
    id:3, severity:'warn', stepId:3, componentId:'c3-3', componentLabel:'Discuss',
    title:'tā moko 与 tattoos 术语混淆',
    detail:'4 人在 Discuss 中使用泛称 tattoos，未识别文化特异性',
    students:['王译文','刘子墨','孙楠语','蔡明轩'],
    time:'2 分钟前',
    actions:['推送术语对比卡'],
  },
  {
    id:4, severity:'info', stepId:2, componentId:'c2-2', componentLabel:'Discuss',
    title:'T2.Discuss 2 人卡在结构归纳',
    detail:'赵雪莉、何子睿在 Discuss 中反复回答细节而非结构',
    students:['赵雪莉','何子睿'],
    time:'5 分钟前',
    actions:['提示关注段首句'],
  },
  {
    id:5, severity:'info', stepId:4, componentId:'c4-1', componentLabel:'练习',
    title:'证据引用不足',
    detail:'3 人表达了观点但未引用任何文本证据',
    students:['叶瑞','潘悦','曾以柔'],
    time:'1 分钟前',
    actions:['推送支架句提示'],
  },
];

/* ─── Discuss-specific student data (for T3 Discuss deep-dive) ─── */
const DISCUSS_STUDENTS = [
  { id:1, name:'王译文', method:'socratic', goalReached:true, rounds:5, time:267, mcCorrect:null,
    keyInsights:['识别了冲突开头手法','理解了文化深意但表述不够完整','第4轮突破：将beauty与identity关联'],
    understanding:[0.2,0.35,0.5,0.7,0.95],
    conversation:[
      {role:'ai',text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student',text:"I think humans care about looking good, but also about culture."},
      {role:'ai',text:"Interesting! You mentioned culture. Can you pick one specific example from your matrix and tell me — what does that beauty practice say about culture?"},
      {role:'student',text:"In Borneo, tattoos record life events. So it's not just about beauty, it's about their history."},
      {role:'ai',text:"Exactly! So the Borneo tattoo isn't really about 'looking good' at all — it's about recording identity. Now, does this pattern hold for the other examples too?"},
      {role:'student',text:"Yes! Maori tā moko shows social position, and in Myanmar, the neck rings show cultural identity. So beauty practices are really about identity and status and belonging."},
      {role:'ai',text:"[GOAL_REACHED] Brilliant! You've discovered something really important — beauty across cultures is a language that communicates identity, status, and belonging, not just appearance."},
    ]
  },
  { id:2, name:'黄婉晴', method:'fallback', goalReached:false, rounds:6, time:312, mcCorrect:true,
    keyInsights:['将Myanmar和Indonesia内容合并','未能区分tā moko与generic tattoos','兜底选择题答对'],
    understanding:[0.1,0.15,0.2,0.25,0.3,0.35],
    conversation:[
      {role:'ai',text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student',text:"我觉得人类在乎好看吧。"},
      {role:'ai',text:"That's a natural first reaction! But let's look more carefully at one example. Take the Borneo tattoo — is getting a tattoo really about 'looking good'?"},
      {role:'student',text:"Maybe not. The tattoo records things about their life."},
      {role:'ai',text:"Good observation! So if the tattoo records life events, what is it really communicating?"},
      {role:'student',text:"It communicates... their experience? Like a diary on skin?"},
      {role:'ai',text:"I like that metaphor — 'a diary on skin'! So beauty here is more like a language. Now, does this idea — beauty as communication — apply to the other cultures in your matrix?"},
      {role:'student',text:"Um... I think so but I'm not sure about the Myanmar and Indonesia ones. They seem similar to me."},
      {role:'ai',text:"Let me give you a question to help:", mc:true},
    ],
  },
  { id:3, name:'徐晨曦', method:'fallback', goalReached:false, rounds:6, time:300, mcCorrect:false,
    keyInsights:['始终停留在表面理解','混淆了Myanmar和Indonesia','兜底选择题选错'],
    understanding:[0.1,0.12,0.15,0.18,0.2,0.22],
    conversation:[
      {role:'ai',text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student',text:"Humans care about looking good."},
      {role:'ai',text:"Okay! Can you look at one specific row in your matrix — say, the Maori tā moko — and tell me, is it really about 'looking good'?"},
      {role:'student',text:"Yes, the tattoo looks cool."},
      {role:'ai',text:"It does look impressive! But the text says something specific about what the tā moko represents. Can you find that detail in ¶5?"},
      {role:'student',text:"It shows their family and rank."},
      {role:'ai',text:"Right! So if it shows family and rank, is the tā moko mainly about beauty, or about something else?"},
      {role:'student',text:"I guess about family? But it's still about looking good too."},
      {role:'ai',text:"Let me give you a question to help:", mc:true},
    ],
  },
  { id:4, name:'陈昕妍', method:'socratic', goalReached:true, rounds:3, time:145, mcCorrect:null,
    keyInsights:['快速理解文化语言概念','第2轮就开始归纳','表达流畅，英文输出质量高'],
    understanding:[0.4,0.75,0.95],
    conversation:[
      {role:'ai',text:"Look at your completed matrix. If someone from another planet read it, would they conclude that humans care about 'looking good'? Or is something deeper going on?"},
      {role:'student',text:"I think there's something deeper. Each practice has a cultural meaning — like identity or social status. It's not just about appearance."},
      {role:'ai',text:"That's a really strong observation! Can you give me a specific example from the matrix to support that idea?"},
      {role:'student',text:"For example, Maori tā moko shows social position and family history. And Borneo tattoos record life experiences. So beauty is like a cultural language — it communicates who you are, not just how you look."},
      {role:'ai',text:"[GOAL_REACHED] Wow, you nailed it! Beauty IS a cultural language — it communicates identity, status, and belonging. That's the key insight of this entire section."},
    ]
  },
  { id:5, name:'李奕辰', method:'socratic', goalReached:true, rounds:4, time:198, mcCorrect:null,
    keyInsights:['用中文回答但理解准确','第3轮开始用英文','理解了文化深意'],
    understanding:[0.25,0.45,0.7,0.9],
    conversation:[]
  },
  { id:6, name:'郭斐然', method:'fallback', goalReached:false, rounds:6, time:305, mcCorrect:true,
    keyInsights:['理解碎片化，无法归纳','混淆了different practices的purpose','兜底选择题答对但理解仍浅'],
    understanding:[0.1,0.2,0.25,0.3,0.28,0.32],
    conversation:[]
  },
  { id:7, name:'张皓月', method:'socratic', goalReached:true, rounds:4, time:210, mcCorrect:null, keyInsights:['理解较好'], understanding:[0.3,0.5,0.75,0.92], conversation:[] },
  { id:8, name:'周航宇', method:'socratic', goalReached:true, rounds:5, time:250, mcCorrect:null, keyInsights:['稳步提升'], understanding:[0.2,0.35,0.55,0.8,0.93], conversation:[] },
  { id:9, name:'郑若曦', method:'socratic', goalReached:true, rounds:4, time:195, mcCorrect:null, keyInsights:['表达流畅'], understanding:[0.35,0.55,0.8,0.95], conversation:[] },
  { id:10, name:'邓梓涵', method:'fallback', goalReached:false, rounds:6, time:300, mcCorrect:true, keyInsights:['理解困难'], understanding:[0.1,0.15,0.2,0.22,0.25,0.3], conversation:[] },
  { id:11, name:'董思齐', method:'fallback', goalReached:false, rounds:6, time:295, mcCorrect:false, keyInsights:['完全卡住'], understanding:[0.1,0.1,0.12,0.15,0.15,0.18], conversation:[] },
  { id:12, name:'冯璐', method:'fallback', goalReached:false, rounds:6, time:310, mcCorrect:true, keyInsights:['混淆概念'], understanding:[0.15,0.2,0.25,0.2,0.25,0.3], conversation:[] },
  { id:13, name:'谢安然', method:'fallback', goalReached:false, rounds:6, time:298, mcCorrect:false, keyInsights:['语言障碍'], understanding:[0.1,0.12,0.15,0.18,0.2,0.2], conversation:[] },
  { id:14, name:'马乐瑶', method:'socratic', goalReached:true, rounds:5, time:275, mcCorrect:null, keyInsights:['后半段突破'], understanding:[0.15,0.25,0.4,0.65,0.9], conversation:[] },
  { id:15, name:'林澜', method:'socratic', goalReached:true, rounds:5, time:260, mcCorrect:null, keyInsights:['稳步进步'], understanding:[0.2,0.35,0.5,0.7,0.88], conversation:[] },
  { id:16, name:'朱思语', method:'socratic', goalReached:true, rounds:3, time:160, mcCorrect:null, keyInsights:['快速达标'], understanding:[0.4,0.7,0.92], conversation:[] },
];

const MISCONCEPTIONS = [
  { id:1, label:'Myanmar/Indonesia 内容合并', count:7, students:['黄婉晴','徐晨曦','郭斐然','邓梓涵','董思齐','冯璐','谢安然'], severity:'high' },
  { id:2, label:'tā moko 与 generic tattoos 混淆', count:4, students:['王译文','郭斐然','徐晨曦','冯璐'], severity:'medium' },
  { id:3, label:'停留在 "looking good" 表面理解', count:5, students:['徐晨曦','董思齐','谢安然','郭斐然','邓梓涵'], severity:'medium' },
  { id:4, label:'无法从具体例子归纳到抽象概念', count:3, students:['郭斐然','邓梓涵','冯璐'], severity:'low' },
];

const QUESTIONS = [
  { student:'黄婉晴', q:'What does "shallow" mean?', time:'4分钟前', cat:'concept', answer:'Shallow = 肤浅。Media beauty is "shallow" because it only cares about looks, ignoring cultural meaning.' },
  { student:'赵雪莉', q:'What is "Phenomenon"? 不懂这个词', time:'6分钟前', cat:'concept', answer:'Phenomenon = 现象。¶1-2 describes a phenomenon: different cultures have different beauty standards.' },
  { student:'王译文', q:'Myanmar 在哪里？地理位置不明', time:'4分钟前', cat:'content', answer:'Myanmar（缅甸）在东南亚。先跳过位置，重点看 ¶7 讲了那里女性做什么。' },
  { student:'徐晨曦', q:'Can I write "tattoos" or must I write "tā moko"?', time:'6分钟前', cat:'content', answer:'For NZ Maori, use the specific term "tā moko" — it\'s different from general tattoos.' },
  { student:'许天乐', q:'怎么写 disagree 的论据段', time:'3分钟前', cat:'task', answer:'Pattern: "I disagree because..." + evidence from matrix + explanation of what it proves.' },
  { student:'董思齐', q:'Scanning 和 Skimming 有什么区别？', time:'7分钟前', cat:'strategy', answer:'Skimming finds structure. Scanning finds specific details.' },
];

function formatTime(s) { const m=Math.floor(s/60),ss=s%60; return `${m}:${ss<10?'0':''}${ss}`; }

Object.assign(window, { COMP_TYPES, STEPS, OBSERVATIONS, DISCUSS_STUDENTS, MISCONCEPTIONS, QUESTIONS, formatTime });
