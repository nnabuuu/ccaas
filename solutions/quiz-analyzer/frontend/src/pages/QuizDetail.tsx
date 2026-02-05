import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { quizzesApi, analysesApi } from '../api/client';
import { useQuizSession } from '../hooks/useQuizSession';
import type { Quiz, QuizAnalysis } from '../types';
import AnalysisView from '../components/AnalysisView';
import './QuizDetail.css';

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

  if (loading) {
    return <div className="quiz-detail-page loading">加载中...</div>;
  }

  if (error || !quiz) {
    return (
      <div className="quiz-detail-page error">
        <p>{error || '题目不存在'}</p>
        <Link to="/quizzes">返回列表</Link>
      </div>
    );
  }

  return (
    <div className="quiz-detail-page">
      <div className="detail-header">
        <Link to="/quizzes" className="back-link">
          ← 返回列表
        </Link>
        <div className="status-indicators">
          <span className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 已连接' : '🔴 未连接'}
          </span>
          {isAnalyzing && <span className="status-badge analyzing">⏳ 分析中...</span>}
        </div>
      </div>

      <div className="detail-content">
        <div className="quiz-section">
          <div className="section-header">
            <h2>题目内容</h2>
            <div className="quiz-meta">
              {quiz.quiz_type && (
                <span className="meta-badge type">{quiz.quiz_type}</span>
              )}
              {quiz.grade_level && (
                <span className="meta-badge grade">{quiz.grade_level}年级</span>
              )}
              {quiz.difficulty && (
                <span className="meta-badge difficulty">
                  难度: {quiz.difficulty}/5
                </span>
              )}
            </div>
          </div>

          <div className="quiz-content-box">
            <p className="quiz-text">{quiz.content}</p>
          </div>

          {quiz.correct_answer && (
            <div className="answer-box">
              <h3>正确答案</h3>
              <p>{quiz.correct_answer}</p>
            </div>
          )}

          {quiz.knowledge_points && quiz.knowledge_points.length > 0 && (
            <div className="knowledge-points-box">
              <h3>相关知识点</h3>
              <div className="kp-list">
                {quiz.knowledge_points.map((kp) => (
                  <span key={kp.id} className="kp-tag">
                    {kp.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="analysis-section">
          <div className="section-header">
            <h2>AI 分析</h2>
            {!hasAnalysis && (
              <button
                onClick={handleStartAnalysis}
                disabled={!isConnected || isAnalyzing}
                className="analyze-btn"
              >
                {isAnalyzing ? '分析中...' : '开始分析'}
              </button>
            )}
          </div>

          {hasAnalysis ? (
            <AnalysisView analysis={displayAnalysis} />
          ) : (
            <div className="no-analysis">
              <p>暂无分析结果</p>
              <p className="hint">点击"开始分析"按钮，让 AI 为您分析这道题目</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
