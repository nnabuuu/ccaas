/* ════════════════════════════════════════════════
   Creator v6 — Skills & Connectors Tab
   AI Skills (grouped by scope) + Connectors (MCP)
   ════════════════════════════════════════════════ */

/* ── Enhanced Skills Data ── */
const SKILLS_V6 = [
  {
    id: 'sk-socratic', name: 'Socratic Discussion', nameCn: '苏格拉底讨论引导',
    scope: 'module', scopeLabel: '模块级', enabled: true,
    desc: '使用苏格拉底式追问引导学生深入思考。不直接给出答案，通过层层追问帮助学生自己发现答案。',
    modules: ['discuss'], version: 'v2.1', provider: '平台预置',
    inputLabel: 'Tutor Instruction · Rubric', outputLabel: '对话引导 · 达标判定',
    usage: { projects: 47, teachers: 31 }, lastUpdated: '3 天前', maintainer: '平台管理员',
  },
  {
    id: 'sk-reading', name: 'Reading Comprehension', nameCn: '阅读理解辅导',
    scope: 'module', scopeLabel: '模块级', enabled: true,
    desc: '协助学生理解课文内容。通过上下文线索引导词义推断，定位关键信息，识别段落功能。',
    modules: ['reading', 'evidence'], version: 'v1.3', provider: '平台预置',
    inputLabel: '课文段落 · 任务目标', outputLabel: '理解支架 · 词义线索',
    usage: { projects: 62, teachers: 45 }, lastUpdated: '1 周前', maintainer: '平台管理员',
  },
  {
    id: 'sk-evaluator', name: 'Completion Evaluator', nameCn: '达标评估器',
    scope: 'system', scopeLabel: '系统级', enabled: true,
    desc: '评估学生在开放式模块中的达标程度。根据 Rubric 进行多维度判定，支持时间兜底机制。',
    modules: ['discuss', 'map'], version: 'v3.0', provider: '平台预置',
    inputLabel: 'Completion Rubric · 学生提交', outputLabel: '达标判定 · 反馈建议',
    usage: { projects: 58, teachers: 42 }, lastUpdated: '5 天前', maintainer: '平台管理员',
  },
  {
    id: 'sk-misconception', name: 'Misconception Detector', nameCn: '误解检测器',
    scope: 'system', scopeLabel: '系统级', enabled: true,
    desc: '实时检测学生常见误解模式，自动聚类相同错误，生成教师可读的误解摘要与干预建议。',
    modules: ['choice', 'matrix', 'evidence'], version: 'v1.8', provider: '平台预置',
    inputLabel: '学生答案流 · 参考答案', outputLabel: '误解聚类 · 错因分析',
    usage: { projects: 53, teachers: 38 }, lastUpdated: '2 周前', maintainer: '平台管理员',
  },
];

/* ── Connectors Data ── */
const CONNECTORS_V6 = [
  {
    id: 'conn-student', name: '学情数据系统', nameEn: 'Student Analytics',
    desc: '连接学生历史学习数据，为 AI 个性化教学策略提供数据支撑。',
    status: 'connected', provider: '成都区教育云',
    capabilities: ['学生画像', '历史成绩', '学习偏好', '出勤记录'],
    scope: '区级', protocol: 'MCP v1.2', lastSync: '2 分钟前',
    toolCount: 6, dataLabel: '42 名学生已同步',
  },
  {
    id: 'conn-curriculum', name: '课标知识图谱', nameEn: 'Curriculum Graph',
    desc: '接入新课标知识图谱，自动关联教学目标与课标要求。',
    status: 'connected', provider: '教育部课标数据库',
    capabilities: ['素养目标', '知识点映射', '学段要求'],
    scope: '国家级', protocol: 'MCP v1.2', lastSync: '1 小时前',
    toolCount: 4, dataLabel: '高中英语课标',
  },
  {
    id: 'conn-resource', name: '区域资源库', nameEn: 'Resource Library',
    desc: '连接区级共享资源库，搜索和引用优质教学素材与课件。',
    status: 'connected', provider: '成都区教育资源中心',
    capabilities: ['课件搜索', '素材引用', '协作共享'],
    scope: '区级', protocol: 'MCP v1.0', lastSync: '15 分钟前',
    toolCount: 5, dataLabel: '2,340 份资源',
  },
  {
    id: 'conn-assess', name: '评测分析系统', nameEn: 'Assessment Analytics',
    desc: '连接标准化测评系统，获取学生能力诊断与薄弱点分析数据。',
    status: 'disconnected', provider: '区教研中心',
    capabilities: ['能力诊断', '薄弱点分析', '进步追踪'],
    scope: '区级', protocol: 'MCP v1.2',
    toolCount: 4,
  },
  {
    id: 'conn-notify', name: '家校通知平台', nameEn: 'Home-School Connect',
    desc: '连接家校沟通平台，支持课后学情摘要与作业通知自动推送。',
    status: 'disconnected', provider: '家校通',
    capabilities: ['学情摘要', '作业通知', '进步报告'],
    scope: '校级', protocol: 'MCP v1.0',
    toolCount: 3,
  },
];

/* ════════════════════════════════════════════════
   Toggle Switch
   ════════════════════════════════════════════════ */
function V6Toggle({ checked, onChange, color = 'purple' }) {
  return (
    <div onClick={(e) => { e.stopPropagation(); onChange(!checked); }} style={{
      width: 34, height: 18, borderRadius: 9, padding: 2,
      background: checked ? `var(--${color})` : 'var(--surface2)',
      border: `1px solid ${checked ? `var(--${color})` : 'var(--border)'}`,
      cursor: 'pointer', flexShrink: 0,
      display: 'flex', alignItems: 'center',
      justifyContent: checked ? 'flex-end' : 'flex-start',
      transition: 'all .15s',
    }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        background: checked ? '#fff' : 'var(--t3)',
        transition: 'all .15s',
      }}></div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Skill Card
   ════════════════════════════════════════════════ */
function SkillCardV6({ skill, enabled, onToggle }) {
  const [hov, setHov] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '16px 18px',
        borderLeft: `3px solid ${enabled ? 'var(--purple)' : 'var(--surface2)'}`,
        opacity: enabled ? 1 : .6,
        transition: 'all .15s',
        ...(hov ? { borderColor: 'var(--t3)' } : {}),
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 6,
          background: enabled ? 'var(--purple)' : 'var(--surface2)',
          color: enabled ? '#fff' : 'var(--t3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0, transition: 'all .15s',
        }}>✦</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -.2 }}>{skill.name}</span>
            <Badge color="purple">{skill.scopeLabel}</Badge>
            <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'ui-monospace, monospace' }}>{skill.version}</span>
            <span style={{ fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 3, background: 'var(--surface2)', color: 'var(--t3)' }}>全平台</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{skill.nameCn}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <V6Toggle checked={enabled} onChange={onToggle} />
          <span style={{ fontSize: 8, color: 'var(--t3)' }}>本项目{enabled ? '已启用' : '未启用'}</span>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7, marginBottom: 12 }}>
        {skill.desc}
      </div>

      {/* Modules */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', flexShrink: 0 }}>适用模块</span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {skill.modules.map(m => {
            const reg = COMP_REG[m];
            return reg ? (
              <span key={m} style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                background: reg.bg, color: reg.color,
              }}>{reg.icon} {reg.label}</span>
            ) : null;
          })}
        </div>
      </div>

      {/* I/O flow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', flexShrink: 0 }}>数据流</span>
        <span style={{
          fontSize: 9, color: 'var(--teal)', background: 'var(--teal-bg)',
          padding: '1px 6px', borderRadius: 3,
        }}>{skill.inputLabel}</span>
        <span style={{ fontSize: 9, color: 'var(--t3)' }}>→</span>
        <span style={{
          fontSize: 9, color: 'var(--blue)', background: 'var(--blue-bg)',
          padding: '1px 6px', borderRadius: 3,
        }}>{skill.outputLabel}</span>
      </div>

      {/* Platform usage stats */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0 0',
        borderTop: '1px solid var(--border)', fontSize: 9, color: 'var(--t3)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>{skill.usage.projects}</span> 个课程启用
        </span>
        <span style={{ opacity: .4 }}>·</span>
        <span>{skill.usage.teachers} 位教师使用</span>
        <span style={{ opacity: .4 }}>·</span>
        <span>更新于 {skill.lastUpdated}</span>
        <div style={{ flex: 1 }}></div>
        <span style={{ fontWeight: 500 }}>{skill.maintainer}</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Connector Card
   ════════════════════════════════════════════════ */
function ConnectorCardV6({ connector, onToggleConnect, showToast }) {
  const [hov, setHov] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const isConnected = connector.status === 'connected';

  const handleConnect = (e) => {
    e.stopPropagation();
    if (isConnected) {
      onToggleConnect(connector.id, false);
      if (showToast) showToast(`已断开「${connector.name}」`, 'warn');
    } else {
      setConnecting(true);
      if (showToast) showToast(`正在连接「${connector.name}」...`);
      setTimeout(() => {
        setConnecting(false);
        onToggleConnect(connector.id, true);
        if (showToast) showToast(`已连接「${connector.name}」`, 'success');
      }, 1000);
    }
  };

  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '16px 18px',
        borderLeft: `3px solid ${isConnected ? 'var(--green)' : 'var(--surface2)'}`,
        transition: 'all .15s',
        ...(hov ? { borderColor: 'var(--t3)' } : {}),
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.2 }}>{connector.name}</span>
            {/* Status */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 9, fontWeight: 600,
              color: isConnected ? 'var(--green)' : 'var(--t3)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: isConnected ? 'var(--green)' : 'var(--t3)',
                ...(isConnected ? { animation: 'aiBlink 2s infinite' } : {}),
              }}></span>
              {connecting ? '连接中...' : isConnected ? '已连接' : '未连接'}
            </span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, fontFamily: 'ui-monospace, monospace', letterSpacing: .2 }}>
            {connector.nameEn}
          </div>
        </div>
        <button onClick={handleConnect} disabled={connecting} style={{
          padding: '5px 12px', fontSize: 10, fontWeight: 600, fontFamily: 'inherit',
          borderRadius: 6, cursor: connecting ? 'wait' : 'pointer', flexShrink: 0,
          border: isConnected ? '1px solid var(--border)' : '1px solid var(--teal)',
          background: isConnected ? 'var(--bg)' : 'var(--teal-bg)',
          color: isConnected ? 'var(--t3)' : 'var(--teal)',
          transition: 'all .12s',
        }}>
          {connecting ? '连接中...' : isConnected ? '管理' : '连接 →'}
        </button>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7, marginBottom: 12 }}>
        {connector.desc}
      </div>

      {/* Capabilities */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {connector.capabilities.map(c => (
          <span key={c} style={{
            fontSize: 9, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
            background: isConnected ? 'var(--teal-bg)' : 'var(--surface2)',
            color: isConnected ? 'var(--teal)' : 'var(--t3)',
            transition: 'all .15s',
          }}>{c}</span>
        ))}
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
          background: 'var(--purple-bg)', color: 'var(--purple)',
        }}>{connector.toolCount} tools</span>
      </div>

      {/* Footer meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--t3)' }}>
        <span>{connector.provider}</span>
        <span style={{ opacity: .4 }}>·</span>
        <span>{connector.scope}</span>
        <span style={{ opacity: .4 }}>·</span>
        <span style={{ fontFamily: 'ui-monospace, monospace' }}>{connector.protocol}</span>
        {isConnected && connector.lastSync && (
          <React.Fragment>
            <span style={{ opacity: .4 }}>·</span>
            <span style={{ color: 'var(--green)' }}>{connector.lastSync}同步</span>
          </React.Fragment>
        )}
        {isConnected && connector.dataLabel && (
          <React.Fragment>
            <span style={{ opacity: .4 }}>·</span>
            <span style={{ color: 'var(--blue)', fontWeight: 500 }}>{connector.dataLabel}</span>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Skills Sub-View
   ════════════════════════════════════════════════ */
function SkillsSubView({ onShowToast }) {
  const [enabledMap, setEnabledMap] = React.useState(() => {
    const m = {};
    SKILLS_V6.forEach(s => { m[s.id] = s.enabled; });
    return m;
  });

  const toggleSkill = (id) => {
    const next = !enabledMap[id];
    setEnabledMap(p => ({ ...p, [id]: next }));
    const sk = SKILLS_V6.find(s => s.id === id);
    if (onShowToast && sk) {
      onShowToast(next ? `已启用「${sk.name}」` : `已禁用「${sk.name}」`, next ? 'success' : 'warn');
    }
  };

  const moduleSkills = SKILLS_V6.filter(s => s.scope === 'module');
  const systemSkills = SKILLS_V6.filter(s => s.scope === 'system');

  return (
    <div>
      {/* Intro */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.3 }}>平台 AI 技能</span>
          <Badge color="purple">全平台通用</Badge>
          <Badge color="green">{SKILLS_V6.filter(s => enabledMap[s.id]).length}/{SKILLS_V6.length} 本项目启用</Badge>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7, maxWidth: 600 }}>
          Skill 是平台统一管理的 AI 能力，由管理员预置并持续迭代。所有课程项目共享同一套 Skill 定义，教师可按需选择在本项目中启用或关闭。
        </div>
      </div>

      {/* Module-level skills */}
      <SkillGroupV6
        title="模块级 Skill" desc="作用于单个教学模块，定义模块内的 AI 行为"
        color="purple" skills={moduleSkills} enabledMap={enabledMap} onToggle={toggleSkill}
      />

      {/* System-level skills */}
      <SkillGroupV6
        title="系统级 Skill" desc="跨模块运行，提供全局分析和评估能力"
        color="blue" skills={systemSkills} enabledMap={enabledMap} onToggle={toggleSkill}
      />

      {/* Architecture note */}
      <div style={{
        marginTop: 8, padding: '12px 16px', background: 'var(--purple-bg)',
        border: '1px solid rgba(58,49,133,.12)', borderRadius: 8,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--purple)', marginBottom: 4 }}>平台级管理</div>
        <div style={{ fontSize: 11, color: 'var(--purple)', lineHeight: 1.6, opacity: .8 }}>
          Skill 由平台管理员统一维护和版本迭代，所有课程项目自动获取最新版本。教师仅控制「本项目是否启用」，不可修改 Skill 定义本身。如需定制，请联系平台管理员。
        </div>
      </div>
    </div>
  );
}

function SkillGroupV6({ title, desc, color, skills, enabledMap, onToggle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: `var(--${color})`, textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
        <span style={{ fontSize: 9, color: 'var(--t3)' }}>{desc}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {skills.map(sk => (
          <SkillCardV6 key={sk.id} skill={sk} enabled={enabledMap[sk.id]} onToggle={() => onToggle(sk.id)} />
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   Connectors Sub-View
   ════════════════════════════════════════════════ */
function ConnectorsSubView({ onShowToast }) {
  const [connectors, setConnectors] = React.useState(CONNECTORS_V6);

  const toggleConnect = (id, connect) => {
    setConnectors(prev => prev.map(c =>
      c.id === id ? { ...c, status: connect ? 'connected' : 'disconnected', lastSync: connect ? '刚刚' : undefined } : c
    ));
  };

  const connected = connectors.filter(c => c.status === 'connected');
  const disconnected = connectors.filter(c => c.status !== 'connected');

  return (
    <div>
      {/* Intro */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: -.3 }}>连接器</span>
          <Badge color="teal">MCP</Badge>
          <Badge color="green">{connected.length} 已连接</Badge>
        </div>
        <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7, maxWidth: 600 }}>
          连接器通过 Model Context Protocol (MCP) 将外部教育系统接入 AI Agent，扩展其数据访问和操作能力。连接后，Agent 可在备课和教学过程中自动调用外部数据源。
        </div>
      </div>

      {/* MCP protocol info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
        background: 'var(--teal-bg)', border: '1px solid rgba(23,105,99,.1)', borderRadius: 8,
        marginBottom: 24,
      }}>
        <span style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--teal)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>⊞</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--teal)' }}>Model Context Protocol</div>
          <div style={{ fontSize: 10, color: 'var(--teal)', opacity: .7, marginTop: 1 }}>
            标准化的 AI 数据接入协议 · Agent 通过 MCP 工具调用外部系统
          </div>
        </div>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
          background: 'rgba(23,105,99,.12)', color: 'var(--teal)',
        }}>
          {connectors.reduce((s, c) => s + c.toolCount, 0)} tools 可用
        </span>
      </div>

      {/* Connected */}
      {connected.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.5px' }}>已连接</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
            <span style={{ fontSize: 9, color: 'var(--t3)' }}>{connected.length} 个数据源</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {connected.map(c => (
              <ConnectorCardV6 key={c.id} connector={c} onToggleConnect={toggleConnect} showToast={onShowToast} />
            ))}
          </div>
        </div>
      )}

      {/* Disconnected */}
      {disconnected.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>可用连接</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }}></div>
            <span style={{ fontSize: 9, color: 'var(--t3)' }}>{disconnected.length} 个待连接</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            {disconnected.map(c => (
              <ConnectorCardV6 key={c.id} connector={c} onToggleConnect={toggleConnect} showToast={onShowToast} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Main Tab Container — Sub-tabs: Skills | Connectors
   ════════════════════════════════════════════════ */
function SkillsConnectorsTab({ onShowToast }) {
  const [subTab, setSubTab] = React.useState('skills');

  const connectedCount = CONNECTORS_V6.filter(c => c.status === 'connected').length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Sub-tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0, padding: '0 28px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {[
          { id: 'skills', label: 'AI 技能', count: String(SKILLS_V6.length), color: 'purple' },
          { id: 'connectors', label: '连接器 · MCP', count: `${connectedCount}/${CONNECTORS_V6.length}`, color: 'teal' },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '9px 16px',
            fontSize: 11, fontWeight: subTab === t.id ? 600 : 400, fontFamily: 'inherit',
            cursor: 'pointer',
            color: subTab === t.id ? `var(--${t.color})` : 'var(--t3)',
            background: 'none', border: 'none',
            borderBottom: subTab === t.id ? `2px solid var(--${t.color})` : '2px solid transparent',
            marginBottom: -1, transition: 'all .12s',
          }}>
            {t.label}
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
              background: subTab === t.id ? `var(--${t.color}-bg)` : 'var(--surface2)',
              color: subTab === t.id ? `var(--${t.color})` : 'var(--t3)',
            }}>{t.count}</span>
          </button>
        ))}
        <div style={{ flex: 1 }}></div>
        <span style={{ fontSize: 9, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%', background: 'var(--purple)',
            animation: 'aiBlink 2s infinite',
          }}></span>
          Agent 运行中
        </span>
      </div>

      {/* Content */}
      <div className="scr" style={{ flex: 1, padding: 28 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {subTab === 'skills' && <SkillsSubView onShowToast={onShowToast} />}
          {subTab === 'connectors' && <ConnectorsSubView onShowToast={onShowToast} />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SkillsConnectorsTab, SkillsSubView, ConnectorsSubView, SKILLS_V6, CONNECTORS_V6 });
