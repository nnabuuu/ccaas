import Card from './ui/Card';
import { formatDuration } from '../utils/formatters';
import { scoreColor } from '../utils/colors';

interface CompletionSummaryProps {
  finalScore: number | undefined;
  totalIterations: number;
  maxIterations: number;
  exitReason: string | undefined;
  startedAt: string | undefined;
  completedAt: string | undefined;
  status?: 'completed' | 'failed';
}

export default function CompletionSummary({
  finalScore,
  totalIterations,
  maxIterations,
  exitReason,
  startedAt,
  completedAt,
  status = 'completed',
}: CompletionSummaryProps) {
  const elapsed =
    startedAt && completedAt
      ? new Date(completedAt).getTime() - new Date(startedAt).getTime()
      : null;

  const isFailed = status === 'failed';
  const borderClass = isFailed
    ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
    : 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20';
  const iconColor = isFailed
    ? 'text-red-600 dark:text-red-400'
    : 'text-green-600 dark:text-green-400';
  const titleColor = isFailed
    ? 'text-red-800 dark:text-red-200'
    : 'text-green-800 dark:text-green-200';

  return (
    <Card className={`animate-slide-up ${borderClass}`}>
      <div className="flex items-center gap-2 mb-4">
        {isFailed ? (
          <svg className={`h-5 w-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        ) : (
          <svg className={`h-5 w-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <h3 className={`text-lg font-semibold ${titleColor}`}>
          {isFailed ? 'Analysis Failed' : 'Analysis Complete'}
        </h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Final Score
          </p>
          <p className={`mt-1 text-2xl font-bold ${finalScore != null ? scoreColor(finalScore) : 'text-slate-400'}`}>
            {finalScore != null ? finalScore.toFixed(1) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Iterations
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalIterations}
            <span className="text-sm font-normal text-slate-400">/{maxIterations}</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Duration
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {elapsed != null ? formatDuration(elapsed) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Exit Reason
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-300">
            {exitReason ?? '—'}
          </p>
        </div>
      </div>
    </Card>
  );
}
