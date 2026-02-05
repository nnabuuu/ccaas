import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  AcademicCapIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { quizzesApi } from '../api/client';
import type { Quiz, SearchQuizzesParams } from '../types';
import KnowledgePointBadge from '../components/KnowledgePointBadge';

export default function QuizList() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useState<SearchQuizzesParams>({
    limit: 12,
    offset: 0,
  });

  const [pagination, setPagination] = useState({
    total: 0,
    hasMore: false,
  });

  useEffect(() => {
    loadQuizzes();
  }, [searchParams]);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await quizzesApi.search(searchParams);

      setQuizzes(data.quizzes);
      setPagination({
        total: data.pagination.total,
        hasMore: data.pagination.hasMore,
      });
    } catch (err: any) {
      console.error('Failed to load quizzes:', err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchParams({
      ...searchParams,
      query,
      offset: 0,
    });
  };

  const handleNextPage = () => {
    setSearchParams({
      ...searchParams,
      offset: (searchParams.offset || 0) + (searchParams.limit || 12),
    });
  };

  const handlePrevPage = () => {
    setSearchParams({
      ...searchParams,
      offset: Math.max(0, (searchParams.offset || 0) - (searchParams.limit || 12)),
    });
  };

  const getDifficultyConfig = (difficulty?: number) => {
    const configs = [
      { label: '未知', color: 'bg-slate-100 text-slate-600', icon: '?' },
      { label: '简单', color: 'bg-green-100 text-green-700', icon: '★' },
      { label: '较易', color: 'bg-green-100 text-green-600', icon: '★★' },
      { label: '中等', color: 'bg-cta-100 text-cta-700', icon: '★★★' },
      { label: '较难', color: 'bg-orange-100 text-orange-700', icon: '★★★★' },
      { label: '困难', color: 'bg-red-100 text-red-700', icon: '★★★★★' },
    ];
    return configs[difficulty || 0];
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">题目列表</h1>
            <p className="text-slate-600">共 {pagination.total} 道题目</p>
          </div>
          <button className="btn-cta flex items-center gap-2">
            <FunnelIcon className="w-5 h-5" />
            <span>筛选</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索题目内容..."
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all shadow-soft"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner w-8 h-8" />
          <span className="ml-3 text-slate-600">加载中...</span>
        </div>
      ) : (
        <>
          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {quizzes.map((quiz, index) => {
              const difficulty = getDifficultyConfig(quiz.difficulty);
              return (
                <Link
                  key={quiz.id}
                  to={`/quizzes/${quiz.id}`}
                  className="bento-card group animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                        <AcademicCapIcon className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-600">
                          {quiz.quiz_type || '未分类'}
                        </span>
                        {quiz.grade_level && (
                          <div className="text-xs text-slate-400">
                            {quiz.grade_level}年级
                          </div>
                        )}
                      </div>
                    </div>
                    {quiz.difficulty && (
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-medium ${difficulty.color}`}
                      >
                        {difficulty.label}
                      </span>
                    )}
                  </div>

                  {/* Quiz Content */}
                  <div className="mb-4">
                    <p className="text-slate-700 line-clamp-3 text-sm leading-relaxed">
                      {quiz.content}
                    </p>
                  </div>

                  {/* Knowledge Points */}
                  {quiz.knowledge_points && quiz.knowledge_points.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {quiz.knowledge_points.slice(0, 3).map((kp: any, i: number) => (
                        <KnowledgePointBadge
                          key={i}
                          name={kp.name}
                          source={kp.source || 'question'}
                        />
                      ))}
                      {quiz.knowledge_points.length > 3 && (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs text-slate-500 bg-slate-100">
                          +{quiz.knowledge_points.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Card Footer */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100">
                    {quiz.subject && <span>{quiz.subject.name}</span>}
                    <span className="text-primary-600 group-hover:text-primary-700 font-medium">
                      查看详情 →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Empty State */}
          {quizzes.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <MagnifyingGlassIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">没有找到题目</h3>
              <p className="text-slate-500">尝试调整搜索条件</p>
            </div>
          )}

          {/* Pagination */}
          {quizzes.length > 0 && (
            <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow-soft">
              <button
                onClick={handlePrevPage}
                disabled={!searchParams.offset}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                <span>上一页</span>
              </button>

              <span className="text-sm text-slate-600">
                第 {Math.floor((searchParams.offset || 0) / (searchParams.limit || 12)) + 1} 页
              </span>

              <button
                onClick={handleNextPage}
                disabled={!pagination.hasMore}
                className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>下一页</span>
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
