import {
  LightBulbIcon,
  ListBulletIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CalendarIcon,
  TagIcon,
  LinkIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import type { QuizAnalysis, Quiz } from '../types';

interface CompleteAnalysisViewProps {
  analysis: QuizAnalysis;
  quiz: Quiz;
}

export default function CompleteAnalysisView({ analysis, quiz }: CompleteAnalysisViewProps) {
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
      {/* 1. Overall Analysis - 整体分析 (Most Important) */}
      {analysis.quiz_analysis && (
        <div className="bento-card">
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-bold text-slate-900">整体分析</h3>
          </div>
          <div className="prose prose-slate max-w-none">
            {renderMarkdown(analysis.quiz_analysis)}
          </div>
        </div>
      )}

      {/* 2. Knowledge Point Tags - 知识点标签 */}
      {analysis.knowledge_point_tags && analysis.knowledge_point_tags.length > 0 && (
        <div className="bento-card">
          <div className="flex items-center gap-2 mb-4">
            <TagIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-bold text-slate-900">知识点标签</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {analysis.knowledge_point_tags.map((tag) => (
              <div
                key={tag.id}
                className={`px-4 py-2 rounded-xl border-2 ${
                  tag.verified
                    ? 'bg-green-50 border-green-300 text-green-800'
                    : tag.confidence > 0.8
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-slate-50 border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{tag.name}</span>
                  <span className="text-xs opacity-75">
                    {(tag.confidence * 100).toFixed(0)}%
                  </span>
                  {tag.verified && <CheckCircleIcon className="w-4 h-4" />}
                </div>
                {tag.path && tag.path.length > 0 && (
                  <div className="text-xs mt-1 opacity-60">
                    {tag.path.join(' > ')}
                  </div>
                )}
                {tag.source && (
                  <div className="text-xs mt-1 opacity-60">
                    来源: {tag.source === 'question' ? '题干' : tag.source === 'solution' ? '解答' : '题干+解答'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Thinking Process - 解题思路 */}
      {analysis.thinking_process && (
        <div className="bento-card">
          <div className="flex items-center gap-2 mb-4">
            <LightBulbIcon className="w-5 h-5 text-cta-600" />
            <h3 className="text-lg font-bold text-slate-900">解题思路</h3>
          </div>
          <div className="bg-slate-50 rounded-xl p-4">
            {renderMarkdown(analysis.thinking_process)}
          </div>
        </div>
      )}

      {/* 4. Solution Steps - 解题步骤 */}
      {analysis.solution_steps && analysis.solution_steps.length > 0 && (
        <div className="bento-card">
          <div className="flex items-center gap-2 mb-4">
            <ListBulletIcon className="w-5 h-5 text-primary-600" />
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

      {/* Two Column Layout for Mistakes & Knowledge Gap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5. Common Mistakes - 常见错误 */}
        {analysis.common_mistakes && analysis.common_mistakes.length > 0 && (
          <div className="bento-card">
            <div className="flex items-center gap-2 mb-4">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-600" />
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

        {/* 6. Knowledge Gap Analysis - 知识缺口分析 */}
        {analysis.knowledge_gap_analysis && (
          <div className="bento-card">
            <div className="flex items-center gap-2 mb-4">
              <ChartBarIcon className="w-5 h-5 text-secondary-600" />
              <h3 className="text-lg font-bold text-slate-900">知识缺口分析</h3>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              {renderMarkdown(analysis.knowledge_gap_analysis)}
            </div>
          </div>
        )}
      </div>

      {/* Time Estimate removed - use difficulty_analysis.timeEstimate instead */}

      {/* 10. Related Quizzes - 相关题目推荐 (Only show if there are actual different quizzes) */}
      {analysis.related_quizzes &&
       analysis.related_quizzes.length > 0 &&
       analysis.related_quizzes.filter(r => r.id !== quiz.id).length > 0 && (
        <div className="bento-card">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-bold text-slate-900">相关题目推荐</h3>
          </div>
          <div className="space-y-3">
            {analysis.related_quizzes
              .filter(related => related.id !== quiz.id) // Filter out current quiz
              .map((related) => (
                <Link
                  key={related.id}
                  to={`/quizzes/${related.id}`}
                  className="block p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-slate-900 flex-1">
                      {related.content.length > 80
                        ? related.content.substring(0, 80) + '...'
                        : related.content}
                    </span>
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-lg text-xs font-medium ml-3 flex-shrink-0">
                      {(related.similarity * 100).toFixed(0)}% 相似
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2">
                    {related.similarityReason}
                  </p>
                  {related.matchedKnowledgePoints && related.matchedKnowledgePoints.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {related.matchedKnowledgePoints.map((kp, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-xs"
                        >
                          {kp}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Analysis Metadata */}
      {analysis.analyzed_at && (
        <div className="bento-card bg-slate-50">
          <div className="flex items-center gap-3 text-sm">
            <CalendarIcon className="w-4 h-4 text-slate-500" />
            <div>
              <span className="font-medium text-slate-700">分析时间：</span>
              <span className="text-slate-600 ml-2">
                {new Date(analysis.analyzed_at).toLocaleString('zh-CN')}
              </span>
            </div>
            {analysis.analyzer_version && (
              <div className="ml-4">
                <span className="font-medium text-slate-700">版本：</span>
                <span className="text-slate-600 ml-2">
                  {analysis.analyzer_version}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
