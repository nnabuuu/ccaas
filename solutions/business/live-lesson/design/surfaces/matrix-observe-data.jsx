/* ═══════════════════════════════════════════════════════════
   MATRIX OBSERVE — Data & Helpers
   Matrix (矩阵填空): students fill "What" and "Why" per row
   ═══════════════════════════════════════════════════════════ */

const MATRIX_ROWS = [
  { id:'r1', concept:'尼日利亚"增肥室"传统', para:'¶1-2' },
  { id:'r2', concept:'西方纤瘦审美的影响', para:'¶3-4' },
  { id:'r3', concept:'各文化的身体改造习俗', para:'¶5-7' },
  { id:'r4', concept:'美是文化身份的表达', para:'¶8' },
];

/* Quality: 3=优秀, 2=良好, 1=基本, 0=未填 */
const Q_LABELS = ['优秀','良好','基本','未填'];
const Q_COLORS = ['var(--green)','var(--blue)','var(--amber)','var(--t3)'];
const Q_BGS   = ['var(--green-bg)','var(--blue-bg)','var(--amber-bg)','var(--surface2)'];
function qLabel(q){ return Q_LABELS[3-q]||Q_LABELS[3]; }
function qColor(q){ return Q_COLORS[3-q]||Q_COLORS[3]; }
function qBg(q)   { return Q_BGS[3-q]||Q_BGS[3]; }

const STUDENTS = [
  {id:1,name:'王译文',time:420,submitted:true,responses:{
    r1:{what:'尼日利亚传统中有"增肥室"，年轻女性在婚前被送入其中增重，以达到丰满体型标准。',why:'丰满象征家庭富裕和社会地位，是对新娘吸引力的文化表达。',whatQ:3,whyQ:3},
    r2:{what:'西方以纤瘦为美通过时尚杂志和社交媒体向全球扩散，影响了许多非西方文化的审美观。',why:'全球化和媒体传播使西方审美成为"主流"标准，导致其他文化审美被边缘化。',whatQ:3,whyQ:3},
    r3:{what:'不同文化有独特身体改造：埃塞俄比亚唇盘、缅甸颈环、婆罗洲纹身等。',why:'这些改造是文化身份、社会地位和人生里程碑的视觉表达。',whatQ:3,whyQ:3},
    r4:{what:'文章总结指出美的标准不是普世的，而是各文化用来表达身份认同的符号系统。',why:'不同文化对美的定义反映各自价值观和社会结构，美是文化身份的核心表达。',whatQ:3,whyQ:3},
  },keyInsights:['全部完成，质量极高','每个回答都有具体文本引用','What和Why均衡发展']},

  {id:2,name:'黄婉晴',time:510,submitted:true,responses:{
    r1:{what:'尼日利亚有增肥室的习俗，女性在婚前增重。',why:'因为丰满代表美和财富。',whatQ:2,whyQ:1},
    r2:{what:'西方人觉得瘦才是美的，这个想法通过杂志传到了其他国家。',why:'全球化让西方标准变成主流。',whatQ:2,whyQ:2},
    r3:{what:'有些文化会改造身体，比如唇盘和颈环。',why:'这些是文化传统的一部分。',whatQ:2,whyQ:1},
    r4:{what:'美的标准在不同文化中不同。',why:'因为每个文化都有自己的价值观。',whatQ:1,whyQ:1},
  },keyInsights:['What描述尚可但Why解释过于简略','后面几行质量下降','可能需要更多思考时间']},

  {id:3,name:'徐晨曦',time:580,submitted:true,responses:{
    r1:{what:'尼日利亚有让女孩变胖的传统。',why:'',whatQ:1,whyQ:0},
    r2:{what:'瘦是西方的美。',why:'因为杂志。',whatQ:1,whyQ:1},
    r3:{what:'',why:'',whatQ:0,whyQ:0},
    r4:{what:'',why:'',whatQ:0,whyQ:0},
  },keyInsights:['仅完成前两行','Why列基本空白','可能存在阅读理解困难']},

  {id:4,name:'陈昕妍',time:320,submitted:true,responses:{
    r1:{what:'文中描述了尼日利亚的"增肥室"制度——女性在出嫁前增重，以丰满身材迎接婚姻。',why:'丰满体态是财富、健康和美的象征，与西方审美形成对比，说明美的标准是文化建构的。',whatQ:3,whyQ:3},
    r2:{what:'第3-4段讨论了西方纤瘦审美如何通过媒体传播至全球，改变了当地传统审美。',why:'媒体作为文化输出工具，将"瘦即美"观念全球化，这是文化霸权的体现。',whatQ:3,whyQ:3},
    r3:{what:'¶5-7列举了唇盘(Mursi)、颈环(Kayan)、纹身(Borneo)等身体改造实践。',why:'这些改造不是"原始"行为，而是编码了社会地位、生命阶段和文化归属的符号。',whatQ:3,whyQ:3},
    r4:{what:'文章以"美即身份"作为总结论点，审美标准反映的是文化身份而非客观标准。',why:'每种审美实践背后都是一套完整文化逻辑，理解美就是理解那个文化的核心价值。',whatQ:3,whyQ:3},
  },keyInsights:['最高质量——所有cell均为优秀','速度最快(5:20)','有段落引用和术语使用']},

  {id:5,name:'李奕辰',time:450,submitted:true,responses:{
    r1:{what:'尼日利亚有"fattening room"传统，让女性在婚前增重变胖。',why:'丰满在当地文化中象征美、健康和财富。',whatQ:2,whyQ:2},
    r2:{what:'西方通过时尚产业和社交媒体推广瘦身审美，影响了全球。',why:'全球化传播导致西方标准成为默认的美的定义。',whatQ:2,whyQ:2},
    r3:{what:'不同文化有各自的身体改造传统：唇盘、颈环、纹身、削牙等。',why:'这些实践是文化身份和社会地位的表达方式。',whatQ:3,whyQ:2},
    r4:{what:'作者认为美不是universal的，而是culturally constructed。',why:'通过对比不同文化做法，可以看出美的标准总是服务于特定文化的身份建构。',whatQ:3,whyQ:3},
  },keyInsights:['整体良好，后两行质量更高','中英混合表达','对文化建构概念有理解']},

  {id:6,name:'郭斐然',time:550,submitted:true,responses:{
    r1:{what:'尼日利亚人喜欢胖的女生。',why:'因为他们觉得胖是美的。',whatQ:1,whyQ:1},
    r2:{what:'西方人喜欢瘦的。',why:'因为西方文化不同。',whatQ:1,whyQ:1},
    r3:{what:'有些人做唇盘，有些人戴颈环。',why:'传统。',whatQ:1,whyQ:0},
    r4:{what:'每个文化觉得不同的东西是美的。',why:'因为文化不一样。',whatQ:1,whyQ:1},
  },keyInsights:['全部基本水平——回答过于简略','Why列几乎是同义反复','需要引导如何深入分析']},

  {id:7,name:'张皓月',time:380,submitted:true,responses:{
    r1:{what:'尼日利亚存在"增肥室"制度，这是一种婚前准备仪式。',why:'丰满象征财富和生育能力，在该文化语境下是美的标志。',whatQ:3,whyQ:2},
    r2:{what:'西方纤瘦审美通过全球媒体传播，对传统审美造成冲击。',why:'媒体全球化使单一审美标准获得了不成比例的影响力。',whatQ:2,whyQ:3},
    r3:{what:'唇盘、颈环、纹身是不同文化中的身体改造实践。',why:'身体改造承载社会意义——地位、成年、归属感。',whatQ:2,whyQ:3},
    r4:{what:'美的标准是文化特定的，不存在普世的美。',why:'审美背后是文化价值体系，美是身份认同的表达工具。',whatQ:3,whyQ:3},
  },keyInsights:['What和Why质量均衡','Why列略胜What列','表达简洁有力']},

  {id:8,name:'周航宇',time:470,submitted:true,responses:{
    r1:{what:'尼日利亚的增肥室是让女性增重的传统。',why:'丰满代表美丽和社会地位。',whatQ:2,whyQ:2},
    r2:{what:'西方审美标准以瘦为美，通过媒体影响全球。',why:'全球化和社交媒体推动了审美同质化。',whatQ:2,whyQ:2},
    r3:{what:'文章介绍了唇盘、颈环、纹身等改造身体的做法。',why:'这些是文化传统的一部分，有特殊社会含义。',whatQ:2,whyQ:2},
    r4:{what:'美的定义因文化而异。',why:'文化决定了人们认为什么是美的。',whatQ:1,whyQ:1},
  },keyInsights:['前三行良好，最后一行质量下降','可能最后匆忙完成','整体中等水平']},

  {id:9,name:'郑若曦',time:350,submitted:true,responses:{
    r1:{what:'文中提到尼日利亚"增肥室"传统——年轻女性在婚前专门增重以达到文化审美标准。',why:'丰满体态是财富、美和社会地位的综合象征，反映了非西方的美的建构。',whatQ:3,whyQ:3},
    r2:{what:'¶3-4分析了西方纤瘦审美如何通过时尚产业和媒体成为全球化审美标准。',why:'西方媒体传播力量使"瘦即美"成为文化霸权，侵蚀了其他文化的审美自主性。',whatQ:3,whyQ:3},
    r3:{what:'Mursi族唇盘、Kayan族颈环、Borneo岛纹身、以及削牙等身体改造实践。',why:'每种改造都是该文化"可读的文本"——编码了社会地位、年龄和群体归属。',whatQ:3,whyQ:3},
    r4:{what:'¶8得出结论：审美标准并非自然或普世的，而是文化建构的身份表达系统。',why:'对比不同文化的美的实践，可以解构"审美客观性"的幻觉。',whatQ:3,whyQ:3},
  },keyInsights:['质量极高，与陈昕妍并列最佳','用了"文化霸权""文化建构"等学术概念','有段落引用']},

  {id:10,name:'邓梓涵',time:590,submitted:true,responses:{
    r1:{what:'非洲有让人变胖的房间。',why:'',whatQ:1,whyQ:0},
    r2:{what:'西方觉得瘦好看。',why:'因为杂志上都是瘦的模特。',whatQ:1,whyQ:1},
    r3:{what:'有人在嘴唇上放盘子。',why:'',whatQ:1,whyQ:0},
    r4:{what:'',why:'',whatQ:0,whyQ:0},
  },keyInsights:['严重不完整——3个Why为空','描述非常表面，没有分析深度','可能存在阅读理解障碍']},

  {id:11,name:'董思齐',time:600,submitted:false,responses:{
    r1:{what:'尼日利亚增肥传统。',why:'',whatQ:1,whyQ:0},
    r2:{what:'',why:'',whatQ:0,whyQ:0},
    r3:{what:'',why:'',whatQ:0,whyQ:0},
    r4:{what:'',why:'',whatQ:0,whyQ:0},
  },keyInsights:['仅完成1个What','未提交——时间用完','需要大量支持']},

  {id:12,name:'冯璐',time:480,submitted:true,responses:{
    r1:{what:'尼日利亚有增肥室传统，帮助女性在婚前增重。',why:'丰满被认为是美和富裕的标志。',whatQ:2,whyQ:2},
    r2:{what:'西方推崇瘦身审美，通过媒体扩散到全球。',why:'全球化让审美标准趋向单一化。',whatQ:2,whyQ:2},
    r3:{what:'不同文化有唇盘、颈环等身体改造传统。',why:'这些改造有文化含义。',whatQ:2,whyQ:1},
    r4:{what:'美的标准因文化而不同，不是universal的。',why:'每个文化的美都有自己的意义和逻辑。',whatQ:2,whyQ:2},
  },keyInsights:['整体良好','r3的Why较弱','有中英混合使用']},

  {id:13,name:'谢安然',time:595,submitted:false,responses:{
    r1:{what:'Nigeria fat room.',why:'Fat is beauty.',whatQ:1,whyQ:0},
    r2:{what:'West like thin.',why:'',whatQ:1,whyQ:0},
    r3:{what:'',why:'',whatQ:0,whyQ:0},
    r4:{what:'',why:'',whatQ:0,whyQ:0},
  },keyInsights:['语言障碍严重——用英文碎片回答','仅完成2个What','未提交']},

  {id:14,name:'马乐瑶',time:400,submitted:true,responses:{
    r1:{what:'文章描述了尼日利亚"增肥室"——年轻女性在婚前被安排增重。',why:'丰满在当地文化中代表美、健康和财富，是积极的审美追求。',whatQ:3,whyQ:2},
    r2:{what:'西方以纤瘦为美的观念通过时尚和媒体向全球传播。',why:'媒体力量使西方审美成为"默认标准"，对本土审美造成威胁。',whatQ:2,whyQ:3},
    r3:{what:'不同文化有各种身体改造：唇盘(Ethiopia)、颈环(Myanmar)、纹身(Borneo)。',why:'这些不是外表修饰，而是社会身份的可视化编码系统。',whatQ:3,whyQ:3},
    r4:{what:'美的标准是文化特定的，是身份认同的表达方式。',why:'理解一个文化的审美就是理解他们的核心价值观。',whatQ:2,whyQ:2},
  },keyInsights:['What和Why交替优秀/良好','r3的分析最到位','表达清晰']},

  {id:15,name:'林澜',time:440,submitted:true,responses:{
    r1:{what:'尼日利亚的增肥室传统：女性婚前增重。',why:'丰满=美丽+富裕的文化等式。',whatQ:2,whyQ:2},
    r2:{what:'西方瘦身审美全球化传播。',why:'媒体传播力量+文化霸权。',whatQ:2,whyQ:2},
    r3:{what:'唇盘、颈环、纹身、削牙等跨文化身体改造。',why:'社会地位+文化身份的身体表达。',whatQ:2,whyQ:2},
    r4:{what:'美是文化建构，非普世标准。',why:'审美=文化价值观的外在表达。',whatQ:2,whyQ:2},
  },keyInsights:['全部良好但偏格式化','使用符号简写(=、+)——笔记式回答','理解到位但缺少展开']},

  {id:16,name:'朱思语',time:290,submitted:true,responses:{
    r1:{what:'¶1-2描述了尼日利亚"增肥室"(fattening room)制度——婚前准备仪式，让女性通过增重达到文化审美标准。',why:'丰满的体型是多重正面价值的综合象征：财富、健康和文化定义的理想体态。',whatQ:3,whyQ:3},
    r2:{what:'¶3-4分析了西方纤瘦审美的全球化传播——通过时尚杂志、广告和社交媒体侵入非西方文化。',why:'媒体全球化使西方审美获得"默认标准"地位，这是"软性文化殖民"，威胁本土审美多样性。',whatQ:3,whyQ:3},
    r3:{what:'¶5-7系统列举了多种身体改造实践：Mursi族唇盘、Kayan族颈环、Borneo纹身、削牙。',why:'这些改造是精密的"社会编码系统"——在身体上刻写可读的文化信息，编码地位、归属、经历。',whatQ:3,whyQ:3},
    r4:{what:'¶8以"It appears that"引导结论：审美标准从来不是自然或客观的，而是文化建构的符号系统。',why:'通过全文跨文化对比解构了"普世审美"的幻觉，每种美的实践背后都是完整的文化价值体系。',whatQ:3,whyQ:3},
  },keyInsights:['最高质量+最快速度(4:50)','每行都有段落引用和分析','使用了"文化殖民""社会编码"等高阶概念']},
];

const PATTERNS = [
  {id:1, label:'Why列空白或仅一句话 — 无法解释原因', count:5, students:['徐晨曦','邓梓涵','董思齐','谢安然','郭斐然'], severity:'high'},
  {id:2, label:'同义反复 — "因为文化不同所以不同"', count:3, students:['郭斐然','黄婉晴','周航宇'], severity:'medium'},
  {id:3, label:'后半行质量下降 — 时间不够或疲劳', count:4, students:['黄婉晴','周航宇','冯璐','邓梓涵'], severity:'medium'},
  {id:4, label:'What描述准确但Why缺少文本证据', count:4, students:['李奕辰','黄婉晴','冯璐','林澜'], severity:'low'},
];

/* ─── Helpers ─── */
function formatTime(s){ const m=Math.floor(s/60),ss=s%60; return `${m}:${ss<10?'0':''}${ss}`; }

function getRowStats(rowId) {
  const whats = STUDENTS.map(s=>s.responses[rowId]?.whatQ||0);
  const whys  = STUDENTS.map(s=>s.responses[rowId]?.whyQ||0);
  const whatAvg = whats.reduce((a,b)=>a+b,0)/whats.length;
  const whyAvg  = whys.reduce((a,b)=>a+b,0)/whys.length;
  const whatDist = [0,0,0,0]; whats.forEach(q=>whatDist[3-q]++);
  const whyDist  = [0,0,0,0]; whys.forEach(q=>whyDist[3-q]++);
  return { whatAvg, whyAvg, whatDist, whyDist };
}

function getStudentScore(s) {
  let total=0, count=0;
  MATRIX_ROWS.forEach(r=>{ const rp=s.responses[r.id]; if(rp){total+=rp.whatQ+rp.whyQ; count+=2;} });
  return { total, count, avg: count>0 ? total/count : 0 };
}

function getStudentCompletion(s) {
  let filled=0, total=MATRIX_ROWS.length*2;
  MATRIX_ROWS.forEach(r=>{ const rp=s.responses[r.id]; if(rp?.whatQ>0)filled++; if(rp?.whyQ>0)filled++; });
  return { filled, total, pct:Math.round(filled/total*100) };
}

Object.assign(window, { MATRIX_ROWS, Q_LABELS, Q_COLORS, Q_BGS, qLabel, qColor, qBg, STUDENTS, PATTERNS, formatTime, getRowStats, getStudentScore, getStudentCompletion });
