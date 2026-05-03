/* ════════════════════════════════════════════════════════════════════
   Map It — a new student-facing practice type
   Students drag target items onto a 2D coordinate plane, then explain
   the reason for each placement. Designed for Task 4 (Evaluate) of the
   Ideal Beauty lesson but the schema works for any matrix-style task.
   ════════════════════════════════════════════════════════════════════ */
const {useState,useRef,useEffect,useMemo,Fragment,useCallback} = React;

/* ─────────────────────────────  CONTENT  ───────────────────────────── */
/* Textbook source — the same passage students read in earlier tasks.
   `refs` maps a chip id → paragraph numbers it draws evidence from, so we
   can dim non-relevant paragraphs when a chip is active. */
const TEXTBOOK = {
  title:'Ideal Beauty',
  subtitle:'Unit 3 · Reading',
  source:'Senior English · Module 6',
  paragraphs:[
    {n:1, text:'In many parts of Nigeria, it is traditional for women to go to special "fattening rooms" before they get married. Happiness Edem was one such young woman, and she went from 60 kg to twice that weight because, in her culture, being fat is a sign of wealth.'},
    {n:2, text:'But what about the rest of the world? Open any fashion magazine and you will see young models — women who are slim and fair. Many people are worried that modern media promotes shallow beauty ideals.'},
    {n:3, text:'Ideas about physical beauty change over time, and different periods of history have had their own idea of what is beautiful. In ancient Egypt, both men and women used to paint dark kohl around their eyes — they believed it had protective and spiritual meaning.'},
    {n:4, text:'In the 1600s in Europe, being plump and pale-skinned was considered stunning beauty. Rubens painted many women with round, soft bodies. In Elizabethan England, pale skin was a sign of wealth — only the poor had to work outdoors and tan in the sun.'},
    {n:5, text:'Within different cultures around the world, we can find diverse ideas about physical beauty. In Borneo, many people have tattoos. For them, their body art is like a diary of important events in their life.'},
    {n:6, text:'In New Zealand, the Maori people have their own tradition — a form of tattooing called tā moko. Unlike in Borneo, these tattoos show a person\'s position in society: family, achievements, and rank are all written into the skin.'},
    {n:7, text:'European visitors to Myanmar were amazed to see women wearing metal rings around their necks, gradually adding more rings to lengthen the neck. And in Indonesia, some people practised sharpening their teeth, as it was considered a form of cultural identity and beauty.'},
    {n:8, text:'It appears that people change their appearance to tell the world about their culture and status. Whether kohl, tattoos, or metal rings, these practices reflect cultural values and identity, not just vanity.'},
  ],
};
/* chip id → paragraph numbers — used for "Jump to source" links. */
const CHIP_REFS = {
  kohl:[3], plump:[4], borneo:[5], maori:[6],
  rings:[7], teeth:[7], media:[2],
};

const AXIS_PRESETS = {
  cultural_permanence:{
    title:'Map It · Beauty practices',
    prompt:'Each chip below is one beauty practice from the text. Drag it onto the plane based on **two questions**, then explain *why* you placed it where you did.',
    x:{neg:'Just appearance',pos:'Cultural meaning',label:'Why is it done?'},
    y:{neg:'Temporary',pos:'Permanent',label:'How lasting is it?'},
    items:[
      {id:'kohl',  label:'Egyptian kohl',     hint:'¶3'},
      {id:'plump', label:'1600s plump & pale',hint:'¶4'},
      {id:'borneo',label:'Borneo tattoos',    hint:'¶5'},
      {id:'maori', label:'Maori tā moko',     hint:'¶6'},
      {id:'rings', label:'Myanmar neck rings',hint:'¶7'},
      {id:'teeth', label:'Indonesia teeth',   hint:'¶7'},
      {id:'media', label:'Modern media slim', hint:'¶2'},
    ],
    /* teacher-set "expected" anchors for heatmap reveal */
    expected:{
      kohl:[.55,-.2], plump:[-.4,-.5], borneo:[.7,.85],
      maori:[.85,.9], rings:[.55,.55], teeth:[.6,.8], media:[-.7,-.7],
    },
  },
  shallow_deep:{
    title:'Map It · "Shallow vs deep" judgement',
    prompt:'The author calls some beauty standards **"shallow"**. Place each one along these two axes and defend your reasoning.',
    x:{neg:'Shallow',pos:'Deep meaning',label:'How meaningful?'},
    y:{neg:'Imposed',pos:'Self-chosen',label:'Who decides?'},
    items:[
      {id:'kohl',  label:'Egyptian kohl',     hint:'¶3'},
      {id:'plump', label:'1600s plump & pale',hint:'¶4'},
      {id:'borneo',label:'Borneo tattoos',    hint:'¶5'},
      {id:'maori', label:'Maori tā moko',     hint:'¶6'},
      {id:'rings', label:'Myanmar neck rings',hint:'¶7'},
      {id:'teeth', label:'Indonesia teeth',   hint:'¶7'},
      {id:'media', label:'Modern media slim', hint:'¶2'},
    ],
    expected:{
      kohl:[.5,.1], plump:[-.1,-.4], borneo:[.8,.7],
      maori:[.85,.5], rings:[.4,.2], teeth:[.6,.6], media:[-.7,-.6],
    },
  },
};

/* ─────────────────────────────  STYLES  ────────────────────────────── */
const M = {
  /* shell */
  root:{display:'flex',flexDirection:'column',height:'100vh',background:'var(--bg)',overflow:'hidden'},
  topBar:{display:'flex',alignItems:'center',gap:'var(--sp-3)',padding:'0 var(--sp-5)',height:48,background:'var(--surface)',borderBottom:'1px solid var(--border)',flexShrink:0},
  topKick:{fontSize:'var(--fs-meta)',color:'var(--purple)',background:'var(--purple-bg)',padding:'2px 8px',borderRadius:'var(--r-pill)',fontWeight:600,letterSpacing:'.3px',textTransform:'uppercase'},
  topTitle:{fontSize:14,fontWeight:700,letterSpacing:'-.2px'},
  topSub:{fontSize:'var(--fs-meta)',color:'var(--t3)',flex:1},
  topMeta:{fontSize:'var(--fs-meta)',color:'var(--t3)'},

  body:{flex:1,display:'flex',minHeight:0,position:'relative'},

  /* left = the canvas */
  leftCol:{flex:1,minWidth:0,display:'flex',flexDirection:'column',padding:'var(--sp-6) var(--sp-8)'},
  promptRow:{marginBottom:'var(--sp-5)',maxWidth:680},
  promptKick:{fontSize:'var(--fs-label)',color:'var(--t3)',fontWeight:600,letterSpacing:'.5px',textTransform:'uppercase',marginBottom:6},
  promptTitle:{fontSize:'var(--fs-h1)',fontWeight:700,letterSpacing:'-.3px',marginBottom:8,color:'var(--t1)',textWrap:'pretty'},
  promptText:{fontSize:'var(--fs-body)',color:'var(--t2)',lineHeight:1.65,textWrap:'pretty'},

  /* the plane container */
  planeWrap:{flex:1,display:'flex',gap:'var(--sp-5)',alignItems:'stretch',minHeight:0},
  planeCell:{flex:1,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',minWidth:0},

  /* tray = unplaced chips */
  tray:{width:220,flexShrink:0,display:'flex',flexDirection:'column',gap:'var(--sp-3)',padding:'var(--sp-4)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-card)',alignSelf:'stretch'},
  trayHd:{display:'flex',alignItems:'center',gap:6,marginBottom:'var(--sp-2)'},
  trayLabel:{fontSize:'var(--fs-label)',color:'var(--t3)',fontWeight:600,letterSpacing:'.5px',textTransform:'uppercase'},
  trayCount:{fontSize:'var(--fs-meta)',color:'var(--t3)',marginLeft:'auto'},
  chip:{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 11px',borderRadius:999,background:'var(--surface)',border:'1.5px solid var(--border-strong, rgba(28,28,26,.14))',fontSize:'var(--fs-body-sm)',color:'var(--t1)',fontWeight:500,cursor:'grab',transition:'box-shadow .12s, transform .12s, border-color .12s, background .12s',whiteSpace:'nowrap',userSelect:'none'},
  chipDot:{width:7,height:7,borderRadius:'50%',flexShrink:0,background:'var(--t3)'},
  chipHint:{fontSize:'var(--fs-meta)',color:'var(--t3)',fontWeight:500,marginLeft:2},
  chipDragging:{cursor:'grabbing',boxShadow:'0 8px 24px rgba(28,28,26,.18)',transform:'scale(1.04) rotate(-1.5deg)',borderColor:'var(--t1)',background:'var(--surface)',zIndex:100},
  chipPlaced:{boxShadow:'0 1px 2px rgba(28,28,26,.06)'},
  chipFocused:{borderColor:'var(--purple)',boxShadow:'0 0 0 3px var(--purple-bg)'},

  /* right side = reasoning panel */
  rightCol:{width:380,flexShrink:0,borderLeft:'1px solid var(--border)',background:'var(--surface)',display:'flex',flexDirection:'column',minHeight:0},
  reasonHd:{padding:'var(--sp-4) var(--sp-5)',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'var(--sp-2)',flexShrink:0},
  reasonHdTitle:{fontSize:'var(--fs-h2)',fontWeight:700,letterSpacing:'-.2px',flex:1},
  reasonHdMeta:{fontSize:'var(--fs-meta)',color:'var(--t3)'},
  reasonScroll:{flex:1,overflowY:'auto',padding:'var(--sp-4) var(--sp-5)'},

  emptyHint:{padding:'var(--sp-8) var(--sp-5)',fontSize:'var(--fs-body-sm)',color:'var(--t3)',textAlign:'center',lineHeight:1.6,textWrap:'balance'},
  emptyCircle:{width:34,height:34,borderRadius:'50%',border:'1.5px dashed var(--border-strong, rgba(28,28,26,.14))',margin:'0 auto var(--sp-3)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--t3)',fontSize:14},

  reasonItem:{padding:'var(--sp-4)',background:'var(--bg)',borderRadius:'var(--r-card)',border:'1px solid var(--border)',marginBottom:'var(--sp-3)',transition:'border-color .15s, box-shadow .15s'},
  reasonItemActive:{borderColor:'var(--purple)',boxShadow:'0 0 0 3px var(--purple-bg)'},
  reasonItemHd:{display:'flex',alignItems:'center',gap:8,marginBottom:'var(--sp-2)'},
  reasonChip:{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 9px',borderRadius:999,background:'var(--surface)',border:'1px solid var(--border-strong, rgba(28,28,26,.14))',fontSize:'var(--fs-body-sm)',color:'var(--t1)',fontWeight:500,whiteSpace:'nowrap'},
  reasonCoord:{fontFamily:'"SF Mono", ui-monospace, "Menlo", monospace',fontSize:'var(--fs-meta)',color:'var(--t3)',marginLeft:'auto'},
  reasonAxes:{display:'flex',gap:'var(--sp-3)',marginBottom:'var(--sp-3)'},
  reasonAxisCell:{flex:1,padding:'7px 9px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r-input)',fontSize:'var(--fs-meta)',lineHeight:1.4},
  reasonAxisLabel:{color:'var(--t3)',fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:2},
  reasonAxisValue:{color:'var(--t1)',fontWeight:600},
  reasonInput:{width:'100%',border:'1px solid var(--border)',borderRadius:'var(--r-input)',padding:'9px 11px',fontSize:'var(--fs-body)',fontFamily:'inherit',background:'var(--surface)',minHeight:62,resize:'vertical',lineHeight:1.6,color:'var(--t1)'},
  reasonInputDone:{borderColor:'var(--green)',background:'var(--green-bg)',color:'var(--t1)'},
  reasonRowFoot:{display:'flex',alignItems:'center',gap:8,marginTop:8,fontSize:'var(--fs-meta)',color:'var(--t3)'},
  reasonRemove:{fontSize:'var(--fs-meta)',color:'var(--t3)',background:'transparent',border:'none',cursor:'pointer',padding:'2px 6px',borderRadius:4,marginLeft:'auto',fontFamily:'inherit'},

  aiBubble:{display:'flex',gap:8,padding:'10px 12px',background:'var(--purple-bg)',border:'1px solid rgba(58,49,133,.12)',borderRadius:'var(--r-input-lg)',marginTop:8},
  aiDot:{width:6,height:6,borderRadius:'50%',background:'var(--purple)',flexShrink:0,marginTop:7},
  aiText:{fontSize:'var(--fs-body-sm)',color:'var(--t1)',lineHeight:1.55,flex:1,textWrap:'pretty'},
  aiKick:{fontSize:9,fontWeight:700,color:'var(--purple)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:2,display:'block'},

  /* ─── Textbook drawer (right edge, collapsed by default) ─── */
  /* The rail is the always-visible vertical tab; clicking it expands the
     panel. The panel slides in from the right and is overlaid on top of
     the reasoning panel — it does NOT push layout, so students can pop
     it open without losing their drag-canvas size. */
  tbRail:{
    position:'absolute',top:0,bottom:0,right:0,width:36,
    background:'var(--surface)',borderLeft:'1px solid var(--border)',
    display:'flex',flexDirection:'column',alignItems:'center',
    padding:'var(--sp-4) 0',gap:'var(--sp-3)',
    cursor:'pointer',zIndex:5,
    transition:'background .15s, border-color .15s',
  },
  tbRailHover:{background:'var(--surface2)'},
  tbRailIcon:{
    width:22,height:22,borderRadius:4,
    background:'var(--teal-bg)',color:'var(--teal)',
    display:'flex',alignItems:'center',justifyContent:'center',
    flexShrink:0,
  },
  tbRailLabel:{
    writingMode:'vertical-rl',
    fontSize:'var(--fs-meta)',color:'var(--t2)',fontWeight:600,
    letterSpacing:'.6px',textTransform:'uppercase',
    marginTop:'var(--sp-2)',
  },
  tbRailHint:{
    writingMode:'vertical-rl',
    fontSize:9,color:'var(--t3)',fontWeight:500,
    letterSpacing:'.4px',marginTop:'auto',
    paddingBottom:'var(--sp-3)',
  },

  tbPanel:{
    position:'absolute',top:0,bottom:0,right:0,width:420,
    background:'var(--surface)',borderLeft:'1px solid var(--border)',
    boxShadow:'-8px 0 32px rgba(28,28,26,.06)',
    display:'flex',flexDirection:'column',
    zIndex:10,
    transition:'transform .25s cubic-bezier(.4,0,.2,1)',
  },

  tbHd:{
    display:'flex',alignItems:'center',gap:'var(--sp-3)',
    padding:'var(--sp-4) var(--sp-5)',
    borderBottom:'1px solid var(--border)',flexShrink:0,
  },
  tbHdIcon:{
    width:26,height:26,borderRadius:5,
    background:'var(--teal-bg)',color:'var(--teal)',
    display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
  },
  tbHdTitleWrap:{flex:1,minWidth:0},
  tbHdKick:{fontSize:9,fontWeight:700,color:'var(--teal)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:1},
  tbHdTitle:{fontSize:'var(--fs-h2)',fontWeight:700,letterSpacing:'-.2px',color:'var(--t1)'},
  tbHdClose:{
    background:'transparent',border:'none',cursor:'pointer',
    width:28,height:28,borderRadius:6,
    display:'flex',alignItems:'center',justifyContent:'center',
    color:'var(--t3)',fontSize:14,fontFamily:'inherit',
  },

  tbToolbar:{
    display:'flex',alignItems:'center',gap:'var(--sp-2)',
    padding:'var(--sp-3) var(--sp-5)',
    borderBottom:'1px solid var(--border)',flexShrink:0,
    background:'var(--bg)',
  },
  tbFocusChip:{
    display:'inline-flex',alignItems:'center',gap:6,
    padding:'4px 9px',borderRadius:999,
    background:'var(--purple-bg)',border:'1px solid rgba(58,49,133,.18)',
    fontSize:'var(--fs-meta)',color:'var(--purple)',fontWeight:600,
  },
  tbFocusChipDim:{
    display:'inline-flex',alignItems:'center',gap:6,
    padding:'4px 9px',borderRadius:999,
    background:'var(--surface2)',border:'1px solid var(--border)',
    fontSize:'var(--fs-meta)',color:'var(--t3)',fontWeight:500,
  },
  tbFocusClear:{
    fontSize:'var(--fs-meta)',color:'var(--t3)',
    background:'transparent',border:'none',cursor:'pointer',
    padding:'2px 4px',fontFamily:'inherit',marginLeft:'auto',
  },

  tbScroll:{
    flex:1,overflowY:'auto',
    padding:'var(--sp-5) var(--sp-6)',
    fontSize:14,lineHeight:1.75,color:'var(--t1)',
  },
  tbTitle:{
    fontSize:'var(--fs-h1)',fontWeight:700,letterSpacing:'-.3px',
    color:'var(--t1)',marginBottom:4,textWrap:'pretty',
  },
  tbSubtitle:{
    fontSize:'var(--fs-meta)',color:'var(--t3)',
    marginBottom:'var(--sp-5)',
    paddingBottom:'var(--sp-4)',borderBottom:'1px solid var(--border)',
  },
  tbPara:{
    display:'flex',gap:10,marginBottom:'var(--sp-4)',
    padding:'2px 6px 2px 0',borderRadius:6,
    transition:'opacity .2s, background .2s',
  },
  tbParaDim:{opacity:.32},
  tbParaActive:{
    background:'var(--purple-bg)',
    paddingLeft:8,marginLeft:-8,
  },
  tbParaNum:{
    fontFamily:'"SF Mono", ui-monospace, "Menlo", monospace',
    fontSize:11,color:'var(--t3)',fontWeight:600,
    flexShrink:0,paddingTop:5,minWidth:22,
    userSelect:'none',
  },
  tbParaNumActive:{color:'var(--purple)'},
  tbParaText:{flex:1,textWrap:'pretty'},

  tbFoot:{
    padding:'var(--sp-3) var(--sp-5)',
    borderTop:'1px solid var(--border)',flexShrink:0,
    fontSize:'var(--fs-meta)',color:'var(--t3)',
    display:'flex',alignItems:'center',gap:'var(--sp-2)',
    background:'var(--surface)',
  },
  tbFootKbd:{
    fontFamily:'"SF Mono", ui-monospace, "Menlo", monospace',
    fontSize:10,padding:'2px 5px',borderRadius:3,
    background:'var(--surface2)',color:'var(--t2)',
    border:'1px solid var(--border)',
  },

  /* footer / submit */
  reasonFoot:{padding:'var(--sp-4) var(--sp-5)',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'var(--sp-3)',flexShrink:0,background:'var(--surface)'},
  progress:{flex:1,display:'flex',alignItems:'center',gap:'var(--sp-2)'},
  progressBar:{flex:1,height:4,background:'var(--surface2)',borderRadius:2,overflow:'hidden'},
  progressFill:{height:'100%',background:'var(--green)',borderRadius:2,transition:'width .3s'},
  progressTxt:{fontSize:'var(--fs-meta)',color:'var(--t3)',fontVariantNumeric:'tabular-nums'},
  submitBtn:{padding:'10px 18px',borderRadius:'var(--r-input)',border:'none',background:'var(--t1)',color:'var(--surface)',fontSize:'var(--fs-body)',fontWeight:600,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap'},
  submitOff:{opacity:.35,cursor:'default'},
};

/* ──────────────  MARKDOWN-LITE (for **bold** in prompt)  ──────────── */
function md(text){
  if(!text)return null;
  const out=[];let rest=text;let key=0;
  while(rest.includes('**')){
    const a=rest.indexOf('**');const b=rest.indexOf('**',a+2);
    if(b===-1)break;
    if(a>0)out.push(rest.slice(0,a));
    out.push(<strong key={key++}>{rest.slice(a+2,b)}</strong>);
    rest=rest.slice(b+2);
  }
  if(rest)out.push(rest);
  return out;
}

/* ─────────────────────────────  PLANE  ─────────────────────────────── */
/* Coordinates are normalized [-1,1] for both axes, with origin at center
   and +Y rendering UP. The Plane component owns drag tracking. */
function Plane({preset,placements,setPlacements,activeId,setActiveId,snap,showHeatmap}){
  const planeRef = useRef(null);
  const [drag,setDrag] = useState(null); // {id, fromTray, dx, dy, x, y}
  const [hoverPlane,setHoverPlane] = useState(false);

  const placedIds = useMemo(()=>new Set(Object.keys(placements)),[placements]);

  /* convert pointer event → normalized coords */
  const eventToNorm = useCallback((e)=>{
    const rect = planeRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    let nx = px*2-1; let ny = 1-py*2; // y inverted
    if(snap){
      const step = .25;
      nx = Math.round(nx/step)*step;
      ny = Math.round(ny/step)*step;
    }
    nx = Math.max(-1,Math.min(1,nx));
    ny = Math.max(-1,Math.min(1,ny));
    return {x:nx,y:ny};
  },[snap]);

  /* drag handlers (pointer events, works for mouse + touch) */
  const onChipDown = (e,item,fromTray)=>{
    e.preventDefault();
    e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    document.body.classList.add('dragging');
    const start = {clientX:e.clientX,clientY:e.clientY};
    setDrag({id:item.id,fromTray,startX:start.clientX,startY:start.clientY,curX:start.clientX,curY:start.clientY});
    setActiveId(item.id);
  };

  useEffect(()=>{
    if(!drag)return;
    const move=(e)=>{
      setDrag(d=>d?{...d,curX:e.clientX,curY:e.clientY}:d);
    };
    const up=(e)=>{
      document.body.classList.remove('dragging');
      // is pointer over plane?
      const rect = planeRef.current.getBoundingClientRect();
      const inside = e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom;
      if(inside){
        const norm = eventToNorm(e);
        setPlacements(p=>({...p,[drag.id]:{x:norm.x,y:norm.y}}));
      } else if(!drag.fromTray) {
        // dragged off the plane → return to tray
        setPlacements(p=>{const c={...p};delete c[drag.id];return c;});
      }
      setDrag(null);
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',up);
    return ()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
      window.removeEventListener('pointercancel',up);
    };
  },[drag, eventToNorm, setPlacements]);

  /* render */
  const items = preset.items;
  const trayItems = items.filter(it=>!placedIds.has(it.id));
  const planeItems = items.filter(it=>placedIds.has(it.id));

  return (
    <div style={M.planeWrap}>
      {/* Tray */}
      <div style={M.tray}>
        <div style={M.trayHd}>
          <span style={M.trayLabel}>Items</span>
          <span style={M.trayCount}>{trayItems.length}/{items.length} left</span>
        </div>
        {trayItems.length===0 && (
          <div style={{fontSize:'var(--fs-meta)',color:'var(--t3)',padding:'var(--sp-3) 0',textAlign:'center',lineHeight:1.5}}>
            All placed.<br/>Drag items <em>off</em> the plane to return them here.
          </div>
        )}
        {trayItems.map(it=>{
          const isDragging = drag && drag.id===it.id;
          const dx = isDragging ? drag.curX - drag.startX : 0;
          const dy = isDragging ? drag.curY - drag.startY : 0;
          return (
            <div
              key={it.id}
              onPointerDown={(e)=>onChipDown(e,it,true)}
              style={{
                ...M.chip,
                ...(isDragging?M.chipDragging:{}),
                transform: isDragging?`translate(${dx}px, ${dy}px) scale(1.04) rotate(-1.5deg)`:undefined,
                position: isDragging?'fixed':undefined,
                zIndex: isDragging?100:undefined,
                left: isDragging?drag.startX:undefined,
                top: isDragging?drag.startY:undefined,
                marginLeft: isDragging?-40:0,
                marginTop: isDragging?-14:0,
              }}
            >
              <span style={M.chipDot}></span>
              <span>{it.label}</span>
              <span style={M.chipHint}>{it.hint}</span>
            </div>
          );
        })}
      </div>

      {/* Plane cell */}
      <div style={M.planeCell}>
        <PlaneAxes preset={preset} planeRef={planeRef} placements={placements} planeItems={planeItems}
          drag={drag} activeId={activeId} setActiveId={setActiveId}
          showHeatmap={showHeatmap} onChipDown={onChipDown}/>
      </div>
    </div>
  );
}

/* The actual coordinate plane drawing */
function PlaneAxes({preset,planeRef,placements,planeItems,drag,activeId,setActiveId,showHeatmap,onChipDown}){
  const planeStyle = {
    width:'100%',height:'100%',maxWidth:760,maxHeight:760,aspectRatio:'1 / 1',
    position:'relative',
    background:'var(--surface)',
    border:'1px solid var(--border)',
    borderRadius:'var(--r-card-lg)',
    boxShadow:'inset 0 0 0 1px rgba(28,28,26,.02)',
    overflow:'visible',
  };

  /* normalized [-1,1] → percent for absolute positioning */
  const toPct = (n)=>((n+1)/2)*100;

  /* axis labels positioned outside the plane */
  return (
    <div style={planeStyle} ref={planeRef}>
      {/* grid (4×4) */}
      {[1,2,3].map(i=>(
        <Fragment key={'g'+i}>
          <div style={{position:'absolute',left:`${i*25}%`,top:0,bottom:0,width:1,background:'var(--border)',pointerEvents:'none'}}/>
          <div style={{position:'absolute',top:`${i*25}%`,left:0,right:0,height:1,background:'var(--border)',pointerEvents:'none'}}/>
        </Fragment>
      ))}
      {/* central crosshairs (slightly stronger) */}
      <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:'rgba(28,28,26,.14)',pointerEvents:'none'}}/>
      <div style={{position:'absolute',top:'50%',left:0,right:0,height:1,background:'rgba(28,28,26,.14)',pointerEvents:'none'}}/>

      {/* Axis tip-arrows */}
      <AxisTick side="top"    label={preset.y.pos}/>
      <AxisTick side="bottom" label={preset.y.neg}/>
      <AxisTick side="left"   label={preset.x.neg}/>
      <AxisTick side="right"  label={preset.x.pos}/>

      {/* Axis question labels */}
      <div style={{position:'absolute',left:0,right:0,bottom:-46,fontSize:12,color:'var(--t3)',textAlign:'center'}}>
        ↕&nbsp;<span style={{fontWeight:600,color:'var(--t2)'}}>{preset.y.label}</span>
        <span style={{margin:'0 10px',color:'var(--border-strong, rgba(28,28,26,.14))'}}>·</span>
        ↔&nbsp;<span style={{fontWeight:600,color:'var(--t2)'}}>{preset.x.label}</span>
      </div>

      {/* Heatmap (teacher's expected anchor positions) */}
      {showHeatmap && Object.entries(preset.expected||{}).map(([id,[x,y]])=>(
        <div key={'h'+id} style={{
          position:'absolute',
          left:`${toPct(x)}%`, top:`${toPct(-y)}%`,
          transform:'translate(-50%,-50%)',
          width:50,height:50,borderRadius:'50%',
          background:'radial-gradient(circle, rgba(122,77,14,.18) 0%, rgba(122,77,14,0) 70%)',
          pointerEvents:'none',
        }}/>
      ))}

      {/* Placed chips */}
      {planeItems.map(it=>{
        const p = placements[it.id];
        const isDragging = drag && drag.id===it.id;
        const isActive = activeId===it.id;
        const left = isDragging ? null : `${toPct(p.x)}%`;
        const top  = isDragging ? null : `${toPct(-p.y)}%`;
        return (
          <div key={it.id}
            onPointerDown={(e)=>{e.stopPropagation();onChipDown(e,it,false);}}
            onClick={(e)=>{e.stopPropagation();setActiveId(it.id);}}
            style={{
              ...M.chip,
              ...M.chipPlaced,
              ...(isActive?M.chipFocused:{}),
              ...(isDragging?M.chipDragging:{}),
              position:isDragging?'fixed':'absolute',
              left:isDragging?drag.curX:left,
              top:isDragging?drag.curY:top,
              transform:isDragging?'translate(-50%,-50%) scale(1.04) rotate(-1.5deg)':'translate(-50%,-50%)',
            }}
          >
            <span style={{...M.chipDot,background:'var(--purple)'}}></span>
            <span>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function AxisTick({side,label}){
  /* Top/bottom labels sit OUTSIDE the plane (vertical room is plentiful).
     Left/right labels sit INSIDE the plane, vertically rotated and pinned
     to the edge — this guarantees they never overflow the .planeCell or
     collide with the reasoning panel, no matter how long the label is. */
  const base = {position:'absolute',fontSize:13,color:'var(--t1)',fontWeight:600,letterSpacing:'.2px',whiteSpace:'nowrap',pointerEvents:'none'};
  const styles = {
    top:    {...base, left:'50%', top:10,    transform:'translateX(-50%)'},
    bottom: {...base, left:'50%', bottom:10, transform:'translateX(-50%)'},
    left:   {...base, left:12,  top:'50%', transform:'translateY(-50%)'},
    right:  {...base, right:12, top:'50%', transform:'translateY(-50%)'},
  };
  const arrows = {top:'↑',bottom:'↓',left:'←',right:'→'};
  return (
    <div style={styles[side]}>
      {(side==='left'||side==='bottom') && <span style={{color:'var(--t3)',marginRight:4}}>{arrows[side]}</span>}
      {label}
      {(side==='right'||side==='top') && <span style={{color:'var(--t3)',marginLeft:4}}>{arrows[side]}</span>}
    </div>
  );
}

/* ─────────────────────  REASONING SIDE PANEL  ──────────────────────── */
function ReasonPanel({preset,placements,setPlacements,reasons,setReasons,activeId,setActiveId,onSubmit,allReasoned,openTextbook}){
  const items = preset.items;
  const placed = items.filter(it=>placements[it.id]);
  const total = items.length;
  const placedCount = placed.length;
  const reasonedCount = placed.filter(it=>(reasons[it.id]||'').trim().length>=8).length;

  /* axis-quadrant words for natural-language hint */
  const xWord = (x)=> x>0 ? preset.x.pos : preset.x.neg;
  const yWord = (y)=> y>0 ? preset.y.pos : preset.y.neg;

  return (
    <div style={M.rightCol}>
      <div style={M.reasonHd}>
        <span style={M.reasonHdTitle}>Your reasoning</span>
        <span style={M.reasonHdMeta}>{reasonedCount}/{total} explained</span>
      </div>

      <div style={M.reasonScroll}>
        {placed.length===0 && (
          <div style={M.emptyHint}>
            <div style={M.emptyCircle}>↘</div>
            Drag a chip onto the plane.<br/>An explanation slot will open here.
          </div>
        )}

        {placed.map(it=>{
          const p = placements[it.id];
          const reason = reasons[it.id]||'';
          const done = reason.trim().length>=8;
          const isActive = activeId===it.id;
          return (
            <div key={it.id}
              style={{...M.reasonItem,...(isActive?M.reasonItemActive:{})}}
              onClick={()=>setActiveId(it.id)}
            >
              <div style={M.reasonItemHd}>
                <span style={M.reasonChip}>
                  <span style={{...M.chipDot,background:'var(--purple)'}}></span>
                  {it.label}
                </span>
                <span style={M.reasonCoord}>
                  ({p.x.toFixed(2)}, {p.y.toFixed(2)})
                </span>
              </div>

              <div style={M.reasonAxes}>
                <div style={M.reasonAxisCell}>
                  <div style={M.reasonAxisLabel}>{preset.x.label}</div>
                  <div style={M.reasonAxisValue}>{xWord(p.x)}</div>
                </div>
                <div style={M.reasonAxisCell}>
                  <div style={M.reasonAxisLabel}>{preset.y.label}</div>
                  <div style={M.reasonAxisValue}>{yWord(p.y)}</div>
                </div>
              </div>

              <textarea
                style={{...M.reasonInput,...(done?M.reasonInputDone:{})}}
                placeholder={`Why is "${it.label}" ${xWord(p.x).toLowerCase()} and ${yWord(p.y).toLowerCase()}? Use evidence from the text…`}
                value={reason}
                onChange={(e)=>setReasons(r=>({...r,[it.id]:e.target.value}))}
                onFocus={()=>setActiveId(it.id)}
              />

              <div style={M.reasonRowFoot}>
                <span>{reason.trim().length} chars · need ≥ 8</span>
                {CHIP_REFS[it.id] && openTextbook && (
                  <button
                    style={{...M.reasonRemove, color:'var(--teal)', fontWeight:600}}
                    onClick={(e)=>{ e.stopPropagation(); openTextbook(CHIP_REFS[it.id][0]); }}
                    title="Open textbook to this paragraph"
                  >
                    See ¶{CHIP_REFS[it.id].join(', ¶')} →
                  </button>
                )}
                <button style={M.reasonRemove} onClick={(e)=>{
                  e.stopPropagation();
                  setPlacements(p=>{const c={...p};delete c[it.id];return c;});
                  setReasons(r=>{const c={...r};delete c[it.id];return c;});
                }}>Return ↩</button>
              </div>
            </div>
          );
        })}

        {placed.length>0 && (
          <div style={M.aiBubble}>
            <span style={M.aiDot}></span>
            <div style={M.aiText}>
              <span style={M.aiKick}>AI nudge</span>
              {placed.length<total
                ? <>You've placed <strong>{placedCount} of {total}</strong>. Try the ones you feel most strongly about first — the harder cases will be easier with the others as anchors.</>
                : reasonedCount<total
                  ? <>Nice — every chip is on the plane. Now defend each one with <strong>one sentence + a paragraph reference</strong>. Pattern: <em>"I placed X here because ¶N says…"</em></>
                  : <>All <strong>{total} placements explained</strong>. Submit to share your map with the class — the teacher will project everyone's positions on the board.</>
              }
            </div>
          </div>
        )}
      </div>

      <div style={M.reasonFoot}>
        <div style={M.progress}>
          <span style={M.progressTxt}>{reasonedCount}/{total}</span>
          <div style={M.progressBar}>
            <div style={{...M.progressFill,width:`${(reasonedCount/total)*100}%`}}/>
          </div>
        </div>
        <button
          style={{...M.submitBtn,...(allReasoned?{}:M.submitOff)}}
          onClick={allReasoned?onSubmit:undefined}
        >
          Submit map →
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────  TEXTBOOK PANEL  ─────────────────────────── */
/* Collapsed by default as a thin vertical rail on the right edge.
   Clicking the rail expands the full reading panel. When a chip is
   active, paragraphs NOT referenced by that chip dim, and the matching
   ¶ pulses into a soft purple highlight — turning the textbook into a
   "evidence verifier" rather than a passive reference. */
function Textbook({open, setOpen, activeId, focusPara, setFocusPara}){
  const [hover,setHover] = useState(false);
  const scrollRef = useRef(null);
  const paraRefs = useRef({});

  /* Determine which paragraphs are "in focus":
     - explicit focusPara (user clicked a ¶ ref) takes precedence
     - else, if a chip is active, use its CHIP_REFS
     - else, no focus → show all at full opacity */
  const focusSet = useMemo(()=>{
    if(focusPara) return new Set([focusPara]);
    if(activeId && CHIP_REFS[activeId]) return new Set(CHIP_REFS[activeId]);
    return null;
  },[focusPara, activeId]);

  /* Auto-scroll to focused paragraph when it changes */
  useEffect(()=>{
    if(!open) return;
    const target = focusPara || (activeId && CHIP_REFS[activeId] && CHIP_REFS[activeId][0]);
    if(!target) return;
    const el = paraRefs.current[target];
    const scroller = scrollRef.current;
    if(!el || !scroller) return;
    const elTop = el.offsetTop;
    const targetScroll = elTop - 24;
    scroller.scrollTo({top:targetScroll, behavior:'smooth'});
  },[open, activeId, focusPara]);

  /* Esc closes */
  useEffect(()=>{
    if(!open) return;
    const onKey = (e)=>{ if(e.key==='Escape') setOpen(false); };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[open, setOpen]);

  if(!open){
    return (
      <div
        style={{...M.tbRail, ...(hover?M.tbRailHover:{})}}
        onMouseEnter={()=>setHover(true)}
        onMouseLeave={()=>setHover(false)}
        onClick={()=>setOpen(true)}
        title="Open textbook (T)"
      >
        <div style={M.tbRailIcon}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          </svg>
        </div>
        <div style={M.tbRailLabel}>课文 · Textbook</div>
        <div style={M.tbRailHint}>← 展开</div>
      </div>
    );
  }

  /* Active chip label (for the focus pill at the top) */
  const activeLabel = activeId
    ? (Object.values(AXIS_PRESETS)[0].items.find(it=>it.id===activeId) || {}).label
    : null;
  const activeRefs = activeId && CHIP_REFS[activeId] ? CHIP_REFS[activeId] : null;

  return (
    <div style={M.tbPanel}>
      <div style={M.tbHd}>
        <div style={M.tbHdIcon}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
          </svg>
        </div>
        <div style={M.tbHdTitleWrap}>
          <div style={M.tbHdKick}>课文 · Textbook</div>
          <div style={M.tbHdTitle}>{TEXTBOOK.title}</div>
        </div>
        <button style={M.tbHdClose} onClick={()=>setOpen(false)} title="Close (Esc)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      <div style={M.tbToolbar}>
        {activeLabel ? (
          <Fragment>
            <span style={M.tbFocusChip}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              Evidence for: {activeLabel}
              {activeRefs && <span style={{opacity:.7,fontWeight:500}}>· ¶{activeRefs.join(', ¶')}</span>}
            </span>
            {focusPara && (
              <button style={M.tbFocusClear} onClick={()=>setFocusPara(null)}>Clear</button>
            )}
          </Fragment>
        ) : (
          <span style={M.tbFocusChipDim}>
            <span style={{...M.chipDot, background:'var(--t3)'}}></span>
            Tap a chip to spotlight its paragraph
          </span>
        )}
      </div>

      <div style={M.tbScroll} ref={scrollRef}>
        <div style={M.tbTitle}>{TEXTBOOK.title}</div>
        <div style={M.tbSubtitle}>{TEXTBOOK.subtitle} · {TEXTBOOK.source}</div>
        {TEXTBOOK.paragraphs.map(p=>{
          const isActive = focusSet ? focusSet.has(p.n) : false;
          const isDim = focusSet ? !isActive : false;
          return (
            <div
              key={p.n}
              ref={(el)=>{ paraRefs.current[p.n]=el; }}
              style={{
                ...M.tbPara,
                ...(isDim?M.tbParaDim:{}),
                ...(isActive?M.tbParaActive:{}),
              }}
              onClick={()=>setFocusPara(focusPara===p.n?null:p.n)}
            >
              <span style={{...M.tbParaNum,...(isActive?M.tbParaNumActive:{})}}>¶{p.n}</span>
              <span style={M.tbParaText}>{p.text}</span>
            </div>
          );
        })}
      </div>

      <div style={M.tbFoot}>
        <span style={M.tbFootKbd}>Esc</span>
        <span>to close ·</span>
        <span>Click any ¶ to pin its highlight</span>
      </div>
    </div>
  );
}

/* ─────────────  TWEAKS PANEL HOST (aliases window.* → JSX names) ───── */
function TweaksPanelHost({tweaks,setTweak}){
  const TP = window.TweaksPanel, TSec = window.TweakSection,
        TRadio = window.TweakRadio, TToggle = window.TweakToggle;
  if(!TP || !TSec || !TRadio || !TToggle) return null;
  return (
    <TP title="Tweaks">
      <TSec label="Practice variant">
        <TRadio
          label="Axes"
          value={tweaks.preset}
          onChange={(v)=>setTweak('preset',v)}
          options={[
            {value:'cultural_permanence',label:'Meaning × Permanence'},
            {value:'shallow_deep',       label:'Shallow × Self-chosen'},
          ]}
        />
      </TSec>
      <TSec label="Plane behavior">
        <TToggle
          label="Snap to ¼ grid"
          value={tweaks.snap}
          onChange={(v)=>setTweak('snap',v)}
        />
        <TToggle
          label="Show teacher's expected zones"
          value={tweaks.showHeatmap}
          onChange={(v)=>setTweak('showHeatmap',v)}
        />
      </TSec>
    </TP>
  );
}

/* ─────────────────────────────  APP  ───────────────────────────────── */
function App(){
  const tweakDefaults = /*EDITMODE-BEGIN*/{
    "preset":"cultural_permanence",
    "snap":false,
    "showHeatmap":false
  }/*EDITMODE-END*/;

  const [tweaks,setTweak] = window.useTweaks(tweakDefaults);
  const preset = AXIS_PRESETS[tweaks.preset] || AXIS_PRESETS.cultural_permanence;

  const [placements,setPlacements] = useState({});
  const [reasons,setReasons]       = useState({});
  const [activeId,setActiveId]     = useState(null);
  const [submitted,setSubmitted]   = useState(false);

  /* Textbook drawer state — collapsed by default. focusPara overrides
     the chip-driven highlight when the user clicks a ¶ directly. */
  const [textbookOpen,setTextbookOpen] = useState(false);
  const [focusPara,setFocusPara]       = useState(null);

  /* Reset focusPara when active chip changes — the chip's own ¶ refs
     should take over. */
  useEffect(()=>{ setFocusPara(null); },[activeId]);

  /* Keyboard shortcut: T toggles the textbook drawer */
  useEffect(()=>{
    const onKey = (e)=>{
      if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
      if(e.key==='t'||e.key==='T'){ setTextbookOpen(o=>!o); }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[]);

  /* reset placements/reasons when preset changes */
  useEffect(()=>{ setPlacements({}); setReasons({}); setActiveId(null); setSubmitted(false); },[tweaks.preset]);

  const total = preset.items.length;
  const placedCount = Object.keys(placements).length;
  const reasonedCount = preset.items.filter(it=>placements[it.id]&&(reasons[it.id]||'').trim().length>=8).length;
  const allReasoned = reasonedCount===total;

  return (
    <div style={M.root}>
      {/* Top bar — slim, matches student.html aesthetic */}
      <div style={M.topBar}>
        <span style={M.topKick}>Practice · Map It</span>
        <span style={M.topTitle}>Ideal Beauty · Task 4</span>
        <span style={M.topSub}>Drag to place · then explain</span>
        <span style={M.topMeta}>{placedCount}/{total} placed · {reasonedCount}/{total} explained</span>
      </div>

      <div style={M.body}>
        {/* Canvas side */}
        <div style={M.leftCol}>
          <div style={M.promptRow}>
            <div style={M.promptKick}>{preset.title.split('·')[0].trim()}</div>
            <h1 style={M.promptTitle}>{preset.title.split('·').slice(1).join('·').trim() || preset.title}</h1>
            <div style={M.promptText}>{md(preset.prompt)}</div>
          </div>

          <Plane
            preset={preset}
            placements={placements} setPlacements={setPlacements}
            activeId={activeId} setActiveId={setActiveId}
            snap={tweaks.snap} showHeatmap={tweaks.showHeatmap}
          />
        </div>

        {/* Reasoning side */}
        <ReasonPanel
          preset={preset}
          placements={placements} setPlacements={setPlacements}
          reasons={reasons} setReasons={setReasons}
          activeId={activeId} setActiveId={setActiveId}
          allReasoned={allReasoned}
          onSubmit={()=>setSubmitted(true)}
          openTextbook={(para)=>{ setFocusPara(para||null); setTextbookOpen(true); }}
        />

        {/* Textbook drawer (right edge — collapsed by default) */}
        <Textbook
          open={textbookOpen}
          setOpen={setTextbookOpen}
          activeId={activeId}
          focusPara={focusPara}
          setFocusPara={setFocusPara}
        />
      </div>

      {submitted && <SubmittedOverlay onClose={()=>setSubmitted(false)} preset={preset} placements={placements} reasons={reasons}/>}

      {/* Tweaks panel */}
      <TweaksPanelHost tweaks={tweaks} setTweak={setTweak}/>

    </div>
  );
}

/* ───────────────────────  SUBMITTED OVERLAY  ───────────────────────── */
function SubmittedOverlay({onClose,preset,placements,reasons}){
  const items = preset.items.filter(it=>placements[it.id]);
  return (
    <div style={{
      position:'fixed',inset:0,background:'rgba(28,28,26,.45)',display:'flex',
      alignItems:'center',justifyContent:'center',zIndex:1000,padding:32,
    }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:'var(--surface)',borderRadius:'var(--r-card-lg)',
        padding:'28px 32px',maxWidth:520,width:'100%',
        boxShadow:'0 20px 60px rgba(0,0,0,.25)',
      }}>
        <div style={{fontSize:'var(--fs-label)',color:'var(--green)',fontWeight:700,letterSpacing:'.5px',textTransform:'uppercase',marginBottom:6}}>Submitted</div>
        <h2 style={{fontSize:'var(--fs-h1)',fontWeight:700,letterSpacing:'-.3px',marginBottom:'var(--sp-3)'}}>Your map is on the board.</h2>
        <p style={{fontSize:'var(--fs-body)',color:'var(--t2)',lineHeight:1.6,marginBottom:'var(--sp-5)',textWrap:'pretty'}}>
          The teacher will overlay all {items.length}-item maps on the projector. Be ready to defend a placement that disagrees with the class average — that's where the real learning happens.
        </p>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{
            padding:'10px 18px',borderRadius:'var(--r-input)',border:'1px solid var(--border-strong, rgba(28,28,26,.14))',
            background:'var(--surface)',color:'var(--t1)',fontSize:'var(--fs-body)',fontWeight:600,
            cursor:'pointer',fontFamily:'inherit',
          }}>Edit map</button>
          <button onClick={onClose} style={M.submitBtn}>Continue</button>
        </div>
      </div>
    </div>
  );
}
