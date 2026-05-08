import { useMemo, useState } from 'react'
import type { ClassroomState } from '../../hooks/useClassroom'
import { generateCoachingTips, type CoachingTip } from './coaching-helpers'
import {
  computeStudentQuadrants, computeWeakDimensions,
  pickQuestionCandidates, pickRepresentativeQuestions,
  buildStepMapping,
} from './summary/summary-helpers'

interface Props {
  state: ClassroomState
  health: {
    fastest: { step: string; count: number }
    median: { step: string; pct: number }
    stuck: { count: number; where: string }
    ai: { rounds: number; people: number }
  }
  stepNames: Record<number, string>
  taskSteps: Array<{ idx: number; duration?: number }>
  questions: ClassroomState['questions']
  onStudentClick: (name: string) => void
}

export function CoachingPanel({ state, health, stepNames, taskSteps, questions, onStudentClick }: Props) {
  const [expandedHighlight, setExpandedHighlight] = useState<number | null>(null)

  const tips = useMemo(
    () => generateCoachingTips(state, health, stepNames, taskSteps),
    [state, health, stepNames, taskSteps],
  )

  const highlights = state.coaching?.highlights || []
  const llmInsights = state.coaching?.llmInsights || null

  const { stepToTask, taskDurations } = useMemo(() => buildStepMapping(taskSteps), [taskSteps])

  const totalSteps = taskSteps.length

  const questionCandidates = useMemo(() => {
    const { students: quadrantStudents } = computeStudentQuadrants(
      state.students, state.stepMetrics, questions, totalSteps, stepToTask, taskDurations,
    )
    const weakDims = computeWeakDimensions(state.stepMetrics, stepNames)
    return pickQuestionCandidates(quadrantStudents, weakDims)
  }, [state.students, state.stepMetrics, questions, totalSteps, stepToTask, taskDurations, stepNames])

  const representativeQuestions = useMemo(
    () => pickRepresentativeQuestions(questions, stepNames, 3),
    [questions, stepNames],
  )

  const hasAnyContent = highlights.length > 0 || tips.length > 0 || llmInsights || questionCandidates.length > 0 || representativeQuestions.length > 0

  if (!hasAnyContent) {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
        等待课堂数据…教学建议将根据学生活动自动生成
      </div>
    )
  }

  return (
    <div className="coach-panel">
      {/* Highlights */}
      {highlights.length > 0 && (
        <section className="coach-section">
          <div className="coach-section-h">讨论亮点</div>
          <div className="coach-highlights">
            {[...highlights].reverse().map((h, i) => {
              const realIdx = highlights.length - 1 - i
              const isExpanded = expandedHighlight === realIdx
              return (
                <div key={realIdx} className="coach-highlight" onClick={() => setExpandedHighlight(isExpanded ? null : realIdx)}>
                  <div className="coach-highlight-top">
                    <span className="coach-highlight-name" onClick={(e) => { e.stopPropagation(); onStudentClick(h.studentName) }}>{h.studentName}</span>
                    <span className="coach-highlight-step">{stepNames[h.taskNum] || `T${h.taskNum}`}</span>
                  </div>
                  <div className="coach-highlight-gist">{h.gist}</div>
                  {isExpanded && (
                    <div className="coach-highlight-msg">"{h.message}"</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Rule-based tips */}
      {tips.length > 0 && (
        <section className="coach-section">
          <div className="coach-section-h">实时建议</div>
          <div className="coach-tips">
            {tips.map(tip => (
              <TipCard key={tip.id} tip={tip} />
            ))}
          </div>
        </section>
      )}

      {/* LLM insights */}
      {llmInsights && llmInsights.insights.length > 0 && (
        <section className="coach-section">
          <div className="coach-section-h">
            深度洞察
            <span className="coach-llm-ts">
              {new Date(llmInsights.generatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 生成
            </span>
          </div>
          <div className="coach-llm-section">
            {llmInsights.insights.map((ins, i) => (
              <div key={`${llmInsights.generatedAt}-${i}`} className="coach-llm-card">
                <div className="coach-tip-title">{ins.title}</div>
                <div className="coach-tip-detail">{ins.detail}</div>
                {ins.suggestedAction && (
                  <div className="coach-tip-action">{ins.suggestedAction}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Question candidates */}
      {questionCandidates.length > 0 && (
        <section className="coach-section">
          <div className="coach-section-h">推荐提问候选</div>
          <div className="coach-candidates">
            {questionCandidates.map((c, i) => (
              <div key={i} className="coach-candidate" onClick={() => onStudentClick(c.student.name)}>
                <div className="coach-candidate-top">
                  <span className="coach-candidate-name">{c.student.name}</span>
                  <span className={`coach-candidate-intent ${c.intent}`}>{c.intentLabel}</span>
                </div>
                <div className="coach-candidate-reason">{c.reason}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Representative questions */}
      {representativeQuestions.length > 0 && (
        <section className="coach-section">
          <div className="coach-section-h">值得讨论的问题</div>
          <div className="coach-candidates">
            {representativeQuestions.map((rq, i) => (
              <div key={i} className="coach-candidate">
                <div className="coach-candidate-top">
                  <span className="coach-candidate-step">{rq.stepName}</span>
                  {rq.category && <span className="coach-candidate-cat">{rq.category}</span>}
                </div>
                <div className="coach-candidate-question">"{rq.question}"</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TipCard({ tip }: { tip: CoachingTip }) {
  return (
    <div className={`coach-tip ${tip.priority}`}>
      <div className="coach-tip-title">{tip.title}</div>
      <div className="coach-tip-detail">{tip.detail}</div>
      {tip.action && <div className="coach-tip-action">{tip.action}</div>}
    </div>
  )
}
