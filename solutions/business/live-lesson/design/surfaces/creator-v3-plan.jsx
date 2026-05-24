/* ════════════════════════════════════════════════
   Creator v3 — 教案设计 Tab (with Requirements Picker)
   ════════════════════════════════════════════════ */

/* ── Academic Requirements Library (学业要求库) ── */
const REQUIREMENTS_LIBRARY = [
  { id: 'cat-lang', category: '语言能力', color: 'teal', items: [
    { id: 'lib-r1', text: '通过上下文线索推断生词含义', standard: '课标 2.1.3' },
    { id: 'lib-r2', text: '识别并分析语篇结构信号词', standard: '课标 2.1.5' },
    { id: 'lib-r3', text: '理解长难句的主干结构与修饰成分', standard: '课标 2.1.7' },
    { id: 'lib-r4', text: '辨别不同语篇类型的语言特征', standard: '课标 2.2.1' },
  ]},
  { id: 'cat-read', category: '阅读策略', color: 'blue', items: [
    { id: 'lib-r5', text: '运用 skimming / scanning 阅读策略完成信息提取', standard: '课标 3.2.1' },
    { id: 'lib-r6', text: '识别课文中的语篇结构（如：现象→历史→文化→结论）', standard: '课标 3.2.4' },
    { id: 'lib-r7', text: '根据标题、图片和首段预测文章主旨', standard: '课标 3.2.2' },
    { id: 'lib-r8', text: '利用思维导图或矩阵整理多维度信息', standard: '课标 3.2.6' },
  ]},
  { id: 'cat-think', category: '思维品质', color: 'purple', items: [
    { id: 'lib-r9', text: '分析至少 3 种文化中美的实践的目的和意义', standard: '课标 4.1.2' },
    { id: 'lib-r10', text: '批判性评价作者对现代媒体美的标准的观点', standard: '课标 4.1.4' },
    { id: 'lib-r11', text: '运用证据支持或反驳论点', standard: '课标 4.1.5' },
    { id: 'lib-r12', text: '比较不同立场并形成独立判断', standard: '课标 4.1.6' },
  ]},
  { id: 'cat-culture', category: '文化意识', color: 'amber', items: [
    { id: 'lib-r13', text: '理解 "beauty practices as cultural language" 的核心论点', standard: '课标 5.1.1' },
    { id: 'lib-r14', text: '反思媒体对审美标准的影响', standard: '课标 5.1.3' },
    { id: 'lib-r15', text: '尊重并理解不同文化的价值观差异', standard: '课标 5.1.5' },
  ]},
];

/* Map from current plan requirements to library IDs */
const PLAN_TO_LIB = { 'r1': 'lib-r6', 'r2': 'lib-r13', 'r3': 'lib-r9', 'r4': 'lib-r10', 'r5': 'lib-r5' };

/* ════════════════════════════════════════════════ */
function PlanTab() {
  const [plan] = React.useState(PLAN_DATA);
  const [editingReq, setEditingReq] = React.useState(null);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [outlinePickerOpen, setOutlinePickerOpen] = React.useState(false);
  const [textPickerOpen, setTextPickerOpen] = React.useState(false);
  const [selectedText, setSelectedText] = React.useState('ideal-beauty');

  /* Track which library items are selected (init from current plan) */
  const [selectedLibIds, setSelectedLibIds] = React.useState(() => {
    return new Set(Object.values(PLAN_TO_LIB));
  });

  const toggleLibItem = (libId) => {
    setSelectedLibIds(prev => {
      const next = new Set(prev);
      if (next.has(libId)) next.delete(libId); else next.add(libId);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Document editor — full width */}
      <div className="scr" style={{ flex: 1, padding: '28px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 32px' }}>
          {/* Lesson info header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>关联课文</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input defaultValue={plan.lessonInfo.title} style={{
                fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', border: 'none', background: 'transparent',
                fontFamily: 'inherit', color: 'var(--t1)', outline: 'none', padding: '4px 0', flex: 1,
              }} />
              <button onClick={() => setTextPickerOpen(true)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                fontSize: 10, fontWeight: 500, fontFamily: 'inherit', borderRadius: 6,
                cursor: 'pointer', border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--t3)', whiteSpace: 'nowrap', flexShrink: 0,
              }}>切换课文</button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <Badge color="teal">{plan.lessonInfo.subject}</Badge>
              <Badge>{plan.lessonInfo.grade}</Badge>
              <Badge color="amber">{plan.lessonInfo.duration} 分钟</Badge>
              <Badge>{plan.lessonInfo.source}</Badge>
            </div>
          </div>

          <PlanDivider />

          {/* Teaching Requirements */}
          <PlanSection label="教学要求" tag={`${plan.teachingRequirements.length} 项已选`} tagColor="teal">
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.6 }}>
              从学业要求库中选取本节课需要覆盖的教学内容。
            </div>
            {plan.teachingRequirements.map((req, i) => {
              const libId = PLAN_TO_LIB[req.id];
              const libItem = libId && REQUIREMENTS_LIBRARY.flatMap(c => c.items).find(it => it.id === libId);
              const cat = libId && REQUIREMENTS_LIBRARY.find(c => c.items.some(it => it.id === libId));
              return (
                <div key={req.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0',
                  borderBottom: i < plan.teachingRequirements.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                    background: cat ? `var(--${cat.color}-bg)` : 'var(--surface2)',
                    color: cat ? `var(--${cat.color})` : 'var(--t3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    {editingReq === req.id ? (
                      <textarea defaultValue={req.text} autoFocus rows={2}
                        onBlur={() => setEditingReq(null)}
                        style={{ width: '100%', fontSize: 13, fontFamily: 'inherit', color: 'var(--t1)',
                          border: '1px solid var(--blue)', borderRadius: 4, padding: '4px 8px',
                          background: 'var(--blue-bg)', outline: 'none', resize: 'vertical', lineHeight: 1.6 }} />
                    ) : (
                      <span onClick={() => setEditingReq(req.id)}
                        style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6, cursor: 'text' }}>
                        {req.text}
                      </span>
                    )}
                    {libItem && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: `var(--${cat.color})`, background: `var(--${cat.color}-bg)`, padding: '1px 6px', borderRadius: 3 }}>{cat.category}</span>
                        <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'ui-monospace, monospace' }}>{libItem.standard}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <button onClick={() => setPickerOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', marginTop: 8,
              fontSize: 11, fontWeight: 500, width: '100%',
              color: 'var(--teal)', background: 'var(--teal-bg)',
              border: '1px dashed rgba(23,105,99,.2)', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 12 }}>◇</span>
              从学业要求库选取
            </button>
          </PlanSection>

          <PlanDivider />

          {/* Objectives */}
          <PlanSection label="核心素养目标" tag="新课标" tagColor="purple">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {plan.objectives.map((obj, oi) => (
                <div key={oi}>
                  <Badge color="teal" style={{ marginBottom: 8 }}>{obj.category}</Badge>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {obj.items.map((item, ii) => (
                      <div key={ii} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: 4 }}>
                        <span style={{ color: 'var(--teal)', fontSize: 8, marginTop: 5, flexShrink: 0 }}>●</span>
                        <span style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PlanSection>

          <PlanDivider />

          {/* Module outline */}
          <PlanSection label="大模块划分" tag={`${plan.moduleOutline.length} 个阶段`} tagColor="blue">
            <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 10, lineHeight: 1.6 }}>
              定义课程的宏观结构。执行设计中的 Step 应对应这些阶段。
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {plan.moduleOutline.map((mod, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
                }}>
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: ['var(--teal)','var(--blue)','var(--purple)','var(--amber)','var(--green)'][i],
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{mod.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)' }}>{mod.desc}</div>
                  </div>
                  <Badge>{mod.time} min</Badge>
                </div>
              ))}
            </div>
            <button onClick={() => setOutlinePickerOpen(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', marginTop: 8,
              fontSize: 11, fontWeight: 500, width: '100%',
              color: 'var(--blue)', background: 'var(--blue-bg)',
              border: '1px dashed rgba(26,95,160,.2)', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 12 }}>▣</span>
              从模板库选取课程结构
            </button>
          </PlanSection>

          <div style={{ height: 60 }} />
        </div>
      </div>

      {/* Requirements Picker */}
      {pickerOpen && (
        <RequirementsPicker selectedIds={selectedLibIds} onToggle={toggleLibItem} onClose={() => setPickerOpen(false)} />
      )}

      {/* Outline Picker */}
      {outlinePickerOpen && (
        <OutlineTemplatePicker onClose={() => setOutlinePickerOpen(false)} />
      )}

      {/* Text Picker */}
      {textPickerOpen && (
        <TextPicker selected={selectedText} onSelect={(id) => { setSelectedText(id); setTextPickerOpen(false); }} onClose={() => setTextPickerOpen(false)} />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Requirements Picker Modal
   ════════════════════════════════════════════════ */
function RequirementsPicker({ selectedIds, onToggle, onClose }) {
  const [search, setSearch] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState(null);

  const filtered = REQUIREMENTS_LIBRARY.map(cat => ({
    ...cat,
    items: cat.items.filter(it =>
      !search || it.text.includes(search) || it.standard.includes(search)
    ),
  })).filter(cat => cat.items.length > 0 && (!activeCategory || cat.id === activeCategory));

  const totalSelected = selectedIds.size;
  const allItems = REQUIREMENTS_LIBRARY.flatMap(c => c.items);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(28,28,26,.25)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', borderRadius: 12, width: 580, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: -.3 }}>学业要求库</span>
            <Badge color="teal">{totalSelected}/{allItems.length} 已选</Badge>
            <div style={{ flex: 1 }}></div>
            <span style={{ fontSize: 9, color: 'var(--t3)' }}>Esc 关闭</span>
            <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 16, padding: '2px 6px' }}>✕</span>
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--t3)', pointerEvents: 'none' }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索要求或课标编号..."
              style={{
                width: '100%', padding: '8px 12px 8px 30px', fontSize: 12, fontFamily: 'inherit',
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--bg)', outline: 'none', color: 'var(--t1)', boxSizing: 'border-box',
              }} />
          </div>
          {/* Category filter */}
          <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <button onClick={() => setActiveCategory(null)} style={{
              padding: '4px 10px', fontSize: 10, fontWeight: activeCategory === null ? 600 : 400,
              fontFamily: 'inherit', borderRadius: 6, cursor: 'pointer',
              border: activeCategory === null ? '1px solid var(--t1)' : '1px solid var(--border)',
              background: activeCategory === null ? 'var(--t1)' : 'var(--bg)',
              color: activeCategory === null ? 'var(--surface)' : 'var(--t3)',
            }}>全部</button>
            {REQUIREMENTS_LIBRARY.map(cat => {
              const catSelected = cat.items.filter(it => selectedIds.has(it.id)).length;
              return (
                <button key={cat.id} onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', fontSize: 10, fontWeight: activeCategory === cat.id ? 600 : 400,
                  fontFamily: 'inherit', borderRadius: 6, cursor: 'pointer',
                  border: activeCategory === cat.id ? `1px solid var(--${cat.color})` : '1px solid var(--border)',
                  background: activeCategory === cat.id ? `var(--${cat.color}-bg)` : 'var(--bg)',
                  color: activeCategory === cat.id ? `var(--${cat.color})` : 'var(--t3)',
                }}>
                  {cat.category}
                  {catSelected > 0 && <span style={{ fontSize: 8, fontWeight: 700, padding: '0 4px', borderRadius: 6, background: `var(--${cat.color}-bg)`, color: `var(--${cat.color})` }}>{catSelected}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="scr" style={{ flex: 1, padding: '12px 20px 20px' }}>
          {filtered.map(cat => (
            <div key={cat.id} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: `var(--${cat.color})` }}>{cat.category}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
                <span style={{ fontSize: 9, color: 'var(--t3)' }}>{cat.items.filter(it => selectedIds.has(it.id)).length}/{cat.items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {cat.items.map(item => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <ReqLibItem key={item.id} item={item} catColor={cat.color}
                      isSelected={isSelected} onToggle={() => onToggle(item.id)} />
                  );
                })}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              无匹配结果
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--t2)' }}>
            已选择 <strong style={{ color: 'var(--teal)' }}>{totalSelected}</strong> 项学业要求
          </div>
          <Btn small onClick={onClose}>取消</Btn>
          <Btn small variant="primary" onClick={onClose}>确认选择</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── Single requirement item in picker ── */
function ReqLibItem({ item, catColor, isSelected, onToggle }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
        borderRadius: 8, cursor: 'pointer', transition: 'all .12s',
        background: isSelected ? `var(--${catColor}-bg)` : hov ? 'var(--bg)' : 'transparent',
        border: isSelected ? `1px solid var(--${catColor})` : '1px solid transparent',
      }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
        border: isSelected ? `2px solid var(--${catColor})` : '2px solid var(--border)',
        background: isSelected ? `var(--${catColor})` : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .12s',
      }}>
        {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>✓</span>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.6 }}>{item.text}</div>
        <div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'ui-monospace, monospace', marginTop: 2 }}>{item.standard}</div>
      </div>
    </div>
  );
}

/* ── Plan helpers ── */
function PlanSection({ label, tag, tagColor, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</span>
        {tag && <Badge color={tagColor}>{tag}</Badge>}
      </div>
      {children}
    </div>
  );
}

function PlanDivider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />;
}

Object.assign(window, { PlanTab });
