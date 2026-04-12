import { useEduAuth } from '../../hooks/useEduAuth'
import type { WeeklySummary } from '../../types/dashboard'

interface HeroSectionProps {
  weeklySummary: WeeklySummary | null
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

function formatDate(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[now.getDay()]
  return `${month} 月 ${day} 日 周${weekday}`
}

export function HeroSection({ weeklySummary }: HeroSectionProps) {
  const { user } = useEduAuth()
  const teacherName = user?.name ?? '老师'
  const greeting = getGreeting()
  const dateStr = formatDate()

  const hasSummary = weeklySummary &&
    (weeklySummary.lesson_plan_edits > 0 || weeklySummary.submissions_graded > 0)

  return (
    <div style={{ marginBottom: '28px' }}>
      <h1 style={{
        fontSize: '24px',
        fontWeight: 700,
        letterSpacing: '-0.6px',
        lineHeight: 1.2,
        marginBottom: '4px',
        color: 'var(--t1)',
      }}>
        {greeting}，{teacherName}
      </h1>
      <div style={{
        fontSize: '13px',
        color: 'var(--t3)',
        lineHeight: 1.5,
      }}>
        {dateStr}
        {hasSummary && (
          <>
            {' · 本周编辑了 '}
            <strong style={{ color: 'var(--t2)', fontWeight: 500 }}>
              {weeklySummary.lesson_plan_edits} 份教案
            </strong>
            {'，批改了 '}
            <strong style={{ color: 'var(--t2)', fontWeight: 500 }}>
              {weeklySummary.submissions_graded} 份答卷
            </strong>
          </>
        )}
      </div>
    </div>
  )
}
