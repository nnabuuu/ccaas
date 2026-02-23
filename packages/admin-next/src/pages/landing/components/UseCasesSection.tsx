export function UseCasesSection() {
  return (
    <section className="usecases" id="usecases">
      <div className="container">
        <div className="section-label">
          <span className="zh">应用场景</span>
          <span className="en">Use Cases</span>
        </div>
        <h2 className="section-title">
          <span className="zh">真实业务，已在运行</span>
          <span className="en">Built for real workloads</span>
        </h2>
        <p className="section-desc zh">从业务团队的第一个 AI 落地，到开发者构建生产级 Agentic 应用。</p>
        <p className="section-desc en">From a team's first AI deployment to developers shipping production-grade Agentic applications.</p>
        <div className="usecase-grid">
          <div className="usecase-card fade-in">
            <div className="usecase-tag">
              <span className="zh">定时执行</span>
              <span className="en">Scheduled</span>
            </div>
            <h3>
              <span className="zh">每日内容聚合</span>
              <span className="en">Daily Content Aggregation</span>
            </h3>
            <p className="zh">Agent 每天 4 点自动运行，抓取配置的站点、汇总更新，通过 MCP 工具发送邮件摘要。</p>
            <p className="en">Agent runs at 4 AM daily, crawls configured websites, summarizes updates, and sends an email digest via MCP tools.</p>
            <div className="usecase-detail">
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                Cron: 0 4 * * *
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                </svg>
                <span className="zh">无界面执行</span>
                <span className="en">Headless</span>
              </span>
            </div>
          </div>

          <div className="usecase-card fade-in">
            <div className="usecase-tag">
              <span className="zh">人机协作</span>
              <span className="en">Interactive</span>
            </div>
            <h3>
              <span className="zh">课程方案设计师</span>
              <span className="en">Lesson Plan Designer</span>
            </h3>
            <p className="zh">老师只需定义教学 Skills，平台负责执行。AI 生成课程内容，实时同步结构化数据到表单字段——无需写任何代码。</p>
            <p className="en">Teachers define teaching Skills; the platform handles execution. AI generates curriculum content and syncs structured data to form fields in real-time — no code required.</p>
            <div className="usecase-detail">
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 3 21 3 21 8"/>
                  <line x1="4" y1="20" x2="21" y2="3"/>
                </svg>
                9 MCP tools
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/>
                </svg>
                <span className="zh">实时同步</span>
                <span className="en">Real-time sync</span>
              </span>
            </div>
          </div>

          <div className="usecase-card fade-in">
            <div className="usecase-tag">
              <span className="zh">监控</span>
              <span className="en">Monitoring</span>
            </div>
            <h3>
              <span className="zh">自动化系统巡检</span>
              <span className="en">Automated System Checks</span>
            </h3>
            <p className="zh">Agent 每 5 分钟检查各服务健康状态，在异常时给出上下文感知的分析与告警。</p>
            <p className="en">Agent runs every 5 minutes, checks service health across endpoints, and alerts on anomalies with context-aware analysis.</p>
            <div className="usecase-detail">
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                <span className="zh">间隔：5 分钟</span>
                <span className="en">Interval: 5min</span>
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span className="zh">完整审计链路</span>
                <span className="en">Full audit trail</span>
              </span>
            </div>
          </div>

          <div className="usecase-card fade-in">
            <div className="usecase-tag">
              <span className="zh">零 Agent 代码</span>
              <span className="en">Skills Only · No Agent Code</span>
            </div>
            <h3>
              <span className="zh">McKinsey 风格分析报告</span>
              <span className="en">McKinsey-Style Analysis</span>
            </h3>
            <p className="zh">咨询团队只需定义分析框架 Skills 和数据源 MCP，平台负责 Agent 执行与报告生成全流程——无需编写任何 Agent 代码，即可交付专业结构化分析报告。</p>
            <p className="en">Define analysis framework Skills and data source MCP tools. The platform handles agent execution and report generation end-to-end — ship a production-grade AI solution without writing a single line of agent code.</p>
            <div className="usecase-detail">
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                <span className="zh">Skills 驱动</span>
                <span className="en">Skills-driven</span>
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/>
                </svg>
                <span className="zh">结构化输出</span>
                <span className="en">Structured output</span>
              </span>
            </div>
          </div>

          <div className="usecase-card fade-in" style={{ gridColumn: 'span 2' }}>
            <div className="usecase-tag">
              <span className="zh">动画渲染</span>
              <span className="en">Animation Rendering</span>
            </div>
            <h3>
              <span className="zh">康复训练设计器</span>
              <span className="en">Rehab Motion Renderer</span>
            </h3>
            <p className="zh">从医学检查报告出发，AI 生成个性化康复训练方案，渲染为 SVG 骨架动画交互训练页面。医生上传报告，平台自动输出结构化方案并驱动骨架动画——动作、时长、阶段一目了然。</p>
            <p className="en">Starting from a medical examination report, AI generates a personalized rehabilitation plan and renders it as an interactive SVG skeleton animation page. Upload a report, and the platform outputs a structured plan driving real-time bone animations — exercises, duration, and phases at a glance.</p>
            <div className="usecase-detail">
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
                <span className="zh">SVG 骨架动画</span>
                <span className="en">SVG skeleton animation</span>
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="16 3 21 3 21 8"/>
                  <line x1="4" y1="20" x2="21" y2="3"/>
                </svg>
                10 sync fields
              </span>
              <span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
                </svg>
                useOutputSync
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
