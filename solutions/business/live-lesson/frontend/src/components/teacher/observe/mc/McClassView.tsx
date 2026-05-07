import { useState } from 'react'
import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime } from '../observe-helpers'

interface McData extends ObserveData {
  stats: {
    totalStudents: number; submitted: number; avgScore: number
    perfectCount: number; zeroCount: number
    avgTime: number; fastestTime: number; slowestTime: number
  }
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

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export default function McClassView({ data, onStudentSelect }: Props) {
  const d = data as McData
  const stats = (d.stats || {}) as McData['stats']
  const questions = d.questions || []
  const misconceptions = d.misconceptions || []
  const students = d.students || []
  const totalQ = questions.length

  const [expandedQ, setExpandedQ] = useState<number | null>(null)

  const correctCount = totalQ > 0
    ? Math.round((stats.avgScore / 100) * totalQ)
    : 0

  const toggleQ = (idx: number) => {
    setExpandedQ(prev => prev === idx ? null : idx)
  }

  return (
    <>
      {/* Health Cards */}
      <div className="obs-health">
        <div className="hcard green">
          <div className="hcard-lb">班级正确率</div>
          <div className="hcard-v">{Math.round(stats.avgScore ?? 0)}%</div>
          <div className="hcard-sub">avg {correctCount}/{totalQ}</div>
        </div>
        <div className="hcard purple">
          <div className="hcard-lb">满分人数</div>
          <div className="hcard-v">{stats.perfectCount ?? 0}</div>
          <div className="hcard-sub">{stats.zeroCount ?? 0} 人零分</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">平均用时</div>
          <div className="hcard-v">{formatTime(stats.avgTime ?? 0)}</div>
          <div className="hcard-sub">最快 {formatTime(stats.fastestTime ?? 0)} / 最慢 {formatTime(stats.slowestTime ?? 0)}</div>
        </div>
        <div className="hcard">
          <div className="hcard-lb">误解模式</div>
          <div className="hcard-v">{misconceptions.length}</div>
        </div>
      </div>

      {/* Expandable Q-cards */}
      <div className="obs-section">
        <div className="m2-section-h">逐题分布</div>
        {questions.map(q => {
          const isExpanded = expandedQ === q.idx
          const wrongStudents = students.filter(s => {
            const a = s.answers?.[q.idx] || s.answers?.[String(q.idx)]
            return a && !a.correct
          })

          return (
            <div key={q.idx} className="obs-q-card">
              <div className="obs-q-head" onClick={() => toggleQ(q.idx)}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Q{q.idx + 1}</span>
                {q.tag && <span className="obs-q-tag">{q.tag}</span>}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, margin: '0 8px' }}>
                  <div style={{ flex: 1, height: 5, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${q.correctRate ?? 0}%`,
                      height: '100%',
                      borderRadius: 3,
                      background: scoreColor(q.correctRate ?? 0),
                      transition: 'width .3s',
                    }} />
                  </div>
                </div>
                <span className="obs-q-rate" style={{ color: scoreColor(q.correctRate ?? 0) }}>
                  {Math.round(q.correctRate ?? 0)}%
                </span>
                <span className={`obs-q-chevron${isExpanded ? ' open' : ''}`}>&#9654;</span>
              </div>

              {isExpanded && (
                <div className="obs-q-body">
                  {q.stem && (
                    <div style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.4, marginBottom: 4 }}>{q.stem}</div>
                  )}
                  {(q.options || []).map((opt, oi) => {
                    const dist = q.distribution?.[oi]
                    const isCorrect = oi === q.correctIdx
                    return (
                      <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="opt-label">{LETTERS[oi]}</span>
                        <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 3, height: 16, overflow: 'hidden' }}>
                          <div
                            className={`opt-fill ${isCorrect ? 'correct' : 'wrong'}`}
                            style={{ width: `${dist?.pct ?? 0}%` }}
                          >
                            {(dist?.pct ?? 0) > 8 ? `${dist?.pct}%` : ''}
                          </div>
                        </div>
                        <span className="opt-pct">{dist?.count ?? 0}</span>
                      </div>
                    )
                  })}
                  {wrongStudents.length > 0 && (
                    <div className="obs-q-students">
                      {wrongStudents.map(s => {
                        const a = s.answers?.[q.idx] || s.answers?.[String(q.idx)]
                        const letter = a && a.selected >= 0 && a.selected < 26 ? LETTERS[a.selected] : '?'
                        return (
                          <span key={s.id}
                            className="obs-student-chip alert"
                            style={{ cursor: 'pointer' }}
                            onClick={() => onStudentSelect(s.id)}
                          >{s.name} → {letter}</span>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Student Table */}
      <div className="obs-section">
        <div className="m2-section-h">学生答题</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: 'var(--t3)', fontSize: 10 }}>姓名</th>
                <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600, color: 'var(--t3)', fontSize: 10 }}>用时</th>
                {questions.map(q => (
                  <th key={q.idx} style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 600, color: 'var(--t3)', fontSize: 10 }}>
                    Q{q.idx + 1}
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
                  <td style={{ padding: '5px 8px', fontWeight: 600, color: 'var(--t1)' }}>{s.name}</td>
                  <td style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--t3)', fontSize: 10 }}>
                    {formatTime(s.time ?? 0)}
                  </td>
                  {questions.map(q => {
                    const a = s.answers?.[q.idx] || s.answers?.[String(q.idx)]
                    if (!a) return <td key={q.idx} style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--t3)' }}>—</td>
                    if (a.changed) return (
                      <td key={q.idx} style={{ textAlign: 'center', padding: '5px 4px', color: 'var(--amber)', fontWeight: 600 }}>&#8634;</td>
                    )
                    return (
                      <td key={q.idx} style={{
                        textAlign: 'center', padding: '5px 4px', fontWeight: 600,
                        color: a.correct ? 'var(--green)' : 'var(--red)',
                      }}>
                        {a.correct ? '\u2713' : '\u2717'}
                      </td>
                    )
                  })}
                  <td style={{
                    textAlign: 'center', padding: '5px 8px', fontWeight: 700,
                    color: scoreColor(s.score ?? 0),
                  }}>
                    {Math.round(s.score ?? 0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Misconception Cards */}
      {misconceptions.length > 0 && (
        <div className="obs-section">
          <div className="m2-section-h warn">误解模式</div>
          <div className="obs-misconceptions">
            {misconceptions.map(m => (
              <div key={m.id} className="obs-misconception-card"
                style={m.severity === 'high' ? { background: 'var(--red-soft)', borderLeftColor: 'var(--red)' } : undefined}
              >
                <div className="obs-mc-head">
                  <span className={`obs-severity ${m.severity}`}>{m.severity}</span>
                  <span className="obs-mc-label">{m.label}</span>
                  <span className="obs-mc-count">{m.count} 人</span>
                </div>
                <div className="obs-chip-grid" style={{ marginTop: 6 }}>
                  {(m.students || []).map(s => (
                    <span key={s.id}
                      className="obs-student-chip warn"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onStudentSelect(s.id)}
                    >{s.name}</span>
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
