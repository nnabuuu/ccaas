import { useMemo } from 'react'
import type { ClassroomState } from '../../../hooks/useClassroom'
import {
  buildStepMapping,
  computeStudentQuadrants,
  computeWeakDimensions,
  pickQuestionCandidates,
  QUADRANT_META,
  QUADRANT_ORDER,
} from './summary-helpers'
import type { Quadrant } from './summary-helpers'
import { DepthLeaderboardCard } from './DepthLeaderboardCard'

interface Props {
  state: ClassroomState
  students: ClassroomState['students']
  questions: ClassroomState['questions']
  stepNames: Record<number, string>
  totalSteps: number
  taskSteps: Array<{ idx: number; duration?: number }>
  sessionCode: string
  onStudentClick: (name: string) => void
  onExpandOverlay: () => void
  onExpandDepthOverlay: () => void
}

export function SummaryTab({ state, students, questions, stepNames, totalSteps, taskSteps, sessionCode, onStudentClick, onExpandOverlay, onExpandDepthOverlay }: Props) {
  const { stepToTask, taskDurations } = useMemo(() => buildStepMapping(taskSteps), [taskSteps])

  const quadrantData = useMemo(
    () => computeStudentQuadrants(students, state.stepMetrics, questions, totalSteps, stepToTask, taskDurations),
    [students, state.stepMetrics, questions, totalSteps, stepToTask, taskDurations],
  )

  const weakDimensions = useMemo(
    () => computeWeakDimensions(state.stepMetrics, stepNames),
    [state.stepMetrics, stepNames],
  )

  const candidates = useMemo(
    () => pickQuestionCandidates(quadrantData.students, weakDimensions),
    [quadrantData.students, weakDimensions],
  )

  const metrics = { ...quadrantData.metrics, weakDimensionCount: weakDimensions.length }

  // Group students by quadrant
  const groups = useMemo(() => {
    const g: Record<Quadrant, typeof quadrantData.students> = { star: [], struggling: [], coasting: [], 'at-risk': [] }
    for (const s of quadrantData.students) g[s.quadrant].push(s)
    return g
  }, [quadrantData.students])

  // Map quadrant key → CSS class
  const quadrantClass = (q: Quadrant) => {
    if (q === 'at-risk') return 'atrisk'
    return q
  }

  return (
    <div>
      {/* ── Panel Header ── */}
      <div className="panel-header">
        <span className="title">学生分析</span>
        <button className="expand-btn" onClick={onExpandOverlay}>展开 ↗</button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* ── Summary Stats (2-stat row per design) ── */}
        <div className="summary-row">
          <div className="summary-stat">
            <div className="val" style={{ color: metrics.overallMastery >= 70 ? 'var(--green)' : metrics.overallMastery >= 40 ? 'var(--amber)' : 'var(--red)' }}>
              {metrics.overallMastery}%
            </div>
            <div className="lbl">全班掌握</div>
          </div>
          <div className="summary-stat">
            <div className="val" style={{ color: 'var(--red)' }}>{metrics.atRiskCount}</div>
            <div className="lbl">At-risk 人数</div>
          </div>
        </div>

        {/* ── Quadrant 2×2 Grid (design spec) ── */}
        <div className="quadrant-grid">
          {QUADRANT_ORDER.map(q => {
            const g = groups[q]
            const meta = QUADRANT_META[q]
            return (
              <div key={q} className={`quadrant ${quadrantClass(q)}`}>
                <div className="quadrant-title">{meta.label} · {g.length}</div>
                <div className="quadrant-names">
                  {g.map(s => (
                    <span
                      key={s.id}
                      className="q-chip"
                      title={`掌握${s.mastery}% 参与${s.engagement}%`}
                      onClick={() => onStudentClick(s.name)}
                    >
                      {s.name}
                    </span>
                  ))}
                  {g.length === 0 && <span style={{ fontSize: 9, color: 'var(--t3)' }}>—</span>}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Recommended Question Candidates (q-tag badges) ── */}
        {candidates.length > 0 && (
          <div>
            <div className="subsection"><span className="icon">✦</span> 建议提问</div>
            {candidates.map(c => (
              <div key={c.student.id} className="q-candidate" onClick={() => onStudentClick(c.student.name)}>
                <span className={`q-tag ${c.intent}`}>{c.intentLabel}</span>
                <div className="q-info">
                  <div className="q-name">{c.student.name}</div>
                  <div className="q-reason">{c.reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Weak Dimensions (compact bar view) ── */}
        {weakDimensions.length > 0 && (
          <div className="weak-dim-section">
            <div className="subsection"><span className="icon">⚡</span> 薄弱维度</div>
            {weakDimensions.slice(0, 5).map(wd => (
              <div key={`${wd.stepNum}-${wd.dimension}`} className="weak-dim">
                <span className="dim-label" title={`${wd.stepName} · ${wd.dimension}`}>{wd.dimension}</span>
                <div className="dim-bar">
                  <div className="dim-fill" style={{ width: `${wd.wrongRate}%` }} />
                </div>
                <span className="dim-pct">{wd.wrongRate}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Depth Leaderboard ── */}
      {state.depthLeaderboard && (
        <DepthLeaderboardCard
          rankings={state.depthLeaderboard.rankings}
          coaching={state.coaching}
          sessionCode={sessionCode}
          onStudentClick={onStudentClick}
          onExpandOverlay={onExpandDepthOverlay}
        />
      )}
    </div>
  )
}
