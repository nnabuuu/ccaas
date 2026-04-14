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
    <div style={{ maxWidth: 960 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>
        食谱列表
      </h1>
      <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 24 }}>
        浏览和管理所有食谱
      </p>

      <div style={{ marginBottom: 24 }}>
        <input
          type="text"
          placeholder="搜索食谱..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 360,
            padding: '8px 12px',
            fontSize: 13,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface)',
            color: 'var(--t1)',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>加载中...</p>
      ) : recipes.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--t3)' }}>未找到食谱</p>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <div
              key={recipe.id}
              className="recipe-card"
              onClick={() => navigate(`/recipes/${recipe.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', margin: 0 }}>
                  {recipe.title}
                </h3>
                <span
                  className="status-badge"
                  style={{
                    background: recipe.status === 'published' ? 'var(--green-bg)' : 'var(--surface2)',
                    color: recipe.status === 'published' ? 'var(--green)' : 'var(--t3)',
                  }}
                >
                  {recipe.status === 'published' ? '已发布' : '草稿'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="recipe-tag">{recipe.cuisine}</span>
                <span className="recipe-tag">{DIFFICULTY_LABELS[recipe.difficulty] ?? recipe.difficulty}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .recipe-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        .recipe-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 16px;
          cursor: pointer;
          transition: border-color 0.12s;
        }
        .recipe-card:hover {
          border-color: var(--t3);
        }

        .status-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
        }

        .recipe-tag {
          font-size: 11px;
          color: var(--t2);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          background: var(--surface2);
        }
      `}</style>
    </div>
  )
}
