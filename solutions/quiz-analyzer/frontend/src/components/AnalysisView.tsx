import {
  LightBulbIcon,
  ListBulletIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import type { QuizAnalysis } from '../types';

interface AnalysisViewProps {
  analysis: QuizAnalysis;
}

export default function AnalysisView({ analysis }: AnalysisViewProps) {
  const renderMarkdown = (text?: string) => {
    if (!text) return null;
    // Simple markdown rendering (in production, use a library like react-markdown)
    return (
      <div className="space-y-3">
        {text.split('\n').map((line, i) => {
          if (line.startsWith('###')) {
            return (
              <h4 key={i} className="text-base font-semibold text-slate-800 mt-4">
                {line.replace(/^###\s*/, '')}
              </h4>
            );
          }
          if (line.startsWith('##')) {
            return (
              <h3 key={i} className="text-lg font-semibold text-slate-900 mt-4">
                {line.replace(/^##\s*/, '')}
              </h3>
            );
          }
          if (line.startsWith('#')) {
            return (
              <h2 key={i} className="text-xl font-bold text-slate-900 mt-4">
                {line.replace(/^#\s*/, '')}
              </h2>
            );
          }
          if (line.startsWith('- ')) {
            return (
              <li key={i} className="text-slate-700 ml-4 list-disc">
                {line.replace(/^-\s*/, '')}
              </li>
            );
          }
          return line ? (
            <p key={i} className="text-slate-700 leading-relaxed">
              {line}
            </p>
          ) : (
            <br key={i} />
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Thinking Process - 解题思路 */}
      {analysis.thinking_process && (
        <div className="border-l-4 border-cta-500 pl-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-cta-50 flex items-center justify-center">
              <LightBulbIcon className="w-5 h-5 text-cta-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">解题思路</h3>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            {renderMarkdown(analysis.thinking_process)}
          </div>
        </div>
      )}

      {/* Solution Steps - 解题步骤 */}
      {analysis.solution_steps && analysis.solution_steps.length > 0 && (
        <div className="border-l-4 border-primary-500 pl-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <ListBulletIcon className="w-5 h-5 text-primary-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">解题步骤</h3>
          </div>
          <div className="space-y-4">
            {analysis.solution_steps.map((step, index) => (
              <div
                key={index}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary-300 transition-colors"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm">
                    {step.stepNumber}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 mb-2">
                      {step.title}
                    </h4>
                    <p className="text-slate-700 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>

                {step.formula && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <code className="text-sm font-mono text-slate-800">
                      {step.formula}
                    </code>
                  </div>
                )}

                {step.reasoning && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <span className="font-semibold text-blue-900">推理：</span>
                    <span className="text-blue-800 ml-2">{step.reasoning}</span>
                  </div>
                )}

                {step.commonErrors && step.commonErrors.length > 0 && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="font-semibold text-red-900 mb-2">
                      常见错误：
                    </div>
                    <ul className="space-y-1">
                      {step.commonErrors.map((error, i) => (
                        <li
                          key={i}
                          className="text-red-800 text-sm ml-4 list-disc"
                        >
                          {error}
                        </li>
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
        <div className="border-l-4 border-orange-500 pl-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">常见错误</h3>
          </div>
          <div className="space-y-3">
            {analysis.common_mistakes.map((mistake, index) => (
              <div
                key={index}
                className="bg-orange-50 rounded-xl border border-orange-200 p-4"
              >
                <div className="flex items-start gap-3 mb-2">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                      mistake.frequency === 'high'
                        ? 'bg-red-100 text-red-700'
                        : mistake.frequency === 'medium'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {mistake.frequency === 'high' && '高频'}
                    {mistake.frequency === 'medium' && '中频'}
                    {mistake.frequency === 'low' && '低频'}
                  </span>
                </div>
                <p className="text-orange-900 mb-3">{mistake.description}</p>

                {mistake.remediation && (
                  <div className="bg-white rounded-lg p-3 mb-2">
                    <span className="font-semibold text-green-900">
                      补救措施：
                    </span>
                    <span className="text-green-800 ml-2">
                      {mistake.remediation}
                    </span>
                  </div>
                )}

                {mistake.knowledgeGaps && mistake.knowledgeGaps.length > 0 && (
                  <div className="bg-white rounded-lg p-3">
                    <span className="font-semibold text-slate-900">
                      知识缺口：
                    </span>
                    <span className="text-slate-700 ml-2">
                      {mistake.knowledgeGaps.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Knowledge Gap Analysis - 知识缺口分析 */}
      {analysis.knowledge_gap_analysis && (
        <div className="border-l-4 border-secondary-500 pl-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-secondary-50 flex items-center justify-center">
              <ChartBarIcon className="w-5 h-5 text-secondary-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">知识缺口分析</h3>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            {renderMarkdown(analysis.knowledge_gap_analysis)}
          </div>
        </div>
      )}

      {/* Difficulty & Time Estimate */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        {analysis.difficulty_rationale && (
          <div className="flex items-start gap-3">
            <ChartBarIcon className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">难度说明：</span>
              <span className="text-slate-700 ml-2">
                {analysis.difficulty_rationale}
              </span>
            </div>
          </div>
        )}

        {analysis.time_estimate && (
          <div className="flex items-start gap-3">
            <ClockIcon className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">预计用时：</span>
              <span className="text-slate-700 ml-2">{analysis.time_estimate}</span>
            </div>
          </div>
        )}

        {analysis.analyzed_at && (
          <div className="flex items-start gap-3">
            <CalendarIcon className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-900">分析时间：</span>
              <span className="text-slate-700 ml-2">
                {new Date(analysis.analyzed_at).toLocaleString('zh-CN')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
