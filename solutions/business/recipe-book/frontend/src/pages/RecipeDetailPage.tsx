import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChatInterface } from '@kedge-agentic/chat-interface'
import { MentionProvider, MentionPicker, MentionTrigger } from '../lib/mention'
import { useRecipe } from '../hooks/useRecipes'
import { CCAAS_URL, RECIPE_BACKEND_URL, TENANT_ID, SESSION_TEMPLATE, API_KEY } from '../config'
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
  const { recipe, loading } = useRecipe(id)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatSessionId] = useState(() => `recipe_${id}_${crypto.randomUUID()}`)
  const clearRefsRef = useRef<(() => void) | null>(null)

  if (loading) {
    return <p style={{ fontSize: 13, color: 'var(--t3)' }}>加载中...</p>
  }

  if (!recipe) {
    return <p style={{ fontSize: 13, color: 'var(--t3)' }}>未找到食谱</p>
  }

  return (
    <div className={`detail-layout${isChatOpen ? ' chat-open' : ''}`}>
      {/* Left: Recipe Content */}
      <div className="detail-content">
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
            <span className="published-badge">已发布</span>
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

        {!isChatOpen && (
          <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setIsChatOpen(true)}
              className="chat-trigger-btn"
            >
              与 AI 讨论这道菜 →
            </button>
          </div>
        )}
      </div>

      {/* Right: Chat Panel (Split View) */}
      <div className="detail-chat-panel">
        <div className="detail-chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)' }}>
              讨论：{recipe.title}
            </span>
          </div>
          <button
            className="chat-close-btn"
            onClick={() => setIsChatOpen(false)}
            aria-label="关闭聊天"
          >
            ×
          </button>
        </div>
        <div className="detail-chat-body">
          {isChatOpen && (
            <MentionProvider>
              <MentionTrigger clearRefsRef={clearRefsRef} />
              <ChatInterface
                key={chatSessionId}
                serverUrl={CCAAS_URL}
                tenantId={TENANT_ID}
                sessionTemplate={SESSION_TEMPLATE}
                apiKey={API_KEY}
                sessionId={chatSessionId}
                sessionContext={{ recipeId: id, recipeName: recipe.title, cuisine: recipe.cuisine }}
                onMessageSent={() => clearRefsRef.current?.()}
                composerPlaceholder={`讨论「${recipe.title}」的做法...`}
                disclaimer={null}
              />
              <MentionPicker
                baseUrl={RECIPE_BACKEND_URL}
                sessionId={chatSessionId}
                sessionTemplate={SESSION_TEMPLATE}
                contextEntity={{
                  entityType: 'recipe',
                  entityId: id!,
                  displayName: recipe.title,
                  icon: '🍳',
                }}
                autoRef={true}
              />
            </MentionProvider>
          )}
        </div>
      </div>

      <style>{`
        .detail-layout {
          display: flex;
          position: relative;
          min-height: calc(100vh - 80px);
        }

        .detail-content {
          flex: 1;
          max-width: 720px;
          transition: max-width 0.3s ease;
        }

        .detail-chat-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 0;
          overflow: hidden;
          background: var(--surface);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          transition: width 0.3s ease;
          z-index: 90;
        }

        .detail-layout.chat-open .detail-chat-panel {
          width: 45%;
        }

        .detail-layout.chat-open .detail-content {
          max-width: 100%;
          padding-right: 16px;
        }

        @media (max-width: 1199px) {
          .detail-layout.chat-open .detail-chat-panel {
            width: 100%;
          }
        }

        .detail-chat-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }

        .detail-chat-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .chat-close-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 20px;
          color: var(--t3);
          border-radius: 6px;
          transition: all 0.12s;
          font-family: inherit;
        }
        .chat-close-btn:hover {
          color: var(--t1);
          background: var(--surface2);
        }

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

        .published-badge {
          font-size: 11px;
          font-weight: 500;
          padding: 2px 8px;
          border-radius: 4px;
          background: var(--green-bg);
          color: var(--green);
        }

        .detail-tag {
          font-size: 12px;
          color: var(--t2);
          padding: 3px 10px;
          border-radius: 4px;
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
          border-radius: 8px;
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
          border-radius: 4px;
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
          border-radius: 8px;
          font-size: 13px;
          line-height: 1.6;
          margin: 0 0 12px;
        }

        .chat-trigger-btn {
          font-size: 13px;
          font-weight: 600;
          color: var(--surface);
          background: var(--t1);
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.12s;
        }
        .chat-trigger-btn:hover { opacity: 0.9; }
      `}</style>
    </div>
  )
}
