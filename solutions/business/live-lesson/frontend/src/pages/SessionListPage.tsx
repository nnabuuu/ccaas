import { useEffect, useState, memo } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const API_BASE = '/api'
const PAGE_SIZE = 20

type SessionStatus = 'waiting' | 'active' | 'ended'

interface SessionListItem {
  sessionId: string
  code: string
  lessonId: string
  lessonTitle: string
  status: SessionStatus
  studentCount: number
  duration: number | null
  createdAt: string
  startedAt: string | null
  endedAt: string | null
}

const STATUS_TABS: { label: string; value: SessionStatus | '' }[] = [
  { label: '全部', value: '' },
  { label: '等待中', value: 'waiting' },
  { label: '进行中', value: 'active' },
  { label: '已结束', value: 'ended' },
]

const STATUS_BADGE: Record<SessionStatus, { bg: string; color: string; label: string }> = {
  waiting: { bg: '#e8f0fe', color: '#1a5fa0', label: '等待中' },
  active: { bg: '#e6f4ea', color: '#1e7e34', label: '进行中' },
  ended: { bg: '#f0efeb', color: '#9c9a92', label: '已结束' },
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function getDuration(session: SessionListItem, tick: number): string {
  if (!session.startedAt) return '--'
  if (session.status === 'active') {
    const seconds = Math.max(0, Math.floor((tick - new Date(session.startedAt).getTime()) / 1000))
    return formatDuration(seconds)
  }
  return session.duration != null ? formatDuration(session.duration) : '--'
}

function useTick(enabled: boolean) {
  const [tick, setTick] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setTick(Date.now())
    const id = setInterval(() => setTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [enabled])
  return tick
}

// Memoized row — only active rows receive a changing `tick`, so non-active rows skip re-render
const SessionRow = memo(function SessionRow({
  session, tick, onClick,
}: {
  session: SessionListItem
  tick: number
  onClick: () => void
}) {
  const badge = STATUS_BADGE[session.status]
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '16px 20px',
        border: '1px solid #e8e6e0',
        cursor: 'pointer',
        transition: 'border-color .15s',
        outline: 'none',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#d0cec6')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e6e0')}
      onFocus={e => (e.currentTarget.style.borderColor = '#d0cec6')}
      onBlur={e => (e.currentTarget.style.borderColor = '#e8e6e0')}
    >
      {/* Top row: title + badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#1c1c1a' }}>
          {session.lessonTitle}
        </span>
        <span
          style={{
            fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 10,
            background: badge.bg, color: badge.color,
            display: 'flex', alignItems: 'center', gap: 4,
            flexShrink: 0,
          }}
        >
          {session.status === 'active' && (
            <span
              style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#1e7e34',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
          {badge.label}
        </span>
      </div>

      {/* Middle row: code, students, duration */}
      <div style={{ fontSize: 13, color: '#5c5b56', marginBottom: 6 }}>
        <span style={{ fontFamily: 'ui-monospace, "SF Mono", monospace', fontWeight: 500 }}>
          {session.code}
        </span>
        <span style={{ margin: '0 6px', color: '#bcbab2' }}>&middot;</span>
        学生 {session.studentCount} 人
        <span style={{ margin: '0 6px', color: '#bcbab2' }}>&middot;</span>
        时长 {getDuration(session, tick)}
      </div>

      {/* Bottom row: created time */}
      <div style={{ fontSize: 12, color: '#9c9a92' }}>
        {formatTime(session.createdAt)}
      </div>
    </div>
  )
})

export default function SessionListPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<SessionListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<SessionStatus | ''>('')
  const [offset, setOffset] = useState(0)

  const hasActive = items.some(s => s.status === 'active')
  const tick = useTick(hasActive)

  // Fetch with AbortController to prevent stale responses
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) })
    if (statusFilter) params.set('status', statusFilter)

    fetch(`${API_BASE}/classroom/sessions?${params}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`加载失败 (${res.status})`)
        return res.json()
      })
      .then(data => {
        setItems(data.items)
        setTotal(data.total)
        // Clamp offset if total shrank (e.g. session ended while on a later page)
        if (offset >= data.total && data.total > 0) {
          setOffset(Math.floor((data.total - 1) / PAGE_SIZE) * PAGE_SIZE)
        }
      })
      .catch(e => {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : '加载课堂列表失败')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [statusFilter, offset])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const totalPages = Math.ceil(total / PAGE_SIZE)

  function handleTabChange(value: SessionStatus | '') {
    setStatusFilter(value)
    setOffset(0)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f4f3ef',
        fontFamily: '"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 640, padding: '40px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div
            style={{
              width: 44, height: 44, borderRadius: 12,
              background: '#1c1c1a', color: '#fbfaf7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 700, flexShrink: 0,
            }}
          >
            K
          </div>
          <Link
            to="/"
            style={{ fontSize: 13, color: '#1a5fa0', textDecoration: 'none' }}
          >
            &larr; 返回课程选择
          </Link>
        </div>

        <h1
          style={{
            fontSize: 24, fontWeight: 700, color: '#1c1c1a',
            letterSpacing: '-.4px', lineHeight: 1.2, marginBottom: 20,
          }}
        >
          课堂记录
        </h1>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {STATUS_TABS.map(tab => {
            const active = statusFilter === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                style={{
                  padding: '6px 14px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? '#1c1c1a' : '#9c9a92',
                  background: active ? '#fff' : 'transparent',
                  border: active ? '1px solid #e8e6e0' : '1px solid transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ color: '#9c9a92', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
            加载中...
          </div>
        ) : error ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p style={{ color: '#942929', fontSize: 14, marginBottom: 12 }}>{error}</p>
            <button
              onClick={() => { setError(null); setOffset(o => o) }}
              style={{
                fontSize: 12, color: '#1a5fa0', background: 'none',
                border: '1px solid rgba(26,95,160,.2)',
                padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
              }}
            >
              重试
            </button>
          </div>
        ) : items.length === 0 ? (
          <div style={{ color: '#9c9a92', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>
            暂无课堂记录
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(session => (
                <SessionRow
                  key={session.sessionId}
                  session={session}
                  tick={session.status === 'active' ? tick : 0}
                  onClick={() => navigate(`/session/${session.sessionId}/watch`)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 16, marginTop: 24,
                }}
              >
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  style={{
                    fontSize: 13, color: offset === 0 ? '#bcbab2' : '#1a5fa0',
                    background: 'none', border: 'none',
                    cursor: offset === 0 ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  上一页
                </button>
                <span style={{ fontSize: 13, color: '#5c5b56' }}>
                  第 {page} / {totalPages} 页
                </span>
                <button
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={offset + PAGE_SIZE >= total}
                  style={{
                    fontSize: 13, color: offset + PAGE_SIZE >= total ? '#bcbab2' : '#1a5fa0',
                    background: 'none', border: 'none',
                    cursor: offset + PAGE_SIZE >= total ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </div>
  )
}
