import { useState, useEffect } from 'react'
import type { ReadingManifest } from '../../types/reading'
import type { ClassroomState } from '../../hooks/useClassroom'
import { STUCK_THRESHOLD_MS, getStudentGlobalStatus, hasAI, getStepName } from './teacher-helpers'

export function StepDetailModal({ stepNum, manifest, state, questions, onClose, onStudentClick }: {
  stepNum: number
  manifest: ReadingManifest
  state: ClassroomState
  questions: ClassroomState['questions']
  onClose: () => void
  onStudentClick: (name: string) => void
}) {
  const taskSteps = manifest.readingSteps
    .filter(rs => rs.type === 'task')
    .sort((a, b) => a.idx - b.idx)
  const step = taskSteps[stepNum - 1]
  if (!step) return null
  const metrics = state.stepMetrics?.[stepNum] as any
  const inStep = state.students.filter(s => s.currentTask === stepNum)
  const stuckCount = inStep.filter(s => {
    if (!s.stepStartedAt) return false
    return (Date.now() - new Date(s.stepStartedAt).getTime()) > STUCK_THRESHOLD_MS
  }).length
  const aiRounds = questions.filter(q => q.step === stepNum).length
  const aiPeople = new Set(questions.filter(q => q.step === stepNum).map(q => q.studentId)).size
  const avgScore = metrics?.avgScore ?? 0

  // Dimension bars from byDimension (already human-readable keys from backend)
  const byDimension: Record<string, { good: number; partial: number; wrong: number }> = metrics?.byDimension || {}
  const dimEntries = Object.entries(byDimension)

  // Group dimensions by their group key (from dimensionLabels mapping)
  const dimensionLabels: Record<string, string> = metrics?.dimensionLabels || {}

  // Issues (from backend + local stuck/score checks)
  const backendIssues: string[] = metrics?.issues || []
  const issues: string[] = [...backendIssues]
  if (stuckCount > 0 && !issues.some(i => i.includes('卡住'))) issues.unshift(`${stuckCount} 人卡住`)
  if (avgScore > 0 && avgScore < 60 && !issues.some(i => i.includes('正确率'))) issues.push(`平均正确率偏低 (${Math.round(avgScore)}%)`)

  // Surfaces (on-demand fetch)
  const [surfaces, setSurfaces] = useState<Record<string, any[]> | null>(null)
  const [surfaceLoading, setSurfaceLoading] = useState(false)
  const hasSurfaces = (step as any).answerKey?.type === 'map'

  const fetchSurfaces = () => {
    if (surfaceLoading || surfaces) return
    setSurfaceLoading(true)
    const code = (state as any).sessionCode || window.location.pathname.split('/session/')[1]?.split('/')[0]
    if (!code) { setSurfaceLoading(false); return }
    fetch(`/api/classroom/${code}/steps/${stepNum}/surfaces`)
      .then(r => r.json())
      .then(data => { setSurfaces(data); setSurfaceLoading(false) })
      .catch(() => setSurfaceLoading(false))
  }

  return (
    <div className="overlay2" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('overlay2')) onClose() }}>
      <div className="modal2">
        <div className="m2-hd">
          <span className="m2-title">{getStepName(step)}</span>
          <span className="m2-desc">{step.duration} min · {step.strategy || 'task'}</span>
          <span className="m2-cls" onClick={onClose}>关闭 ✕</span>
        </div>
        <div className="m2-body">
          <div className="m2-stats">
            <div className="m2-stat"><div className="m2-stat-n">{inStep.length}</div><div className="m2-stat-lb">当前人数</div></div>
            <div className="m2-stat"><div className="m2-stat-n">{step.duration}:00</div><div className="m2-stat-lb">预设时长</div></div>
            <div className="m2-stat"><div className="m2-stat-n" style={{ color: aiRounds >= 20 ? 'var(--amber)' : undefined }}>{aiRounds}</div><div className="m2-stat-lb">AI 对话轮</div></div>
            <div className="m2-stat"><div className="m2-stat-n">{aiPeople}</div><div className="m2-stat-lb">AI 触发人数</div></div>
          </div>

          {/* Quality bars — overall + per dimension */}
          {avgScore > 0 && (
            <div className="m2-section">
              <div className="m2-section-h">正确率</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: 'var(--t2)', width: 100, flexShrink: 0, fontWeight: 500 }}>总体</span>
                <div style={{ flex: 1, height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${Math.round(avgScore)}%`, height: '100%', background: 'var(--green-dot)' }} />
                  <div style={{ width: `${Math.min(20, Math.round((100 - avgScore) * 0.4))}%`, height: '100%', background: 'var(--amber-dot)' }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', width: 30, textAlign: 'right' }}>{Math.round(avgScore)}%</span>
              </div>
              {dimEntries.map(([name, dim]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--t2)', width: 100, flexShrink: 0, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${dim.good}%`, height: '100%', background: 'var(--green-dot)' }} />
                    <div style={{ width: `${dim.partial}%`, height: '100%', background: 'var(--amber-dot)' }} />
                    <div style={{ width: `${dim.wrong}%`, height: '100%', background: 'var(--red-dot, #e74c3c)' }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--t3)', width: 30, textAlign: 'right' }}>{dim.good}%</span>
                </div>
              ))}
            </div>
          )}

          {/* Attempt difficulty */}
          {metrics?.attemptMetrics && Object.keys(metrics.attemptMetrics).length > 0 && (
            <div className="m2-section">
              <div className="m2-section-h">尝试难度</div>
              {Object.entries(metrics.attemptMetrics).map(([dim, m]: [string, any]) => (
                <div key={dim} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 10, width: 100, flexShrink: 0, fontWeight: 500, color: 'var(--t2)' }}>{dim}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: m.avgAttempts >= 2 ? 'var(--amber)' : 'var(--t2)' }}>
                    平均 {m.avgAttempts} 次
                  </span>
                  {m.walkthroughRate > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--blue)' }}>
                      {m.walkthroughRate}% 需手把手
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Issues */}
          {issues.length > 0 && (
            <div className="m2-section">
              <div className="m2-section-h">主要问题</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {issues.map((iss, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.45, padding: '6px 8px', background: 'var(--surface)', borderRadius: 5, borderLeft: '2px solid var(--amber-dot)' }}>{iss}</div>
                ))}
              </div>
            </div>
          )}

          {/* Surfaces (on-demand for map type) */}
          {hasSurfaces && (
            <div className="m2-section">
              <div className="m2-section-h" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                深度数据
                {!surfaces && (
                  <span
                    onClick={fetchSurfaces}
                    style={{ fontSize: 10, color: 'var(--blue)', cursor: 'pointer', fontWeight: 400 }}
                  >
                    {surfaceLoading ? '加载中...' : '点击加载'}
                  </span>
                )}
              </div>
              {surfaces && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Reasoning */}
                  {surfaces.reasoning?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>Student Reasoning</div>
                      <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {surfaces.reasoning.map((r: any, i: number) => (
                          <div key={i} style={{ fontSize: 10, color: 'var(--t2)', padding: '3px 6px', background: 'var(--surface)', borderRadius: 4 }}>
                            <span style={{ fontWeight: 500 }}>{r.studentName}</span>
                            {r.itemId && <span style={{ color: 'var(--t3)', marginLeft: 4 }}>[{r.itemId}]</span>}
                            <span style={{ marginLeft: 4 }}>{r.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* LLM Feedback */}
                  {surfaces.llmFeedback?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>AI 评语</div>
                      <div style={{ maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {surfaces.llmFeedback.map((f: any, i: number) => (
                          <div key={i} style={{ fontSize: 10, color: 'var(--t2)', padding: '3px 6px', background: 'var(--surface)', borderRadius: 4 }}>
                            <span style={{ fontWeight: 500 }}>{f.studentName}:</span>
                            <span style={{ marginLeft: 4 }}>{f.feedback}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Positions */}
                  {surfaces.positions?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>Placement Distribution</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                        {surfaces.positions.length} placements from {new Set(surfaces.positions.map((p: any) => p.studentId)).size} students
                      </div>
                    </div>
                  )}
                  {Object.keys(surfaces).length === 0 && (
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>暂无深度数据</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Students in step */}
          {inStep.length > 0 && (
            <div className="m2-section">
              <div className="m2-section-h">当前在此步的学生</div>
              <div className="m2-students">
                {inStep.map(s => {
                  const status = getStudentGlobalStatus(s)
                  const ai = hasAI(s, questions)
                  return (
                    <div
                      key={s.id}
                      className={`sdot ${status}`}
                      onClick={() => onStudentClick(s.name)}
                      title={s.name}
                    >
                      {s.name.substring(0, 3)}
                      {ai && <span className="ai-pip" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
