export function CTASection() {
  return (
    <section className="cta-section">
      <div className="container">
        <div className="section-label">
          <span className="zh">开始使用</span>
          <span className="en">Get Started</span>
        </div>
        <h2 className="section-title">
          <span className="zh">描述你的业务。<br />其余，交给即见。</span>
          <span className="en">Describe your business.<br />We handle the rest.</span>
        </h2>
        <p className="section-desc zh">从 Skills 到生产服务，平台全程托管。</p>
        <p className="section-desc en">From Skills to production service — the platform handles everything in between.</p>
        <div className="hero-actions" style={{ marginTop: 40 }}>
          <a href="https://kedgetech.gitbook.io/ji-jian-agentic" target="_blank" rel="noreferrer" className="btn-primary">
            <span className="zh">开始构建</span>
            <span className="en">Start Building</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3.33 8h9.34M8.67 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <a href="https://kedgetech.gitbook.io/ji-jian-agentic" target="_blank" rel="noreferrer" className="btn-secondary">
            <span className="zh">阅读文档</span>
            <span className="en">Read the Docs</span>
          </a>
        </div>
      </div>
    </section>
  )
}
