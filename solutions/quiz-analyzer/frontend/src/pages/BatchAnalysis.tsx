import { useState, useEffect } from 'react';
import { batchApi, quizzesApi } from '../api/client';
import type { BatchJob, Quiz } from '../types';
import './BatchAnalysis.css';

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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#ffc107',
      running: '#2196f3',
      completed: '#4caf50',
      failed: '#f44336',
      cancelled: '#9e9e9e',
    };
    return colors[status] || '#9e9e9e';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待处理',
      running: '处理中',
      completed: '已完成',
      failed: '失败',
      cancelled: '已取消',
    };
    return labels[status] || status;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="batch-analysis-page">
      <h1>批量分析</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="batch-content">
        {/* Create New Job Section */}
        <div className="create-job-section">
          <h2>创建新批次</h2>

          <div className="form-group">
            <label>批次名称</label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="例如：数学9年级题库分析"
              className="batch-name-input"
            />
          </div>

          <div className="form-group">
            <label>
              选择题目 ({selectedQuizzes.length} / {availableQuizzes.length})
            </label>
            <div className="quiz-selector">
              {availableQuizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className={`quiz-select-item ${
                    selectedQuizzes.includes(quiz.id) ? 'selected' : ''
                  }`}
                  onClick={() => toggleQuizSelection(quiz.id)}
                >
                  <input
                    type="checkbox"
                    checked={selectedQuizzes.includes(quiz.id)}
                    onChange={() => {}}
                  />
                  <span className="quiz-content">
                    {quiz.content.substring(0, 60)}
                    {quiz.content.length > 60 && '...'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreateJob}
            disabled={loading || !batchName.trim() || selectedQuizzes.length === 0}
            className="create-job-btn"
          >
            {loading ? '创建中...' : '创建批次'}
          </button>
        </div>

        {/* Job List Section */}
        <div className="job-list-section">
          <h2>批次列表</h2>

          {jobs.length === 0 ? (
            <div className="empty-state">暂无批次</div>
          ) : (
            <div className="job-list">
              {jobs.map((job) => (
                <div key={job.id} className="job-card">
                  <div className="job-header">
                    <h3>{job.name}</h3>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(job.status) }}
                    >
                      {getStatusLabel(job.status)}
                    </span>
                  </div>

                  <div className="job-stats">
                    <div className="stat">
                      <span className="stat-label">总数</span>
                      <span className="stat-value">{job.total_count}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">已完成</span>
                      <span className="stat-value completed">
                        {job.completed_count}
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">失败</span>
                      <span className="stat-value failed">{job.failed_count}</span>
                    </div>
                  </div>

                  {job.status === 'running' && (
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${(job.completed_count / job.total_count) * 100}%`,
                        }}
                      />
                    </div>
                  )}

                  <div className="job-meta">
                    <div className="meta-row">
                      <span>创建时间：</span>
                      <span>{formatDate(job.created_at)}</span>
                    </div>
                    {job.started_at && (
                      <div className="meta-row">
                        <span>开始时间：</span>
                        <span>{formatDate(job.started_at)}</span>
                      </div>
                    )}
                    {job.completed_at && (
                      <div className="meta-row">
                        <span>完成时间：</span>
                        <span>{formatDate(job.completed_at)}</span>
                      </div>
                    )}
                    {job.estimated_completion && job.status === 'running' && (
                      <div className="meta-row">
                        <span>预计完成：</span>
                        <span>{formatDate(job.estimated_completion)}</span>
                      </div>
                    )}
                  </div>

                  {job.status === 'running' && (
                    <button
                      onClick={() => handleCancelJob(job.id)}
                      className="cancel-btn"
                    >
                      取消批次
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
