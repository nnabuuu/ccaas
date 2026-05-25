const CheckIcon = () => (
  <span className="feat-check">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </span>
)

export function PricingSection() {
  return (
    <section id="pricing" className="pricing">
      <div className="container">
        <div className="section-label">
          <span className="zh">定价</span>
          <span className="en">Pricing</span>
        </div>
        <h2 className="section-title">
          <span className="zh">从验证到规模化，<br />无需迁移平台</span>
          <span className="en">From pilot to scale,<br />no platform migration</span>
        </h2>
        <p className="section-desc zh">从 Demo 到生产，同一平台，技术栈不变，数据不迁移。</p>
        <p className="section-desc en">Demo to production on the same platform. Same stack, no data migration.</p>

        <div className="plan-grid">
          {/* Free */}
          <div className="plan-card fade-in">
            <div className="plan-header">
              <div className="plan-name">Free</div>
              <div className="plan-tagline">
                <span className="zh">邀请码注册，免费评估平台能力</span>
                <span className="en">Invite-only. Free evaluation.</span>
              </div>
            </div>
            <div className="plan-price">
              <div className="plan-price-amount">¥0</div>
              <div className="plan-price-unit">
                <span className="zh">免费，永久</span>
                <span className="en">Free forever</span>
              </div>
            </div>
            <ul className="plan-features">
              <li><CheckIcon /><span><span className="zh">5 个 Skills</span><span className="en">5 Skills</span></span></li>
              <li><CheckIcon /><span><span className="zh">3 个 MCP Server</span><span className="en">3 MCP Servers</span></span></li>
              <li><CheckIcon /><span><span className="zh">3 路并发 Agent</span><span className="en">3 concurrent Agents</span></span></li>
              <li><CheckIcon /><span><span className="zh">20 个 Workspace</span><span className="en">20 Workspaces</span></span></li>
              <li><CheckIcon /><span><span className="zh">50K Token / 月（平台提供）</span><span className="en">50K tokens/mo (platform-provided)</span></span></li>
              <li><CheckIcon /><span><span className="zh">12 个渐进式 Demo 模板</span><span className="en">12 progressive demo templates</span></span></li>
            </ul>
            <a href="mailto:hello@kedgetech.io" className="plan-cta">
              <span className="zh">申请邀请码</span>
              <span className="en">Request Invite Key</span>
            </a>
          </div>

          {/* Starter (Recommended) */}
          <div className="plan-card recommended fade-in">
            <div className="recommended-badge">
              <span className="zh">推荐</span>
              <span className="en">Recommended</span>
            </div>
            <div className="plan-header">
              <div className="plan-name">Starter</div>
              <div className="plan-tagline">
                <span className="zh">生产级起点，自带 LLM Key</span>
                <span className="en">Production-ready. Bring your own key.</span>
              </div>
            </div>
            <div className="plan-price">
              <div className="plan-price-amount">¥1,999</div>
              <div className="plan-price-unit">
                <span className="zh">/ 月</span>
                <span className="en">/ month</span>
              </div>
            </div>
            <ul className="plan-features">
              <li><CheckIcon /><span><span className="zh">15 个 Skills</span><span className="en">15 Skills</span></span></li>
              <li><CheckIcon /><span><span className="zh">8 个 MCP Server</span><span className="en">8 MCP Servers</span></span></li>
              <li><CheckIcon /><span><span className="zh">10 路并发 Agent</span><span className="en">10 concurrent Agents</span></span></li>
              <li><CheckIcon /><span><span className="zh">500 个 Workspace</span><span className="en">500 Workspaces</span></span></li>
              <li><CheckIcon /><span><span className="zh">自带 LLM Key，无 Token 上限</span><span className="en">Bring your own key, no token cap</span></span></li>
            </ul>
            <a href="mailto:hello@kedgetech.io" className="plan-cta">
              <span className="zh">联系我们</span>
              <span className="en">Get Started</span>
            </a>
          </div>

          {/* Business */}
          <div className="plan-card fade-in">
            <div className="plan-header">
              <div className="plan-name">Business</div>
              <div className="plan-tagline">
                <span className="zh">无限扩展，适合规模化部署</span>
                <span className="en">Unlimited scale for enterprise deployment</span>
              </div>
            </div>
            <div className="plan-price">
              <div className="plan-price-amount">¥9,999</div>
              <div className="plan-price-unit">
                <span className="zh">/ 月</span>
                <span className="en">/ month</span>
              </div>
            </div>
            <ul className="plan-features">
              <li><CheckIcon /><span><span className="zh">无限 Skills</span><span className="en">Unlimited Skills</span></span></li>
              <li><CheckIcon /><span><span className="zh">无限 MCP Server</span><span className="en">Unlimited MCP Servers</span></span></li>
              <li><CheckIcon /><span><span className="zh">50 路并发 Agent</span><span className="en">50 concurrent Agents</span></span></li>
              <li><CheckIcon /><span><span className="zh">5,000 个 Workspace</span><span className="en">5,000 Workspaces</span></span></li>
              <li><CheckIcon /><span><span className="zh">自带 LLM Key，无 Token 上限</span><span className="en">Bring your own key, no token cap</span></span></li>
            </ul>
            <a href="mailto:hello@kedgetech.io" className="plan-cta">
              <span className="zh">联系销售</span>
              <span className="en">Talk to Sales</span>
            </a>
          </div>
        </div>

        <p style={{ fontSize: 13, color: 'var(--ink-muted)', marginBottom: 24 }}>
          <span className="zh">* 1 Workspace = 1 个终端用户账号。</span>
          <span className="en">* 1 Workspace = 1 end-user account. </span>
          <a href="https://kedgetech.gitbook.io/ji-jian-agentic/platform/concepts" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            <span className="zh">了解核心概念 →</span>
            <span className="en">Learn more →</span>
          </a>
        </p>

        <div className="enterprise-strip fade-in">
          <div>
            <div className="enterprise-strip-title">
              <span className="zh">Enterprise — 定制合约</span>
              <span className="en">Enterprise — Custom Contract</span>
            </div>
            <div className="enterprise-strip-desc">
              <span className="zh">私有化部署 · 定制 Skills &amp; 并发 · SLA 保障 · 自带 LLM 基础设施 · 专属对接团队</span>
              <span className="en">On-premise deployment · Custom Skills &amp; concurrency · SLA guarantee · Bring your own LLM infrastructure · Dedicated team</span>
            </div>
          </div>
          <a href="mailto:hello@kedgetech.io" className="enterprise-strip-cta">
            <span className="zh">洽谈合作</span>
            <span className="en">Contact Us</span>
          </a>
        </div>
      </div>
    </section>
  )
}
