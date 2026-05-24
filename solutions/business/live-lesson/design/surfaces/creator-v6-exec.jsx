/* ════════════════════════════════════════════════
   Creator v6 — Exec Canvas (Manual Block/Step Management)
   Component Library · Add / Delete / Move / Duplicate
   ════════════════════════════════════════════════ */

const STEP_COLORS_V6 = ['var(--teal)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--green)'];

/* ── Component template metadata ── */
const COMP_TYPE_DESCS = {
  explain: '教师讲解引导，手动推进到下一步',
  reading: '学生自主阅读课文或材料',
  video: '播放教学相关视频',
  choice: '单选/多选题，系统自动评分',
  fill: '填空题，支持模式匹配评分',
  sorting: '将选项拖拽排列成正确顺序',
  classify: '将项目分类到对应类别',
  discuss: 'AI 引导的 Socratic 对话',
  matrix: '多维度信息提取矩阵填写',
  evidence: '段落功能识别 + 证据选择',
  map: '在二维坐标系上定位与分析',
};

const COMP_CATEGORIES = [
  { id: 'teacher', label: '教师活动', desc: '教师主导，手动推进', color: 'teal', types: ['explain', 'reading', 'video'] },
  { id: 'assess', label: '客观评测', desc: '系统可自动判分', color: 'blue', types: ['choice', 'fill', 'sorting', 'classify'] },
  { id: 'interact', label: '深度交互', desc: '开放式学习活动', color: 'purple', types: ['discuss', 'matrix', 'evidence', 'map'] },
];

/* ── ID counter (shared global) ── */
window._v6IdCounter = 100;

/* ── Factory: default block for a type ── */
function createDefaultBlock(type) {
  const reg = COMP_REG[type] || COMP_REG.explain;
  const id = 'b' + (++window._v6IdCounter);
  const base = {
    id, type, duration: 3,
    completion: { type: reg.defaultCompletion || 'manual' },
    observe: { metrics: [], views: [], rules: [] },
  };
  const defs = {
    explain: { title: '新讲解模块', desc: '教师讲解引导内容' },
    reading: { title: '新阅读任务', desc: '学生自主阅读', duration: 5 },
    video:   { title: '新视频模块', desc: '教学视频播放' },
    choice:  { title: '新选择题', desc: '选择题评测', content: { questions: [{ stem: '题目内容', options: ['选项 A', '选项 B', '选项 C', '选项 D'], correct: 0, tag: '' }] } },
    fill:    { title: '新填空题', desc: '填空评测' },
    sorting: { title: '新排序题', desc: '排序评测' },
    classify:{ title: '新分类题', desc: '分类评测' },
    discuss: { title: '新讨论模块', desc: 'Socratic 对话', duration: 5, ai: { tutorInstruction: '', completionRubric: '' }, content: { goal: '', method: 'socratic', maxRounds: 6 } },
    matrix:  { title: '新矩阵填空', desc: '多维矩阵填写', duration: 5, content: { rows: ['数据项 1'], cols: ['维度 A', '维度 B'] } },
    evidence:{ title: '新证据选择', desc: '段落证据识别', duration: 5, content: { sections: [{ label: '¶1', func: '' }] } },
    map:     { title: '新坐标图', desc: '坐标定位分析', content: { xAxis: { neg: '左端', pos: '右端' }, yAxis: { neg: '下端', pos: '上端' }, items: ['项目 1'] } },
  };
  return { ...base, ...(defs[type] || { title: '新模块', desc: '' }) };
}

/* ── Factory: default step ── */
function createDefaultStep() {
  return {
    id: 's' + (++window._v6IdCounter),
    title: '新步骤', type: '自定义', duration: 0, collapsed: false, blocks: [],
  };
}

/* ── Clone a block (for duplicate) ── */
function cloneBlock(block) {
  const copy = JSON.parse(JSON.stringify(block));
  copy.id = 'b' + (++window._v6IdCounter);
  copy.title = block.title + ' (副本)';
  delete copy.$ref;
  return copy;
}

/* ════════════════════════════════════════════════
   Component Library Modal
   ════════════════════════════════════════════════ */
function ComponentLibraryModal({ open, onClose, onAdd, targetStep }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(28,28,26,.25)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 12, width: 540, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.3 }}>从模板库添加模块</div>
            {targetStep && (
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3 }}>
                添加到: <strong style={{ color: 'var(--t1)' }}>{targetStep.title}</strong>
              </div>
            )}
          </div>
          <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 16, padding: '2px 6px' }}>✕</span>
        </div>

        {/* Body */}
        <div className="scr" style={{ flex: 1, padding: '14px 20px 20px' }}>
          {COMP_CATEGORIES.map(cat => (
            <div key={cat.id} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: `var(--${cat.color})` }}>{cat.label}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
                <span style={{ fontSize: 9, color: 'var(--t3)' }}>{cat.desc}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: 8 }}>
                {cat.types.map(type => {
                  const reg = COMP_REG[type];
                  return reg ? <CompTypeCard key={type} type={type} reg={reg} onClick={() => onAdd(type)} /> : null;
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompTypeCard({ type, reg, onClick }) {
  const [h, setH] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        padding: '14px 10px 10px', borderRadius: 8, cursor: 'pointer',
        border: h ? `1px solid ${reg.color}` : '1px solid var(--border)',
        background: h ? reg.bg : 'var(--bg)', transition: 'all .12s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center',
      }}>
      <span style={{
        width: 34, height: 34, borderRadius: 8, background: reg.bg, color: reg.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>{reg.icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>{reg.label}</span>
      <span style={{ fontSize: 9, color: 'var(--t3)', lineHeight: 1.4 }}>{COMP_TYPE_DESCS[type]}</span>
      <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
        {reg.hasObserve && <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'var(--green-bg)', color: 'var(--green)' }}>观察</span>}
        {type === 'discuss' && <span style={{ fontSize: 7, fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: 'var(--purple-bg)', color: 'var(--purple)' }}>AI</span>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   V6 Exec Canvas (Enhanced)
   ════════════════════════════════════════════════ */
function V6ExecCanvas(props) {
  const { lesson, selectedBlock, pulseBlockId, onSelectBlock, onToggleCollapse, totalBlocks, refBlocks,
    onAddBlock, onDeleteBlock, onMoveBlock, onDuplicateBlock, onUpdateBlock,
    onAddStep, onDeleteStep, onMoveStep, onUpdateStep } = props;

  const [libraryOpen, setLibraryOpen] = React.useState(false);
  const [libraryStepId, setLibraryStepId] = React.useState(null);
  const [hoveredTl, setHoveredTl] = React.useState(null);
  const stepRefs = React.useRef({});
  const scrollRef = React.useRef(null);

  const scrollToStep = (stepId) => {
    const el = stepRefs.current[stepId];
    const container = scrollRef.current;
    if (el && container) {
      const step = lesson.steps.find(s => s.id === stepId);
      if (step && step.collapsed) onToggleCollapse(stepId);
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const offset = elRect.top - containerRect.top + container.scrollTop - 20;
      container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
    }
  };

  const openLibrary = (stepId) => { setLibraryStepId(stepId); setLibraryOpen(true); };
  const handleLibraryAdd = (type) => { onAddBlock(libraryStepId, type); setLibraryOpen(false); };
  const targetStep = lesson.steps.find(s => s.id === libraryStepId);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      {/* Sub-header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 20px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}></div>
        <Btn small onClick={onAddStep} icon="＋">添加步骤</Btn>
      </div>

      {/* Interactive timeline */}
      {lesson.steps.length > 0 && (
        <React.Fragment>
          <div style={{ display: 'flex', gap: 2, height: 10, margin: '0 20px', marginTop: 14, borderRadius: 4, overflow: 'visible', position: 'relative' }}>
            {lesson.steps.map((step, i) => {
              const dur = step.blocks.reduce((s, b) => s + (b.duration || 0), 0) || step.duration || 1;
              const isHov = hoveredTl === step.id;
              return (
                <div key={step.id}
                  onClick={() => scrollToStep(step.id)}
                  onMouseEnter={() => setHoveredTl(step.id)}
                  onMouseLeave={() => setHoveredTl(null)}
                  style={{
                    flex: dur, position: 'relative', cursor: 'pointer',
                    background: STEP_COLORS_V6[i % STEP_COLORS_V6.length],
                    opacity: isHov ? .8 : .3, transition: 'opacity .15s',
                    borderRadius: i === 0 && i === lesson.steps.length - 1 ? 4 : i === 0 ? '4px 0 0 4px' : i === lesson.steps.length - 1 ? '0 4px 4px 0' : 0,
                  }}>
                  {isHov && (
                    <div style={{
                      position: 'absolute', bottom: -24, left: 0, zIndex: 10,
                      padding: '3px 8px', borderRadius: 4,
                      background: 'var(--t1)', color: 'var(--surface)',
                      fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}>
                      {step.title} · {step.blocks.length}模块 · {dur}min
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 2, margin: '4px 20px 0' }}>
            {lesson.steps.map((step, i) => {
              const dur = step.blocks.reduce((s, b) => s + (b.duration || 0), 0) || step.duration || 1;
              return <div key={step.id} style={{ flex: dur, fontSize: 9, color: 'var(--t3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.title}</div>;
            })}
          </div>
        </React.Fragment>
      )}

      {/* Steps list */}
      <div ref={scrollRef} className="scr" style={{ flex: 1, padding: '30px 20px 40px' }}>
        {lesson.steps.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 32, opacity: .3, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>暂无步骤</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 16 }}>添加步骤开始构建执行流</div>
            <Btn variant="primary" small onClick={onAddStep} icon="＋">添加第一个步骤</Btn>
          </div>
        )}
        {lesson.steps.map((step, si) => (
          <div key={step.id} ref={el => stepRefs.current[step.id] = el}>
            <V6StepSection step={step} stepIndex={si} stepCount={lesson.steps.length}
              selectedBlock={selectedBlock} pulseBlockId={pulseBlockId} onSelectBlock={onSelectBlock}
              onToggleCollapse={() => onToggleCollapse(step.id)}
              onOpenLibrary={() => openLibrary(step.id)}
              onDeleteBlock={onDeleteBlock} onMoveBlock={onMoveBlock}
              onDuplicateBlock={onDuplicateBlock} onUpdateBlock={onUpdateBlock}
              onDeleteStep={() => onDeleteStep(step.id)}
              onMoveStep={(dir) => onMoveStep(step.id, dir)}
              onUpdateStep={(upd) => onUpdateStep(step.id, upd)}
            />
          </div>
        ))}
        {lesson.steps.length > 0 && (
          <V6AddStepBtn onClick={onAddStep} />
        )}
      </div>

      <ComponentLibraryModal open={libraryOpen} onClose={() => setLibraryOpen(false)}
        onAdd={handleLibraryAdd} targetStep={targetStep} />
    </div>
  );
}

/* ── Add step dashed button ── */
function V6AddStepBtn({ onClick }) {
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        width: '100%', padding: 14, marginTop: 8,
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        color: h ? 'var(--blue)' : 'var(--t3)',
        background: h ? 'var(--blue-bg)' : 'transparent',
        border: h ? '2px dashed var(--blue)' : '2px dashed var(--border)',
        borderRadius: 'var(--r-card)', cursor: 'pointer', transition: 'all .15s',
      }}>＋ 添加步骤</button>
  );
}

/* ── Shared micro-button styles ── */
const v6StepActBtn = { width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--t3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontFamily: 'inherit', flexShrink: 0, padding: 0, transition: 'all .1s' };
const v6BlockActBtn = { width: 20, height: 20, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--t3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontFamily: 'inherit', flexShrink: 0, padding: 0, transition: 'all .1s' };

/* ════════════════════════════════════════════════
   V6 Step Section (Enhanced)
   ════════════════════════════════════════════════ */
function V6StepSection({ step, stepIndex, stepCount, selectedBlock, pulseBlockId, onSelectBlock, onToggleCollapse, onOpenLibrary, onDeleteBlock, onMoveBlock, onDuplicateBlock, onUpdateBlock, onDeleteStep, onMoveStep, onUpdateStep }) {
  const color = STEP_COLORS_V6[stepIndex % STEP_COLORS_V6.length];
  const [hovered, setHovered] = React.useState(false);
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleVal, setTitleVal] = React.useState(step.title);
  const [editingType, setEditingType] = React.useState(false);
  const [typeVal, setTypeVal] = React.useState(step.type);
  const [showDel, setShowDel] = React.useState(false);

  React.useEffect(() => { setTitleVal(step.title); }, [step.title]);
  React.useEffect(() => { setTypeVal(step.type); }, [step.type]);

  const dur = step.blocks.reduce((s, b) => s + (b.duration || 0), 0);

  const saveTitle = () => { if (titleVal.trim()) onUpdateStep({ title: titleVal.trim() }); setEditingTitle(false); };
  const saveType = () => { if (typeVal.trim()) onUpdateStep({ type: typeVal.trim() }); setEditingType(false); };

  return (
    <div style={{ marginBottom: 12, position: 'relative' }}>
      {/* Header */}
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => { setHovered(false); setShowDel(false); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          background: 'var(--surface)',
          borderRadius: step.collapsed ? 'var(--r-card)' : 'var(--r-card) var(--r-card) 0 0',
          border: '1px solid var(--border)',
        }}>
        <span style={{ width: 24, height: 24, borderRadius: 6, background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{stepIndex + 1}</span>

        {editingTitle ? (
          <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
            onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(step.title); setEditingTitle(false); } }}
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 13, fontWeight: 600, border: '1px solid var(--blue)', borderRadius: 4, padding: '2px 8px', background: 'var(--blue-bg)', outline: 'none', fontFamily: 'inherit', color: 'var(--t1)', flex: 1, minWidth: 60 }} />
        ) : (
          <span onClick={() => setEditingTitle(true)} style={{ fontSize: 13, fontWeight: 600, cursor: 'text', flex: 1 }} title="点击编辑">{step.title}</span>
        )}

        {editingType ? (
          <input autoFocus value={typeVal} onChange={e => setTypeVal(e.target.value)}
            onBlur={saveType} onKeyDown={e => { if (e.key === 'Enter') saveType(); if (e.key === 'Escape') { setTypeVal(step.type); setEditingType(false); } }}
            onClick={e => e.stopPropagation()}
            style={{ fontSize: 10, border: '1px solid var(--blue)', borderRadius: 3, padding: '1px 6px', background: 'var(--blue-bg)', outline: 'none', fontFamily: 'inherit', color: 'var(--t3)', width: 80 }} />
        ) : (
          <span onClick={() => setEditingType(true)} style={{ fontSize: 10, color: 'var(--t3)', cursor: 'text' }} title="点击编辑类型">{step.type}</span>
        )}

        <span style={{ fontSize: 10, color: 'var(--t3)' }}>{step.blocks.length} 模块 · {dur || step.duration}min</span>

        {/* Step actions */}
        {hovered && !editingTitle && !editingType && (
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            {stepIndex > 0 && <button onClick={e => { e.stopPropagation(); onMoveStep(-1); }} style={v6StepActBtn} title="上移步骤">↑</button>}
            {stepIndex < stepCount - 1 && <button onClick={e => { e.stopPropagation(); onMoveStep(1); }} style={v6StepActBtn} title="下移步骤">↓</button>}
            <button onClick={e => { e.stopPropagation(); setShowDel(true); }} style={{ ...v6StepActBtn, color: 'var(--red)' }} title="删除步骤">✕</button>
          </div>
        )}

        <span onClick={onToggleCollapse} style={{ fontSize: 10, color: 'var(--t3)', transform: step.collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform .15s', cursor: 'pointer', padding: 4 }}>▾</span>

        {/* Delete confirmation */}
        {showDel && (
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: '100%', right: 14, zIndex: 60,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
            padding: 14, width: 240, marginTop: 4,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>删除步骤？</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.5 }}>
              将删除「{step.title}」及其 {step.blocks.length} 个模块。此操作不可撤销。
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <Btn small onClick={() => setShowDel(false)}>取消</Btn>
              <Btn small variant="danger" onClick={() => { setShowDel(false); onDeleteStep(); }}>删除</Btn>
            </div>
          </div>
        )}
      </div>

      {/* Blocks area */}
      {!step.collapsed && (
        <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 var(--r-card) var(--r-card)', background: 'var(--bg)', padding: 8 }}>
          {step.blocks.length === 0 && (
            <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>暂无模块 — 从模板库添加</div>
          )}
          {step.blocks.map((block, bi) => (
            <V6BlockItem key={block.id} block={block} blockIndex={bi} blockCount={step.blocks.length}
              isSelected={selectedBlock === block.id}
              isPulsing={pulseBlockId === block.id}
              onSelect={() => onSelectBlock(block.id)}
              onDelete={() => onDeleteBlock(block.id)}
              onMove={(dir) => onMoveBlock(block.id, step.id, dir)}
              onDuplicate={() => onDuplicateBlock(block.id, step.id)}
              onUpdate={(upd) => onUpdateBlock(block.id, upd)}
            />
          ))}
          <V6AddBlockBtn onClick={onOpenLibrary} />
        </div>
      )}
    </div>
  );
}

/* ── Add block dashed button ── */
function V6AddBlockBtn({ onClick }) {
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        width: '100%', padding: 8, marginTop: 4,
        fontSize: 10, fontWeight: 500, fontFamily: 'inherit',
        color: h ? 'var(--blue)' : 'var(--t3)',
        background: h ? 'var(--blue-bg)' : 'transparent',
        border: h ? '1px dashed var(--blue)' : '1px dashed var(--border)',
        borderRadius: 'var(--r-input)', cursor: 'pointer', transition: 'all .12s',
      }}>＋ 从模板库添加模块</button>
  );
}

/* ════════════════════════════════════════════════
   V6 Block Item (Enhanced)
   ════════════════════════════════════════════════ */
function V6BlockItem({ block, blockIndex, blockCount, isSelected, isPulsing, onSelect, onDelete, onMove, onDuplicate, onUpdate }) {
  const reg = COMP_REG[block.type] || COMP_REG.explain;
  const [hovered, setHovered] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(false);
  const [titleVal, setTitleVal] = React.useState(block.title);
  const [editDur, setEditDur] = React.useState(false);
  const [durVal, setDurVal] = React.useState(block.duration);

  React.useEffect(() => { setTitleVal(block.title); }, [block.title]);
  React.useEffect(() => { setDurVal(block.duration); }, [block.duration]);

  const enabledMetrics = (block.observe?.metrics || []).filter(m => m.enabled);
  const rulesCount = (block.observe?.rules || []).length;
  const comp = block.completion || {};
  const compType = COMPLETION_TYPES.find(c => c.id === comp.type);

  const saveTitle = () => { if (titleVal.trim()) onUpdate({ title: titleVal.trim() }); setEditTitle(false); };
  const saveDur = () => { const v = parseInt(durVal); if (v > 0) onUpdate({ duration: v }); setEditDur(false); };

  return (
    <div onClick={onSelect} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className={isPulsing ? 'v6-block-pulse' : ''}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4,
        borderRadius: 'var(--r-input)',
        background: isSelected ? 'var(--surface)' : hovered ? 'rgba(251,250,247,.6)' : 'transparent',
        border: isSelected ? '1px solid var(--t1)' : '1px solid transparent',
        cursor: 'pointer', transition: 'all .1s',
      }}>
      {/* Move arrows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0, width: 14, opacity: hovered ? 1 : 0, transition: 'opacity .1s' }}>
        {blockIndex > 0 ? (
          <span onClick={e => { e.stopPropagation(); onMove(-1); }} style={{ fontSize: 7, color: 'var(--t3)', cursor: 'pointer', lineHeight: 1.2, textAlign: 'center' }} title="上移">▲</span>
        ) : <span style={{ fontSize: 7, lineHeight: 1.2, visibility: 'hidden' }}>▲</span>}
        <span style={{ fontSize: 10, color: 'var(--t3)', cursor: 'grab', textAlign: 'center', lineHeight: 1 }}>⋮⋮</span>
        {blockIndex < blockCount - 1 ? (
          <span onClick={e => { e.stopPropagation(); onMove(1); }} style={{ fontSize: 7, color: 'var(--t3)', cursor: 'pointer', lineHeight: 1.2, textAlign: 'center' }} title="下移">▼</span>
        ) : <span style={{ fontSize: 7, lineHeight: 1.2, visibility: 'hidden' }}>▼</span>}
      </div>

      {/* Icon */}
      <span style={{
        width: 28, height: 28, borderRadius: 'var(--r-input)', background: reg.bg, color: reg.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
      }}>{reg.icon}</span>

      {/* Title + desc */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {editTitle ? (
            <input autoFocus value={titleVal} onChange={e => setTitleVal(e.target.value)}
              onClick={e => e.stopPropagation()} onBlur={saveTitle}
              onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') { setTitleVal(block.title); setEditTitle(false); } }}
              style={{ fontSize: 12, fontWeight: 500, border: '1px solid var(--blue)', borderRadius: 3, padding: '1px 6px', background: 'var(--blue-bg)', outline: 'none', fontFamily: 'inherit', color: 'var(--t1)', maxWidth: 200, width: '100%' }} />
          ) : (
            <span onDoubleClick={e => { e.stopPropagation(); setEditTitle(true); }} style={{ fontSize: 12, fontWeight: 500 }} title="双击编辑">{block.title}</span>
          )}
          {block.$ref && (
            <span onClick={e => { e.stopPropagation(); if (window.__v7OpenFileByRef) window.__v7OpenFileByRef(block.$ref); }}
              style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: 'var(--blue-bg)', color: 'var(--blue)', fontFamily: 'ui-monospace, monospace', cursor: 'pointer' }} title={block.$ref}>🔗 ref</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {block.$ref ? <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9 }}>{block.$ref}</span> : block.desc}
        </div>
      </div>

      {/* Status badges */}
      {block.ai && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>AI</span>}
      {enabledMetrics.length > 0 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--green)', background: 'var(--green-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>📊{enabledMetrics.length}</span>}
      {rulesCount > 0 && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--purple)', background: 'var(--purple-bg)', padding: '1px 6px', borderRadius: 8, flexShrink: 0 }}>⚡{rulesCount}</span>}
      {compType && <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 8, flexShrink: 0,
        background: comp.type === 'ai_eval' ? 'var(--purple-bg)' : comp.type === 'hard' ? 'var(--green-bg)' : 'var(--surface2)',
        color: comp.type === 'ai_eval' ? 'var(--purple)' : comp.type === 'hard' ? 'var(--green)' : 'var(--t3)',
      }}>{compType.icon}</span>}
      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 'var(--r-pill)', background: reg.bg, color: reg.color, flexShrink: 0 }}>{reg.label}</span>

      {/* Duration (click-to-edit) */}
      {editDur ? (
        <input autoFocus value={durVal} type="number" min={1} max={60}
          onChange={e => setDurVal(e.target.value)} onClick={e => e.stopPropagation()} onBlur={saveDur}
          onKeyDown={e => { if (e.key === 'Enter') saveDur(); if (e.key === 'Escape') { setDurVal(block.duration); setEditDur(false); } }}
          style={{ width: 40, fontSize: 10, border: '1px solid var(--blue)', borderRadius: 3, padding: '1px 4px', background: 'var(--blue-bg)', outline: 'none', fontFamily: 'inherit', color: 'var(--t1)', textAlign: 'center', flexShrink: 0 }} />
      ) : (
        <span onClick={e => { e.stopPropagation(); setEditDur(true); }} style={{
          fontSize: 10, color: 'var(--t3)', flexShrink: 0, cursor: 'pointer', padding: '2px 4px',
          borderRadius: 3, background: hovered ? 'var(--surface2)' : 'transparent', transition: 'background .1s',
        }} title="点击编辑时长">{block.duration}min</span>
      )}

      {/* Hover action buttons */}
      {hovered && !editTitle && !editDur && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onDuplicate(); }} style={v6BlockActBtn} title="复制模块">⊕</button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ ...v6BlockActBtn, color: 'var(--red)', borderColor: 'rgba(148,48,41,.15)' }} title="删除模块">✕</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  V6ExecCanvas, V6StepSection, V6BlockItem,
  ComponentLibraryModal, CompTypeCard,
  V6AddStepBtn, V6AddBlockBtn,
  createDefaultBlock, createDefaultStep, cloneBlock,
  STEP_COLORS_V6, COMP_CATEGORIES, COMP_TYPE_DESCS,
});
