import type { ActivityItem } from '../../types/dashboard'

interface ActivityTimelineProps {
  activities: ActivityItem[] | null
  selectedDate: string
  loading: boolean
}

const ENTITY_COLOR_MAP: Record<string, string> = {
  lesson_plan: 'var(--purple-t)',
  homework: 'var(--info-t)',
  submission: 'var(--info-t)',
  session: 'var(--success-t)',
  requirement: 'var(--warn-t)',
  classroom_record: 'var(--teal-t)',
  proposal: 'var(--coral-t)',
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  const month = date.getMonth() + 1
  const day = date.getDate()

  const isToday = date.toISOString().split('T')[0] === today.toISOString().split('T')[0]
  return isToday ? `今天 · ${month} 月 ${day} 日` : `${month} 月 ${day} 日`
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}

export function ActivityTimeline({ activities, selectedDate, loading }: ActivityTimelineProps) {
  if (loading) {
    return (
      <div style={{
        borderTop: '1px solid var(--b1)',
        paddingTop: '16px',
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--t3)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.3px',
          marginBottom: '8px',
        }}>
          {formatDateLabel(selectedDate)}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--t3)', padding: '10px 0' }}>
          加载中...
        </div>
      </div>
    )
  }

  return (
    <div style={{
      borderTop: '1px solid var(--b1)',
      paddingTop: '16px',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 600,
        color: 'var(--t3)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.3px',
        marginBottom: '8px',
      }}>
        {formatDateLabel(selectedDate)}
      </div>

      {(!activities || activities.length === 0) ? (
        <div style={{ fontSize: '12px', color: 'var(--t3)', padding: '10px 0' }}>
          这一天没有活动记录
        </div>
      ) : (
        activities.map((item, i) => (
          <div
            key={`${item.entity_id}-${i}`}
            style={{
              padding: '10px 0',
              borderBottom: i < activities.length - 1 ? '1px solid var(--b1)' : 'none',
              display: 'flex',
              gap: '12px',
              cursor: 'pointer',
            }}
          >
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              flexShrink: 0,
              marginTop: '6px',
              background: ENTITY_COLOR_MAP[item.entity_type] || 'var(--t3)',
            }} />
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: '12px',
                color: 'var(--t2)',
                lineHeight: 1.5,
              }}>
                <strong style={{ color: 'var(--t1)', fontWeight: 500 }}>
                  {item.entity_display_name}
                </strong>
                {' '}{item.action}{item.detail ? ` ${item.detail}` : ''}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--t3)',
                marginTop: '2px',
              }}>
                {formatTime(item.timestamp)}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
