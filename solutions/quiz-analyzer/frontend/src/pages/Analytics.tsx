import { ChartBarIcon, AcademicCapIcon, BoltIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

export default function Analytics() {
  // Placeholder data
  const stats = {
    totalQuizzes: 156,
    analyzedQuizzes: 89,
    totalKnowledgePoints: 342,
    batchJobs: 12,
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-gradient mb-2">数据分析</h1>
            <p className="text-slate-600">题目分析统计与可视化</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-secondary-50 flex items-center justify-center">
            <ChartBarIcon className="w-6 h-6 text-secondary-600" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bento-card animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
              <AcademicCapIcon className="w-6 h-6 text-primary-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {stats.totalQuizzes}
          </div>
          <div className="text-sm text-slate-600">总题目数</div>
        </div>

        <div className="bento-card animate-slide-up" style={{ animationDelay: '50ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {stats.analyzedQuizzes}
          </div>
          <div className="text-sm text-slate-600">已分析</div>
        </div>

        <div className="bento-card animate-slide-up" style={{ animationDelay: '100ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-secondary-50 flex items-center justify-center">
              <AcademicCapIcon className="w-6 h-6 text-secondary-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {stats.totalKnowledgePoints}
          </div>
          <div className="text-sm text-slate-600">知识点数</div>
        </div>

        <div className="bento-card animate-slide-up" style={{ animationDelay: '150ms' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-cta-50 flex items-center justify-center">
              <BoltIcon className="w-6 h-6 text-cta-600" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            {stats.batchJobs}
          </div>
          <div className="text-sm text-slate-600">批次任务</div>
        </div>
      </div>

      {/* Coming Soon */}
      <div className="bento-card text-center py-20 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center mx-auto mb-6">
          <ChartBarIcon className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">数据可视化</h2>
        <p className="text-slate-600 mb-6 max-w-md mx-auto">
          更多图表和分析功能即将推出，包括难度分布、知识点覆盖率、题型统计等
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary-500" />
            <span>难度分布图</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-secondary-500" />
            <span>知识点覆盖</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cta-500" />
            <span>题型统计</span>
          </div>
        </div>
      </div>
    </div>
  );
}
