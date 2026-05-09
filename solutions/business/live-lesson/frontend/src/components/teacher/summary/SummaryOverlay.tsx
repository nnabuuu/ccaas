import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import type { ClassroomState } from '../../../hooks/useClassroom'
import OverlayShell from '../observe/OverlayShell'
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
import type { StudentQuadrantData, Quadrant, WeakDimension, QuestionCandidate } from './summary-helpers'

interface Props {
  open: boolean
  onClose: () => void
  state: ClassroomState
  students: ClassroomState['students']
  questions: ClassroomState['questions']
  stepNames: Record<number, string>
  totalSteps: number
  taskSteps: Array<{ idx: number; duration?: number }>
  onStudentClick: (name: string) => void
}

// ── Default viewBox for the matrix SVG ──
const DEFAULT_VB = { x: -10, y: -10, w: 120, h: 120 }
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4

export default function SummaryOverlay({ open, onClose, state, students, questions, stepNames, totalSteps, taskSteps, onStudentClick }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewBox, setViewBox] = useState(DEFAULT_VB)
  const viewBoxRef = useRef(viewBox)
  useEffect(() => { viewBoxRef.current = viewBox }, [viewBox])
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<{ startX: number; startY: number; startVB: typeof DEFAULT_VB } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const { stepToTask, taskToStep, taskDurations } = useMemo(() => buildStepMapping(taskSteps), [taskSteps])

  const quadrantData = useMemo(
    () => computeStudentQuadrants(students, state.stepMetrics, questions, totalSteps, stepToTask, taskDurations),
    [students, state.stepMetrics, questions, totalSteps, stepToTask, taskDurations],
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

  const selectedStudent = useMemo(
    () => quadrantData.students.find(s => s.id === selectedId) || null,
    [quadrantData.students, selectedId],
  )

  const selectedRaw = useMemo(
    () => students.find(s => s.id === selectedId) || null,
    [students, selectedId],
  )

  // Quadrant counts for SVG labels
  const quadrantCounts = useMemo(() => {
    const counts: Record<Quadrant, number> = { star: 0, struggling: 0, coasting: 0, 'at-risk': 0 }
    for (const s of quadrantData.students) counts[s.quadrant]++
    return counts
  }, [quadrantData.students])

  // Top 3-5 named students: first from each populated quadrant
  const namedStudents = useMemo(() => {
    const named = new Set<string>()
    for (const q of QUADRANT_ORDER) {
      const inQ = quadrantData.students.filter(s => s.quadrant === q)
      if (inQ.length === 0) continue
      const pick = q === 'star' ? [...inQ].sort((a, b) => b.mastery - a.mastery)[0]
        : q === 'at-risk' ? [...inQ].sort((a, b) => a.mastery - b.mastery)[0]
        : inQ[0]
      named.add(pick.id)
      if (named.size >= 5) break
    }
    return named
  }, [quadrantData.students])

  // Zoom level percentage
  const zoomLevel = Math.round((DEFAULT_VB.w / viewBox.w) * 100)

  // ── Zoom ──
  const zoom = useCallback((factor: number) => {
    setViewBox(vb => {
      const cx = vb.x + vb.w / 2
      const cy = vb.y + vb.h / 2
      const newW = Math.max(DEFAULT_VB.w / MAX_ZOOM, Math.min(DEFAULT_VB.w / MIN_ZOOM, vb.w / factor))
      const newH = Math.max(DEFAULT_VB.h / MAX_ZOOM, Math.min(DEFAULT_VB.h / MIN_ZOOM, vb.h / factor))
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH }
    })
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    zoom(e.deltaY < 0 ? 1.15 : 0.87)
  }, [zoom])

  // ── Double-click to focus a quadrant ──
  const focusQuadrant = useCallback((q: Quadrant) => {
    const regions: Record<Quadrant, typeof DEFAULT_VB> = {
      'star':       { x: 45, y: -10, w: 65, h: 65 },
      'struggling': { x: -10, y: -10, w: 65, h: 65 },
      'coasting':   { x: 45, y: 45, w: 65, h: 65 },
      'at-risk':    { x: -10, y: 45, w: 65, h: 65 },
    }
    setViewBox(regions[q])
  }, [])

  // ── Drag to pan ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, startVB: { ...viewBoxRef.current } }
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !svgRef.current) return
      const svgRect = svgRef.current.getBoundingClientRect()
      const scaleX = viewBoxRef.current.w / svgRect.width
      const scaleY = viewBoxRef.current.h / svgRect.height
      const dx = (e.clientX - dragRef.current.startX) * scaleX
      const dy = (e.clientY - dragRef.current.startY) * scaleY
      setViewBox({
        ...dragRef.current.startVB,
        x: dragRef.current.startVB.x - dx,
        y: dragRef.current.startVB.y - dy,
      })
    }
    const handleMouseUp = () => { dragRef.current = null; setIsDragging(false) }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [open])

  const submitted = students.filter(s => s.submissions && Object.values(s.submissions).some(sub => sub?.score)).length

  return (
    <OverlayShell open={open} onClose={onClose} depth={0}>
      <div className="so-root">
        {/* ── Header ── */}
        <div className="so-header">
          <div className="so-header-left">
            <span className="so-title">学生自学总览</span>
          </div>
          <span className="so-progress">{submitted} / {students.length} 已提交</span>
          <button className="so-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Metrics row ── */}
        <div className="so-metrics-row">
          <MetricCard label="整体掌握度" value={`${metrics.overallMastery}%`} color={metrics.overallMastery >= 70 ? 'var(--green)' : metrics.overallMastery >= 40 ? 'var(--amber)' : 'var(--red)'} />
          <MetricCard label="学优 / 学困" value={`${metrics.starCount} / ${metrics.atRiskCount}`} color="var(--t1)" />
          <MetricCard label="异常学生" value={String(metrics.coastingCount)} sub="游刃有余" color={metrics.coastingCount > 0 ? 'var(--blue)' : 'var(--t3)'} />
          <MetricCard label="薄弱知识点" value={String(metrics.weakDimensionCount)} sub="错误率 >30%" color={metrics.weakDimensionCount > 0 ? 'var(--red)' : 'var(--green)'} />
        </div>

        {/* ── Matrix + Detail ── */}
        <div className="so-matrix-row">
          {/* SVG scatter plot */}
          <div className="so-matrix-wrap">
            {/* Matrix header bar */}
            <div className="so-matrix-bar">
              <span className="so-matrix-label">学生分布 · {quadrantData.students.length} 人</span>
              <div className="so-zoom-controls">
                <button onClick={() => zoom(0.77)}>−</button>
                <span className="so-zoom-level">{zoomLevel}%</span>
                <button onClick={() => zoom(1.3)}>+</button>
                <button onClick={() => setViewBox(DEFAULT_VB)}>重置</button>
              </div>
            </div>

            {/* Chart area (relative container for zones overlay) */}
            <div className="so-matrix-chart">
              <svg
                ref={svgRef}
                className="so-matrix-svg"
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                preserveAspectRatio="xMidYMid meet"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                {/* Quadrant backgrounds (y is inverted: 0=top=high engagement) — double-click to zoom */}
                <rect x="50" y="0" width="50" height="50" fill="var(--green-soft)" opacity="0.5" style={{ cursor: 'zoom-in' }} onDoubleClick={() => focusQuadrant('star')} />
                <rect x="0" y="0" width="50" height="50" fill="var(--amber-soft)" opacity="0.5" style={{ cursor: 'zoom-in' }} onDoubleClick={() => focusQuadrant('struggling')} />
                <rect x="50" y="50" width="50" height="50" fill="var(--blue-soft)" opacity="0.5" style={{ cursor: 'zoom-in' }} onDoubleClick={() => focusQuadrant('coasting')} />
                <rect x="0" y="50" width="50" height="50" fill="var(--red-soft)" opacity="0.5" style={{ cursor: 'zoom-in' }} onDoubleClick={() => focusQuadrant('at-risk')} />

                {/* Axes */}
                <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border-strong)" strokeWidth="0.3" />
                <line x1="50" y1="0" x2="50" y2="100" stroke="var(--border-strong)" strokeWidth="0.3" />

                {/* Axis labels */}
                <text x="100" y="104" fontSize="3.5" fill="var(--t3)" textAnchor="end">掌握度 →</text>
                <text x="-2" y="2" fontSize="3.5" fill="var(--t3)" textAnchor="start">↑ 参与度</text>

                {/* Quadrant labels with counts */}
                <text x="75" y="6" fontSize="3" fill="var(--green)" textAnchor="middle" opacity="0.7" fontWeight="500">学优 {quadrantCounts.star}</text>
                <text x="25" y="6" fontSize="3" fill="var(--amber)" textAnchor="middle" opacity="0.7" fontWeight="500">努力但困惑 · {quadrantCounts.struggling}</text>
                <text x="75" y="97" fontSize="3" fill="var(--blue)" textAnchor="middle" opacity="0.7" fontWeight="500">游刃有余 · {quadrantCounts.coasting}</text>
                <text x="25" y="97" fontSize="3" fill="var(--red)" textAnchor="middle" opacity="0.7" fontWeight="500">需要关注 · {quadrantCounts['at-risk']}</text>

                {/* Student dots */}
                {quadrantData.students.map(s => {
                  const cx = s.mastery
                  const cy = 100 - s.engagement // invert Y
                  const meta = QUADRANT_META[s.quadrant]
                  const isSelected = s.id === selectedId
                  const isNamed = namedStudents.has(s.id)
                  return (
                    <g key={s.id} onClick={(e) => { e.stopPropagation(); setSelectedId(s.id) }} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={cx} cy={cy} r={isSelected ? 3.5 : 2.5}
                        fill={meta.color}
                        stroke={isSelected ? 'var(--t1)' : 'none'}
                        strokeWidth={isSelected ? 0.6 : 0}
                        opacity={isSelected ? 1 : 0.85}
                      />
                      {(isNamed || isSelected) && (
                        <text
                          x={cx + 3.5} y={cy + 1}
                          fontSize="3" fill="var(--t1)" fontWeight={isSelected ? 700 : 500}
                        >
                          {s.name}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Interaction hints */}
            <div className="so-matrix-hints">
              <span>滚轮缩放 · 拖拽平移 · 双击聚焦象限</span>
              <span>点击姓名 → 详情</span>
            </div>
          </div>

          {/* Detail Panel */}
          <div className="so-detail">
            {selectedStudent ? (
              <DetailPanel
                student={selectedStudent}
                rawStudent={selectedRaw}
                stepNames={stepNames}
                totalSteps={totalSteps}
                taskToStep={taskToStep}
                weakDimensions={weakDimensions}
                allStudents={quadrantData.students}
                candidates={candidates}
                onStudentClick={onStudentClick}
              />
            ) : (
              <div className="so-detail-empty">
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', marginBottom: 6 }}>点击学生查看详情</div>
                <div style={{ fontSize: 11, color: 'var(--t3)' }}>在左侧矩阵中点击学生圆点</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Candidates + Reteach ── */}
        <div className="so-action-row">
          <div className="so-action-col">
            <div className="so-section-h">推荐提问候选</div>
            {candidates.length === 0 && <div className="so-empty-hint">暂无推荐</div>}
            {candidates.map(c => (
              <div key={c.student.id} className="qc-recommend-card" onClick={() => { setSelectedId(c.student.id); onStudentClick(c.student.name) }}>
                <div className="qcr-head">
                  <span className="qcr-name">{c.student.name}</span>
                  <span className={`qcr-intent ${c.intent}`}>{c.intentLabel}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="so-action-col">
            <div className="so-section-h">建议重讲</div>
            {weakDimensions.length === 0 && <div className="so-empty-hint">暂无薄弱知识点</div>}
            {weakDimensions.slice(0, 2).map(wd => (
              <div key={`${wd.stepNum}-${wd.dimension}`} className={`so-reteach-card ${wd.wrongRate > 40 ? 'danger' : 'warn'}`}>
                <span className="so-reteach-dim">{wd.stepName} · {wd.dimension}</span>
                <span className="so-reteach-pct">错误率 {wd.wrongRate}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Knowledge Point Bars ── */}
        {knowledgePoints.length > 0 && (
          <div className="so-kp-section">
            <div className="so-section-h">知识点掌握情况</div>
            <div className="so-kp-list">
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
          </div>
        )}

        {/* ── Transition Insights (full) ── */}
        {hasTransitionInsights && (
          <div className="so-transition-section">
            <div className="so-section-h">课堂衔接线索</div>

            {/* Timing hotspot */}
            {timingInsight && (
              <div className="so-transition-card">
                <div className="so-transition-label">耗时热点</div>
                <div className="so-transition-main">
                  Step {timingInsight.stepNum} "{timingInsight.stepName}"
                </div>
                <div className="so-transition-detail">
                  {timingInsight.percentage}% 学生在此步骤耗时最长
                  {timingInsight.medianTime != null && ` · 中位 ${formatDuration(timingInsight.medianTime)}`}
                </div>
              </div>
            )}

            {/* Representative questions */}
            {repQuestions.length > 0 && (
              <div className="so-transition-card">
                <div className="so-transition-label">值得讨论的提问</div>
                {repQuestions.map((rq, i) => (
                  <div key={i} className="so-transition-quote">
                    <span className="so-transition-step">Step {rq.step}</span>
                    <span className="so-transition-q">"{rq.question}"</span>
                  </div>
                ))}
              </div>
            )}

            {/* AI heat */}
            {aiHeat.length > 0 && (
              <div className="so-transition-card">
                <div className="so-transition-label">AI 互动热度</div>
                {aiHeat.map(h => {
                  const maxRounds = aiHeat[0].aiRounds
                  const pct = maxRounds > 0 ? Math.round((h.aiRounds / maxRounds) * 100) : 0
                  return (
                    <div key={h.stepNum} className="so-ai-heat-row">
                      <span className="so-ai-heat-name">Step {h.stepNum}</span>
                      <div className="kp-bar-track">
                        <div className="so-ai-heat-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="so-ai-heat-stat">{h.aiRounds} 轮 · {h.aiPeople} 人</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </OverlayShell>
  )
}

// ── Sub-components ──

function MetricCard({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="sm-card">
      <div className="sm-label">{label}</div>
      <div className="sm-value" style={{ color }}>{value}</div>
      {sub && <div className="sm-sub">{sub}</div>}
    </div>
  )
}

function DetailPanel({ student, rawStudent, stepNames, totalSteps, taskToStep, weakDimensions: _weakDimensions, allStudents, candidates, onStudentClick }: {
  student: StudentQuadrantData
  rawStudent: ClassroomState['students'][number] | null
  stepNames: Record<number, string>
  totalSteps: number
  taskToStep: Record<number, number>
  weakDimensions: WeakDimension[]
  allStudents: StudentQuadrantData[]
  candidates: QuestionCandidate[]
  onStudentClick: (name: string) => void
}) {
  const meta = QUADRANT_META[student.quadrant]
  const completion = `${student.submissionCount} / ${totalSteps}`

  // Find matching candidate for this student
  const matchedCandidate = candidates.find(c => c.student.id === student.id)

  // Build weak step details from raw submission data
  const weakDetails = student.weakSteps.map(taskNum => {
    const stepIdx = taskToStep[taskNum]
    const sub = stepIdx != null ? rawStudent?.submissions?.[stepIdx] : null
    const name = stepNames[taskNum] || `Step ${taskNum}`
    let detail = '直接跳过未答'
    if (sub?.score?.total != null) {
      detail = `得分 ${Math.round(sub.score.total)}%`
    }
    return { taskNum, name, detail }
  })

  // Recommendation reasoning — prefer candidate reason if available
  const recommendReason = (() => {
    if (matchedCandidate) return matchedCandidate.reason
    switch (student.quadrant) {
      case 'star': return `掌握度 ${student.mastery}%，可作为标杆展示正确路径`
      case 'struggling': {
        const sameWeak = allStudents.filter(s => s.weakSteps.some(ws => student.weakSteps.includes(ws))).length
        const pct = allStudents.length > 0 ? Math.round((sameWeak / allStudents.length) * 100) : 0
        return `参与度高但掌握不足，卡点与 ${pct}% 同学共同`
      }
      case 'coasting': return `掌握度 ${student.mastery}% 但参与度低，需追加挑战或关注是否蒙对`
      case 'at-risk': return `掌握度和参与度均低，需要重点干预`
    }
  })()

  const recommendLabel = matchedCandidate
    ? `为什么推荐"${matchedCandidate.intentLabel}"`
    : '推荐理由'

  return (
    <div className="so-detail-content">
      <div className="so-detail-head">
        <span className="so-detail-name" onClick={() => onStudentClick(student.name)} style={{ cursor: 'pointer' }}>{student.name}</span>
        <span className="so-detail-tag" style={{ background: meta.bgColor, color: meta.color }}>{meta.label}</span>
      </div>

      {/* Stats grid: 2x2 — mastery, engagement, time, completion */}
      <div className="obs-stats-grid cols-4" style={{ marginTop: 10 }}>
        <div className="obs-stat-cell">
          <div className="obs-stat-v" style={{ color: student.mastery >= 70 ? 'var(--green)' : student.mastery >= 40 ? 'var(--amber)' : 'var(--red)' }}>{student.mastery}%</div>
          <div className="obs-stat-l">掌握度</div>
        </div>
        <div className="obs-stat-cell">
          <div className="obs-stat-v" style={{ color: student.engagement >= 60 ? 'var(--green)' : student.engagement >= 30 ? 'var(--amber)' : 'var(--red)' }}>{student.engagement}%</div>
          <div className="obs-stat-l">参与度</div>
        </div>
        <div className="obs-stat-cell">
          <div className="obs-stat-v" style={{ color: 'var(--t3)' }}>—</div>
          <div className="obs-stat-l">用时</div>
        </div>
        <div className="obs-stat-cell">
          <div className="obs-stat-v">{completion}</div>
          <div className="obs-stat-l">完整度</div>
        </div>
      </div>

      {/* Weak steps with details */}
      {weakDetails.length > 0 && (
        <div className="so-detail-section">
          <div className="so-detail-section-h">关键卡点</div>
          <div className="so-weak-list">
            {weakDetails.map(w => (
              <div key={w.taskNum} className="so-weak-item">
                <div className="so-weak-name">{w.name}</div>
                <div className="so-weak-detail">{w.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation reasoning */}
      <div className="so-detail-section">
        <div className="so-detail-section-h">{recommendLabel}</div>
        <div className="so-detail-reason">{recommendReason}</div>
      </div>

      <button className="so-detail-open-btn" onClick={() => onStudentClick(student.name)}>
        加入提问候选 ↗
      </button>
    </div>
  )
}
