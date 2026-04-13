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
  const auth = useEduAuth()
  const teacherName = auth.user?.name ?? '老师'
  const greeting = getGreeting()
  const dateStr = formatDate()

  const hasStats =
    weeklySummary &&
    (weeklySummary.lesson_plan_edits > 0 || weeklySummary.submissions_graded > 0)

  return (
    <div className="hero">
      <h1 className="hero-title">
        {greeting}，{teacherName}
      </h1>
      <div className="hero-sub">
        {dateStr}
        {hasStats && (
          <>
            {' · 本周编辑了 '}
            <strong>{weeklySummary.lesson_plan_edits} 份教案</strong>
            {'，批改了 '}
            <strong>{weeklySummary.submissions_graded} 份答卷</strong>
          </>
        )}
      </div>

      <style>{`
        .hero { margin-bottom: 28px; }
        .hero-title {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.6px;
          line-height: 1.2;
          margin-bottom: 4px;
          color: var(--t1);
        }
        @media (min-width: 1200px) {
          .hero-title { font-size: 28px; letter-spacing: -0.7px; }
        }
        .hero-sub {
          font-size: 13px;
          color: var(--t3);
          line-height: 1.5;
        }
        .hero-sub strong {
          color: var(--t2);
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}
