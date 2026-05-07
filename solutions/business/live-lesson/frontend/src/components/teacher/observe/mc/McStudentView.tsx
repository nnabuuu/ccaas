import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime } from '../observe-helpers'

interface McStudentData extends ObserveData {
  stats: { avgScore: number; avgTime: number }
  questions: Array<{ idx: number; stem: string; correctIdx: number }>
  students: Array<{
    id: string; name: string; score: number; time: number
    answers: Record<string | number, { selected: number; correct: boolean; changed: boolean; timeSpent: number }>
    keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  studentId: string
  onBack: () => void
}

export default function McStudentView({ data, studentId, onBack }: Props) {
  const d = data as McStudentData
  const students = d.students || []
  const student = students.find(s => s.id === studentId)
  const questions = d.questions || []
  const stats = d.stats || {} as McStudentData['stats']

  if (!student) {
    return (
      <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
        <button className="observe-band-close" onClick={onBack}>返回</button>
      </div>
    )
  }

  const answers = student.answers || {}

  return (
    <div className="observe-split">
      {/* Left: per-question detail */}
      <div className="observe-split-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button className="observe-band-close" onClick={onBack} style={{ padding: '4px 8px', fontSize: 11 }}>← 返回</button>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{student.name}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor(student.score), marginLeft: 'auto' }}>
            {Math.round(student.score)}%
          </span>
        </div>

        <div className="m2-section-h">逐题详情</div>
        {questions.map(q => {
          const a = answers[q.idx] || answers[String(q.idx)]
          const isCorrect = a?.correct
          return (
            <div key={q.idx} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: isCorrect ? 'var(--green-soft)' : a ? 'var(--red-soft)' : 'var(--surface)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Q{q.idx + 1}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: isCorrect ? 'var(--green)' : 'var(--red)' }}>
                  {isCorrect ? '✓' : a ? '✗' : '—'}
                </span>
                {a?.changed && <span style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 500 }}>改过答案</span>}
                {a?.timeSpent > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>
                    {formatTime(a.timeSpent)}
                  </span>
                )}
              </div>
              {q.stem && <div style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.4 }}>{q.stem}</div>}
              {a && (
                <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 4 }}>
                  选择: <strong>{String.fromCharCode(65 + a.selected)}</strong>
                  {!isCorrect && q.correctIdx != null && (
                    <span style={{ color: 'var(--green)', marginLeft: 8 }}>
                      正确: {String.fromCharCode(65 + q.correctIdx)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Right: key insights + class comparison */}
      <div className="observe-split-right">
        <div className="m2-section-h">关键发现</div>
        {(student.keyInsights || []).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
            {student.keyInsights.map((insight: string, i: number) => (
              <div key={i} style={{
                fontSize: 11, color: 'var(--t2)', lineHeight: 1.4,
                padding: '6px 8px', background: 'var(--bg)', borderRadius: 5,
                borderLeft: '2px solid var(--amber-dot)',
              }}>{insight}</div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 16 }}>暂无</div>
        )}

        <div className="m2-section-h">班级对比</div>
        <div className="class-compare">
          <div className="cc-row">
            <span className="cc-label">得分</span>
            <div className="cc-bar-wrap">
              <div className="cc-bar-bg" />
              <div className="cc-bar-class" style={{ width: `${stats.avgScore ?? 0}%` }} />
              <div className="cc-bar-student" style={{ width: `${student.score}%`, background: scoreColor(student.score) }} />
            </div>
            <span className="cc-val">{Math.round(student.score)}%</span>
          </div>
          {student.time > 0 && stats.avgTime > 0 && (
            <div className="cc-row">
              <span className="cc-label">用时</span>
              <div className="cc-bar-wrap">
                <div className="cc-bar-bg" />
                <div className="cc-bar-class" style={{ width: `${Math.min(100, (stats.avgTime / Math.max(stats.avgTime, student.time)) * 100)}%` }} />
                <div className="cc-bar-student" style={{ width: `${Math.min(100, (student.time / Math.max(stats.avgTime, student.time)) * 100)}%`, background: 'var(--blue)' }} />
              </div>
              <span className="cc-val">{formatTime(student.time)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
