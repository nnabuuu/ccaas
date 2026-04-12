import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LessonPlan, LessonPlanStatus } from '../types/lesson-plan'
import { EDU_API } from '../config'

const STATUS_MAP: Record<LessonPlanStatus, { label: string; bg: string; color: string }> = {
  draft: { label: '草稿', bg: 'var(--bg2)', color: 'var(--t3)' },
  published: { label: '已发布', bg: 'var(--success-bg)', color: 'var(--success-t)' },
  in_use: { label: '使用中', bg: 'var(--info-bg)', color: 'var(--info-t)' },
  ai_generated: { label: 'AI 生成', bg: 'var(--purple-bg)', color: 'var(--purple-t)' },
}

export function LessonPlanList() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<LessonPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('page_size', String(pageSize))
      if (query) params.set('q', query)
      if (subjectFilter) params.set('subject_id', subjectFilter)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`${EDU_API}/lesson-plans?${params}`)
      if (res.ok) {
        const data = await res.json()
        setPlans(data.data ?? [])
        setTotal(data.total ?? 0)
      }
    } catch {
      // API unavailable
    } finally {
      setLoading(false)
    }
  }, [page, query, subjectFilter, statusFilter])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '28px 24px' }}>
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
          placeholder="搜索教案..."
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
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(1) }}
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
          <option value="">全部学科</option>
          <option value="math">数学</option>
          <option value="chinese">语文</option>
          <option value="english">英语</option>
          <option value="physics">物理</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
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
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="published">已发布</option>
          <option value="in_use">使用中</option>
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate('/lesson-plans/new')}
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
          + 新建教案
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: '12px' }}>
          加载中...
        </div>
      ) : plans.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--t3)', fontSize: '12px' }}>
          暂无教案
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {plans.map((plan) => {
            const status = STATUS_MAP[plan.status] ?? STATUS_MAP.draft
            const hasRequirement = !!plan.requirement

            return (
              <div
                key={plan.id}
                onClick={() => navigate(`/lesson-plans/${plan.id}`)}
                style={{
                  background: 'var(--bg1)',
                  border: '1px solid var(--b1)',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  cursor: 'pointer',
                }}
              >
                {/* Title row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--t1)' }}>
                    {plan.title || '无标题'}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: status.bg,
                      color: status.color,
                      fontWeight: 500,
                    }}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Meta row */}
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--t2)',
                    marginBottom: '6px',
                  }}
                >
                  {[plan.class_name, plan.subject_name, plan.lesson_type, plan.duration ? `${plan.duration} 分钟` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </div>

                {/* Requirement tag */}
                {hasRequirement ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      background: 'var(--teal-bg)',
                      color: 'var(--teal-t)',
                      borderRadius: '6px',
                      padding: '5px 10px',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--teal-t)',
                        flexShrink: 0,
                      }}
                    />
                    课标 {plan.requirement!.code} {plan.requirement!.text}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      background: 'var(--warn-bg)',
                      color: 'var(--warn-t)',
                      borderRadius: '6px',
                      padding: '5px 10px',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--warn-t)',
                        flexShrink: 0,
                      }}
                    />
                    未关联学业要求
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginTop: '16px',
          }}
        >
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              borderRadius: '6px',
              border: '0.5px solid var(--b1)',
              background: 'var(--bg1)',
              color: 'var(--t2)',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            上一页
          </button>
          <span style={{ fontSize: '11px', color: 'var(--t3)', lineHeight: '28px' }}>
            {page} / {Math.ceil(total / pageSize)}
          </span>
          <button
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage((p) => p + 1)}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              borderRadius: '6px',
              border: '0.5px solid var(--b1)',
              background: 'var(--bg1)',
              color: 'var(--t2)',
              cursor: page >= Math.ceil(total / pageSize) ? 'not-allowed' : 'pointer',
              opacity: page >= Math.ceil(total / pageSize) ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
