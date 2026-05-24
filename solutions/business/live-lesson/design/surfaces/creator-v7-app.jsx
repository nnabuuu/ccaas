/* ════════════════════════════════════════════════
   Creator v7 — Main App (Restructured IA)
   Top bar with project identity · Skills tab · Clean hierarchy
   ════════════════════════════════════════════════ */

function CreatorV7App() {
  const [activeTab, setActiveTab] = React.useState('exec');
  const [lesson, setLesson] = React.useState(LESSON_V4);
  const [selectedBlock, setSelectedBlock] = React.useState('b7');
  const [activeEditorTab, setActiveEditorTab] = React.useState('content');
  const [filesOpen, setFilesOpen] = React.useState(false);
  const [activeFile, setActiveFile] = React.useState(null);
  const filesRef = React.useRef(null);

  const [toasts, setToasts] = React.useState([]);
  const [pulseBlockId, setPulseBlockId] = React.useState(null);
  const [showPreview, setShowPreview] = React.useState(false);

  /* ═══ Dynamic tabs (files, review results) ═══ */
  const [dynamicTabs, setDynamicTabs] = React.useState([]);

  /* ═══ Toast ═══ */
  const showToast = React.useCallback((msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2400);
  }, []);

  /* ═══ Keyboard ═══ */
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

  /* ═══ Dynamic tab helpers ═══ */
  const openFileTab = (file) => {
    const tabId = 'file-' + file.id;
    if (!dynamicTabs.find(t => t.id === tabId)) {
      setDynamicTabs(prev => [...prev, { id: tabId, label: file.name, type: 'file', file }]);
    }
    setActiveTab(tabId);
  };

  /* Global ref opener for block items */
  React.useEffect(() => {
    window.__v7OpenFileByRef = (refPath) => {
      const fileName = refPath.split('/').pop();
      for (const cat of FILE_CATEGORIES) {
        const file = cat.files.find(f => f.name === fileName);
        if (file) { openFileTab(file); return; }
      }
    };
    return () => { delete window.__v7OpenFileByRef; };
  });

  const openReviewTab = () => {
    const tabId = 'review-' + Date.now();
    setDynamicTabs(prev => {
      const withoutOldReviews = prev.filter(t => t.type !== 'review');
      return [...withoutOldReviews, { id: tabId, label: 'Review 审计', type: 'review' }];
    });
    setActiveTab(tabId);
  };

  const closeDynamicTab = (tabId) => {
    setDynamicTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTab === tabId) setActiveTab('exec');
  };

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
      setPulseBlockId(blockId);
      setTimeout(() => setPulseBlockId(null), 1200);
      setLesson(prev => ({
        ...prev,
        steps: prev.steps.map(s =>
          s.blocks.some(b => b.id === blockId) && s.collapsed ? { ...s, collapsed: false } : s
        ),
      }));
    }
  };

  /* ═══ Mutation handlers ═══ */
  const addBlock = (stepId, type) => {
    const newBlock = createDefaultBlock(type);
    setLesson(prev => ({ ...prev, steps: prev.steps.map(s => s.id === stepId ? { ...s, blocks: [...s.blocks, newBlock] } : s) }));
    setSelectedBlock(newBlock.id);
    setActiveEditorTab('content');
    const reg = COMP_REG[type] || COMP_REG.explain;
    showToast(`已添加「${reg.label}」模块`, 'success');
  };

  const deleteBlock = (blockId) => {
    const blk = (() => { for (const s of lesson.steps) { const f = s.blocks.find(b => b.id === blockId); if (f) return f; } return null; })();
    if (selectedBlock === blockId) setSelectedBlock(null);
    setLesson(prev => ({ ...prev, steps: prev.steps.map(s => ({ ...s, blocks: s.blocks.filter(b => b.id !== blockId) })) }));
    showToast(`已删除「${blk?.title || '模块'}」`);
  };

  const moveBlock = (blockId, stepId, direction) => {
    setLesson(prev => ({ ...prev, steps: prev.steps.map(s => {
      if (s.id !== stepId) return s;
      const blocks = [...s.blocks]; const idx = blocks.findIndex(b => b.id === blockId);
      if (idx < 0) return s; const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= blocks.length) return s;
      [blocks[idx], blocks[newIdx]] = [blocks[newIdx], blocks[idx]];
      return { ...s, blocks };
    }) }));
    showToast(direction < 0 ? '已上移模块' : '已下移模块');
  };

  const duplicateBlock = (blockId, stepId) => {
    setLesson(prev => ({ ...prev, steps: prev.steps.map(s => {
      if (s.id !== stepId) return s;
      const idx = s.blocks.findIndex(b => b.id === blockId); if (idx < 0) return s;
      const copy = cloneBlock(s.blocks[idx]); const blocks = [...s.blocks];
      blocks.splice(idx + 1, 0, copy); return { ...s, blocks };
    }) }));
    showToast('已复制模块', 'success');
  };

  const updateBlock = (blockId, updates) => {
    setLesson(prev => ({ ...prev, steps: prev.steps.map(s => ({ ...s, blocks: s.blocks.map(b => b.id === blockId ? { ...b, ...updates } : b) })) }));
  };

  const addStep = () => {
    const newStep = createDefaultStep();
    setLesson(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    showToast('已添加新步骤', 'success');
  };

  const deleteStep = (stepId) => {
    const step = lesson.steps.find(s => s.id === stepId);
    if (step && step.blocks.some(b => b.id === selectedBlock)) setSelectedBlock(null);
    setLesson(prev => ({ ...prev, steps: prev.steps.filter(s => s.id !== stepId) }));
    showToast(`已删除「${step?.title || '步骤'}」`);
  };

  const moveStep = (stepId, direction) => {
    setLesson(prev => {
      const steps = [...prev.steps]; const idx = steps.findIndex(s => s.id === stepId);
      if (idx < 0) return prev; const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= steps.length) return prev;
      [steps[idx], steps[newIdx]] = [steps[newIdx], steps[idx]];
      return { ...prev, steps };
    });
    showToast(direction < 0 ? '已上移步骤' : '已下移步骤');
  };

  const updateStep = (stepId, updates) => {
    setLesson(prev => ({ ...prev, steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s) }));
  };

  /* ═══ Derived ═══ */
  let selectedBlockData = null;
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === selectedBlock);
    if (found) { selectedBlockData = found; break; }
  }
  const totalBlocks = lesson.steps.reduce((s, st) => s + st.blocks.length, 0);
  const refBlocks = lesson.steps.reduce((s, st) => s + st.blocks.filter(b => b.$ref).length, 0);

  /* ═══ Render ═══ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ══════ TOP BAR — Project Identity ══════ */}
      <div style={{
        display: 'flex', alignItems: 'center', height: 48, padding: '0 16px',
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        flexShrink: 0, gap: 8, zIndex: 50,
      }}>
        <a href="platform-home.html" style={{
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 500, color: 'var(--t3)', whiteSpace: 'nowrap',
        }}>← 项目列表</a>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }}></div>

        {/* Project identity */}
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: 'var(--t1)', color: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>J</div>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.3, flexShrink: 0 }}>{lesson.title}</span>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <Badge color="teal">{lesson.subject}</Badge>
          <Badge>{lesson.grade}</Badge>
          <Badge color="amber">{lesson.duration}min</Badge>
        </div>

        <div style={{ flex: 1 }}></div>

        {/* File browser */}
        <div ref={filesRef} style={{ position: 'relative' }}>
          <button onClick={() => setFilesOpen(!filesOpen)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
            fontSize: 11, fontWeight: 500, fontFamily: 'inherit', borderRadius: 6,
            cursor: 'pointer', border: '1px solid var(--border)',
            background: filesOpen ? 'var(--surface2)' : 'var(--surface)',
            color: 'var(--t2)', transition: 'all .12s',
          }}>
            <span style={{ fontSize: 12 }}>📁</span>
            文件
            <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: 'var(--surface2)', color: 'var(--t3)' }}>
              {FILE_CATEGORIES.reduce((s, c) => s + c.files.length, 0)}
            </span>
            <span style={{ fontSize: 8, color: 'var(--t3)', transform: filesOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
          </button>
          {filesOpen && (
            <V7FilePopover activeFile={activeFile} onFileClick={(file) => {
              setActiveFile(file.id);
              if (file.disabled) return;
              openFileTab(file);
              setFilesOpen(false);
            }} />
          )}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }}></div>
        <Btn variant="primary" small onClick={() => setShowPreview(true)}>预览课程</Btn>
      </div>

      {/* ══════ BODY — Left AI + Right Working Area ══════ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Left: AI Panel */}
        <AILeftPanelV7
          lesson={lesson}
          activeTab={activeTab}
          selectedBlock={selectedBlock}
          dynamicTabs={dynamicTabs}
          onNavigate={handleNavigate}
        />

        {/* Right: Tabs + Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          {/* Tab bar */}
          <div className="v7-tabs">
            {/* Persistent tabs */}
            <button className={`v7-tab ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>
              <span className="vt-dot" style={{ background: 'var(--teal)' }}></span> 教案设计
            </button>
            <button className={`v7-tab ${activeTab === 'exec' ? 'active' : ''}`} onClick={() => setActiveTab('exec')}>
              <span className="vt-dot" style={{ background: 'var(--blue)' }}></span> 执行设计
              <span style={{ fontSize: 8, fontWeight: 700, padding: '0 5px', borderRadius: 6, background: 'var(--blue-bg)', color: 'var(--blue)', lineHeight: '14px' }}>{totalBlocks}</span>
            </button>
            <button className={`v7-tab ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>
              <span className="vt-dot" style={{ background: 'var(--purple)' }}></span> Skills·连接器
            </button>

            {/* Dynamic tabs */}
            {dynamicTabs.length > 0 && <div className="v7-tab-sep"></div>}
            {dynamicTabs.map(dt => {
              const fileReg = dt.file?.type ? COMP_REG[dt.file.type] : null;
              return (
                <button key={dt.id} className={`v7-tab ${activeTab === dt.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(dt.id)}
                  style={{ gap: 4 }}>
                  {dt.type === 'review' && <span className="vt-dot" style={{ background: 'var(--green)' }}></span>}
                  {dt.type === 'file' && fileReg && <span style={{ fontSize: 10, color: fileReg.color }}>{fileReg.icon}</span>}
                  {dt.type === 'file' && !fileReg && <span style={{ fontSize: 9, opacity: .5 }}>📄</span>}
                  <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dt.label}</span>
                  <span onClick={e => { e.stopPropagation(); closeDynamicTab(dt.id); }}
                    style={{ fontSize: 9, color: 'var(--t3)', padding: '0 2px', cursor: 'pointer', marginLeft: 2, borderRadius: 3 }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--t3)'}
                  >✕</span>
                </button>
              );
            })}

            {/* Review action */}
            <div style={{ flex: 1 }}></div>
            <button className="v7-tab" onClick={openReviewTab}
              style={{ color: 'var(--green)', fontSize: 10, gap: 4 }}>
              <span style={{ fontSize: 10 }}>◇</span> 运行审计
            </button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            {activeTab === 'plan' && <PlanTab />}
            {activeTab === 'skills' && <SkillsConnectorsTab onShowToast={showToast} />}
            {/* Dynamic tab content */}
            {dynamicTabs.map(dt => {
              if (activeTab !== dt.id) return null;
              if (dt.type === 'review') return <ReviewTab key={dt.id} />;
              if (dt.type === 'file') return (
                <V7FileTabContent key={dt.id} file={dt.file}
                  onNavigateToBlock={(blockId) => { closeDynamicTab(dt.id); handleNavigate('exec', blockId); }} />
              );
              return null;
            })}
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
                {selectedBlockData && (
                  <div key={selectedBlock} className="v7-editor-slide" style={{
                    position: 'absolute', top: 0, right: 0, bottom: 0,
                    width: 420, maxWidth: '70%', zIndex: 20, display: 'flex',
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
      </div>

      {/* ══ Toasts ══ */}
      <V6Toasts toasts={toasts} />

      {/* ══ Preview Modal ══ */}
      {showPreview && <V6PreviewModal lesson={lesson} onClose={() => setShowPreview(false)} />}
    </div>
  );
}

/* ════════════════════════════════════════════════
   File Popover (v7 — drops from top bar, right-aligned)
   ════════════════════════════════════════════════ */
function V7FilePopover({ activeFile, onFileClick }) {
  const [expandedCats, setExpandedCats] = React.useState({ plan: true, modules: true, execution: true, resources: false, records: false });

  return (
    <div className="v7-file-pop">
      <div className="scr" style={{ flex: 1, padding: '6px 0' }}>
        {FILE_CATEGORIES.map(cat => (
          <div key={cat.id}>
            <div className="v7-fp-cat" onClick={() => setExpandedCats(p => ({ ...p, [cat.id]: !p[cat.id] }))}>
              <span style={{ fontSize: 8, transform: expandedCats[cat.id] ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .12s' }}>▶</span>
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span style={{ fontWeight: 500, opacity: .7 }}>{cat.files.length}</span>
            </div>
            {expandedCats[cat.id] && cat.files.map(file => {
              const reg = file.type ? COMP_REG[file.type] : null;
              const isActive = activeFile === file.id;
              return (
                <div key={file.id} className="v7-fp-file"
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
   File Tab Content — renders file inside a dynamic tab
   ════════════════════════════════════════════════ */

const FILE_VIEWER_CONTENT = {
  'f-plan': { type: 'md', body: `# Ideal Beauty\n\n**Source:** Textbook Unit 3\n**Subject:** 英语\n**Grade:** 高一\n**Duration:** 45 分钟\n\n## 课文概述\n\n本课选取关于不同文化中美的标准的议论文。课文从尼日利亚的 Happiness Edem 的故事引入，探讨了从古埃及到现代媒体中美的实践的多样性，最终论证美的实践是一种"文化语言"。` },
  'f-obj': { type: 'md', body: `# 核心素养目标\n\n## 语言能力\n- 通过上下文线索推断生词含义\n- 识别并分析语篇结构信号词\n\n## 思维品质\n- 分析不同文化中美的实践背后的逻辑\n- 批判性评价作者的论点和证据\n\n## 文化意识\n- 理解美的文化多样性\n- 反思媒体对美的标准的影响` },
  'f-req': { type: 'md', body: `# 教学要求\n\n- 识别课文中的语篇结构（现象→历史→文化→结论）\n- 理解 "beauty practices as cultural language" 的核心论点\n- 分析至少 3 种文化中美的实践的目的和意义\n- 批判性评价作者对现代媒体美的标准的观点\n- 运用 skimming / scanning 阅读策略完成信息提取` },
  'f-text': { type: 'md', body: `# Ideal Beauty\n\n## ¶1-2 · Phenomenon\n\nHappiness Edem sat in the fattening room, a traditional practice in parts of Nigeria where young women gain weight before marriage. In a world where slim figures dominate magazine covers, her experience seems like a contradiction...\n\n## ¶3-4 · History\n\nThe pursuit of beauty is nothing new. Ancient Egyptians used kohl to line their eyes — a practice that was both cosmetic and spiritual. In 1600s Europe, the ideal woman was plump and pale, a sign of wealth...\n\n## ¶5-7 · Culture\n\nIn Borneo, women traditionally wore heavy brass earrings that stretched their earlobes — a mark of beauty and status. The Maori people of New Zealand practice tā moko, a form of permanent facial tattooing that tells the story of one's ancestry. In Myanmar, women of the Kayan people wear brass coils that elongate their necks...\n\n## ¶8 · Conclusion\n\nBeauty practices are a form of cultural language. They communicate identity, status, and belonging. But as global media spreads a single image of beauty, are we losing the diversity of this language?` },
  'f-vocab': { type: 'md', body: `# Vocabulary · Ideal Beauty\n\n| Word | Meaning | Context |\n|---|---|---|\n| fattening room | 增肥营 | Nigerian tradition |\n| kohl | 眼线膏 | Ancient Egyptian |\n| tā moko | 毛利纹面 | Maori tattoo |\n| elongate | 使延长 | Myanmar coils |\n| contradiction | 矛盾 | Slim vs fattening |\n| ancestry | 祖先血统 | Maori identity |\n| diversity | 多样性 | Global media |\n| permanent | 永久的 | Tattoos vs temp |` },
};

function V7FileTabContent({ file, onNavigateToBlock }) {
  const content = FILE_VIEWER_CONTENT[file.id];
  const reg = file.type ? COMP_REG[file.type] : null;
  const isRef = !!file.refId;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* File header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: reg ? 11 : 9, flexShrink: 0,
          background: reg ? reg.bg : 'var(--surface2)', color: reg ? reg.color : 'var(--t2)',
        }}>{reg ? reg.icon : (file.name.endsWith('.md') ? '≡' : '{}')}</div>
        <span style={{ fontSize: 12, fontWeight: 600, fontFamily: 'ui-monospace, monospace' }}>{file.name}</span>
        <Badge color={file.name.endsWith('.json') ? 'blue' : 'teal'}>{file.name.endsWith('.json') ? 'JSON' : 'Markdown'}</Badge>
        {isRef && <Badge color="blue">ref</Badge>}
        {isRef && (
          <button onClick={() => onNavigateToBlock(file.refId)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
            fontSize: 10, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6,
            cursor: 'pointer', border: '1px solid var(--blue)',
            background: 'var(--blue-bg)', color: 'var(--blue)', marginLeft: 'auto',
          }}>跳转到模块 →</button>
        )}
      </div>

      {/* File content */}
      <div className="scr" style={{ flex: 1, padding: '24px 0' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 32px' }}>
          {content && content.type === 'md' && content.body ? (
            <V7MarkdownView text={content.body} />
          ) : reg ? (
            <V7JsonModuleView file={file} />
          ) : (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)' }}>
              <div style={{ fontSize: 24, opacity: .3, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 12 }}>{file.preview}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Simple markdown-ish renderer ── */
function V7MarkdownView({ text }) {
  const lines = text.split('\n');
  return (
    <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.8 }}>
      {lines.map((line, i) => {
        if (line.startsWith('# ')) return <div key={i} style={{ fontSize: 18, fontWeight: 700, letterSpacing: -.3, margin: '16px 0 8px' }}>{line.slice(2)}</div>;
        if (line.startsWith('## ')) return <div key={i} style={{ fontSize: 14, fontWeight: 600, margin: '14px 0 6px', color: 'var(--teal)' }}>{line.slice(3)}</div>;
        if (line.startsWith('| ')) return <div key={i} style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'var(--t2)', lineHeight: 1.6, padding: '1px 0' }}>{line}</div>;
        if (line.startsWith('- ')) return <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '2px 0' }}><span style={{ color: 'var(--teal)', fontSize: 8, marginTop: 5 }}>●</span><span style={{ color: 'var(--t2)', fontSize: 12 }}>{line.slice(2)}</span></div>;
        if (line.trim() === '') return <div key={i} style={{ height: 8 }}></div>;
        return <div key={i} style={{ color: 'var(--t2)', fontSize: 12, lineHeight: 1.8 }}>{line}</div>;
      })}
    </div>
  );
}

/* ── JSON viewer for module files ── */
function V7JsonModuleView({ file }) {
  const reg = file.type ? COMP_REG[file.type] : null;
  return (
    <div>
      {reg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: reg.bg, borderRadius: 8 }}>
          <span style={{ width: 24, height: 24, borderRadius: 6, background: reg.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{reg.icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: reg.color }}>{reg.label}模块</div>
            <div style={{ fontSize: 10, color: reg.color, opacity: .7 }}>{file.preview}</div>
          </div>
        </div>
      )}
      <div style={{
        padding: 16, borderRadius: 8, background: 'var(--t1)', color: 'rgba(240,239,232,.85)',
        fontFamily: 'ui-monospace, "SF Mono", monospace', fontSize: 11, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {JSON.stringify({ id: file.id, name: file.name, type: file.type || 'document', preview: file.preview, ref: file.refId || null }, null, 2)}
      </div>
    </div>
  );
}

Object.assign(window, { CreatorV7App });
