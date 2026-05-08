import React, { useState, useMemo } from 'react'
import type { ReadingManifest } from '../../types/reading'
import type { ClassroomState } from '../../hooks/useClassroom'
import { STUCK_THRESHOLD_MS, getCatBadgeClass, getStepName, stripDiscussTag, PHASE_LABELS } from './teacher-helpers'

export function StudentModal({ student, manifest, state, questions, onClose }: {
  student: ClassroomState['students'][0]
  manifest: ReadingManifest
  state: ClassroomState
  questions: ClassroomState['questions']
  onClose: () => void
}) {
  const [selectedStep, setSelectedStep] = useState(student.currentTask)
  const taskSteps = manifest.readingSteps
    .filter(rs => rs.type === 'task')
    .sort((a, b) => a.idx - b.idx)

  // Map taskNum (1-indexed) → stepIdx (manifest idx) for correct submission/question lookup
  const taskToStepIdx = useMemo(() => {
    const map: Record<number, number> = {}
    taskSteps.forEach((rs, i) => { map[i + 1] = rs.idx })
    return map
  }, [taskSteps])

  const stepName = getStepName(taskSteps[student.currentTask - 1] || {}) || `Step ${student.currentTask}`
  const studentQuestions = questions.filter(q => q.studentId === student.id)

  // Per-step status for journey strip (task steps only, matching backend currentTask numbering)
  const journeySteps = taskSteps.map((rs, i) => {
    const sn = i + 1
    const stepIdx = taskToStepIdx[sn]
    const sub = student.submissions?.[stepIdx]
    if (sn < student.currentTask) {
      const score = sub?.score?.total ?? 0
      const name = getStepName(rs)
      if (score >= 80) return { sn, label: name, status: 'done' as const, result: 'correct' as const, score, phaseLabel: undefined }
      if (score >= 40) return { sn, label: name, status: 'done' as const, result: 'partial' as const, score, phaseLabel: undefined }
      if (sub) return { sn, label: name, status: 'done' as const, result: 'partial' as const, score, phaseLabel: undefined }
      return { sn, label: name, status: 'done' as const, result: 'correct' as const, score: 0, phaseLabel: undefined }
    }
    if (sn === student.currentTask) {
      const name = getStepName(rs)
      const phase = student.currentPhase || 'listen'
      const phaseLabel = PHASE_LABELS[phase]
      const isStuck = student.stepStartedAt && (Date.now() - new Date(student.stepStartedAt).getTime()) > STUCK_THRESHOLD_MS
      if (isStuck) return { sn, label: name, status: 'stuck' as const, result: 'partial' as const, score: sub?.score?.total ?? 0, phaseLabel }
      return { sn, label: name, status: 'prog' as const, result: 'partial' as const, score: sub?.score?.total ?? 0, phaseLabel }
    }
    return { sn, label: getStepName(rs), status: 'future' as const, result: 'future' as const, score: 0, phaseLabel: undefined }
  })

  // Needs attention?
  const needsAttn = (js: typeof journeySteps[0]) =>
    js.status !== 'future' && (js.result === 'partial' || (js.status as string) === 'stuck')

  // Selected step data — use stepIdx for submission/question lookup
  const selStepIdx = taskToStepIdx[selectedStep]
  const selSub = student.submissions?.[selStepIdx]
  const selByDim = selSub?.score?.byDimension || {}
  const selTotal = selSub?.score?.total ?? 0

  // First attempt data (MC/Evidence types store firstAttemptAnswers)
  const hasFirstAttempt = (selSub?.data?.firstAttemptAnswers as any[])?.length > 0
    || Object.keys(selSub?.data?.firstAttemptSections || {}).length > 0
  const firstAttemptScore = hasFirstAttempt ? (selSub?.data?.firstAttemptScore as number | undefined) : undefined

  // Class compare data — stepMetrics is keyed by taskNum (correct as-is)
  const stepMetrics = state.stepMetrics?.[selectedStep]
  const classAvgScore = stepMetrics?.avgScore ?? 0
  const stepQuestions = questions.filter(q => q.step === selStepIdx)
  const classAvgAi = stepQuestions.length > 0 ? Math.round(stepQuestions.length / Math.max(1, new Set(stepQuestions.map(q => q.studentId)).size)) : 0
  const studentStepQuestions = studentQuestions.filter(q => q.step === selStepIdx)
  const studentAiForStep = studentStepQuestions.length

  // Split discuss vs non-discuss questions for different rendering
  const discussQs = studentStepQuestions.filter(q => q.category === 'discuss')
  const askQs = studentStepQuestions.filter(q => q.category !== 'discuss')

  return (
    <div className="overlay" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('overlay')) onClose() }}>
      <div className="modal">
        {/* Header */}
        <div className="mod-hd">
          <div className="mod-av">{student.name[0]}</div>
          <div className="mod-ti">
            <div className="mod-ti-n">{student.name}</div>
            <div className="mod-ti-m">
              当前在 {stepName}
              {student.currentPhase === 'discuss' && student.discussMeta && (
                <span style={{ marginLeft: 8, fontSize: 11, color: student.discussMeta.goalReached ? 'var(--green)' : 'var(--t3)' }}>
                  {student.discussMeta.goalReached
                    ? '✓ 对话达标'
                    : (() => { const ms = Date.now() - new Date(student.discussMeta.startedAt).getTime(); return `讨论中 ${Number.isFinite(ms) && ms >= 0 ? Math.floor(ms / 60000) : 0}分钟` })()}
                </span>
              )}
            </div>
          </div>
          <div className="mod-cls" onClick={onClose}>关闭 ✕</div>
        </div>

        {/* Journey Strip */}
        <div className="journey">
          <div className="journey-strip">
            {journeySteps.map((js, i) => {
              const isAct = selectedStep === js.sn
              const attn = needsAttn(js) && !isAct
              return (
                <React.Fragment key={js.sn}>
                  {i > 0 && <div className={`journey-connector${js.status === 'future' ? ' future' : ''}`} />}
                  <div
                    className={`journey-node${isAct ? ' act' : ''}${js.status === 'future' ? ' future' : ''}${attn ? ' needs-attn' : ''}`}
                    onClick={() => setSelectedStep(js.sn)}
                  >
                    {attn && <span className="jn-attn">⚠ 需关注</span>}
                    <div className="jn-top">
                      <span className="jn-name">{js.label}</span>
                    </div>
                    <div className={`jn-status ${js.status === 'done' && js.result === 'correct' ? 'done' : js.status === 'done' && js.result === 'partial' ? 'partial' : js.status === 'prog' ? 'prog' : js.status === 'stuck' ? 'partial' : 'future'}`}>
                      <span className="ico">
                        {js.status === 'done' && js.result === 'correct' ? '✓' :
                         js.status === 'done' && js.result === 'partial' ? '△' :
                         js.status === 'prog' ? '●' :
                         js.status === 'stuck' ? '⚠' : '○'}
                      </span>
                      {js.status === 'done' && js.result === 'correct' ? ' 已完成' :
                       js.status === 'done' && js.result === 'partial' ? ' 部分正确' :
                       js.status === 'prog' ? ` 进行中${js.phaseLabel ? ` · ${js.phaseLabel}` : ''}` :
                       js.status === 'stuck' ? ' 需关注' : ' 未到达'}
                    </div>
                    {js.status !== 'future' && js.score > 0 && (
                      <div className="jn-meta"><span>{js.score}%</span></div>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
            {student.bonusStatus && student.bonusStatus !== 'none' && (
              <>
                <div className="journey-connector" />
                <div className="journey-node">
                  <div className="jn-top"><span className="jn-name">Bonus</span></div>
                  <div className={`jn-status ${student.bonusStatus === 'completed' ? 'done' : 'prog'}`}>
                    <span className="ico">{student.bonusStatus === 'completed' ? '✓' : '●'}</span>
                    {student.bonusStatus === 'completed' ? ' 已完成' : ' 进行中'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Step Detail */}
        <div className="mod-step-content">
          {journeySteps[selectedStep - 1]?.status === 'future' ? (
            <div className="mod-empty">该学生尚未到达此步</div>
          ) : (
            <>
              {/* Left col: submission detail */}
              <div className="mod-col">
                <div className="mod-h">作答详情 · {journeySteps[selectedStep - 1]?.label || `Step ${selectedStep}`}</div>
                {selSub ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selTotal >= 80 ? 'var(--green)' : selTotal >= 50 ? 'var(--amber)' : 'var(--red)', marginBottom: 8 }}>
                      得分: {selTotal}%
                      {hasFirstAttempt && firstAttemptScore != null && firstAttemptScore !== selTotal && (
                        <span style={{ fontWeight: 400, color: 'var(--t3)', marginLeft: 8 }}>
                          (首次 {firstAttemptScore}% → 最新 {selTotal}%)
                        </span>
                      )}
                    </div>
                    {Object.entries(selByDim).map(([key, val]: [string, unknown]) => {
                      const dimLabels = (stepMetrics as any)?.dimensionLabels || {}
                      const label = dimLabels[key] || key
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                          <span className={`result-badge ${val ? 'correct' : 'wrong'}`}>{val ? '✓' : '✗'}</span>
                          <span style={{ color: 'var(--t2)' }}>{label}</span>
                        </div>
                      )
                    })}
                    {Object.keys(selByDim).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--t3)' }}>已提交，暂无维度数据</div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                    {selectedStep === student.currentTask ? '正在作答中…' : '尚无提交记录'}
                  </div>
                )}
              </div>

              {/* Right col: AI chat or class compare */}
              <div className="mod-col right">
                {studentStepQuestions.length > 0 ? (
                  <>
                    {/* Discuss replay section */}
                    {discussQs.length > 0 && (
                      <>
                        <div className="mod-h">讨论回放 · {discussQs.length} 轮</div>
                        {taskSteps[selectedStep - 1]?.discuss?.openingQ && (
                          <div className="chat-row ai">
                            <div className="chat-bubble">{taskSteps[selectedStep - 1].discuss!.openingQ}</div>
                          </div>
                        )}
                        {discussQs.map((q, i) => (
                          <React.Fragment key={`d${i}`}>
                            <div className="chat-row stu">
                              <div className="chat-bubble">{stripDiscussTag(q.question)}</div>
                            </div>
                            {q.answer && (
                              <div className="chat-row ai">
                                <div className="chat-bubble">{q.answer}</div>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                    {/* AI Q&A section (non-discuss) */}
                    {askQs.length > 0 && (
                      <>
                        <div className="mod-h">{discussQs.length > 0 ? 'AI 提问' : 'AI 对话'} · {askQs.length} 轮</div>
                        {askQs.map((q, i) => (
                          <React.Fragment key={`a${i}`}>
                            <div className="chat-row stu">
                              <div className="who">{q.studentName}{q.category && <span className={`cat-badge ${getCatBadgeClass(q.category)}`} style={{ marginLeft: 6 }}>{q.category}</span>}</div>
                              <div className="chat-bubble">{q.question}</div>
                            </div>
                            {q.answer && (
                              <div className="chat-row ai">
                                <div className="who">AI 助教</div>
                                <div className="chat-bubble">{q.answer}</div>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mod-h">班级对比 · {journeySteps[selectedStep - 1]?.label || `Step ${selectedStep}`}</div>
                    <div className="class-compare">
                      <CompareBar label="正确率" studentVal={selTotal} classVal={classAvgScore} max={100} unit="%" color={selTotal < classAvgScore - 15 ? 'var(--amber-dot)' : selTotal >= classAvgScore ? 'var(--green-dot)' : 'var(--blue)'} />
                      <CompareBar label="AI 轮次" studentVal={studentAiForStep} classVal={classAvgAi} max={Math.max(studentAiForStep, classAvgAi, 1) * 1.5} unit="" color="var(--ai-dot)" />
                      <div className="cc-legend">
                        <div className="cc-legend-item"><span className="d" style={{ background: 'var(--blue)' }} />该学生</div>
                        <div className="cc-legend-item"><span className="d" style={{ background: 'var(--border-strong)', opacity: 0.5 }} />班级</div>
                        <div className="cc-legend-item"><span style={{ width: 2, height: 8, borderRadius: 1, background: 'var(--t3)', flexShrink: 0 }} />中位数</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CompareBar({ label, studentVal, classVal, max, unit, color }: {
  label: string; studentVal: number; classVal: number; max: number; unit: string; color: string
}) {
  const effectiveMax = max || 1
  return (
    <div className="cc-row">
      <span className="cc-label">{label}</span>
      <div className="cc-bar-wrap">
        <div className="cc-bar-bg" />
        {classVal > 0 && <div className="cc-bar-class" style={{ width: `${(classVal / effectiveMax) * 100}%` }} />}
        {studentVal > 0 && <div className="cc-bar-student" style={{ width: `${(studentVal / effectiveMax) * 100}%`, background: color }} />}
        {classVal > 0 && <div className="cc-marker" style={{ left: `${(classVal / effectiveMax) * 100}%` }} />}
      </div>
      <span className="cc-val">{studentVal}{unit}</span>
    </div>
  )
}
