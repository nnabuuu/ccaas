import type { WeekDots } from '../../types/dashboard'

const ENTITY_COLOR_MAP: Record<string, string> = {
  lesson_plan: 'var(--purple)',
  homework: 'var(--blue)',
  submission: 'var(--blue)',
  session: 'var(--green)',
  requirement: 'var(--amber)',
  classroom_record: 'var(--teal)',
  proposal: 'var(--coral)',
}

interface WeekStripProps {
  weekDots: WeekDots | null
  selectedDate: string
  onSelectDate: (date: string) => void
}

function getWeekDays(): { date: string; dayNum: number; weekday: string; isToday: boolean }[] {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)

  const weekdays = ['一', '二', '三', '四', '五', '六', '日']
  const days = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({
      date: dateStr,
      dayNum: d.getDate(),
      weekday: weekdays[i],
      isToday: dateStr === today.toISOString().split('T')[0],
    })
  }

  return days
}

export function WeekStrip({ weekDots, selectedDate, onSelectDate }: WeekStripProps) {
  const days = getWeekDays()

  return (
    <div className="week-strip">
      {days.map((day) => {
        const isSelected = day.date === selectedDate
        const dots = weekDots?.days?.[day.date] ?? []
        const classes = [
          'week-day',
          isSelected ? 'sel' : '',
          day.isToday ? 'today' : '',
        ].filter(Boolean).join(' ')

        return (
          <div key={day.date} className={classes} onClick={() => onSelectDate(day.date)}>
            <div className="week-dow">{day.weekday}</div>
            <div className="week-date">{day.dayNum}</div>
            <div className="week-dots">
              {dots.map((entityType, i) => (
                <div
                  key={i}
                  className="wd"
                  style={{ background: ENTITY_COLOR_MAP[entityType] ?? 'var(--t3)' }}
                />
              ))}
            </div>
          </div>
        )
      })}

      <style>{`
        .week-strip {
          display: flex;
          gap: 4px;
          margin-bottom: 16px;
        }
        .week-day {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 6px 0;
          width: 100%;
          cursor: pointer;
          border-radius: 6px;
          transition: background 0.1s;
        }
        .week-day:hover { background: var(--surface); }
        .week-day.sel { background: var(--surface); }
        .week-dow {
          font-size: 9px;
          color: var(--t3);
          font-weight: 600;
        }
        .week-date {
          font-size: 13px;
          font-weight: 500;
          color: var(--t2);
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }
        .week-day.sel .week-date {
          background: var(--t1);
          color: var(--surface);
        }
        .week-day.today .week-date {
          background: var(--purple-bg);
          color: var(--purple);
        }
        .week-day.sel.today .week-date {
          background: var(--t1);
          color: var(--surface);
        }
        .week-dots {
          display: flex;
          gap: 2px;
          height: 4px;
        }
        .wd {
          width: 3px;
          height: 3px;
          border-radius: 50%;
        }
      `}</style>
    </div>
  )
}
