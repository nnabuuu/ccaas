/* ═══════════════════════════════════════════════════════════
   Teacher Console v7 — Root App
   Three-column layout: Sidebar | Main | Right Panel
   ═══════════════════════════════════════════════════════════ */

function TeacherApp() {
  const [view, setView] = useState('main');
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [activeDiscussComp, setActiveDiscussComp] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const handleCompClick = (comp) => {
    if (comp.type === 'discuss' && (comp.status === 'active' || comp.status === 'done')) {
      setActiveDiscussComp(comp.id);
      setView('discuss-class');
    }
  };

  const handleSelectStep = (stepId) => {
    setSelectedStepId(stepId);
    setView('main');
    setSelectedSignal(null);
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setView('discuss-student');
  };

  const backToMain = () => { setView('main'); setActiveDiscussComp(null); setSelectedStudent(null); };
  const backToDiscussClass = () => { setView('discuss-class'); setSelectedStudent(null); };

  return React.createElement('div', { style:{ display:'flex', flexDirection:'column', height:'100vh' } },

    /* ═══ TOP BAND ═══ */
    React.createElement('div', { style:{ display:'flex', alignItems:'center', height:44, padding:'0 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 } },
      React.createElement('div', { style:{ width:22, height:22, borderRadius:6, background:'var(--t1)', color:'var(--surface)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700 } }, 'R'),
      React.createElement('div', { style:{ fontSize:13, fontWeight:600, letterSpacing:'-.1px' } }, '课堂观察台'),
      React.createElement('div', { style:{ fontSize:10, fontWeight:600, color:'var(--teal)', background:'var(--teal-soft)', padding:'2px 8px', borderRadius:3 } }, '观察模式'),
      React.createElement('div', { style:{ fontSize:10, fontWeight:600, color:'var(--ai)', background:'var(--ai-soft)', padding:'2px 8px', borderRadius:3 } }, '学生自主推进'),
      React.createElement('div', { style:{ fontSize:12, color:'var(--t2)', paddingLeft:12, borderLeft:'1px solid var(--border-strong)', marginLeft:2 } }, '高一(3)班 · Ideal Beauty · 42 人 · 5 Tasks'),
      React.createElement('div', { style:{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, color:'var(--green)' } },
        React.createElement('span', { style:{ width:6, height:6, borderRadius:'50%', background:'var(--green-dot)', animation:'pulse-dot 2s infinite' } }),
        '实时同步中',
      ),
    ),

    /* ═══ TIMELINE ═══ */
    React.createElement('div', { style:{ display:'flex', alignItems:'center', height:40, padding:'0 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 } },
      React.createElement('div', { style:{ fontSize:12, fontWeight:700, color:'var(--t1)', minWidth:42, textAlign:'center' } }, '18:22'),
      React.createElement('div', { style:{ flex:1, position:'relative', height:24, display:'flex', alignItems:'center' } },
        React.createElement('div', { style:{ width:'100%', height:6, background:'var(--surface2)', borderRadius:3, position:'relative' } },
          [20,40,60,80].map(p => React.createElement('div', { key:p, style:{ position:'absolute', top:'50%', transform:'translate(-50%,-50%)', left:`${p}%`, width:2, height:12, borderRadius:1, background:'var(--t1)', opacity:0.12 } })),
          React.createElement('div', { style:{ height:'100%', borderRadius:3, background:'var(--t1)', position:'absolute', top:0, left:0, width:'40.8%' } }),
        ),
        React.createElement('div', { style:{ width:14, height:14, borderRadius:'50%', background:'var(--t1)', border:'2px solid var(--surface)', boxShadow:'0 1px 4px rgba(0,0,0,.2)', position:'absolute', top:'50%', transform:'translate(-50%,-50%)', left:'40.8%', cursor:'grab', zIndex:2 } }),
      ),
      React.createElement('div', { style:{ fontSize:12, color:'var(--t3)', minWidth:42, textAlign:'center' } }, '45:00'),
      React.createElement('div', { style:{ fontSize:10, color:'var(--green)', fontWeight:500, background:'var(--surface2)', padding:'2px 8px', borderRadius:3 } }, '● 实时'),
    ),

    /* ═══ TIMELINE ═══ */
    React.createElement('div', { style:{ display:'flex', alignItems:'center', height:40, padding:'0 24px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0, gap:12 } },
      React.createElement('div', { style:{ fontSize:12, fontWeight:700, color:'var(--t1)', minWidth:42, textAlign:'center' } }, '18:22'),
      React.createElement('div', { style:{ flex:1, position:'relative', height:24, display:'flex', alignItems:'center' } },
        React.createElement('div', { style:{ width:'100%', height:6, background:'var(--surface2)', borderRadius:3, position:'relative' } },
          [20,40,60,80].map(p => React.createElement('div', { key:p, style:{ position:'absolute', top:'50%', transform:'translate(-50%,-50%)', left:`${p}%`, width:2, height:12, borderRadius:1, background:'var(--t1)', opacity:0.12 } })),
          React.createElement('div', { style:{ height:'100%', borderRadius:3, background:'var(--t1)', position:'absolute', top:0, left:0, width:'40.8%' } }),
        ),
        React.createElement('div', { style:{ width:14, height:14, borderRadius:'50%', background:'var(--t1)', border:'2px solid var(--surface)', boxShadow:'0 1px 4px rgba(0,0,0,.2)', position:'absolute', top:'50%', transform:'translate(-50%,-50%)', left:'40.8%', cursor:'grab', zIndex:2 } }),
      ),
      React.createElement('div', { style:{ fontSize:12, color:'var(--t3)', minWidth:42, textAlign:'center' } }, '45:00'),
      React.createElement('div', { style:{ fontSize:10, color:'var(--green)', fontWeight:500, background:'var(--surface2)', padding:'2px 8px', borderRadius:3 } }, '● 实时'),
    ),

    /* ═══ THREE-COLUMN BODY ═══ */
    React.createElement('div', { style:{ flex:1, display:'flex', minHeight:0 } },

      /* Left Sidebar — always visible */
      React.createElement(StepSidebar, { selectedStepId, onSelectStep: handleSelectStep }),

      /* Main + Right */
      view === 'main' ? React.createElement(Fragment, null,
        React.createElement(MainContent, { selectedStepId, selectedSignal, onCompClick: handleCompClick }),
        React.createElement(RightPanelV7, { selectedStepId, selectedSignal, onSelectSignal: setSelectedSignal }),
      )
      : view === 'discuss-class' ? React.createElement(Fragment, null,
        React.createElement('div', { style:{ flex:1, overflow:'hidden' } },
          React.createElement(DiscussClassView, { componentId: activeDiscussComp, onSelectStudent: handleSelectStudent, onBack: backToMain }),
        ),
        React.createElement(RightPanelV7, { selectedStepId, selectedSignal, onSelectSignal: setSelectedSignal }),
      )
      : React.createElement(DiscussStudentView, { student: selectedStudent, onBack: backToDiscussClass }),
    ),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(TeacherApp));
