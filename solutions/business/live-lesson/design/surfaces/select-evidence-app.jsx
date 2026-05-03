/* ============================================================
   Select Evidence — Skim Task / Practice Part 2
   Goal: students don't just choose — they LOCATE THE WHY.
   Three interaction variants exposed via Tweaks.
   ============================================================ */

const {useState, useMemo, useEffect, useRef, Fragment} = React;

/* ── DATA ─────────────────────────────────────────────────── */

/* The 4 sections + their function (the "match" target) */
const SECTIONS = [
  {
    id: 'p12',  label: '¶1-2', range: [1,2],
    func: 'Phenomenon',
    funcZh: '现象 / 冲突',
    /* paragraph text broken into clickable spans (sentence chunks) */
    spans: [
      {p:1, t:'In many parts of Nigeria, it is traditional for women to go to special "fattening rooms" before they get married.'},
      {p:1, t:'Happiness Edem was one such young woman, and she went from 60 kg to twice that weight because, in her culture, being fat is a sign of wealth.'},
      {p:2, t:'But what about the rest of the world?', kind:'evidence', why:'A pivot question that opens the conflict — "rest of the world" sets up the contrast.'},
      {p:2, t:'Open any fashion magazine and you will see young models — women who are slim and fair.'},
      {p:2, t:'Many people are worried that modern media promotes shallow beauty ideals.', kind:'evidence', why:'Names the issue — modern media\'s "shallow beauty ideals" is the conflict the whole text questions.'},
    ],
    /* evidence chips for variant B (selected = student thinks supports the function) */
    chips: [
      {t:'fattening rooms', good:true, why:'A specific cultural practice — sets up one side of the conflict.'},
      {t:'fat is a sign of wealth', good:true, why:'One beauty ideal stated as fact.'},
      {t:'slim and fair', good:true, why:'The opposing beauty ideal — the conflict surfaces here.'},
      {t:'shallow beauty ideals', good:true, why:'The phrase that frames the whole article\'s question.'},
      {t:'before they get married', good:false, why:'Detail, not a structural signal.'},
      {t:'fashion magazine', good:false, why:'Just an example — not the structural cue.'},
    ],
    aiCorrect: 'Right — these phrases set up TWO opposing ideas of beauty. That tension is the **phenomenon** the rest of the text investigates.',
    aiPartial: 'You\'re close, but check: which phrases name the *conflict itself*, not just describe one side?',
  },
  {
    id: 'p34', label: '¶3-4', range: [3,4],
    func: 'History',
    funcZh: '历史 / 跨时间',
    spans: [
      {p:3, t:'Ideas about physical beauty change over time', kind:'evidence', why:'"change over time" — pure TIME signal. This is the topic sentence of the History section.'},
      {p:3, t:'and different periods of history have had their own idea of what is beautiful.', kind:'evidence', why:'"different periods of history" — second TIME signal, locks in the History reading.'},
      {p:3, t:'In ancient Egypt, both men and women used to paint dark kohl around their eyes.'},
      {p:4, t:'In the 1600s in Europe, being plump and pale-skinned was considered stunning beauty.', kind:'evidence', why:'"In the 1600s" — another TIME marker. Confirms the History pattern.'},
      {p:4, t:'Rubens painted many women with round, soft bodies.'},
      {p:4, t:'In Elizabethan England, pale skin was a sign of wealth.', kind:'evidence', why:'"Elizabethan England" — historical era, time-anchored.'},
    ],
    chips: [
      {t:'change over time', good:true, why:'Pure TIME signal — this is the give-away word for History.'},
      {t:'different periods of history', good:true, why:'TIME signal repeated — author is being explicit.'},
      {t:'In the 1600s', good:true, why:'A specific historical period — anchors the example to a time.'},
      {t:'Elizabethan England', good:true, why:'Historical era — confirms the time pattern.'},
      {t:'ancient Egypt', good:false, why:'A place AND a time — could be confusing. The structural cue is "change over time", not the place name.'},
      {t:'pale-skinned', good:false, why:'A descriptive detail, not a structural signal.'},
    ],
    aiCorrect: 'Exactly — these are all **TIME signals**. When you see "change over time", "in the 1600s", "Elizabethan England" → this is a History section.',
    aiPartial: 'Look again — you\'re mixing time markers with descriptive details. Which words specifically point to a *time period*?',
  },
  {
    id: 'p57', label: '¶5-7', range: [5,6,7],
    func: 'Culture',
    funcZh: '文化 / 跨地域',
    spans: [
      {p:5, t:'Within different cultures around the world,', kind:'evidence', why:'"different cultures around the world" — explicit PLACE signal. Topic sentence of the Culture section.'},
      {p:5, t:'we can find diverse ideas about physical beauty.'},
      {p:5, t:'In Borneo, many people have tattoos.'},
      {p:6, t:'In New Zealand, the Maori people have their own tradition — a form of tattooing called tā moko.', kind:'evidence', why:'"In New Zealand" — another place. The pattern is locations, not eras.'},
      {p:7, t:'European visitors to Myanmar were amazed to see women wearing metal rings around their necks.', kind:'evidence', why:'"Myanmar" — another place. Three different countries in three paragraphs = Culture pattern.'},
      {p:7, t:'And in Indonesia, some people practised sharpening their teeth, as it was considered a form of cultural identity.', kind:'evidence', why:'"Indonesia" + "cultural identity" — both place and explicit "culture" wording.'},
    ],
    chips: [
      {t:'different cultures around the world', good:true, why:'Explicit PLACE signal + the word "cultures" itself.'},
      {t:'In Borneo', good:true, why:'A place — pattern starts.'},
      {t:'In New Zealand', good:true, why:'Another place — pattern continues.'},
      {t:'Myanmar', good:true, why:'Another place — three places in a row = Culture.'},
      {t:'cultural identity', good:true, why:'The word "cultural" is a direct match to the function name.'},
      {t:'tattoos', good:false, why:'A practice, not a structural signal.'},
      {t:'metal rings around their necks', good:false, why:'Detail, not signal. Strip the example, keep the cue.'},
    ],
    aiCorrect: 'Yes — all PLACE signals. "Different cultures around the world", "In Borneo", "In New Zealand", "Myanmar" → multiple places = Culture section.',
    aiPartial: 'You picked some specific practices. Those are *examples*, not signals. What word repeats at the start of each paragraph that tells you "we\'re moving across places"?',
  },
  {
    id: 'p8', label: '¶8', range: [8],
    func: 'Conclusion',
    funcZh: '结论 / 总结',
    spans: [
      {p:8, t:'It appears that', kind:'evidence', why:'"It appears that" — classic SUMMARY signal. Conclusions wrap up.'},
      {p:8, t:'people change their appearance to tell the world about their culture and status.'},
      {p:8, t:'Whether kohl, tattoos, or metal rings,', kind:'evidence', why:'"Whether… or…" — pulling all earlier examples together. Only conclusions do this.'},
      {p:8, t:'these practices reflect cultural values, not just vanity.', kind:'evidence', why:'Final claim that answers the opening question. No new examples — just a verdict.'},
    ],
    chips: [
      {t:'It appears that', good:true, why:'Classic conclusion-marker. Common in argumentative writing.'},
      {t:'Whether kohl, tattoos, or metal rings', good:true, why:'Pulls the earlier examples together — a hallmark of conclusions.'},
      {t:'reflect cultural values, not just vanity', good:true, why:'A FINAL claim, not a new example.'},
      {t:'metal rings', good:false, why:'A reused example. The signal is the structure ("whether… or…"), not the example itself.'},
      {t:'people change their appearance', good:false, why:'A general statement, not a structural signal.'},
    ],
    aiCorrect: 'Perfect — these three are exactly the conclusion markers: a summary phrase, a list-of-earlier-examples, and a final claim. No new evidence, just a verdict.',
    aiPartial: 'Reread ¶8. A conclusion has three moves: (1) a summary phrase, (2) referring back to earlier examples, (3) a final claim. Which phrases do those things?',
  },
];

const FUNC_OPTIONS = ['Phenomenon','History','Culture','Conclusion'];

/* ── TWEAK DEFAULTS ─────────────────────────────────────── */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "variant": "highlight",
  "showTranslate": false,
  "section": "p34"
}/*EDITMODE-END*/;

/* ── STYLES ─────────────────────────────────────────────── */
const ST = {
  /* Function chooser */
  funcRow: {display:'flex',gap:8,marginBottom:14},
  funcBtn: {flex:1,padding:'10px 6px',borderRadius:8,border:'1.5px solid var(--border)',background:'var(--surface)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit',color:'var(--t2)',textAlign:'center',transition:'all .12s'},
  funcBtnSel: {borderColor:'var(--teal)',background:'var(--teal-bg)',color:'var(--teal)',fontWeight:600},
  funcBtnLocked: {borderColor:'var(--green)',background:'var(--green-bg)',color:'var(--green)',fontWeight:600,cursor:'default'},

  /* Section card */
  card: {background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'18px 22px',marginBottom:14},
  cardHead: {display:'flex',alignItems:'center',gap:10,marginBottom:14,paddingBottom:12,borderBottom:'1px solid var(--border)'},
  cardRange: {fontSize:14,fontWeight:700,color:'var(--t1)',padding:'2px 8px',background:'var(--surface2)',borderRadius:4},
  cardTitle: {fontSize:13,color:'var(--t2)',flex:1},
  cardStatus: {fontSize:11,color:'var(--t3)',fontWeight:500},

  /* Para text */
  paraBlock: {marginBottom:6,fontSize:13,lineHeight:1.95,color:'var(--t2)'},
  pNum: {fontSize:9,fontWeight:600,color:'var(--teal)',background:'var(--teal-bg)',padding:'2px 5px',borderRadius:3,marginRight:6,verticalAlign:'middle'},

  /* highlight-in-text spans */
  spanIdle: {cursor:'pointer',padding:'1px 0',borderBottom:'1px dashed transparent',transition:'all .12s'},
  spanHover: {background:'rgba(13,82,69,.05)',borderBottomColor:'var(--teal)'},
  spanPicked: {background:'#fef6c8',color:'var(--t1)',padding:'2px 4px',margin:'0 -1px',borderRadius:3,boxShadow:'inset 0 -8px 0 #fce98a',fontWeight:500,borderBottom:'1px solid transparent'},
  spanGood: {background:'var(--green-bg)',color:'var(--green)',padding:'2px 4px',margin:'0 -1px',borderRadius:3,fontWeight:600,borderBottom:'1px solid transparent'},
  spanBad: {background:'var(--red-bg)',color:'var(--red)',padding:'2px 4px',margin:'0 -1px',borderRadius:3,textDecoration:'line-through',textDecorationColor:'rgba(148,41,41,.4)',borderBottom:'1px solid transparent'},

  /* chip variant */
  chipsWrap: {display:'flex',flexWrap:'wrap',gap:6,marginTop:4},
  chip: {fontSize:12,padding:'6px 11px',borderRadius:18,border:'1.5px solid var(--border)',background:'var(--surface)',cursor:'pointer',fontFamily:'inherit',color:'var(--t2)',transition:'all .12s',display:'inline-flex',alignItems:'center',gap:6},
  chipSel: {borderColor:'#caa514',background:'#fef6c8',color:'#7a4d0e',fontWeight:600},
  chipGood: {borderColor:'var(--green)',background:'var(--green-bg)',color:'var(--green)',fontWeight:600},
  chipBad: {borderColor:'var(--red)',background:'var(--red-bg)',color:'var(--red)',textDecoration:'line-through',textDecorationColor:'rgba(148,41,41,.4)'},

  /* Why bubble (after grading) */
  whyList: {marginTop:12,padding:'10px 14px',background:'var(--bg)',borderRadius:8,border:'1px solid var(--border)'},
  whyHeader: {fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.5px',color:'var(--t3)',marginBottom:6},
  whyItem: {fontSize:12,lineHeight:1.6,padding:'4px 0',display:'flex',gap:8,color:'var(--t2)'},
  whyDot: {flexShrink:0,fontSize:11,marginTop:1},

  /* AI feedback */
  aiBox: {display:'flex',gap:10,padding:'12px 14px',background:'var(--purple-bg)',borderRadius:8,border:'1px solid rgba(58,49,133,.12)',marginTop:12},
  aiDot: {width:7,height:7,borderRadius:'50%',background:'var(--purple)',flexShrink:0,marginTop:6},
  aiText: {fontSize:12,lineHeight:1.7,color:'var(--purple)'},

  /* Action row */
  actionRow: {display:'flex',gap:10,marginTop:14,alignItems:'center'},
  btn: {padding:'10px 18px',borderRadius:8,border:'none',background:'var(--t1)',color:'var(--surface)',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'},
  btnOff: {opacity:.35,cursor:'default'},
  btnGhost: {padding:'10px 14px',borderRadius:8,border:'1px solid var(--border)',background:'var(--surface)',color:'var(--t2)',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'inherit'},
  hintText: {fontSize:11,color:'var(--t3)',flex:1},

  /* Prompt above text */
  prompt: {fontSize:12,color:'var(--t2)',marginBottom:10,padding:'8px 12px',background:'var(--bg)',borderLeft:'3px solid var(--teal)',borderRadius:'0 6px 6px 0',lineHeight:1.6},
  promptZh: {color:'var(--t3)',fontSize:11,marginTop:2,fontStyle:'italic'},

  /* Tally */
  tally: {fontSize:11,color:'var(--t3)',marginLeft:'auto'},
  tallyOk: {color:'var(--green)',fontWeight:600},
};

/* ── BOLD MARKDOWN-LITE ─────────────────────────────────── */
function md(t) {
  if(!t) return null;
  const out = [];
  let rest = t;
  let key = 0;
  while(rest.includes('**')) {
    const a = rest.indexOf('**');
    const b = rest.indexOf('**', a+2);
    if(b===-1) break;
    if(a>0) out.push(rest.slice(0,a));
    out.push(<strong key={'b'+(key++)}>{rest.slice(a+2,b)}</strong>);
    rest = rest.slice(b+2);
  }
  if(rest) out.push(rest);
  return out;
}

/* ── PHASE: function chooser ───────────────────────────── */
function FunctionChooser({section, funcChoice, setFuncChoice, locked, isWrong}) {
  return (
    <div style={ST.funcRow}>
      {FUNC_OPTIONS.map((f,i) => {
        const sel = funcChoice === f;
        const isCorrect = locked && f === section.func;
        const isPickedWrong = isWrong && sel && f !== section.func;
        let style = {...ST.funcBtn};
        if(locked && isCorrect) style = {...style, ...ST.funcBtnLocked};
        else if(isPickedWrong) style = {...style, borderColor:'var(--red)', background:'var(--red-bg)', color:'var(--red)'};
        else if(sel) style = {...style, ...ST.funcBtnSel};
        return (
          <button key={i} style={style} disabled={locked}
            onClick={()=>!locked && setFuncChoice(f)}>
            {f}
          </button>
        );
      })}
    </div>
  );
}

/* ── VARIANT A: HIGHLIGHT-IN-TEXT ──────────────────────── */
function VariantHighlight({section, picked, setPicked, graded, showTranslate, funcChoice}) {
  const groupedByPara = useMemo(() => {
    const g = {};
    section.spans.forEach((sp, i) => {
      if(!g[sp.p]) g[sp.p] = [];
      g[sp.p].push({...sp, idx: i});
    });
    return g;
  }, [section]);

  const togglePick = (idx) => {
    if(graded) return;
    const ns = new Set(picked);
    if(ns.has(idx)) ns.delete(idx); else ns.add(idx);
    setPicked(ns);
  };

  return (
    <>
      <div style={ST.prompt}>
        {funcChoice
          ? <>Now <strong>locate the why</strong>: highlight the words or phrases in the text that prove this section is <strong style={{color:'var(--teal)'}}>{funcChoice}</strong>.</>
          : <>First pick the function above. Then highlight the words that prove it.</>}
        {showTranslate && <div style={ST.promptZh}>先选功能，再在原文中划出能证明这是 {funcChoice||'…'} 的关键词句。</div>}
      </div>

      {Object.entries(groupedByPara).map(([pn, spans]) => (
        <div key={pn} style={ST.paraBlock}>
          <span style={ST.pNum}>¶{pn}</span>
          {spans.map((sp, i) => {
            const isPicked = picked.has(sp.idx);
            const isGood = sp.kind === 'evidence';
            let style = {...ST.spanIdle};
            if(graded) {
              if(isPicked && isGood) style = {...style, ...ST.spanGood};
              else if(isPicked && !isGood) style = {...style, ...ST.spanBad};
              else if(!isPicked && isGood) style = {...style, background:'rgba(45,102,18,.08)',padding:'2px 4px',margin:'0 -1px',borderRadius:3,borderBottom:'1px dashed var(--green)',color:'var(--t2)'};
            } else if(isPicked) {
              style = {...style, ...ST.spanPicked};
            }
            return (
              <span key={i}>
                <span style={style} onClick={()=>togglePick(sp.idx)}>{sp.t}</span>
                {' '}
              </span>
            );
          })}
        </div>
      ))}
    </>
  );
}

/* ── VARIANT B: EVIDENCE CHIPS ────────────────────────── */
function VariantChips({section, picked, setPicked, graded, showTranslate, funcChoice}) {
  const togglePick = (idx) => {
    if(graded) return;
    const ns = new Set(picked);
    if(ns.has(idx)) ns.delete(idx); else ns.add(idx);
    setPicked(ns);
  };

  return (
    <>
      <div style={ST.prompt}>
        {funcChoice
          ? <>From the phrases below, pick the ones that prove this section is <strong style={{color:'var(--teal)'}}>{funcChoice}</strong>. Aim for the <strong>structural signals</strong>, not examples.</>
          : <>First pick the function above. Then choose the evidence chips that prove it.</>}
        {showTranslate && <div style={ST.promptZh}>从下方短语中选出"信号词" — 能证明它是 {funcChoice||'…'} 的关键，不要选具体例子。</div>}
      </div>

      <div style={{...ST.paraBlock, marginBottom:14}}>
        {section.spans.map((sp, i) => (
          <Fragment key={i}>
            <span style={ST.pNum}>¶{sp.p}</span>
            <span style={{color:'var(--t2)'}}>{sp.t} </span>
          </Fragment>
        ))}
      </div>

      <div style={ST.chipsWrap}>
        {section.chips.map((c, i) => {
          const sel = picked.has(i);
          let style = {...ST.chip};
          if(graded) {
            if(sel && c.good) style = {...style, ...ST.chipGood};
            else if(sel && !c.good) style = {...style, ...ST.chipBad};
            else if(!sel && c.good) style = {...style, borderStyle:'dashed', borderColor:'var(--green)', color:'var(--green)'};
          } else if(sel) {
            style = {...style, ...ST.chipSel};
          }
          return (
            <button key={i} style={style} onClick={()=>togglePick(i)} disabled={graded}>
              {graded && sel && (c.good ? '✓ ' : '✗ ')}
              {graded && !sel && c.good && '+ '}
              "{c.t}"
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ── ONE SECTION CARD (handles all variants) ──────────── */
function SectionCard({section, variant, showTranslate, expanded, onExpand}) {
  const [funcChoice, setFuncChoice] = useState(null);
  const [funcLocked, setFuncLocked] = useState(false);
  const [funcWrong, setFuncWrong] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [graded, setGraded] = useState(false);

  /* When variant changes, reset for clean comparison */
  useEffect(() => {
    setFuncChoice(null); setFuncLocked(false); setFuncWrong(false);
    setPicked(new Set()); setGraded(false);
  }, [variant, section.id]);

  const lockFunc = () => {
    if(!funcChoice) return;
    if(funcChoice === section.func) {
      setFuncLocked(true); setFuncWrong(false);
    } else {
      setFuncWrong(true);
    }
  };

  const grade = () => {
    setGraded(true);
  };

  const reset = () => {
    setPicked(new Set()); setGraded(false);
  };

  /* Compute correctness summary */
  const summary = useMemo(() => {
    if(!graded) return null;
    if(variant === 'highlight') {
      const ev = section.spans.filter(s => s.kind === 'evidence').map((s, i) => section.spans.indexOf(s));
      let hit = 0, miss = 0, wrong = 0;
      ev.forEach(idx => { if(picked.has(idx)) hit++; else miss++; });
      picked.forEach(idx => { if(section.spans[idx].kind !== 'evidence') wrong++; });
      const total = ev.length;
      return {hit, miss, wrong, total, perfect: hit === total && wrong === 0, partial: hit > 0};
    }
    if(variant === 'chips') {
      const good = section.chips.map((c, i) => c.good ? i : -1).filter(i => i>=0);
      let hit = 0, miss = 0, wrong = 0;
      good.forEach(idx => { if(picked.has(idx)) hit++; else miss++; });
      picked.forEach(idx => { if(!section.chips[idx].good) wrong++; });
      return {hit, miss, wrong, total: good.length, perfect: hit === good.length && wrong === 0, partial: hit > 0};
    }
    return null;
  }, [graded, picked, variant, section]);

  /* Why-list for revealed reasoning */
  const whyItems = useMemo(() => {
    if(!graded) return [];
    if(variant === 'highlight') {
      return section.spans
        .map((s, i) => ({...s, idx: i}))
        .filter(s => s.kind === 'evidence' || (picked.has(s.idx) && s.kind !== 'evidence'))
        .map(s => ({
          good: s.kind === 'evidence',
          picked: picked.has(s.idx),
          text: '"' + (s.t.length > 60 ? s.t.slice(0, 56) + '…' : s.t) + '"',
          why: s.why || 'Not a structural signal — this is content/example.',
        }));
    }
    if(variant === 'chips') {
      return section.chips
        .map((c, i) => ({...c, i}))
        .filter(c => c.good || picked.has(c.i))
        .map(c => ({
          good: c.good,
          picked: picked.has(c.i),
          text: '"' + c.t + '"',
          why: c.why,
        }));
    }
    return [];
  }, [graded, picked, variant, section]);

  const canSubmit = funcLocked && picked.size > 0 && !graded;

  return (
    <div style={ST.card}>
      <div style={ST.cardHead}>
        <span style={ST.cardRange}>{section.label}</span>
        <span style={ST.cardTitle}>What is the <strong>function</strong> of this section?</span>
        {funcLocked && <span style={{...ST.cardStatus, color:'var(--green)'}}>✓ {section.func}</span>}
      </div>

      {/* Step 1: pick function */}
      <FunctionChooser section={section} funcChoice={funcChoice}
        setFuncChoice={(f)=>{setFuncChoice(f); setFuncWrong(false);}}
        locked={funcLocked} isWrong={funcWrong} />

      {!funcLocked && (
        <div style={ST.actionRow}>
          <span style={ST.hintText}>
            {funcWrong ? <span style={{color:'var(--red)'}}>Not quite. Try again — look at the signal words.</span>
              : 'Pick the function, then prove it.'}
          </span>
          <button style={{...ST.btn, ...(!funcChoice ? ST.btnOff : {})}}
            disabled={!funcChoice} onClick={lockFunc}>Confirm</button>
        </div>
      )}

      {/* Step 2: evidence (only after function is locked) */}
      {funcLocked && (
        <>
          <div style={{height:1, background:'var(--border)', margin:'16px -22px 14px'}} />
          {variant === 'highlight' && (
            <VariantHighlight section={section} picked={picked} setPicked={setPicked}
              graded={graded} showTranslate={showTranslate} funcChoice={funcChoice} />
          )}
          {variant === 'chips' && (
            <VariantChips section={section} picked={picked} setPicked={setPicked}
              graded={graded} showTranslate={showTranslate} funcChoice={funcChoice} />
          )}

          {/* Action row */}
          {!graded && (
            <div style={ST.actionRow}>
              <span style={ST.hintText}>
                {picked.size === 0 ? 'Select at least one piece of evidence.' :
                  `${picked.size} selected — ready to check?`}
              </span>
              <button style={{...ST.btn, ...(!canSubmit ? ST.btnOff : {})}}
                disabled={!canSubmit} onClick={grade}>Check evidence</button>
            </div>
          )}

          {/* Graded feedback */}
          {graded && summary && (
            <>
              <div style={ST.aiBox}>
                <span style={ST.aiDot}></span>
                <div style={ST.aiText}>
                  {md(summary.perfect ? section.aiCorrect : section.aiPartial)}
                </div>
              </div>

              <div style={ST.whyList}>
                <div style={ST.whyHeader}>Why these are the signals</div>
                {whyItems.map((it, i) => (
                  <div key={i} style={ST.whyItem}>
                    <span style={{...ST.whyDot, color: it.good ? 'var(--green)' : 'var(--red)'}}>
                      {it.good ? (it.picked ? '✓' : '+') : '✗'}
                    </span>
                    <div>
                      <span style={{fontWeight:600, color: it.good ? 'var(--t1)' : 'var(--t3)'}}>{it.text}</span>
                      <span style={{color:'var(--t2)'}}> — {it.why}</span>
                      {!it.picked && it.good && <span style={{color:'var(--t3)', marginLeft:6, fontStyle:'italic'}}>(you missed this one)</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div style={ST.actionRow}>
                <span style={{...ST.hintText, ...(summary.perfect ? ST.tallyOk : {})}}>
                  {summary.perfect
                    ? `Perfect — ${summary.hit}/${summary.total} signals found.`
                    : `${summary.hit}/${summary.total} signals · ${summary.wrong} non-signals.`}
                </span>
                <button style={ST.btnGhost} onClick={reset}>Retry evidence</button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── APP ──────────────────────────────────────────────── */
function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const filtered = tweaks.section === 'all'
    ? SECTIONS
    : SECTIONS.filter(s => s.id === tweaks.section);

  const variantLabel = {
    highlight: 'A · Highlight in text',
    chips: 'B · Evidence chips',
  }[tweaks.variant] || tweaks.variant;

  return (
    <>
      <div className="stage">
        <div className="preface">
          <div className="eyebrow">Skim · Practice · Part 2</div>
          <h1>Select Evidence</h1>
          <p>
            Match each section to its function — then <strong>locate the why</strong>:
            highlight or pick the words in the text that prove your choice.
            Choosing alone is too easy; the work is finding the signal.
          </p>
          <div style={{marginTop:14}}>
            <span className="meta-pill">⏱ 6 min</span>
            <span className="meta-pill">¶1–8</span>
            <span className="meta-pill">Variant: {variantLabel}</span>
          </div>
        </div>

        <div className="section-label">
          <span>Practice</span>
          <div className="section-line"></div>
        </div>

        {filtered.map(s => (
          <SectionCard key={s.id+tweaks.variant} section={s}
            variant={tweaks.variant}
            showTranslate={tweaks.showTranslate}
            expanded={true} />
        ))}
      </div>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Interaction variant">
          <TweakRadio
            value={tweaks.variant}
            onChange={(v)=>setTweak('variant', v)}
            options={[
              {value:'highlight', label:'A · Highlight in text'},
              {value:'chips', label:'B · Evidence chips'},
            ]}
          />
          <div style={{fontSize:11, color:'var(--t3)', lineHeight:1.55, marginTop:8}}>
            <strong>A</strong>: Click words/phrases directly in the paragraph.<br/>
            <strong>B</strong>: Pick from a list of pre-extracted phrase chips.
          </div>
        </TweakSection>

        <TweakSection title="Section to show">
          <TweakSelect
            value={tweaks.section}
            onChange={(v)=>setTweak('section', v)}
            options={[
              {value:'all', label:'All 4 sections'},
              {value:'p12', label:'¶1-2 · Phenomenon'},
              {value:'p34', label:'¶3-4 · History'},
              {value:'p57', label:'¶5-7 · Culture'},
              {value:'p8', label:'¶8 · Conclusion'},
            ]}
          />
        </TweakSection>

        <TweakSection title="Language support">
          <TweakToggle
            value={tweaks.showTranslate}
            onChange={(v)=>setTweak('showTranslate', v)}
            label="Show 中文 prompts"
          />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}
