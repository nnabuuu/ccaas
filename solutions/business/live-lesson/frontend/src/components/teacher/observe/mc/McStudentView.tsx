import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime, statusLevel } from '../observe-helpers'

interface McStudentData extends ObserveData {
  stats: { avgScore: number; avgTime: number }
  questions: Array<{
    idx: number; stem: string; tag?: string; options: string[]
    correctIdx: number
  }>
  students: Array<{
    id: string; name: string; score: number; time: number
    answers: Record<string | number, { selected: number; correct: boolean; changed: boolean; timeSpent: number }>
    keyInsights: string[]
  }>
}

interface Props {
  data: ObserveData
  studentId: string
  onBack?: () => void
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export default function McStudentView({ data, studentId }: Props) {
  const d = data as McStudentData
  const students = d.students || []
  const student = students.find(s => s.id === studentId)
  const questions = d.questions || []
  const stats = (d.stats || {}) as McStudentData['stats']

  if (!student) {
    return (
      <div className="observe-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
      </div>
    )
  }

  const answers = student.answers || {}
  const totalQ = questions.length
  const correctQ = questions.filter(q => {
    const a = answers[q.idx] || answers[String(q.idx)]
    return a?.correct
  }).length
  const changedCount = questions.filter(q => {
    const a = answers[q.idx] || answers[String(q.idx)]
    return a?.changed
  }).length

  const status = statusLevel(student.score)
  const maxTime = Math.max(...questions.map(q => {
    const a = answers[q.idx] || answers[String(q.idx)]
    return a?.timeSpent ?? 0
  }), 1)

  return (
    <div className="observe-split">
      {/* Left: header + stats + per-question cards */}
      <div className="observe-split-left">
        {/* Score badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: '#fff', marginLeft: 'auto',
            background: scoreColor(student.score), padding: '2px 8px', borderRadius: 4,
          }}>
            {Math.round(student.score)}%
          </span>
        </div>

        {/* Stats Grid */}
        <div className="obs-stats-grid cols-3">
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{correctQ}/{totalQ}</div>
            <div className="obs-stat-lb">得分</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{formatTime(student.time ?? 0)}</div>
            <div className="obs-stat-lb">用时</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{changedCount}</div>
            <div className="obs-stat-lb">改答</div>
          </div>
        </div>

        {/* Per-question cards */}
        <div className="m2-section-h">逐题详情</div>
        {questions.map(q => {
          const a = answers[q.idx] || answers[String(q.idx)]
          const isCorrect = a?.correct
          const opts = q.options || []

          return (
            <div key={q.idx} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: isCorrect ? 'var(--green-soft)' : a ? 'var(--red-soft)' : 'var(--surface)',
              border: `1px solid ${isCorrect ? 'rgba(45,102,18,.15)' : a ? 'rgba(148,41,41,.15)' : 'var(--border)'}`,
            }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Q{q.idx + 1}</span>
                {q.tag && <span className="obs-q-tag">{q.tag}</span>}
                <span style={{ fontSize: 10, fontWeight: 600, color: isCorrect ? 'var(--green)' : a ? 'var(--red)' : 'var(--t3)' }}>
                  {isCorrect ? '\u2713' : a ? '\u2717' : '\u2014'}
                </span>
                {a?.changed && <span style={{ fontSize: 9, color: 'var(--amber)', fontWeight: 600 }}>改过</span>}
                {a?.timeSpent > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--t3)', marginLeft: 'auto' }}>
                    {formatTime(a.timeSpent)}
                  </span>
                )}
              </div>

              {/* Options list */}
              {opts.map((optText, oi) => {
                const isStudentChoice = a && a.selected === oi
                const isCorrectOpt = oi === q.correctIdx
                let optBg = 'transparent'
                let optColor = 'var(--t2)'
                let optWeight = 400
                if (isStudentChoice && isCorrectOpt) {
                  optBg = 'rgba(45,102,18,.12)'
                  optColor = 'var(--green)'
                  optWeight = 600
                } else if (isStudentChoice && !isCorrectOpt) {
                  optBg = 'rgba(148,41,41,.1)'
                  optColor = 'var(--red)'
                  optWeight = 600
                }

                return (
                  <div key={oi} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '2px 6px', borderRadius: 4, marginBottom: 1,
                    background: optBg, fontSize: 10, fontWeight: optWeight, color: optColor,
                  }}>
                    <span style={{ width: 16, fontWeight: 700, flexShrink: 0 }}>{LETTERS[oi]}</span>
                    <span style={{ flex: 1 }}>{optText}</span>
                    {isCorrectOpt && !isStudentChoice && (
                      <span style={{ fontSize: 9, color: 'var(--green)', fontWeight: 600, flexShrink: 0 }}>&larr; 正确</span>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Right: status + time bars + class comparison */}
      <div className="observe-split-right">
        {/* Status Card */}
        <div className={`obs-status-card ${status.level}`}>
          <div className="obs-sc-title">{status.title}</div>
          <div className="obs-sc-body">
            {student.score >= 90 && `${student.name} 全部或接近全部正确，表现优秀。`}
            {student.score >= 70 && student.score < 90 && `${student.name} 大部分题目正确，少数需要关注。`}
            {student.score >= 40 && student.score < 70 && `${student.name} 正确率偏低，多道题目出错，建议针对性辅导。`}
            {student.score < 40 && `${student.name} 正确率很低，需要重点关注和个别辅导。`}
          </div>
        </div>

        {/* Key Insights */}
        {(student.keyInsights || []).length > 0 && (
          <>
            <div className="m2-section-h">关键发现</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {student.keyInsights.map((insight: string, i: number) => (
                <div key={i} style={{
                  fontSize: 11, color: 'var(--t2)', lineHeight: 1.4,
                  padding: '6px 8px', background: 'var(--bg)', borderRadius: 5,
                  borderLeft: '2px solid var(--amber-dot)',
                }}>{insight}</div>
              ))}
            </div>
          </>
        )}

        {/* Per-question Time Bar Chart */}
        <div className="m2-section-h">逐题用时</div>
        <div className="obs-time-bars" style={{ marginBottom: 16 }}>
          {questions.map(q => {
            const a = answers[q.idx] || answers[String(q.idx)]
            const t = a?.timeSpent ?? 0
            const isCorrect = a?.correct
            const barColor = isCorrect ? 'var(--green-dot)' : 'var(--red)'
            const widthPct = maxTime > 0 ? Math.max(2, (t / maxTime) * 100) : 2

            return (
              <div key={q.idx} className="obs-time-bar-row">
                <span className="obs-time-bar-label">Q{q.idx + 1}</span>
                <div style={{ flex: 1 }}>
                  <div className="obs-time-bar" style={{ width: `${widthPct}%`, background: barColor }}>
                    {t > 0 && widthPct > 20 ? formatTime(t) : ''}
                  </div>
                </div>
                <span className="obs-time-bar-val">{t > 0 ? formatTime(t) : '\u2014'}</span>
              </div>
            )
          })}
        </div>

        {/* Class Comparison */}
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
          <div className="cc-legend">
            <div className="cc-legend-item"><div className="d" style={{ background: 'var(--border-strong)', opacity: .5 }} />班级均值</div>
            <div className="cc-legend-item"><div className="d" style={{ background: scoreColor(student.score) }} />该学生</div>
          </div>
        </div>
      </div>
    </div>
  )
}
