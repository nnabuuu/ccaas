import { useState, useEffect } from 'react';
import {
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { batchApi, quizzesApi } from '../api/client';
import type { BatchJob, Quiz } from '../types';

export default function BatchAnalysis() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [selectedQuizzes, setSelectedQuizzes] = useState<string[]>([]);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [batchName, setBatchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
    loadAvailableQuizzes();

    // Poll for job updates every 2 seconds
    const interval = setInterval(loadJobs, 2000);
    return () => clearInterval(interval);
  }, []);

  const loadJobs = async () => {
    try {
      const data = await batchApi.listJobs(20, 0);
      setJobs(data.jobs);
    } catch (err: any) {
      console.error('Failed to load jobs:', err);
    }
  };

  const loadAvailableQuizzes = async () => {
    try {
      const data = await quizzesApi.list(100, 0);
      setAvailableQuizzes(data.quizzes);
    } catch (err: any) {
      console.error('Failed to load quizzes:', err);
    }
  };

  const handleCreateJob = async () => {
    if (!batchName.trim()) {
      setError('请输入批次名称');
      return;
    }

    if (selectedQuizzes.length === 0) {
      setError('请选择至少一道题目');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await batchApi.create(batchName, selectedQuizzes);

      // Reset form
      setBatchName('');
      setSelectedQuizzes([]);

      // Reload jobs
      await loadJobs();
    } catch (err: any) {
      console.error('Failed to create job:', err);
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    if (!confirm('确定要取消这个批次吗？')) return;

    try {
      await batchApi.cancelJob(jobId);
      await loadJobs();
    } catch (err: any) {
      console.error('Failed to cancel job:', err);
      alert('取消失败: ' + err.message);
    }
  };

  const toggleQuizSelection = (quizId: string) => {
    setSelectedQuizzes((prev) =>
      prev.includes(quizId)
        ? prev.filter((id) => id !== quizId)
        : [...prev, quizId],
    );
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { color: string; icon: any; label: string }> = {
      pending: { color: 'bg-yellow-100 text-yellow-700', icon: ClockIcon, label: '待处理' },
      running: { color: 'bg-blue-100 text-blue-700', icon: PlayIcon, label: '处理中' },
      completed: { color: 'bg-green-100 text-green-700', icon: CheckCircleIcon, label: '已完成' },
      failed: { color: 'bg-red-100 text-red-700', icon: XCircleIcon, label: '失败' },
      cancelled: { color: 'bg-slate-100 text-slate-700', icon: StopIcon, label: '已取消' },
    };
    return configs[status] || configs.cancelled;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">批量分析</h1>
            <p className="text-slate-600">批量处理多道题目的AI分析</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cta-50 flex items-center justify-center">
            <BoltIcon className="w-6 h-6 text-cta-600" />
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Create New Job Section */}
        <div className="bento-card animate-slide-up">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">创建新批次</h2>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                批次名称
              </label>
              <input
                type="text"
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="例如：数学9年级题库分析"
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                选择题目 ({selectedQuizzes.length} / {availableQuizzes.length})
              </label>
              <div className="max-h-96 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-4 bg-slate-50">
                {availableQuizzes.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    暂无可用题目
                  </div>
                ) : (
                  availableQuizzes.map((quiz) => (
                    <label
                      key={quiz.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedQuizzes.includes(quiz.id)
                          ? 'bg-primary-50 border-2 border-primary-300'
                          : 'bg-white border-2 border-transparent hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuizzes.includes(quiz.id)}
                        onChange={() => toggleQuizSelection(quiz.id)}
                        className="mt-1 w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                      />
                      <span className="flex-1 text-slate-700 text-sm leading-relaxed">
                        {quiz.content.substring(0, 100)}
                        {quiz.content.length > 100 && '...'}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={handleCreateJob}
              disabled={loading || !batchName.trim() || selectedQuizzes.length === 0}
              className="btn-cta w-full flex items-center justify-center gap-2"
            >
              <BoltIcon className="w-5 h-5" />
              <span>{loading ? '创建中...' : '创建批次'}</span>
            </button>
          </div>
        </div>

        {/* Job List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900">批次列表</h2>
            <span className="text-sm text-slate-600">{jobs.length} 个批次</span>
          </div>

          {jobs.length === 0 ? (
            <div className="bento-card text-center py-12 animate-slide-up">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <BoltIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">
                暂无批次
              </h3>
              <p className="text-slate-500 text-sm">
                创建第一个批次开始分析
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job, index) => {
                const statusConfig = getStatusConfig(job.status);
                const StatusIcon = statusConfig.icon;
                const progress = Math.round((job.completed_count / job.total_count) * 100);

                return (
                  <div
                    key={job.id}
                    className="bento-card animate-slide-up"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {/* Job Header */}
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-900">{job.name}</h3>
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${statusConfig.color}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">{statusConfig.label}</span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 bg-slate-50 rounded-xl">
                        <div className="text-2xl font-bold text-slate-900">
                          {job.total_count}
                        </div>
                        <div className="text-xs text-slate-600 mt-1">总数</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-xl">
                        <div className="text-2xl font-bold text-green-700">
                          {job.completed_count}
                        </div>
                        <div className="text-xs text-green-600 mt-1">已完成</div>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-xl">
                        <div className="text-2xl font-bold text-red-700">
                          {job.failed_count}
                        </div>
                        <div className="text-xs text-red-600 mt-1">失败</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {job.status === 'running' && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-600">进度</span>
                          <span className="text-sm font-semibold text-primary-600">
                            {progress}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-500 to-secondary-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between py-2 border-t border-slate-100">
                        <span className="text-slate-600">创建时间</span>
                        <span className="text-slate-900">{formatDate(job.created_at)}</span>
                      </div>
                      {job.started_at && (
                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                          <span className="text-slate-600">开始时间</span>
                          <span className="text-slate-900">{formatDate(job.started_at)}</span>
                        </div>
                      )}
                      {job.completed_at && (
                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                          <span className="text-slate-600">完成时间</span>
                          <span className="text-slate-900">{formatDate(job.completed_at)}</span>
                        </div>
                      )}
                      {job.estimated_completion && job.status === 'running' && (
                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                          <span className="text-slate-600">预计完成</span>
                          <span className="text-cta-700 font-medium">
                            {formatDate(job.estimated_completion)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {job.status === 'running' && (
                      <button
                        onClick={() => handleCancelJob(job.id)}
                        className="mt-4 w-full btn-secondary flex items-center justify-center gap-2"
                      >
                        <StopIcon className="w-4 h-4" />
                        <span>取消批次</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
