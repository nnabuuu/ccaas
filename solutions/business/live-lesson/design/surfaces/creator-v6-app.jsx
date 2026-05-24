/* ════════════════════════════════════════════════
   Creator v6 — Main App (Enhanced)
   Toast · Keyboard · Editor animation · Preview · Pulse navigation
   ════════════════════════════════════════════════ */

function CreatorV6App() {
  const [activeTab, setActiveTab] = React.useState('exec');
  const [lesson, setLesson] = React.useState(LESSON_V4);
  const [selectedBlock, setSelectedBlock] = React.useState('b7');
  const [activeEditorTab, setActiveEditorTab] = React.useState('content');
  const [filesOpen, setFilesOpen] = React.useState(false);
  const [activeFile, setActiveFile] = React.useState(null);
  const filesRef = React.useRef(null);

  /* ═══ Enhanced state ═══ */
  const [toasts, setToasts] = React.useState([]);
  const [pulseBlockId, setPulseBlockId] = React.useState(null);
  const [showPreview, setShowPreview] = React.useState(false);

  /* ═══ Toast system ═══ */
  const showToast = React.useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2400);
  }, []);

  /* ═══ Keyboard shortcuts ═══ */
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (showPreview) { setShowPreview(false); return; }
        if (selectedBlock) { setSelectedBlock(null); return; }
        if (filesOpen) { setFilesOpen(false); return; }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedBlock, showPreview, filesOpen]);

  // Close file popover on outside click
  React.useEffect(() => {
    const handler = (e) => {
      if (filesOpen && filesRef.current && !filesRef.current.contains(e.target)) setFilesOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filesOpen]);

  const toggleCollapse = (stepId) => {
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, collapsed: !s.collapsed } : s),
    }));
  };

  const handleNavigate = (tab, blockId) => {
    setActiveTab(tab);
    if (blockId) {
      setSelectedBlock(blockId);
      setActiveEditorTab('content');
      // Trigger pulse animation
      setPulseBlockId(blockId);
      setTimeout(() => setPulseBlockId(null), 1200);
      // Auto-expand step containing target block
      setLesson(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.blocks.some(b => b.id === blockId) && s.collapsed ? { ...s, collapsed: false } : s
        ),
      }));
    }
  };

  /* ═══ Mutation handlers with toast feedback ═══ */

  const addBlock = (stepId, type) => {
    const newBlock = createDefaultBlock(type);
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s =>
        s.id === stepId ? { ...s, blocks: [...s.blocks, newBlock] } : s
      ),
    }));
    setSelectedBlock(newBlock.id);
    setActiveEditorTab('content');
    const reg = COMP_REG[type] || COMP_REG.explain;
    showToast(`已添加「${reg.label}」模块`, 'success');
  };

  const deleteBlock = (blockId) => {
    const blk = (() => { for (const s of lesson.steps) { const f = s.blocks.find(b => b.id === blockId); if (f) return f; } return null; })();
    if (selectedBlock === blockId) setSelectedBlock(null);
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => ({
        ...s,
        blocks: s.blocks.filter(b => b.id !== blockId),
      })),
    }));
    showToast(`已删除「${blk?.title || '模块'}」`);
  };

  const moveBlock = (blockId, stepId, direction) => {
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => {
        if (s.id !== stepId) return s;
        const blocks = [...s.blocks];
        const idx = blocks.findIndex(b => b.id === blockId);
        if (idx < 0) return s;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= blocks.length) return s;
        [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
        return { ...s, blocks };
      }),
    }));
    showToast(direction < 0 ? '已上移模块' : '已下移模块');
  };

  const duplicateBlock = (blockId, stepId) => {
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => {
        if (s.id !== stepId) return s;
        const idx = s.blocks.findIndex(b => b.id === blockId);
        if (idx < 0) return s;
        const copy = cloneBlock(s.blocks[idx]);
        const blocks = [...s.blocks];
        blocks.splice(idx + 1, 0, copy);
        return { ...s, blocks };
      }),
    }));
    showToast('已复制模块', 'success');
  };

  const updateBlock = (blockId, updates) => {
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => ({
        ...s,
        blocks: s.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b),
      })),
    }));
  };

  const addStep = () => {
    const newStep = createDefaultStep();
    setLesson(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    showToast('已添加新步骤', 'success');
  };

  const deleteStep = (stepId) => {
    const step = lesson.steps.find(s => s.id === stepId);
    if (step && step.blocks.some(b => b.id === selectedBlock)) {
      setSelectedBlock(null);
    }
    setLesson(prev => ({ ...prev, steps: prev.steps.filter(s => s.id !== stepId) }));
    showToast(`已删除「${step?.title || '步骤'}」`);
  };

  const moveStep = (stepId, direction) => {
    setLesson(prev => {
      const steps = [...prev.steps];
      const idx = steps.findIndex(s => s.id === stepId);
      if (idx < 0) return prev;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= steps.length) return prev;
      [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
      return { ...prev, steps };
    });
    showToast(direction < 0 ? '已上移步骤' : '已下移步骤');
  };

  const updateStep = (stepId, updates) => {
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
    }));
  };

  /* ═══ Derived state ═══ */

  let selectedBlockData = null;
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === selectedBlock);
    if (found) { selectedBlockData = found; break; }
  }

  const totalBlocks = lesson.steps.reduce((s, st) => s + st.blocks.length, 0);
  const refBlocks = lesson.steps.reduce((s, st) => s + st.blocks.filter(b => b.$ref).length, 0);
  const aiBlocks = lesson.steps.reduce((s, st) => s + st.blocks.filter(b => b.ai).length, 0);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* ══ LEFT: AI Panel ══ */}
      <AILeftPanel
        lesson={lesson}
        activeTab={activeTab}
        selectedBlock={selectedBlock}
        onNavigate={handleNavigate}
        onShowToast={showToast}
      />

      {/* ══ RIGHT: Working Area ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        {/* ── Working area header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', height: 44, padding: '0 16px',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 6,
        }}>
          {/* File browser button */}
          <div ref={filesRef} style={{ position: 'relative' }}>
            <button onClick={() => setFilesOpen(!filesOpen)} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              fontSize: 11, fontWeight: 500, fontFamily: 'inherit', borderRadius: 6,
              cursor: 'pointer', border: '1px solid var(--border)',
              background: filesOpen ? 'var(--surface2)' : 'var(--surface)',
              color: 'var(--t2)', transition: 'all .12s',
            }}>
              <span style={{ fontSize: 12 }}>📁</span>
              项目文件
              <span style={{
                fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                background: 'var(--surface2)', color: 'var(--t3)',
              }}>{FILE_CATEGORIES.reduce((s, c) => s + c.files.length, 0)}</span>
              <span style={{ fontSize: 8, color: 'var(--t3)', marginLeft: 2, transform: filesOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
            </button>

            {filesOpen && (
              <FilePopover
                activeFile={activeFile}
                onFileClick={(file) => {
                  setActiveFile(file.id);
                  if (file.navigateTo) handleNavigate(file.navigateTo);
                  if (file.refId) handleNavigate('exec', file.refId);
                  setFilesOpen(false);
                }}
              />
            )}
          </div>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }}></div>

          {/* Tabs with badges */}
          <div style={{ display: 'flex', gap: 0, flex: 1 }}>
            <button className={`v6-tab ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>
              <span className="vt-dot" style={{ background: 'var(--teal)' }}></span> 教案设计
              <span style={{ fontSize: 8, fontWeight: 700, padding: '0 5px', borderRadius: 6, background: 'var(--teal-bg)', color: 'var(--teal)', lineHeight: '14px' }}>5项</span>
            </button>
            <button className={`v6-tab ${activeTab === 'exec' ? 'active' : ''}`} onClick={() => setActiveTab('exec')}>
              <span className="vt-dot" style={{ background: 'var(--blue)' }}></span> 执行设计
              <span style={{ fontSize: 8, fontWeight: 700, padding: '0 5px', borderRadius: 6, background: 'var(--blue-bg)', color: 'var(--blue)', lineHeight: '14px' }}>{totalBlocks}</span>
            </button>
            <div className="v6-tab-sep"></div>
            <button className={`v6-tab ${activeTab === 'review' ? 'active' : ''}`} onClick={() => setActiveTab('review')}>
              Review
              <span style={{ fontSize: 8, fontWeight: 700, padding: '0 5px', borderRadius: 6, background: 'var(--green-bg)', color: 'var(--green)', lineHeight: '14px' }}>✓</span>
            </button>
          </div>

          <a href="platform-home.html" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, color: 'var(--t3)', marginRight: 4, whiteSpace: 'nowrap' }}>← 项目列表</a>
          <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }}></div>
          <Btn variant="primary" small onClick={() => setShowPreview(true)}>预览课程</Btn>
        </div>

        {/* ── Tab content ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          {activeTab === 'plan' && <PlanTab />}
          {activeTab === 'review' && <ReviewTab />}
          {activeTab === 'exec' && (
            <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
              <V6ExecCanvas
                lesson={lesson}
                selectedBlock={selectedBlock}
                pulseBlockId={pulseBlockId}
                onSelectBlock={(id) => { setSelectedBlock(id); setActiveEditorTab('content'); }}
                onToggleCollapse={toggleCollapse}
                totalBlocks={totalBlocks}
                refBlocks={refBlocks}
                onAddBlock={addBlock}
                onDeleteBlock={deleteBlock}
                onMoveBlock={moveBlock}
                onDuplicateBlock={duplicateBlock}
                onUpdateBlock={updateBlock}
                onAddStep={addStep}
                onDeleteStep={deleteStep}
                onMoveStep={moveStep}
                onUpdateStep={updateStep}
              />
              {/* Block editor overlay (animated) */}
              {selectedBlockData && (
                <div key={selectedBlock} className="v6-editor-slide" style={{
                  position: 'absolute', top: 0, right: 0, bottom: 0,
                  width: 420, maxWidth: '70%',
                  zIndex: 20, display: 'flex',
                }}>
                  <V6BlockEditor
                    block={selectedBlockData}
                    activeTab={activeEditorTab}
                    onTabChange={setActiveEditorTab}
                    onClose={() => setSelectedBlock(null)}
                    onUpdateBlock={updateBlock}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══ Toast notifications ══ */}
      <V6Toasts toasts={toasts} />

      {/* ══ Preview Modal ══ */}
      {showPreview && (
        <V6PreviewModal lesson={lesson} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Toast Notifications
   ════════════════════════════════════════════════ */
function V6Toasts({ toasts }) {
  if (toasts.length === 0) return null;
  const iconMap = { success: '✓', warn: '⚠', info: '→' };
  return (
    <div className="v6-toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`v6-toast ${t.type || 'info'}`}>
          <span style={{ fontSize: 10, fontWeight: 700 }}>{iconMap[t.type] || '→'}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Preview Modal — Lesson flow visualization
   ════════════════════════════════════════════════ */
function V6PreviewModal({ lesson, onClose }) {
  const totalBlocks = lesson.steps.reduce((s, st) => s + st.blocks.length, 0);
  const refCount = lesson.steps.reduce((s, st) => s + st.blocks.filter(b => b.$ref).length, 0);
  const aiCount = lesson.steps.reduce((s, st) => s + st.blocks.filter(b => b.ai).length, 0);
  const rulesCount = lesson.steps.reduce((s, st) => s + st.blocks.reduce((rs, b) => rs + (b.observe?.rules?.length || 0), 0), 0);
  const totalDur = lesson.steps.reduce((s, st) => s + st.blocks.reduce((ds, b) => ds + (b.duration || 0), 0), 0);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(28,28,26,.25)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 12, width: 600, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'var(--t1)', color: 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
          }}>J</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.3 }}>课程预览 · {lesson.title}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
              <Badge color="teal">{lesson.subject}</Badge>
              <Badge>{lesson.grade}</Badge>
              <Badge color="blue">{lesson.classGroup}</Badge>
              <Badge color="amber">{lesson.duration}min</Badge>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--t3)', fontSize: 9 }}>
            <span>Esc 关闭</span>
          </div>
          <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 16, padding: '2px 6px' }}>✕</span>
        </div>

        {/* Steps flow */}
        <div className="scr" style={{ flex: 1, padding: '16px 20px' }}>
          {lesson.steps.map((step, si) => {
            const color = STEP_COLORS_V6[si % STEP_COLORS_V6.length];
            const dur = step.blocks.reduce((s, b) => s + (b.duration || 0), 0);
            return (
              <div key={step.id} style={{ marginBottom: si < lesson.steps.length - 1 ? 6 : 0 }}>
                {/* Step header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: 6, background: color, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0,
                  }}>{si + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{step.title}</span>
                  <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.type}</span>
                  <div style={{ flex: 1 }}></div>
                  <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.blocks.length} 模块 · {dur}min</span>
                </div>
                {/* Blocks */}
                <div style={{ marginLeft: 10, display: 'flex', flexDirection: 'column', gap: 3, borderLeft: `2px solid ${color}`, paddingLeft: 18 }}>
                  {step.blocks.map(block => {
                    const reg = COMP_REG[block.type] || COMP_REG.explain;
                    return (
                      <div key={block.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                        background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)',
                      }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: 4, background: reg.bg, color: reg.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, flexShrink: 0,
                        }}>{reg.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{block.title}</span>
                        {block.ai && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: 'var(--purple-bg)', color: 'var(--purple)' }}>AI</span>}
                        {block.$ref && <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 6, background: 'var(--blue-bg)', color: 'var(--blue)' }}>ref</span>}
                        <span style={{ fontSize: 9, color: 'var(--t3)', flexShrink: 0 }}>{block.duration}min</span>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: reg.bg, color: reg.color, flexShrink: 0 }}>{reg.label}</span>
                      </div>
                    );
                  })}
                </div>
                {/* Connection between steps */}
                {si < lesson.steps.length - 1 && (
                  <div style={{ textAlign: 'center', color: 'var(--border)', fontSize: 14, padding: '2px 0', marginLeft: 10 }}>↓</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
            <Badge color="teal">{lesson.steps.length} Steps</Badge>
            <Badge color="blue">{totalBlocks} 模块</Badge>
            <Badge color="purple">{refCount} Ref</Badge>
            <Badge color="coral">{aiCount} AI</Badge>
            <Badge color="amber">{rulesCount} 规则</Badge>
            <Badge>{totalDur}min</Badge>
          </div>
          <Btn small onClick={onClose}>关闭</Btn>
          <Btn small variant="primary" disabled>开始上课</Btn>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   File Popover (replaces sidebar)
   ════════════════════════════════════════════════ */
function FilePopover({ activeFile, onFileClick }) {
  const [expandedCats, setExpandedCats] = React.useState({ plan: true, modules: true, execution: true, resources: false, records: false });

  return (
    <div className="v6-file-pop">
      <div className="scr" style={{ flex: 1, padding: '6px 0' }}>
        {FILE_CATEGORIES.map(cat => (
          <div key={cat.id}>
            <div className="v6-fp-cat" onClick={() => setExpandedCats(p => ({ ...p, [cat.id]: !p[cat.id] }))}>
              <span style={{ fontSize: 8, transform: expandedCats[cat.id] ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .12s' }}>▶</span>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span style={{ fontWeight: 500, opacity: .7 }}>{cat.files.length}</span>
            </div>
            {expandedCats[cat.id] && cat.files.map(file => {
              const reg = file.type ? COMP_REG[file.type] : null;
              const isActive = activeFile === file.id;
              return (
                <div key={file.id}
                  className="v6-fp-file"
                  style={{
                    background: isActive ? 'var(--teal-bg)' : undefined,
                    opacity: file.disabled ? .4 : 1,
                    cursor: file.disabled ? 'default' : 'pointer',
                  }}
                  onClick={() => { if (!file.disabled) onFileClick(file); }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: reg ? 12 : 10, flexShrink: 0,
                    background: reg ? reg.bg : `var(--${cat.color}-bg)`,
                    color: reg ? reg.color : `var(--${cat.color})`,
                  }}>{reg ? reg.icon : (file.name.endsWith('.md') ? '≡' : file.name.endsWith('.json') ? '{}' : '📄')}</div>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{file.preview}</div>
                  </div>
                  {file.refId && (
                    <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'var(--blue-bg)', color: 'var(--blue)', flexShrink: 0 }}>ref</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--t3)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--purple)' }}>ref</strong> 标记的模块文件被执行流引用
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Block Editor (v6 — right overlay, editable title)
   ════════════════════════════════════════════════ */
function V6BlockEditor({ block, activeTab, onTabChange, onClose, onUpdateBlock }) {
  const reg = COMP_REG[block.type] || COMP_REG.explain;
  const TABS = [
    { id: 'content', label: '内容', icon: '✎' },
    { id: 'observe', label: '观察', icon: '📊', disabled: !reg.hasObserve },
    { id: 'rules', label: '规则', icon: '⚡', disabled: !reg.hasObserve },
    { id: 'preview', label: '预览', icon: '👁', disabled: !reg.hasObserve },
  ];
  const tab = TABS.find(t => t.id === activeTab && !t.disabled) ? activeTab : 'content';

  /* ── Editable title ── */
  const [editTitle, setEditTitle] = React.useState(false);
  const [titleVal, setTitleVal] = React.useState(block.title);
  React.useEffect(() => { setTitleVal(block.title); }, [block.title]);
  const saveTitle = () => {
    if (titleVal.trim() && titleVal.trim() !== block.title && onUpdateBlock) {
      onUpdateBlock(block.id, { title: titleVal.trim() });
    }
    setEditTitle(false);
  };

  return (
    <div style={{
      width: '100%', flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface)',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <span style={{ width: 26, height: 26, borderRadius: 6, background: reg.bg, color: reg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{reg.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editTitle ? (
            <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(block.title); setEditTitle(false); } }}
              style={{ fontSize: 13, fontWeight: 600, border: '1px solid var(--blue)', borderRadius: 4, padding: '1px 6px', background: 'var(--blue-bg)', outline: 'none', fontFamily: 'inherit', color: 'var(--t1)', width: '100%' }} />
          ) : (
            <div onClick={() => setEditTitle(true)} style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} title="点击编辑标题">{block.title}</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: reg.color }}>{reg.label}</span>
            {block.$ref && (
              <span onClick={() => { if (window.__v7OpenFileByRef) window.__v7OpenFileByRef(block.$ref); }}
                style={{ fontSize: 8, fontFamily: 'ui-monospace, monospace', color: 'var(--blue)', background: 'var(--blue-bg)', padding: '0 4px', borderRadius: 2, cursor: 'pointer' }}>
                🔗 {block.$ref}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize: 9, color: 'var(--t3)', marginRight: 4 }}>Esc</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 14, padding: '2px 4px' }}>✕</span>
      </div>

      {/* Sub-tabs */}
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

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {tab === 'content' && <ContentTab block={block} />}
        {tab === 'observe' && <ObserveTab block={block} />}
        {tab === 'rules' && <RulesTab block={block} />}
        {tab === 'preview' && <PreviewTab block={block} />}
      </div>
    </div>
  );
}

Object.assign(window, { CreatorV6App });
