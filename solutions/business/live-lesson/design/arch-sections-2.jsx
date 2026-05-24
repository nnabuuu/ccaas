/* Architecture Map — Sections Part 2: Execution, Runtime, Agent, Review, DataFlow */

/* ═══════════════════════════════════════════
   Section 5: Execution Design Deep Dive
   ═══════════════════════════════════════════ */
function ExecutionDeepDive() {
  return (
    <Section id="execution" num="05" title="课程执行设计 · execution/"
      subtitle="Canvas/flow-centric。核心产物是一个 <code>manifest.json</code>——有序模块列表，由学生端执行框架<strong>原样消费</strong>，不经过编译。模块类型的 schema 由后端提供，只读、不可扩展。">

      {/* Manifest structure */}
      <SubHead tag="JSON" tagColor="blue">Manifest 结构</SubHead>
      <div className="sub-desc">Manifest 定义学生的学习路径。同一份 schema 服务三个消费者：执行设计编辑器 UI、Agent、校验层。</div>

      <CodeBlock title="execution/manifest.json">
{`{
  `}<span className="ck">"modules"</span>{`: [
    {
      `}<span className="ck">"id"</span>{`: `}<span className="cv">"step-1"</span>{`,
      `}<span className="ck">"type"</span>{`: `}<span className="cv">"read"</span>{`,
      `}<span className="ck">"title"</span>{`: `}<span className="cv">"课文阅读"</span>{`,
      `}<span className="ck">"params"</span>{`: { `}<span className="ck">"passage"</span>{`: `}<span className="cv">"the-gift-of-the-magi.md"</span>{`, `}<span className="ck">"duration"</span>{`: `}<span className="cn">480</span>{` },
      `}<span className="ck">"completion"</span>{`: { `}<span className="ck">"type"</span>{`: `}<span className="cv">"manual"</span>{` }
    },
    {
      `}<span className="ck">"id"</span>{`: `}<span className="cv">"step-2"</span>{`,
      `}<span className="ck">"type"</span>{`: `}<span className="cv">"quiz"</span>{`,
      `}<span className="ck">"title"</span>{`: `}<span className="cv">"理解检测"</span>{`,
      `}<span className="ck">"params"</span>{`: { `}<span className="ck">"questions"</span>{`: `}<span className="cn">4</span>{`, `}<span className="ck">"passScore"</span>{`: `}<span className="cn">0.75</span>{`, `}<span className="ck">"difficulty"</span>{`: `}<span className="cv">"medium"</span>{` },
      `}<span className="ck">"completion"</span>{`: { `}<span className="ck">"type"</span>{`: `}<span className="cv">"hard"</span>{`, `}<span className="ck">"rule"</span>{`: `}<span className="cv">"score >= 0.75"</span>{` }
    },
    {
      `}<span className="ck">"id"</span>{`: `}<span className="cv">"step-3"</span>{`,
      `}<span className="ck">"type"</span>{`: `}<span className="cv">"discussion"</span>{`,
      `}<span className="ck">"title"</span>{`: `}<span className="cv">"人物分析讨论"</span>{`,
      `}<span className="ck">"params"</span>{`: {
        `}<span className="ck">"minTurns"</span>{`: `}<span className="cn">3</span>{`,
        `}<span className="ck">"tutorInstruction"</span>{`: `}<span className="cv">"引导学生分析 Della 和 Jim 的牺牲..."</span>{`,  `}<span className="cc">// → AI Tutor</span>{`
        `}<span className="ck">"completionRubric"</span>{`: `}<span className="cv">"学生能说出两位主角的牺牲行为..."</span>{`  `}<span className="cc">// → AI Evaluator</span>{`
      },
      `}<span className="ck">"completion"</span>{`: { `}<span className="ck">"type"</span>{`: `}<span className="cv">"ai_eval"</span>{`, `}<span className="ck">"timeoutSec"</span>{`: `}<span className="cn">600</span>{` }
    },
    {
      `}<span className="ck">"id"</span>{`: `}<span className="cv">"step-4"</span>{`,
      `}<span className="ck">"type"</span>{`: `}<span className="cv">"summary"</span>{`,
      `}<span className="ck">"title"</span>{`: `}<span className="cv">"学习总结"</span>{`,
      `}<span className="ck">"params"</span>{`: { `}<span className="ck">"prompt"</span>{`: `}<span className="cv">"用 3-5 句话总结故事的主题..."</span>{` },
      `}<span className="ck">"completion"</span>{`: { `}<span className="ck">"type"</span>{`: `}<span className="cv">"manual"</span>{` }
    }
  ]
}`}
      </CodeBlock>

      {/* Module schema detail */}
      <SubHead tag="Discussion" tagColor="purple">模块 Schema 详解</SubHead>
      <div className="sub-desc">以 Discussion 模块为例，展示模块参数的两类字段和 AI 角色分离。每个模块包含三层定义：内容、交互、完成条件。</div>

      <SchemaTable title="Discussion Module Schema" badge="type: discussion" badgeColor="purple"
        fields={[
          { section: '── 结构化配置（机器消费，schema 硬校验）', sectionColor: 'var(--blue)' },
          { name: 'duration', type: 'number', required: true, desc: '讨论时长（秒）。编辑器渲染为滑块。' },
          { name: 'minTurns', type: 'number', required: true, desc: '最少对话轮数。学生至少发言 N 轮。' },
          { name: 'difficulty', type: 'enum', required: false, desc: '"easy" | "medium" | "hard"。影响 AI 引导策略深度。' },
          { name: 'maxStudentsPerGroup', type: 'number', required: false, desc: '分组上限（如支持小组讨论）。' },

          { section: '── Declarative Prompt（LLM 消费，校验仅限非空）', sectionColor: 'var(--purple)' },
          { name: 'tutorInstruction', type: 'string', required: true, desc: '→ AI Tutor。定义 tutor 如何与学生互动。渲染为文本框。' },
          { name: 'completionRubric', type: 'string', required: true, desc: '→ AI Evaluator。定义学生达标判断标准。独立于 tutor。' },

          { section: '── 三层定义', sectionColor: 'var(--green)' },
          { name: 'content', type: 'object', required: true, desc: '内容定义：展示什么。引导问题、参考段落。' },
          { name: 'interaction', type: 'object', required: true, desc: '交互定义：学生做什么。多轮对话、引用课文。' },
          { name: 'completion', type: 'object', required: true, desc: '完成条件：何时进入下一步。AI 评估 + 时间兜底。' },
        ]} />

      {/* AI field separation */}
      <SubHead>AI 字段角色分离</SubHead>
      <div className="sub-desc">模块中涉及 AI 的字段必须分为两组，服务于两个不同的 LLM 调用角色。混合定义会导致调整 tutor 行为时意外改变通过条件。</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="d-infobox purple" style={{ marginBottom: 0 }}>
          <div className="d-infobox-title">
            <Tag color="purple">Tutor Instruction</Tag>
            → AI Tutor
          </div>
          <div className="d-infobox-body">
            <strong>读取者:</strong> AI Tutor（与学生互动的角色）<br />
            <strong>职责:</strong> 定义 tutor 在模块内如何引导学生<br />
            <strong>示例:</strong> "引导学生分析 Della 和 Jim 各自牺牲了什么，鼓励从课文中找证据，不要直接给出答案。"
          </div>
        </div>
        <div className="d-infobox coral" style={{ marginBottom: 0 }}>
          <div className="d-infobox-title">
            <Tag color="coral">Completion Rubric</Tag>
            → AI Evaluator
          </div>
          <div className="d-infobox-body">
            <strong>读取者:</strong> Evaluator LLM（判断达标的角色）<br />
            <strong>职责:</strong> 定义学生在模块内的完成条件评估逻辑<br />
            <strong>示例:</strong> "学生能说出两位主角的牺牲行为，并解释为什么他们的礼物是'最聪明的'。"
          </div>
        </div>
      </div>

      {/* Completion conditions */}
      <SubHead>完成条件类型</SubHead>
      <div className="sub-desc">每个模块的完成条件决定学生何时可以点击「下一步」。三种类型对应不同的校验机制。</div>
      <div className="cmp-grid cols-3">
        <CmpCard title="手动推进" tag="Read / Summary" tagColor="neutral"
          desc="学生完成内容浏览后点击「下一步」。适用于被动消费型模块。无 LLM 介入。"
          footer='completion: { type: "manual" }' />
        <CmpCard title="硬性指标" tag="Quiz" tagColor="green"
          desc="由系统确定性判定。例如：选择题必须答对 75%。执行框架直接校验。"
          footer='completion: { type: "hard", rule: "score >= 0.75" }' />
        <CmpCard title="AI 评估 + 时间兜底" tag="Discussion" tagColor="purple"
          desc="Evaluator LLM 根据 rubric 判定达标。必须配 timeout 防卡死。两组独立判断逻辑。"
          footer='completion: { type: "ai_eval", timeoutSec: 600 }' />
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   Section 6: Student Runtime
   ═══════════════════════════════════════════ */
function StudentRuntime() {
  return (
    <Section id="runtime" num="06" title="学生端 Runtime · 状态机"
      subtitle="学生端是一个<strong>状态机</strong>，由 manifest 中的 module list 定义状态序列。学生在框架内按顺序执行，不可跳步。每个模块内部由对应的 module type 实现渲染和交互逻辑。">

      {/* State machine flow */}
      <SubHead>执行序列与完成门控</SubHead>
      <div className="sub-desc">每个模块之间有一个「门」，由完成条件控制。AI tutor 的活动范围被限定在当前 module 内部。</div>

      <div className="flow-pipe mb-lg">
        <FlowStep num={1} title="课文阅读" type="read" color="teal" active />
        <FlowGate label="手动" />
        <FlowStep num={2} title="理解检测" type="quiz" color="blue" />
        <FlowGate label="≥75%" />
        <FlowStep num={3} title="人物分析讨论" type="discussion" color="purple" />
        <FlowGate label="AI+⏱" />
        <FlowStep num={4} title="学习总结" type="summary" color="green" />
      </div>

      {/* Module internal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <InfoBox color="blue" title="模块内交互">
          <div className="flex-col gap-sm">
            <div>每个模块由对应的 <strong>module type</strong> 实现渲染和交互逻辑</div>
            <div>AI tutor 读取该模块的 <strong>tutorInstruction</strong> 作为行为引导</div>
            <div>活动范围被限定在<strong>当前 module 内部</strong>，不越界</div>
          </div>
        </InfoBox>
        <InfoBox color="green" title="原样消费">
          <div className="flex-col gap-sm">
            <div>执行框架直接读取 <strong>manifest JSON</strong>，不经过编译或转换</div>
            <div>Manifest schema <strong>同时是</strong> design-time schema 和 runtime schema</div>
            <div>Schema 由后端提供，<strong>只读、不可扩展</strong></div>
          </div>
        </InfoBox>
      </div>

      {/* Three consumers */}
      <SubHead>Schema 的三个消费者</SubHead>
      <div className="cmp-grid cols-3">
        <CmpCard title="执行设计编辑器" tag="UI" tagColor="blue"
          desc="据 schema 渲染参数表单。结构化配置 → 表单控件（下拉、滑块）。Declarative Prompt → 文本框。" />
        <CmpCard title="Agent" tag="LLM" tagColor="purple"
          desc="据 schema 理解约束、生成合法配置。Schema 在 session 启动时注入 context。" />
        <CmpCard title="校验层" tag="Validator" tagColor="red"
          desc="据 schema 拦截非法状态。结构化字段硬校验，Prompt 字段仅非空检查。" />
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   Section 7: Teacher Observation
   ═══════════════════════════════════════════ */
function TeacherObservation() {
  return (
    <Section id="observation" num="07" title="教师端 Observation"
      subtitle="LLM 驱动的观察系统，实时监控课堂执行状态。<strong>Module-aware</strong>——知道每个学生当前在哪个 module，针对不同 module 类型展示对应的观察指标。">

      <SubHead>三层观察架构</SubHead>
      <div className="sub-desc">参考教师端 UI kit 的 Shneiderman VISM 模型。移除 AI 后教师仍可见：script + 提交计数 + 学生填写内容。AI 仅增强，不依赖。</div>

      <div className="layer-stack mb-lg">
        <LayerItem label="Ambient Band" color="t1">
          <div className="flex-col gap-sm">
            <div><strong>48px 顶栏</strong> — 当前步骤 + 全班进度分布 + 计时器</div>
            <div className="text-xs" style={{ color: 'var(--t3)' }}>始终可见，教师余光可感知</div>
          </div>
        </LayerItem>
        <LayerItem label="Overview" color="amber">
          <div className="flex-col gap-sm">
            <div><strong>右侧 360px 栏</strong> — 每个学生当前所在模块 · 提交历史 · 讨论深度评估</div>
            <div className="text-xs" style={{ color: 'var(--t3)' }}>Module-aware: Quiz 模块显示正确率，Discussion 模块显示对话深度</div>
          </div>
        </LayerItem>
        <LayerItem label="Detail Modal" color="purple">
          <div className="flex-col gap-sm">
            <div><strong>按需展开</strong> — 点击学生 → 个人 matrix + AI chat 日志 + AI 分析</div>
            <div className="text-xs" style={{ color: 'var(--t3)' }}>AI 仅在此层出现：pulse-bar hint、活动图注释、分析段落</div>
          </div>
        </LayerItem>
      </div>

      <InfoBox color="amber" title="观察维度（Module-aware）">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>• 每个学生当前所在的模块步骤</div>
          <div>• 选择题等硬性指标的提交历史</div>
          <div>• Discussion 等开放模块的讨论深度</div>
          <div>• 整体班级进度分布</div>
          <div>• AI tutor 交互聚类 ("8人在问缅甸")</div>
          <div>• 每分钟活动曲线 + Agent 注释</div>
        </div>
      </InfoBox>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   Section 8: Agent Collaboration
   ═══════════════════════════════════════════ */
function AgentCollaboration() {
  return (
    <Section id="agent" num="08" title="Agent 协作模型"
      subtitle="教师直接编辑和 Agent 生成都落到同一个文件系统层。Agent 读取的永远是最新状态——包括教师手动修改的内容。">

      {/* Dual channel */}
      <SubHead>双通道写入</SubHead>
      <div className="sub-desc">两种操作模式共享同一套文件存储，保证数据一致性。</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr 60px 1fr', gap: 0, alignItems: 'center', marginBottom: 24 }}>
        <div className="d-infobox amber" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="d-infobox-title" style={{ justifyContent: 'center' }}>教师直接编辑</div>
          <div className="d-infobox-body">Notion-alike 编辑器<br />模块列表拖拽</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>→</div>
        <div style={{ background: 'var(--t1)', color: 'var(--surface)', borderRadius: 'var(--r-card)', padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>文件系统</div>
          <div style={{ fontSize: 11, opacity: .7 }}>Source of Truth</div>
          <div style={{ fontSize: 10, opacity: .5, marginTop: 8, fontFamily: '"JetBrains Mono", monospace' }}>plan/ + execution/ + record/</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>←</div>
        <div className="d-infobox coral" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="d-infobox-title" style={{ justifyContent: 'center' }}>Agent (Chat)</div>
          <div className="d-infobox-body">文件读写生成<br />Schema 约束下的配置</div>
        </div>
      </div>

      {/* Schema injection & cross-ref */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <InfoBox color="purple" title="Schema 注入">
          <div className="flex-col gap-sm">
            <div>Agent session 启动时，后端将<strong>所有模块类型的 schema definition</strong> 注入 session context</div>
            <div>Agent 据此理解每种模块类型的合法参数范围，生成符合约束的 manifest</div>
            <div className="text-xs" style={{ color: 'var(--t3)', fontFamily: '"JetBrains Mono", monospace' }}>注入时机: session.init → context.inject(moduleSchemas)</div>
          </div>
        </InfoBox>
        <InfoBox color="teal" title="Cross-reference">
          <div className="flex-col gap-sm">
            <div>教案和执行设计之间的语义关联由 Agent 在 <strong>Chat context 中实时建立</strong></div>
            <div>不编码在文件结构中。Agent 同时拥有整个项目的上下文，自行完成 cross-reference</div>
            <div className="text-xs" style={{ color: 'var(--t3)' }}>不是 foreign key，是 AI 理解层的软关联</div>
          </div>
        </InfoBox>
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   Section 9: Review Audit View
   ═══════════════════════════════════════════ */
function ReviewAudit() {
  return (
    <Section id="review" num="09" title="Review 审计视图"
      subtitle="只读视图，无独立 source folder。由 Agent cross-read 教案和执行设计后<strong>实时生成</strong>。教案与执行设计之间的一致性是 soft constraint，由 AI lint 保证。">

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr 60px 1fr', gap: 0, alignItems: 'center', marginBottom: 24 }}>
        <div className="d-infobox teal" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="d-infobox-title" style={{ justifyContent: 'center' }}>plan/</div>
          <div className="d-infobox-body">教案文档<br />教学要求 · 素养目标</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 11 }}>+</div>
        <div className="d-infobox blue" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="d-infobox-title" style={{ justifyContent: 'center' }}>execution/</div>
          <div className="d-infobox-body">模块 manifest<br />参数配置 · 完成条件</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>→</div>
        <div className="d-infobox purple" style={{ marginBottom: 0, textAlign: 'center' }}>
          <div className="d-infobox-title" style={{ justifyContent: 'center' }}>AI Cross-Read</div>
          <div className="d-infobox-body">审计报告<br />覆盖 · 冲突 · 遗漏</div>
        </div>
      </div>

      <SubHead>审计内容</SubHead>
      <div className="cmp-grid cols-3">
        <CmpCard title="覆盖检查" tag="Coverage" tagColor="green"
          desc="执行设计中的模块是否覆盖了教案中定义的所有教学要求。每个教学目标是否有对应的模块承接。" />
        <CmpCard title="冲突检测" tag="Conflict" tagColor="red"
          desc="执行设计与教案之间是否存在矛盾。例如：教案要求讨论但 manifest 中无 discussion 模块。" />
        <CmpCard title="遗漏与冗余" tag="Lint" tagColor="amber"
          desc="潜在的遗漏（教案有但执行没承接）或冗余（执行有但教案未定义的多余模块）。" />
      </div>
    </Section>
  );
}

/* ═══════════════════════════════════════════
   Section 10: Complete Data Flow
   ═══════════════════════════════════════════ */
function DataFlowOverview() {
  return (
    <Section id="dataflow" num="10" title="完整数据流总览"
      subtitle="从项目创建到课堂执行到课后回顾的完整数据流。所有数据归属于同一个<strong>课程项目</strong>容器。">

      {/* Top: Course Project container */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-card-lg)', padding: 24, marginBottom: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 16 }}>Course Project 容器</div>

        {/* Three areas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
          <div style={{ background: 'var(--teal-bg)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--teal)', marginBottom: 4 }}>plan/</div>
            <div style={{ fontSize: 11, color: 'var(--teal)', opacity: .8 }}>教案文档</div>
            <div style={{ fontSize: 10, color: 'var(--teal)', opacity: .6, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>*.md</div>
          </div>
          <div style={{ background: 'var(--blue-bg)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>execution/</div>
            <div style={{ fontSize: 11, color: 'var(--blue)', opacity: .8 }}>模块 manifest</div>
            <div style={{ fontSize: 10, color: 'var(--blue)', opacity: .6, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>manifest.json</div>
          </div>
          <div style={{ background: 'var(--green-bg)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>record/</div>
            <div style={{ fontSize: 11, color: 'var(--green)', opacity: .8 }}>课堂记录</div>
            <div style={{ fontSize: 10, color: 'var(--green)', opacity: .6, marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>auto-generated</div>
          </div>
        </div>

        {/* Review layer */}
        <div style={{ background: 'var(--purple-bg)', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Tag color="purple">Review 视图</Tag>
          <span style={{ fontSize: 11, color: 'var(--purple)' }}>AI cross-read plan/ + execution/ → 实时审计</span>
          <span style={{ fontSize: 10, color: 'var(--purple)', opacity: .6, marginLeft: 'auto', fontFamily: '"JetBrains Mono", monospace' }}>无 source folder</span>
        </div>
      </div>

      {/* Consumers */}
      <SubHead>数据消费关系</SubHead>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        <div className="d-infobox coral" style={{ marginBottom: 0 }}>
          <div className="d-infobox-title">Agent (Chat)</div>
          <div className="d-infobox-body">
            <div className="flex-col gap-sm">
              <div><strong>读:</strong> plan/ + execution/ 全量</div>
              <div><strong>写:</strong> plan/*.md + execution/manifest.json</div>
              <div><strong>注入:</strong> 模块 schema (session init)</div>
              <div><strong>产出:</strong> Review 审计报告</div>
            </div>
          </div>
        </div>
        <div className="d-infobox blue" style={{ marginBottom: 0 }}>
          <div className="d-infobox-title">学生端执行框架</div>
          <div className="d-infobox-body">
            <div className="flex-col gap-sm">
              <div><strong>读:</strong> execution/manifest.json（原样）</div>
              <div><strong>写:</strong> record/ (交互日志)</div>
              <div><strong>运行:</strong> 状态机，按模块顺序执行</div>
              <div><strong>调用:</strong> AI Tutor + AI Evaluator</div>
            </div>
          </div>
        </div>
        <div className="d-infobox amber" style={{ marginBottom: 0 }}>
          <div className="d-infobox-title">教师端 Observation</div>
          <div className="d-infobox-body">
            <div className="flex-col gap-sm">
              <div><strong>读:</strong> 学生端实时状态</div>
              <div><strong>读:</strong> execution/ (知道模块定义)</div>
              <div><strong>展示:</strong> 进度分布 + 讨论深度</div>
              <div><strong>AI:</strong> pulse-bar hint + 分析段落</div>
            </div>
          </div>
        </div>
      </div>

      {/* Key principles */}
      <SubHead>架构原则总结</SubHead>
      <div className="cmp-grid cols-2">
        <CmpCard title="文件即真相" desc="所有数据最终落到文件系统。Agent 和教师编辑共享同一套存储。没有隐藏的黑盒数据库。" footer="Single source of truth" />
        <CmpCard title="Soft Constraint" desc="教案与执行设计之间无 foreign key。一致性由 AI lint 保证，避免硬关联的级联失效。" footer="AI lint, not FK" />
        <CmpCard title="Schema 驱动" desc="模块类型由后端 schema 定义，只读不可扩展。同一份 schema 服务 UI、Agent、校验三方。" footer="One schema, three consumers" />
        <CmpCard title="原样消费" desc="Manifest 是 design-time 和 runtime 的唯一合同。学生端直接消费 JSON，不编译不转换。" footer="No compilation step" />
      </div>
    </Section>
  );
}

/* Export to window */
Object.assign(window, {
  ExecutionDeepDive, StudentRuntime, TeacherObservation,
  AgentCollaboration, ReviewAudit, DataFlowOverview
});
