/* ============================================================
   Select Evidence v2 — Two-column layout
   v2.1 fixes:
   - Phrase-level spans (not full sentences) — student picks short
     meaningful phrases, can't just click whole sentences.
   - AI gives contextual feedback on what student wrongly picked.
   - "ancient Egypt" is correctly tagged as a TIME signal (like
     "Elizabethan England") — both anchor an example to a period.
   ============================================================ */

const {useState, useMemo, useEffect, useRef, Fragment} = React;

/* ── DATA ──────────────────────────────────────────────────
   Each paragraph is now a list of *phrase-level* tokens.
   Tokens are either:
   - {t: 'plain text'}                           (non-clickable connective tissue)
   - {t: 'phrase', kind: 'pick'}                 (clickable but NOT evidence)
   - {t: 'phrase', kind: 'evidence', why: '...'} (clickable AND evidence)
   - {t: 'phrase', kind: 'distractor', wrongWhy: '...'}  (clickable, common wrong pick — has tailored explanation)
   Students can only click 'pick' / 'evidence' / 'distractor' tokens.
   This forces them to think at the phrase level, not blanket-select.
   ─────────────────────────────────────────────────────────── */

const PARAGRAPHS = [
  /* ¶1 — Phenomenon side A */
  {n:1, sectionId:'p12', tokens:[
    {t:'In '},
    {t:'many parts of Nigeria', kind:'distractor', wrongWhy:'A place — but ¶1-2 isn\'t about places. It\'s about the conflict between two ideals.'},
    {t:', it is traditional for women to go to special '},
    {t:'"fattening rooms"', kind:'pick'},
    {t:' before they get married. Happiness Edem went from 60 kg to twice that weight because, in her culture, '},
    {t:'being fat is a sign of wealth', kind:'evidence', why:'Names ONE side of the conflict — a clear beauty ideal stated as fact. Sets up the contrast.'},
    {t:'.'},
  ]},
  /* ¶2 — Phenomenon side B + the question */
  {n:2, sectionId:'p12', tokens:[
    {t:'But '},
    {t:'what about the rest of the world?', kind:'evidence', why:'A pivot — the writer turns from Nigeria to the wider world. This is what creates the conflict.'},
    {t:' Open any fashion magazine and you will see young models — women who are '},
    {t:'slim and fair', kind:'evidence', why:'Names the OTHER side of the conflict. Together with "fat is a sign of wealth", this is the phenomenon.'},
    {t:'. Many people are worried that modern media promotes '},
    {t:'shallow beauty ideals', kind:'evidence', why:'The exact phrase the article will question. ¶1-2 sets up this issue — that\'s what makes them the Phenomenon section.'},
    {t:'.'},
  ]},

  /* ¶3 — History topic sentence */
  {n:3, sectionId:'p34', tokens:[
    {t:'Ideas about physical beauty '},
    {t:'change over time', kind:'evidence', why:'Pure TIME signal. This is the topic sentence — the cleanest single cue that ¶3-4 is History.'},
    {t:' and '},
    {t:'different periods of history', kind:'evidence', why:'TIME signal repeated — the writer is being explicit. "Periods of history" can ONLY mean History.'},
    {t:' have had their own idea of what is beautiful. In '},
    {t:'ancient Egypt', kind:'evidence', why:'A historical period — like "Elizabethan England" or "the 1600s", it anchors the example to a TIME, which is what makes this section History.'},
    {t:', both men and women used to '},
    {t:'paint dark kohl around their eyes', kind:'distractor', wrongWhy:'A specific practice. The signal isn\'t WHAT they did — it\'s WHEN ("ancient Egypt").'},
    {t:'.'},
  ]},
  /* ¶4 — More historical eras */
  {n:4, sectionId:'p34', tokens:[
    {t:'In '},
    {t:'the 1600s in Europe', kind:'evidence', why:'A specific historical period — confirms the History pattern. Three time anchors so far: change over time → ancient Egypt → 1600s.'},
    {t:', being '},
    {t:'plump and pale-skinned', kind:'distractor', wrongWhy:'A description of the beauty ideal — interesting content, but not a structural signal.'},
    {t:' was considered stunning beauty. Rubens painted many women with round, soft bodies. In '},
    {t:'Elizabethan England', kind:'evidence', why:'Another historical era. Four time-anchors in two paragraphs = unambiguous History.'},
    {t:', pale skin was a sign of wealth.'},
  ]},

  /* ¶5 — Culture topic sentence */
  {n:5, sectionId:'p57', tokens:[
    {t:'Within '},
    {t:'different cultures around the world', kind:'evidence', why:'Topic sentence. "Different cultures" + "around the world" = pure PLACE/CULTURE signal. This is THE cue for ¶5-7.'},
    {t:', we can find diverse ideas about physical beauty. In '},
    {t:'Borneo', kind:'evidence', why:'A place. The writer just announced "different cultures around the world" — and now starts listing them.'},
    {t:', many people have '},
    {t:'tattoos', kind:'distractor', wrongWhy:'A practice. The signal is the place ("Borneo"), not what they do there.'},
    {t:'. For them, their body art is like a '},
    {t:'diary of important events', kind:'distractor', wrongWhy:'A vivid metaphor — but it\'s content, not a structural signal.'},
    {t:'.'},
  ]},
  /* ¶6 — Maori */
  {n:6, sectionId:'p57', tokens:[
    {t:'In '},
    {t:'New Zealand', kind:'evidence', why:'Another place. Pattern emerging: Borneo → New Zealand → (Myanmar next). Locations, not eras = Culture, not History.'},
    {t:', the Maori people have their own tradition — a form of tattooing called '},
    {t:'tā moko', kind:'distractor', wrongWhy:'A specific practice name. Interesting, but not a structural cue.'},
    {t:'. Unlike in Borneo, these tattoos show a person\'s position in society.'},
  ]},
  /* ¶7 — Myanmar + Indonesia */
  {n:7, sectionId:'p57', tokens:[
    {t:'European visitors to '},
    {t:'Myanmar', kind:'evidence', why:'Third country in three paragraphs. The pattern is now undeniable — places, not eras.'},
    {t:' were amazed to see women '},
    {t:'wearing metal rings around their necks', kind:'distractor', wrongWhy:'A vivid practice — but the structural cue is "Myanmar", not what they wear.'},
    {t:'. And in '},
    {t:'Indonesia', kind:'evidence', why:'Fourth place. Plus the next phrase says "cultural identity" — the writer is being explicit.'},
    {t:', some people practised sharpening their teeth, as it was considered a form of '},
    {t:'cultural identity', kind:'evidence', why:'The word "cultural" itself appears — the writer literally tells you "this is about culture".'},
    {t:'.'},
  ]},

  /* ¶8 — Conclusion */
  {n:8, sectionId:'p8', tokens:[
    {t:'It '},
    {t:'appears that', kind:'evidence', why:'"It appears that" — classic SUMMARY signal. Argumentative texts use this to introduce conclusions.'},
    {t:' people change their appearance to tell the world about their culture and status. '},
    {t:'Whether kohl, tattoos, or metal rings', kind:'evidence', why:'The "whether… or…" list pulls earlier examples together — only conclusions do this. No NEW examples, just a re-summary.'},
    {t:', these practices reflect '},
    {t:'cultural values, not just vanity', kind:'evidence', why:'A FINAL claim that answers the article\'s opening question. Not new info — a verdict.'},
    {t:'.'},
  ]},
];

const SECTIONS = [
  {id:'p12', label:'¶1-2', range:[1,2], func:'Phenomenon', funcZh:'现象',
   aiCorrect:'Right — these phrases set up TWO opposing ideals + the named issue ("shallow beauty ideals"). That tension is the **phenomenon** the rest of the text investigates.',
   aiPartial:'Look for the **conflict-makers** — the two opposing ideals + the question that pivots between them.'},
  {id:'p34', label:'¶3-4', range:[3,4], func:'History', funcZh:'历史',
   aiCorrect:'Exactly — all TIME signals: "change over time", "different periods of history", "ancient Egypt", "the 1600s", "Elizabethan England". Time words → History.',
   aiPartial:'You\'re mixing time markers with descriptive details. Which words specifically point to a *time period*?'},
  {id:'p57', label:'¶5-7', range:[5,6,7], func:'Culture', funcZh:'文化',
   aiCorrect:'Yes — all PLACE / CULTURE signals: "different cultures around the world", "Borneo", "New Zealand", "Myanmar", "Indonesia", "cultural identity". Multiple places = Culture.',
   aiPartial:'You picked some practices. Those are *examples*, not signals. What word repeats at the start of each paragraph?'},
  {id:'p8', label:'¶8', range:[8], func:'Conclusion', funcZh:'结论',
   aiCorrect:'Perfect — a summary phrase ("appears that"), a list pulling earlier examples together ("whether… or…"), and a final claim. No new evidence — just a verdict.',
   aiPartial:'A conclusion has three moves: summary phrase, refer back to earlier examples, final claim. Find each one.'},
];

const FUNC_OPTIONS = ['Phenomenon','History','Culture','Conclusion'];

/* ── TWEAK DEFAULTS ─────────────────────────────────────── */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dimNonFocus": true,
  "showTranslate": false,
  "scaffoldHint": true
}/*EDITMODE-END*/;

/* ── STYLES ─────────────────────────────────────────────── */
const ST = {
  shell: {flex:1, display:'flex', minHeight:0, height:'100%'},
  topBar: {display:'flex',alignItems:'center',gap:12,padding:'0 20px',height:46,background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  topEyebrow: {fontSize:10,fontWeight:600,color:'var(--teal)',textTransform:'uppercase',letterSpacing:'.8px'},
  topTitle: {fontSize:14,fontWeight:700,color:'var(--t1)'},
  topSub: {fontSize:11,color:'var(--t3)',flex:1},
  topPill: {fontSize:10,padding:'3px 8px',background:'var(--surface2)',borderRadius:3,color:'var(--t2)',fontWeight:500},

  leftCol: {width:'42%',minWidth:380,overflowY:'auto',padding:'24px 28px 80px',display:'flex',flexDirection:'column',gap:0},
  rightCol: {flex:1,borderLeft:'1px solid var(--border)',background:'var(--surface)',display:'flex',flexDirection:'column',minWidth:0},

  secStrip: {display:'flex',gap:6,marginBottom:16,padding:'4px',background:'var(--surface2)',borderRadius:8},
  secStripBtn: {flex:1,padding:'8px 4px',borderRadius:6,border:'none',background:'transparent',fontSize:11,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:'var(--t2)',transition:'all .15s',display:'flex',flexDirection:'column',alignItems:'center',gap:2},
  secStripBtnActive: {background:'var(--surface)',color:'var(--t1)',fontWeight:600,boxShadow:'0 1px 2px rgba(0,0,0,.05)'},
  secStripDone: {color:'var(--green)'},
  secStripFunc: {fontSize:9,color:'var(--t3)',fontWeight:500},

  card: {marginBottom:16},
  taskQ: {fontSize:18,fontWeight:700,letterSpacing:'-.2px',lineHeight:1.4,color:'var(--t1)',marginBottom:4},
  taskRange: {display:'inline-flex',alignItems:'center',gap:6,fontSize:11,fontWeight:600,color:'var(--teal)',background:'var(--teal-bg)',padding:'3px 8px',borderRadius:3,marginBottom:10},
  taskHelp: {fontSize:12,color:'var(--t2)',lineHeight:1.6,marginBottom:14},
  taskHelpZh: {fontSize:11,color:'var(--t3)',fontStyle:'italic',marginTop:3},

  stepLabel: {fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.6px',color:'var(--t3)',marginBottom:8,display:'flex',alignItems:'center',gap:6},
  stepNum: {width:16,height:16,borderRadius:'50%',background:'var(--t1)',color:'var(--surface)',fontSize:9,display:'inline-flex',alignItems:'center',justifyContent:'center',fontWeight:700},
  stepNumDone: {background:'var(--green)'},
  funcRow: {display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:18},
  funcBtn: {padding:'10px 8px',borderRadius:8,border:'1.5px solid var(--border)',background:'var(--surface)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:'var(--t2)',textAlign:'center',transition:'all .12s'},
  funcBtnSel: {borderColor:'var(--teal)',background:'var(--teal-bg)',color:'var(--teal)',fontWeight:600},
  funcBtnLocked: {borderColor:'var(--green)',background:'var(--green-bg)',color:'var(--green)',fontWeight:600,cursor:'default'},
  funcBtnWrong: {borderColor:'var(--red)',background:'var(--red-bg)',color:'var(--red)'},
  funcBtnDim: {opacity:.4,cursor:'default'},

  evCallout: {padding:'14px 16px',background:'var(--bg)',border:'1px dashed rgba(28,28,26,.14)',borderRadius:10,marginBottom:12,display:'flex',gap:10,alignItems:'flex-start'},
  evArrow: {fontSize:18,color:'var(--teal)',flexShrink:0,marginTop:1},
  evCalloutText: {fontSize:13,lineHeight:1.6,color:'var(--t2)'},
  evCount: {fontSize:11,color:'var(--t3)',marginTop:6},

  actionRow: {display:'flex',gap:10,alignItems:'center',marginTop:8},
  btn: {padding:'10px 16px',borderRadius:8,border:'none',background:'var(--t1)',color:'var(--surface)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'},
  btnOff: {opacity:.35,cursor:'default'},
  btnGhost: {padding:'9px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--t2)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'},

  hintToggle: {fontSize:11,color:'var(--t3)',cursor:'pointer',padding:'4px 8px',borderRadius:4,background:'transparent',border:'1px solid var(--border)',fontFamily:'inherit',alignSelf:'flex-start'},
  hintBox: {padding:'10px 14px',background:'var(--amber-bg)',border:'1px solid rgba(122,77,14,.15)',borderRadius:8,fontSize:12,color:'var(--amber)',lineHeight:1.6,marginTop:8},

  /* AI feedback now multi-block: opener + per-mistake notes */
  aiBox: {padding:'14px 16px',background:'var(--purple-bg)',borderRadius:10,border:'1px solid rgba(58,49,133,.12)',marginTop:14},
  aiHead: {display:'flex',gap:10,alignItems:'flex-start',marginBottom:8},
  aiDot: {width:7,height:7,borderRadius:'50%',background:'var(--purple)',flexShrink:0,marginTop:6},
  aiOpener: {fontSize:12,lineHeight:1.7,color:'var(--purple)',fontWeight:500},
  aiNote: {fontSize:12,lineHeight:1.65,color:'var(--purple)',padding:'8px 0 8px 16px',borderLeft:'2px solid rgba(58,49,133,.25)',marginBottom:6,marginLeft:2},
  aiNoteQuote: {fontWeight:600,color:'var(--t1)'},

  whyList: {marginTop:10,padding:'10px 14px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'},
  whyHeader: {fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px',color:'var(--t3)',marginBottom:6},
  whyItem: {fontSize:12,lineHeight:1.6,padding:'5px 0',display:'flex',gap:8,color:'var(--t2)',borderBottom:'1px dashed var(--border)'},
  whyDot: {flexShrink:0,fontSize:11,marginTop:1,fontWeight:700},
  tally: {fontSize:11,color:'var(--t3)',flex:1},
  tallyOk: {color:'var(--green)',fontWeight:600},

  textHead: {display:'flex',alignItems:'center',gap:8,padding:'14px 18px',borderBottom:'1px solid var(--border)',flexShrink:0},
  textTitle: {fontSize:13,fontWeight:600,color:'var(--t1)',flex:1,display:'flex',alignItems:'center',gap:8},
  textBadge: {fontSize:10,padding:'2px 8px',borderRadius:3,background:'var(--teal-bg)',color:'var(--teal)',fontWeight:600},
  textMode: {fontSize:10,padding:'3px 8px',borderRadius:3,background:'#fef6c8',color:'#7a4d0e',fontWeight:600,display:'flex',alignItems:'center',gap:5},
  textBody: {flex:1,overflowY:'auto',padding:'10px 22px 60px'},
  para: {padding:'12px 14px',marginBottom:6,fontSize:14,lineHeight:1.95,color:'var(--t1)',borderRadius:10,transition:'all .25s ease',position:'relative'},
  paraDim: {opacity:.18,filter:'grayscale(.4)'},
  paraFocus: {background:'var(--bg)',boxShadow:'0 0 0 2px var(--teal)',padding:'14px 16px'},
  paraDone: {background:'rgba(45,102,18,.04)',boxShadow:'0 0 0 1px rgba(45,102,18,.15)'},
  pNum: {fontSize:10,fontWeight:700,color:'var(--teal)',background:'var(--teal-bg)',padding:'2px 6px',borderRadius:3,marginRight:8,verticalAlign:'middle'},
  pNumDone: {background:'var(--green-bg)',color:'var(--green)'},

  /* Token / span styles — phrase-level pickers */
  tPlain: {color:'inherit'},
  tIdle: {cursor:'pointer',padding:'2px 1px',margin:'0 -1px',borderRadius:3,borderBottom:'1px dotted rgba(28,28,26,.18)',transition:'all .12s'},
  tPicked: {background:'#fef6c8',color:'var(--t1)',padding:'3px 5px',margin:'0 -2px',borderRadius:3,boxShadow:'inset 0 -8px 0 #fce98a',fontWeight:500,cursor:'pointer'},
  tGood: {background:'var(--green-bg)',color:'var(--green)',padding:'3px 5px',margin:'0 -2px',borderRadius:3,fontWeight:600},
  tBad: {background:'var(--red-bg)',color:'var(--red)',padding:'3px 5px',margin:'0 -2px',borderRadius:3,textDecoration:'line-through',textDecorationColor:'rgba(148,41,41,.4)'},
  tMissed: {background:'rgba(45,102,18,.07)',padding:'3px 5px',margin:'0 -2px',borderRadius:3,borderBottom:'1px dashed var(--green)',color:'var(--t2)'},
};

function md(t) {
  if(!t) return null;
  const out = []; let rest = t; let key = 0;
  while(rest.includes('**')) {
    const a = rest.indexOf('**'); const b = rest.indexOf('**', a+2);
    if(b===-1) break;
    if(a>0) out.push(rest.slice(0,a));
    out.push(<strong key={'b'+(key++)}>{rest.slice(a+2,b)}</strong>);
    rest = rest.slice(b+2);
  }
  if(rest) out.push(rest);
  return out;
}

/* Helper: is a token clickable? */
const isClickable = (tk) => tk.kind === 'evidence' || tk.kind === 'pick' || tk.kind === 'distractor';

/* Helper: build AI contextual feedback */
function buildAiFeedback(section, paras, picked) {
  /* gather wrong picks (clicked distractors / picks) and missed evidence */
  const wrongPicks = [];
  const missed = [];
  let hit = 0;
  paras.forEach(p => {
    p.tokens.forEach((tk, i) => {
      const key = p.n + ':' + i;
      const isP = picked.has(key);
      if(tk.kind === 'evidence') {
        if(isP) hit++;
        else missed.push({phrase: tk.t, why: tk.why, p: p.n});
      } else if(isP && (tk.kind === 'distractor' || tk.kind === 'pick')) {
        wrongPicks.push({
          phrase: tk.t,
          why: tk.wrongWhy || 'Not a structural signal — content/example.',
          p: p.n,
        });
      }
    });
  });
  const totalEv = paras.reduce((s,p) => s + p.tokens.filter(t => t.kind === 'evidence').length, 0);
  const perfect = hit === totalEv && wrongPicks.length === 0;
  return {wrongPicks, missed, hit, totalEv, perfect};
}

/* ── APP ──────────────────────────────────────────────── */
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [secStates, setSecStates] = useState(() => {
    const init = {};
    SECTIONS.forEach(s => {
      init[s.id] = {
        stage: 'pick', /* pick → evidence → graded */
        funcChoice: null,
        funcWrong: false,
        picked: new Set(),
        showHint: false,
      };
    });
    return init;
  });

  const [currentId, setCurrentId] = useState('p12');
  const current = SECTIONS.find(s => s.id === currentId);
  const state = secStates[currentId];

  const updateState = (id, partial) => {
    setSecStates(prev => ({...prev, [id]: {...prev[id], ...partial}}));
  };

  const textBodyRef = useRef(null);
  const paraRefs = useRef({});

  useEffect(() => {
    if(state.stage === 'evidence' || state.stage === 'graded') {
      const firstP = current.range[0];
      const el = paraRefs.current[firstP];
      const body = textBodyRef.current;
      if(el && body) {
        const top = el.offsetTop - body.offsetTop - 16;
        body.scrollTo({top, behavior:'smooth'});
      }
    }
  }, [state.stage, currentId]);

  const lockFunc = () => {
    if(!state.funcChoice) return;
    if(state.funcChoice === current.func) {
      updateState(currentId, {stage:'evidence', funcWrong:false});
    } else {
      updateState(currentId, {funcWrong:true});
    }
  };

  const togglePick = (pn, i, tk) => {
    if(state.stage === 'graded') return;
    if(!isClickable(tk)) return;
    const key = pn + ':' + i;
    const ns = new Set(state.picked);
    if(ns.has(key)) ns.delete(key); else ns.add(key);
    updateState(currentId, {picked: ns});
  };

  const grade = () => updateState(currentId, {stage:'graded'});
  const retry = () => updateState(currentId, {stage:'evidence', picked:new Set(), showHint:false});

  const sectionParas = useMemo(() =>
    PARAGRAPHS.filter(p => p.sectionId === current.id),
    [current.id]
  );

  const feedback = useMemo(() => {
    if(state.stage !== 'graded') return null;
    return buildAiFeedback(current, sectionParas, state.picked);
  }, [state, current, sectionParas]);

  /* Why list — only show evidence items + wrong picks */
  const whyItems = useMemo(() => {
    if(state.stage !== 'graded') return [];
    const out = [];
    sectionParas.forEach(p => {
      p.tokens.forEach((tk, i) => {
        const key = p.n + ':' + i;
        const isPicked = state.picked.has(key);
        if(tk.kind === 'evidence') {
          out.push({good:true, picked:isPicked, text:'"'+tk.t+'"', why: tk.why});
        } else if(isPicked && (tk.kind === 'distractor' || tk.kind === 'pick')) {
          out.push({good:false, picked:true, text:'"'+tk.t+'"', why: tk.wrongWhy || 'Not a structural signal.'});
        }
      });
    });
    return out;
  }, [state, sectionParas]);

  const sectionStatus = (id) => {
    const s = secStates[id];
    if(s.stage === 'graded') return 'done';
    if(s.stage === 'evidence') return 'active';
    return 'pending';
  };

  return (
    <>
      <div style={ST.topBar}>
        <span style={ST.topEyebrow}>Skim · Practice 2</span>
        <span style={ST.topTitle}>Select Evidence</span>
        <span style={ST.topSub}>Match each section to its function — then prove it from the text.</span>
        <span style={ST.topPill}>⏱ 6 min</span>
      </div>

      <div style={ST.shell}>
        {/* LEFT */}
        <div style={ST.leftCol}>
          <div style={ST.secStrip}>
            {SECTIONS.map(s => {
              const status = sectionStatus(s.id);
              const isCurrent = s.id === currentId;
              let style = {...ST.secStripBtn};
              if(isCurrent) style = {...style, ...ST.secStripBtnActive};
              if(status === 'done') style = {...style, ...ST.secStripDone};
              return (
                <button key={s.id} style={style} onClick={()=>setCurrentId(s.id)}>
                  <span>{s.label}{status === 'done' && ' ✓'}</span>
                  <span style={{...ST.secStripFunc, ...(status==='done' ? {color:'var(--green)'} : {})}}>
                    {status === 'done' ? s.func : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={ST.card}>
            <span style={ST.taskRange}>Section · {current.label}</span>
            <div style={ST.taskQ}>What is this section's function?</div>
            <div style={ST.taskHelp}>
              First pick the function. Then <strong>locate the why</strong> by clicking the <strong>signal phrases</strong> in the text on the right.
              {tweaks.showTranslate && <div style={ST.taskHelpZh}>先选功能，再点击右侧课文里的"信号短语"——只有结构性短语可以被选，整句不能选。</div>}
            </div>
          </div>

          {/* STEP 1 */}
          <div style={ST.stepLabel}>
            <span style={{...ST.stepNum, ...(state.stage !== 'pick' ? ST.stepNumDone : {})}}>1</span>
            <span>Pick the function</span>
          </div>
          <div style={ST.funcRow}>
            {FUNC_OPTIONS.map(f => {
              const sel = state.funcChoice === f;
              const locked = state.stage !== 'pick';
              const isLockedRight = locked && f === current.func;
              const isWrongPick = state.funcWrong && sel && f !== current.func;
              let style = {...ST.funcBtn};
              if(isLockedRight) style = {...style, ...ST.funcBtnLocked};
              else if(locked) style = {...style, ...ST.funcBtnDim};
              else if(isWrongPick) style = {...style, ...ST.funcBtnWrong};
              else if(sel) style = {...style, ...ST.funcBtnSel};
              return (
                <button key={f} style={style} disabled={locked}
                  onClick={()=>!locked && updateState(currentId, {funcChoice:f, funcWrong:false})}>
                  {f}
                </button>
              );
            })}
          </div>

          {state.stage === 'pick' && (
            <div style={ST.actionRow}>
              <span style={ST.tally}>
                {state.funcWrong
                  ? <span style={{color:'var(--red)'}}>Not quite — look at the signal words on the right.</span>
                  : 'Pick one, then confirm.'}
              </span>
              <button style={{...ST.btn, ...(!state.funcChoice ? ST.btnOff : {})}}
                disabled={!state.funcChoice} onClick={lockFunc}>Confirm →</button>
            </div>
          )}

          {/* STEP 2 */}
          {state.stage !== 'pick' && (
            <>
              <div style={{...ST.stepLabel, marginTop:24}}>
                <span style={{...ST.stepNum, ...(state.stage === 'graded' ? ST.stepNumDone : {})}}>2</span>
                <span>Locate the why</span>
              </div>

              {state.stage === 'evidence' && (
                <>
                  <div style={ST.evCallout}>
                    <span style={ST.evArrow}>→</span>
                    <div style={ST.evCalloutText}>
                      In the text on the right, click the <strong>phrases</strong> (underlined with dots) that prove this is <strong style={{color:'var(--teal)'}}>{current.func}</strong>.
                      <div style={ST.evCount}>
                        {state.picked.size === 0
                          ? 'Only structural signal phrases are clickable — connector words aren\'t.'
                          : `${state.picked.size} phrase${state.picked.size>1?'s':''} highlighted.`}
                      </div>
                    </div>
                  </div>

                  {tweaks.scaffoldHint && (
                    <button style={ST.hintToggle}
                      onClick={()=>updateState(currentId, {showHint: !state.showHint})}>
                      {state.showHint ? '▾' : '▸'} {state.showHint ? 'Hide hint' : 'Stuck? Show hint'}
                    </button>
                  )}
                  {state.showHint && tweaks.scaffoldHint && (
                    <div style={ST.hintBox}>
                      {hintFor(current.id)}
                      {tweaks.showTranslate && <div style={{color:'var(--t3)',fontStyle:'italic',marginTop:4}}>{hintForZh(current.id)}</div>}
                    </div>
                  )}

                  <div style={{...ST.actionRow, marginTop:14}}>
                    <span style={ST.tally}>
                      {state.picked.size === 0
                        ? 'Click at least one phrase.'
                        : 'Ready when you are.'}
                    </span>
                    <button style={{...ST.btn, ...(state.picked.size === 0 ? ST.btnOff : {})}}
                      disabled={state.picked.size === 0} onClick={grade}>Check evidence</button>
                  </div>
                </>
              )}

              {state.stage === 'graded' && feedback && (
                <>
                  {/* AI contextual feedback */}
                  <div style={ST.aiBox}>
                    <div style={ST.aiHead}>
                      <span style={ST.aiDot}></span>
                      <div style={ST.aiOpener}>
                        {feedback.perfect
                          ? md(current.aiCorrect)
                          : feedback.wrongPicks.length > 0
                            ? <>You found <strong>{feedback.hit} of {feedback.totalEv}</strong> signals — but a few of your picks aren\'t signals. Let me explain:</>
                            : <>You found <strong>{feedback.hit} of {feedback.totalEv}</strong> signals. {feedback.missed.length > 0 ? 'A few are still missing — check the dashed-underline phrases.' : ''}</>}
                      </div>
                    </div>

                    {/* Per-mistake explanation */}
                    {!feedback.perfect && feedback.wrongPicks.map((w, i) => (
                      <div key={i} style={ST.aiNote}>
                        <span style={ST.aiNoteQuote}>"{w.phrase}"</span> <span style={{color:'var(--t3)'}}>(¶{w.p})</span> — {w.why}
                      </div>
                    ))}

                    {/* Missed nudge */}
                    {!feedback.perfect && feedback.wrongPicks.length === 0 && feedback.missed.length > 0 && (
                      <div style={{...ST.aiNote, borderLeftColor:'rgba(45,102,18,.3)'}}>
                        Look for: <span style={ST.aiNoteQuote}>"{feedback.missed[0].phrase}"</span> in ¶{feedback.missed[0].p} — {feedback.missed[0].why}
                      </div>
                    )}
                  </div>

                  <div style={ST.whyList}>
                    <div style={ST.whyHeader}>All signals in this section</div>
                    {whyItems.map((it, i) => (
                      <div key={i} style={{...ST.whyItem, ...(i === whyItems.length-1 ? {borderBottom:'none'} : {})}}>
                        <span style={{...ST.whyDot, color: it.good ? 'var(--green)' : 'var(--red)'}}>
                          {it.good ? (it.picked ? '✓' : '+') : '✗'}
                        </span>
                        <div>
                          <span style={{fontWeight:600, color: it.good ? 'var(--t1)' : 'var(--t3)'}}>{it.text}</span>
                          <span style={{color:'var(--t2)'}}> — {it.why}</span>
                          {!it.picked && it.good && <span style={{color:'var(--t3)', marginLeft:6, fontStyle:'italic'}}>(missed)</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{...ST.actionRow, marginTop:12}}>
                    <span style={{...ST.tally, ...(feedback.perfect ? ST.tallyOk : {})}}>
                      {feedback.perfect
                        ? `Perfect — ${feedback.hit}/${feedback.totalEv} signals.`
                        : `${feedback.hit}/${feedback.totalEv} signals · ${feedback.wrongPicks.length} non-signals picked.`}
                    </span>
                    {!feedback.perfect && (
                      <button style={ST.btnGhost} onClick={retry}>Try again</button>
                    )}
                    {feedback.perfect && (() => {
                      const nextSec = SECTIONS.find(s => secStates[s.id].stage !== 'graded');
                      return nextSec
                        ? <button style={ST.btn} onClick={()=>setCurrentId(nextSec.id)}>Next section →</button>
                        : <span style={{color:'var(--green)',fontWeight:600,fontSize:12}}>All 4 done ✓</span>;
                    })()}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* RIGHT: TEXTBOOK */}
        <div style={ST.rightCol}>
          <div style={ST.textHead}>
            <div style={ST.textTitle}>
              <span style={ST.textBadge}>Text</span>
              Ideal Beauty
            </div>
            {state.stage === 'evidence' && (
              <span style={ST.textMode}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#caa514'}}></span>
                Click signal phrases · {current.label}
              </span>
            )}
          </div>

          <div ref={textBodyRef} style={ST.textBody}>
            {PARAGRAPHS.map(p => {
              const isFocus = current.range.includes(p.n);
              const isSectionDone = secStates[p.sectionId].stage === 'graded';
              const dim = tweaks.dimNonFocus && state.stage !== 'pick' && !isFocus;
              const focusActive = state.stage === 'evidence' && isFocus;
              const focusGraded = state.stage === 'graded' && isFocus;

              let pStyle = {...ST.para};
              if(dim) pStyle = {...pStyle, ...ST.paraDim};
              if(focusActive) pStyle = {...pStyle, ...ST.paraFocus};
              else if(focusGraded) pStyle = {...pStyle, ...ST.paraDone};
              else if(isSectionDone && !isFocus) pStyle = {...pStyle, ...ST.paraDone};

              return (
                <div key={p.n} ref={el => paraRefs.current[p.n] = el} style={pStyle}>
                  <span style={{...ST.pNum, ...(isSectionDone ? ST.pNumDone : {})}}>¶{p.n}</span>
                  {p.tokens.map((tk, i) => {
                    const key = p.n + ':' + i;
                    const clickable = isClickable(tk);
                    const isPicked = state.picked.has(key);
                    const isGood = tk.kind === 'evidence';

                    /* Plain non-clickable token */
                    if(!clickable) {
                      return <span key={i} style={ST.tPlain}>{tk.t}</span>;
                    }

                    /* Render style based on stage */
                    let style;
                    if(focusGraded) {
                      if(isPicked && isGood) style = ST.tGood;
                      else if(isPicked && !isGood) style = ST.tBad;
                      else if(!isPicked && isGood) style = ST.tMissed;
                      else style = ST.tIdle;
                    } else if(focusActive) {
                      style = isPicked ? ST.tPicked : ST.tIdle;
                    } else if(isSectionDone && !isFocus) {
                      const priorPicked = secStates[p.sectionId].picked.has(key);
                      style = priorPicked && isGood
                        ? {...ST.tGood, opacity:.6}
                        : ST.tPlain;
                    } else {
                      style = ST.tPlain;
                    }

                    return (
                      <span key={i} style={style}
                        onClick={focusActive ? ()=>togglePick(p.n, i, tk) : undefined}>
                        {tk.t}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Layout">
          <TweakToggle value={tweaks.dimNonFocus} onChange={(v)=>setTweak('dimNonFocus', v)}
            label="Dim non-focus paragraphs" />
        </TweakSection>
        <TweakSection title="Scaffolding">
          <TweakToggle value={tweaks.scaffoldHint} onChange={(v)=>setTweak('scaffoldHint', v)}
            label="Show hint button" />
        </TweakSection>
        <TweakSection title="Language">
          <TweakToggle value={tweaks.showTranslate} onChange={(v)=>setTweak('showTranslate', v)}
            label="Show 中文 prompts" />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function hintFor(id) {
  switch(id) {
    case 'p12': return 'Look for the two opposing IDEALS ("fat = wealth" vs "slim and fair"), the PIVOT question, and the named ISSUE ("shallow beauty ideals").';
    case 'p34': return 'Look for TIME signals — phrases pointing to a time period: "change over time", "ancient Egypt", "the 1600s", "Elizabethan England".';
    case 'p57': return 'Look for PLACE signals — country / culture names: "Borneo", "New Zealand", "Myanmar", "Indonesia", plus "different cultures around the world".';
    case 'p8': return 'Three moves: SUMMARY phrase ("appears that"), list pulling earlier examples together ("whether… or…"), and final CLAIM ("cultural values, not just vanity").';
    default: return '';
  }
}
function hintForZh(id) {
  switch(id) {
    case 'p12': return '找两个对立的"美的标准" + 转折问句 + 被命名的问题（"shallow beauty ideals"）。';
    case 'p34': return '找时间信号——指向时间段的短语，包括古代地名（如 "ancient Egypt"）。';
    case 'p57': return '找地点/文化信号——国家名称。';
    case 'p8': return '总结词 + 把前面例子收拢的列表 + 最终判断。';
    default: return '';
  }
}
