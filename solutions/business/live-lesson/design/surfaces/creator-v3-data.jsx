/* ════════════════════════════════════════════════
   Creator v3 — Data: Registry, Plan, Lesson, Schema
   ════════════════════════════════════════════════ */

/* ── Component Type Registry (extended with completion defaults) ── */
const COMP_REG = {
  explain:  {label:'讲解',  icon:'▣', color:'var(--t2)',    bg:'var(--surface2)', hasObserve:false, defaultCompletion:'manual'},
  reading:  {label:'阅读',  icon:'≡', color:'var(--amber)', bg:'var(--amber-bg)', hasObserve:false, defaultCompletion:'manual'},
  video:    {label:'视频',  icon:'▶', color:'var(--teal)',  bg:'var(--teal-bg)',  hasObserve:false, defaultCompletion:'manual'},
  choice:   {label:'选择题',icon:'○', color:'var(--blue)',  bg:'var(--blue-bg)',  hasObserve:true, defaultCompletion:'hard',
    metrics:[
      {id:'accuracy',label:'正确率',desc:'全班整体正确率',unit:'%',defThresh:70,defSev:'warn'},
      {id:'firstAttempt',label:'首次正确率',desc:'一次答对比例',unit:'%',defThresh:60,defSev:'info'},
      {id:'misconceptions',label:'误解聚类',desc:'相同错误模式自动分组',unit:'人',defThresh:3,defSev:'warn'},
      {id:'changeAnswer',label:'改答案追踪',desc:'改答案的学生及方向',hasThresh:false},
      {id:'timePerQ',label:'每题用时',desc:'每题平均作答时间',unit:'s',defThresh:45,defSev:'info'},
      {id:'optionDistrib',label:'选项分布',desc:'各选项选择人数',hasThresh:false},
    ], views:['班级总览','逐题分析','误解聚类','学生详情']},
  fill:     {label:'填空题',icon:'▭', color:'var(--teal)',  bg:'var(--teal-bg)',  hasObserve:true, defaultCompletion:'hard',
    metrics:[
      {id:'accuracy',label:'正确率',desc:'全班填空正确率',unit:'%',defThresh:70,defSev:'warn'},
      {id:'partialMatch',label:'部分匹配率',desc:'部分正确的比例',unit:'%',hasThresh:false},
      {id:'commonErrors',label:'常见错误',desc:'高频错误答案聚类',unit:'人',defThresh:3,defSev:'warn'},
    ], views:['班级总览','逐空分析','学生详情']},
  discuss:  {label:'讨论',  icon:'◬', color:'var(--purple)',bg:'var(--purple-bg)',hasObserve:true, defaultCompletion:'ai_eval',
    metrics:[
      {id:'goalRate',label:'达标率',desc:'通过对话达标的比例',unit:'%',defThresh:60,defSev:'warn'},
      {id:'avgRounds',label:'平均轮次',desc:'达标所需平均轮次',hasThresh:false},
      {id:'fallbackCount',label:'兜底人数',desc:'触发兜底选择题的人数',unit:'人',defThresh:5,defSev:'urg'},
      {id:'understanding',label:'理解度',desc:'逐轮理解度变化趋势',unit:'%',defThresh:30,defSev:'urg'},
      {id:'fallbackCorrect',label:'兜底正确率',desc:'兜底选择题的正确率',unit:'%',defThresh:50,defSev:'warn'},
    ], views:['结果漏斗','逐轮理解','误解聚类','对话回放','学生详情']},
  matrix:   {label:'矩阵填空',icon:'▦',color:'var(--teal)',bg:'var(--teal-bg)',hasObserve:true, defaultCompletion:'hard',
    metrics:[
      {id:'completion',label:'完成率',desc:'矩阵单元格填写率',unit:'%',defThresh:80,defSev:'info'},
      {id:'accuracy',label:'准确率',desc:'填写内容正确率',unit:'%',defThresh:60,defSev:'warn'},
      {id:'weakDim',label:'薄弱维度',desc:'空缺率最高的列',hasThresh:false},
    ], views:['班级总览','维度热力图','学生详情']},
  evidence: {label:'证据选择',icon:'◈',color:'var(--teal)',bg:'var(--teal-bg)',hasObserve:true, defaultCompletion:'hard',
    metrics:[
      {id:'funcAccuracy',label:'功能识别率',desc:'段落功能识别正确率',unit:'%',defThresh:70,defSev:'warn'},
      {id:'evidenceHit',label:'证据命中率',desc:'正确选择证据短语率',unit:'%',defThresh:60,defSev:'warn'},
      {id:'signalConfusion',label:'信号混淆',desc:'混淆signal与practice',unit:'人',defThresh:3,defSev:'warn'},
    ], views:['班级总览','逐段分析','学生详情']},
  map:      {label:'坐标图',icon:'◎',color:'var(--blue)',bg:'var(--blue-bg)',hasObserve:true, defaultCompletion:'hard',
    metrics:[
      {id:'placementAcc',label:'放置准确率',desc:'与参考位置的偏差',unit:'%',defThresh:60,defSev:'warn'},
      {id:'reasonQuality',label:'理由质量',desc:'reasoning的质量评分',unit:'分',defThresh:3,defSev:'warn'},
      {id:'clusterCenter',label:'中间聚集',desc:'放在原点附近的人数',unit:'人',defThresh:4,defSev:'warn'},
    ], views:['班级总览','坐标散点图','学生详情']},
  sorting:  {label:'排序题',icon:'↕',color:'var(--amber)',bg:'var(--amber-bg)',hasObserve:true, defaultCompletion:'hard',
    metrics:[
      {id:'exactOrder',label:'完全正确率',desc:'排序完全正确的比例',unit:'%',defThresh:50,defSev:'warn'},
    ], views:['班级总览','学生详情']},
  classify: {label:'分类题',icon:'⊞',color:'var(--coral)',bg:'var(--coral-bg)',hasObserve:true, defaultCompletion:'hard',
    metrics:[
      {id:'accuracy',label:'分类正确率',desc:'分类正确的比例',unit:'%',defThresh:70,defSev:'warn'},
    ], views:['班级总览','学生详情']},
  matching: {label:'连线题',icon:'⟷',color:'var(--purple)',bg:'var(--purple-bg)',hasObserve:true, defaultCompletion:'hard',
    metrics:[
      {id:'accuracy',label:'配对正确率',desc:'配对正确比例',unit:'%',defThresh:70,defSev:'warn'},
    ], views:['班级总览','学生详情']},
  poll:     {label:'投票',icon:'▮',color:'var(--blue)',bg:'var(--blue-bg)',hasObserve:true, defaultCompletion:'manual',
    metrics:[
      {id:'distribution',label:'投票分布',desc:'各选项实时分布',hasThresh:false},
    ], views:['实时分布']},
};

const AI_ACTIONS = [
  {id:'alert',label:'提醒教师',icon:'🔔',desc:'在教师端弹出提醒通知'},
  {id:'push',label:'推送内容',icon:'📤',desc:'向目标学生推送支架/提示'},
  {id:'pause',label:'暂停活动',icon:'⏸',desc:'暂停当前学习活动'},
  {id:'scaffold',label:'插入支架',icon:'🧩',desc:'自动插入学习支架'},
  {id:'fallback',label:'触发兜底',icon:'🔄',desc:'切换到兜底题型'},
];
const OPS = [{id:'<',label:'<'},{id:'<=',label:'≤'},{id:'>',label:'>'},{id:'>=',label:'≥'},{id:'==',label:'='}];
const SEVERITIES = [
  {id:'urg',label:'紧急',color:'var(--red)',bg:'var(--red-bg)'},
  {id:'warn',label:'注意',color:'var(--amber)',bg:'var(--amber-bg)'},
  {id:'info',label:'信息',color:'var(--blue)',bg:'var(--blue-bg)'},
];
const COMPLETION_TYPES = [
  {id:'manual',label:'手动推进',desc:'学生完成浏览后点击下一步',color:'neutral',icon:'▸'},
  {id:'hard',label:'硬性指标',desc:'系统确定性判定（如答对≥75%）',color:'green',icon:'✓'},
  {id:'ai_eval',label:'AI 评估',desc:'Evaluator LLM 判定 + 时间兜底',color:'purple',icon:'✦'},
];

/* ── Plan Data (教案设计) ── */
const PLAN_DATA = {
  lessonInfo: { title:'Ideal Beauty', source:'Textbook Unit 3', subject:'英语', grade:'高一', duration:45, classGroup:'高一(3)班' },
  teachingRequirements: [
    {id:'r1', text:'识别课文中的语篇结构（现象→历史→文化→结论）', covered:true},
    {id:'r2', text:'理解 "beauty practices as cultural language" 的核心论点', covered:true},
    {id:'r3', text:'分析至少 3 种文化中美的实践的目的和意义', covered:true},
    {id:'r4', text:'批判性评价作者对现代媒体美的标准的观点', covered:true},
    {id:'r5', text:'运用 skimming / scanning 阅读策略完成信息提取', covered:true},
  ],
  objectives: [
    {category:'语言能力', items:['通过上下文线索推断生词含义','识别并分析语篇结构信号词']},
    {category:'思维品质', items:['分析不同文化中美的实践背后的逻辑','批判性评价作者的论点和证据']},
    {category:'文化意识', items:['理解美的文化多样性','反思媒体对美的标准的影响']},
  ],
  moduleOutline: [
    {name:'Predict', desc:'图式激活 · 从标题预测主题', time:5},
    {name:'Skim', desc:'结构解码 · 语篇结构识别', time:8},
    {name:'Scan & Build', desc:'信息矩阵 · 多维度信息提取', time:15},
    {name:'Evaluate', desc:'批判质疑 · 评价作者观点', time:12},
    {name:'Wrap-up', desc:'策略复盘 · 学习总结', time:5},
  ],
};

/* ── File System Tree ── */
const FILE_TREE = [
  {name:'plan/', type:'folder', indent:0},
  {name:'lesson-plan.md', type:'file', indent:1, desc:'课文信息 + 教学概述', size:'1.2kb'},
  {name:'objectives.md', type:'file', indent:1, desc:'核心素养目标', size:'0.8kb'},
  {name:'requirements.md', type:'file', indent:1, desc:'教学要求清单', size:'0.6kb'},
  {name:'module-outline.md', type:'file', indent:1, desc:'大模块划分', size:'0.5kb'},
  {name:'execution/', type:'folder', indent:0},
  {name:'manifest.json', type:'file', indent:1, desc:'模块列表（学生端原样消费）', size:'4.8kb'},
  {name:'record/', type:'folder', indent:0},
  {name:'session-log.json', type:'file', indent:1, desc:'（课堂后自动生成）', size:'—'},
  {name:'ai-interactions.json', type:'file', indent:1, desc:'（AI tutor 对话记录）', size:'—'},
];

/* ── Skills Data ── */
const SKILLS_DATA = [
  {name:'Discussion Facilitator', scope:'模块级', desc:'引导学生在讨论模块中深入思考。使用苏格拉底式提问，鼓励学生从课文中找证据，不直接给出答案。', modules:['discuss']},
  {name:'Reading Comprehension Tutor', scope:'模块级', desc:'协助学生理解课文。通过上下文线索引导词义推断，标注关键段落和修辞手法。', modules:['reading','evidence']},
  {name:'Completion Evaluator', scope:'系统级', desc:'评估学生在开放模块中的达标程度。根据 completion rubric 判定学生是否满足完成条件。', modules:['discuss','map']},
  {name:'Misconception Detector', scope:'系统级', desc:'检测学生的常见误解模式。自动聚类相同错误，为教师提供干预建议。', modules:['choice','matrix','evidence']},
];

/* ── Lesson Data (with explicit completion conditions) ── */
const LESSON_V3 = {
  title:'Ideal Beauty', subject:'英语', grade:'高一', classGroup:'高一(3)班', duration:45,
  steps: [
    { id:'s1', title:'Predict', type:'图式激活', duration:5, collapsed:false, blocks:[
      {id:'b1', type:'explain', title:'标题预测引导', desc:'从标题 Ideal Beauty 激活主题经验', duration:2,
        completion:{type:'manual'},
        observe:{metrics:[],views:[],rules:[]}},
      {id:'b2', type:'choice', title:'快速理解检查', desc:'前两段核心冲突识别 · 3题', duration:3,
        completion:{type:'hard', rule:'score >= 0.75'},
        content:{questions:[
          {stem:'Who is Happiness Edem and what did she do?', options:['A student who studied beauty','A woman who gained weight for cultural reasons','A model in a fashion magazine','A doctor researching beauty'], correct:1, tag:'Comprehension'},
          {stem:'What kind of beauty does modern media promote?', options:['Cultural diversity','Slim and fair appearance','Traditional practices','Natural beauty'], correct:1, tag:'Comprehension'},
          {stem:'What is the writer\'s main question?', options:['Why do people want to be beautiful?','Is one idea of beauty better than another?','How has beauty changed?','Why is media bad?'], correct:1, tag:'Main Idea'},
        ]},
        observe:{metrics:[
          {id:'accuracy',enabled:true,threshold:70,severity:'warn'},{id:'firstAttempt',enabled:true,threshold:60,severity:'info'},
          {id:'misconceptions',enabled:true,threshold:3,severity:'warn'},{id:'changeAnswer',enabled:true},
          {id:'timePerQ',enabled:false},{id:'optionDistrib',enabled:true},
        ],views:['班级总览','逐题分析','误解聚类','学生详情'],rules:[
          {id:'r1',condition:{metric:'accuracy',op:'<',value:70},action:{type:'alert',message:'正确率低于70%，建议重点讲解'}},
        ]}},
    ]},
    { id:'s2', title:'Skim', type:'结构解码', duration:8, collapsed:false, blocks:[
      {id:'b3', type:'explain', title:'略读策略讲解', desc:'介绍 skimming 策略和语篇结构识别', duration:3,
        completion:{type:'manual'}, observe:{metrics:[],views:[],rules:[]}},
      {id:'b4', type:'evidence', title:'语篇结构匹配', desc:'为每段选择功能标签 + 定位结构证据', duration:5,
        completion:{type:'hard', rule:'funcAccuracy >= 0.70'},
        content:{sections:[{label:'¶1-2',func:'Phenomenon'},{label:'¶3-4',func:'History'},{label:'¶5-7',func:'Culture'},{label:'¶8',func:'Conclusion'}]},
        observe:{metrics:[
          {id:'funcAccuracy',enabled:true,threshold:70,severity:'warn'},{id:'evidenceHit',enabled:true,threshold:60,severity:'warn'},
          {id:'signalConfusion',enabled:true,threshold:3,severity:'warn'},
        ],views:['班级总览','逐段分析','学生详情'],rules:[]}},
    ]},
    { id:'s3', title:'Scan & Build', type:'信息矩阵', duration:15, collapsed:false, blocks:[
      {id:'b5', type:'explain', title:'寻读策略讲解', desc:'介绍 scanning 策略和信息提取方法', duration:2,
        completion:{type:'manual'}, observe:{metrics:[],views:[],rules:[]}},
      {id:'b6', type:'matrix', title:'信息矩阵填写', desc:'Where / Who / What / Why 四维矩阵', duration:5,
        completion:{type:'hard', rule:'completion >= 0.80'},
        content:{rows:['Egyptian kohl','1600s Europe','Borneo tattoos','Maori tā moko','Myanmar rings','Indonesia teeth'],cols:['Where','Who','What (practice)','Why (hidden reason)']},
        observe:{metrics:[
          {id:'completion',enabled:true,threshold:80,severity:'info'},{id:'accuracy',enabled:true,threshold:60,severity:'warn'},
          {id:'weakDim',enabled:true},
        ],views:['班级总览','维度热力图','学生详情'],rules:[]}},
      {id:'b7', type:'discuss', title:'文化语言讨论', desc:'Socratic 对话: 美 = 文化语言', duration:5,
        completion:{type:'ai_eval', timeoutSec:600},
        ai:{
          tutorInstruction:'引导学生理解美的实践是一种文化语言。鼓励学生从课文中找证据支持观点，使用苏格拉底式追问，不直接给出答案。当学生提到具体文化实践时，追问其背后的文化含义。',
          completionRubric:'学生能够说出美的实践不仅是外表装饰，而是表达身份认同、社会地位和文化归属的方式。需要引用至少一个课文中的具体文化实践作为证据。',
        },
        content:{goal:'Beauty practices across cultures are a form of cultural language expressing identity, status, and belonging.',
          method:'socratic', maxRounds:6, fallback:{type:'choice',question:'According to the text, beauty practices primarily communicate:',
          options:['How to look attractive','Identity, status, and belonging','Medical benefits'], correct:1}},
        observe:{metrics:[
          {id:'goalRate',enabled:true,threshold:60,severity:'warn'},{id:'avgRounds',enabled:true},
          {id:'fallbackCount',enabled:true,threshold:5,severity:'urg'},{id:'understanding',enabled:true,threshold:30,severity:'urg'},
          {id:'fallbackCorrect',enabled:true,threshold:50,severity:'warn'},
        ],views:['结果漏斗','逐轮理解','误解聚类','对话回放','学生详情'],rules:[
          {id:'r1',condition:{metric:'fallbackCount',op:'>=',value:5},action:{type:'alert',message:'较多学生无法通过对话达标，建议全班讲解'}},
          {id:'r2',condition:{metric:'understanding',op:'<',value:30},action:{type:'push',message:'推送理解支架'}},
        ]}},
      {id:'b8', type:'map', title:'坐标图定位', desc:'在 appearance↔meaning × temporary↔permanent 坐标上放置各文化实践', duration:3,
        completion:{type:'hard', rule:'placementAcc >= 0.60'},
        content:{xAxis:{neg:'Just appearance',pos:'Cultural meaning',label:'Why?'},yAxis:{neg:'Temporary',pos:'Permanent',label:'How lasting?'},
          items:['Egyptian kohl','1600s plump & pale','Borneo tattoos','Maori tā moko','Myanmar rings']},
        observe:{metrics:[
          {id:'placementAcc',enabled:true,threshold:60,severity:'warn'},{id:'reasonQuality',enabled:true,threshold:3,severity:'warn'},
          {id:'clusterCenter',enabled:true,threshold:4,severity:'warn'},
        ],views:['班级总览','坐标散点图','学生详情'],rules:[]}},
    ]},
    { id:'s4', title:'Evaluate', type:'批判质疑', duration:12, collapsed:true, blocks:[
      {id:'b9', type:'discuss', title:'评价作者观点', desc:'辩论式 Socratic 对话', duration:7,
        completion:{type:'ai_eval', timeoutSec:480},
        ai:{
          tutorInstruction:'引导学生评价作者的论点。鼓励学生说出同意或不同意的理由，并从课文中找证据。如果学生只是简单同意/不同意，追问具体原因。',
          completionRubric:'学生能够明确表达对作者观点的立场，并用课文中的至少一个证据支持自己的观点。',
        },
        content:{goal:'Evaluate the author\'s argument with text evidence.',method:'socratic',maxRounds:6,
          fallback:{type:'choice',question:'Do you agree with the author?',options:['Fully agree','Partially agree','Disagree'],correct:1}},
        observe:{metrics:[
          {id:'goalRate',enabled:true,threshold:60,severity:'warn'},{id:'fallbackCount',enabled:true,threshold:5,severity:'urg'},
          {id:'understanding',enabled:true,threshold:30,severity:'urg'},
        ],views:['结果漏斗','学生详情'],rules:[]}},
      {id:'b10', type:'sorting', title:'论证排序', desc:'将论证步骤排入正确顺序', duration:3,
        completion:{type:'hard', rule:'exactOrder == true'},
        observe:{metrics:[{id:'exactOrder',enabled:true,threshold:50,severity:'warn'}],views:['班级总览'],rules:[]}},
      {id:'b11', type:'choice', title:'综合理解测试', desc:'5道综合理解选择题', duration:2,
        completion:{type:'hard', rule:'score >= 0.75'},
        content:{questions:[{stem:'Beauty practices communicate:',options:['Appearance','Identity & belonging','Health','Fashion'],correct:1,tag:'Main Idea'}]},
        observe:{metrics:[{id:'accuracy',enabled:true,threshold:70,severity:'warn'}],views:['班级总览'],rules:[]}},
    ]},
    { id:'s5', title:'Wrap-up', type:'策略复盘', duration:5, collapsed:true, blocks:[
      {id:'b12', type:'explain', title:'课堂总结', desc:'策略复盘 + 主题升华', duration:3,
        completion:{type:'manual'}, observe:{metrics:[],views:[],rules:[]}},
      {id:'b13', type:'classify', title:'策略分类', desc:'将阅读策略分类到对应任务阶段', duration:2,
        completion:{type:'hard', rule:'accuracy >= 0.70'},
        observe:{metrics:[{id:'accuracy',enabled:true,threshold:70,severity:'warn'}],views:['班级总览'],rules:[]}},
    ]},
  ],
};

Object.assign(window, { COMP_REG, AI_ACTIONS, OPS, SEVERITIES, COMPLETION_TYPES, PLAN_DATA, FILE_TREE, SKILLS_DATA, LESSON_V3 });
