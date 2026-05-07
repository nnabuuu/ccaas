import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime } from '../observe-helpers'

interface MapData extends ObserveData {
  stats: { totalStudents: number; submitted: number; avgDeviation: number; reasonedCount: number }
  items: Array<{
    id: string; label: string; expected?: [number, number]
    studentPlacements: Array<{ studentId: string; studentName: string; x: number; y: number; deviation: number }>
  }>
  misconceptions: Array<{ id: string; label: string; count: number; severity: string }>
  students: Array<{
    id: string; name: string; placed: number; reasoned: boolean; avgDeviation: number
  }>
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function MapClassView({ data, onStudentSelect }: Props) {
  const d = data as MapData
  const stats = d.stats || {} as MapData['stats']
  const items = d.items || []
  const misconceptions = d.misconceptions || []
  const students = d.students || []

  return (
    <div className="observe-body">
      {/* Health cards */}
      <div className="obs-health">
        <div className="hcard">
          <div className="hcard-lb">已提交</div>
          <div className="hcard-v">{stats.submitted ?? 0}/{stats.totalStudents ?? 0}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均偏差</div>
          <div className="hcard-v">{stats.avgDeviation != null ? stats.avgDeviation.toFixed(1) : '—'}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">写了 Reasoning</div>
          <div className="hcard-v">{stats.reasonedCount ?? 0}</div>
        </div>
      </div>

      {/* Item placement overview */}
      {items.length > 0 && (
        <div>
          <div className="m2-section-h">项目放置分布</div>
          {items.map((item) => (
            <div key={item.id} style={{
              padding: '10px 12px', marginBottom: 6, borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                预期: ({item.expected?.[0]?.toFixed(1)}, {item.expected?.[1]?.toFixed(1)})
              </div>
              {(item.studentPlacements || []).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                  {item.studentPlacements.map((sp) => (
                    <span
                      key={sp.studentId}
                      className="sdot sm"
                      style={{
                        background: sp.deviation < 1 ? 'var(--green-dot)' : sp.deviation < 2 ? 'var(--amber-dot)' : 'var(--red)',
                        color: '#fff', cursor: 'pointer',
                      }}
                      title={`${sp.studentName}: (${sp.x?.toFixed(1)}, ${sp.y?.toFixed(1)}) 偏差${sp.deviation?.toFixed(1)}`}
                      onClick={() => onStudentSelect(sp.studentId)}
                    >{sp.studentName?.substring(0, 3)}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Misconceptions */}
      {misconceptions.length > 0 && (
        <div>
          <div className="m2-section-h">误解模式</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {misconceptions.map((m) => (
              <div key={m.id} className={`misc-card${m.severity === 'high' ? ' high' : ''}`}>
                <div className="misc-label">{m.label}</div>
                <div className="misc-count">{m.count} 人</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">学生列表</div>
          <table className="obs-table">
            <thead><tr><th>姓名</th><th>已放置</th><th>Reasoning</th><th>偏差</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.placed ?? 0}</td>
                  <td>{s.reasoned ? '✓' : '—'}</td>
                  <td>{s.avgDeviation != null ? s.avgDeviation.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
