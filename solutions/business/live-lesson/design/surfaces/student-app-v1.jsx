const {useState,useCallback,useRef,useEffect,Fragment} = React;

/* ═══ TEXT ═══ */
const PARAGRAPHS = [
  {n:1,text:'In many parts of Nigeria, it is traditional for women to go to special "fattening rooms" before they get married. Happiness Edem was one such young woman, and she went from 60 kg to twice that weight because, in her culture, being fat is a sign of wealth.'},
  {n:2,text:'But what about the rest of the world? Open any fashion magazine and you will see young models — women who are slim and fair. Many people are worried that modern media promotes shallow beauty ideals.',sig:['shallow beauty ideals']},
  {n:3,text:'Ideas about physical beauty change over time and different periods of history have had their own idea of what is beautiful. In ancient Egypt, both men and women used to paint dark kohl around their eyes.',sig:['change over time','different periods of history']},
  {n:4,text:'In the 1600s in Europe, being plump and pale-skinned was considered stunning beauty. Rubens painted many women with round, soft bodies. In Elizabethan England, pale skin was a sign of wealth.'},
  {n:5,text:'Within different cultures around the world, we can find diverse ideas about physical beauty. In Borneo, many people have tattoos. For them, their body art is like a diary of important events.',sig:['different cultures around the world']},
  {n:6,text:'In New Zealand, the Maori people have their own tradition — a form of tattooing called tā moko. Unlike in Borneo, these tattoos show a person\'s position in society.'},
  {n:7,text:'European visitors to Myanmar were amazed to see women wearing metal rings around their necks. And in Indonesia, some people practised sharpening their teeth, as it was considered a form of cultural identity.'},
  {n:8,text:'It appears that people change their appearance to tell the world about their culture and status. Whether kohl, tattoos, or metal rings, these practices reflect cultural values, not just vanity.',sig:['It appears that']},
];

/* ═══ TASKS ═══ */
const TASKS = [
  {id:1,name:'Predict',subtitle:'What is beauty?',time:'5 min',focus:[1,2],
   intro:'Let\'s start with the title: Ideal Beauty.\n\nRead the first two paragraphs quickly. Your job is to find the conflict — two very different ideas of beauty.\n\nPay attention to: Who is Happiness Edem? What kind of beauty does modern media promote?',
   exercise:{type:'quiz',label:'Answer the questions about ¶1-2.',
     questions:[
       {q:'What did Happiness Edem do to become "beautiful"?',
        opts:['Went on a diet to become slim','Gained weight in a fattening room','Got cosmetic surgery','Started a fashion brand'],correct:1,
        hint:'Look at ¶1. What happened to her weight?',hintZh:'看 ¶1，她的体重发生了什么变化？',
        translate:'Happiness Edem 为了变"美"做了什么？'},
       {q:'What kind of beauty does modern media promote?',
        opts:['Plump and strong','Diverse and inclusive','Slim and fair-skinned','Tattooed and unique'],correct:2,
        hint:'Look at ¶2: "you will see young models — women who are..."',hintZh:'看 ¶2 描述的 models 特征。',
        translate:'现代媒体推崇哪种美？'},
       {q:'What is the writer\'s main question?',
        opts:['Why do people want to be beautiful?','Is one idea of beauty really better than another?','How can we become more beautiful?','Why is the media so powerful?'],correct:1,
        hint:'Read the last sentence of ¶2 carefully.',hintZh:'仔细读 ¶2 的最后一句话。',
        translate:'作者真正想问的大问题是什么？'},
     ]},
   discuss:{
     probe:{q:'For the last question — how did you figure out the answer? Where exactly in the text did you find the clue?',
       translate:'你是怎么看出作者的核心问题的？从文章哪里找到的？',
       aiReply:'Good thinking! The last sentence of ¶2 directly asks: "Is one idea of physical beauty really more attractive than another?"\n\nNotice the writer\'s technique: first, two opposing examples (Nigeria vs media), then a big question. This "conflict → question" opening is very common in argumentative texts.',
       followUp:'Do you think the writer agrees that media beauty standards are correct? Why or why not?',
       followUpTranslate:'你觉得作者同意"媒体的审美标准是对的"吗？',
       followUpReply:'Looking at the cultural examples later in the text, the writer clearly does NOT think there\'s only one "right" standard. The writer uses facts to show: beauty means different things in different times and cultures.\n\nThis is what we\'ll explore next!'},
     insight:'💡 Key technique: The text uses a "conflict opening" — two opposing facts, then a question. This is common in argumentative writing.',
     insightZh:'💡 文章用"冲突开头"——先给两个对立事实，再提出问题。这是议论文常见写法。'},
   summary:'Great. You found the central conflict: one culture values gaining weight, while modern media promotes being slim.\n\nKey question: Is one idea of beauty really better than another?\n\nLet\'s see how the writer answers it.'},

  {id:2,name:'Skim',subtitle:'Find the skeleton',time:'8 min',focus:[3,4,5,6,7,8],
   intro:'Strong readers don\'t read word by word. They look for the skeleton first.\n\nRead ¶3-8, but only focus on each paragraph\'s first sentence and signal words like "change over time", "different cultures", "It appears that".',
   exercise:{type:'match',label:'Match each section to its function.',
     pairs:[
       {left:'¶1-2',opts:['Phenomenon','History','Culture','Conclusion'],correct:0,
        hint:'"Phenomenon" means the opening situation or conflict.',hintZh:'Phenomenon = 现象/冲突。¶1-2 讲了什么现象？'},
       {left:'¶3-4',opts:['Phenomenon','History','Culture','Conclusion'],correct:1,
        hint:'Look for TIME signal words in ¶3\'s first sentence.',hintZh:'找 ¶3 首句中的时间信号词。'},
       {left:'¶5-7',opts:['Phenomenon','History','Culture','Conclusion'],correct:2,
        hint:'Look for PLACE signal words in ¶5\'s first sentence.',hintZh:'找 ¶5 首句中的地点信号词。'},
       {left:'¶8',opts:['Phenomenon','History','Culture','Conclusion'],correct:3,
        hint:'"It appears that" is a summary signal word.',hintZh:'"It appears that" 是总结信号词。'},
     ]},
   discuss:{
     probe:{q:'How did you decide that ¶3-4 is about "History" and not "Culture"? What signal words helped you?',
       translate:'你怎么判断 ¶3-4 是"历史"而不是"文化"？',
       aiReply:'The key is in ¶3\'s first sentence: "change over time" and "different periods of history" — these are TIME signal words.\n\nCompare with ¶5: "different cultures around the world" — that\'s a PLACE signal.\n\nTime words = History. Place words = Culture.',
       followUp:'Why is ¶8 the Conclusion and not another Culture paragraph?',
       followUpTranslate:'¶8 为什么是结论而不是又一个文化段？',
       followUpReply:'Three clues: 1) "It appears that" — summary signal. 2) No new examples. 3) Circles back to the opening question.\n\nWhen you see these three together, you\'ve found the conclusion!'},
     insight:'💡 Skimming: Read first sentences + signal words. Time words → History. Place words → Culture. Summary words → Conclusion. Full structure in 3 minutes.',
     insightZh:'💡 略读：读首句 + 信号词。时间词→历史，地理词→文化，总结词→结论。'},
   summary:'Well done! Text structure: Phenomenon → History → Culture → Conclusion.\n\nThe writer builds an argument step by step. Next, let\'s collect the evidence.'},

  {id:3,name:'Scan & Build',subtitle:'Collect evidence',time:'15 min',focus:[3,4,5,6,7],
   intro:'Now we go from skeleton to details.\n\nDon\'t translate every sentence — use the Information Matrix.\n\nOnly collect three things: WHERE, WHAT people did, and WHY.',
   exercise:{type:'matrix',label:'Read ¶3-7 and fill the matrix.',
     rows:[
       {place:'Ancient Egypt (¶3)',demo:true,practice:'Painted dark kohl around eyes',reason:'Show wealth and status'},
       {place:'1600s Europe (¶4)',practice:'',reason:'',hint:'Look for what was "considered stunning beauty".',hintZh:'找什么被认为是 "stunning beauty"。'},
       {place:'Borneo (¶5)',practice:'',reason:'',hint:'Their body art is like a diary of...',hintZh:'他们的 body art 像一本什么的日记？'},
       {place:'NZ Maori (¶6)',practice:'',reason:'',hint:'What is "tā moko"? What does it show?',hintZh:'tā moko 是什么？代表什么？'},
       {place:'Myanmar (¶7)',practice:'',reason:'',hint:'Find "wearing..." in the first sentence.',hintZh:'找 ¶7 第一句中 "wearing..." 后面的内容。'},
       {place:'Indonesia (¶7)',practice:'',reason:'',hint:'Find "sharpening..." in the second sentence.',hintZh:'找 ¶7 第二句中 "sharpening..." 的内容。'},
     ]},
   discuss:{
     probe:{q:'Look at your completed matrix. Are these beauty practices only about "looking good"? What do they have in common?',
       translate:'这些审美实践仅仅是为了好看吗？有什么共同点？',
       aiReply:'Not just "looking good"! Egypt\'s kohl = wealth. Borneo\'s tattoos = life records. Maori\'s tā moko = social position. Indonesia\'s teeth = cultural identity.\n\nCommon thread: every beauty practice carries cultural meaning — identity, status, belonging. Beauty is a cultural language.',
       followUp:'What reading method did you use to find all this information in such a long text?',
       followUpTranslate:'你是用什么方法从这么长的文章里找到这些信息的？',
       followUpReply:'You used Scanning — reading with a specific target (where/what/why) and quickly locating information.\n\nSkimming finds structure. Scanning finds details. They work together!'},
     insight:'💡 Beauty practices are more than "looking good" — they\'re about identity, status, and culture. Scanning helps you extract organized evidence from long texts.',
     insightZh:'💡 审美实践不只是好看——背后是身份、地位、文化。Scanning 帮你从长文中提取结构化信息。'},
   summary:'Excellent! You turned paragraphs into organized evidence.\n\nYour matrix shows beauty is about culture, status, and identity.\n\nNext, use this evidence to form your own opinion.'},

  {id:4,name:'Evaluate',subtitle:'Do you agree?',time:'12 min',focus:[2,8],
   intro:'Now the most important thinking task.\n\nGo back to ¶2: the writer calls modern beauty standards "shallow beauty ideals".\n\nDo you agree? Use evidence from your matrix.',
   exercise:{type:'stance',label:'Choose your position and select supporting evidence.',
     stanceQ:'Do you agree that the media\'s beauty standard is "shallow"?',
     stanceQZh:'你同意现代媒体的审美标准是"肤浅的"吗？',
     stanceOpts:['I agree','I partly agree','I disagree'],
     evidence:[
       'Ancient Egypt: kohl showed wealth and status',
       '1600s Europe: plump + pale = beauty (different from today)',
       'Borneo: tattoos as a diary of life events',
       'NZ Maori: tā moko shows social position',
       'Myanmar: metal neck rings seen as elegant',
       'Indonesia: sharpening teeth for cultural identity',
       'Beauty changes across time and cultures',
       'Modern media only promotes one standard: slim and fair',
     ]},
   discuss:{
     probe:{q:'Pick your strongest piece of evidence. Explain: what does it prove about beauty standards?',
       translate:'挑最有说服力的一条证据，解释它能证明什么。',
       aiReply:'The key is explaining WHAT the evidence proves. For example: "In 1600s Europe, plump and pale was beautiful" proves beauty changes over time — today\'s standard isn\'t eternal.\n\nSo calling today\'s standard the ONLY standard is indeed "shallow."',
       followUp:'What is the writer\'s conclusion in ¶8? Does it match your judgment?',
       followUpTranslate:'作者在 ¶8 的结论是什么？和你的判断一致吗？',
       followUpReply:'¶8: "people change their appearance to tell the world about their culture and status."\n\nThe writer uses evidence, not just opinion. This "evidence-based argument" is more persuasive than simply saying "I disagree."\n\nThat\'s academic writing: position + evidence + explanation.'},
     insight:'💡 Strong opinions need evidence: 1) State position. 2) Give evidence. 3) Explain what it proves. This is the "claim → evidence → explanation" chain.',
     insightZh:'💡 好观点需要证据：1) 表明立场；2) 给证据；3) 解释证据证明了什么。'},
   summary:'Very good! You used evidence to support your judgment — a big step in academic reading.\n\nLet\'s review how you learned today.'},

  {id:5,name:'Wrap-up',subtitle:'Review & transfer',time:'5 min',focus:[],
   intro:'Before we finish, think about HOW you read this text today.\n\nGood readers use strategies, not just translation.\n\nLet\'s name the steps and think about using them next time.',
   exercise:{type:'order',label:'Put today\'s 4 reading strategies in the correct order.',
     items:['Scanning — find specific details','Predicting — read the title, ask questions','Evaluating — form your own judgment','Skimming — find the structure quickly'],
     correctOrder:[1,3,0,2]},
   discuss:{
     probe:{q:'If you get a new article next time — "Beyond the Plate" — what would you do first? Why?',
       translate:'如果下次给你新文章，你会先做什么？为什么？',
       aiReply:'Best starting point: Predicting — title, guess topic, form a question. Then Skim first sentences for structure. Then Scan for details + build matrix. Finally Evaluate.\n\nThe order matters: big picture → details → thinking.',
       followUp:'Which of today\'s 4 strategies helped you the most? Why?',
       followUpTranslate:'今天哪个策略对你帮助最大？为什么？',
       followUpReply:'Some students love Skimming — they used to read word by word, now they get structure in 3 minutes. Others find Scanning + Matrix most useful.\n\nThe key: these improve with practice. Homework is your chance!'},
     insight:'💡 Today: not just "beauty" but a reading process — Predict → Skim → Scan → Evaluate. Works for any argumentative text.',
     insightZh:'💡 今天学的不只是"美"，更是阅读方法：Predict → Skim → Scan → Evaluate。'},
   summary:'Excellent! Reading process: Predict → Skim → Scan → Evaluate.\n\nThese work for any text. Keep using them!\n\nHomework: "Beyond the Plate" using today\'s 4 steps.'},
];

const LESSON_INTRO='Hello! Welcome to today\'s English reading lesson.\n\nToday we\'re reading Ideal Beauty. Keep one big question in mind:\n\nIs one idea of beauty really better than another?\n\nWe\'ll complete 5 tasks. Let\'s begin!';
const LESSON_SUMMARY='Great job today! 🎉\n\nYou explored whether one beauty standard is better than another, and practiced 4 reading strategies.\n\nReading is not just understanding words — it\'s organizing evidence and forming your own judgment.\n\nHomework: "Beyond the Plate" using today\'s 4 steps.';

const PHASE_ICONS=['📖','✏️','💬','⭐'];
const PHASE_LABELS=['Listen','Practice','Discuss','Takeaway'];

/* AI presets per task */
const AI_BANK={
  1:[{q:'What does "conflict" mean?',a:'Conflict = 冲突。Two opposite ideas of beauty: gaining weight (Nigeria) vs slim (media).'},{q:'I don\'t understand ¶2',a:'¶2: media promotes "shallow beauty ideals" — too simple, only about appearance. The writer questions this.'}],
  2:[{q:'What is "Phenomenon"?',a:'Phenomenon = 现象。¶1-2 describes a phenomenon: different cultures have different beauty standards.'},{q:'What does "It appears that" mean?',a:'"It appears that" = 看起来。A signal word for conclusions.'}],
  3:[{q:'How to fill Myanmar?',a:'¶7: "women wearing metal rings around their necks." Practice = wearing metal neck rings.'},{q:'Can\'t find the reason',a:'Some reasons are implied. Borneo: tattoos like "a diary" → reason = recording life events.'}],
  4:[{q:'What does "shallow" mean?',a:'Shallow = 肤浅。Media beauty is "shallow" because it only cares about looks, ignoring cultural meaning.'},{q:'Can I add my own ideas?',a:'Yes! Text evidence + your own observations both work.'}],
  5:[{q:'What are the 4 strategies?',a:'1. Predicting → 2. Skimming → 3. Scanning → 4. Evaluating'},{q:'Works for other texts?',a:'Absolutely! These 4 steps work for any argumentative or expository text.'}],
};

/* ═══ STYLES ═══ */
const S={
  root:{display:'flex',flexDirection:'column',height:'100vh',background:'var(--bg)',fontFamily:'"Plus Jakarta Sans",-apple-system,"PingFang SC",sans-serif'},
  topBar:{display:'flex',alignItems:'center',gap:12,padding:'0 20px',height:44,background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  topTitle:{fontSize:15,fontWeight:700,letterSpacing:'-.2px'},
  topSub:{fontSize:11,color:'var(--t3)',flex:1},
  progRow:{display:'flex',alignItems:'flex-start',gap:0,padding:'10px 20px 8px',background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  progDot:{width:26,height:26,borderRadius:'50%',background:'var(--surface2)',color:'var(--t3)',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,border:'1.5px solid var(--border)',transition:'all .15s'},
  progAct:{background:'var(--t1)',color:'var(--surface)',borderColor:'var(--t1)'},
  progDone:{background:'var(--green)',color:'#fff',borderColor:'var(--green)'},
  progLine:{flex:1,height:1,background:'var(--border)',margin:'12px 4px 0'},
  progName:{fontSize:9,color:'var(--t3)',maxWidth:62,textAlign:'center',marginTop:3,lineHeight:1.2},
  mainWrap:{flex:1,display:'flex',minHeight:0},
  leftCol:{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',minWidth:0,paddingTop:32},
  inner:{maxWidth:640,margin:'0 auto',padding:'20px 24px 80px',width:'100%',flex:1},
  rightCol:{flex:1,borderLeft:'1px solid var(--border)',background:'var(--surface)',display:'flex',flexDirection:'column',minWidth:0,paddingTop:32},
  textScroll:{flex:1,overflowY:'auto',padding:'8px 14px'},
  tp:{padding:'8px 2px',borderBottom:'1px solid var(--border)',fontSize:13,lineHeight:1.85,transition:'opacity .3s'},
  tpN:{fontSize:9,fontWeight:600,color:'var(--teal)',background:'var(--teal-bg)',padding:'2px 5px',borderRadius:3,marginRight:4},
  tpSig:{background:'var(--blue-bg)',color:'var(--blue)',padding:'0 3px',borderRadius:2,fontWeight:500},
  card:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'20px 24px',marginBottom:16},
  aiBox:{display:'flex',gap:10,padding:'14px 16px',background:'var(--bg)',borderRadius:8,border:'1px solid var(--border)'},
  aiDot:{width:7,height:7,borderRadius:'50%',background:'var(--purple)',flexShrink:0,marginTop:5},
  /* Phase bar */
  phaseBar:{display:'flex',gap:0,padding:'0 20px',background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0,height:40},
  phaseTab:{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,cursor:'pointer',position:'relative',fontSize:11,fontWeight:500,color:'var(--t3)',transition:'all .15s'},
  phaseTabAct:{color:'var(--t1)',fontWeight:600},
  phaseTabDone:{color:'var(--green)'},
  phaseTabBar:{position:'absolute',bottom:0,left:'10%',right:'10%',height:2.5,borderRadius:'2px 2px 0 0',transition:'all .15s'},
  phaseTabBarAct:{background:'var(--t1)'},
  phaseTabBarDone:{background:'var(--green)'},
  /* Common */
  btn:{width:'100%',padding:'13px 20px',borderRadius:8,border:'none',background:'var(--t1)',color:'var(--surface)',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'},
  btnOff:{opacity:.35,cursor:'default'},
  qCard:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:8},
  opt:{padding:'8px 12px',borderRadius:6,border:'1.5px solid var(--border)',marginBottom:4,fontSize:12,cursor:'pointer',background:'var(--surface)',transition:'all .1s'},
  optSel:{borderColor:'var(--teal)',background:'var(--teal-bg)',color:'var(--teal)',fontWeight:500},
  optOk:{borderColor:'var(--green)',background:'var(--green-bg)',color:'var(--green)'},
  optBad:{borderColor:'var(--red)',background:'var(--red-bg)',color:'var(--red)'},
  hintBtn:{fontSize:10,color:'var(--amber)',cursor:'pointer',padding:'2px 6px',borderRadius:3,border:'1px solid rgba(122,77,14,.2)',background:'var(--amber-bg)',fontFamily:'inherit',marginLeft:6,display:'inline-flex',alignItems:'center',gap:2},
  hintText:{fontSize:11,color:'var(--amber)',padding:'6px 10px',background:'var(--amber-bg)',borderRadius:5,marginTop:4,lineHeight:1.5},
  translateBtn:{fontSize:10,color:'var(--t3)',cursor:'pointer',padding:'2px 6px',borderRadius:3,border:'1px solid var(--border)',background:'var(--surface)',fontFamily:'inherit',marginLeft:4},
  translateText:{fontSize:11,color:'var(--t3)',fontStyle:'italic',marginTop:4,padding:'4px 8px',background:'var(--surface2)',borderRadius:4},
  matchRow:{display:'flex',alignItems:'center',gap:10,marginBottom:8},
  matchLeft:{fontSize:14,fontWeight:700,width:48,textAlign:'center',flexShrink:0},
  matchOpt:{fontSize:11,padding:'5px 10px',borderRadius:5,border:'1.5px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontFamily:'inherit',color:'var(--t2)',fontWeight:500},
  matWrap:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:10,marginBottom:10,overflowX:'auto'},
  matTh:{textAlign:'left',padding:'6px 7px',background:'var(--surface2)',fontWeight:500,color:'var(--t2)',borderBottom:'1px solid var(--border)',fontSize:10,textTransform:'uppercase'},
  matTd:{padding:'4px 6px',borderBottom:'1px solid var(--border)',verticalAlign:'top'},
  matIn:{width:'100%',border:'1px solid var(--border)',borderRadius:4,padding:'5px 7px',fontSize:12,fontFamily:'inherit',background:'var(--bg)'},
  stBtn:{flex:1,padding:'10px 8px',borderRadius:8,border:'1.5px solid var(--border)',background:'var(--surface)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:'var(--t2)',textAlign:'center'},
  evRow:{display:'flex',alignItems:'flex-start',gap:6,padding:'7px 10px',borderRadius:5,border:'1px solid var(--border)',marginBottom:3,cursor:'pointer',background:'var(--surface)',fontSize:12},
  orderSlot:{display:'flex',alignItems:'center',gap:4,padding:'7px 10px',borderRadius:5,border:'1.5px solid var(--teal)',background:'var(--teal-bg)',fontSize:12,color:'var(--teal)',fontWeight:500,marginBottom:3},
  orderChoice:{padding:'7px 10px',borderRadius:5,border:'1.5px solid var(--border)',background:'var(--surface)',fontSize:12,cursor:'pointer',marginBottom:3,color:'var(--t2)'},
  probeBox:{border:'1px solid rgba(58,49,133,.15)',borderRadius:10,padding:'14px 16px',marginBottom:10,background:'var(--surface)'},
  aiReply:{display:'flex',gap:10,padding:'14px 16px',background:'var(--purple-bg)',borderRadius:10,marginBottom:10,border:'1px solid rgba(58,49,133,.12)'},
  insight:{background:'var(--amber-bg)',border:'1px solid rgba(122,77,14,.15)',borderRadius:8,padding:'12px 14px',fontSize:13,lineHeight:1.6,color:'var(--amber)',marginBottom:10},
  freeInput:{width:'100%',border:'1px solid var(--border)',borderRadius:6,padding:'8px 10px',fontSize:13,fontFamily:'inherit',background:'var(--bg)',minHeight:50,resize:'vertical',lineHeight:1.6},
  aiFab:{position:'fixed',bottom:16,right:16,width:44,height:44,borderRadius:'50%',background:'var(--purple)',color:'#fff',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 14px rgba(58,49,133,.3)',zIndex:50,fontSize:18},
  aiPanel:{position:'fixed',bottom:70,right:16,width:320,maxHeight:380,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,boxShadow:'0 10px 36px rgba(0,0,0,.12)',zIndex:49,display:'flex',flexDirection:'column',overflow:'hidden'},
};

/* ═══ SMALL COMPONENTS ═══ */
function HintBtn({hint,hintZh}){
  const [show,setShow]=useState(false);
  return React.createElement(Fragment,null,
    React.createElement('button',{style:S.hintBtn,onClick:e=>{e.stopPropagation();setShow(!show)}},'💡 Hint'),
    show&&React.createElement('div',{style:S.hintText},hint,hintZh&&React.createElement('span',{style:{color:'var(--t3)',marginLeft:6}},hintZh)),
  );
}
function TranslateBtn({text}){
  const [show,setShow]=useState(false);
  return React.createElement(Fragment,null,
    React.createElement('button',{style:S.translateBtn,onClick:e=>{e.stopPropagation();setShow(!show)}},'🔄'),
    show&&React.createElement('div',{style:S.translateText},text),
  );
}
function renderSig(text,sigs){
  if(!sigs)return text;
  let parts=[text];
  sigs.forEach(s=>{let np=[];parts.forEach(p=>{if(typeof p!=='string'){np.push(p);return;}const i=p.indexOf(s);if(i===-1){np.push(p);return;}if(i>0)np.push(p.slice(0,i));np.push(React.createElement('span',{key:s+i,style:S.tpSig},s));if(i+s.length<p.length)np.push(p.slice(i+s.length));});parts=np;});
  return parts;
}

/* ═══ TEXT PANEL ═══ */
function TextPanel({focus}){
  const ref=useRef(null);const prev=useRef('');
  const f=new Set(focus||[]);
  useEffect(()=>{
    const k=(focus||[]).join(',');
    if(k!==prev.current&&focus?.length&&ref.current){prev.current=k;
      setTimeout(()=>{const el=ref.current.querySelector(`[data-p="${focus[0]}"]`);if(el)ref.current.scrollTop=el.offsetTop-ref.current.offsetTop-10;},200);
    }
  },[focus]);
  return React.createElement('div',{style:S.rightCol},
    React.createElement('div',{style:{display:'flex',alignItems:'center',gap:6,padding:'10px 14px',borderBottom:'1px solid var(--border)',flexShrink:0}},
      React.createElement('span',{style:{fontSize:12,fontWeight:600,color:'var(--teal)',flex:1}},'📖 Text · Ideal Beauty'),
      f.size>0&&React.createElement('span',{style:{fontSize:10,padding:'2px 8px',borderRadius:3,background:'var(--teal-bg)',color:'var(--teal)',fontWeight:500}},'Focus ¶'+[...f].join(',')),
    ),
    React.createElement('div',{ref,style:S.textScroll},
      PARAGRAPHS.map(p=>React.createElement('p',{key:p.n,'data-p':p.n,style:{...S.tp,opacity:f.size>0&&!f.has(p.n)?.2:1}},
        React.createElement('span',{style:S.tpN},'¶'+p.n),' ',renderSig(p.text,p.sig)))
    ),
  );
}

/* ═══ AI FLOAT ═══ */
function AIFloat({taskId}){
  const [open,setOpen]=useState(false);
  const [msgs,setMsgs]=useState([]);
  const ref=useRef(null);
  const ask=(q,a)=>{setMsgs(m=>[...m,{t:'q',x:q},{t:'a',x:a}]);setTimeout(()=>ref.current&&(ref.current.scrollTop=ref.current.scrollHeight),50);};
  const p=AI_BANK[taskId]||[];
  return React.createElement(Fragment,null,
    React.createElement('button',{style:{...S.aiFab,...(open?{transform:'rotate(45deg)'}:{})},onClick:()=>setOpen(!open)},open?'+':'💬'),
    open&&React.createElement('div',{style:S.aiPanel},
      React.createElement('div',{style:{display:'flex',alignItems:'center',gap:6,padding:'10px 14px',borderBottom:'1px solid var(--border)'}},
        React.createElement('span',{style:{width:7,height:7,borderRadius:'50%',background:'var(--purple)'}}),
        React.createElement('span',{style:{fontSize:12,fontWeight:600,color:'var(--purple)',flex:1}},'AI Assistant'),
      ),
      p.length>0&&React.createElement('div',{style:{display:'flex',gap:5,padding:'8px 12px',overflowX:'auto',borderBottom:'1px solid var(--border)',flexShrink:0}},
        p.map((pr,i)=>React.createElement('button',{key:i,style:{...S.matchOpt,fontSize:10,padding:'4px 8px'},onClick:()=>ask(pr.q,pr.a)},pr.q))),
      React.createElement('div',{ref,style:{flex:1,overflowY:'auto',padding:'10px 12px',maxHeight:200}},
        msgs.length===0&&React.createElement('div',{style:{fontSize:11,color:'var(--t3)',textAlign:'center',padding:16}},'Ask me anything! 😊'),
        msgs.map((m,i)=>React.createElement('div',{key:i,style:m.t==='q'?{fontSize:12,background:'var(--t1)',color:'var(--surface)',padding:'6px 10px',borderRadius:7,marginLeft:40,marginBottom:5}:{fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'8px 12px',marginRight:24,marginBottom:5,lineHeight:1.6,color:'var(--t2)'}},m.x))),
      React.createElement('div',{style:{display:'flex',gap:6,padding:'8px 12px',borderTop:'1px solid var(--border)'}},
        React.createElement('input',{style:{flex:1,padding:'7px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:12,fontFamily:'inherit',background:'var(--bg)'},placeholder:'Type your question...'}),
        React.createElement('button',{style:{width:28,height:28,borderRadius:6,border:'none',background:'var(--t1)',color:'var(--surface)',cursor:'pointer',fontSize:12}},'→')),
    ),
  );
}

/* ═══ BOARD DRAWER ═══ */
const BOARD_CONTENT={
  1:{title:'The Conflict',type:'compare',
    left:{label:'Nigeria',items:['Gaining weight','Fattening rooms','Fat = wealth']},
    right:{label:'Modern Media',items:['Slim and fair','Young models','One standard']},
    vs:'vs'},
  2:{title:'Text Structure',type:'flow',
    steps:[{label:'Phenomenon',sub:'¶1-2 · Conflict'},{label:'History',sub:'¶3-4 · Across Time'},{label:'Culture',sub:'¶5-7 · Across Space'},{label:'Conclusion',sub:'¶8 · All Beautiful'}]},
  3:{title:'Evidence Matrix',type:'matrix',
    headers:['Where','What','Why'],
    rows:[['Ancient Egypt','Kohl eye paint','Wealth & status'],['1600s Europe','Plump & pale','Beauty standard'],['Borneo','Tattoos','Diary of events'],['NZ Maori','Tā moko','Social position'],['Myanmar','Metal neck rings','Elegance'],['Indonesia','Sharpened teeth','Cultural identity']]},
  4:{title:'Evaluate',type:'chain',
    items:['Position: I agree / disagree that...','Evidence: Based on the matrix...','Explanation: This shows that...']},
  5:{title:'4 Reading Strategies',type:'flow',
    steps:[{label:'Predict',sub:'Title → Questions'},{label:'Skim',sub:'First sentences → Structure'},{label:'Scan',sub:'Details → Matrix'},{label:'Evaluate',sub:'Evidence → Judgment'}]},
};

function BoardDrawer({taskId,open,onToggle}){
  const bc=BOARD_CONTENT[taskId];
  if(!bc)return null;
  const bStyles={
    wrap:{background:'var(--t1)',color:'#e8e6df',borderRadius:'0 0 12px 12px',overflow:'hidden',transition:'max-height .4s ease, opacity .3s',maxHeight:open?400:0,opacity:open?1:0},
    inner:{padding:'16px 24px 20px'},
    handle:{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'6px 0',cursor:'pointer',fontSize:11,fontWeight:600,color:'var(--t3)',background:'var(--surface)',borderBottom:'1px solid var(--border)'},
    title:{fontSize:14,fontWeight:700,color:'#e8e6df',marginBottom:12,display:'flex',alignItems:'center',gap:8},
    titleDot:{width:8,height:8,borderRadius:'50%',background:'#5dcaa5'},
    flowRow:{display:'flex',alignItems:'center',gap:0},
    flowItem:{flex:1,background:'rgba(255,255,255,.08)',borderRadius:8,padding:'10px 12px',textAlign:'center'},
    flowArrow:{padding:'0 6px',color:'rgba(255,255,255,.3)',fontSize:14},
    flowLabel:{fontSize:13,fontWeight:700,color:'#e8e6df'},
    flowSub:{fontSize:10,color:'rgba(255,255,255,.5)',marginTop:2},
    compareRow:{display:'flex',gap:10,alignItems:'stretch'},
    compareCard:{flex:1,borderRadius:8,padding:'12px 14px'},
    compareCool:{background:'rgba(30,95,160,.2)',border:'1px solid rgba(30,95,160,.3)'},
    compareWarm:{background:'rgba(196,138,30,.15)',border:'1px solid rgba(196,138,30,.3)'},
    compareVs:{display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'rgba(255,255,255,.4)',width:28},
    matTable:{width:'100%',borderCollapse:'collapse',fontSize:11},
    matTh:{textAlign:'left',padding:'5px 8px',borderBottom:'1px solid rgba(255,255,255,.1)',color:'rgba(255,255,255,.5)',fontSize:9,textTransform:'uppercase',letterSpacing:'.3px'},
    matTd:{padding:'4px 8px',borderBottom:'1px solid rgba(255,255,255,.06)',color:'#e8e6df'},
    chainItem:{padding:'8px 12px',borderRadius:6,background:'rgba(255,255,255,.06)',marginBottom:4,fontSize:12,color:'#e8e6df',borderLeft:'3px solid #5dcaa5'},
  };
  const overlayS={
    backdrop:{position:'absolute',inset:0,zIndex:20,display:'flex',flexDirection:'column',transition:'opacity .35s',opacity:open?1:0,pointerEvents:open?'auto':'none'},
    bg:{flex:1,background:'var(--t1)',display:'flex',flexDirection:'column'},
    inner:{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 48px',maxWidth:960,margin:'0 auto',width:'100%'},
    close:{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 0',cursor:'pointer',fontSize:12,fontWeight:600,color:'rgba(255,255,255,.4)',borderTop:'1px solid rgba(255,255,255,.06)',flexShrink:0},
    handle:{position:'absolute',bottom:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'7px 0',cursor:'pointer',fontSize:11,fontWeight:600,color:'var(--t3)',background:'var(--surface)',borderTop:'1px solid var(--border)',zIndex:21,borderRadius:'0 0 0 0'},
    title:{fontSize:20,fontWeight:700,color:'#e8e6df',marginBottom:24,display:'flex',alignItems:'center',gap:10},
    titleDot:{width:10,height:10,borderRadius:'50%',background:'#5dcaa5'},
  };
  return React.createElement(Fragment,null,
    !open&&React.createElement('div',{style:{position:'absolute',top:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'7px 0',cursor:'pointer',fontSize:11,fontWeight:600,color:'var(--t3)',background:'var(--surface)',borderBottom:'1px solid var(--border)',zIndex:15},onClick:onToggle},
      React.createElement('span',null,'🖊'),
      React.createElement('span',null,'Board'),
      React.createElement('span',{style:{fontSize:9}},'▼')),
    React.createElement('div',{style:overlayS.backdrop},
      React.createElement('div',{style:overlayS.bg},
        React.createElement('div',{style:overlayS.inner},
          React.createElement('div',{style:overlayS.title},
            React.createElement('span',{style:overlayS.titleDot}),bc.title),
        bc.type==='flow'&&React.createElement('div',{style:bStyles.flowRow},
          bc.steps.map((s,i)=>React.createElement(Fragment,{key:i},
            i>0&&React.createElement('span',{style:bStyles.flowArrow},'→'),
            React.createElement('div',{style:bStyles.flowItem},
              React.createElement('div',{style:bStyles.flowLabel},s.label),
              React.createElement('div',{style:bStyles.flowSub},s.sub))))),
        bc.type==='compare'&&React.createElement('div',{style:bStyles.compareRow},
          React.createElement('div',{style:{...bStyles.compareCard,...bStyles.compareWarm}},
            React.createElement('div',{style:{fontSize:11,fontWeight:700,color:'#f0c56c',marginBottom:6}},bc.left.label),
            bc.left.items.map((x,i)=>React.createElement('div',{key:i,style:{fontSize:12,color:'#e8e6df',padding:'2px 0'}},x))),
          React.createElement('div',{style:bStyles.compareVs},bc.vs),
          React.createElement('div',{style:{...bStyles.compareCard,...bStyles.compareCool}},
            React.createElement('div',{style:{fontSize:11,fontWeight:700,color:'#7ab8f0',marginBottom:6}},bc.right.label),
            bc.right.items.map((x,i)=>React.createElement('div',{key:i,style:{fontSize:12,color:'#e8e6df',padding:'2px 0'}},x)))),
        bc.type==='matrix'&&React.createElement('table',{style:bStyles.matTable},
          React.createElement('thead',null,React.createElement('tr',null,
            bc.headers.map((h,i)=>React.createElement('th',{key:i,style:bStyles.matTh},h)))),
          React.createElement('tbody',null,
            bc.rows.map((r,ri)=>React.createElement('tr',{key:ri},
              r.map((c,ci)=>React.createElement('td',{key:ci,style:bStyles.matTd},c)))))),
        bc.type==='chain'&&React.createElement('div',{style:{width:'100%',maxWidth:600}},
          bc.items.map((x,i)=>React.createElement('div',{key:i,style:bStyles.chainItem},x))),
        ),
        React.createElement('div',{style:overlayS.close,onClick:onToggle},'▲ Close Board'),
      ),
    ),
  );
}

/* ═══ PHASE VIEWS ═══ */

/* Listen phase */
function ListenPhase({task,onNext}){
  return React.createElement('div',null,
    React.createElement('div',{style:S.card},
      React.createElement('div',{style:{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}},`Task ${task.id} · ${task.name}`),
      React.createElement('div',{style:{fontSize:20,fontWeight:700,letterSpacing:'-.3px',marginBottom:12}},task.subtitle),
      React.createElement('div',{style:S.aiBox},
        React.createElement('div',{style:S.aiDot}),
        React.createElement('div',{style:{flex:1,fontSize:14,lineHeight:1.8,color:'var(--t1)',whiteSpace:'pre-line'}},task.intro)),
    ),
    React.createElement('button',{style:S.btn,onClick:onNext},'Start Practice →'),
  );
}

/* Practice phase */
function PracticePhase({task,onNext}){
  const ex=task.exercise;
  const [ans,setAns]=useState({});
  const [sub,setSub]=useState(false);
  const canSub=()=>{
    if(ex.type==='quiz')return Object.keys(ans).length===ex.questions.length;
    if(ex.type==='match')return Object.keys(ans).length===ex.pairs.length;
    if(ex.type==='matrix')return true;
    if(ex.type==='stance')return ans.stance!==undefined&&(ans.evidence||[]).length>=1;
    if(ex.type==='order')return(ans.order||[]).length===ex.items.length;
    return true;};

  return React.createElement('div',null,
    React.createElement('div',{style:{fontSize:13,color:'var(--t2)',marginBottom:12}},ex.label),

    ex.type==='quiz'&&ex.questions.map((q,qi)=>
      React.createElement('div',{key:qi,style:S.qCard},
        React.createElement('div',{style:{fontSize:12,fontWeight:600,marginBottom:4,display:'flex',alignItems:'center',flexWrap:'wrap',gap:4}},
          q.q,q.translate&&React.createElement(TranslateBtn,{text:q.translate}),q.hint&&React.createElement(HintBtn,{hint:q.hint,hintZh:q.hintZh})),
        q.opts.map((o,oi)=>{
          const sel=ans[qi]===oi;const ok=sub&&oi===q.correct;const bad=sub&&sel&&oi!==q.correct;
          return React.createElement('div',{key:oi,style:{...S.opt,...(sel&&!sub?S.optSel:{}),...(ok?S.optOk:{}),...(bad?S.optBad:{})},onClick:sub?undefined:()=>setAns(a=>({...a,[qi]:oi}))},o);
        }),
      )),

    ex.type==='match'&&ex.pairs.map((p,pi)=>
      React.createElement('div',{key:pi,style:S.matchRow},
        React.createElement('div',{style:S.matchLeft},p.left),
        React.createElement('div',{style:{display:'flex',gap:5,flex:1,flexWrap:'wrap',alignItems:'center'}},
          p.opts.map((o,oi)=>{
            const sel=ans[pi]===oi;const ok=sub&&oi===p.correct;const bad=sub&&sel&&oi!==p.correct;
            return React.createElement('button',{key:oi,style:{...S.matchOpt,...(sel&&!sub?S.optSel:{}),...(ok?S.optOk:{}),...(bad?S.optBad:{})},onClick:sub?undefined:()=>setAns(a=>({...a,[pi]:oi}))},o);
          }),
          p.hint&&React.createElement(HintBtn,{hint:p.hint,hintZh:p.hintZh}),
        ),
      )),

    ex.type==='matrix'&&React.createElement('div',{style:S.matWrap},
      React.createElement('table',{style:{width:'100%',borderCollapse:'collapse',fontSize:12}},
        React.createElement('thead',null,React.createElement('tr',null,
          React.createElement('th',{style:{...S.matTh,width:'24%'}},'Where / When'),
          React.createElement('th',{style:{...S.matTh,width:'38%'}},'What they do'),
          React.createElement('th',{style:{...S.matTh,width:'38%'}},'Why'),)),
        React.createElement('tbody',null,ex.rows.map((r,ri)=>
          React.createElement('tr',{key:ri,style:r.demo?{background:'rgba(13,82,69,.03)'}:{}},
            React.createElement('td',{style:{...S.matTd,fontWeight:500,fontSize:12}},r.place),
            React.createElement('td',{style:S.matTd},r.demo?r.practice:
              React.createElement('div',null,React.createElement('input',{style:S.matIn,placeholder:'What?'}),r.hint&&React.createElement(HintBtn,{hint:r.hint,hintZh:r.hintZh}))),
            React.createElement('td',{style:S.matTd},r.demo?r.reason:React.createElement('input',{style:S.matIn,placeholder:'Why?'})),
          ))))),

    ex.type==='stance'&&React.createElement('div',null,
      React.createElement('div',{style:{fontSize:13,fontWeight:600,marginBottom:6,display:'flex',alignItems:'center',gap:4}},ex.stanceQ,ex.stanceQZh&&React.createElement(TranslateBtn,{text:ex.stanceQZh})),
      React.createElement('div',{style:{display:'flex',gap:6,marginBottom:12}},
        ex.stanceOpts.map((o,oi)=>React.createElement('button',{key:oi,style:{...S.stBtn,...(ans.stance===oi?{borderColor:'var(--teal)',background:'var(--teal-bg)',color:'var(--teal)'}:{})},onClick:()=>setAns(a=>({...a,stance:oi}))},o))),
      React.createElement('div',{style:{fontSize:11,fontWeight:600,color:'var(--t3)',marginBottom:6}},'Select supporting evidence (at least 1):'),
      ex.evidence.map((ev,ei)=>{
        const sel=(ans.evidence||[]).includes(ei);
        return React.createElement('div',{key:ei,style:{...S.evRow,...(sel?{borderColor:'var(--teal)',background:'var(--teal-bg)'}:{})},
          onClick:()=>setAns(a=>{const c=a.evidence||[];return{...a,evidence:sel?c.filter(x=>x!==ei):[...c,ei]};})},
          React.createElement('span',{style:{flexShrink:0}},sel?'✓':'○'),' ',ev);})),

    ex.type==='order'&&React.createElement(OrderEx,{items:ex.items,correct:ex.correctOrder,ans,setAns,sub}),

    !sub?React.createElement('button',{style:{...S.btn,marginTop:12,...(!canSub()?S.btnOff:{})},onClick:canSub()?()=>setSub(true):undefined},'Submit')
    :React.createElement('button',{style:{...S.btn,marginTop:12},onClick:onNext},'Continue to Discussion →'),
  );
}

function OrderEx({items,correct,ans,setAns,sub}){
  const order=ans.order||[];
  const rem=items.map((_,i)=>i).filter(i=>!order.includes(i));
  return React.createElement('div',null,
    React.createElement('div',{style:{fontSize:11,color:'var(--t3)',marginBottom:6}},'Click to select the correct order:'),
    order.map((idx,pos)=>{
      const ok=sub&&correct[pos]===idx;const bad=sub&&correct[pos]!==idx;
      return React.createElement('div',{key:'s'+pos,style:{...S.orderSlot,...(ok?{borderColor:'var(--green)',background:'var(--green-bg)'}:bad?{borderColor:'var(--red)',background:'var(--red-bg)'}:{})}},
        React.createElement('span',{style:{fontSize:11,fontWeight:700,color:'var(--t3)',marginRight:6}},pos+1+'.'),items[idx],
        !sub&&React.createElement('span',{style:{marginLeft:'auto',fontSize:10,color:'var(--t3)',cursor:'pointer'},onClick:e=>{e.stopPropagation();setAns(a=>({...a,order:order.filter((_,i)=>i!==pos)}))}},'✕'));}),
    rem.map(idx=>React.createElement('div',{key:'c'+idx,style:S.orderChoice,onClick:sub?undefined:()=>setAns(a=>({...a,order:[...(a.order||[]),idx]}))},items[idx])),
  );
}

/* Discuss phase */
function DiscussPhase({task,onNext}){
  const d=task.discuss;const pr=d.probe;
  const [step,setStep]=useState(0);
  const [input1,setI1]=useState('');
  const [input2,setI2]=useState('');
  const [extraMsgs,setEM]=useState([]);
  const [extraIn,setEI]=useState('');
  const sendExtra=()=>{
    if(!extraIn.trim())return;
    setEM(m=>[...m,{t:'q',x:extraIn},{t:'a',x:'Great question! Think about how the evidence in the text connects to your idea. Try using the pattern: "Based on the text, I think... because..."'}]);
    setEI('');
  };
  return React.createElement('div',null,
    React.createElement('div',{style:S.probeBox},
      React.createElement('div',{style:{display:'flex',gap:8,marginBottom:8}},
        React.createElement('div',{style:S.aiDot}),
        React.createElement('div',{style:{flex:1}},
          React.createElement('div',{style:{fontSize:13,fontWeight:600,color:'var(--t1)',lineHeight:1.5}},pr.q),
          pr.translate&&React.createElement(TranslateBtn,{text:pr.translate}))),
      step===0&&React.createElement('div',null,
        React.createElement('textarea',{style:S.freeInput,placeholder:'Share your thoughts... (English or Chinese)',value:input1,onChange:e=>setI1(e.target.value)}),
        React.createElement('button',{style:{...S.btn,marginTop:8,fontSize:13,...(input1.trim().length===0?S.btnOff:{})},onClick:input1.trim()?()=>setStep(1):undefined},'Submit')),
    ),
    step>=1&&React.createElement('div',{style:S.aiReply},
      React.createElement('div',{style:S.aiDot}),
      React.createElement('div',{style:{flex:1,fontSize:13,lineHeight:1.7,color:'var(--t1)',whiteSpace:'pre-line'}},pr.aiReply)),
    step>=1&&pr.followUp&&React.createElement('div',{style:S.probeBox},
      React.createElement('div',{style:{display:'flex',gap:8,marginBottom:8}},
        React.createElement('div',{style:S.aiDot}),
        React.createElement('div',{style:{flex:1}},
          React.createElement('div',{style:{fontSize:13,fontWeight:600,color:'var(--t1)',lineHeight:1.5}},pr.followUp),
          pr.followUpTranslate&&React.createElement(TranslateBtn,{text:pr.followUpTranslate}))),
      step<3&&React.createElement('div',null,
        React.createElement('textarea',{style:S.freeInput,placeholder:'Continue...',value:input2,onChange:e=>setI2(e.target.value)}),
        React.createElement('button',{style:{...S.btn,marginTop:8,fontSize:13,...(input2.trim().length===0?S.btnOff:{})},onClick:input2.trim()?()=>setStep(3):undefined},'Submit')),
    ),
    step>=3&&React.createElement('div',{style:S.aiReply},
      React.createElement('div',{style:S.aiDot}),
      React.createElement('div',{style:{flex:1,fontSize:13,lineHeight:1.7,color:'var(--t1)',whiteSpace:'pre-line'}},pr.followUpReply)),
    step>=1&&React.createElement('div',{style:S.insight},d.insight,d.insightZh&&React.createElement(TranslateBtn,{text:d.insightZh})),
    /* Continue discussing */
    step>=1&&React.createElement('div',{style:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',marginBottom:10}},
      React.createElement('div',{style:{fontSize:11,fontWeight:600,color:'var(--purple)',marginBottom:6}},'💬 Want to discuss more?'),
      extraMsgs.map((m,i)=>React.createElement('div',{key:i,style:m.t==='q'?{fontSize:12,background:'var(--t1)',color:'var(--surface)',padding:'6px 10px',borderRadius:7,marginLeft:40,marginBottom:5}:{fontSize:12,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'8px 12px',marginBottom:5,lineHeight:1.6,color:'var(--t2)'}},m.x)),
      React.createElement('div',{style:{display:'flex',gap:6}},
        React.createElement('input',{style:{flex:1,padding:'7px 10px',border:'1px solid var(--border)',borderRadius:6,fontSize:12,fontFamily:'inherit',background:'var(--bg)'},placeholder:'Ask anything...',value:extraIn,onChange:e=>setEI(e.target.value),onKeyDown:e=>{if(e.key==='Enter')sendExtra();}}),
        React.createElement('button',{style:{width:28,height:28,borderRadius:6,border:'none',background:'var(--t1)',color:'var(--surface)',cursor:'pointer',fontSize:12},onClick:sendExtra},'→'))),
    step>=1&&React.createElement('button',{style:{...S.btn,marginTop:8},onClick:onNext},'See Summary →'),
  );
}

/* Takeaway phase */
function TakeawayPhase({task,onComplete}){
  return React.createElement('div',null,
    React.createElement('div',{style:S.aiBox},
      React.createElement('div',{style:S.aiDot}),
      React.createElement('div',{style:{flex:1,fontSize:14,lineHeight:1.8,color:'var(--t1)',whiteSpace:'pre-line'}},task.summary)),
    React.createElement('button',{style:{...S.btn,marginTop:14},onClick:onComplete},task.id<5?'Next Task →':'Complete Course →'),
  );
}

/* ═══ TASK VIEW (segmented single-screen) ═══ */
function TaskView({task,onComplete,onBoardOpen,onBoardClose}){
  const [phase,setPhase]=useState(0);
  const [maxPhase,setMaxPhase]=useState(0);

  // Auto-open board on Listen and Takeaway
  useEffect(()=>{
    if(phase===0||phase===3)onBoardOpen();
    else onBoardClose();
  },[phase]);

  const advance=(to)=>{setPhase(to);setMaxPhase(m=>Math.max(m,to));};

  return React.createElement('div',null,
    /* Phase tabs */
    React.createElement('div',{style:S.phaseBar},
      PHASE_LABELS.map((label,i)=>{
        const isAct=phase===i;const isDone=i<maxPhase;const canClick=i<=maxPhase;
        return React.createElement('div',{key:i,style:{...S.phaseTab,...(isAct?S.phaseTabAct:isDone?S.phaseTabDone:{}),...(canClick?{cursor:'pointer'}:{cursor:'default',opacity:.5})},
          onClick:canClick?()=>setPhase(i):undefined},
          React.createElement('span',null,PHASE_ICONS[i]),
          React.createElement('span',null,label),
          React.createElement('div',{style:{...S.phaseTabBar,...(isAct?S.phaseTabBarAct:isDone?S.phaseTabBarDone:{})}}),
        );
      }),
    ),
    React.createElement('div',{style:S.inner},
      phase===0&&React.createElement(ListenPhase,{task,onNext:()=>advance(1)}),
      phase===1&&React.createElement(PracticePhase,{key:'p'+task.id,task,onNext:()=>advance(2)}),
      phase===2&&React.createElement(DiscussPhase,{key:'d'+task.id,task,onNext:()=>advance(3)}),
      phase===3&&React.createElement(TakeawayPhase,{task,onComplete}),
    ),
  );
}

/* ═══ APP ═══ */
function App(){
  const [screen,setScreen]=useState('intro');
  const [done,setDone]=useState(new Set());
  const [boardOpen,setBoardOpen]=useState(false);
  let taskId=0;
  if(screen!=='intro'&&screen!=='summary')taskId=parseInt(screen);
  const task=TASKS.find(t=>t.id===taskId);

  const completeTask=(tid)=>{
    setDone(d=>{const n=new Set(d);n.add(tid);return n;});
    if(tid<5)setScreen(String(tid+1));else setScreen('summary');
  };

  return React.createElement('div',{style:S.root},
    React.createElement('div',{style:S.topBar},
      React.createElement('div',{style:S.topTitle},'Ideal Beauty'),
      React.createElement('div',{style:S.topSub},'Senior High English · AI 1-on-1'),
      task&&React.createElement('div',{style:{fontSize:12,fontWeight:600}},`Task ${task.id}: ${task.name}`,
        React.createElement('span',{style:{color:'var(--t3)',fontWeight:400,marginLeft:6}},task.time)),
    ),
    React.createElement('div',{style:S.progRow},
      TASKS.map((t,i)=>{
        const isAct=taskId===t.id;const isDone=done.has(t.id);
        return React.createElement(Fragment,{key:t.id},
          React.createElement('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:0,cursor:'pointer'},onClick:()=>{if(isDone||isAct||t.id===1||done.has(t.id-1))setScreen(String(t.id))}},
            React.createElement('div',{style:{...S.progDot,...(isAct?S.progAct:isDone?S.progDone:{})}},isDone?'✓':t.id),
            React.createElement('div',{style:{...S.progName,...(isAct?{color:'var(--t1)',fontWeight:600}:{})}},t.name)),
          i<4&&React.createElement('div',{style:S.progLine}));
      }),
    ),
    React.createElement('div',{style:{...S.mainWrap,position:'relative'}},
      taskId>0&&React.createElement(BoardDrawer,{taskId:taskId,open:boardOpen,onToggle:()=>setBoardOpen(!boardOpen)}),
      React.createElement('div',{style:S.leftCol},
        screen==='intro'&&React.createElement('div',{style:S.inner},
          React.createElement('div',{style:S.card},
            React.createElement('div',{style:{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}},'Welcome'),
            React.createElement('div',{style:{fontSize:22,fontWeight:700,letterSpacing:'-.3px',marginBottom:14}},'Ideal Beauty'),
            React.createElement('div',{style:S.aiBox},
              React.createElement('div',{style:S.aiDot}),
              React.createElement('div',{style:{flex:1,fontSize:14,lineHeight:1.8,color:'var(--t1)',whiteSpace:'pre-line'}},LESSON_INTRO))),
          React.createElement('button',{style:S.btn,onClick:()=>setScreen('1')},'Start Task 1 →')),
        screen==='summary'&&React.createElement('div',{style:S.inner},
          React.createElement('div',{style:S.card},
            React.createElement('div',{style:{fontSize:10,fontWeight:600,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:6}},'Complete'),
            React.createElement('div',{style:{fontSize:22,fontWeight:700,letterSpacing:'-.3px',marginBottom:14}},'Great job! 🎉'),
            React.createElement('div',{style:S.aiBox},
              React.createElement('div',{style:S.aiDot}),
              React.createElement('div',{style:{flex:1,fontSize:14,lineHeight:1.8,color:'var(--t1)',whiteSpace:'pre-line'}},LESSON_SUMMARY)))),
        task&&React.createElement(TaskView,{key:task.id,task,onComplete:()=>completeTask(task.id),onBoardOpen:()=>setBoardOpen(true),onBoardClose:()=>setBoardOpen(false)}),
      ),
      React.createElement(TextPanel,{focus:task?task.focus:[]}),
      React.createElement(AIFloat,{taskId:taskId||1}),
    ),
  );
}

Object.assign(window,{App});
