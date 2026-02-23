const Arrow = () => (
  <div className="arch-arrow">
    <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
      <path d="M0 8h28M24 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
)

export function ArchitectureDiagram() {
  return (
    <section className="architecture" id="architecture">
      <div className="container">
        <div className="section-label">
          <span className="zh">工作原理</span>
          <span className="en">How It Works</span>
        </div>
        <h2 className="section-title">
          <span className="zh">架构</span>
          <span className="en">Architecture</span>
        </h2>
        <p className="section-desc zh">分层系统，每个组件职责清晰。</p>
        <p className="section-desc en">A layered system where each component has clear responsibilities.</p>

        <div className="arch-diagram fade-in">
          <div className="arch-flow">
            <div className="arch-node">
              <div className="arch-node-label">
                <span className="zh">输入</span>
                <span className="en">Input</span>
              </div>
              <div className="arch-node-title">
                <span className="zh">用户意图</span>
                <span className="en">User Intent</span>
              </div>
              <div className="arch-node-desc">
                <span className="zh">对话 / API 调用 / 定时</span>
                <span className="en">Prompt / API call / Cron</span>
              </div>
            </div>
            <Arrow />
            <div className="arch-node">
              <div className="arch-node-label">
                <span className="zh">路由</span>
                <span className="en">Routing</span>
              </div>
              <div className="arch-node-title">
                <span className="zh">Skill 路由器</span>
                <span className="en">Skill Router</span>
              </div>
              <div className="arch-node-desc">
                <span className="zh">触发器匹配</span>
                <span className="en">Trigger matching</span>
              </div>
            </div>
            <Arrow />
            <div className="arch-node" style={{ borderColor: 'var(--accent)', background: 'var(--accent-light)' }}>
              <div className="arch-node-label">
                <span className="zh">引擎</span>
                <span className="en">Engine</span>
              </div>
              <div className="arch-node-title">
                <span className="zh">Agent 运行时</span>
                <span className="en">Agent Runtime</span>
              </div>
              <div className="arch-node-desc">Agent Engine</div>
            </div>
            <Arrow />
            <div className="arch-branch">
              <div className="arch-node">
                <div className="arch-node-label">
                  <span className="zh">工具</span>
                  <span className="en">Tools</span>
                </div>
                <div className="arch-node-title">MCP Pool</div>
                <div className="arch-node-desc">
                  <span className="zh">内置 + REST 适配器</span>
                  <span className="en">Built-in + REST adapters</span>
                </div>
              </div>
              <div className="arch-node">
                <div className="arch-node-label">
                  <span className="zh">调度</span>
                  <span className="en">Scheduler</span>
                </div>
                <div className="arch-node-title">
                  <span className="zh">任务引擎</span>
                  <span className="en">Task Engine</span>
                </div>
                <div className="arch-node-desc">Cron / Interval / Once</div>
              </div>
            </div>
          </div>
          <div className="arch-outputs">
            <div className="arch-output">
              <span className="zh">事件流（20+ 类型）</span>
              <span className="en">Event Stream (20+ types)</span>
            </div>
            <div className="arch-output">
              <span className="zh">消息持久化</span>
              <span className="en">Message Persistence</span>
            </div>
            <div className="arch-output">
              <span className="zh">结构化输出</span>
              <span className="en">Structured Output</span>
            </div>
            <div className="arch-output">
              <span className="zh">管理后台</span>
              <span className="en">Admin Dashboard</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
