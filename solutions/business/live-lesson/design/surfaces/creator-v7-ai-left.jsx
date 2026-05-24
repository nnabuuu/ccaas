/* ════════════════════════════════════════════════
   Creator v7 — Left Panel (pure chat + multi-conversation)
   Context-aware placeholder · Conversation list
   ════════════════════════════════════════════════ */

/* ── Context helper (for dynamic placeholder) ── */
function v7FindBlock(lesson, blockId) {
  for (const step of lesson.steps) {
    const found = step.blocks.find(b => b.id === blockId);
    if (found) return found;
  }
  return null;
}

function v7GetContextLabel(activeTab, selectedBlock, lesson, dynamicTabs) {
  /* Dynamic file/review tab */
  if (activeTab && activeTab.startsWith('file-')) {
    const dt = (dynamicTabs || []).find(t => t.id === activeTab);
    if (dt && dt.file) return { label: dt.file.name, isFile: true };
  }
  if (activeTab && activeTab.startsWith('review-')) return { label: 'Review 审计', color: 'green' };

  if (activeTab === 'plan') return { label: '教案设计', color: 'teal' };
  if (activeTab === 'skills') return { label: 'Skills·连接器', color: 'purple' };
  if (activeTab === 'exec' && selectedBlock) {
    const block = v7FindBlock(lesson, selectedBlock);
    if (block) {
      const reg = COMP_REG[block.type] || COMP_REG.explain;
      return { label: block.title, reg };
    }
  }
  if (activeTab === 'exec') return { label: '执行设计', color: 'blue' };
  return { label: null };
}

/* ── Conversation data ── */
const DEFAULT_CONVERSATIONS = [
  { id: 'conv-1', name: '课程设计', messages: [
    { role: 'ai', text: '你好，我是课程设计助手。直接描述你的需求，我会根据你当前的编辑上下文提供帮助。', ts: '' },
  ]},
  { id: 'conv-2', name: 'Rubric 优化', messages: [
    { role: 'ai', text: '这个对话专门用来讨论 Completion Rubric 的优化方向。', ts: '' },
    { role: 'user', text: '帮我检查 discuss-cultural.json 的 rubric 是否足够具体', ts: '10min ago' },
    { role: 'ai', text: '当前 rubric 要求"学生能够说出美的实践不仅是外表装饰，而是表达身份认同"。建议增加：\n\n1. 引用至少一个课文外的例子\n2. 对比两种文化的异同\n\n这样可以提高思维品质维度的覆盖。', ts: '10min ago' },
  ]},
];

/* ════════════════════════════════════════════════ */
function AILeftPanelV7({ lesson, activeTab, selectedBlock, dynamicTabs }) {
  const [conversations, setConversations] = React.useState(DEFAULT_CONVERSATIONS);
  const [activeConv, setActiveConv] = React.useState('conv-1');
  const [showConvList, setShowConvList] = React.useState(false);
  const [inputVal, setInputVal] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const chatRef = React.useRef(null);

  const ctx = v7GetContextLabel(activeTab, selectedBlock, lesson, dynamicTabs);
  const conv = conversations.find(c => c.id === activeConv) || conversations[0];

  const send = (text) => {
    if (!text.trim()) return;
    setConversations(prev => prev.map(c =>
      c.id === activeConv ? { ...c, messages: [...c.messages, { role: 'user', text: text.trim(), ts: '刚才' }] } : c
    ));
    setInputVal('');
    setThinking(true);
    setTimeout(() => {
      const resps = [
        '已分析当前模块配置。建议将 Tutor Instruction 中的引导策略具体化，指定段落范围（¶5-7）作为证据来源。',
        '检查完毕。观察维度配置合理。建议为「薄弱维度」增加自动推送支架的规则。',
        '已对比教案与执行设计。所有要求已覆盖。discuss-evaluate.json 同时承接"批判性评价"和"运用证据"两项要求。',
        '分析完成。当前模块的完成条件设定合理，AI 评估兜底时间 600s 适合 Socratic 对话场景。',
      ];
      setConversations(prev => prev.map(c =>
        c.id === activeConv ? { ...c, messages: [...c.messages, { role: 'ai', text: resps[Math.floor(Math.random() * resps.length)], ts: '刚才' }] } : c
      ));
      setThinking(false);
    }, 1200);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputVal); }
  };

  const newConversation = () => {
    const id = 'conv-' + Date.now();
    setConversations(prev => [...prev, { id, name: '新对话', messages: [
      { role: 'ai', text: '新对话已创建。有什么需要帮助的？', ts: '' },
    ]}]);
    setActiveConv(id);
    setShowConvList(false);
  };

  React.useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [conv?.messages, thinking]);

  const placeholder = ctx.reg
    ? `关于「${ctx.label}」提问或描述修改...`
    : ctx.isFile
      ? `关于 ${ctx.label} 提问...`
      : ctx.label
        ? `关于${ctx.label}提问或描述修改...`
        : '描述修改、提问...';

  return (
    <div style={{
      width: 340, flexShrink: 0, borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', minHeight: 0,
      background: 'var(--surface)',
    }}>
      {/* ── Conversation header ── */}
      <div style={{
        padding: '8px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        <button onClick={() => setShowConvList(!showConvList)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6,
          cursor: 'pointer', border: '1px solid var(--border)',
          background: showConvList ? 'var(--surface2)' : 'transparent',
          color: 'var(--t1)', flex: 1, justifyContent: 'flex-start',
        }}>
          <span style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>✦</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.name}</span>
          <span style={{ fontSize: 8, color: 'var(--t3)', marginLeft: 'auto', transform: showConvList ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }}>▾</span>
        </button>
        <button onClick={newConversation} title="新建对话" style={{
          width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)',
          background: 'transparent', cursor: 'pointer', color: 'var(--t3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontFamily: 'inherit', flexShrink: 0,
        }}>＋</button>
      </div>

      {/* ── Conversation list dropdown ── */}
      {showConvList && (
        <div style={{
          padding: '6px 8px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg)', flexShrink: 0,
        }}>
          {conversations.map(c => (
            <div key={c.id} onClick={() => { setActiveConv(c.id); setShowConvList(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                borderRadius: 6, cursor: 'pointer',
                background: c.id === activeConv ? 'var(--purple-bg)' : 'transparent',
                transition: 'all .1s',
              }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3,
                background: c.id === activeConv ? 'var(--purple)' : 'var(--surface2)',
                color: c.id === activeConv ? '#fff' : 'var(--t3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 7, fontWeight: 700, flexShrink: 0,
              }}>✦</span>
              <span style={{ fontSize: 11, fontWeight: c.id === activeConv ? 600 : 400, color: c.id === activeConv ? 'var(--purple)' : 'var(--t2)' }}>{c.name}</span>
              <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>{c.messages.length}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Chat messages ── */}
      <div ref={chatRef} className="scr" style={{
        flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {conv.messages.map((msg, i) => (
          <V7ChatBubble key={activeConv + '-' + i} msg={msg} />
        ))}
        {thinking && (
          <div style={{ alignSelf: 'flex-start', maxWidth: '88%' }}>
            <div style={{
              padding: '10px 14px', borderRadius: '12px 12px 12px 2px',
              background: 'var(--purple-bg)', color: 'var(--purple)',
              fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ display: 'flex', gap: 3 }}>
                {[0, .2, .4].map(d => (
                  <span key={d} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--purple)', animation: 'aiDot 1.2s infinite', animationDelay: `${d}s` }}></span>
                ))}
              </span>
              <span style={{ fontSize: 10 }}>思考中</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <div style={{ padding: '10px 18px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end',
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '4px 4px 4px 14px',
        }}>
          <textarea
            value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={handleKey}
            placeholder={placeholder}
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
    </div>
  );
}

/* ── Chat Bubble ── */
function V7ChatBubble({ msg }) {
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

Object.assign(window, { AILeftPanelV7 });
