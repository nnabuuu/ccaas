import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime, pctNum } from '../observe-helpers'

interface EvidenceData extends ObserveData {
  stats: { totalStudents: number; allDone: number; perfectAll: number; evidenceHitRate: number; funcWrongCount: number }
  sections: Array<{
    id: string; label: string; func: string; funcZh?: string
    funcCorrectRate: number; funcCorrectCount: number; funcTotalCount: number
    evidenceBar?: { hit: number; total: number; pct: number }
  }>
  misconceptions: Array<{
    id: string; label: string; count: number; severity: string
    students: Array<{ id: string; name: string }>
  }>
  students: Array<{
    id: string; name: string; completed: boolean; time: number
    sectionResults: Record<string, { perfect: boolean; funcCorrect: boolean; evidenceHit: number; evidenceTotal: number; wrongCount: number }>
    keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

function barColor(rate: number): string {
  if (rate >= 80) return 'var(--green)'
  if (rate >= 50) return 'var(--blue)'
  return 'var(--amber)'
}

export default function EvidenceClassView({ data, onStudentSelect }: Props) {
  const d = data as EvidenceData
  const stats = (d.stats || {}) as EvidenceData['stats']
  const sections = d.sections || []
  const misconceptions = d.misconceptions || []
  const students = d.students || []

  return (
    <>
      {/* Health cards */}
      <div className="obs-health">
        <div className="hcard green">
          <div className="hcard-lb">全部完成</div>
          <div className="hcard-v">{stats.allDone ?? 0}/{stats.totalStudents ?? 0}</div>
        </div>
        <div className="hcard purple">
          <div className="hcard-lb">全 Perfect</div>
          <div className="hcard-v">{stats.perfectAll ?? 0}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">Evidence 命中率</div>
          <div className="hcard-v" style={{ color: scoreColor(stats.evidenceHitRate ?? 0) }}>
            {stats.evidenceHitRate != null ? `${Math.round(stats.evidenceHitRate)}%` : '—'}
          </div>
        </div>
        <div className={`hcard${(stats.funcWrongCount ?? 0) > 0 ? ' red' : ''}`}>
          <div className="hcard-lb">功能判断错误</div>
          <div className="hcard-v">{stats.funcWrongCount ?? 0}</div>
        </div>
      </div>

      {/* Section grid */}
      {sections.length > 0 && (
        <div>
          <div className="m2-section-h">逐 Section 分析</div>
          <div className="obs-section-grid">
            {sections.map((sec) => {
              const rate = sec.evidenceBar?.pct ?? 0
              return (
                <div key={sec.id} className="obs-section-card">
                  <span className="obs-section-tag">{sec.label}</span>
                  <div className="obs-section-func">
                    {sec.func}{sec.funcZh ? ` · ${sec.funcZh}` : ''}
                  </div>
                  <div className="obs-section-metrics">
                    <span>功能正确 {sec.funcCorrectCount}/{sec.funcTotalCount}</span>
                    {sec.evidenceBar && (
                      <span>Evidence {sec.evidenceBar.hit}/{sec.evidenceBar.total} ({sec.evidenceBar.pct}%)</span>
                    )}
                  </div>
                  {sec.evidenceBar && (
                    <div className="obs-section-bar">
                      <div
                        className="obs-section-bar-fill"
                        style={{ width: `${rate}%`, background: barColor(rate) }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">学生列表</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>用时</th>
                {sections.map(sec => (
                  <th key={sec.id}>{sec.label}</th>
                ))}
                <th>完成度</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => {
                const sr = s.sectionResults || {}
                return (
                  <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.time > 0 ? formatTime(s.time) : '—'}</td>
                    {sections.map(sec => {
                      const r = sr[sec.id]
                      if (!r) return <td key={sec.id} style={{ color: 'var(--t3)' }}>—</td>
                      if (r.perfect) {
                        return <td key={sec.id} style={{ color: 'var(--green)', fontWeight: 600 }}>✓</td>
                      }
                      return (
                        <td key={sec.id} style={{ color: 'var(--blue)', fontSize: 10 }}>
                          {r.evidenceHit}/{r.evidenceTotal}
                          {r.wrongCount > 0 && <span style={{ color: 'var(--red)', marginLeft: 3 }}>✗{r.wrongCount}</span>}
                        </td>
                      )
                    })}
                    <td>
                      {s.completed
                        ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓</span>
                        : <span style={{ color: 'var(--t3)' }}>
                            {pctNum(Object.keys(sr).length, sections.length)}%
                          </span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Misconceptions */}
      {misconceptions.length > 0 && (
        <div>
          <div className="m2-section-h">误解模式</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {misconceptions.map(m => (
              <div key={m.id} className={`misc-card${m.severity === 'high' ? ' high' : ''}`}>
                <div className="misc-label">{m.label}</div>
                <div className="misc-count">{m.count} 人</div>
                <div className="misc-students">
                  {(m.students || []).map(s => (
                    <span
                      key={s.id}
                      className="sdot sm"
                      style={{ background: 'var(--amber-dot)', color: '#fff', cursor: 'pointer' }}
                      onClick={() => onStudentSelect(s.id)}
                    >{s.name.substring(0, 3)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
