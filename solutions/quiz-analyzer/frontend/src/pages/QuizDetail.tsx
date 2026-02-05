import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ChevronLeftIcon,
  BoltIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { quizzesApi, analysesApi } from '../api/client';
import { useQuizSession } from '../hooks/useQuizSession';
import type { Quiz, QuizAnalysis } from '../types';
import AnalysisView from '../components/AnalysisView';
import KnowledgePointBadge from '../components/KnowledgePointBadge';

export default function QuizDetail() {
  const { id } = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [savedAnalysis, setSavedAnalysis] = useState<QuizAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the custom hook for real-time AI analysis
  const {
    analysis: liveAnalysis,
    isConnected,
    isAnalyzing,
    startAnalysis,
  } = useQuizSession({
    quizId: id!,
    autoConnect: true,
  });

  useEffect(() => {
    loadQuizAndAnalysis();
  }, [id]);

  const loadQuizAndAnalysis = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      // Load quiz details
      const quizData = await quizzesApi.get(id);
      setQuiz(quizData);

      // Try to load existing analysis
      try {
        const analysisData = await analysesApi.get(id);
        setSavedAnalysis(analysisData);
      } catch (analysisError: any) {
        // Analysis doesn't exist yet - that's okay
        if (analysisError.response?.status !== 404) {
          console.error('Failed to load analysis:', analysisError);
        }
      }
    } catch (err: any) {
      console.error('Failed to load quiz:', err);
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAnalysis = () => {
    startAnalysis();
  };

  // Merge live analysis with saved analysis
  const displayAnalysis = {
    ...savedAnalysis,
    ...liveAnalysis,
  } as QuizAnalysis;

  const hasAnalysis = savedAnalysis || Object.keys(liveAnalysis).length > 0;

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

  const difficulty = getDifficultyConfig(quiz?.difficulty);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner w-8 h-8" />
        <span className="ml-3 text-slate-600">加载中...</span>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 animate-fade-in">
        <div className="bento-card">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <XCircleIcon className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            {error || '题目不存在'}
          </h3>
          <Link to="/quizzes" className="btn-primary inline-flex items-center gap-2 mt-4">
            <ChevronLeftIcon className="w-4 h-4" />
            <span>返回列表</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <Link
          to="/quizzes"
          className="btn-secondary flex items-center gap-2"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span>返回列表</span>
        </Link>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
              <CheckCircleIcon className="w-4 h-4" />
              <span>已连接</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-sm font-medium">
              <XCircleIcon className="w-4 h-4" />
              <span>未连接</span>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cta-50 text-cta-700 rounded-lg text-sm font-medium">
              <ClockIcon className="w-4 h-4 animate-spin" />
              <span>分析中...</span>
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Quiz Content */}
        <div className="space-y-6">
          {/* Quiz Header Card */}
          <div className="bento-card animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gradient">题目内容</h2>
              <div className="flex items-center gap-2">
                {quiz.quiz_type && (
                  <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
                    {quiz.quiz_type}
                  </span>
                )}
                {quiz.grade_level && (
                  <span className="px-3 py-1 bg-secondary-50 text-secondary-700 rounded-lg text-sm font-medium">
                    {quiz.grade_level}年级
                  </span>
                )}
              </div>
            </div>

            {/* Difficulty Badge */}
            {quiz.difficulty && (
              <div className="mb-4">
                <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${difficulty.color}`}>
                  {difficulty.label}
                </span>
              </div>
            )}

            {/* Quiz Content */}
            <div className="mb-6">
              <p className="text-slate-700 leading-relaxed text-lg whitespace-pre-wrap">
                {quiz.content}
              </p>
            </div>

            {/* Correct Answer */}
            {quiz.correct_answer && (
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  正确答案
                </h3>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-green-900 font-medium">
                    {quiz.correct_answer}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Knowledge Points Card */}
          {quiz.knowledge_points && quiz.knowledge_points.length > 0 && (
            <div className="bento-card animate-slide-up" style={{ animationDelay: '100ms' }}>
              <h3 className="text-lg font-bold text-slate-900 mb-4">
                相关知识点
              </h3>
              <div className="flex flex-wrap gap-2">
                {quiz.knowledge_points.map((kp: any) => (
                  <KnowledgePointBadge
                    key={kp.id}
                    name={kp.name}
                    source={kp.source || 'question'}
                    confidence={kp.confidence_score}
                    note={kp.note}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Analysis */}
        <div className="space-y-6">
          <div className="bento-card animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gradient">AI 分析</h2>
              {!hasAnalysis && (
                <button
                  onClick={handleStartAnalysis}
                  disabled={!isConnected || isAnalyzing}
                  className="btn-cta flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BoltIcon className="w-5 h-5" />
                  <span>{isAnalyzing ? '分析中...' : '开始分析'}</span>
                </button>
              )}
            </div>

            {hasAnalysis ? (
              <AnalysisView analysis={displayAnalysis} />
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <BoltIcon className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  暂无分析结果
                </h3>
                <p className="text-slate-500 text-sm">
                  点击"开始分析"按钮，让 AI 为您分析这道题目
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
