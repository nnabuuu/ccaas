const skipped = [
  { zh: 'Session 生命周期管理', en: 'Session lifecycle management' },
  { zh: 'Agent 进程调度与隔离', en: 'Agent process scheduling & isolation' },
  { zh: '上下文持久化与恢复', en: 'Context persistence & recovery' },
  { zh: 'MCP 工具编排与健康检查', en: 'MCP tool orchestration & health checks' },
  { zh: '多租户隔离', en: 'Multi-tenant isolation' },
  { zh: 'API 认证与权限管理', en: 'API authentication & authorization' },
  { zh: 'Token 统计与可观测性', en: 'Token tracking & observability' },
  { zh: '定时任务调度', en: 'Scheduled task execution' },
  { zh: 'Vue / React 客户端 SDK', en: 'Vue / React client SDKs' },
  { zh: '审计日志', en: 'Audit logging' },
]

export function SkipSection() {
  return (
    <section className="skip-section" id="skip">
      <div className="container">
        <div className="section-label">
          <span className="zh">省去的工作</span>
          <span className="en">What you skip</span>
        </div>
        <h2 className="section-title">
          <span className="zh">其余的，不用你来造</span>
          <span className="en">Everything else is already done</span>
        </h2>
        <p className="section-desc zh">
          一个 Agent 服务从 0 到上线，通常要解决十几个工程问题。即见平台把它们全部处理好了——你只需要描述业务。
        </p>
        <p className="section-desc en">
          Shipping an agent service from scratch means solving a dozen engineering problems first. KedgeAgentic handles all of them — so you can just describe the business.
        </p>

        <div className="skip-layout">
          {/* Left: the burden */}
          <div className="skip-before fade-in">
            <div className="skip-card-label">
              <span className="zh">从零自建</span>
              <span className="en">Building from scratch</span>
            </div>
            <ul className="skip-list">
              {skipped.map((item, i) => (
                <li key={i} className="skip-item">
                  <span className="zh">{item.zh}</span>
                  <span className="en">{item.en}</span>
                </li>
              ))}
            </ul>
            <div className="skip-estimate skip-estimate-bad">
              <span className="zh">预计耗时：数周 → 数月</span>
              <span className="en">Estimated: weeks to months</span>
            </div>
          </div>

          {/* Arrow divider */}
          <div className="skip-arrow">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M6 16h20M19 9l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Right: the relief */}
          <div className="skip-after fade-in">
            <div className="skip-card-label">
              <span className="zh">用即见</span>
              <span className="en">With KedgeAgentic</span>
            </div>
            <div className="skip-steps">
              <div className="skip-step">
                <div className="skip-step-num">01</div>
                <div>
                  <div className="skip-step-title">Skills</div>
                  <div className="skip-step-desc">
                    <span className="zh">描述你的业务逻辑</span>
                    <span className="en">Describe your business logic</span>
                  </div>
                </div>
              </div>
              <div className="skip-step-connector" />
              <div className="skip-step">
                <div className="skip-step-num">02</div>
                <div>
                  <div className="skip-step-title">MCP</div>
                  <div className="skip-step-desc">
                    <span className="zh">连接工具与数据</span>
                    <span className="en">Connect tools & data</span>
                  </div>
                </div>
              </div>
              <div className="skip-step-connector" />
              <div className="skip-step">
                <div className="skip-step-num">03</div>
                <div>
                  <div className="skip-step-title">
                    <span className="zh">上线</span>
                    <span className="en">Ship</span>
                  </div>
                  <div className="skip-step-desc">
                    <span className="zh">Agent 服务即时交付</span>
                    <span className="en">Your agent service, ready</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="skip-estimate skip-estimate-good">
              <span className="zh">预计耗时：一天之内</span>
              <span className="en">Estimated: a day or less</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
