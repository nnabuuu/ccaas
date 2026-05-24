/* Architecture Map — Main App + Navigation */

const NAV = [
  { group: '总览', items: [
    { id: 'pipeline', label: '通路概览', color: 'var(--t1)' },
    { id: 'structure', label: '项目结构', color: 'var(--t1)' },
    { id: 'tabs', label: 'Tab 体系', color: 'var(--t1)' },
  ]},
  { group: '设计阶段', items: [
    { id: 'plan', label: '教案设计', color: 'var(--teal)' },
    { id: 'execution', label: '执行设计', color: 'var(--blue)' },
  ]},
  { group: '执行阶段', items: [
    { id: 'runtime', label: '学生端 Runtime', color: 'var(--green)' },
    { id: 'observation', label: '教师 Observation', color: 'var(--amber)' },
  ]},
  { group: '协作与审计', items: [
    { id: 'agent', label: 'Agent 协作', color: 'var(--coral)' },
    { id: 'review', label: 'Review 审计', color: 'var(--purple)' },
    { id: 'dataflow', label: '数据流总览', color: 'var(--t1)' },
  ]},
];

function Nav({ activeId }) {
  const handleClick = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="arch-nav">
      <div className="nav-logo">
        <div className="mark">J</div>
        <div className="wm">Jijian 架构</div>
      </div>

      {NAV.map((g, gi) => (
        <React.Fragment key={gi}>
          <div className="nav-group">{g.group}</div>
          {g.items.map(item => (
            <div key={item.id}
                 className={`nav-item ${activeId === item.id ? 'active' : ''}`}
                 onClick={() => handleClick(item.id)}>
              <span className="ni" style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
        </React.Fragment>
      ))}

      <div className="nav-spacer" />
      <div className="nav-meta">
        课程项目架构设计<br />
        高密度参考文档<br />
        <span style={{ fontSize: 9, opacity: .6 }}>Based on architecture-v1.md</span>
      </div>
    </nav>
  );
}

function App() {
  const [activeId, setActiveId] = useState('pipeline');
  const mainRef = useRef(null);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const allIds = NAV.flatMap(g => g.items.map(i => i.id));

    const handleScroll = () => {
      const scrollTop = main.scrollTop;
      let current = allIds[0];
      for (const id of allIds) {
        const el = document.getElementById(id);
        if (el && el.offsetTop - main.offsetTop <= scrollTop + 120) {
          current = id;
        }
      }
      setActiveId(current);
    };

    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="arch-shell">
      <Nav activeId={activeId} />
      <main className="arch-main" ref={mainRef}>
        <PipelineOverview />
        <ProjectStructure />
        <TabSystemPrototype />
        <PlanDeepDive />
        <ExecutionDeepDive />
        <StudentRuntime />
        <TeacherObservation />
        <AgentCollaboration />
        <ReviewAudit />
        <DataFlowOverview />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
