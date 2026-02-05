import type { QuizAnalysis } from '../types';
import './AnalysisView.css';

interface AnalysisViewProps {
  analysis: QuizAnalysis;
}

export default function AnalysisView({ analysis }: AnalysisViewProps) {
  const renderMarkdown = (text?: string) => {
    if (!text) return null;
    // Simple markdown rendering (in production, use a library like react-markdown)
    return (
      <div className="markdown-content">
        {text.split('\n').map((line, i) => {
          if (line.startsWith('###')) {
            return <h4 key={i}>{line.replace(/^###\s*/, '')}</h4>;
          }
          if (line.startsWith('##')) {
            return <h3 key={i}>{line.replace(/^##\s*/, '')}</h3>;
          }
          if (line.startsWith('#')) {
            return <h2 key={i}>{line.replace(/^#\s*/, '')}</h2>;
          }
          if (line.startsWith('- ')) {
            return <li key={i}>{line.replace(/^-\s*/, '')}</li>;
          }
          return line ? <p key={i}>{line}</p> : <br key={i} />;
        })}
      </div>
    );
  };

  return (
    <div className="analysis-view">
      {/* Thinking Process - 解题思路 */}
      {analysis.thinking_process && (
        <div className="analysis-section">
          <div className="section-title">💡 解题思路</div>
          <div className="section-content">
            {renderMarkdown(analysis.thinking_process)}
          </div>
        </div>
      )}

      {/* Solution Steps - 解题步骤 */}
      {analysis.solution_steps && analysis.solution_steps.length > 0 && (
        <div className="analysis-section">
          <div className="section-title">📋 解题步骤</div>
          <div className="section-content">
            {analysis.solution_steps.map((step, index) => (
              <div key={index} className="solution-step">
                <div className="step-header">
                  <span className="step-number">步骤 {step.stepNumber}</span>
                  <span className="step-title">{step.title}</span>
                </div>
                <p className="step-description">{step.description}</p>
                {step.formula && (
                  <div className="step-formula">
                    <code>{step.formula}</code>
                  </div>
                )}
                {step.reasoning && (
                  <p className="step-reasoning">
                    <strong>推理：</strong> {step.reasoning}
                  </p>
                )}
                {step.commonErrors && step.commonErrors.length > 0 && (
                  <div className="common-errors">
                    <strong>常见错误：</strong>
                    <ul>
                      {step.commonErrors.map((error, i) => (
                        <li key={i}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Mistakes - 常见错误 */}
      {analysis.common_mistakes && analysis.common_mistakes.length > 0 && (
        <div className="analysis-section">
          <div className="section-title">⚠️ 常见错误</div>
          <div className="section-content">
            {analysis.common_mistakes.map((mistake, index) => (
              <div key={index} className="mistake-item">
                <div className="mistake-header">
                  <span className={`frequency-badge ${mistake.frequency}`}>
                    {mistake.frequency === 'high' && '高频'}
                    {mistake.frequency === 'medium' && '中频'}
                    {mistake.frequency === 'low' && '低频'}
                  </span>
                  <p className="mistake-description">{mistake.description}</p>
                </div>
                {mistake.remediation && (
                  <div className="remediation">
                    <strong>补救措施：</strong> {mistake.remediation}
                  </div>
                )}
                {mistake.knowledgeGaps && mistake.knowledgeGaps.length > 0 && (
                  <div className="knowledge-gaps">
                    <strong>知识缺口：</strong>
                    <span>{mistake.knowledgeGaps.join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Gap Analysis - 知识缺口分析 */}
      {analysis.knowledge_gap_analysis && (
        <div className="analysis-section">
          <div className="section-title">📊 知识缺口分析</div>
          <div className="section-content">
            {renderMarkdown(analysis.knowledge_gap_analysis)}
          </div>
        </div>
      )}

      {/* Difficulty & Time Estimate */}
      <div className="analysis-meta">
        {analysis.difficulty_rationale && (
          <div className="meta-item">
            <strong>难度说明：</strong>
            <span>{analysis.difficulty_rationale}</span>
          </div>
        )}
        {analysis.time_estimate && (
          <div className="meta-item">
            <strong>预计用时：</strong>
            <span>{analysis.time_estimate}</span>
          </div>
        )}
        {analysis.analyzed_at && (
          <div className="meta-item">
            <strong>分析时间：</strong>
            <span>{new Date(analysis.analyzed_at).toLocaleString('zh-CN')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
