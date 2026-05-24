/* ════════════════════════════════════════════════
   Creator v5 — AI Assistant Panel (first-class, always visible)
   Context-aware · Proactive suggestions · Rich conversation
   ════════════════════════════════════════════════ */

/* ── Context-aware suggestion engine ── */
function getContextSuggestions(activeTab, selectedBlock, lesson) {
  const base = [];

  if (activeTab === 'plan') {
    base.push(
      { id: 'plan-gen', icon: '✦', label: '根据教学要求生成教案', type: 'action', color: 'purple' },
      { id: 'plan-check', icon: '◇', label: '检查要求覆盖完整性', type: 'action', color: 'teal' },
      { id: 'plan-obj', icon: '▸', label: '从课标自动补全素养目标', type: 'action', color: 'blue' },
    );
  } else if (activeTab === 'exec') {
    if (selectedBlock) {
      const block = findBlock(lesson, selectedBlock);
      if (block) {
        const reg = COMP_REG[block.type] || COMP_REG.explain;
        if (block.type === 'discuss') {
          base.push(
            { id: 'dis-rubric', icon: '✎', label: '优化 Completion Rubric', type: 'action', color: 'coral' },
            { id: 'dis-prompt', icon: '✦', label: '改进 Tutor Instruction', type: 'action', color: 'purple' },
            { id: 'dis-fallback', icon: '↕', label: '生成兜底选择题', type: 'action', color: 'amber' },
          );
        } else if (block.type === 'choice') {
          base.push(
            { id: 'mc-distractor', icon: '○', label: '优化干扰项质量', type: 'action', color: 'blue' },
            { id: 'mc-add', icon: '＋', label: '生成相似题目', type: 'action', color: 'blue' },
            { id: 'mc-tag', icon: '▣', label: '自动标注考点标签', type: 'action', color: 'teal' },
          );
        } else if (block.type === 'matrix') {
          base.push(
            { id: 'mat-hint', icon: '◈', label: '为 Why 列生成支架提示', type: 'action', color: 'teal' },
            { id: 'mat-answer', icon: '✓', label: '生成参考答案', type: 'action', color: 'green' },
          );
        } else if (block.type === 'evidence') {
          base.push(
            { id: 'ev-signal', icon: '◈', label: '标注课文结构信号词', type: 'action', color: 'teal' },
            { id: 'ev-distract', icon: '○', label: '生成混淆标签', type: 'action', color: 'amber' },
          );
        } else if (block.type === 'map') {
          base.push(
            { id: 'map-ref', icon: '◎', label: '设置参考坐标位置', type: 'action', color: 'blue' },
            { id: 'map-reason', icon: '✎', label: '生成评分标准 (reasoning)', type: 'action', color: 'purple' },
          );
        }
        if (reg.hasObserve) {
          base.push(
            { id: 'obs-rule', icon: '⚡', label: '推荐干预规则', type: 'action', color: 'purple' },
          );
        }
      }
    } else {
      base.push(
        { id: 'exec-flow', icon: '▣', label: '优化模块执行顺序', type: 'action', color: 'blue' },
        { id: 'exec-time', icon: '◎', label: '检查时间分配合理性', type: 'action', color: 'amber' },
        { id: 'exec-add', icon: '＋', label: '建议新增模块', type: 'action', color: 'teal' },
      );
    }
  } else if (activeTab === 'skills') {
    base.push(
      { id: 'skill-match', icon: '✦', label: '检查 Skill 与模块的匹配', type: 'action', color: 'purple' },
    );
  } else if (activeTab === 'review') {
    base.push(
      { id: 'review-rerun', icon: '◇', label: '重新运行审计', type: 'action', color: 'teal' },
      { id: 'review-fix', icon: '✦', label: '自动修复建议项', type: 'action', color: 'purple' },
    );
  }

  return base;
}

function findBlock(lesson, blockId) {
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === blockId);
    if (found) return found;
  }
  return null;
}

function getContextLabel(activeTab, selectedBlock, lesson) {
  if (activeTab === 'plan') return { label: '教案设计', icon: '📝', color: 'teal' };
  if (activeTab === 'skills') return { label: 'Skill 定义', icon: '⚙️', color: 'purple' };
  if (activeTab === 'review') return { label: 'Review 审计', icon: '👁', color: 'green' };
  if (activeTab === 'exec' && selectedBlock) {
    const block = findBlock(lesson, selectedBlock);
    if (block) {
      const reg = COMP_REG[block.type] || COMP_REG.explain;
      return { label: block.title, icon: reg.icon, color: null, reg };
    }
  }
  return { label: '执行设计', icon: '📋', color: 'blue' };
}

/* ── AI Insight Cards (proactive analysis) ── */
const AI_INSIGHTS = [
  {
    id: 'ins1', severity: 'info', title: 'Rubric 可增强',
    detail: 'discuss-cultural.json 的 completion rubric 可增加"引用课文外例子"以提高思维品质覆盖。',
    module: 'b7', action: '修改 Rubric →',
  },
  {
    id: 'ins2', severity: 'warn', title: 'Wrap-up 时间偏紧',
    detail: 'Step 5 仅 5min，含 1 个讲解 + 1 个分类题。策略分类题可能需要更多时间。',
    module: null, action: '调整时间 →',
  },
  {
    id: 'ins3', severity: 'ok', title: '教学要求全覆盖',
    detail: '5 项教学要求全部被执行设计中的模块覆盖。',
    module: null, action: null,
  },
];

/* ── Main AI Panel Component ── */
function AIAssistantPanel({ activeTab, selectedBlock, lesson, onNavigate }) {
  const [aiMode, setAiMode] = React.useState('assist'); // assist | insights | chat
  const [messages, setMessages] = React.useState([
    {
      role: 'ai', text: '已分析课程项目。教案 5 项教学要求全部覆盖。执行流 5 Steps / 13 模块，其中 9 个为独立模块文件（ref）。',
      ts: '刚才',
    },
  ]);
  const [inputVal, setInputVal] = React.useState('');
  const [isThinking, setIsThinking] = React.useState(false);
  const [dismissedInsights, setDismissedInsights] = React.useState([]);
  const chatRef = React.useRef(null);

  const context = getContextLabel(activeTab, selectedBlock, lesson);
  const suggestions = getContextSuggestions(activeTab, selectedBlock, lesson);
  const activeInsights = AI_INSIGHTS.filter(ins => !dismissedInsights.includes(ins.id));

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const userMsg = { role: 'user', text: inputVal.trim(), ts: '刚才' };
    setMessages(prev => [...prev, userMsg]);
    setInputVal('');
    setIsThinking(true);

    // Simulate AI response
    setTimeout(() => {
      const responses = [
        '已分析当前模块配置。建议将 Tutor Instruction 中的引导策略更加具体化，例如指定需要引用的段落范围（¶5-7）。',
        '检查完毕。当前模块的观察维度配置合理，阈值设定符合常规教学场景。建议为"薄弱维度"增加自动推送支架的规则。',
        '已对比教案要求与执行设计。所有要求均已覆盖。discuss-evaluate.json 同时承接了"批判性评价"和"运用证据"两项要求，覆盖质量较高。',
      ];
      setMessages(prev => [...prev, {
        role: 'ai',
        text: responses[Math.floor(Math.random() * responses.length)],
        ts: '刚才',
      }]);
      setIsThinking(false);
    }, 1200);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (sug) => {
    setMessages(prev => [...prev, { role: 'user', text: sug.label, ts: '刚才' }]);
    setIsThinking(true);
    setAiMode('assist');
    setTimeout(() => {
      const mockResponses = {
        'dis-rubric': '已分析当前 Rubric:\n\n现有标准：学生说出美的实践是文化语言 + 引用一个课文例子。\n\n建议增加：\n1. "能对比至少两种文化实践的异同"\n2. "尝试联系自身文化经验"\n\n这将更好覆盖"文化意识"素养目标。是否应用？',
        'dis-prompt': '分析当前 Tutor Instruction...\n\n当前：引导理解美的实践是文化语言，鼓励找证据，苏格拉底式追问。\n\n建议优化为更具体的指令：\n1. 明确追问层次（事实→推理→评价）\n2. 指定关键段落 ¶5-7 作为证据来源\n3. 增加"当学生给出表面回答时"的引导策略',
        'mc-distractor': '分析 Q1-Q3 干扰项...\n\nQ2 选项 D "Natural beauty" 与正确答案区分度较低（语义相近）。建议替换为 "Ancient beauty standards" 以增加区分度。\n\nQ3 其他选项质量良好。',
      };
      setMessages(prev => [...prev, {
        role: 'ai',
        text: mockResponses[sug.id] || `正在执行「${sug.label}」...\n\n分析完成。当前配置整体合理。`,
        ts: '刚才',
      }]);
      setIsThinking(false);
    }, 1500);
  };

  React.useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  const MODES = [
    { id: 'assist', label: '助手', icon: '✦' },
    { id: 'insights', label: '洞察', icon: '◇', count: activeInsights.length },
  ];

  return (
    <div style={{
      width: 320, flexShrink: 0, borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      background: 'var(--surface)',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '0 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {/* Title row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, height: 40,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6, background: 'var(--purple)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
          }}>✦</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)', flex: 1 }}>AI 助手</span>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
            animation: 'aiBlink 2s infinite',
          }}></span>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
          {MODES.map(m => (
            <button key={m.id} onClick={() => setAiMode(m.id)} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px',
              fontSize: 11, fontWeight: aiMode === m.id ? 600 : 400, fontFamily: 'inherit',
              cursor: 'pointer', color: aiMode === m.id ? 'var(--purple)' : 'var(--t3)',
              background: 'none', border: 'none',
              borderBottom: aiMode === m.id ? '2px solid var(--purple)' : '2px solid transparent',
            }}>
              <span style={{ fontSize: 10 }}>{m.icon}</span>
              {m.label}
              {m.count > 0 && (
                <span style={{
                  fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 8,
                  background: 'var(--amber-bg)', color: 'var(--amber)',
                }}>{m.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Context bar ── */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        background: 'var(--bg)',
      }}>
        <span style={{ fontSize: 9, color: 'var(--t3)' }}>上下文</span>
        <span style={{ width: 1, height: 10, background: 'var(--border)' }}></span>
        {context.reg ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            background: context.reg.bg, color: context.reg.color,
          }}>
            <span>{context.reg.icon}</span>
            {context.label}
          </span>
        ) : (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
            background: context.color ? `var(--${context.color}-bg)` : 'var(--surface2)',
            color: context.color ? `var(--${context.color})` : 'var(--t2)',
          }}>
            <span>{context.icon}</span>
            {context.label}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      {aiMode === 'assist' && (
        <React.Fragment>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase',
                letterSpacing: '.4px', marginBottom: 8,
              }}>快捷操作</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {suggestions.slice(0, 4).map(sug => (
                  <button key={sug.id}
                    onClick={() => handleSuggestionClick(sug)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      fontSize: 11, fontFamily: 'inherit', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid var(--border)', background: 'var(--bg)',
                      color: 'var(--t1)', textAlign: 'left', transition: 'all .12s',
                      fontWeight: 500,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = `var(--${sug.color})`;
                      e.currentTarget.style.background = `var(--${sug.color}-bg)`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.background = 'var(--bg)';
                    }}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                      background: `var(--${sug.color}-bg)`, color: `var(--${sug.color})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700,
                    }}>{sug.icon}</span>
                    <span style={{ flex: 1, lineHeight: 1.3 }}>{sug.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat area */}
          <div ref={chatRef} className="scr" style={{
            flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.map((msg, i) => (
              <AIChatBubble key={i} msg={msg} />
            ))}
            {isThinking && (
              <div style={{
                alignSelf: 'flex-start', maxWidth: '90%',
              }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '10px 10px 10px 2px',
                  background: 'var(--purple-bg)', color: 'var(--purple)',
                  fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <span className="ai-thinking-dots" style={{ display: 'flex', gap: 3 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--purple)', animation: 'aiDot 1.2s infinite', animationDelay: '0s' }}></span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--purple)', animation: 'aiDot 1.2s infinite', animationDelay: '.2s' }}></span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--purple)', animation: 'aiDot 1.2s infinite', animationDelay: '.4s' }}></span>
                  </span>
                  <span style={{ fontSize: 10 }}>思考中</span>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div style={{
            padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', gap: 8, alignItems: 'flex-end',
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '4px 4px 4px 12px',
            }}>
              <textarea
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述修改、提问或选择上方操作..."
                rows={1}
                style={{
                  flex: 1, padding: '6px 0', fontSize: 11, fontFamily: 'inherit',
                  border: 'none', background: 'transparent', outline: 'none',
                  color: 'var(--t1)', resize: 'none', lineHeight: 1.5,
                  maxHeight: 80, overflowY: 'auto',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!inputVal.trim()}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: 'none', flexShrink: 0,
                  background: inputVal.trim() ? 'var(--purple)' : 'var(--surface2)',
                  color: inputVal.trim() ? '#fff' : 'var(--t3)',
                  cursor: inputVal.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, transition: 'all .15s', fontFamily: 'inherit',
                }}
              >↑</button>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 6,
              fontSize: 9, color: 'var(--t3)',
            }}>
              <span>Enter 发送</span>
              <span>·</span>
              <span>Shift+Enter 换行</span>
            </div>
          </div>
        </React.Fragment>
      )}

      {aiMode === 'insights' && (
        <div className="scr" style={{ flex: 1, padding: 14 }}>
          <div style={{
            fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase',
            letterSpacing: '.4px', marginBottom: 10,
          }}>项目洞察</div>

          {activeInsights.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
              <div style={{ fontSize: 24, opacity: .3, marginBottom: 8 }}>✓</div>
              暂无待处理洞察
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeInsights.map(ins => (
                <AIInsightCard key={ins.id} insight={ins}
                  onDismiss={() => setDismissedInsights(prev => [...prev, ins.id])}
                  onAction={() => {
                    if (ins.module && onNavigate) {
                      onNavigate('exec', ins.module);
                    }
                  }}
                />
              ))}
            </div>
          )}

          {/* Project health summary */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase',
              letterSpacing: '.4px', marginBottom: 8,
            }}>项目健康度</div>
            <div style={{
              background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8,
              padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <HealthRow label="教学要求覆盖" value="5/5" status="ok" />
              <HealthRow label="模块完整度" value="13/13" status="ok" />
              <HealthRow label="AI 字段配置" value="4/4" status="ok" />
              <HealthRow label="观察维度启用" value="9 模块" status="ok" />
              <HealthRow label="干预规则" value="3 条" status="info" detail="可增加" />
              <HealthRow label="时间分配" value="45min" status="warn" detail="Step 5 偏紧" />
            </div>
          </div>

          {/* Recent changes */}
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase',
              letterSpacing: '.4px', marginBottom: 8,
            }}>最近变更</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { time: '2min ago', text: '修改了 discuss-cultural.json 的对话轮次', type: 'edit' },
                { time: '5min ago', text: '添加了 quiz-comprehensive.json 模块', type: 'add' },
                { time: '12min ago', text: 'Review 审计通过', type: 'check' },
              ].map((change, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 8px',
                  borderRadius: 4,
                }}>
                  <span style={{
                    fontSize: 8, marginTop: 3, flexShrink: 0, color:
                    change.type === 'add' ? 'var(--green)' : change.type === 'check' ? 'var(--teal)' : 'var(--blue)',
                  }}>{change.type === 'add' ? '＋' : change.type === 'check' ? '✓' : '✎'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.4 }}>{change.text}</div>
                    <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 1 }}>{change.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Chat Bubble ── */
function AIChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '92%',
    }}>
      {!isUser && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3,
        }}>
          <span style={{
            width: 14, height: 14, borderRadius: 4, background: 'var(--purple)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, fontWeight: 700,
          }}>✦</span>
          <span style={{ fontSize: 9, color: 'var(--purple)', fontWeight: 600 }}>AI 助手</span>
          {msg.ts && <span style={{ fontSize: 8, color: 'var(--t3)', marginLeft: 4 }}>{msg.ts}</span>}
        </div>
      )}
      <div style={{
        padding: '9px 12px',
        borderRadius: isUser ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
        fontSize: 11, lineHeight: 1.65,
        background: isUser ? 'var(--t1)' : 'var(--purple-bg)',
        color: isUser ? 'var(--surface)' : 'var(--t1)',
        whiteSpace: 'pre-wrap',
      }}>{msg.text}</div>
    </div>
  );
}

/* ── Insight Card ── */
function AIInsightCard({ insight, onDismiss, onAction }) {
  const sevMap = {
    warn: { bg: 'var(--amber-bg)', color: 'var(--amber)', icon: '⚠', border: 'rgba(196,138,30,.15)' },
    info: { bg: 'var(--blue-bg)', color: 'var(--blue)', icon: 'i', border: 'rgba(26,95,160,.12)' },
    ok: { bg: 'var(--green-bg)', color: 'var(--green)', icon: '✓', border: 'rgba(45,102,18,.12)' },
  };
  const s = sevMap[insight.severity] || sevMap.info;

  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`, borderRadius: 8,
      padding: '10px 12px', position: 'relative',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <span style={{
          width: 18, height: 18, borderRadius: 4, background: s.color, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 1,
        }}>{s.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{insight.title}</div>
          <div style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.55 }}>{insight.detail}</div>
          {insight.action && (
            <button onClick={onAction} style={{
              marginTop: 6, padding: '3px 8px', fontSize: 9, fontWeight: 600,
              fontFamily: 'inherit', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${s.border}`, background: 'rgba(255,255,255,.5)',
              color: s.color,
            }}>{insight.action}</button>
          )}
        </div>
        <span onClick={onDismiss} style={{
          cursor: 'pointer', color: 'var(--t3)', fontSize: 10, padding: '0 2px',
          opacity: .6, flexShrink: 0,
        }}>✕</span>
      </div>
    </div>
  );
}

/* ── Health Row ── */
function HealthRow({ label, value, status, detail }) {
  const statusMap = {
    ok: { color: 'var(--green)', icon: '✓' },
    warn: { color: 'var(--amber)', icon: '⚠' },
    info: { color: 'var(--blue)', icon: 'i' },
  };
  const s = statusMap[status] || statusMap.ok;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 8, color: s.color, fontWeight: 700, flexShrink: 0 }}>{s.icon}</span>
      <span style={{ fontSize: 10, color: 'var(--t2)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t1)' }}>{value}</span>
      {detail && <span style={{ fontSize: 8, color: s.color, fontWeight: 500 }}>{detail}</span>}
    </div>
  );
}

Object.assign(window, { AIAssistantPanel });
