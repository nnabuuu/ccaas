import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Template } from '../types/template'
import type { TemplateScope } from '../types/template'
import { PromoteModal } from '../components/template/PromoteModal'
import { EDU_API } from '../config'

const SCOPE_BADGE: Record<TemplateScope, { label: string; bg: string; color: string }> = {
  district: { label: '区级', bg: 'var(--success-bg)', color: 'var(--success-t)' },
  school: { label: '校本', bg: 'var(--info-bg)', color: 'var(--info-t)' },
  teacher: { label: '个人', bg: 'var(--bg2)', color: 'var(--t3)' },
}

const SCOPE_TABS: { scope: TemplateScope; label: string }[] = [
  { scope: 'district', label: '区级模板' },
  { scope: 'school', label: '校本模板' },
  { scope: 'teacher', label: '我的模板' },
]

export function TemplateList() {
  const navigate = useNavigate()
  const [activeScope, setActiveScope] = useState<TemplateScope>('district')
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [lessonTypeFilter, setLessonTypeFilter] = useState('')
  const [counts, setCounts] = useState<Record<TemplateScope, number>>({
    district: 0,
    school: 0,
    teacher: 0,
  })
  const [promoteTarget, setPromoteTarget] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('scope', activeScope)
      if (query) params.set('q', query)
      if (lessonTypeFilter) params.set('lesson_type', lessonTypeFilter)

      const res = await fetch(`${EDU_API}/templates?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.data ?? [])
        setCounts((prev) => ({ ...prev, [activeScope]: data.total ?? 0 }))
      }
    } catch {
      // API unavailable
    } finally {
      setLoading(false)
    }
  }, [activeScope, query, lessonTypeFilter])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleDelete = useCallback(async (tplId: string, tplName: string) => {
    if (!window.confirm(`确定删除模板「${tplName || '无标题'}」？此操作不可恢复。`)) return
    setDeleting(tplId)
    try {
      const res = await fetch(`${EDU_API}/templates/${tplId}`, { method: 'DELETE' })
      if (res.ok) {
        fetchTemplates()
      }
    } catch {
      // API unavailable
    } finally {
      setDeleting(null)
    }
  }, [fetchTemplates])

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Primary tab: 教案 | 模板 */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          borderBottom: '0.5px solid var(--b1)',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => navigate('/lesson-plans')}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            border: 'none',
            background: 'transparent',
            color: 'var(--t3)',
            cursor: 'pointer',
            borderBottom: '2px solid transparent',
            fontFamily: 'inherit',
          }}
        >
          教案
        </button>
        <button
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            border: 'none',
            background: 'transparent',
            color: 'var(--t1)',
            cursor: 'pointer',
            borderBottom: '2px solid var(--t1)',
            fontFamily: 'inherit',
            fontWeight: 500,
          }}
        >
          模板
        </button>
      </div>

      {/* Secondary tabs: scope */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
        }}
      >
        {SCOPE_TABS.map((tab) => {
          const isActive = activeScope === tab.scope
          return (
            <button
              key={tab.scope}
              onClick={() => setActiveScope(tab.scope)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: '6px',
                border: isActive ? '1px solid var(--t1)' : '1px solid var(--b1)',
                background: isActive ? 'var(--t1)' : 'var(--bg1)',
                color: isActive ? 'var(--bg1)' : 'var(--t2)',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {tab.label}({counts[tab.scope]})
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="搜索模板..."
          style={{
            width: '220px',
            padding: '6px 10px',
            border: '0.5px solid var(--b1)',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'inherit',
            background: 'var(--bg1)',
            color: 'var(--t1)',
          }}
        />
        <select
          value={lessonTypeFilter}
          onChange={(e) => setLessonTypeFilter(e.target.value)}
          style={{
            padding: '6px 10px',
            border: '0.5px solid var(--b1)',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'inherit',
            background: 'var(--bg1)',
            color: 'var(--t2)',
          }}
        >
          <option value="">全部课型</option>
          <option value="新授课">新授课</option>
          <option value="复习课">复习课</option>
          <option value="练习课">练习课</option>
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/templates/new')}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            borderRadius: '8px',
            border: '0.5px solid var(--t1)',
            background: 'var(--t1)',
            color: 'var(--bg1)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + 新建模板
        </button>
      </div>

      {/* Template cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: '12px' }}>
          加载中...
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: '12px' }}>
          暂无模板
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map((tpl) => {
            const scopeInfo = SCOPE_BADGE[tpl.scope] ?? SCOPE_BADGE.teacher
            const canPromote =
              tpl.scope === 'teacher' && tpl.promotion_status !== 'pending'
            const isPending = tpl.promotion_status === 'pending'

            return (
              <div
                key={tpl.id}
                onClick={() => navigate(`/templates/${tpl.id}`)}
                style={{
                  background: 'var(--bg1)',
                  border: '1px solid var(--b1)',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                }}
              >
                {/* Header: name + scope badge */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--t1)' }}>
                    {tpl.name || '无标题模板'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: isPending ? 'var(--warn-bg)' : scopeInfo.bg,
                        color: isPending ? 'var(--warn-t)' : scopeInfo.color,
                        fontWeight: 500,
                      }}
                    >
                      {isPending ? '审核中' : scopeInfo.label}
                    </span>
                    {tpl.scope === 'teacher' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(tpl.id, tpl.name)
                        }}
                        disabled={deleting === tpl.id}
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '4px',
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--t3)',
                          cursor: deleting === tpl.id ? 'not-allowed' : 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: deleting === tpl.id ? 0.5 : 0.6,
                          flexShrink: 0,
                        }}
                        title="删除模板"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Description */}
                {tpl.description && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--t2)',
                      marginBottom: '8px',
                    }}
                  >
                    {tpl.description}
                  </div>
                )}

                {/* Block pills */}
                {tpl.blocks.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {tpl.blocks
                      .filter((b) => b.type === 'section')
                      .map((b, idx) => (
                        <span key={b.id}>
                          {idx > 0 && (
                            <span style={{ color: 'var(--t3)', fontSize: '10px', margin: '0 2px' }}>
                              →
                            </span>
                          )}
                          <span
                            style={{
                              padding: '2px 6px',
                              background: 'var(--bg2)',
                              borderRadius: '3px',
                              fontSize: '10px',
                              color: 'var(--t2)',
                            }}
                          >
                            {String(b.content.title ?? '未命名')}
                          </span>
                        </span>
                      ))}
                  </div>
                )}

                {/* Footer stats */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: 'var(--t3)',
                  }}
                >
                  <span>
                    {[
                      tpl.usage_count != null ? `使用 ${tpl.usage_count} 次` : null,
                      tpl.lesson_type,
                      tpl.subject ?? '通用',
                      tpl.version ? `v${tpl.version}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/lesson-plans/new?template_id=${tpl.id}`)
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        borderRadius: '6px',
                        border: '0.5px solid var(--b1)',
                        background: 'var(--bg1)',
                        color: 'var(--t2)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      使用此模板
                    </button>
                    {canPromote && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setPromoteTarget(tpl)
                        }}
                        style={{
                          padding: '4px 10px',
                          fontSize: '11px',
                          borderRadius: '6px',
                          border: '0.5px solid var(--b1)',
                          background: 'var(--bg1)',
                          color: 'var(--t2)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        提交推优
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Promote modal */}
      {promoteTarget && (
        <PromoteModal
          templateId={promoteTarget.id}
          templateName={promoteTarget.name}
          lessonType={promoteTarget.lesson_type}
          onClose={() => setPromoteTarget(null)}
          onSuccess={() => {
            setPromoteTarget(null)
            fetchTemplates()
          }}
        />
      )}
    </div>
  )
}
