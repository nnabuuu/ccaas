import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime } from '../observe-helpers'

interface McData extends ObserveData {
  stats: { totalStudents: number; submitted: number; avgScore: number; perfectCount: number; zeroCount: number; avgTime: number }
  questions: Array<{
    idx: number; stem: string; tag?: string; options: string[]
    correctIdx: number; distribution: Array<{ count: number; pct: number }>
    correctRate: number
  }>
  misconceptions: Array<{
    id: string; label: string; count: number; severity: string
    students: Array<{ id: string; name: string }>
  }>
  students: Array<{
    id: string; name: string; score: number; time: number
    answers: Record<string, { selected: number; correct: boolean; changed: boolean; timeSpent: number }>
    keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  onStudentSelect: (studentId: string) => void
}

export default function McClassView({ data, onStudentSelect }: Props) {
  const d = data as McData
  const stats = d.stats || {} as McData['stats']
  const questions = d.questions || []
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
          <div className="hcard-lb">平均正确率</div>
          <div className="hcard-v" style={{ color: scoreColor(stats.avgScore ?? 0) }}>
            {stats.avgScore != null ? `${Math.round(stats.avgScore)}%` : '—'}
          </div>
        </div>
        <div className="hcard good">
          <div className="hcard-lb">全对</div>
          <div className="hcard-v">{stats.perfectCount ?? 0}</div>
        </div>
        <div className={`hcard${(stats.zeroCount ?? 0) > 0 ? ' warn' : ''}`}>
          <div className="hcard-lb">零分</div>
          <div className="hcard-v">{stats.zeroCount ?? 0}</div>
        </div>
      </div>

      {/* Per-question option distribution */}
      {questions.length > 0 && (
        <div>
          <div className="m2-section-h">逐题分布</div>
          {questions.map(q => (
            <div key={q.idx} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                Q{q.idx + 1}
                {q.tag && <span style={{ fontSize: 9, color: 'var(--t3)', fontWeight: 400 }}>{q.tag}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 600, color: scoreColor(q.correctRate) }}>
                  {Math.round(q.correctRate)}%
                </span>
              </div>
              {q.stem && <div style={{ fontSize: 10, color: 'var(--t2)', marginBottom: 4, lineHeight: 1.4 }}>{q.stem}</div>}
              {(q.distribution || []).map((opt, oi) => {
                const isCorrect = oi === q.correctIdx
                return (
                  <div className="opt-bar" key={oi}>
                    <span className="opt-label">{String.fromCharCode(65 + oi)}</span>
                    <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 3, height: 16, overflow: 'hidden' }}>
                      <div
                        className={`opt-fill ${isCorrect ? 'correct' : 'wrong'}`}
                        style={{ width: `${opt.pct}%` }}
                      >
                        {opt.count > 0 ? opt.count : ''}
                      </div>
                    </div>
                    <span className="opt-pct">{Math.round(opt.pct)}%</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Misconception clusters */}
      {misconceptions.length > 0 && (
        <div>
          <div className="m2-section-h">误解模式</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {misconceptions.map(m => (
              <div key={m.id} className={`misc-card${m.severity === 'high' ? ' high' : ''}`}>
                <div className="misc-label">{m.label}</div>
                <div className="misc-count">{m.count} 人</div>
                <div className="misc-students">
                  {m.students.map(s => (
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

      {/* Student table */}
      {students.length > 0 && (
        <div>
          <div className="m2-section-h">学生列表</div>
          <table className="obs-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>得分</th>
                <th>用时</th>
                <th>关键发现</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.id} onClick={() => onStudentSelect(s.id)}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ color: scoreColor(s.score) }}>{Math.round(s.score)}%</td>
                  <td>{s.time > 0 ? formatTime(s.time) : '—'}</td>
                  <td style={{ fontSize: 10 }}>
                    {(s.keyInsights || []).join('; ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
