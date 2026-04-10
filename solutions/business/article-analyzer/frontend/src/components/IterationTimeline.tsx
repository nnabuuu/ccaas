import { useState } from 'react';
import type { IterationResponse, AnalysisReport } from '../api';
import { formatScore } from '../utils/formatters';
import { scoreColor, barColor } from '../utils/colors';

interface IterationTimelineProps {
  iterations: IterationResponse[];
}

function MiniDimensionBars({ dimensions }: { dimensions: { name: string; score: number; weight: number }[] }) {
  const maxScore = Math.max(...dimensions.map((d) => d.score), 5);

  return (
    <div className="mt-3 space-y-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
        Dimension Scores
      </h4>
      {dimensions.map((d) => (
        <div key={d.name} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 w-24 truncate" title={d.name}>
            {d.name}
          </span>
          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor(d.score)}`}
              style={{ width: `${(d.score / maxScore) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-8 text-right">
            {d.score.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function IterationTimeline({
  iterations,
}: IterationTimelineProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (iterations.length === 0) {
    return (
      <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-4">
        No iterations yet
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {iterations.map((iter) => {
        const report = iter.analysisReport as AnalysisReport | null;
        const isExpanded = expandedId === iter.id;
        const dimensions = iter.dimensionScores;

        return (
          <div
            key={iter.id}
            className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
          >
            <button
              className="w-full text-left px-4 py-3 flex items-center justify-between"
              onClick={() => setExpandedId(isExpanded ? null : iter.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  #{iter.iteration}
                </span>
                {iter.score != null && (
                  <span className={`text-sm font-bold ${scoreColor(iter.score)}`}>
                    {formatScore(iter.score)}
                  </span>
                )}
                {report?.topIssue && (
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                    {report.topIssue}
                  </span>
                )}
              </div>
              <svg
                className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 animate-slide-up">
                {dimensions && dimensions.length > 0 && (
                  <MiniDimensionBars dimensions={dimensions} />
                )}
                {report?.feedback && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Feedback
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {report.feedback}
                    </p>
                  </div>
                )}
                {iter.articleText && (
                  <div className="mt-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Article Text
                    </h4>
                    <pre className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 max-h-60 overflow-y-auto whitespace-pre-wrap">
                      {iter.articleText}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
