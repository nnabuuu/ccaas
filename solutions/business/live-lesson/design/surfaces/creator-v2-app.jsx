/* ════════════════════════════════════════════════
   Creator v2 — Main App + Lesson Canvas
   ════════════════════════════════════════════════ */

const STEP_COLORS = ['var(--teal)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--green)'];

function CreatorV2App() {
  const [lesson, setLesson] = React.useState(LESSON_V2);
  const [selectedBlock, setSelectedBlock] = React.useState('b7');
  const [activeTab, setActiveTab] = React.useState('content');
  const [aiCollapsed, setAiCollapsed] = React.useState(false);
  const [aiMessages] = React.useState([
    { role: 'ai', text: '已分析课程结构。当前 5 个 Step 包含 13 个组件，其中 8 个配置了观察维度，5 个设置了 AI 干预规则。\n\n建议：Step 3 的 Discuss 组件可增加"术语混淆"观察维度，针对 tā moko/tattoos 混淆问题。' },
  ]);

  const toggleCollapse = (stepId) => {
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, collapsed: !s.collapsed } : s),
    }));
  };

  // Find selected block
  let selectedBlockData = null;
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === selectedBlock);
    if (found) { selectedBlockData = found; break; }
  }

  const totalBlocks = lesson.steps.reduce((sum, s) => sum + s.blocks.length, 0);
  const observeBlocks = lesson.steps.reduce((sum, s) => sum + s.blocks.filter(b => {
    const reg = COMP_REG[b.type];
    return reg?.hasObserve && (b.observe?.metrics || []).some(m => m.enabled);
  }).length, 0);
  const totalRules = lesson.steps.reduce((sum, s) => sum + s.blocks.reduce((rs, b) => rs + (b.observe?.rules || []).length, 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* ══ Top Bar ══ */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 48, padding: '0 20px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexShrink: 0, gap: 12, zIndex: 50,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, background: 'var(--t1)', color: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
        }}>E</div>
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: -.2 }}>创作中心</span>
        <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
          <button style={navBtn(false)}>模板库</button>
          <button style={navBtn(true)}>课程构建</button>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Btn variant="ghost" small>帮助</Btn>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* ══ LEFT: AI Chat (collapsible) ══ */}
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
            {/* Quick actions */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['分析观察覆盖', '优化 AI 规则', '生成观察报告模板', '检查阈值设置'].map(cmd => (
                <button key={cmd} style={{
                  fontSize: 9, padding: '3px 8px', borderRadius: 12,
                  border: '1px solid rgba(58,49,133,.2)', background: 'var(--purple-bg)', color: 'var(--purple)',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{cmd}</button>
              ))}
            </div>
            {/* Messages */}
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
            {/* Input */}
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
            display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10,
            background: 'var(--surface)',
          }}>
            <div onClick={() => setAiCollapsed(false)} style={{
              width: 30, height: 30, borderRadius: 6, background: 'var(--purple)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>✦</div>
          </div>
        )}

        {/* ══ CENTER: Lesson Canvas ══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Lesson Meta Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px',
            borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
          }}>
            <input value={lesson.title} readOnly style={{
              fontSize: 16, fontWeight: 700, border: 'none', background: 'transparent',
              fontFamily: 'inherit', color: 'var(--t1)', outline: 'none', padding: 0, width: 140,
            }} />
            <Badge color="teal">{lesson.subject}</Badge>
            <Badge>{lesson.grade}</Badge>
            <Badge color="blue">{lesson.classGroup}</Badge>
            <div style={{ flex: 1 }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--t3)' }}>
              <span>{totalBlocks} 组件</span>
              <span style={{ width: 1, height: 12, background: 'var(--border)' }}></span>
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>📊 {observeBlocks} 观察</span>
              <span style={{ width: 1, height: 12, background: 'var(--border)' }}></span>
              <span style={{ color: 'var(--purple)', fontWeight: 600 }}>⚡ {totalRules} 规则</span>
            </div>
            <Btn variant="primary" small>预览课程</Btn>
          </div>

          {/* Timeline bar */}
          <div style={{ display: 'flex', gap: 2, height: 5, margin: '0 24px', marginTop: 16, borderRadius: 3, overflow: 'hidden' }}>
            {lesson.steps.map((step, i) => (
              <div key={step.id} style={{
                flex: step.duration, background: STEP_COLORS[i % STEP_COLORS.length], opacity: .3,
                position: 'relative',
              }}>
                <span style={{ position: 'absolute', top: 8, left: 0, fontSize: 9, color: 'var(--t3)', whiteSpace: 'nowrap' }}>
                  {step.title} · {step.duration}min
                </span>
              </div>
            ))}
          </div>

          {/* Steps + Blocks */}
          <div className="scr" style={{ flex: 1, padding: '30px 24px 40px' }}>
            {lesson.steps.map((step, si) => (
              <StepSection key={step.id} step={step} stepIndex={si}
                selectedBlock={selectedBlock}
                onSelectBlock={(id) => { setSelectedBlock(id); setActiveTab('content'); }}
                onToggleCollapse={() => toggleCollapse(step.id)}
              />
            ))}
          </div>
        </div>

        {/* ══ RIGHT: Block Editor (tabbed) ══ */}
        {selectedBlockData && (
          <BlockEditorPanel
            block={selectedBlockData}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={() => setSelectedBlock(null)}
          />
        )}
      </div>
    </div>
  );
}

function navBtn(active) {
  return {
    padding: '6px 14px', fontSize: 12, fontWeight: active ? 600 : 400,
    color: active ? 'var(--t1)' : 'var(--t3)', background: active ? 'var(--surface2)' : 'transparent',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
  };
}

/* ── Step Section ── */
function StepSection({ step, stepIndex, selectedBlock, onSelectBlock, onToggleCollapse }) {
  const color = STEP_COLORS[stepIndex % STEP_COLORS.length];
  const observeCount = step.blocks.filter(b => {
    const reg = COMP_REG[b.type];
    return reg?.hasObserve && (b.observe?.metrics || []).some(m => m.enabled);
  }).length;

  return (
    <div style={{ marginBottom: 12 }}>
      <div onClick={onToggleCollapse} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'var(--surface)',
        borderRadius: step.collapsed ? 'var(--r-card)' : 'var(--r-card) var(--r-card) 0 0',
        border: '1px solid var(--border)',
        borderBottom: step.collapsed ? undefined : '1px solid var(--border)',
        cursor: 'pointer',
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6, background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>{stepIndex + 1}</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{step.title}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.type}</span>
        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.blocks.length} 组件 · {step.duration}min</span>
        {observeCount > 0 && (
          <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', padding: '1px 6px', borderRadius: 8 }}>
            📊 {observeCount}
          </span>
        )}
        <span style={{ fontSize: 10, color: 'var(--t3)', transform: step.collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform .15s' }}>▾</span>
      </div>

      {!step.collapsed && (
        <div style={{
          border: '1px solid var(--border)', borderTop: 'none',
          borderRadius: '0 0 var(--r-card) var(--r-card)',
          background: 'var(--bg)', padding: 8,
        }}>
          {step.blocks.map((block, bi) => (
            <BlockItem key={block.id} block={block}
              isSelected={selectedBlock === block.id}
              onSelect={() => onSelectBlock(block.id)}
            />
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
  const hasObserve = reg.hasObserve && enabledMetrics.length > 0;

  return (
    <div onClick={onSelect}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        marginBottom: 4, borderRadius: 'var(--r-input)',
        background: isSelected ? 'var(--surface)' : hovered ? 'rgba(251,250,247,.6)' : 'transparent',
        border: isSelected ? '1px solid var(--t1)' : '1px solid transparent',
        cursor: 'pointer', transition: 'all .1s',
      }}>
      <span style={{ fontSize: 10, color: 'var(--t3)', cursor: 'grab', opacity: hovered ? 1 : 0, transition: 'opacity .1s' }}>⋮⋮</span>

      <span style={{
        width: 28, height: 28, borderRadius: 'var(--r-input)',
        background: reg.bg, color: reg.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, flexShrink: 0,
      }}>{reg.icon}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 500 }}>{block.title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{block.desc}</span>
        </div>
      </div>

      {/* Observe indicators */}
      {hasObserve && (
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>
          📊{enabledMetrics.length}
        </span>
      )}
      {rulesCount > 0 && (
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>
          ⚡{rulesCount}
        </span>
      )}

      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: reg.bg, color: reg.color, flexShrink: 0 }}>
        {reg.label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{block.duration}min</span>
    </div>
  );
}

/* ── Block Editor Panel (right side) ── */
function BlockEditorPanel({ block, activeTab, onTabChange, onClose }) {
  const reg = COMP_REG[block.type] || COMP_REG.explain;

  const TABS = [
    { id: 'content', label: '内容', icon: '✎' },
    { id: 'observe', label: '观察', icon: '📊', disabled: !reg.hasObserve },
    { id: 'rules', label: '规则', icon: '⚡', disabled: !reg.hasObserve },
    { id: 'preview', label: '预览', icon: '👁', disabled: !reg.hasObserve },
  ];

  // If current tab is disabled for this type, fallback to content
  const tab = TABS.find(t => t.id === activeTab && !t.disabled) ? activeTab : 'content';

  return (
    <div style={{
      width: 400, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 6,
          background: reg.bg, color: reg.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
        }}>{reg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.title}</div>
          <div style={{ fontSize: 9, color: reg.color }}>{reg.label}</div>
        </div>
        <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 14, padding: '2px 4px' }}>✕</span>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 0, padding: '0 16px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => !t.disabled && onTabChange(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '9px 12px', fontSize: 11, fontWeight: tab === t.id ? 600 : 400,
              fontFamily: 'inherit', cursor: t.disabled ? 'default' : 'pointer',
              color: t.disabled ? 'var(--border)' : tab === t.id ? 'var(--t1)' : 'var(--t3)',
              background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--t1)' : '2px solid transparent',
              opacity: t.disabled ? .4 : 1,
              transition: 'all .12s',
            }}>
            <span style={{ fontSize: 11 }}>{t.icon}</span>
            {t.label}
            {/* Badge for observe/rules count */}
            {t.id === 'observe' && !t.disabled && (
              <span style={{ fontSize: 8, fontWeight: 700, background: 'var(--green-bg)', color: 'var(--green)', padding: '0 4px', borderRadius: 6, marginLeft: 2 }}>
                {(block.observe?.metrics || []).filter(m => m.enabled).length}
              </span>
            )}
            {t.id === 'rules' && !t.disabled && (block.observe?.rules || []).length > 0 && (
              <span style={{ fontSize: 8, fontWeight: 700, background: 'var(--purple-bg)', color: 'var(--purple)', padding: '0 4px', borderRadius: 6, marginLeft: 2 }}>
                {(block.observe?.rules || []).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {tab === 'content' && <ContentTab block={block} />}
        {tab === 'observe' && <ObserveTab block={block} />}
        {tab === 'rules' && <RulesTab block={block} />}
        {tab === 'preview' && <PreviewTab block={block} />}
      </div>
    </div>
  );
}

Object.assign(window, { CreatorV2App });
