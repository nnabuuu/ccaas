/* ════════════════════════════════════════════════
   Creator v6 — Left-side AI Panel (primary surface)
   Project header · Context-aware chat · Quick actions · Insights
   ════════════════════════════════════════════════ */

/* ── Context helpers (reused from v5 logic) ── */
function v6FindBlock(lesson, blockId) {
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === blockId);
    if (found) return found;
  }
  return null;
}

function v6GetContextLabel(activeTab, selectedBlock, lesson) {
  if (activeTab === 'plan') return { label: '教案设计', icon: '📝', color: 'teal' };
  if (activeTab === 'skills') return { label: 'Skill 定义', icon: '⚙️', color: 'purple' };
  if (activeTab === 'review') return { label: 'Review 审计', icon: '👁', color: 'green' };
  if (activeTab === 'exec' && selectedBlock) {
    const block = v6FindBlock(lesson, selectedBlock);
    if (block) {
      const reg = COMP_REG[block.type] || COMP_REG.explain;
      return { label: block.title, icon: reg.icon, color: null, reg };
    }
  }
  return { label: '执行设计', icon: '📋', color: 'blue' };
}

function v6GetSuggestions(activeTab, selectedBlock, lesson) {
  const base = [];
  if (activeTab === 'plan') {
    base.push(
      { id: 'p1', icon: '✦', label: '根据教学要求生成教案', color: 'purple' },
      { id: 'p2', icon: '◇', label: '检查要求覆盖完整性', color: 'teal' },
      { id: 'p3', icon: '▸', label: '从课标补全素养目标', color: 'blue' },
    );
  } else if (activeTab === 'exec') {
    if (selectedBlock) {
      const block = v6FindBlock(lesson, selectedBlock);
      if (block) {
        if (block.type === 'discuss') {
          base.push(
            { id: 'd1', icon: '✎', label: '优化 Completion Rubric', color: 'coral' },
            { id: 'd2', icon: '✦', label: '改进 Tutor Instruction', color: 'purple' },
            { id: 'd3', icon: '↕', label: '生成兜底选择题', color: 'amber' },
          );
        } else if (block.type === 'choice') {
          base.push(
            { id: 'c1', icon: '○', label: '优化干扰项质量', color: 'blue' },
            { id: 'c2', icon: '＋', label: '生成相似题目', color: 'blue' },
          );
        } else if (block.type === 'matrix') {
          base.push(
            { id: 'm1', icon: '◈', label: '为 Why 列生成支架', color: 'teal' },
            { id: 'm2', icon: '✓', label: '生成参考答案', color: 'green' },
          );
        } else if (block.type === 'evidence') {
          base.push(
            { id: 'e1', icon: '◈', label: '标注结构信号词', color: 'teal' },
          );
        } else if (block.type === 'map') {
          base.push(
            { id: 'mp1', icon: '◎', label: '设置参考坐标', color: 'blue' },
          );
        }
        const reg = COMP_REG[block.type] || COMP_REG.explain;
        if (reg.hasObserve) {
          base.push({ id: 'obs', icon: '⚡', label: '推荐干预规则', color: 'purple' });
        }
      }
    } else {
      base.push(
        { id: 'x1', icon: '▣', label: '优化执行顺序', color: 'blue' },
        { id: 'x2', icon: '◎', label: '检查时间分配', color: 'amber' },
      );
    }
  } else if (activeTab === 'review') {
    base.push(
      { id: 'rv1', icon: '◇', label: '重新运行审计', color: 'teal' },
      { id: 'rv2', icon: '✦', label: '自动修复建议项', color: 'purple' },
    );
  }
  return base;
}

/* ── Insights data ── */
const V6_INSIGHTS = [
  { id: 'i1', sev: 'info', title: 'Rubric 可增强', text: 'discuss-cultural.json 的 rubric 可增加"引用课文外例子"。', mod: 'b7' },
  { id: 'i2', sev: 'warn', title: 'Wrap-up 时间偏紧', text: 'Step 5 仅 5min，策略分类题可能时间不足。', mod: null },
  { id: 'i3', sev: 'ok', title: '教学要求全覆盖', text: '5 项教学要求已被执行设计模块覆盖。', mod: null },
];

/* ════════════════════════════════════════════════
   Main Left Panel
   ════════════════════════════════════════════════ */
function AILeftPanel({ lesson, activeTab, selectedBlock, onNavigate }) {
  const [mode, setMode] = React.useState('chat'); // chat | insights
  const [messages, setMessages] = React.useState([
    { role: 'ai', text: '已分析课程项目「Ideal Beauty」。\n\n· 教案 5 项教学要求全部覆盖\n· 执行流 5 Steps / 13 模块（9 ref）\n· 3 条干预规则已配置\n\n建议：discuss-cultural.json 的 rubric 可增加"引用课文外例子"。', ts: '2min ago' },
  ]);
  const [inputVal, setInputVal] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const [dismissed, setDismissed] = React.useState([]);
  const chatRef = React.useRef(null);

  const ctx = v6GetContextLabel(activeTab, selectedBlock, lesson);
  const suggestions = v6GetSuggestions(activeTab, selectedBlock, lesson);
  const insights = V6_INSIGHTS.filter(i => !dismissed.includes(i.id));

  const send = (text) => {
    if (!text.trim()) return;
    setMessages(p => [...p, { role: 'user', text: text.trim(), ts: '刚才' }]);
    setInputVal('');
    setThinking(true);
    setTimeout(() => {
      const resps = [
        '已分析当前模块配置。建议将 Tutor Instruction 中的引导策略具体化，指定段落范围（¶5-7）作为证据来源。',
        '检查完毕。观察维度配置合理。建议为「薄弱维度」增加自动推送支架的规则。',
        '已对比教案与执行设计。所有要求已覆盖。discuss-evaluate.json 同时承接"批判性评价"和"运用证据"两项要求。',
        '分析完成。当前模块的完成条件设定合理，AI 评估兜底时间 600s 适合 Socratic 对话场景。',
      ];
      setMessages(p => [...p, { role: 'ai', text: resps[Math.floor(Math.random() * resps.length)], ts: '刚才' }]);
      setThinking(false);
    }, 1200);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputVal); }
  };

  const handleSugClick = (sug) => {
    send(sug.label);
  };

  React.useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, thinking]);

  return (
    <div style={{
      width: 340, flexShrink: 0, borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      background: 'var(--surface)',
    }}>
      {/* ── Project header ── */}
      <div style={{
        padding: '14px 18px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: 'var(--t1)', color: 'var(--surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>J</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.3 }}>{lesson.title}</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
              <Badge color="teal">{lesson.subject}</Badge>
              <Badge>{lesson.grade}</Badge>
              <Badge color="blue">{lesson.classGroup}</Badge>
              <Badge color="amber">{lesson.duration}min</Badge>
            </div>
          </div>
        </div>
        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 6,
        }}>
          {[
            { label: 'Steps', val: lesson.steps.length, color: 'teal' },
            { label: '模块', val: lesson.steps.reduce((s, st) => s + st.blocks.length, 0), color: 'blue' },
            { label: 'Ref', val: lesson.steps.reduce((s, st) => s + st.blocks.filter(b => b.$ref).length, 0), color: 'purple' },
            { label: 'AI模块', val: lesson.steps.reduce((s, st) => s + st.blocks.filter(b => b.ai).length, 0), color: 'coral' },
          ].map(st => (
            <div key={st.label} style={{
              flex: 1, padding: '6px 8px', borderRadius: 6,
              background: `var(--${st.color}-bg)`, textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: `var(--${st.color})`, letterSpacing: -.3 }}>{st.val}</div>
              <div style={{ fontSize: 8, fontWeight: 600, color: `var(--${st.color})`, opacity: .7, textTransform: 'uppercase', letterSpacing: '.3px' }}>{st.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mode tabs ── */}
      <div style={{
        display: 'flex', gap: 0, padding: '0 18px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {[
          { id: 'chat', label: '✦ 助手' },
          { id: 'insights', label: '◇ 洞察', count: insights.length },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px',
            fontSize: 11, fontWeight: mode === m.id ? 600 : 400, fontFamily: 'inherit',
            cursor: 'pointer', color: mode === m.id ? 'var(--purple)' : 'var(--t3)',
            background: 'none', border: 'none',
            borderBottom: mode === m.id ? '2px solid var(--purple)' : '2px solid transparent',
            marginBottom: -1,
          }}>
            {m.label}
            {m.count > 0 && (
              <span style={{
                fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                background: 'var(--amber-bg)', color: 'var(--amber)', marginLeft: 2,
              }}>{m.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Chat mode ── */}
      {mode === 'chat' && (
        <React.Fragment>
          {/* Context bar */}
          <div style={{
            padding: '7px 18px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            background: 'var(--bg)',
          }}>
            <span style={{ fontSize: 9, color: 'var(--t3)' }}>上下文</span>
            <span style={{ width: 1, height: 10, background: 'var(--border)' }}></span>
            {ctx.reg ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                background: ctx.reg.bg, color: ctx.reg.color,
              }}>{ctx.reg.icon} {ctx.label}</span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                background: ctx.color ? `var(--${ctx.color}-bg)` : 'var(--surface2)',
                color: ctx.color ? `var(--${ctx.color})` : 'var(--t2)',
              }}>{ctx.icon} {ctx.label}</span>
            )}
            <span style={{
              marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%',
              background: 'var(--green)', animation: 'aiBlink 2s infinite',
            }}></span>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {suggestions.slice(0, 4).map(sug => (
                  <button key={sug.id} onClick={() => handleSugClick(sug)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                    fontSize: 10, fontWeight: 500, fontFamily: 'inherit', borderRadius: 6,
                    cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--t1)', transition: 'all .12s', whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `var(--${sug.color})`; e.currentTarget.style.background = `var(--${sug.color}-bg)`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg)'; }}
                  >
                    <span style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      background: `var(--${sug.color}-bg)`, color: `var(--${sug.color})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700,
                    }}>{sug.icon}</span>
                    {sug.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div ref={chatRef} className="scr" style={{
            flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {messages.map((msg, i) => (
              <V6ChatBubble key={i} msg={msg} />
            ))}
            {thinking && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '12px 12px 12px 2px',
                  background: 'var(--purple-bg)', color: 'var(--purple)',
                  fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span style={{ display: 'flex', gap: 3 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--purple)', animation: 'aiDot 1.2s infinite', animationDelay: '0s' }}></span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--purple)', animation: 'aiDot 1.2s infinite', animationDelay: '.2s' }}></span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--purple)', animation: 'aiDot 1.2s infinite', animationDelay: '.4s' }}></span>
                  </span>
                  <span style={{ fontSize: 10 }}>思考中</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '10px 18px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '4px 4px 4px 14px',
            }}>
              <textarea
                value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={handleKey}
                placeholder="描述修改、提问，或选择上方操作..."
                rows={1}
                style={{
                  flex: 1, padding: '7px 0', fontSize: 12, fontFamily: 'inherit',
                  border: 'none', background: 'transparent', outline: 'none',
                  color: 'var(--t1)', resize: 'none', lineHeight: 1.5, maxHeight: 96, overflowY: 'auto',
                }}
              />
              <button onClick={() => send(inputVal)} disabled={!inputVal.trim()} style={{
                width: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0,
                background: inputVal.trim() ? 'var(--purple)' : 'var(--surface2)',
                color: inputVal.trim() ? '#fff' : 'var(--t3)',
                cursor: inputVal.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, transition: 'all .15s', fontFamily: 'inherit',
              }}>↑</button>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 5, fontSize: 9, color: 'var(--t3)' }}>
              <span>Enter 发送</span><span>·</span><span>Shift+Enter 换行</span>
            </div>
          </div>
        </React.Fragment>
      )}

      {/* ── Insights mode ── */}
      {mode === 'insights' && (
        <div className="scr" style={{ flex: 1, padding: '14px 18px' }}>
          {/* Active insights */}
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 10 }}>
            待处理 · {insights.length}
          </div>
          {insights.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
              <div style={{ fontSize: 24, opacity: .3, marginBottom: 6 }}>✓</div>
              暂无待处理洞察
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {insights.map(ins => {
                const sMap = { warn: { bg: 'var(--amber-bg)', fg: 'var(--amber)', icon: '⚠', bd: 'rgba(196,138,30,.15)' }, info: { bg: 'var(--blue-bg)', fg: 'var(--blue)', icon: 'i', bd: 'rgba(26,95,160,.12)' }, ok: { bg: 'var(--green-bg)', fg: 'var(--green)', icon: '✓', bd: 'rgba(45,102,18,.12)' } };
                const s = sMap[ins.sev] || sMap.info;
                return (
                  <div key={ins.id} style={{ background: s.bg, border: `1px solid ${s.bd}`, borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span style={{ width: 18, height: 18, borderRadius: 4, background: s.fg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{ins.title}</div>
                        <div style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.5 }}>{ins.text}</div>
                        {ins.mod && (
                          <button onClick={() => onNavigate('exec', ins.mod)} style={{
                            marginTop: 6, padding: '3px 8px', fontSize: 9, fontWeight: 600,
                            fontFamily: 'inherit', borderRadius: 4, cursor: 'pointer',
                            border: `1px solid ${s.bd}`, background: 'rgba(255,255,255,.5)',
                            color: s.fg,
                          }}>跳转到模块 →</button>
                        )}
                      </div>
                      <span onClick={() => setDismissed(p => [...p, ins.id])} style={{ cursor: 'pointer', color: 'var(--t3)', fontSize: 10, opacity: .6, flexShrink: 0 }}>✕</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Health */}
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
            项目健康度
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {[
              { l: '教学要求覆盖', v: '5/5', ok: true },
              { l: '模块完整度', v: '13/13', ok: true },
              { l: 'AI 字段配置', v: '4/4', ok: true },
              { l: '观察维度', v: '9 模块', ok: true },
              { l: '干预规则', v: '3 条', ok: true, note: '可增加' },
              { l: '时间分配', v: '45min', ok: false, note: 'Step 5 偏紧' },
            ].map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 8, color: h.ok ? 'var(--green)' : 'var(--amber)', fontWeight: 700, flexShrink: 0 }}>{h.ok ? '✓' : '⚠'}</span>
                <span style={{ fontSize: 10, color: 'var(--t2)', flex: 1 }}>{h.l}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t1)' }}>{h.v}</span>
                {h.note && <span style={{ fontSize: 8, color: h.ok ? 'var(--blue)' : 'var(--amber)', fontWeight: 500 }}>{h.note}</span>}
              </div>
            ))}
          </div>

          {/* Recent changes */}
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 8 }}>
            最近变更
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { t: '2min ago', txt: '修改 discuss-cultural.json 对话轮次', tp: 'edit' },
              { t: '5min ago', txt: '添加 quiz-comprehensive.json', tp: 'add' },
              { t: '12min ago', txt: 'Review 审计通过', tp: 'check' },
            ].map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px', borderRadius: 4 }}>
                <span style={{ fontSize: 8, marginTop: 3, flexShrink: 0, color: c.tp === 'add' ? 'var(--green)' : c.tp === 'check' ? 'var(--teal)' : 'var(--blue)' }}>
                  {c.tp === 'add' ? '＋' : c.tp === 'check' ? '✓' : '✎'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.4 }}>{c.txt}</div>
                  <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 1 }}>{c.t}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Chat Bubble ── */
function V6ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
      {!isUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700 }}>✦</span>
          <span style={{ fontSize: 9, color: 'var(--purple)', fontWeight: 600 }}>AI 助手</span>
          {msg.ts && <span style={{ fontSize: 8, color: 'var(--t3)', marginLeft: 4 }}>{msg.ts}</span>}
        </div>
      )}
      <div style={{
        padding: '10px 14px',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        fontSize: 12, lineHeight: 1.7,
        background: isUser ? 'var(--t1)' : 'var(--purple-bg)',
        color: isUser ? 'var(--surface)' : 'var(--t1)',
        whiteSpace: 'pre-wrap',
      }}>{msg.text}</div>
    </div>
  );
}

Object.assign(window, { AILeftPanel });
