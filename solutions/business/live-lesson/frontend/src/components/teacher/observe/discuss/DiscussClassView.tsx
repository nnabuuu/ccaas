import type { ObserveData } from '../ObserveDrawer'

interface DiscussData extends ObserveData {
  stats: { totalStudents: number; discussedCount: number; goalReachedCount: number; avgRounds: number; avgTime: number }
  students: Array<{
    id: string; name: string; method: 'socratic' | 'fallback'
    goalReached: boolean; roundsUsed: number; timeUsedSeconds: number
    keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function DiscussClassView({ data, onStudentSelect }: Props) {
  const d = data as DiscussData
  const stats = d.stats || {} as DiscussData['stats']
  const students = d.students || []

  return (
    <div className="observe-body">
      {/* Health cards */}
      <div className="obs-health">
        <div className="hcard">
          <div className="hcard-lb">参与讨论</div>
          <div className="hcard-v">{stats.discussedCount ?? 0}/{stats.totalStudents ?? 0}</div>
        </div>
        <div className="hcard good">
          <div className="hcard-lb">达成目标</div>
          <div className="hcard-v">{stats.goalReachedCount ?? 0}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均轮次</div>
          <div className="hcard-v">{stats.avgRounds != null ? stats.avgRounds.toFixed(1) : '—'}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均用时</div>
          <div className="hcard-v">{stats.avgTime != null ? `${Math.round(stats.avgTime)}s` : '—'}</div>
        </div>
      </div>

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">学生讨论状态</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>方式</th>
                <th>达标</th>
                <th>轮次</th>
                <th>用时</th>
                <th>关键发现</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ fontSize: 10 }}>{s.method === 'socratic' ? '苏格拉底' : '自由讨论'}</td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                      background: s.goalReached ? 'var(--green-soft)' : 'var(--surface2)',
                      color: s.goalReached ? 'var(--green)' : 'var(--t3)',
                    }}>{s.goalReached ? '✓' : '—'}</span>
                  </td>
                  <td>{s.roundsUsed ?? '—'}</td>
                  <td>{s.timeUsedSeconds ? `${Math.round(s.timeUsedSeconds)}s` : '—'}</td>
                  <td style={{ fontSize: 10 }}>{(s.keyInsights || []).join('; ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
