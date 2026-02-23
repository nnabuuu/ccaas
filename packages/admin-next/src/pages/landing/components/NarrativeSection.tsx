export function NarrativeSection() {
  return (
    <section className="narrative" id="narrative">
      <div className="container">
        <div className="narrative-grid">
          <div>
            <div className="section-label">
              <span className="zh">为什么选择即见</span>
              <span className="en">Why KedgeAgentic</span>
            </div>
            <h2 className="section-title">
              <span className="zh">AI 能力很强，<br />却不懂你的业务</span>
              <span className="en">Generic AI doesn't<br />know your business</span>
            </h2>
            <p className="section-desc zh">
              每次把 AI 接入业务，都要重建上下文、反复解释规则、手动传入数据。模型很强，给的却是「一般情况下」的答案——而你的业务从来不是「一般情况」。
            </p>
            <p className="section-desc zh" style={{ marginTop: 16 }}>
              问题不在模型，在于缺少一种语言让它理解你。Skills 描述业务逻辑，MCP 连接工具与数据——AI 自此真正说你的语言。
            </p>
            <p className="section-desc en">
              Every time you connect AI to your systems, you rebuild context from scratch — re-explaining rules, pasting in data, hoping it understands. A powerful model giving 'generally speaking' answers to your very specific problems.
            </p>
            <p className="section-desc en" style={{ marginTop: 16 }}>
              The problem isn't the model. There's just no persistent language for it to understand what your business actually does. Skills express your logic. MCP connects your tools. Together, they make AI fluent in your business.
            </p>
          </div>
          <div className="narrative-cards">
            <div className="narrative-card fade-in">
              <div className="narrative-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h3>
                <span className="zh">描述即能力</span>
                <span className="en">Describe. Enable.</span>
              </h3>
              <p className="zh">用 Skills 定义业务逻辑，用 MCP 连接工具与数据。你描述的，就是 AI 能理解和执行的——这就是见即所得。</p>
              <p className="en">Define business logic in Skills. Connect tools and data via MCP. What you describe is exactly what AI can understand and act on — that's what 见即所得 means.</p>
            </div>
            <div className="narrative-card fade-in">
              <div className="narrative-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                </svg>
              </div>
              <h3>
                <span className="zh">服务，即时可交付</span>
                <span className="en">Ship Agentic Services</span>
              </h3>
              <p className="zh">平台负责 Agent 生命周期、会话持久化、上下文管理、工具编排。全托管 SaaS 开箱即用，私有化部署亦可。你专注描述业务，其余交给平台。</p>
              <p className="en">The platform handles agent lifecycle, session persistence, context management, and tool orchestration. Deploy as managed SaaS or self-host on your own infrastructure. You describe the business — the platform runs it.</p>
            </div>
            <div className="narrative-card fade-in">
              <div className="narrative-card-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3>
                <span className="zh">今天描述，明天上线</span>
                <span className="en">Describe Today, Ship Tomorrow</span>
              </h3>
              <p className="zh">不需要搭建 Agent 基础设施，不需要处理模型调用、会话状态或工具编排。你只需描述业务——平台负责其余一切，Agent 服务随时可交付。</p>
              <p className="en">No need to build agent infrastructure, manage model calls, session state, or tool orchestration. Describe the business — the platform handles the rest. Your Agentic service is ready to ship.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
