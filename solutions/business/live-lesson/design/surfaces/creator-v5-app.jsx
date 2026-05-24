/* ════════════════════════════════════════════════
   Creator v5 — Main App: AI Assistant always visible on right
   ════════════════════════════════════════════════ */

const STEP_COLORS_V5 = ['var(--teal)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--green)'];

function CreatorV5App() {
  const [activeTab, setActiveTab] = React.useState('exec');
  const [lesson, setLesson] = React.useState(LESSON_V4);
  const [selectedBlock, setSelectedBlock] = React.useState('b7');
  const [activeEditorTab, setActiveEditorTab] = React.useState('content');
  const [filesPanelCollapsed, setFilesPanelCollapsed] = React.useState(false);
  const [activeFile, setActiveFile] = React.useState(null);

  const toggleCollapse = (stepId) => {
    setLesson(prev => ({ ...prev, steps: prev.steps.map(s => s.id === stepId ? { ...s, collapsed: !s.collapsed } : s) }));
  };

  const handleNavigate = (tab, blockId) => {
    setActiveTab(tab);
    if (blockId) setSelectedBlock(blockId);
  };

  let selectedBlockData = null;
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === selectedBlock);
    if (found) { selectedBlockData = found; break; }
  }

  const totalBlocks = lesson.steps.reduce((s, st) => s + st.blocks.length, 0);
  const refBlocks = lesson.steps.reduce((s, st) => s + st.blocks.filter(b => b.$ref).length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ══ Top Bar ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 48, padding: '0 16px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 10, zIndex: 50,
      }}>
        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--t1)', color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>J</div>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -.2 }}>精准教学</span>
        <div style={{ width: 1, height: 20, background: 'var(--border)' }}></div>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.3 }}>{lesson.title}</span>
        <Badge color="teal">{lesson.subject}</Badge>
        <Badge>{lesson.grade}</Badge>
        <div style={{ flex: 1 }}></div>
        <Btn variant="primary" small>预览课程</Btn>
      </div>

      {/* ══ Primary Tab Bar ══ */}
      <div className="ptabs">
        <button className={`ptab ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>
          <span className="pt-dot" style={{ background: 'var(--teal)' }}></span> 教案设计
        </button>
        <button className={`ptab ${activeTab === 'exec' ? 'active' : ''}`} onClick={() => setActiveTab('exec')}>
          <span className="pt-dot" style={{ background: 'var(--blue)' }}></span> 执行设计
        </button>
        <div className="ptab-sep"></div>
        <button className={`ptab ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')} style={{ fontSize: 11 }}>
          ⚙️ Skills
        </button>
        <button className={`ptab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')} style={{ fontSize: 11 }}>
          👁 Review
        </button>
      </div>

      {/* ══ Body — three-zone layout ══ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: File sidebar */}
        <FilePanel
          collapsed={filesPanelCollapsed}
          onToggle={() => setFilesPanelCollapsed(!filesPanelCollapsed)}
          activeFile={activeFile}
          onFileClick={setActiveFile}
          onNavigate={handleNavigate}
        />

        {/* Center: Tab content + block editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          {activeTab === 'plan' && <PlanTab />}
          {activeTab === 'skills' && <SkillsTab />}
          {activeTab === 'review' && <ReviewTab />}
          {activeTab === 'exec' && (
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              <ExecCanvasV5 lesson={lesson} selectedBlock={selectedBlock}
                onSelectBlock={(id) => { setSelectedBlock(id); setActiveEditorTab('content'); }}
                onToggleCollapse={toggleCollapse} totalBlocks={totalBlocks} refBlocks={refBlocks} />
              {selectedBlockData && (
                <BlockEditorPanelV5 block={selectedBlockData} activeTab={activeEditorTab}
                  onTabChange={setActiveEditorTab} onClose={() => setSelectedBlock(null)} />
              )}
            </div>
          )}
        </div>

        {/* Right: AI Assistant — always visible */}
        <AIAssistantPanel
          activeTab={activeTab}
          selectedBlock={selectedBlock}
          lesson={lesson}
          onNavigate={handleNavigate}
        />
      </div>
    </div>
  );
}

/* ── Execution Canvas (v5) ── */
function ExecCanvasV5({ lesson, selectedBlock, onSelectBlock, onToggleCollapse, totalBlocks, refBlocks }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 24px',
        borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>模块列表</span>
        <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'ui-monospace, monospace' }}>manifest.json</span>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{totalBlocks} 模块</span>
        <span style={{ width: 1, height: 12, background: 'var(--border)' }}></span>
        <span style={{ fontSize: 10, color: 'var(--blue)', fontWeight: 600 }}>🔗 {refBlocks} ref</span>
      </div>
      <div style={{ display: 'flex', gap: 2, height: 5, margin: '0 24px', marginTop: 14, borderRadius: 3, overflow: 'hidden' }}>
        {lesson.steps.map((step, i) => (
          <div key={step.id} style={{ flex: step.duration, background: STEP_COLORS_V5[i % STEP_COLORS_V5.length], opacity: .3, position: 'relative' }}>
            <span style={{ position: 'absolute', top: 8, left: 0, fontSize: 9, color: 'var(--t3)', whiteSpace: 'nowrap' }}>{step.title} · {step.duration}min</span>
          </div>
        ))}
      </div>
      <div className="scr" style={{ flex: 1, padding: '30px 24px 40px' }}>
        {lesson.steps.map((step, si) => (
          <StepSectionV5 key={step.id} step={step} stepIndex={si} selectedBlock={selectedBlock}
            onSelectBlock={onSelectBlock} onToggleCollapse={() => onToggleCollapse(step.id)} />
        ))}
      </div>
    </div>
  );
}

/* ── Step Section (v5) ── */
function StepSectionV5({ step, stepIndex, selectedBlock, onSelectBlock, onToggleCollapse }) {
  const color = STEP_COLORS_V5[stepIndex % STEP_COLORS_V5.length];
  return (
    <div style={{ marginBottom: 12 }}>
      <div onClick={onToggleCollapse} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface)',
        borderRadius: step.collapsed ? 'var(--r-card)' : 'var(--r-card) var(--r-card) 0 0',
        border: '1px solid var(--border)', cursor: 'pointer',
      }}>
        <span style={{ width: 24, height: 24, borderRadius: 6, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{stepIndex + 1}</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{step.title}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.type}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.blocks.length} 模块 · {step.duration}min</span>
        <span style={{ fontSize: 10, color: 'var(--t3)', transform: step.collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform .15s' }}>▾</span>
      </div>
      {!step.collapsed && (
        <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--r-card) var(--r-card)', background: 'var(--bg)', padding: 8 }}>
          {step.blocks.map(block => (
            <BlockItemV5 key={block.id} block={block} isSelected={selectedBlock === block.id} onSelect={() => onSelectBlock(block.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Block Item (v5) ── */
function BlockItemV5({ block, isSelected, onSelect }) {
  const reg = COMP_REG[block.type] || COMP_REG.explain;
  const [hovered, setHovered] = React.useState(false);
  const enabledMetrics = (block.observe?.metrics || []).filter(m => m.enabled);
  const rulesCount = (block.observe?.rules || []).length;
  const comp = block.completion || {};
  const compType = COMPLETION_TYPES.find(c => c.id === comp.type);

  return (
    <div onClick={onSelect} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4,
        borderRadius: 'var(--r-input)',
        background: isSelected ? 'var(--surface)' : hovered ? 'rgba(251,250,247,.6)' : 'transparent',
        border: isSelected ? '1px solid var(--t1)' : '1px solid transparent',
        cursor: 'pointer', transition: 'all .1s',
      }}>
      <span style={{ fontSize: 10, color: 'var(--t3)', cursor: 'grab', opacity: hovered ? 1 : 0, transition: 'opacity .1s', flexShrink: 0 }}>⋮⋮</span>
      <span style={{
        width: 28, height: 28, borderRadius: 'var(--r-input)', background: reg.bg, color: reg.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
      }}>{reg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{block.title}</span>
          {block.$ref && (
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
              background: 'var(--blue-bg)', color: 'var(--blue)', fontFamily: 'ui-monospace, monospace',
            }} title={block.$ref}>🔗 ref</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {block.$ref ? (
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9 }}>{block.$ref}</span>
          ) : block.desc}
        </div>
      </div>
      {block.ai && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>AI</span>}
      {enabledMetrics.length > 0 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>📊{enabledMetrics.length}</span>}
      {rulesCount > 0 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>⚡{rulesCount}</span>}
      {compType && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
        background: comp.type === 'ai_eval' ? 'var(--purple-bg)' : comp.type === 'hard' ? 'var(--green-bg)' : 'var(--surface2)',
        color: comp.type === 'ai_eval' ? 'var(--purple)' : comp.type === 'hard' ? 'var(--green)' : 'var(--t3)',
      }}>{compType.icon}</span>}
      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: reg.bg, color: reg.color, flexShrink: 0 }}>{reg.label}</span>
      <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{block.duration}min</span>
    </div>
  );
}

/* ── Block Editor Panel (v5 — slightly narrower to make room) ── */
function BlockEditorPanelV5({ block, activeTab, onTabChange, onClose }) {
  const reg = COMP_REG[block.type] || COMP_REG.explain;
  const TABS = [
    { id: 'content', label: '内容', icon: '✎' },
    { id: 'observe', label: '观察', icon: '📊', disabled: !reg.hasObserve },
    { id: 'rules', label: '规则', icon: '⚡', disabled: !reg.hasObserve },
    { id: 'preview', label: '预览', icon: '👁', disabled: !reg.hasObserve },
  ];
  const tab = TABS.find(t => t.id === activeTab && !t.disabled) ? activeTab : 'content';

  return (
    <div style={{
      width: 380, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface)',
    }}>
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ width: 26, height: 26, borderRadius: 6, background: reg.bg, color: reg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{reg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: reg.color }}>{reg.label}</span>
            {block.$ref && (
              <span style={{ fontSize: 8, fontFamily: 'ui-monospace, monospace', color: 'var(--blue)', background: 'var(--blue-bg)', padding: '0 4px', borderRadius: 2 }}>
                🔗 {block.$ref}
              </span>
            )}
          </div>
        </div>
        <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 14, padding: '2px 4px' }}>✕</span>
      </div>
      <div style={{ display: 'flex', gap: 0, padding: '0 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => !t.disabled && onTabChange(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '9px 12px', fontSize: 11,
            fontWeight: tab === t.id ? 600 : 400, fontFamily: 'inherit',
            cursor: t.disabled ? 'default' : 'pointer',
            color: t.disabled ? 'var(--border)' : tab === t.id ? 'var(--t1)' : 'var(--t3)',
            background: 'none', border: 'none',
            borderBottom: tab === t.id ? '2px solid var(--t1)' : '2px solid transparent',
            opacity: t.disabled ? .4 : 1,
          }}>
            <span style={{ fontSize: 11 }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {tab === 'content' && <ContentTab block={block} />}
        {tab === 'observe' && <ObserveTab block={block} />}
        {tab === 'rules' && <RulesTab block={block} />}
        {tab === 'preview' && <PreviewTab block={block} />}
      </div>
    </div>
  );
}

Object.assign(window, { CreatorV5App });
