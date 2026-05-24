/* Architecture Map — Sections Part 1: Pipeline, Structure, Tabs, Plan */

/* ═══════════════════════════════════════════
   Section 1: Pipeline Overview
   ═══════════════════════════════════════════ */
function PipelineOverview() {
  return (
    <Section id="pipeline" num="01" title="三阶段通路概览"
      subtitle="一个课程项目对应一节课的完整生命周期。从<strong>教案设计</strong>（定义 WHAT）到<strong>课程执行设计</strong>（定义 HOW）到<strong>课堂执行</strong>（DO）。底层由文件系统提供 source of truth，上层由 Entity 视图提供业务语义的结构化投影。">

      <div className="phase-row">
        <PhaseCard color="teal" icon="📝" title="教案设计" keyword="WHAT"
          desc="Document-centric。教师的心智模型是「我在写一份文档」。定义教学要求、核心素养目标、课程大模块划分、教学任务。"
          producer="教师 + Agent" output="plan/*.md" consumer="Agent, Review 视图">
          <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
            <Tag color="teal">Notion-alike 编辑器</Tag>
            <Tag color="neutral">Markdown</Tag>
          </div>
        </PhaseCard>

        <FlowArrow label="驱动" />

        <PhaseCard color="blue" icon="🧩" title="课程执行设计" keyword="HOW"
          desc="Canvas/flow-centric。教师的心智模型是「我在搭一条流水线」。用什么交互形式来承接教案中定义的教学内容。"
          producer="教师 + Agent" output="execution/manifest.json" consumer="学生端 runtime, 教师 Observation, Agent">
          <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
            <Tag color="blue">模块列表编辑器</Tag>
            <Tag color="neutral">JSON Manifest</Tag>
          </div>
        </PhaseCard>

        <FlowArrow label="消费" />

        <PhaseCard color="green" icon="▶️" title="课堂执行" keyword="DO"
          desc="学生端状态机按 manifest 顺序执行。教师端 Observation 实时监控。runtime 自动生成课堂记录。"
          producer="Live-lesson runtime" output="record/*" consumer="教师回顾, Agent">
          <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
            <Tag color="green">学生端状态机</Tag>
            <Tag color="amber">教师 Observation</Tag>
          </div>
        </PhaseCard>
      </div>

      <InfoBox color="purple" title="关键设计决策：Soft Constraint">
        <span>教案与执行设计之间<strong>不建立 foreign key 关联</strong>。一致性由 Review 审计视图通过 <strong>AI lint</strong> 保证——Agent cross-read 两者后评估执行设计是否覆盖了教案要求。这让两个编辑空间保持独立性，避免硬关联带来的级联失效。</span>
      </InfoBox>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   Section 2: Project Structure + Dual-Layer
   ═══════════════════════════════════════════ */
function ProjectStructure() {
  const files = [
    { name: 'course-project/', type: 'folder', desc: '项目根目录' },
    { name: 'plan/', type: 'folder', indent: 1, desc: '教案设计 — 文档型' },
    { name: 'lesson-plan.md', type: 'file', indent: 2, desc: '课文信息 + 教学要求' },
    { name: 'objectives.md', type: 'file', indent: 2, desc: '核心素养目标' },
    { name: 'module-outline.md', type: 'file', indent: 2, desc: '课程大模块划分' },
    { name: 'execution/', type: 'folder', indent: 1, desc: '课程执行设计 — 模块列表型' },
    { name: 'manifest.json', type: 'file', indent: 2, desc: '有序模块列表（学生端原样消费）' },
    { name: 'modules/', type: 'folder', indent: 2, desc: '模块参数文件' },
    { name: 'record/', type: 'folder', indent: 1, desc: '课堂记录 — runtime 自动生成' },
    { name: 'session-log.json', type: 'file', indent: 2, desc: '学生交互日志' },
    { name: 'ai-interactions.json', type: 'file', indent: 2, desc: 'AI tutor 对话记录' },
  ];

  const mappings = [
    { file: 'plan/', view: '教案设计 Tab', editor: 'Notion-alike 文档编辑器', color: 'teal', layer: '方案层' },
    { file: 'execution/', view: '课程执行设计 Tab', editor: '模块列表编辑器', color: 'blue', layer: '方案层' },
    { file: 'record/', view: '（无独立 Tab）', editor: '自动生成，不可手动编辑', color: 'green', layer: '—' },
    { file: '（无 folder）', view: 'Review 审计视图', editor: 'AI 实时产出，只读', color: 'purple', layer: '—' },
  ];

  return (
    <Section id="structure" num="02" title="项目结构与双层架构"
      subtitle="项目视图分为<strong>平台层</strong>（透明度）和<strong>方案层</strong>（业务操作）两类 tab。两层操作的是同一份底层数据——平台层展示「是什么」，方案层展示「做什么」。">

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* File system */}
        <div>
          <SubHead tag="Source of Truth" tagColor="neutral">文件系统</SubHead>
          <div className="sub-desc">所有数据最终落到文件。Agent 和教师直接编辑共享同一套文件存储。</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card)', padding: 12 }}>
            <FileTree items={files} />
          </div>
        </div>

        {/* Entity view mapping */}
        <div>
          <SubHead tag="结构化投影" tagColor="blue">Entity 视图映射</SubHead>
          <div className="sub-desc">每个文件夹映射到一个业务视图。编辑任一端，另一端同步更新。</div>
          <div className="flex-col gap-md">
            {mappings.map((m, i) => (
              <div key={i} className={`d-infobox ${m.color}`} style={{ marginBottom: 0 }}>
                <div className="d-infobox-title">
                  <span className="mono text-sm">{m.file}</span>
                  <span style={{ color: 'var(--t3)', margin: '0 4px' }}>→</span>
                  <span>{m.view}</span>
                  {m.layer !== '—' && <Tag color={m.color}>{m.layer}</Tag>}
                </div>
                <div className="d-infobox-body">{m.editor}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dual-layer tab explanation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <InfoBox color="teal" title="平台层 Tab — 透明度">
          <div className="flex-col gap-sm">
            <div><strong>📁 文件系统视图</strong> — 展示项目原始文件结构。Markdown 文件点击后进入 Notion-alike 富文本编辑模式。让教师理解系统是文件驱动的。</div>
            <div><strong>⚙️ Skill 视图</strong> — 只读。展示当前项目中生效的 skill 定义，"打开引擎盖"。Skill 是平台预置、跨项目复用的资产。</div>
          </div>
        </InfoBox>
        <InfoBox color="blue" title="方案层 Tab — 业务操作">
          <div className="flex-col gap-sm">
            <div><strong>📝 教案设计 Tab</strong> — 对应 <code className="mono text-sm">plan/</code> 的结构化视图。Notion-alike 文档编辑器。</div>
            <div><strong>🧩 课程执行设计 Tab</strong> — 对应 <code className="mono text-sm">execution/</code> 的结构化视图。模块列表编辑器，从模块库拖入 → 配参数。</div>
          </div>
        </InfoBox>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   Section 3: Tab System Interactive Prototype
   ═══════════════════════════════════════════ */
function TabSystemPrototype() {
  const [activeTab, setActiveTab] = useState('plan');

  const tabs = [
    { id: 'files', label: '📁 文件系统', group: 'platform' },
    { id: 'skills', label: '⚙️ Skills', group: 'platform' },
    { id: 'plan', label: '📝 教案设计', group: 'solution' },
    { id: 'exec', label: '🧩 执行设计', group: 'solution' },
  ];

  return (
    <Section id="tabs" num="03" title="项目视图 Tab 体系"
      subtitle="点击切换 tab 查看不同视图。<strong>平台层</strong>和<strong>方案层</strong>操作同一份底层数据的不同投影。">

      <div className="tab-proto">
        <div className="tab-bar">
          <div className="tab-group-label">平台层</div>
          {tabs.filter(t => t.group === 'platform').map(t => (
            <div key={t.id} className={`tab-item ${activeTab === t.id ? 'active' : ''}`}
                 onClick={() => setActiveTab(t.id)}>{t.label}</div>
          ))}
          <div className="tab-sep" />
          <div className="tab-group-label">方案层</div>
          {tabs.filter(t => t.group === 'solution').map(t => (
            <div key={t.id} className={`tab-item ${activeTab === t.id ? 'active' : ''}`}
                 onClick={() => setActiveTab(t.id)}>{t.label}</div>
          ))}
        </div>
        <div className="tab-content">
          {activeTab === 'files' && <TabFiles />}
          {activeTab === 'skills' && <TabSkills />}
          {activeTab === 'plan' && <TabPlan />}
          {activeTab === 'exec' && <TabExec />}
        </div>
      </div>
    </Section>
  );
}

function TabFiles() {
  const files = [
    { name: 'plan/', type: 'folder' },
    { name: 'lesson-plan.md', type: 'file', indent: 1, desc: '点击 → Notion-alike 编辑器' },
    { name: 'objectives.md', type: 'file', indent: 1 },
    { name: 'module-outline.md', type: 'file', indent: 1 },
    { name: 'execution/', type: 'folder' },
    { name: 'manifest.json', type: 'file', indent: 1, desc: '原始 JSON' },
    { name: 'record/', type: 'folder' },
    { name: 'session-log.json', type: 'file', indent: 1, desc: '只读' },
  ];
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--t3)', marginBottom: 8 }}>FILE EXPLORER — 展示项目原始文件结构</div>
      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 8 }}>
        <FileTree items={files} />
      </div>
      <div className="text-xs mt-md" style={{ color: 'var(--t2)' }}>
        Markdown 文件点击后自动切换到 Notion-alike 富文本编辑模式，非 Markdown 文件按原始格式展示。
      </div>
    </div>
  );
}

function TabSkills() {
  const skills = [
    { name: 'Discussion Facilitator', desc: '引导学生在讨论模块中深入思考，使用苏格拉底式提问', scope: '模块级' },
    { name: 'Reading Comprehension Tutor', desc: '协助学生理解课文，通过上下文线索引导词义猜测', scope: '模块级' },
    { name: 'Completion Evaluator', desc: '评估学生在开放模块中的达标程度', scope: '系统级' },
  ];
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--t3)', marginBottom: 8 }}>SKILL DEFINITIONS — 只读，查看 AI 行为背后的 skill 定义</div>
      <div className="flex-col gap-md">
        {skills.map((s, i) => (
          <div key={i} className="d-infobox purple" style={{ marginBottom: 0 }}>
            <div className="d-infobox-title">
              {s.name}
              <Tag color="purple">{s.scope}</Tag>
            </div>
            <div className="d-infobox-body">{s.desc}</div>
            <div className="text-xs mt-sm" style={{ color: 'var(--t3)', fontFamily: '"JetBrains Mono", monospace' }}>
              Skill 是平台预置资产，跨项目复用。教师可查看但不可编辑。
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabPlan() {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--t3)', marginBottom: 8 }}>NOTION-ALIKE EDITOR — 教案设计文档编辑器</div>
      <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 20 }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>课文信息</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, letterSpacing: '-.3px' }}>The Gift of the Magi</h3>
          <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 16 }}>O. Henry · 高一英语阅读 · 40 分钟</p>

          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, marginTop: 16 }}>教学要求</div>
          <div className="flex-col gap-sm">
            {['识别课文中的悬念和反转叙事技巧', '理解 "gift" 的双重含义（礼物 / 天赋）', '分析两位主角的性格特征和动机'].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--t1)' }}>
                <span style={{ color: 'var(--teal)', fontSize: 10, marginTop: 2 }}>☑</span>
                <span>{r}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, marginTop: 16 }}>核心素养目标</div>
          <div className="flex-col gap-sm">
            {[
              { k: '语言能力', v: '通过上下文猜测词义' },
              { k: '思维品质', v: '分析人物行为背后的逻辑' },
              { k: '文化意识', v: '理解西方节日文化中的「给予」精神' },
            ].map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                <Tag color="teal">{o.k}</Tag>
                <span style={{ color: 'var(--t2)' }}>{o.v}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8, marginTop: 16 }}>大模块划分</div>
          <div className="flex-row gap-sm" style={{ flexWrap: 'wrap' }}>
            {['导入', '精读', '讨论', '输出'].map((m, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 500 }}>
                {i + 1}. {m}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabExec() {
  const modules = [
    { num: 1, title: '课文阅读', type: 'read', color: 'teal', completion: 'manual', time: '8 min' },
    { num: 2, title: '理解检测', type: 'quiz', color: 'blue', completion: 'hard', time: '5 min' },
    { num: 3, title: '人物分析讨论', type: 'discussion', color: 'purple', completion: 'ai_eval', time: '10 min' },
    { num: 4, title: '学习总结', type: 'summary', color: 'green', completion: 'manual', time: '5 min' },
  ];
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--t3)', marginBottom: 8 }}>MODULE LIST EDITOR — 从模块库拖入 → 配参数</div>
      <div className="flow-pipe">
        {modules.map((m, i) => (
          <React.Fragment key={i}>
            <FlowStep num={m.num} title={m.title} type={m.type} color={m.color} completion={m.completion} />
            {i < modules.length - 1 && <FlowGate label={m.completion === 'manual' ? '手动' : m.completion === 'hard' ? '校验' : 'AI'} />}
          </React.Fragment>
        ))}
      </div>
      <div className="text-xs mt-md" style={{ color: 'var(--t2)' }}>
        Manifest 由学生端执行框架<strong>原样消费</strong>，不经过编译。Schema 同时是 design-time schema 和 runtime schema。
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Section 4: Plan/ Deep Dive
   ═══════════════════════════════════════════ */
function PlanDeepDive() {
  const [activeFile, setActiveFile] = useState('lesson-plan.md');

  const planFiles = [
    { name: 'plan/', type: 'folder' },
    { name: 'lesson-plan.md', type: 'file', indent: 1, active: activeFile === 'lesson-plan.md' },
    { name: 'objectives.md', type: 'file', indent: 1, active: activeFile === 'objectives.md' },
    { name: 'module-outline.md', type: 'file', indent: 1, active: activeFile === 'module-outline.md' },
  ];

  const fileContent = {
    'lesson-plan.md': {
      title: '课文信息 · Lesson Plan',
      content: (
        <div className="flex-col" style={{ gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>The Gift of the Magi</div>
          <div style={{ fontSize: 12, color: 'var(--t2)' }}>作者: O. Henry &nbsp;|&nbsp; 体裁: 短篇小说 &nbsp;|&nbsp; 时长: 40 分钟</div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 12, color: 'var(--t2)', lineHeight: 1.7 }}>
            课文节选自 O. Henry 的经典短篇。故事通过 Della 和 Jim 夫妇互赠圣诞礼物的反转结局，探讨了「给予」与「牺牲」的关系。教师可引导学生从叙事技巧（悬念、反转）和主题理解两个维度分析文本。
          </div>
        </div>
      )
    },
    'objectives.md': {
      title: '核心素养目标 · Objectives',
      content: (
        <div className="flex-col" style={{ gap: 12 }}>
          {[
            { cat: '语言能力', items: ['通过上下文线索推断生词含义', '识别并分析比喻和反讽修辞'] },
            { cat: '思维品质', items: ['分析人物行为动机', '评价故事结局的合理性'] },
            { cat: '文化意识', items: ['理解圣诞礼物交换的文化背景', '对比中西方「给予」观念'] },
          ].map((c, i) => (
            <div key={i}>
              <Tag color="teal">{c.cat}</Tag>
              <div className="flex-col gap-sm mt-sm">
                {c.items.map((item, j) => (
                  <div key={j} style={{ fontSize: 12, color: 'var(--t2)', paddingLeft: 12 }}>• {item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    },
    'module-outline.md': {
      title: '大模块划分 · Module Outline',
      content: (
        <div className="flex-col" style={{ gap: 12 }}>
          {[
            { num: 1, name: '导入', desc: '背景知识激活，引出课文主题', time: '5 min' },
            { num: 2, name: '精读', desc: '课文阅读，标注关键段落和修辞手法', time: '10 min' },
            { num: 3, name: '讨论', desc: '人物分析，小组/AI 辅助讨论', time: '15 min' },
            { num: 4, name: '输出', desc: '学习总结，主题理解输出', time: '10 min' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 12, padding: '8px 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: 'var(--t3)', minWidth: 20 }}>{m.num}.</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{m.name}</div>
                <div style={{ color: 'var(--t2)' }}>{m.desc}</div>
              </div>
              <Tag color="neutral">{m.time}</Tag>
            </div>
          ))}
        </div>
      )
    }
  };

  return (
    <Section id="plan" num="04" title="教案设计 · plan/"
      subtitle="Document-centric。教师在 Notion-alike 编辑器中定义教学内容。点击左侧文件切换到对应的编辑器视图。<strong>同一份 Markdown 文件</strong>在文件系统视图中是原始文本，在教案设计 Tab 中是富文本编辑器。">

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, marginBottom: 20 }}>
        {/* File tree */}
        <div>
          <div className="text-xs mb-sm" style={{ color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>Files</div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 8 }}>
            {planFiles.map((f, i) => (
              <div key={i}
                className={`file-node ${f.active ? 'active' : ''}`}
                style={{ cursor: f.type === 'file' ? 'pointer' : 'default' }}
                onClick={() => f.type === 'file' && setActiveFile(f.name)}>
                <span className="fn-indent" style={{ width: (f.indent || 0) * 16 }} />
                <span className="fn-icon">{f.type === 'folder' ? '📁' : '📄'}</span>
                <span className="fn-name">{f.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Editor preview */}
        <div>
          <div className="text-xs mb-sm" style={{ color: 'var(--teal)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px' }}>
            Notion-alike Editor → {activeFile}
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, minHeight: 200 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>
              {fileContent[activeFile]?.title}
            </div>
            {fileContent[activeFile]?.content}
          </div>
        </div>
      </div>

      <InfoBox color="teal" title="数据格式与编辑模型">
        <span>结构化文档（Markdown），同时支持教师通过 Notion-alike 编辑器直接编辑，以及 Agent 通过文件读写生成和修改。<strong>两种操作模式共享同一套文件存储</strong>，保证数据一致性。</span>
      </InfoBox>
    </Section>
  );
}

/* Export to window */
Object.assign(window, {
  PipelineOverview, ProjectStructure, TabSystemPrototype, PlanDeepDive
});
