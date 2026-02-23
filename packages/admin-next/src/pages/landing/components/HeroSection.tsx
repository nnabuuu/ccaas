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
        <span className="zh">你所描述的，<br />即 AI 所能做到的。</span>
        <span className="en">What you describe,<br />the AI delivers.</span>
      </h1>

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
          <div className="hs-desc zh">用 Skills 定义逻辑，用 MCP 连接工具和数据</div>
          <div className="hs-desc en">Define logic in Skills, connect tools via MCP</div>
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
          <div className="hs-title">即见平台</div>
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
          <div className="hs-desc zh">增强现有系统，或直接面向你的用户</div>
          <div className="hs-desc en">Enhance existing systems or ship to users</div>
        </div>
      </div>

      {/* Social proof bar */}
      <div className="hero-proof">
        <div className="hero-proof-item">
          <span className="hero-proof-num">
            {stats ? `${stats.totalSessions}` : '4+'}
          </span>
          <span className="hero-proof-label zh">
            {stats ? '历史会话数' : '生产场景落地'}
          </span>
          <span className="hero-proof-label en">
            {stats ? 'Total sessions' : 'Production use cases'}
          </span>
        </div>
        <div className="hero-proof-divider"></div>
        <div className="hero-proof-item">
          <span className="hero-proof-num">
            {stats ? `${stats.totalSkills}` : '20+'}
          </span>
          <span className="hero-proof-label zh">
            {stats ? '已注册 Skills' : 'Agent 事件类型'}
          </span>
          <span className="hero-proof-label en">
            {stats ? 'Registered skills' : 'Agent event types'}
          </span>
        </div>
        <div className="hero-proof-divider"></div>
        <div className="hero-proof-item">
          <span className="hero-proof-num">On-Prem</span>
          <span className="hero-proof-label zh">支持私有化部署</span>
          <span className="hero-proof-label en">Self-hosted available</span>
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
