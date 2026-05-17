import type { ObserveData } from '../ObserveDrawer'
import { qColor, qLabel } from '../observe-helpers'

interface RubricStat {
  id: string; label: string; avgScore: number
  distribution: Record<number, number>
}

interface StudentEntry {
  id: string; name: string; score: number
  images: string[]
  rubricResults: Array<{ id: string; label: string; score: number; comment: string }>
  feedback: string
  keyInsights: string[]
}

interface ImageUploadData {
  stats: {
    totalStudents: number; submitted: number; avgScore: number
    perfectCount: number; pendingReview: number
  }
  rubricStats: RubricStat[]
  students: StudentEntry[]
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function ImageUploadClassView({ data, onStudentSelect }: Props) {
  const d = data as unknown as ImageUploadData
  const stats = d.stats || {} as ImageUploadData['stats']
  const rubricStats = d.rubricStats || []
  const students = d.students || []

  const total = stats.totalStudents ?? 0
  const submitted = stats.submitted ?? 0

  return (
    <>
      {/* Health cards */}
      <div className="obs-health">
        <div className="hcard green">
          <div className="hcard-lb">已提交</div>
          <div className="hcard-v">{submitted}/{total}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均分</div>
          <div className="hcard-v">{Math.round(stats.avgScore ?? 0)}</div>
          <div className="hcard-sub">满分 100</div>
        </div>
        <div className="hcard green">
          <div className="hcard-lb">满分</div>
          <div className="hcard-v">{stats.perfectCount ?? 0}</div>
        </div>
        {(stats.pendingReview ?? 0) > 0 && (
          <div className="hcard warn">
            <div className="hcard-lb">待批阅</div>
            <div className="hcard-v">{stats.pendingReview}</div>
          </div>
        )}
      </div>

      {/* Rubric breakdown */}
      {rubricStats.length > 0 && (
        <div>
          <div className="m2-section-h">评分维度分析</div>
          {rubricStats.map(rs => {
            const gradedCount = Object.values(rs.distribution).reduce((a, b) => a + b, 0)
            return (
              <div key={rs.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>{rs.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: rs.avgScore >= 2.5 ? 'var(--green)' : rs.avgScore >= 1.5 ? 'var(--blue)' : 'var(--amber)' }}>
                    {rs.avgScore.toFixed(1)}/3
                  </span>
                </div>
                {/* Distribution bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {[3, 2, 1, 0].map(q => {
                    const cnt = rs.distribution[q] || 0
                    const pctVal = gradedCount > 0 ? (cnt / gradedCount) * 100 : 0
                    return (
                      <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 600, color: qColor(q), width: 24 }}>{qLabel(q)}</span>
                        <div style={{ flex: 1, height: 12, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${pctVal}%`, height: '100%', borderRadius: 3, background: qColor(q), opacity: .7 }} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t2)', width: 18, textAlign: 'right' }}>{cnt}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">全部学生</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>学生</th>
                <th>得分</th>
                <th>关键发现</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.score >= 80 ? 'var(--green)' : s.score >= 50 ? 'var(--blue)' : 'var(--amber)' }}>
                      {s.score}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(s.keyInsights || []).map((ins, i) => (
                        <span key={i} style={{
                          fontSize: 9, padding: '2px 6px', borderRadius: 3,
                          background: ins.startsWith('✓') ? 'var(--green-soft)' : ins.startsWith('缺失') ? 'var(--red-soft)' : 'var(--amber-soft)',
                          color: ins.startsWith('✓') ? 'var(--green)' : ins.startsWith('缺失') ? 'var(--red)' : 'var(--amber)',
                          fontWeight: 600,
                        }}>{ins}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
