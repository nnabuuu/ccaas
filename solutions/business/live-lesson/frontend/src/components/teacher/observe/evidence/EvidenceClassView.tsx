import type { ObserveData } from '../ObserveDrawer'
import { scoreColor } from '../observe-helpers'

interface EvidenceData extends ObserveData {
  stats: { totalStudents: number; allDone: number; perfectAll: number; evidenceHitRate: number; funcWrongCount: number }
  sections: Array<{
    id: string; label: string; func: string; funcZh?: string
    funcCorrectRate: number; evidenceBar?: { hit: number; total: number; pct: number }
  }>
  misconceptions: Array<{
    id: string; label: string; count: number; severity: string
    students: Array<{ id: string; name: string }>
  }>
  students: Array<{
    id: string; name: string; completed: boolean; keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function EvidenceClassView({ data, onStudentSelect }: Props) {
  const d = data as EvidenceData
  const stats = d.stats || {} as EvidenceData['stats']
  const sections = d.sections || []
  const misconceptions = d.misconceptions || []
  const students = d.students || []

  return (
    <div className="observe-body">
      {/* Health cards */}
      <div className="obs-health">
        <div className="hcard">
          <div className="hcard-lb">已完成</div>
          <div className="hcard-v">{stats.allDone ?? 0}/{stats.totalStudents ?? 0}</div>
        </div>
        <div className="hcard good">
          <div className="hcard-lb">全部正确</div>
          <div className="hcard-v">{stats.perfectAll ?? 0}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">Evidence 命中率</div>
          <div className="hcard-v" style={{ color: scoreColor(stats.evidenceHitRate ?? 0) }}>
            {stats.evidenceHitRate != null ? `${Math.round(stats.evidenceHitRate)}%` : '—'}
          </div>
        </div>
        <div className={`hcard${(stats.funcWrongCount ?? 0) > 0 ? ' warn' : ''}`}>
          <div className="hcard-lb">功能判断错误</div>
          <div className="hcard-v">{stats.funcWrongCount ?? 0}</div>
        </div>
      </div>

      {/* Per-section breakdown */}
      {sections.length > 0 && (
        <div>
          <div className="m2-section-h">逐 Section 分析</div>
          {sections.map((sec) => (
            <div key={sec.id} style={{
              padding: '10px 12px', marginBottom: 6, borderRadius: 8,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{sec.label}</span>
                <span style={{ fontSize: 9, color: 'var(--t3)' }}>{sec.funcZh || sec.func}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: scoreColor(sec.funcCorrectRate ?? 0) }}>
                  功能 {Math.round(sec.funcCorrectRate ?? 0)}%
                </span>
              </div>
              {sec.evidenceBar && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: 'var(--t3)', width: 60, flexShrink: 0 }}>Evidence</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${sec.evidenceBar.pct ?? 0}%`, height: '100%', background: 'var(--blue)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--t3)', width: 36, textAlign: 'right' }}>
                    {sec.evidenceBar.hit}/{sec.evidenceBar.total}
                  </span>
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
                <div className="misc-students">
                  {(m.students || []).map((s) => (
                    <span key={s.id} className="sdot sm" style={{ background: 'var(--amber-dot)', color: '#fff', cursor: 'pointer' }}
                      onClick={() => onStudentSelect(s.id)}>{s.name.substring(0, 3)}</span>
                  ))}
                </div>
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
            <thead><tr><th>姓名</th><th>完成</th><th>关键发现</th></tr></thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.completed ? '✓' : '—'}</td>
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
