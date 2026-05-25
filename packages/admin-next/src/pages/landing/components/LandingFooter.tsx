export function LandingFooter() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-brand-name">
            <div className="nav-logo-mark" style={{ width: 28, height: 28, fontSize: 12, borderRadius: 6 }}>KA</div>
            KedgeAgentic
          </div>
          <p className="zh">企业级 Agentic AI 基础设施。你所描述的，即 AI 所能做到的。</p>
          <p className="en">Agentic AI Infrastructure. What you describe is what you get.</p>
        </div>
        <div className="footer-cols">
          <div className="footer-col">
            <h4>
              <span className="zh">产品</span>
              <span className="en">Product</span>
            </h4>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/platform/capabilities" target="_blank" rel="noreferrer">
              <span className="zh">功能特性</span>
              <span className="en">Features</span>
            </a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/platform/architecture" target="_blank" rel="noreferrer">
              <span className="zh">架构</span>
              <span className="en">Architecture</span>
            </a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/platform/solutions" target="_blank" rel="noreferrer">
              <span className="zh">解决方案</span>
              <span className="en">Solutions</span>
            </a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/platform/value" target="_blank" rel="noreferrer">
              <span className="zh">为什么选择即见</span>
              <span className="en">Why KedgeAgentic</span>
            </a>
          </div>
          <div className="footer-col">
            <h4>
              <span className="zh">开发者</span>
              <span className="en">Developers</span>
            </h4>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic" target="_blank" rel="noreferrer">
              <span className="zh">文档</span>
              <span className="en">Documentation</span>
            </a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/api/rest" target="_blank" rel="noreferrer">REST API</a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/api/websocket" target="_blank" rel="noreferrer">WebSocket API</a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/guide/skill-writing" target="_blank" rel="noreferrer">
              <span className="zh">Skill 编写指南</span>
              <span className="en">Skill Guide</span>
            </a>
          </div>
          <div className="footer-col">
            <h4>
              <span className="zh">快速上手</span>
              <span className="en">Getting Started</span>
            </h4>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/getting-started/installation" target="_blank" rel="noreferrer">
              <span className="zh">安装部署</span>
              <span className="en">Installation</span>
            </a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/getting-started/quickstart" target="_blank" rel="noreferrer">
              <span className="zh">快速开始</span>
              <span className="en">Quickstart</span>
            </a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/guide/mcp-server" target="_blank" rel="noreferrer">MCP Server</a>
            <a href="https://kedgetech.gitbook.io/ji-jian-agentic/reference/best-practices" target="_blank" rel="noreferrer">
              <span className="zh">最佳实践</span>
              <span className="en">Best Practices</span>
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span>&copy; 2025–2026 KedgeAgentic. All rights reserved.</span>
        <span style={{ fontFamily: "'Noto Serif', serif", fontStyle: 'italic', opacity: 0.6 }}>
          凡所有相，皆是虚妄。若见诸相非相，即见如来。——《金刚经》
        </span>
      </div>
    </footer>
  )
}
