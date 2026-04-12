import type { WeekDots } from '../../types/dashboard'
import { ENTITY_COLOR_MAP } from '../../constants/entity-colors'

interface WeekStripProps {
  weekDots: WeekDots | null
  selectedDate: string
  onSelectDate: (date: string) => void
}

const DOW_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function getWeekDates(): { date: Date; dateStr: string }[] {
  const now = new Date()
  const dayOfWeek = now.getDay()
  // Monday = start of week
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    return { date: d, dateStr }
  })
}

function formatToday(): string {
  return new Date().toISOString().split('T')[0]
}

export function WeekStrip({ weekDots, selectedDate, onSelectDate }: WeekStripProps) {
  const weekDates = getWeekDates()
  const todayStr = formatToday()

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      marginBottom: '16px',
    }}>
      {weekDates.map((item, i) => {
        const isSelected = item.dateStr === selectedDate
        const isToday = item.dateStr === todayStr
        const dots = weekDots?.days?.[item.dateStr] || []

        return (
          <div
            key={item.dateStr}
            onClick={() => onSelectDate(item.dateStr)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: '6px 0',
              width: '100%',
              cursor: 'pointer',
              borderRadius: '6px',
              transition: 'background 0.1s',
              background: 'transparent',
            }}
          >
            <div style={{
              fontSize: '9px',
              color: 'var(--t3)',
              fontWeight: 600,
            }}>
              {DOW_LABELS[i]}
            </div>
            <div style={{
              fontSize: '13px',
              fontWeight: 500,
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              ...(isSelected
                ? { background: 'var(--t1)', color: 'white' }
                : isToday
                  ? { background: 'var(--purple-bg)', color: 'var(--purple-t)' }
                  : { color: 'var(--t2)' }
              ),
            }}>
              {item.date.getDate()}
            </div>
            <div style={{
              display: 'flex',
              gap: '2px',
              height: '4px',
            }}>
              {dots.map((entityType, di) => (
                <div
                  key={di}
                  style={{
                    width: '3px',
                    height: '3px',
                    borderRadius: '50%',
                    background: ENTITY_COLOR_MAP[entityType] || 'var(--t3)',
                  }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
