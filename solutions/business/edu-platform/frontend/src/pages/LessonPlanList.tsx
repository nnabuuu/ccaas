import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { SERVER_URL } from '../config'
import type { LessonPlanListItem, LessonPlanStatus } from '../types/lesson-plan'

const STATUS_LABELS: Record<LessonPlanStatus, string> = {
  draft: '草稿',
  published: '已发布',
  in_use: '使用中',
  ai_generated: 'AI 生成',
}

const STATUS_STYLES: Record<LessonPlanStatus, { bg: string; color: string }> = {
  draft: { bg: 'var(--surface2)', color: 'var(--t3)' },
  published: { bg: 'var(--green-bg)', color: 'var(--green)' },
  in_use: { bg: 'var(--blue-bg)', color: 'var(--blue)' },
  ai_generated: { bg: 'var(--purple-bg)', color: 'var(--purple)' },
}

export function LessonPlanList() {
  const navigate = useNavigate()
  const [items, setItems] = useState<LessonPlanListItem[]>([])
  const [search, setSearch] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchList = useCallback(async (q: string, subject: string, status: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (subject) params.set('subject_id', subject)
      if (status) params.set('status', status)
      const res = await fetch(`${SERVER_URL}/api/lesson-plans?${params}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList(search, subjectFilter, statusFilter)
  }, [fetchList, subjectFilter, statusFilter, search])

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchList(value, subjectFilter, statusFilter)
    }, 300)
  }, [fetchList, subjectFilter, statusFilter])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '13px',
    fontWeight: 500,
    color: active ? 'var(--t1)' : 'var(--t3)',
    borderBottom: active ? '2px solid var(--t1)' : '2px solid transparent',
    padding: '6px 12px',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
    borderBottomWidth: '2px',
    borderBottomStyle: 'solid',
    borderBottomColor: active ? 'var(--t1)' : 'transparent',
    fontFamily: 'inherit',
  })

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
    background: 'var(--surface)',
    color: 'var(--t2)',
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div style={{ maxWidth: '860px', padding: '28px 0' }}>
      {/* Page-level tab */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '20px',
      }}>
        <button style={tabStyle(true)}>教案</button>
        <button
          style={tabStyle(false)}
          onClick={() => navigate('/templates')}
        >
          模板
        </button>
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
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="搜索教案..."
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
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">全部学科</option>
          <option value="math">数学</option>
          <option value="chinese">语文</option>
          <option value="english">英语</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="in_use">使用中</option>
        </select>
        <button
          onClick={() => navigate('/lesson-plans/new')}
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
          + 新建教案
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>
          加载中...
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>
          暂无教案
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(`/lesson-plans/${item.id}`)}
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
                alignItems: 'flex-start',
                marginBottom: '6px',
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--t1)',
                }}>
                  {item.title}
                </span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 500,
                  background: STATUS_STYLES[item.status].bg,
                  color: STATUS_STYLES[item.status].color,
                  flexShrink: 0,
                  marginLeft: '8px',
                }}>
                  {STATUS_LABELS[item.status]}
                </span>
              </div>

              {/* Meta */}
              <div style={{
                fontSize: '11px',
                color: 'var(--t2)',
                marginBottom: '8px',
              }}>
                {item.class_name} · {item.subject} · {item.lesson_type} · {item.duration} 分钟 · {formatTime(item.updated_at)}
              </div>

              {/* Requirement */}
              {item.requirement ? (
                <div style={{
                  background: 'var(--teal-bg)',
                  color: 'var(--teal)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--teal)',
                    flexShrink: 0,
                  }} />
                  课标 {item.requirement.code} {item.requirement.text}
                </div>
              ) : (
                <div style={{
                  background: 'var(--amber-bg)',
                  color: 'var(--amber)',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--amber)',
                    flexShrink: 0,
                  }} />
                  未关联学业要求
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return '今天'
    if (diffDays === 1) return '昨天'
    if (diffDays < 7) return `${diffDays} 天前`
    return `${date.getMonth() + 1}/${date.getDate()}`
  } catch {
    return dateStr
  }
}
