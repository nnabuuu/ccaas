/* ════════════════════════════════════════════════
   Creator v3 — Main App + Project Tab System + Execution Canvas
   ════════════════════════════════════════════════ */

const STEP_COLORS = ['var(--teal)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--green)'];

const PROJECT_TABS = [
  { id: 'files', label: '文件系统', icon: '📁', group: 'platform' },
  { id: 'skills', label: 'Skills', icon: '⚙️', group: 'platform' },
  { id: 'plan', label: '教案设计', icon: '📝', group: 'solution' },
  { id: 'exec', label: '执行设计', icon: '🧩', group: 'solution' },
  { id: 'review', label: 'Review', icon: '👁', group: 'review' },
];

function CreatorV3App() {
  const [activeProjectTab, setActiveProjectTab] = React.useState('exec');
  const [lesson, setLesson] = React.useState(LESSON_V3);
  const [selectedBlock, setSelectedBlock] = React.useState('b7');
  const [activeEditorTab, setActiveEditorTab] = React.useState('content');
  const [aiCollapsed, setAiCollapsed] = React.useState(false);
  const [aiMessages] = React.useState([
    { role: 'ai', text: '已分析课程项目。教案定义了 5 项教学要求，执行设计包含 5 个 Step / 13 个模块。\n\nReview 审计: 所有教学要求已覆盖。建议 Step 3 的 Discussion 模块 completion rubric 增加"引用课文外例子"以提高思维品质目标覆盖。' },
  ]);

  const toggleCollapse = (stepId) => {
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, collapsed: !s.collapsed } : s),
    }));
  };

  let selectedBlockData = null;
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === selectedBlock);
    if (found) { selectedBlockData = found; break; }
  }

  const totalBlocks = lesson.steps.reduce((sum, s) => sum + s.blocks.length, 0);
  const observeBlocks = lesson.steps.reduce((sum, s) => sum + s.blocks.filter(b => {
    const reg = COMP_REG[b.type]; return reg?.hasObserve && (b.observe?.metrics || []).some(m => m.enabled);
  }).length, 0);

  const showBlockPanel = activeProjectTab === 'exec' && selectedBlockData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ══ Top Bar ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 48, padding: '0 20px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 12, zIndex: 50,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: 'var(--t1)', color: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
        }}>J</div>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -.2 }}>精准教学</span>
        <div style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 4px' }}></div>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.3 }}>{lesson.title}</span>
        <Badge color="teal">{lesson.subject}</Badge>
        <Badge>{lesson.grade}</Badge>
        <Badge color="blue">{lesson.classGroup}</Badge>
        <div style={{ flex: 1 }}></div>
        <Btn variant="ghost" small>帮助</Btn>
        <Btn variant="primary" small>预览课程</Btn>
      </div>

      {/* ══ Project Tab Bar ══ */}
      <div className="proj-tabs">
        <div className="proj-tab-group">
          <span className="proj-tab-group-label">平台层</span>
          {PROJECT_TABS.filter(t => t.group === 'platform').map(t => (
            <button key={t.id} className={`proj-tab ${activeProjectTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveProjectTab(t.id)}>
              <span className="pt-icon">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
        <div className="proj-tab-sep"></div>
        <div className="proj-tab-group">
          <span className="proj-tab-group-label">方案层</span>
          {PROJECT_TABS.filter(t => t.group === 'solution').map(t => (
            <button key={t.id} className={`proj-tab ${activeProjectTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveProjectTab(t.id)}>
              <span className="pt-icon">{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
        <button className={`proj-tab proj-tab-review ${activeProjectTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveProjectTab('review')}>
          <span className="pt-icon">👁</span> Review
        </button>
      </div>

      {/* ══ Main Content ══ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* AI Chat (persistent across tabs) */}
        {!aiCollapsed ? (
          <div style={{
            width: 280, flexShrink: 0, borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface)',
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'linear-gradient(135deg, rgba(236,234,254,.2), transparent)',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 6, background: 'var(--purple)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
              }}>✦</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', flex: 1 }}>AI 助手</span>
              <span onClick={() => setAiCollapsed(true)} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 12 }}>◀</span>
            </div>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['分析覆盖', 'Review 审计', '优化 rubric', '生成教案'].map(cmd => (
                <button key={cmd} style={{
                  fontSize: 9, padding: '3px 8px', borderRadius: 12,
                  border: '1px solid rgba(58,49,133,.2)', background: 'var(--purple-bg)', color: 'var(--purple)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{cmd}</button>
              ))}
            </div>
            <div className="scr" style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aiMessages.map((msg, i) => (
                <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
                  <div style={{
                    padding: '9px 12px', borderRadius: 10, fontSize: 11, lineHeight: 1.6,
                    background: msg.role === 'user' ? 'var(--t1)' : 'var(--purple-bg)',
                    color: msg.role === 'user' ? 'var(--surface)' : 'var(--purple)',
                    whiteSpace: 'pre-wrap',
                  }}>{msg.text}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input placeholder="描述修改或提问..." style={{
                flex: 1, padding: '7px 12px', fontSize: 11, fontFamily: 'inherit',
                border: '1px solid var(--border)', borderRadius: 'var(--r-input-lg)',
                background: 'var(--surface)', outline: 'none', color: 'var(--t1)',
              }} />
              <Btn variant="primary" small>发送</Btn>
            </div>
          </div>
        ) : (
          <div style={{
            width: 44, flexShrink: 0, borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, background: 'var(--surface)',
          }}>
            <div onClick={() => setAiCollapsed(false)} style={{
              width: 30, height: 30, borderRadius: 6, background: 'var(--purple)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>✦</div>
          </div>
        )}

        {/* Tab content area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {activeProjectTab === 'files' && <FileSystemTab />}
          {activeProjectTab === 'skills' && <SkillsTab />}
          {activeProjectTab === 'plan' && <PlanTab />}
          {activeProjectTab === 'review' && <ReviewTab />}
          {activeProjectTab === 'exec' && (
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Execution canvas */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Meta bar */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 24px',
                  borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>模块列表</span>
                  <div style={{ flex: 1 }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--t3)' }}>
                    <span>{totalBlocks} 组件</span>
                    <span style={{ width: 1, height: 12, background: 'var(--border)' }}></span>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>📊 {observeBlocks} 观察</span>
                  </div>
                </div>
                {/* Timeline */}
                <div style={{ display: 'flex', gap: 2, height: 5, margin: '0 24px', marginTop: 14, borderRadius: 3, overflow: 'hidden' }}>
                  {lesson.steps.map((step, i) => (
                    <div key={step.id} style={{ flex: step.duration, background: STEP_COLORS[i % STEP_COLORS.length], opacity: .3, position: 'relative' }}>
                      <span style={{ position: 'absolute', top: 8, left: 0, fontSize: 9, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                        {step.title} · {step.duration}min
                      </span>
                    </div>
                  ))}
                </div>
                {/* Steps + blocks */}
                <div className="scr" style={{ flex: 1, padding: '30px 24px 40px' }}>
                  {lesson.steps.map((step, si) => (
                    <StepSection key={step.id} step={step} stepIndex={si}
                      selectedBlock={selectedBlock}
                      onSelectBlock={(id) => { setSelectedBlock(id); setActiveEditorTab('content'); }}
                      onToggleCollapse={() => toggleCollapse(step.id)} />
                  ))}
                </div>
              </div>
              {/* Block editor panel */}
              {selectedBlockData && (
                <BlockEditorPanel block={selectedBlockData} activeTab={activeEditorTab}
                  onTabChange={setActiveEditorTab} onClose={() => setSelectedBlock(null)} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Step Section ── */
function StepSection({ step, stepIndex, selectedBlock, onSelectBlock, onToggleCollapse }) {
  const color = STEP_COLORS[stepIndex % STEP_COLORS.length];
  return (
    <div style={{ marginBottom: 12 }}>
      <div onClick={onToggleCollapse} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'var(--surface)',
        borderRadius: step.collapsed ? 'var(--r-card)' : 'var(--r-card) var(--r-card) 0 0',
        border: '1px solid var(--border)', cursor: 'pointer',
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6, background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>{stepIndex + 1}</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{step.title}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.type}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.blocks.length} 组件 · {step.duration}min</span>
        <span style={{ fontSize: 10, color: 'var(--t3)', transform: step.collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform .15s' }}>▾</span>
      </div>
      {!step.collapsed && (
        <div style={{
          border: '1px solid var(--border)', borderTop: 'none',
          borderRadius: '0 0 var(--r-card) var(--r-card)', background: 'var(--bg)', padding: 8,
        }}>
          {step.blocks.map(block => (
            <BlockItem key={block.id} block={block} isSelected={selectedBlock === block.id} onSelect={() => onSelectBlock(block.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Block Item ── */
function BlockItem({ block, isSelected, onSelect }) {
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
      <span style={{ fontSize: 10, color: 'var(--t3)', cursor: 'grab', opacity: hovered ? 1 : 0, transition: 'opacity .1s' }}>⋮⋮</span>
      <span style={{
        width: 28, height: 28, borderRadius: 'var(--r-input)', background: reg.bg, color: reg.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
      }}>{reg.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{block.title}</div>
        <div style={{ fontSize: 10, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.desc}</div>
      </div>
      {/* AI fields indicator */}
      {block.ai && (
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>AI</span>
      )}
      {enabledMetrics.length > 0 && (
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>📊{enabledMetrics.length}</span>
      )}
      {rulesCount > 0 && (
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>⚡{rulesCount}</span>
      )}
      {/* Completion badge */}
      {compType && (
        <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
          background: comp.type === 'ai_eval' ? 'var(--purple-bg)' : comp.type === 'hard' ? 'var(--green-bg)' : 'var(--surface2)',
          color: comp.type === 'ai_eval' ? 'var(--purple)' : comp.type === 'hard' ? 'var(--green)' : 'var(--t3)',
        }}>{compType.icon}</span>
      )}
      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: reg.bg, color: reg.color, flexShrink: 0 }}>
        {reg.label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{block.duration}min</span>
    </div>
  );
}

/* ── Block Editor Panel ── */
function BlockEditorPanel({ block, activeTab, onTabChange, onClose }) {
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
      width: 400, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface)',
    }}>
      <div style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 6, background: reg.bg, color: reg.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        }}>{reg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.title}</div>
          <div style={{ fontSize: 9, color: reg.color }}>{reg.label}</div>
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

Object.assign(window, { CreatorV3App });
