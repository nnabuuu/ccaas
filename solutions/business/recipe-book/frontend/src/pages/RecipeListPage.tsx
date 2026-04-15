import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes'

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export function RecipeListPage() {
  const [search, setSearch] = useState('')
  const { recipes, loading } = useRecipes(search || undefined)
  const navigate = useNavigate()

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--t1)', marginBottom: 4, letterSpacing: '-0.3px' }}>
        食谱列表
      </h1>
      <p style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 24 }}>
        管理你的所有食谱
      </p>

      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="搜索食谱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--t2)' }}>加载中...</p>
      ) : recipes.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--t2)' }}>未找到食谱</p>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="recipe-card"
              onClick={() => navigate(`/recipes/${recipe.id}`)}
            >
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>
                    {recipe.title}
                  </h3>
                  <span
                    className="status-badge"
                    style={{
                      background: recipe.status === 'published' ? 'var(--green)' : 'var(--surface2)',
                      color: recipe.status === 'published' ? 'var(--surface)' : 'var(--t2)',
                    }}
                    aria-label={`状态: ${recipe.status === 'published' ? '已发布' : '草稿'}`}
                  >
                    {recipe.status === 'published' ? '已发布' : '草稿'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span className="recipe-tag">{recipe.cuisine}</span>
                  <span className="recipe-tag-text">{DIFFICULTY_LABELS[recipe.difficulty] ?? recipe.difficulty}</span>
                </div>
                <div className="card-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="card-meta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {recipe.prep_time}+{recipe.cook_time}min
                    </span>
                    <span className="card-meta">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                      </svg>
                      {recipe.servings}人份
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .search-input {
          width: 100%;
          max-width: 360px;
          padding: 8px 14px;
          font-size: 13px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--t1);
          outline: none;
          font-family: inherit;
          transition: border-color 0.12s;
        }
        .search-input:focus {
          border-color: var(--t3);
        }

        .recipe-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
        }

        .recipe-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          cursor: pointer;
          transition: border-color 0.2s;
          display: flex;
          flex-direction: column;
        }
        .recipe-card:hover {
          border-color: var(--t3);
        }

        .card-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }

        .status-badge {
          font-size: 12px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 4px;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .recipe-tag {
          font-size: 12px;
          color: var(--t2);
          padding: 2px 10px;
          border-radius: 999px;
          background: var(--surface2);
        }

        .recipe-tag-text {
          font-size: 12px;
          color: var(--t2);
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .card-footer {
          margin-top: auto;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }

        .card-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: var(--t2);
        }
      `}</style>
    </div>
  )
}
