import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getArticle,
  listRuns,
  startRun,
  type ArticleResponse,
  type RunResponse,
} from '../api';
import { useFetch } from '../hooks/useFetch';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';

import Skeleton from '../components/ui/Skeleton';
import ErrorState from '../components/ui/ErrorState';
import EmptyState from '../components/ui/EmptyState';
import SectionHeader from '../components/ui/SectionHeader';

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const articleFetcher = useCallback(() => getArticle(id!), [id]);
  const runsFetcher = useCallback(() => listRuns(id!), [id]);

  const {
    data: article,
    loading: articleLoading,
    error: articleError,
    refetch: refetchArticle,
  } = useFetch<ArticleResponse>(articleFetcher, [id]);

  const {
    data: runs,
    loading: runsLoading,
    error: runsError,
    refetch: refetchRuns,
  } = useFetch<RunResponse[]>(runsFetcher, [id]);

  const handleStartRun = async () => {
    if (!id) return;
    setStarting(true);
    setStartError(null);
    try {
      const run = await startRun(id);
      navigate(`/runs/${run.id}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : 'Failed to start run');
      setStarting(false);
    }
  };

  if (articleLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton variant="line" lines={1} />
        <Skeleton variant="card" lines={1} />
      </div>
    );
  }

  if (articleError) {
    return <ErrorState message={articleError} onRetry={refetchArticle} />;
  }

  if (!article) return null;

  return (
    <div className="animate-fade-in">
      <Card className="mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {article.title}
            </h2>
            <StatusBadge status={article.status} />
          </div>
          <button
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors dark:bg-primary-500 dark:hover:bg-primary-600"
            onClick={handleStartRun}
            disabled={starting || article.status === 'running'}
          >
            {starting ? 'Starting...' : 'Start Analysis'}
          </button>
        </div>
        {startError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{startError}</p>
        )}
        <div className="mt-4 grid gap-3">
          <div className="text-sm">
            <span className="font-medium text-slate-500 dark:text-slate-400">Type:</span>{' '}
            <span className="text-slate-900 dark:text-slate-100">
              {article.inputType === 'topic' ? 'Topic' : 'Draft'}
            </span>
          </div>
          <div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Input:
            </span>
            <p className="mt-1.5 rounded-lg bg-slate-50 p-3 text-sm text-slate-800 whitespace-pre-wrap dark:bg-slate-900 dark:text-slate-200">
              {article.initialInput}
            </p>
          </div>
        </div>
      </Card>

      <div className="mt-8">
        <SectionHeader title="Run History" />

        {runsLoading && <Skeleton variant="card" lines={2} />}

        {runsError && <ErrorState message={runsError} onRetry={refetchRuns} />}

        {!runsLoading && !runsError && runs && runs.length === 0 && (
          <EmptyState
            icon="🚀"
            title="No runs yet"
            description="Start an analysis to see how AI iteratively improves your article."
            actionLabel="Start Analysis"
            onAction={handleStartRun}
          />
        )}

        {!runsLoading && !runsError && runs && runs.length > 0 && (
          <Card padding="sm" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Run ID
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Score
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Iterations
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Started
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors dark:border-slate-700 dark:hover:bg-slate-700/50"
                      onClick={() => navigate(`/runs/${run.id}`)}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {run.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        {run.finalScore != null
                          ? run.finalScore.toFixed(1)
                          : '-'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                        {run.totalIterations}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
