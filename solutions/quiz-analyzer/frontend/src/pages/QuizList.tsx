import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { quizzesApi } from '../api/client';
import type { Quiz, SearchQuizzesParams } from '../types';
import './QuizList.css';

export default function QuizList() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useState<SearchQuizzesParams>({
    limit: 20,
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
      offset: (searchParams.offset || 0) + (searchParams.limit || 20),
    });
  };

  const handlePrevPage = () => {
    setSearchParams({
      ...searchParams,
      offset: Math.max(0, (searchParams.offset || 0) - (searchParams.limit || 20)),
    });
  };

  const getDifficultyLabel = (difficulty?: number) => {
    const labels = ['未知', '简单', '较易', '中等', '较难', '困难'];
    return labels[difficulty || 0];
  };

  const getDifficultyColor = (difficulty?: number) => {
    const colors = ['gray', 'green', 'lightgreen', 'orange', 'darkorange', 'red'];
    return colors[difficulty || 0];
  };

  return (
    <div className="quiz-list-page">
      <div className="page-header">
        <h1>题目列表</h1>
        <div className="stats">
          <span>共 {pagination.total} 道题目</span>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="搜索题目内容..."
          onChange={(e) => handleSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <>
          <div className="quiz-grid">
            {quizzes.map((quiz) => (
              <Link
                key={quiz.id}
                to={`/quizzes/${quiz.id}`}
                className="quiz-card"
              >
                <div className="quiz-header">
                  <span className="quiz-type">{quiz.quiz_type || '未分类'}</span>
                  {quiz.difficulty && (
                    <span
                      className="difficulty-badge"
                      style={{
                        backgroundColor: getDifficultyColor(quiz.difficulty),
                      }}
                    >
                      {getDifficultyLabel(quiz.difficulty)}
                    </span>
                  )}
                </div>

                <div className="quiz-content">
                  {quiz.content.length > 120
                    ? quiz.content.substring(0, 120) + '...'
                    : quiz.content}
                </div>

                <div className="quiz-footer">
                  {quiz.subject && (
                    <span className="subject-tag">{quiz.subject.name}</span>
                  )}
                  {quiz.grade_level && (
                    <span className="grade-tag">{quiz.grade_level}年级</span>
                  )}
                  {quiz.knowledge_points && quiz.knowledge_points.length > 0 && (
                    <span className="kp-count">
                      {quiz.knowledge_points.length} 个知识点
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {quizzes.length === 0 && (
            <div className="empty-state">
              <p>没有找到题目</p>
            </div>
          )}

          <div className="pagination">
            <button
              onClick={handlePrevPage}
              disabled={!searchParams.offset}
              className="pagination-btn"
            >
              上一页
            </button>
            <span className="pagination-info">
              第 {Math.floor((searchParams.offset || 0) / (searchParams.limit || 20)) + 1} 页
            </span>
            <button
              onClick={handleNextPage}
              disabled={!pagination.hasMore}
              className="pagination-btn"
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  );
}
