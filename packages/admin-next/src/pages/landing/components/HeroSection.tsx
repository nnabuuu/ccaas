import { useLandingStats } from '@/hooks/useLandingStats'

export function HeroSection() {
  const stats = useLandingStats()

  return (
    <section className="hero">
      <div className="hero-badge">
        <span className="hero-badge-dot"></span>
        Agentic as a Service
      </div>
      <h1>
        <span className="cn-title">即见Agentic · 见即所得</span>
        <span className="zh">描述能力，上线 Agent，如此而已</span>
        <span className="en">Describe it. Ship it. That's all there is.</span>
      </h1>

      <p className="hero-subtitle">
        <span className="zh">无需再造轮子——用 SKILL.md 描述业务，接 MCP 连通工具。Harness 棘轮守护质量，Agent 服务即刻交付。</span>
        <span className="en">No infrastructure to build first. Describe logic in SKILL.md, connect tools via MCP. Harness ratchet guards quality — your agent service is ready to ship.</span>
      </p>

      {/* 3-step flow */}
      <div className="hero-steps">
        <div className="hs-step">
          <div className="hs-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div className="hs-title zh">描述业务</div>
          <div className="hs-title en">Describe</div>
          <div className="hs-desc zh">用 SKILL.md 描述业务逻辑，用 MCP 连通工具</div>
          <div className="hs-desc en">Describe logic in SKILL.md, connect tools via MCP</div>
        </div>

        <div className="hs-connector">
          <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
            <path d="M0 7h16M13 2l5 5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="hs-step">
          <div className="hs-icon accent">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
              <path d="M7 8h10M7 11h6"/>
            </svg>
          </div>
          <div className="hs-title zh">即见平台</div>
          <div className="hs-title en">KedgeAgentic Platform</div>
          <div className="hs-desc zh">调度 Agent 执行，接入模型服务，管理会话</div>
          <div className="hs-desc en">Runs agents, calls model APIs, manages sessions</div>
        </div>

        <div className="hs-connector">
          <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
            <path d="M0 7h16M13 2l5 5-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="hs-step">
          <div className="hs-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
          </div>
          <div className="hs-title zh">交付 Agent 服务</div>
          <div className="hs-title en">Ship Service</div>
          <div className="hs-desc zh">12 项 Harness 检查守护质量，即刻交付</div>
          <div className="hs-desc en">12 Harness checks guard quality, ship instantly</div>
        </div>
      </div>

      {/* Social proof bar */}
      <div className="hero-proof">
        <div className="hero-proof-item">
          <span className="hero-proof-num">
            {stats ? `${stats.totalSessions}` : '16'}
          </span>
          <span className="hero-proof-label zh">
            {stats ? '历史会话数' : '业务解决方案'}
          </span>
          <span className="hero-proof-label en">
            {stats ? 'Total sessions' : 'Business solutions'}
          </span>
        </div>
        <div className="hero-proof-divider"></div>
        <div className="hero-proof-item">
          <span className="hero-proof-num">
            {stats ? `${stats.totalSkills}` : '58'}
          </span>
          <span className="hero-proof-label zh">
            {stats ? '已注册 Skills' : 'Skills 已注册'}
          </span>
          <span className="hero-proof-label en">
            {stats ? 'Registered skills' : 'Skills registered'}
          </span>
        </div>
        <div className="hero-proof-divider"></div>
        <div className="hero-proof-item">
          <span className="hero-proof-num">12</span>
          <span className="hero-proof-label zh">渐进式 Demo</span>
          <span className="hero-proof-label en">Progressive demos</span>
        </div>
      </div>

      <div className="hero-actions">
        <a href="https://kedgetech.gitbook.io/ji-jian-agentic/getting-started/quickstart" target="_blank" rel="noreferrer" className="btn-primary">
          <span className="zh">快速开始</span>
          <span className="en">Quickstart Guide</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3.33 8h9.34M8.67 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
        <a href="https://kedgetech.gitbook.io/ji-jian-agentic" target="_blank" rel="noreferrer" className="btn-secondary">
          <span className="zh">浏览文档</span>
          <span className="en">Browse Docs</span>
        </a>
      </div>
    </section>
  )
}
