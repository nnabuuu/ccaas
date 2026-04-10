import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listArticles, type ArticleResponse } from '../api';
import { formatScore } from '../utils/formatters';

/** Backend may include latestScore beyond the base interface */
type ArticleWithScore = ArticleResponse & { latestScore?: number | null };
import ArticleForm from '../components/ArticleForm';
import { useFetch } from '../hooks/useFetch';
import StatusBadge from '../components/ui/StatusBadge';
import Card from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import SectionHeader from '../components/ui/SectionHeader';
import FilterChips from '../components/ui/FilterChips';
import { formatDate } from '../utils/formatters';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Running', value: 'running' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
];

export default function ArticleListPage() {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetcher = useCallback(
    () => listArticles(statusFilter || undefined),
    [statusFilter],
  );
  const { data: articles, loading, error, refetch } = useFetch<ArticleWithScore[]>(
    fetcher,
    [statusFilter],
  );

  const handleCreated = () => {
    setShowForm(false);
    refetch();
  };

  return (
    <div className="animate-fade-in">
      <SectionHeader
        title="Articles"
        description="Manage and analyze your articles"
        action={
          <button
            className="rounded-md bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors dark:bg-primary-500 dark:hover:bg-primary-600"
            onClick={() => setShowForm(true)}
          >
            New Article
          </button>
        }
      />

      <div className="mt-4 mb-4">
        <FilterChips
          options={STATUS_OPTIONS}
          selected={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {showForm && (
        <Card className="mb-6 animate-slide-up">
          <ArticleForm
            onCreated={handleCreated}
            onCancel={() => setShowForm(false)}
          />
        </Card>
      )}

      {loading && <Skeleton variant="card" lines={4} />}

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!loading && !error && articles && articles.length === 0 && (
        <EmptyState
          icon="📝"
          title="No articles yet"
          description="Create your first article to start analyzing and improving content with AI."
          actionLabel="Create Article"
          onAction={() => setShowForm(true)}
        />
      )}

      {!loading && !error && articles && articles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <Link
              key={article.id}
              to={`/articles/${article.id}`}
              className="block"
            >
              <Card className="h-full hover:shadow-md transition-all hover:border-slate-300 dark:hover:border-slate-600">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    {article.latestScore != null && (
                      <span className={`text-sm font-bold ${
                        article.latestScore >= 80 ? 'text-green-600 dark:text-green-400' :
                        article.latestScore >= 60 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {formatScore(article.latestScore)}
                      </span>
                    )}
                    <StatusBadge status={article.status} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {article.inputType === 'topic' ? 'Topic' : 'Draft'}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {formatDate(article.createdAt)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
