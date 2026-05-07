import type { ObserveData } from '../ObserveDrawer'
import { formatTime, pct } from '../observe-helpers'

interface DiscussData extends ObserveData {
  stats: {
    totalStudents: number; discussedCount: number; goalReachedCount: number
    fallbackCount: number; avgRounds: number; medianTime: number; avgTime: number
    misconceptionCount: number
  }
  students: Array<{
    id: string; name: string; method: 'socratic' | 'fallback'
    goalReached: boolean; roundsUsed: number; timeUsedSeconds: number
    completionType: string
    keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function DiscussClassView({ data, onStudentSelect }: Props) {
  const d = data as DiscussData
  const stats = (d.stats || {}) as DiscussData['stats']
  const students = d.students || []

  const total = stats.totalStudents ?? 0
  const goalPct = total > 0 ? Math.round(((stats.goalReachedCount ?? 0) / total) * 100) : 0

  // Derive fallback pass/fail from student data
  const fallbackStudents = students.filter(s => s.method === 'fallback' || s.completionType === 'fallback_rounds')
  const fallbackPass = fallbackStudents.filter(s => s.goalReached).length
  const fallbackFail = fallbackStudents.length - fallbackPass

  // Funnel segments
  const reachedCount = students.filter(s => s.goalReached && s.completionType !== 'fallback_rounds' && s.method !== 'fallback').length
  const fallbackCount = students.filter(s => s.completionType === 'fallback_rounds' || (s.method === 'fallback' && s.goalReached)).length
  const failedCount = Math.max(0, students.length - reachedCount - fallbackCount)
  const funnelTotal = students.length || 1

  return (
    <>
      {/* Health cards */}
      <div className="obs-health">
        <div className="hcard green">
          <div className="hcard-lb">对话达标</div>
          <div className="hcard-v">{stats.goalReachedCount ?? 0}/{total}</div>
          <div className="hcard-sub">{goalPct}%达成</div>
        </div>
        <div className="hcard warn">
          <div className="hcard-lb">兜底选择题</div>
          <div className="hcard-v">{stats.fallbackCount ?? 0}</div>
          <div className="hcard-sub">答对{fallbackPass} / 答错{fallbackFail}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均轮次</div>
          <div className="hcard-v">{stats.avgRounds != null ? stats.avgRounds.toFixed(1) : '—'}</div>
          <div className="hcard-sub">中位用时 {stats.medianTime != null ? formatTime(stats.medianTime) : '—'}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">误解聚类</div>
          <div className="hcard-v">{stats.misconceptionCount || 0}</div>
        </div>
      </div>

      {/* Result funnel */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">结果分布</div>
          <div className="obs-funnel">
            {reachedCount > 0 && (
              <div
                className="obs-funnel-seg reached"
                style={{ width: pct(reachedCount, funnelTotal) }}
              >
                {reachedCount / funnelTotal >= 0.1 ? reachedCount : ''}
              </div>
            )}
            {fallbackCount > 0 && (
              <div
                className="obs-funnel-seg fallback"
                style={{ width: pct(fallbackCount, funnelTotal) }}
              >
                {fallbackCount / funnelTotal >= 0.1 ? fallbackCount : ''}
              </div>
            )}
            {failedCount > 0 && (
              <div
                className="obs-funnel-seg failed"
                style={{ width: pct(failedCount, funnelTotal) }}
              >
                {failedCount / funnelTotal >= 0.1 ? failedCount : ''}
              </div>
            )}
          </div>
          <div className="obs-funnel-legend">
            <div className="obs-funnel-legend-item">
              <span className="dot" style={{ background: 'var(--green-dot)' }} />
              达标 {reachedCount}
            </div>
            <div className="obs-funnel-legend-item">
              <span className="dot" style={{ background: 'var(--amber-dot)' }} />
              兜底 {fallbackCount}
            </div>
            <div className="obs-funnel-legend-item">
              <span className="dot" style={{ background: 'var(--red)' }} />
              未达标 {failedCount}
            </div>
          </div>
        </div>
      )}

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">学生讨论状态</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>结果</th>
                <th>方式</th>
                <th>轮次</th>
                <th>用时</th>
                <th>关键发现</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const isFallback = s.completionType === 'fallback_rounds' || s.method === 'fallback'
                const isReached = s.goalReached && !isFallback
                const isFallbackPass = isFallback && s.goalReached
                let badge: { label: string; bg: string; color: string }
                if (isReached) {
                  badge = { label: '✓ 达标', bg: 'var(--green-soft)', color: 'var(--green)' }
                } else if (isFallbackPass || isFallback) {
                  badge = { label: '△ 兜底', bg: 'var(--amber-soft)', color: 'var(--amber)' }
                } else {
                  badge = { label: '✗ 未达标', bg: 'var(--red-soft)', color: 'var(--red)' }
                }

                return (
                  <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>
                      <span style={{
                        fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
                        background: badge.bg, color: badge.color,
                      }}>{badge.label}</span>
                    </td>
                    <td style={{ fontSize: 10 }}>{s.method === 'socratic' ? '苏格拉底' : '选择题'}</td>
                    <td>{s.roundsUsed ?? '—'}</td>
                    <td>{s.timeUsedSeconds ? formatTime(s.timeUsedSeconds) : '—'}</td>
                    <td style={{ fontSize: 10 }}>{(s.keyInsights || []).join('; ') || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
