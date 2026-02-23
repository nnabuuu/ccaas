export function FeaturesGrid() {
  const features = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
        </svg>
      ),
      titleZh: '会话管理',
      titleEn: 'Session Management',
      descZh: '长时运行的 CLI 进程，上下文保留、会话恢复、空闲超时、每会话进程隔离。',
      descEn: 'Long-running CLI processes with context preservation, session resume, idle timeout, and process isolation per session.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 3 21 3 21 8"/>
          <line x1="4" y1="20" x2="21" y2="3"/>
          <polyline points="21 16 21 21 16 21"/>
          <line x1="15" y1="15" x2="21" y2="21"/>
          <line x1="4" y1="4" x2="9" y2="9"/>
        </svg>
      ),
      titleZh: 'Skill 路由',
      titleEn: 'Skill Routing',
      descZh: '关键词、正则、意图、上下文触发器，自动将消息分发到专项 Agent Skills。',
      descEn: 'Keyword, regex, intent, and context-based triggers automatically dispatch messages to specialized agent skills.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22 6 12 13 2 6"/>
        </svg>
      ),
      titleZh: 'MCP 工具编排',
      titleEn: 'MCP Tool Orchestration',
      descZh: '中央化工具池，健康检查，REST API 适配器封装遗留服务，多认证支持。',
      descEn: 'Centralized tool pool with health checks, REST API adapter for wrapping legacy services, and multi-auth support.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
      ),
      titleZh: '定时执行',
      titleEn: 'Scheduled Execution',
      descZh: 'Cron、Interval、One-time 调度，无界面 CLI 执行，重试逻辑、并发控制与遗漏恢复。',
      descEn: 'Cron, interval, and one-time scheduling with headless CLI execution, retry logic, concurrency control, and missed-run recovery.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      titleZh: '全链路可观测',
      titleEn: 'Full Observability',
      descZh: '22 种实体类型全程追踪——每次工具调用、思考过程、Token 用量与进程生命周期事件，均持久化可查。',
      descEn: '22 entity types tracked — every tool call, thinking block, token usage, and process lifecycle event persisted and queryable.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      ),
      titleZh: '多租户与权限',
      titleEn: 'Multi-Tenant & Auth',
      descZh: 'API Key 认证，9 种权限范围，租户隔离、速率限制与完整审计日志。',
      descEn: 'API key authentication with 9 scopes, tenant isolation, rate limiting, and complete audit logging.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/>
          <path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
      titleZh: 'Session Templates',
      titleEn: 'Session Templates',
      descZh: '在 solution.json 中预设多角色 AI 行为（如教师模式/学生模式），平台自动 upsert 到租户配置，无需代码修改。',
      descEn: 'Define multi-role AI behaviors in solution.json (e.g. teacher/student mode). The platform auto-upserts them to tenant config — no code changes required.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
        </svg>
      ),
      titleZh: 'useOutputSync',
      titleEn: 'useOutputSync',
      descZh: 'SDK 内置 pending state 管理 hook，替代每个 Solution frontend 中的 30+ 行同步样板代码，开箱即用。',
      descEn: 'Built-in SDK hook for managing output pending state. Replaces 30+ lines of sync boilerplate in every Solution frontend — works out of the box.',
    },
  ]

  return (
    <section className="features" id="features">
      <div className="container">
        <div className="section-label">
          <span className="zh">平台能力</span>
          <span className="en">Platform Capabilities</span>
        </div>
        <h2 className="section-title">
          <span className="zh">生产级所需的一切</span>
          <span className="en">Everything agents need<br />to run in production</span>
        </h2>
        <p className="section-desc zh">平台负责 Agent 执行、上下文管理、会话持久化、工具编排。你只需专注 Skills 和 MCP——描述你的业务，其余交给平台。</p>
        <p className="section-desc en">The platform handles agent execution, context management, session persistence, and tool orchestration. You focus on Skills and MCP — describe your business, the platform does the rest.</p>
        <div className="feature-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card fade-in">
              <div className="feature-icon">{f.icon}</div>
              <h3>
                <span className="zh">{f.titleZh}</span>
                <span className="en">{f.titleEn}</span>
              </h3>
              <p className="zh">{f.descZh}</p>
              <p className="en">{f.descEn}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
