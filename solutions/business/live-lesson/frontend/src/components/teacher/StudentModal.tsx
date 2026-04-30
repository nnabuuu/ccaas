import React, { useState } from 'react'
import type { ReadingManifest } from '../../types/reading'
import type { ClassroomState } from '../../hooks/useClassroom'
import { STUCK_THRESHOLD_MS, getCatBadgeClass } from './teacher-helpers'

export function StudentModal({ student, manifest, state, questions, onClose }: {
  student: ClassroomState['students'][0]
  manifest: ReadingManifest
  state: ClassroomState
  questions: ClassroomState['questions']
  onClose: () => void
}) {
  const [selectedStep, setSelectedStep] = useState(student.currentTask)
  const stepName = manifest.readingSteps[student.currentTask - 1]?.label || `Step ${student.currentTask}`
  const studentQuestions = questions.filter(q => q.studentId === student.id)

  // Per-step status for journey strip
  const journeySteps = manifest.readingSteps.map((rs, i) => {
    const sn = i + 1
    const sub = student.submissions?.[sn]
    if (sn < student.currentTask) {
      const score = sub?.score?.total ?? 0
      if (score >= 80) return { sn, label: rs.label, status: 'done' as const, result: 'correct' as const, score }
      if (score >= 40) return { sn, label: rs.label, status: 'done' as const, result: 'partial' as const, score }
      if (sub) return { sn, label: rs.label, status: 'done' as const, result: 'partial' as const, score }
      return { sn, label: rs.label, status: 'done' as const, result: 'correct' as const, score: 0 }
    }
    if (sn === student.currentTask) {
      const isStuck = student.stepStartedAt && (Date.now() - new Date(student.stepStartedAt).getTime()) > STUCK_THRESHOLD_MS
      if (isStuck) return { sn, label: rs.label, status: 'stuck' as const, result: 'partial' as const, score: sub?.score?.total ?? 0 }
      return { sn, label: rs.label, status: 'prog' as const, result: 'partial' as const, score: sub?.score?.total ?? 0 }
    }
    return { sn, label: rs.label, status: 'future' as const, result: 'future' as const, score: 0 }
  })

  // Needs attention?
  const needsAttn = (js: typeof journeySteps[0]) =>
    js.status !== 'future' && (js.result === 'partial' || (js.status as string) === 'stuck')

  // Selected step data
  const selSub = student.submissions?.[selectedStep]
  const selByDim = selSub?.score?.byDimension || {}
  const selTotal = selSub?.score?.total ?? 0

  // Class compare data
  const stepMetrics = state.stepMetrics?.[selectedStep]
  const classAvgScore = stepMetrics?.avgScore ?? 0
  const stepQuestions = questions.filter(q => q.step === selectedStep)
  const classAvgAi = stepQuestions.length > 0 ? Math.round(stepQuestions.length / Math.max(1, new Set(stepQuestions.map(q => q.studentId)).size)) : 0
  const studentAiForStep = studentQuestions.filter(q => q.step === selectedStep).length

  return (
    <div className="overlay" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('overlay')) onClose() }}>
      <div className="modal">
        {/* Header */}
        <div className="mod-hd">
          <div className="mod-av">{student.name[0]}</div>
          <div className="mod-ti">
            <div className="mod-ti-n">{student.name}</div>
            <div className="mod-ti-m">当前在 Step {student.currentTask} · {stepName}</div>
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
                      <span className="jn-sn task">{js.sn}</span>
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
                       js.status === 'prog' ? ' 进行中' :
                       js.status === 'stuck' ? ' 需关注' : ' 未到达'}
                    </div>
                    {js.status !== 'future' && js.score > 0 && (
                      <div className="jn-meta"><span>{js.score}%</span></div>
                    )}
                  </div>
                </React.Fragment>
              )
            })}
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
                <div className="mod-h">作答详情 · Step {selectedStep}</div>
                {selSub ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: selTotal >= 80 ? 'var(--green)' : selTotal >= 50 ? 'var(--amber)' : 'var(--red)', marginBottom: 8 }}>
                      得分: {selTotal}%
                    </div>
                    {Object.entries(selByDim).map(([key, val]: [string, unknown]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                        <span className={`result-badge ${val ? 'correct' : 'wrong'}`}>{val ? '✓' : '✗'}</span>
                        <span style={{ color: 'var(--t2)' }}>{key}</span>
                      </div>
                    ))}
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
                {studentQuestions.filter(q => q.step === selectedStep).length > 0 ? (
                  <>
                    <div className="mod-h">AI 对话 · {studentQuestions.filter(q => q.step === selectedStep).length} 轮</div>
                    {studentQuestions.filter(q => q.step === selectedStep).map((q, i) => (
                      <React.Fragment key={i}>
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
                ) : (
                  <>
                    <div className="mod-h">班级对比 · Step {selectedStep}</div>
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
