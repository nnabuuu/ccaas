const {useState, useCallback, useRef, useEffect, Fragment, useMemo} = React;

/* ═══════════════════════════════════════════════════════════
   MC OBSERVE v2 — Stacked Overlay Pattern
   Layer 0: Dashboard (background peek)
   Layer 1: Class Observe (slide-in from right)
   Layer 2: Student Detail (slide-in on top)
   ═══════════════════════════════════════════════════════════ */

function formatTime(s){const m=Math.floor(s/60),ss=s%60;return `${m}:${ss<10?'0':''}${ss}`;}
const OPT = ['A','B','C','D'];

/* ─── DATA ─── */
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

const STUDENTS = [
  {id:1,name:'王译文',time:95,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:1},times:{q1:18,q2:22,q3:15,q4:12,q5:28},changed:{q1:false,q2:false,q3:false,q4:false,q5:true},keyInsights:['全部正确','q5改过一次答案(从A改到B)','整体用时稳定']},
  {id:2,name:'黄婉晴',time:130,submitted:true,answers:{q1:1,q2:0,q3:1,q4:2,q5:1},times:{q1:25,q2:35,q3:22,q4:18,q5:30},changed:{q1:false,q2:true,q3:false,q4:false,q5:false},keyInsights:['q2选错(选了Comparison而非Chronological)','q2改答案但改错了','其余全对']},
  {id:3,name:'徐晨曦',time:155,submitted:true,answers:{q1:0,q2:0,q3:0,q4:0,q5:0},times:{q1:35,q2:40,q3:25,q4:28,q5:27},changed:{q1:true,q2:true,q3:false,q4:false,q5:false},keyInsights:['只对了0题——全部选A','q1和q2改过答案','用时较长说明有尝试思考']},
  {id:4,name:'陈昕妍',time:72,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:1},times:{q1:12,q2:15,q3:14,q4:10,q5:21},changed:{q1:false,q2:false,q3:false,q4:false,q5:false},keyInsights:['全部正确','速度最快——没有改答案','每题用时均匀']},
  {id:5,name:'李奕辰',time:110,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:0},times:{q1:20,q2:25,q3:18,q4:15,q5:32},changed:{q1:false,q2:false,q3:false,q4:false,q5:true},keyInsights:['4/5正确','q5选错——选了"How to look attractive"','q5改过答案但改错了方向']},
  {id:6,name:'郭斐然',time:145,submitted:true,answers:{q1:1,q2:3,q3:3,q4:0,q5:1},times:{q1:25,q2:30,q3:32,q4:30,q5:28},changed:{q1:false,q2:false,q3:true,q4:true,q5:false},keyInsights:['2/5正确','q2选Cause and Effect','q3选Popularity','q4选Introducing a new example——信号词理解弱']},
  {id:7,name:'张皓月',time:88,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:1},times:{q1:16,q2:18,q3:15,q4:14,q5:25},changed:{q1:false,q2:false,q3:false,q4:false,q5:false},keyInsights:['全部正确','用时短且稳定']},
  {id:8,name:'周航宇',time:100,submitted:true,answers:{q1:1,q2:2,q3:1,q4:0,q5:1},times:{q1:18,q2:22,q3:16,q4:20,q5:24},changed:{q1:false,q2:false,q3:false,q4:true,q5:false},keyInsights:['4/5正确','q4选错——"Introducing a new example"','改过q4但改错']},
  {id:9,name:'郑若曦',time:78,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:1},times:{q1:14,q2:16,q3:13,q4:12,q5:23},changed:{q1:false,q2:false,q3:false,q4:false,q5:false},keyInsights:['全部正确','仅次于陈昕妍的速度']},
  {id:10,name:'邓梓涵',time:158,submitted:true,answers:{q1:2,q2:0,q3:0,q4:0,q5:3},times:{q1:35,q2:38,q3:30,q4:28,q5:27},changed:{q1:true,q2:false,q3:false,q4:false,q5:true},keyInsights:['0/5正确','可能存在阅读理解障碍','q1和q5都改过答案']},
  {id:11,name:'董思齐',time:165,submitted:true,answers:{q1:0,q2:2,q3:0,q4:3,q5:0},times:{q1:38,q2:30,q3:35,q4:32,q5:30},changed:{q1:false,q2:false,q3:false,q4:false,q5:false},keyInsights:['1/5正确(只有q2对)','选项偏向A——可能未完全理解题意','用时长但准确率低']},
  {id:12,name:'冯璐',time:120,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:3},times:{q1:22,q2:25,q3:20,q4:18,q5:35},changed:{q1:false,q2:false,q3:false,q4:false,q5:true},keyInsights:['4/5正确','q5选"Religious rules"——最后一题失误','前4题表现很好']},
  {id:13,name:'谢安然',time:170,submitted:true,answers:{q1:2,q2:0,q3:2,q4:3,q5:0},times:{q1:38,q2:35,q3:35,q4:30,q5:32},changed:{q1:true,q2:true,q3:false,q4:false,q5:false},keyInsights:['0/5正确','语言障碍严重影响理解','多次改答案']},
  {id:14,name:'马乐瑶',time:92,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:1},times:{q1:16,q2:20,q3:16,q4:14,q5:26},changed:{q1:false,q2:false,q3:false,q4:false,q5:false},keyInsights:['全部正确','表现稳定']},
  {id:15,name:'林澜',time:105,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:0},times:{q1:20,q2:22,q3:18,q4:15,q5:30},changed:{q1:false,q2:false,q3:false,q4:false,q5:true},keyInsights:['4/5正确','q5选错——和李奕辰相同错误','q5改过答案']},
  {id:16,name:'朱思语',time:68,submitted:true,answers:{q1:1,q2:2,q3:1,q4:2,q5:1},times:{q1:12,q2:14,q3:12,q4:10,q5:20},changed:{q1:false,q2:false,q3:false,q4:false,q5:false},keyInsights:['全部正确','最快完成(1:08)','零犹豫']},
];

const MISCONCEPTIONS = [
  {id:1, label:'q5: "How to look attractive" — 表面理解', count:3, students:['李奕辰','林澜','徐晨曦'], severity:'medium'},
  {id:2, label:'q2: Comparison而非Chronological — 未识别时间信号', count:3, students:['黄婉晴','邓梓涵','徐晨曦'], severity:'medium'},
  {id:3, label:'q4: 未识别"It appears that"为conclusion信号', count:3, students:['郭斐然','周航宇','董思齐'], severity:'medium'},
  {id:4, label:'全部/大部分选A — 可能放弃或随机作答', count:2, students:['徐晨曦','邓梓涵'], severity:'high'},
];

function getQuestionStats(qid) {
  const q = QUESTIONS.find(qq=>qq.id===qid);
  const responses = STUDENTS.map(s=>s.answers[qid]);
  const correct = responses.filter(r=>r===q.correct).length;
  const distrib = [0,0,0,0];
  responses.forEach(r=>{ if(r>=0&&r<4) distrib[r]++; });
  return {correct, total:STUDENTS.length, distrib, correctIdx:q.correct};
}

/* ═══ MAIN APP ═══ */
function McObserveV2App() {
  const [observeOpen, setObserveOpen] = React.useState(false);
  const [selectedStudent, setSelectedStudent] = React.useState(null);

  const openObserve = React.useCallback(() => setObserveOpen(true), []);
  const closeObserve = React.useCallback(() => { setSelectedStudent(null); setObserveOpen(false); }, []);
  const selectStudent = React.useCallback(s => setSelectedStudent(s), []);
  const closeStudent = React.useCallback(() => setSelectedStudent(null), []);

  return React.createElement('div', { style: { height:'100vh', overflow:'hidden', position:'relative' } },
    React.createElement(DashboardBackground, { onOpenObserve:openObserve }),
    React.createElement(OverlayShell, { open:observeOpen, onClose:closeObserve, depth:0 },
      React.createElement(ClassObservePanel, { onSelectStudent:selectStudent, onClose:closeObserve })),
    React.createElement(OverlayShell, { open:!!selectedStudent, onClose:closeStudent, depth:1 },
      selectedStudent && React.createElement(StudentDetailPanel, { student:selectedStudent, onClose:closeStudent, allStudents:STUDENTS, onSwitchStudent:selectStudent })),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(McObserveV2App));
