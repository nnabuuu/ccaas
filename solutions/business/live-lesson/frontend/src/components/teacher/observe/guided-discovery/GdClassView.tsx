import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime } from '../observe-helpers'
import type { GdData } from './gd-types'

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function GdClassView({ data, onStudentSelect }: Props) {
  const d = data as GdData
  const stats = d.stats || {} as GdData['stats']
  const stepStats = d.stepStats || []
  const students = d.students || []

  return (
    <>
      {/* Health Cards */}
      <div className="obs-health">
        <div className="hcard">
          <div className="hcard-lb">已提交</div>
          <div className="hcard-v">{stats.submitted ?? 0}/{stats.totalStudents ?? 0}</div>
        </div>
        <div className="hcard green">
          <div className="hcard-lb">平均分</div>
          <div className="hcard-v">{stats.avgScore ?? 0}%</div>
        </div>
        <div className="hcard purple">
          <div className="hcard-lb">全对人数</div>
          <div className="hcard-v">{stats.perfectCount ?? 0}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均用时</div>
          <div className="hcard-v">{formatTime(stats.avgTime ?? 0)}</div>
        </div>
      </div>

      {/* Step Accuracy Cards */}
      <div className="obs-section">
        <div className="m2-section-h">各步骤正确率</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {stepStats.map((ss, i) => (
            <div key={ss.id} style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  background: 'var(--t3)', borderRadius: 4, padding: '1px 6px',
                }}>Step {i + 1}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ss.title}
                </span>
              </div>
              {/* Pass rate bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${ss.passedRate}%`, height: '100%', borderRadius: 3,
                    background: scoreColor(ss.passedRate), transition: 'width .3s',
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(ss.passedRate), flexShrink: 0 }}>
                  {ss.passedRate}%
                </span>
              </div>
              {/* Errors */}
              {ss.errors.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ss.errors.slice(0, 3).map((err, ei) => (
                    <div key={ei} style={{
                      fontSize: 10, lineHeight: 1.4, color: 'var(--t2)',
                      padding: '4px 6px', background: 'var(--red-soft)', borderRadius: 4,
                      borderLeft: '2px solid var(--red)',
                    }}>
                      <span style={{ fontWeight: 600, color: 'var(--red)' }}>{err.count}人 </span>
                      {err.description}
                      <div className="obs-chip-grid" style={{ marginTop: 3 }}>
                        {err.students.slice(0, 5).map(s => (
                          <span key={s.id}
                            className="obs-student-chip alert"
                            style={{ cursor: 'pointer', fontSize: 9 }}
                            onClick={() => onStudentSelect(s.id)}
                          >{s.name}</span>
                        ))}
                        {err.students.length > 5 && (
                          <span style={{ fontSize: 9, color: 'var(--t3)' }}>+{err.students.length - 5}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Student Table */}
      <div className="obs-section">
        <div className="m2-section-h">全部学生</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--t3)', fontSize: 10 }}>姓名</th>
                {stepStats.map((_, i) => (
                  <th key={i} style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600, color: 'var(--t3)', fontSize: 10 }}>
                    S{i + 1}
                  </th>
                ))}
                <th style={{ textAlign: 'center', padding: '6px 8px', fontWeight: 600, color: 'var(--t3)', fontSize: 10 }}>得分</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                  onClick={() => onStudentSelect(s.id)}
                >
                  <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--t1)' }}>
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: 6,
                      background: s.submitted ? 'var(--green-dot)' : 'var(--t3)',
                    }} />
                    {s.name}
                  </td>
                  {stepStats.map(ss => {
                    if (!s.submitted) return <td key={ss.id} style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--t3)' }}>—</td>
                    const ok = s.stepResults?.[ss.id]
                    return (
                      <td key={ss.id} style={{
                        textAlign: 'center', padding: '5px 4px', fontWeight: 600,
                        color: ok ? 'var(--green)' : 'var(--red)',
                      }}>
                        {ok ? '\u2713' : '\u2717'}
                      </td>
                    )
                  })}
                  <td style={{
                    textAlign: 'center', padding: '5px 8px', fontWeight: 700,
                    color: s.submitted ? scoreColor(s.score) : 'var(--t3)',
                  }}>
                    {s.submitted ? `${Math.round(s.score)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
