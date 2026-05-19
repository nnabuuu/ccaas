import type { ObserveData } from '../ObserveDrawer'
import { scoreColor, formatTime, statusLevel } from '../observe-helpers'
import { RenderMath } from '../../../../utils/render-math'
import type { GdData } from './gd-types'

interface Props {
  data: ObserveData
  studentId: string
}

export default function GdStudentView({ data, studentId }: Props) {
  const d = data as GdData
  const student = (d.students || []).find(s => s.id === studentId)
  const stepDefs = d.stepDefs || []
  const stats = d.stats || {} as GdData['stats']

  if (!student) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>未找到该学生数据</div>
      </div>
    )
  }

  if (!student.submitted) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--t3)' }}>该学生尚未提交</div>
      </div>
    )
  }

  const correctSteps = stepDefs.filter(s => student.stepResults?.[s.id]).length
  const status = statusLevel(student.score)

  return (
    <div className="observe-split">
      {/* Left: Step-by-step answers */}
      <div className="observe-split-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: '#fff', marginLeft: 'auto',
            background: scoreColor(student.score), padding: '2px 8px', borderRadius: 4,
          }}>
            {Math.round(student.score)}%
          </span>
        </div>

        <div className="obs-stats-grid cols-3">
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{correctSteps}/{stepDefs.length}</div>
            <div className="obs-stat-lb">步骤正确</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{formatTime(student.time)}</div>
            <div className="obs-stat-lb">用时</div>
          </div>
          <div className="obs-stat-cell">
            <div className="obs-stat-v">{Math.round(student.score)}%</div>
            <div className="obs-stat-lb">得分</div>
          </div>
        </div>

        <div className="m2-section-h">逐步作答</div>
        {stepDefs.map((stepDef, i) => {
          const ok = student.stepResults?.[stepDef.id]
          const answers = student.stepAnswers?.[stepDef.id] || {}

          return (
            <div key={stepDef.id} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 6,
              background: ok ? 'var(--green-soft)' : 'var(--red-soft)',
              border: `1px solid ${ok ? 'rgba(45,102,18,.15)' : 'rgba(148,41,41,.15)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#fff', borderRadius: 4, padding: '1px 6px',
                  background: ok ? 'var(--green)' : 'var(--red)',
                }}>
                  {ok ? '\u2713' : '\u2717'} Step {i + 1}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>{stepDef.title}</span>
              </div>
              <StepAnswerDetail answers={answers} />
            </div>
          )
        })}
      </div>

      {/* Right: Summary */}
      <div className="observe-split-right">
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
          {stepDefs.map((s, i) => {
            const ok = student.stepResults?.[s.id]
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#fff',
                  background: ok ? 'var(--green)' : 'var(--red)',
                }}>
                  {ok ? '\u2713' : '\u2717'}
                </div>
                <span style={{ fontSize: 9, color: 'var(--t3)' }}>S{i + 1}</span>
              </div>
            )
          })}
        </div>

        {/* Status Card */}
        <div className={`obs-status-card ${status.level}`}>
          <div className="obs-sc-title">{status.title}</div>
          <div className="obs-sc-body">
            {student.score >= 90 && `${student.name} 全部步骤正确，表现优秀。`}
            {student.score >= 70 && student.score < 90 && `${student.name} 大部分步骤正确，少数需要关注。`}
            {student.score >= 40 && student.score < 70 && `${student.name} 多个步骤出错，建议针对性辅导。`}
            {student.score < 40 && `${student.name} 正确率很低，需要重点关注。`}
          </div>
        </div>

        {/* Key Insights */}
        {(student.keyInsights || []).length > 0 && (
          <>
            <div className="m2-section-h">关键发现</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {student.keyInsights.map((insight, i) => (
                <div key={i} style={{
                  fontSize: 11, color: 'var(--t2)', lineHeight: 1.4,
                  padding: '6px 8px', background: 'var(--bg)', borderRadius: 5,
                  borderLeft: '2px solid var(--amber-dot)',
                }}>{insight}</div>
              ))}
            </div>
          </>
        )}

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
          {student.time > 0 && (stats.avgTime ?? 0) > 0 && (
            <div className="cc-row">
              <span className="cc-label">用时</span>
              <div className="cc-bar-wrap">
                <div className="cc-bar-bg" />
                <div className="cc-bar-class" style={{ width: `${Math.min(100, ((stats.avgTime ?? 0) / Math.max(stats.avgTime ?? 0, student.time)) * 100)}%` }} />
                <div className="cc-bar-student" style={{ width: `${Math.min(100, (student.time / Math.max(stats.avgTime ?? 0, student.time)) * 100)}%`, background: 'var(--blue)' }} />
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

function StepAnswerDetail({ answers }: { answers: Record<string, unknown> }) {
  const entries = Object.entries(answers)
  if (entries.length === 0) {
    return <div style={{ fontSize: 10, color: 'var(--t3)', fontStyle: 'italic' }}>未作答</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ fontSize: 10, color: 'var(--t2)', lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600, color: 'var(--t3)', marginRight: 4 }}>{key}:</span>
          {typeof value === 'string' ? (
            <RenderMath text={value} />
          ) : (
            <span>{JSON.stringify(value)}</span>
          )}
        </div>
      ))}
    </div>
  )
}
