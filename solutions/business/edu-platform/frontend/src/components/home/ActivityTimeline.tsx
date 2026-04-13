import type { ActivityItem } from '../../types/dashboard'

const ENTITY_COLOR_MAP: Record<string, string> = {
  lesson_plan: 'var(--purple)',
  homework: 'var(--blue)',
  submission: 'var(--blue)',
  session: 'var(--green)',
  requirement: 'var(--amber)',
  classroom_record: 'var(--teal)',
  proposal: 'var(--coral)',
}

interface ActivityTimelineProps {
  activities: ActivityItem[] | null
  selectedDate: string
  loading: boolean
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  return isToday ? `今天 · ${month} 月 ${day} 日` : `${month} 月 ${day} 日`
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours} 小时前`

  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

export function ActivityTimeline({ activities, selectedDate, loading }: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="tl-section">
        <div className="tl-date-label">{formatDateLabel(selectedDate)}</div>
        <div className="tl-loading">加载中...</div>
      </div>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="tl-section">
        <div className="tl-date-label">{formatDateLabel(selectedDate)}</div>
        <div className="tl-empty">这一天没有活动记录</div>
      </div>
    )
  }

  return (
    <div className="tl-section">
      <div className="tl-date-label">{formatDateLabel(selectedDate)}</div>
      {activities.map((item, i) => (
        <div key={i} className="tl">
          <div
            className="tl-dot"
            style={{ background: ENTITY_COLOR_MAP[item.entity_type] ?? 'var(--t3)' }}
          />
          <div className="tl-body">
            <div className="tl-text">
              <strong>{item.entity_display_name}</strong> {item.action}
              {item.detail ? ` ${item.detail}` : ''}
            </div>
            <div className="tl-time">{formatTimestamp(item.timestamp)}</div>
          </div>
        </div>
      ))}

      <style>{`
        .tl-section {
          border-top: 1px solid var(--border);
          padding-top: 16px;
        }
        .tl-date-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--t3);
          text-transform: uppercase;
          letter-spacing: 0.3px;
          margin-bottom: 8px;
        }
        .tl {
          padding: 10px 0;
          border-bottom: 1px solid var(--border);
          display: flex;
          gap: 12px;
          cursor: pointer;
        }
        .tl:last-child { border: none; }
        .tl:hover { opacity: 0.7; }
        .tl-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 6px;
        }
        .tl-body { flex: 1; }
        .tl-text {
          font-size: 12px;
          color: var(--t2);
          line-height: 1.5;
        }
        .tl-text strong {
          color: var(--t1);
          font-weight: 500;
        }
        .tl-time {
          font-size: 10px;
          color: var(--t3);
          margin-top: 2px;
        }
        .tl-loading {
          font-size: 12px;
          color: var(--t3);
          padding: 16px 0;
        }
        .tl-empty {
          font-size: 12px;
          color: var(--t3);
          padding: 16px 0;
        }
      `}</style>
    </div>
  )
}
