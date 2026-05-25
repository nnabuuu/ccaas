export function DeveloperExperienceSection() {
  const nodes = [
    { label: 'Skills', titleZh: '定义业务意图', titleEn: 'Define Intent', descZh: '用 SKILL.md 描述 AI 该做什么——触发条件、工具权限、行为规范', descEn: 'Describe what AI should do — triggers, tool permissions, behavior rules' },
    { label: 'MCP', titleZh: '连通工具与数据', titleEn: 'Connect Tools', descZh: 'MCP Server 封装现有系统，AI 像调用函数一样使用你的工具和数据', descEn: 'MCP Servers wrap existing systems — AI calls your tools like functions' },
    { label: 'Platform', titleZh: '执行与编排', titleEn: 'Execute', descZh: '平台调度 Agent、管理会话、路由 Skill、持久化上下文', descEn: 'Schedules agents, manages sessions, routes skills, persists context' },
    { label: 'Harness', titleZh: '质量守护', titleEn: 'Guard Quality', descZh: '12 项自动检查 + 棘轮，技术债只减不增', descEn: '12 checks + ratchet — tech debt only decreases' },
    { label: 'UI/UX', titleZh: '交付用户体验', titleEn: 'Deliver UX', descZh: 'SDK hooks + SYNC_FIELDS 实时同步 AI 输出到界面', descEn: 'SDK hooks + SYNC_FIELDS sync AI output to UI in real-time' },
  ]

  const cards = [
    { titleZh: 'Skills × MCP — 意图与能力的解耦', titleEn: 'Skills × MCP — Intent & Capability Decoupled', descZh: 'Skills 定义 AI 该做什么，MCP 提供做事的工具——业务逻辑与数据源自然解耦。换工具不影响业务描述，换业务不需要重写工具。', descEn: 'Skills define what AI should do. MCP provides the tools. Business logic and data sources decouple naturally — swap tools without touching rules, swap business without rewriting tools.' },
    { titleZh: 'Platform × Harness — 执行即可信赖', titleEn: 'Platform × Harness — Every Delivery Verified', descZh: '平台执行每次 Agent 迭代，Harness 棘轮确保质量只增不减。不是"上线后再测"，而是每次交付都经过验证。', descEn: 'The platform executes every iteration. Harness ratchet ensures quality only improves. Not "test after launch" — every delivery is verified.' },
    { titleZh: '全链路同步 — 从 AI 到用户，零断层', titleEn: 'End-to-End Sync — AI to UI, Zero Gap', descZh: 'AI 通过 write_output 产出结构化数据，toolEventTriggers 推送 SSE，SYNC_FIELDS 实时订阅——从 AI 思考到 UI 更新，整条链路自动贯通。', descEn: 'AI produces structured data via write_output, toolEventTriggers push SSE, SYNC_FIELDS subscribe in real-time — the entire AI-to-UI pipeline is automatic.' },
  ]

  return (
    <section className="dx-section" id="dx">
      <div className="container">
        <div className="section-label">
          <span className="zh">方案交付</span>
          <span className="en">Solution Delivery</span>
        </div>
        <h2 className="section-title">
          <span className="zh">从业务描述到生产交付的完整闭环</span>
          <span className="en">From business description to production delivery</span>
        </h2>
        <p className="section-desc zh">Skills 定义意图、MCP 连通工具、平台编排执行、Harness 守护质量、SDK 交付体验——五个环节有机协作，业务描述即生产服务。</p>
        <p className="section-desc en">Skills define intent, MCP connects tools, the platform orchestrates execution, Harness guards quality, SDK delivers UX — five stages work together so business descriptions become production services.</p>

        {/* Flow pipeline */}
        <div className="sd-flow-wrapper">
          <div className="sd-flow">
            {nodes.map((node, i) => (
              <div key={node.label} style={{ display: 'contents' }}>
                <div className="sd-node fade-in">
                  <div className="sd-node-label">{node.label}</div>
                  <div className="sd-node-title">
                    <span className="zh">{node.titleZh}</span>
                    <span className="en">{node.titleEn}</span>
                  </div>
                  <div className="sd-node-desc">
                    <span className="zh">{node.descZh}</span>
                    <span className="en">{node.descEn}</span>
                  </div>
                </div>
                {i < nodes.length - 1 && <div className="sd-arrow">→</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Interaction cards */}
        <div className="sd-interactions">
          {cards.map((card) => (
            <div className="sd-card fade-in" key={card.titleEn}>
              <h3>
                <span className="zh">{card.titleZh}</span>
                <span className="en">{card.titleEn}</span>
              </h3>
              <p>
                <span className="zh">{card.descZh}</span>
                <span className="en">{card.descEn}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
