/* ════════════════════════════════════════════════
   Creator v2 — Component Registry & Lesson Data
   ════════════════════════════════════════════════ */

/* ── Component Type Registry ── */
const COMP_REG = {
  explain:  {label:'讲解',  icon:'▣', color:'var(--t2)',    bg:'var(--surface2)', hasObserve:false},
  choice:   {label:'选择题',icon:'○', color:'var(--blue)',  bg:'var(--blue-bg)',  hasObserve:true, metrics:[
    {id:'accuracy',    label:'正确率',    desc:'全班整体正确率',      unit:'%', defThresh:70, defSev:'warn'},
    {id:'firstAttempt',label:'首次正确率',desc:'一次答对比例',        unit:'%', defThresh:60, defSev:'info'},
    {id:'misconceptions',label:'误解聚类',desc:'相同错误模式自动分组',unit:'人',defThresh:3,  defSev:'warn'},
    {id:'changeAnswer',label:'改答案追踪',desc:'改答案的学生及方向',  hasThresh:false},
    {id:'timePerQ',    label:'每题用时',  desc:'每题平均作答时间',    unit:'s', defThresh:45, defSev:'info'},
    {id:'optionDistrib',label:'选项分布', desc:'各选项选择人数',      hasThresh:false},
  ], views:['班级总览','逐题分析','误解聚类','学生详情']},
  fill:     {label:'填空题',icon:'▭', color:'var(--teal)',  bg:'var(--teal-bg)',  hasObserve:true, metrics:[
    {id:'accuracy',      label:'正确率',    desc:'全班填空正确率', unit:'%', defThresh:70, defSev:'warn'},
    {id:'partialMatch',  label:'部分匹配率',desc:'部分正确的比例', unit:'%', hasThresh:false},
    {id:'commonErrors',  label:'常见错误',  desc:'高频错误答案聚类',unit:'人',defThresh:3,  defSev:'warn'},
    {id:'blankCompletion',label:'空位完成率',desc:'每个空位的填写率',unit:'%', defThresh:80, defSev:'info'},
  ], views:['班级总览','逐空分析','学生详情']},
  truefalse:{label:'判断题',icon:'◇', color:'var(--green)', bg:'var(--green-bg)', hasObserve:true, metrics:[
    {id:'accuracy',    label:'正确率',  desc:'判断正确率',      unit:'%', defThresh:70, defSev:'warn'},
    {id:'misconceptions',label:'误解聚类',desc:'常见错误归因分组',unit:'人',defThresh:3,  defSev:'warn'},
  ], views:['班级总览','学生详情']},
  matching: {label:'连线题',icon:'⟷', color:'var(--purple)',bg:'var(--purple-bg)',hasObserve:true, metrics:[
    {id:'accuracy', label:'配对正确率',desc:'配对正确比例',unit:'%', defThresh:70, defSev:'warn'},
    {id:'confusion',label:'混淆对',   desc:'常见错误配对', unit:'组',defThresh:2,  defSev:'warn'},
  ], views:['班级总览','配对矩阵','学生详情']},
  sorting:  {label:'排序题',icon:'↕', color:'var(--amber)', bg:'var(--amber-bg)', hasObserve:true, metrics:[
    {id:'exactOrder',   label:'完全正确率',desc:'排序完全正确的比例',unit:'%', defThresh:50, defSev:'warn'},
    {id:'adjacentSwaps',label:'相邻错位', desc:'相邻位置互换的次数',unit:'次',defThresh:2,  defSev:'info'},
  ], views:['班级总览','步骤热力图','学生详情']},
  classify: {label:'分类题',icon:'⊞', color:'var(--coral)', bg:'var(--coral-bg)', hasObserve:true, metrics:[
    {id:'accuracy',   label:'分类正确率',desc:'分类正确的比例',unit:'%', defThresh:70, defSev:'warn'},
    {id:'crossErrors',label:'跨类错误', desc:'放入错误分类的次数',unit:'次',defThresh:3,  defSev:'warn'},
  ], views:['班级总览','分类矩阵','学生详情']},
  annotate: {label:'标注题',icon:'✎', color:'var(--red)',   bg:'var(--red-bg)',   hasObserve:true, metrics:[
    {id:'accuracy', label:'标注准确率',desc:'标注位置正确比例',unit:'%', defThresh:60, defSev:'warn'},
    {id:'coverage', label:'标注覆盖率',desc:'应标注区域的覆盖度',unit:'%', defThresh:70, defSev:'info'},
  ], views:['班级总览','标注热力图','学生详情']},
  poll:     {label:'投票',  icon:'▮', color:'var(--blue)',  bg:'var(--blue-bg)',  hasObserve:true, metrics:[
    {id:'distribution',label:'投票分布',desc:'各选项实时分布',hasThresh:false},
    {id:'consensus',   label:'共识度',  desc:'最高票占比',   unit:'%', defThresh:60, defSev:'info'},
  ], views:['实时分布','趋势变化']},
  discuss:  {label:'讨论',  icon:'◬', color:'var(--purple)',bg:'var(--purple-bg)',hasObserve:true, metrics:[
    {id:'goalRate',      label:'达标率',    desc:'通过对话达标的比例',    unit:'%', defThresh:60, defSev:'warn'},
    {id:'avgRounds',     label:'平均轮次',  desc:'达标所需平均轮次',     hasThresh:false},
    {id:'fallbackCount', label:'兜底人数',  desc:'触发兜底选择题的人数',  unit:'人',defThresh:5,  defSev:'urg'},
    {id:'understanding', label:'理解度',    desc:'逐轮理解度变化趋势',   unit:'%', defThresh:30, defSev:'urg'},
    {id:'fallbackCorrect',label:'兜底正确率',desc:'兜底选择题的正确率',  unit:'%', defThresh:50, defSev:'warn'},
  ], views:['结果漏斗','逐轮理解','误解聚类','对话回放','学生详情']},
  group:    {label:'分组活动',icon:'⊡',color:'var(--purple)',bg:'var(--purple-bg)',hasObserve:false},
  video:    {label:'视频',  icon:'▶', color:'var(--teal)',  bg:'var(--teal-bg)',  hasObserve:false},
  reading:  {label:'阅读',  icon:'≡', color:'var(--amber)', bg:'var(--amber-bg)', hasObserve:false},
  evidence: {label:'证据选择',icon:'◈',color:'var(--teal)', bg:'var(--teal-bg)',  hasObserve:true, metrics:[
    {id:'funcAccuracy',   label:'功能识别率',desc:'段落功能识别正确率',unit:'%', defThresh:70, defSev:'warn'},
    {id:'evidenceHit',    label:'证据命中率',desc:'正确选择证据短语率',unit:'%', defThresh:60, defSev:'warn'},
    {id:'signalConfusion',label:'信号混淆', desc:'混淆signal与practice',unit:'人',defThresh:3, defSev:'warn'},
  ], views:['班级总览','逐段分析','学生详情']},
  matrix:   {label:'矩阵填空',icon:'▦',color:'var(--teal)',bg:'var(--teal-bg)',  hasObserve:true, metrics:[
    {id:'completion',  label:'完成率',  desc:'矩阵单元格填写率',  unit:'%', defThresh:80, defSev:'info'},
    {id:'accuracy',    label:'准确率',  desc:'填写内容正确率',    unit:'%', defThresh:60, defSev:'warn'},
    {id:'weakDim',     label:'薄弱维度',desc:'空缺率最高的列',   hasThresh:false},
    {id:'dimAccuracy', label:'维度正确率',desc:'每列的平均正确率',hasThresh:false},
  ], views:['班级总览','维度热力图','学生详情']},
  map:      {label:'坐标图',icon:'◎', color:'var(--blue)',  bg:'var(--blue-bg)',  hasObserve:true, metrics:[
    {id:'placementAcc', label:'放置准确率',desc:'与参考位置的偏差',unit:'%', defThresh:60, defSev:'warn'},
    {id:'reasonQuality',label:'理由质量', desc:'reasoning的质量评分',unit:'分',defThresh:3,  defSev:'warn'},
    {id:'axisConfusion',label:'轴向混淆', desc:'X/Y轴理解混淆',  unit:'人',defThresh:3,  defSev:'warn'},
    {id:'clusterCenter',label:'中间聚集', desc:'放在原点附近的人数',unit:'人',defThresh:4,  defSev:'warn'},
  ], views:['班级总览','坐标散点图','学生详情']},
};

/* ── AI Action Types ── */
const AI_ACTIONS = [
  {id:'alert',    label:'提醒教师', icon:'🔔', desc:'在教师端弹出提醒通知'},
  {id:'push',     label:'推送内容', icon:'📤', desc:'向目标学生推送支架/提示'},
  {id:'pause',    label:'暂停活动', icon:'⏸', desc:'暂停当前学习活动'},
  {id:'scaffold', label:'插入支架', icon:'🧩', desc:'自动插入学习支架'},
  {id:'regroup',  label:'重新分组', icon:'👥', desc:'按理解度重新分组'},
  {id:'fallback', label:'触发兜底', icon:'🔄', desc:'切换到兜底题型'},
];

const OPS = [{id:'<',label:'<'},{id:'<=',label:'≤'},{id:'>',label:'>'},{id:'>=',label:'≥'},{id:'==',label:'='}];

const SEVERITIES = [
  {id:'urg',  label:'紧急', color:'var(--red)',   bg:'var(--red-bg)'},
  {id:'warn', label:'注意', color:'var(--amber)', bg:'var(--amber-bg)'},
  {id:'info', label:'信息', color:'var(--blue)',  bg:'var(--blue-bg)'},
];

/* ── Sample Lesson (Ideal Beauty) ── */
const LESSON_V2 = {
  title:'Ideal Beauty', subject:'英语', grade:'高一', classGroup:'高一(3)班', duration:45,
  steps: [
    { id:'s1', title:'Predict', type:'图式激活', duration:5, collapsed:false, blocks:[
      {id:'b1', type:'explain', title:'标题预测引导', desc:'从标题 Ideal Beauty 激活主题经验', duration:2, observe:{metrics:[],views:[],rules:[]}},
      {id:'b2', type:'choice', title:'快速理解检查', desc:'前两段核心冲突识别 · 3题', duration:3,
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
          {id:'r2',condition:{metric:'misconceptions',op:'>=',value:3},action:{type:'push',message:'推送针对性解析'}},
        ]}},
    ]},
    { id:'s2', title:'Skim', type:'结构解码', duration:8, collapsed:false, blocks:[
      {id:'b3', type:'explain', title:'略读策略讲解', desc:'介绍 skimming 策略和语篇结构识别', duration:3, observe:{metrics:[],views:[],rules:[]}},
      {id:'b4', type:'evidence', title:'语篇结构匹配', desc:'为每段选择功能标签 + 定位结构证据', duration:5,
        content:{sections:[{label:'¶1-2',func:'Phenomenon'},{label:'¶3-4',func:'History'},{label:'¶5-7',func:'Culture'},{label:'¶8',func:'Conclusion'}]},
        observe:{metrics:[
          {id:'funcAccuracy',enabled:true,threshold:70,severity:'warn'},{id:'evidenceHit',enabled:true,threshold:60,severity:'warn'},
          {id:'signalConfusion',enabled:true,threshold:3,severity:'warn'},
        ],views:['班级总览','逐段分析','学生详情'],rules:[
          {id:'r1',condition:{metric:'signalConfusion',op:'>=',value:3},action:{type:'push',message:'推送 signal vs practice 区分提示'}},
        ]}},
    ]},
    { id:'s3', title:'Scan & Build', type:'信息矩阵', duration:15, collapsed:false, blocks:[
      {id:'b5', type:'explain', title:'寻读策略讲解', desc:'介绍 scanning 策略和信息提取方法', duration:2, observe:{metrics:[],views:[],rules:[]}},
      {id:'b6', type:'matrix', title:'信息矩阵填写', desc:'Where / Who / What / Why 四维矩阵', duration:5,
        content:{rows:['Egyptian kohl','1600s Europe','Borneo tattoos','Maori tā moko','Myanmar rings','Indonesia teeth'],cols:['Where','Who','What (practice)','Why (hidden reason)']},
        observe:{metrics:[
          {id:'completion',enabled:true,threshold:80,severity:'info'},{id:'accuracy',enabled:true,threshold:60,severity:'warn'},
          {id:'weakDim',enabled:true},{id:'dimAccuracy',enabled:true},
        ],views:['班级总览','维度热力图','学生详情'],rules:[
          {id:'r1',condition:{metric:'accuracy',op:'<',value:50},action:{type:'push',message:'推送 Why 列支架句'}},
          {id:'r2',condition:{metric:'completion',op:'<',value:60},action:{type:'alert',message:'完成率过低，建议检查任务难度'}},
        ]}},
      {id:'b7', type:'discuss', title:'文化语言讨论', desc:'Socratic 对话: 美 = 文化语言', duration:5,
        content:{goal:'Beauty practices across cultures are a form of cultural language expressing identity, status, and belonging — not just appearance.',
          method:'socratic', maxRounds:6, fallback:{type:'choice',question:'According to the text, beauty practices primarily communicate:',
          options:['How to look attractive to foreigners','Identity, status, and belonging','Medical or health benefits'], correct:1}},
        observe:{metrics:[
          {id:'goalRate',enabled:true,threshold:60,severity:'warn'},{id:'avgRounds',enabled:true},
          {id:'fallbackCount',enabled:true,threshold:5,severity:'urg'},{id:'understanding',enabled:true,threshold:30,severity:'urg'},
          {id:'fallbackCorrect',enabled:true,threshold:50,severity:'warn'},
        ],views:['结果漏斗','逐轮理解','误解聚类','对话回放','学生详情'],rules:[
          {id:'r1',condition:{metric:'fallbackCount',op:'>=',value:5},action:{type:'alert',message:'较多学生无法通过对话达标，建议全班讲解'}},
          {id:'r2',condition:{metric:'understanding',op:'<',value:30},action:{type:'push',message:'推送理解支架（段落分隔提示）'}},
          {id:'r3',condition:{metric:'goalRate',op:'<',value:40},action:{type:'pause',message:'建议暂停，全班讲解文化语言概念'}},
        ]}},
      {id:'b8', type:'map', title:'坐标图定位', desc:'在 appearance↔meaning × temporary↔permanent 坐标上放置各文化实践', duration:3,
        content:{xAxis:{neg:'Just appearance',pos:'Cultural meaning',label:'Why is it done?'},yAxis:{neg:'Temporary',pos:'Permanent',label:'How lasting?'},
          items:['Egyptian kohl','1600s plump & pale','Borneo tattoos','Maori tā moko','Myanmar neck rings','Indonesia teeth','Modern media slim']},
        observe:{metrics:[
          {id:'placementAcc',enabled:true,threshold:60,severity:'warn'},{id:'reasonQuality',enabled:true,threshold:3,severity:'warn'},
          {id:'axisConfusion',enabled:true,threshold:3,severity:'warn'},{id:'clusterCenter',enabled:true,threshold:4,severity:'warn'},
        ],views:['班级总览','坐标散点图','学生详情'],rules:[
          {id:'r1',condition:{metric:'clusterCenter',op:'>=',value:4},action:{type:'push',message:'推送轴向含义理解提示'}},
        ]}},
    ]},
    { id:'s4', title:'Evaluate', type:'批判质疑', duration:12, collapsed:true, blocks:[
      {id:'b9', type:'discuss', title:'评价作者观点', desc:'辩论式 Socratic 对话', duration:7,
        content:{goal:'Student can evaluate the author\'s argument with text evidence.',method:'socratic',maxRounds:6,
          fallback:{type:'choice',question:'Do you agree with the author?',options:['Fully agree','Partially agree','Disagree'],correct:1}},
        observe:{metrics:[
          {id:'goalRate',enabled:true,threshold:60,severity:'warn'},{id:'fallbackCount',enabled:true,threshold:5,severity:'urg'},
          {id:'understanding',enabled:true,threshold:30,severity:'urg'},
        ],views:['结果漏斗','学生详情'],rules:[]}},
      {id:'b10', type:'sorting', title:'论证排序', desc:'将论证步骤排入正确顺序', duration:3,
        observe:{metrics:[{id:'exactOrder',enabled:true,threshold:50,severity:'warn'}],views:['班级总览'],rules:[]}},
      {id:'b11', type:'choice', title:'综合理解测试', desc:'5道综合理解选择题', duration:2,
        content:{questions:[{stem:'According to the text, beauty practices communicate:',options:['Appearance','Identity & belonging','Health','Fashion'],correct:1,tag:'Main Idea'}]},
        observe:{metrics:[{id:'accuracy',enabled:true,threshold:70,severity:'warn'}],views:['班级总览','学生详情'],rules:[]}},
    ]},
    { id:'s5', title:'Wrap-up', type:'策略复盘', duration:5, collapsed:true, blocks:[
      {id:'b12', type:'explain', title:'课堂总结', desc:'策略复盘 + 主题升华', duration:3, observe:{metrics:[],views:[],rules:[]}},
      {id:'b13', type:'classify', title:'策略分类', desc:'将阅读策略分类到对应任务阶段', duration:2,
        observe:{metrics:[{id:'accuracy',enabled:true,threshold:70,severity:'warn'}],views:['班级总览'],rules:[]}},
    ]},
  ],
};

Object.assign(window, { COMP_REG, AI_ACTIONS, OPS, SEVERITIES, LESSON_V2 });
