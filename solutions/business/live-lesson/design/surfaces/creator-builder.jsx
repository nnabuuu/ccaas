/* ════════════════════════════════════════════════
   Lesson Builder Page
   ════════════════════════════════════════════════ */

const SAMPLE_LESSON = {
  title: 'SAS 判定',
  subject: '数学',
  grade: '八年级',
  classGroup: '八(2)班',
  duration: 40,
  steps: [
    {
      id: 's1', title: '导入回顾', duration: 5, collapsed: false,
      blocks: [
        { id: 'b1', type: 'explain', templateId: null, title: '回顾 SSS 判定条件', desc: '提问：上节课学的 SSS 判定需要几个条件？', duration: 3 },
        { id: 'b2', type: 'poll', templateId: 18, title: '快速回忆投票', desc: 'SSS 判定需要几组条件？A.1组 B.2组 C.3组', duration: 2 },
      ],
    },
    {
      id: 's2', title: '新知讲解', duration: 10, collapsed: false,
      blocks: [
        { id: 'b3', type: 'explain', templateId: null, title: 'SAS 判定条件引入', desc: '通过三角形全等的操作实验，引出"两边及其夹角"', duration: 5 },
        { id: 'b4', type: 'video', templateId: 24, title: 'SAS 证明动画', desc: 'SAS_proof_animation.mp4 · 2:45', duration: 3 },
        { id: 'b5', type: 'truefalse', templateId: 7, title: '概念快速检查', desc: '"两边和一角相等即可判定全等" — 对还是错？', duration: 2 },
      ],
    },
    {
      id: 's3', title: '练习巩固', duration: 12, collapsed: false,
      blocks: [
        { id: 'b6', type: 'choice', templateId: 1, title: '判定依据选择', desc: 'PQ=XY, ∠P=∠X, PR=XZ，判定依据是？', duration: 2 },
        { id: 'b7', type: 'matching', templateId: 9, title: '判定条件连线', desc: '将条件组合连到对应的判定名称（SSS/SAS/ASA）', duration: 4 },
        { id: 'b8', type: 'sorting', templateId: 12, title: 'SAS 证明步骤排序', desc: '将证明步骤拖入正确顺序', duration: 3 },
        { id: 'b9', type: 'fill', templateId: 5, title: '数值计算填空', desc: '已知 SAS 条件，求第三边长度', duration: 3 },
      ],
    },
    {
      id: 's4', title: '辨析深化', duration: 8, collapsed: true,
      blocks: [
        { id: 'b10', type: 'discuss', templateId: 21, title: 'SAS vs SSA 辩论', desc: '为什么 SSA 不能判定全等？分组辩论', duration: 5 },
        { id: 'b11', type: 'classify', templateId: 14, title: '条件分类', desc: '将条件组拖入"能判定全等"和"不能判定"两个分类', duration: 3 },
      ],
    },
    {
      id: 's5', title: '总结 + 作业', duration: 5, collapsed: true,
      blocks: [
        { id: 'b12', type: 'explain', templateId: null, title: '课堂总结', desc: '梳理 SSS、SAS 判定条件的异同', duration: 3 },
        { id: 'b13', type: 'reading', templateId: 26, title: '课后拓展阅读', desc: '教材 P.45 例题 + 补充材料', duration: 2 },
      ],
    },
  ],
};

const BLOCK_TYPE_META = {
  explain: { label: '讲解', icon: '▣', color: 'var(--t2)', bg: 'var(--surface2)' },
  choice: { label: '选择题', icon: '○', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  fill: { label: '填空题', icon: '▭', color: 'var(--teal)', bg: 'var(--teal-bg)' },
  truefalse: { label: '判断题', icon: '◇', color: 'var(--green)', bg: 'var(--green-bg)' },
  matching: { label: '连线题', icon: '⟷', color: 'var(--purple)', bg: 'var(--purple-bg)' },
  sorting: { label: '排序题', icon: '↕', color: 'var(--amber)', bg: 'var(--amber-bg)' },
  classify: { label: '分类题', icon: '⊞', color: 'var(--coral)', bg: 'var(--coral-bg)' },
  annotate: { label: '标注题', icon: '✎', color: 'var(--red)', bg: 'var(--red-bg)' },
  poll: { label: '投票', icon: '▮', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  discuss: { label: '讨论', icon: '◬', color: 'var(--green)', bg: 'var(--green-bg)' },
  group: { label: '分组活动', icon: '⊡', color: 'var(--purple)', bg: 'var(--purple-bg)' },
  video: { label: '视频', icon: '▶', color: 'var(--teal)', bg: 'var(--teal-bg)' },
  reading: { label: '阅读', icon: '≡', color: 'var(--amber)', bg: 'var(--amber-bg)' },
  timed: { label: '限时任务', icon: '◷', color: 'var(--red)', bg: 'var(--red-bg)' },
  peer: { label: '互评', icon: '⇆', color: 'var(--coral)', bg: 'var(--coral-bg)' },
  whiteboard: { label: '白板', icon: '▢', color: 'var(--green)', bg: 'var(--green-bg)' },
};

function LessonBuilder() {
  const [lesson, setLesson] = React.useState(SAMPLE_LESSON);
  const [selectedBlock, setSelectedBlock] = React.useState('b4');
  const [aiMessages, setAiMessages] = React.useState([
    { role: 'ai', text: '我已分析课程结构。当前 5 个 Step 覆盖了导入→讲解→练习→辨析→总结的完整闭环。\n\n建议：Step 3"练习巩固"中可增加一道判断题，专门针对"SSA 不能判定全等"这一常见误区。' },
  ]);
  const [aiInput, setAiInput] = React.useState('');
  const [addBlockStepId, setAddBlockStepId] = React.useState(null);
  const [showTemplatePanel, setShowTemplatePanel] = React.useState(false);

  const toggleCollapse = (stepId) => {
    setLesson(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, collapsed: !s.collapsed } : s),
    }));
  };

  const totalDuration = lesson.steps.reduce((sum, s) => sum + s.duration, 0);
  const totalBlocks = lesson.steps.reduce((sum, s) => sum + s.blocks.length, 0);

  const sendAiMessage = () => {
    if (!aiInput.trim()) return;
    const userMsg = aiInput.trim();
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiInput('');
    setTimeout(() => {
      setAiMessages(prev => [...prev, {
        role: 'ai',
        text: userMsg.includes('辨析') || userMsg.includes('SSA')
          ? '好的建议！我为 Step 4 生成了一个"SAS vs SSA 条件辨析"的分类题。学生需要将 6 组条件拖入"能判定全等"和"不能判定全等"两个桶中。\n\n已添加到 Step 4，你可以点击编辑内容。'
          : userMsg.includes('时间') || userMsg.includes('时长')
          ? '当前总时长 40 分钟。各 Step 分配：导入 5min → 讲解 10min → 练习 12min → 辨析 8min → 总结 5min。\n\n练习环节占比较大（30%），这对巩固新知是合理的。如需压缩，建议合并 Step 4 中的辩论和分类为一个综合活动。'
          : '明白了，我来帮你调整。基于学情数据，上次 SAS 相关练习中 32% 的学生在"夹角"概念上有误解。建议在 Step 2 的视频后增加一个针对性的标注题，让学生在三角形图上标出"夹角"的位置。',
      }]);
    }, 800);
  };

  // Find selected block data
  let selectedBlockData = null;
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === selectedBlock);
    if (found) { selectedBlockData = found; break; }
  }

  return (
    <CreatorShell activePage="builder">
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ══ LEFT: AI Chat Sidebar ══ */}
        <div style={{
          width: 300, flexShrink: 0, borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface)',
        }}>
          {/* AI Header */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, rgba(236,234,254,.2), transparent)',
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: 7,
              background: 'var(--purple)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>✦</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>AI 助手</div>
            </div>
          </div>
          <AIChatPanel
            messages={aiMessages}
            input={aiInput}
            setInput={setAiInput}
            onSend={sendAiMessage}
          />
        </div>

        {/* ══ CENTER: Main Lesson Canvas ══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Lesson Meta Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px',
            borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)',
          }}>
            <input value={lesson.title} onChange={e => setLesson(p => ({ ...p, title: e.target.value }))}
              style={{
                fontSize: 16, fontWeight: 700, border: 'none', background: 'transparent',
                fontFamily: 'inherit', color: 'var(--t1)', outline: 'none', padding: 0, width: 160,
              }}
            />
            <Badge color="teal">{lesson.subject}</Badge>
            <Badge>{lesson.grade}</Badge>
            <Badge color="blue">{lesson.classGroup}</Badge>
            <div style={{ flex: 1 }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'var(--t3)' }}>
              <span>{lesson.steps.length} Steps</span>
              <span>·</span>
              <span>{totalBlocks} 块</span>
              <span>·</span>
              <span style={{ fontWeight: 600, color: totalDuration > 45 ? 'var(--amber)' : 'var(--t2)' }}>
                {totalDuration} 分钟
              </span>
            </div>
            <Btn variant="ai" small icon="✦" onClick={() => setShowTemplatePanel(!showTemplatePanel)}>模板库</Btn>
            <Btn variant="primary" small>预览课程</Btn>
          </div>

          {/* Steps + Blocks */}
          <div className="scr" style={{ flex: 1, padding: '20px 24px' }}>
            {/* Visual timeline bar */}
            <div style={{ display: 'flex', gap: 2, height: 5, marginBottom: 18, borderRadius: 3, overflow: 'hidden' }}>
              {lesson.steps.map((step, i) => {
                const colors = ['var(--teal)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--green)'];
                return (
                  <div key={step.id} style={{
                    flex: step.duration, background: colors[i % colors.length], opacity: .3,
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', top: 8, left: 0, fontSize: 9, color: 'var(--t3)', whiteSpace: 'nowrap',
                    }}>{step.title} · {step.duration}min</span>
                  </div>
                );
              })}
            </div>

            <div style={{ paddingTop: 14 }}>
              {lesson.steps.map((step, stepIndex) => (
                <StepSection
                  key={step.id}
                  step={step}
                  stepIndex={stepIndex}
                  selectedBlock={selectedBlock}
                  onSelectBlock={setSelectedBlock}
                  onToggleCollapse={() => toggleCollapse(step.id)}
                  onAddBlock={() => setAddBlockStepId(step.id)}
                />
              ))}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                <Btn icon="＋" small>添加 Step</Btn>
              </div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT: Block Properties Inspector ══ */}
        {selectedBlockData && (
          <div style={{
            width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--surface)',
          }}>
            <div style={{
              padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>内容编辑</span>
              <span onClick={() => setSelectedBlock(null)} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 14 }}>✕</span>
            </div>
            <BlockEditor block={selectedBlockData} />
          </div>
        )}

        {/* ── Template Quick Panel (overlay on right) ── */}
        {showTemplatePanel && (
          <TemplateQuickPanel onClose={() => setShowTemplatePanel(false)} />
        )}

        {/* Add block modal */}
        <AddBlockModal stepId={addBlockStepId} onClose={() => setAddBlockStepId(null)} />
      </div>
    </CreatorShell>
  );
}

/* ── Step Section ── */
function StepSection({ step, stepIndex, selectedBlock, onSelectBlock, onToggleCollapse, onAddBlock }) {
  const stepColors = ['var(--teal)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--green)'];
  const color = stepColors[stepIndex % stepColors.length];

  return (
    <div style={{ marginBottom: 12 }}>
      {/* Step Header */}
      <div onClick={onToggleCollapse} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: 'var(--surface)', borderRadius: step.collapsed ? 'var(--r-card)' : 'var(--r-card) var(--r-card) 0 0',
        border: '1px solid var(--border)', borderBottom: step.collapsed ? undefined : '1px solid var(--border)',
        cursor: 'pointer', transition: 'all .1s',
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6, background: color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>{stepIndex + 1}</span>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{step.title}</span>
        <span style={{ fontSize: 11, color: 'var(--t3)' }}>{step.blocks.length} 块 · {step.duration} min</span>
        <span style={{ fontSize: 10, color: 'var(--t3)', transform: step.collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform .15s' }}>▾</span>
      </div>

      {/* Step Content Blocks */}
      {!step.collapsed && (
        <div style={{
          border: '1px solid var(--border)', borderTop: 'none',
          borderRadius: '0 0 var(--r-card) var(--r-card)',
          background: 'var(--bg)', padding: '8px',
        }}>
          {step.blocks.map((block, blockIndex) => (
            <BlockItem
              key={block.id}
              block={block}
              isSelected={selectedBlock === block.id}
              onSelect={() => onSelectBlock(block.id)}
              index={blockIndex}
            />
          ))}
          <button onClick={onAddBlock} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '8px', fontSize: 11, color: 'var(--t3)',
            background: 'transparent', border: '1px dashed var(--border)',
            borderRadius: 'var(--r-input)', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all .1s',
          }}>
            ＋ 添加内容块
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Block Item ── */
function BlockItem({ block, isSelected, onSelect, index }) {
  const meta = BLOCK_TYPE_META[block.type] || BLOCK_TYPE_META.explain;
  const [hovered, setHovered] = React.useState(false);

  return (
    <div onClick={onSelect} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
        marginBottom: 4, borderRadius: 'var(--r-input)',
        background: isSelected ? 'var(--surface)' : hovered ? 'rgba(251,250,247,.6)' : 'transparent',
        border: isSelected ? '1px solid var(--t1)' : '1px solid transparent',
        cursor: 'pointer', transition: 'all .1s',
      }}>
      {/* Drag handle */}
      <span style={{ fontSize: 10, color: 'var(--t3)', cursor: 'grab', opacity: hovered ? 1 : 0, transition: 'opacity .1s' }}>⋮⋮</span>

      {/* Type icon */}
      <span style={{
        width: 28, height: 28, borderRadius: 'var(--r-input)',
        background: meta.bg, color: meta.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, flexShrink: 0,
      }}>{meta.icon}</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 1 }}>{block.title}</div>
        <div style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.desc}</div>
      </div>

      {/* Meta */}
      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: meta.bg, color: meta.color, flexShrink: 0 }}>
        {meta.label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{block.duration}min</span>
    </div>
  );
}

/* ── Right Panel — AI always visible ── */
function RightPanel({ selectedBlock, lesson, aiMessages, aiInput, setAiInput, sendAiMessage }) {
  const [editorCollapsed, setEditorCollapsed] = React.useState(false);

  // Find selected block data
  let blockData = null;
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === selectedBlock);
    if (found) { blockData = found; break; }
  }

  return (
    <div style={{
      width: 360, flexShrink: 0, borderLeft: '1px solid var(--border)',
      background: 'var(--surface)', display: 'flex', flexDirection: 'column',
    }}>
      {/* AI Chat — always on top, always visible, primary */}
      <div style={{
        flex: editorCollapsed || !blockData ? 1 : '0 0 55%',
        display: 'flex', flexDirection: 'column', minHeight: 0,
        transition: 'flex .2s',
      }}>
        {/* AI Header */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(236,234,254,.25), rgba(236,234,254,.05))',
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'var(--purple)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)' }}>AI 助手</span>
          <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 'auto' }}>随时可用</span>
        </div>
        <AIChatPanel
          messages={aiMessages}
          input={aiInput}
          setInput={setAiInput}
          onSend={sendAiMessage}
        />
      </div>

      {/* Block Editor — collapsible bottom section, only when a block is selected */}
      {blockData && (
        <div style={{
          flex: editorCollapsed ? '0 0 36px' : '0 0 45%',
          display: 'flex', flexDirection: 'column', minHeight: 0,
          borderTop: '1px solid var(--border)', transition: 'flex .2s',
        }}>
          <div onClick={() => setEditorCollapsed(!editorCollapsed)} style={{
            padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', flexShrink: 0,
            background: 'var(--surface2)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>内容编辑</span>
            <span style={{
              fontSize: 10, color: 'var(--t3)',
              transform: editorCollapsed ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform .15s',
            }}>▾</span>
          </div>
          {!editorCollapsed && <BlockEditor block={blockData} />}
        </div>
      )}
    </div>
  );
}

/* ── Block Editor ── */
function BlockEditor({ block }) {
  if (!block) return <EmptyState icon="◇" title="选择一个内容块" subtitle="点击左侧内容块进行编辑" />;

  const meta = BLOCK_TYPE_META[block.type] || BLOCK_TYPE_META.explain;

  return (
    <Scr style={{ flex: 1, padding: 16 }}>
      {/* Block type header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{
          width: 32, height: 32, borderRadius: 'var(--r-input)',
          background: meta.bg, color: meta.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
        }}>{meta.icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{block.title}</div>
          <div style={{ fontSize: 10, color: meta.color }}>{meta.label}{block.templateId ? ' · 来自模板' : ' · 自定义'}</div>
        </div>
      </div>

      {/* Form fields */}
      <FieldGroup label="标题">
        <input defaultValue={block.title} style={inputStyle} />
      </FieldGroup>

      <FieldGroup label="内容描述">
        <textarea defaultValue={block.desc} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
      </FieldGroup>

      <FieldGroup label="建议时长（分钟）">
        <input type="number" defaultValue={block.duration} style={{ ...inputStyle, width: 80 }} />
      </FieldGroup>

      {block.templateId && (
        <>
          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }}></div>
          <SectionLabel style={{ marginBottom: 8 }}>数据采集（来自模板）</SectionLabel>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
            {['正确率', '用时', '首次正确率'].map(f => (
              <span key={f} style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 'var(--r-pill)',
                background: 'var(--green-bg)', color: 'var(--green)',
              }}>{f}</span>
            ))}
          </div>

          <SectionLabel style={{ marginBottom: 8 }}>AI 指令</SectionLabel>
          <textarea
            defaultValue="正确率低于 70% 时提醒教师重点讲解"
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6, borderColor: 'rgba(58,49,133,.15)', background: 'rgba(236,234,254,.15)' }}
          />
        </>
      )}

      {/* Preview placeholder */}
      <div style={{
        marginTop: 16, padding: 16, borderRadius: 'var(--r-card)',
        border: '1px dashed var(--border)', background: 'var(--bg)',
        textAlign: 'center', color: 'var(--t3)', fontSize: 11,
      }}>
        内容预览区域
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Btn small style={{ flex: 1 }}>复制</Btn>
        <Btn small variant="danger" style={{ flex: 1 }}>删除</Btn>
      </div>
    </Scr>
  );
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit',
  border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
  background: 'var(--surface)', outline: 'none', color: 'var(--t1)',
};

function FieldGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t2)', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

/* ── AI Chat Panel ── */
function AIChatPanel({ messages, input, setInput, onSend }) {
  const messagesEndRef = React.useRef(null);
  React.useEffect(() => {
    messagesEndRef.current?.scrollTo({ top: messagesEndRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Quick actions */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <SectionLabel style={{ width: '100%', marginBottom: 2 }}>快捷指令</SectionLabel>
        {['分析课程结构', '优化时间分配', '生成练习题', '检查知识覆盖'].map(cmd => (
          <button key={cmd} onClick={() => { setInput(cmd); setTimeout(onSend, 50); }} style={{
            fontSize: 10, padding: '4px 10px', borderRadius: 20,
            border: '1px solid rgba(58,49,133,.2)', background: 'var(--purple-bg)', color: 'var(--purple)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{cmd}</button>
        ))}
      </div>

      {/* Messages */}
      <div ref={messagesEndRef} className="scr" style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
          }}>
            <div style={{
              padding: '10px 12px', borderRadius: 10, fontSize: 12, lineHeight: 1.6,
              background: msg.role === 'user' ? 'var(--t1)' : 'var(--purple-bg)',
              color: msg.role === 'user' ? 'var(--surface)' : 'var(--purple)',
              whiteSpace: 'pre-wrap',
            }}>{msg.text}</div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          placeholder="描述你想要的内容或修改..."
          style={{
            flex: 1, padding: '8px 12px', fontSize: 12, fontFamily: 'inherit',
            border: '1px solid var(--border)', borderRadius: 'var(--r-input-lg)',
            background: 'var(--surface)', outline: 'none', color: 'var(--t1)',
          }}
        />
        <Btn variant="primary" small onClick={onSend}>发送</Btn>
      </div>
    </div>
  );
}

/* ── Template Quick Panel (slide-in from right) ── */
function TemplateQuickPanel({ onClose }) {
  const [search, setSearch] = React.useState('');
  const [activeCat, setActiveCat] = React.useState('all');

  const cats = [
    { id: 'all', label: '全部' },
    { id: 'choice', label: '选择题' },
    { id: 'fill', label: '填空题' },
    { id: 'matching', label: '连线题' },
    { id: 'sorting', label: '排序题' },
    { id: 'poll', label: '投票' },
    { id: 'discuss', label: '讨论' },
    { id: 'video', label: '视频' },
  ];

  const templates = (window.TEMPLATES || []).filter(t => {
    if (activeCat !== 'all' && t.cat !== activeCat) return false;
    if (search && !t.name.includes(search)) return false;
    return true;
  }).slice(0, 12);

  return (
    <div style={{
      position: 'absolute', right: 0, top: 0, bottom: 0, width: 320,
      background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      boxShadow: '-8px 0 24px rgba(0,0,0,.08)', zIndex: 100,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>模板库</span>
        <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)' }}>✕</span>
      </div>
      <div style={{ padding: '10px 16px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="搜索模板..." />
      </div>
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {cats.map(c => (
          <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
            fontSize: 10, padding: '3px 8px', borderRadius: 12,
            border: activeCat === c.id ? '1px solid var(--t1)' : '1px solid var(--border)',
            background: activeCat === c.id ? 'var(--t1)' : 'transparent',
            color: activeCat === c.id ? 'var(--surface)' : 'var(--t3)',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{c.label}</button>
        ))}
      </div>
      <div className="scr" style={{ flex: 1, padding: '0 16px 16px' }}>
        {templates.map(t => {
          const meta = BLOCK_TYPE_META[t.cat] || BLOCK_TYPE_META.explain;
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
              borderRadius: 'var(--r-input)', cursor: 'pointer', marginBottom: 2,
              border: '1px solid transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 6, background: meta.bg, color: meta.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
              }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
              </div>
              <Btn small style={{ flexShrink: 0, padding: '2px 8px', fontSize: 10 }}>插入</Btn>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
        <a href="Template Library.html" style={{ fontSize: 11, color: 'var(--blue)', textDecoration: 'none' }}>
          打开完整模板库 →
        </a>
      </div>
    </div>
  );
}

/* ── Add Block Modal ── */
function AddBlockModal({ stepId, onClose }) {
  if (!stepId) return null;

  const blockTypes = [
    { type: 'explain', label: '讲解页', desc: '教师讲解内容', icon: '▣' },
    { type: 'choice', label: '选择题', desc: '单选/多选自动批改', icon: '○' },
    { type: 'fill', label: '填空题', desc: '关键词或数值填写', icon: '▭' },
    { type: 'truefalse', label: '判断题', desc: '对/错快速检查', icon: '◇' },
    { type: 'matching', label: '连线题', desc: '条件与结论配对', icon: '⟷' },
    { type: 'sorting', label: '排序题', desc: '步骤或事件排序', icon: '↕' },
    { type: 'poll', label: '投票', desc: '全班实时投票', icon: '▮' },
    { type: 'discuss', label: '讨论', desc: 'AI 辅助开放讨论', icon: '◬' },
    { type: 'video', label: '视频', desc: '视频播放+检查点', icon: '▶' },
    { type: 'reading', label: '阅读', desc: '资料阅读任务', icon: '≡' },
  ];

  return (
    <Modal open={!!stepId} onClose={onClose} width={480} title="添加内容块">
      <div style={{ padding: '12px 20px', background: 'var(--purple-bg)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--purple)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ✦ AI 推荐
        </div>
        <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 2 }}>基于当前课程结构和学情数据</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <div style={{ flex: 1, padding: 8, background: 'var(--surface)', borderRadius: 8, cursor: 'pointer' }}>
            <div style={{ fontSize: 11, fontWeight: 500 }}>SSA 反例判断题</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>针对常见误区</div>
          </div>
          <div style={{ flex: 1, padding: 8, background: 'var(--surface)', borderRadius: 8, cursor: 'pointer' }}>
            <div style={{ fontSize: 11, fontWeight: 500 }}>夹角标注题</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>32% 学生薄弱</div>
          </div>
        </div>
      </div>
      <div className="scr" style={{ padding: 16, maxHeight: 320 }}>
        <SectionLabel style={{ marginBottom: 10 }}>全部类型</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {blockTypes.map(bt => {
            const meta = BLOCK_TYPE_META[bt.type] || BLOCK_TYPE_META.explain;
            return (
              <div key={bt.type} onClick={onClose} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: 10,
                border: '1px solid var(--border)', borderRadius: 'var(--r-input)',
                cursor: 'pointer', transition: 'all .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: 6, background: meta.bg, color: meta.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                }}>{bt.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{bt.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>{bt.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>取消</Btn>
      </div>
    </Modal>
  );
}

Object.assign(window, { LessonBuilder });
