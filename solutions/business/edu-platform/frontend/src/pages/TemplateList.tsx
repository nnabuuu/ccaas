import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { SERVER_URL } from '../config'
import type { TemplateListItem, TemplateScope } from '../types/template'
import { PromoteModal } from '../components/template/PromoteModal'

const SCOPE_LABELS: Record<TemplateScope, string> = {
  district: '区级',
  school: '校本',
  teacher: '个人',
}

const SCOPE_STYLES: Record<TemplateScope, { bg: string; color: string }> = {
  district: { bg: 'var(--green-bg)', color: 'var(--green)' },
  school: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
  teacher: { bg: 'var(--surface2)', color: 'var(--t3)' },
}

const SCOPE_TABS: { scope: TemplateScope; label: string }[] = [
  { scope: 'district', label: '区级模板' },
  { scope: 'school', label: '校本模板' },
  { scope: 'teacher', label: '我的模板' },
]

export function TemplateList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<TemplateListItem[]>([])
  const [activeScope, setActiveScope] = useState<TemplateScope>('district')
  const [search, setSearch] = useState('')
  const [lessonTypeFilter, setLessonTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [promoteTarget, setPromoteTarget] = useState<TemplateListItem | null>(null)

  const fetchList = useCallback(async (scope: TemplateScope, q: string, lt: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ scope })
      if (q) params.set('q', q)
      if (lt) params.set('lesson_type', lt)
      const res = await fetch(`${SERVER_URL}/api/templates?${params}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList(activeScope, search, lessonTypeFilter)
  }, [fetchList, activeScope, search, lessonTypeFilter])

  const handlePromote = useCallback(async (targetScope: TemplateScope, reason: string) => {
    if (!promoteTarget) return
    try {
      await fetch(`${SERVER_URL}/api/templates/${promoteTarget.id}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_scope: targetScope, reason }),
      })
      fetchList(activeScope, search, lessonTypeFilter)
    } catch {
      // silently fail
    }
    setPromoteTarget(null)
  }, [promoteTarget, fetchList, activeScope, search, lessonTypeFilter])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '13px',
    fontWeight: 500,
    color: active ? 'var(--t1)' : 'var(--t3)',
    borderBottom: '2px solid',
    borderBottomColor: active ? 'var(--t1)' : 'transparent',
    padding: '6px 12px',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    fontFamily: 'inherit',
  })

  const secondaryTabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '12px',
    fontWeight: 500,
    color: active ? 'var(--t1)' : 'var(--t3)',
    borderBottom: '2px solid',
    borderBottomColor: active ? 'var(--t1)' : 'transparent',
    padding: '4px 10px',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    fontFamily: 'inherit',
  })

  return (
    <div style={{ maxWidth: '860px', padding: '28px 0' }}>
      {/* Page-level tab */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '16px',
      }}>
        <button
          style={tabStyle(false)}
          onClick={() => navigate('/lesson-plans')}
        >
          教案
        </button>
        <button style={tabStyle(true)}>模板</button>
      </div>

      {/* Secondary scope tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '16px',
      }}>
        {SCOPE_TABS.map(({ scope, label }) => (
          <button
            key={scope}
            style={secondaryTabStyle(activeScope === scope)}
            onClick={() => setActiveScope(scope)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索模板..."
          style={{
            flex: 1,
            minWidth: '160px',
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '12px',
            background: 'var(--surface)',
            color: 'var(--t1)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--focus-border)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        />
        <select
          value={lessonTypeFilter}
          onChange={(e) => setLessonTypeFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '12px',
            background: 'var(--surface)',
            color: 'var(--t2)',
            fontFamily: 'inherit',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="">全部课型</option>
          <option value="新授课">新授课</option>
          <option value="复习课">复习课</option>
          <option value="练习课">练习课</option>
        </select>
        <button
          onClick={() => navigate('/templates/new')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: 'var(--t1)',
            color: 'var(--surface)',
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          + 新建模板
        </button>
      </div>

      {/* Template cards */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>
          加载中...
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>
          暂无模板
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/templates/${item.id}`)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '16px 20px',
                cursor: 'pointer',
                transition: 'border-color .15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--t3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--t1)',
                }}>
                  {item.name}
                </span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {item.promotion_status === 'pending' && (
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 500,
                      background: 'var(--amber-bg)',
                      color: 'var(--amber)',
                    }}>
                      审核中
                    </span>
                  )}
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 500,
                    background: SCOPE_STYLES[item.scope].bg,
                    color: SCOPE_STYLES[item.scope].color,
                  }}>
                    {SCOPE_LABELS[item.scope]}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div style={{
                fontSize: '11px',
                color: 'var(--t2)',
                marginBottom: '8px',
              }}>
                {item.description}
              </div>

              {/* Block pills */}
              {item.block_summary && item.block_summary.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginBottom: '8px',
                  flexWrap: 'wrap',
                }}>
                  {item.block_summary.map((label, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{
                        padding: '2px 6px',
                        background: 'var(--surface2)',
                        borderRadius: '3px',
                        fontSize: '10px',
                        color: 'var(--t2)',
                      }}>
                        {label}
                      </span>
                      {i < item.block_summary.length - 1 && (
                        <span style={{ color: 'var(--t3)', fontSize: '10px' }}>→</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: '10px',
                  color: 'var(--t3)',
                }}>
                  使用 {item.usage_count} 次 · {item.lesson_type} · {item.subject} · {item.version}
                </span>
                {activeScope === 'teacher' && item.promotion_status !== 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setPromoteTarget(item)
                    }}
                    style={{
                      padding: '4px 10px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--t2)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    提交推优
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promote Modal */}
      {promoteTarget && (
        <PromoteModal
          templateName={promoteTarget.name}
          lessonType={promoteTarget.lesson_type}
          subject={promoteTarget.subject}
          onSubmit={handlePromote}
          onClose={() => setPromoteTarget(null)}
        />
      )}
    </div>
  )
}
