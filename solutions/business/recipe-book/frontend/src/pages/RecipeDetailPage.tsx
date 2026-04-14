import { useParams, useNavigate } from 'react-router-dom'
import { useRecipe } from '../hooks/useRecipes'
import type { Block, IngredientItem } from '../types/recipe'

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

function BlockRenderer({ block }: { block: Block }) {
  const { type, content } = block

  switch (type) {
    case 'section':
      return (
        <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--t1)', margin: '24px 0 12px' }}>
          {content.heading as string}
        </h2>
      )

    case 'text':
      return (
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--t2)', margin: '0 0 12px' }}>
          {content.text as string}
        </p>
      )

    case 'ingredient': {
      const items = content.items as IngredientItem[]
      const category = content.category as string
      return (
        <div style={{ margin: '0 0 16px' }}>
          {category && (
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', margin: '0 0 8px' }}>
              {category}
            </h3>
          )}
          <div className="ingredient-list">
            {items.map((item, i) => (
              <div key={i} className="ingredient-item">
                <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{item.name}</span>
                <span style={{ color: 'var(--t3)', fontSize: 12 }}>
                  {item.amount}
                  {item.note ? ` · ${item.note}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    case 'list': {
      const ordered = content.ordered as boolean
      const items = content.items as string[]
      const Tag = ordered ? 'ol' : 'ul'
      return (
        <Tag
          style={{
            margin: '0 0 16px',
            paddingLeft: 20,
            fontSize: 14,
            lineHeight: 1.8,
            color: 'var(--t2)',
          }}
        >
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Tag>
      )
    }

    case 'timeline': {
      const columns = content.columns as string[]
      const rows = content.rows as string[][]
      return (
        <div style={{ margin: '0 0 16px', overflowX: 'auto' }}>
          <table className="block-table">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={i}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case 'table': {
      const columns = content.columns as string[]
      const rows = content.rows as string[][]
      return (
        <div style={{ margin: '0 0 16px', overflowX: 'auto' }}>
          <table className="block-table">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={i}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    case 'callout': {
      const text = content.text as string
      const color = content.color as string
      const isWarning = color === 'warning'
      return (
        <div
          className="block-callout"
          style={{
            background: isWarning ? 'var(--amber-bg)' : 'var(--blue-bg)',
            borderLeft: `3px solid ${isWarning ? 'var(--amber)' : 'var(--blue)'}`,
            color: isWarning ? 'var(--amber)' : 'var(--blue)',
          }}
        >
          {text}
        </div>
      )
    }

    default:
      return null
  }
}

export function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipe, document, loading } = useRecipe(id)

  if (loading) {
    return <p style={{ fontSize: 13, color: 'var(--t3)' }}>加载中...</p>
  }

  if (!recipe) {
    return <p style={{ fontSize: 13, color: 'var(--t3)' }}>未找到食谱</p>
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <button
        onClick={() => navigate('/recipes')}
        className="back-btn"
      >
        ← 返回列表
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--t1)', margin: 0 }}>
          {recipe.title}
        </h1>
        {recipe.status === 'published' && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--green-bg)',
              color: 'var(--green)',
            }}
          >
            已发布
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <span className="detail-tag">{recipe.cuisine}</span>
        <span className="detail-tag">{DIFFICULTY_LABELS[recipe.difficulty] ?? recipe.difficulty}</span>
      </div>

      <div className="meta-grid">
        <div className="meta-item">
          <div className="meta-label">准备时间</div>
          <div className="meta-value">{recipe.prep_time} 分钟</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">烹饪时间</div>
          <div className="meta-value">{recipe.cook_time} 分钟</div>
        </div>
        <div className="meta-item">
          <div className="meta-label">份量</div>
          <div className="meta-value">{recipe.servings} 人份</div>
        </div>
      </div>

      {recipe.blocks && recipe.blocks.length > 0 && (
        <div style={{ marginTop: 24 }}>
          {recipe.blocks.map((block, i) => (
            <BlockRenderer key={i} block={block} />
          ))}
        </div>
      )}

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate(`/chat?recipeId=${id}&recipeName=${encodeURIComponent(recipe.title)}`)}
          className="chat-link-btn"
        >
          与 AI 讨论这道菜 →
        </button>
      </div>

      <style>{`
        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--t2);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          margin-bottom: 20px;
          font-family: inherit;
          transition: color 0.12s;
        }
        .back-btn:hover { color: var(--t1); }

        .detail-tag {
          font-size: 12px;
          color: var(--t2);
          padding: 3px 10px;
          border-radius: var(--radius-sm);
          background: var(--surface2);
        }

        .meta-grid {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
        }

        .meta-item {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          min-width: 100px;
        }

        .meta-label {
          font-size: 11px;
          color: var(--t3);
          margin-bottom: 4px;
        }

        .meta-value {
          font-size: 15px;
          font-weight: 600;
          color: var(--t1);
        }

        .ingredient-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ingredient-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 12px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: 13px;
        }

        .block-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .block-table th {
          text-align: left;
          padding: 8px 12px;
          font-weight: 600;
          color: var(--t1);
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          font-size: 12px;
        }

        .block-table td {
          padding: 8px 12px;
          color: var(--t2);
          border-bottom: 1px solid var(--border);
        }

        .block-callout {
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 13px;
          line-height: 1.6;
          margin: 0 0 12px;
        }

        .chat-link-btn {
          font-size: 13px;
          font-weight: 500;
          color: var(--t1);
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 8px 16px;
          cursor: pointer;
          font-family: inherit;
          transition: border-color 0.12s;
        }
        .chat-link-btn:hover { border-color: var(--t3); }
      `}</style>
    </div>
  )
}
