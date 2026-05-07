import { useMemo } from 'react'
import type { ClassroomState } from '../../../hooks/useClassroom'
import {
  buildStepMapping,
  computeStudentQuadrants,
  computeWeakDimensions,
  computeKnowledgePoints,
  pickQuestionCandidates,
  computeTimingInsight,
  pickRepresentativeQuestions,
  computeAiHeat,
  formatDuration,
  QUADRANT_META,
  QUADRANT_ORDER,
} from './summary-helpers'
import type { Quadrant } from './summary-helpers'
import { hasAI } from '../teacher-helpers'

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

interface Props {
  state: ClassroomState
  students: ClassroomState['students']
  questions: ClassroomState['questions']
  stepNames: Record<number, string>
  totalSteps: number
  taskSteps: Array<{ idx: number }>
  onStudentClick: (name: string) => void
  onExpandOverlay: () => void
}

export function SummaryTab({ state, students, questions, stepNames, totalSteps, taskSteps, onStudentClick, onExpandOverlay }: Props) {
  const { stepToTask } = useMemo(() => buildStepMapping(taskSteps), [taskSteps])

  const quadrantData = useMemo(
    () => computeStudentQuadrants(students, state.stepMetrics, questions, totalSteps, stepToTask),
    [students, state.stepMetrics, questions, totalSteps, stepToTask],
  )

  const weakDimensions = useMemo(
    () => computeWeakDimensions(state.stepMetrics, stepNames),
    [state.stepMetrics, stepNames],
  )

  const knowledgePoints = useMemo(
    () => computeKnowledgePoints(state.stepMetrics, stepNames),
    [state.stepMetrics, stepNames],
  )

  const candidates = useMemo(
    () => pickQuestionCandidates(quadrantData.students, weakDimensions),
    [quadrantData.students, weakDimensions],
  )

  const timingInsight = useMemo(
    () => computeTimingInsight(students, stepToTask, state.stepMetrics, stepNames),
    [students, stepToTask, state.stepMetrics, stepNames],
  )

  const repQuestions = useMemo(
    () => pickRepresentativeQuestions(questions, stepNames),
    [questions, stepNames],
  )

  const aiHeat = useMemo(
    () => computeAiHeat(state.stepMetrics, stepNames),
    [state.stepMetrics, stepNames],
  )

  const metrics = { ...quadrantData.metrics, weakDimensionCount: weakDimensions.length }

  const hasTransitionInsights = timingInsight || repQuestions.length > 0 || aiHeat.length > 0

  // Group students by quadrant
  const groups = useMemo(() => {
    const g: Record<Quadrant, typeof quadrantData.students> = { star: [], struggling: [], coasting: [], 'at-risk': [] }
    for (const s of quadrantData.students) g[s.quadrant].push(s)
    return g
  }, [quadrantData.students])

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Expand button */}
      <button className="summary-expand-btn" onClick={onExpandOverlay}>
        展开全览 <span style={{ fontSize: 11 }}>&#8599;</span>
      </button>

      {/* Metrics Cards 2×2 */}
      <div className="summary-metrics">
        <div className="sm-card">
          <div className="sm-label">整体掌握度</div>
          <div className="sm-value" style={{ color: metrics.overallMastery >= 70 ? 'var(--green)' : metrics.overallMastery >= 40 ? 'var(--amber)' : 'var(--red)' }}>
            {metrics.overallMastery}%
          </div>
        </div>
        <div className="sm-card">
          <div className="sm-label">学优 / 学困</div>
          <div className="sm-value">
            <span style={{ color: 'var(--green)' }}>{metrics.starCount}</span>
            <span style={{ color: 'var(--t3)', fontSize: 14 }}> / </span>
            <span style={{ color: 'var(--red)' }}>{metrics.atRiskCount}</span>
          </div>
        </div>
        <div className="sm-card">
          <div className="sm-label">异常学生</div>
          <div className="sm-value" style={{ color: metrics.coastingCount > 0 ? 'var(--blue)' : 'var(--t3)' }}>
            {metrics.coastingCount}
          </div>
          <div className="sm-sub">游刃有余</div>
        </div>
        <div className="sm-card">
          <div className="sm-label">薄弱知识点</div>
          <div className="sm-value" style={{ color: metrics.weakDimensionCount > 0 ? 'var(--red)' : 'var(--green)' }}>
            {metrics.weakDimensionCount}
          </div>
          <div className="sm-sub">错误率 &gt;30%</div>
        </div>
      </div>

      {/* Quadrant Groups */}
      {QUADRANT_ORDER.map(q => {
        const g = groups[q]
        if (g.length === 0) return null
        const meta = QUADRANT_META[q]
        return (
          <div key={q} className="quadrant-group">
            <div className="qg-header">
              <span className="qg-dot" style={{ background: meta.color }} />
              {meta.label} · {g.length}
            </div>
            <div className="qg-students">
              {g.map(s => {
                const raw = students.find(st => st.id === s.id)
                const ai = raw ? hasAI(raw, questions) : false
                return (
                  <div
                    key={s.id}
                    className="sdot sm"
                    style={{ background: meta.color, color: '#fff' }}
                    title={`${s.name} · 掌握${s.mastery}% 参与${s.engagement}%`}
                    onClick={() => onStudentClick(s.name)}
                  >
                    {s.name.substring(0, 3)}
                    {ai && <span className="ai-pip" />}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Knowledge Point Bars */}
      {knowledgePoints.length > 0 && (
        <div className="kp-section">
          <div className="kp-header">知识点掌握</div>
          {knowledgePoints.map(kp => (
            <div key={`${kp.stepNum}-${kp.dimension}`} className="kp-bar-row">
              <span className="kp-label">{kp.label}</span>
              <div className="kp-bar-track">
                <div
                  className="kp-bar-fill"
                  style={{
                    width: `${kp.masteryRate}%`,
                    background: kp.masteryRate >= 80 ? 'var(--green-dot)' : kp.masteryRate >= 60 ? 'var(--t3)' : kp.masteryRate >= 40 ? 'var(--amber-dot)' : 'var(--red)',
                  }}
                />
              </div>
              <span className="kp-pct">{kp.masteryRate}%</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommended Question Candidates */}
      {candidates.length > 0 && (
        <div className="kp-section">
          <div className="kp-header">推荐提问候选</div>
          {candidates.map(c => (
            <div key={c.student.id} className="qc-recommend-card" onClick={() => onStudentClick(c.student.name)}>
              <div className="qcr-head">
                <span className="qcr-name">{c.student.name}</span>
                <span className={`qcr-intent ${c.intent}`}>{c.intentLabel}</span>
              </div>
              <div className="qcr-reason">{c.reason}</div>
            </div>
          ))}
        </div>
      )}

      {/* Transition Insights (compact) */}
      {hasTransitionInsights && (
        <div className="st-transition">
          <div className="kp-header">课堂衔接</div>
          {timingInsight && (
            <div className="st-transition-row">
              <span className="st-transition-icon st-icon-timing" />
              <span>Step {timingInsight.stepNum} 耗时最长（{timingInsight.percentage}% 学生）{timingInsight.medianTime != null ? ` · 中位 ${formatDuration(timingInsight.medianTime)}` : ''}</span>
            </div>
          )}
          {repQuestions.length > 0 && (
            <div className="st-transition-row">
              <span className="st-transition-icon st-icon-question" />
              <span>"{truncate(repQuestions[0].question, 30)}" — 匿名</span>
            </div>
          )}
          {aiHeat.length > 0 && (
            <div className="st-transition-row">
              <span className="st-transition-icon st-icon-ai" />
              <span>Step {aiHeat[0].stepNum} AI 对话最活跃（{aiHeat[0].aiRounds} 轮）</span>
            </div>
          )}
          <button className="st-transition-btn" disabled>
            生成衔接话术 →
          </button>
        </div>
      )}
    </div>
  )
}
