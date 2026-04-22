import React, { useState, useEffect, useMemo } from 'react'
import type { ReadingManifest, ReadingStep } from '../../types/reading'
import { useTeacherStream } from '../../hooks/useClassroom'
import type { ClassroomState } from '../../hooks/useClassroom'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
  classroomState?: ClassroomState | null
  sessionCode?: string
}

// ── Derived data helpers ──

function computeHealthCards(state: ClassroomState | null) {
  if (!state || !state.students.length) {
    return { fastest: { step: 0, count: 0 }, median: { step: 0, pct: 0 }, stuck: { count: 0, where: '' }, ai: { rounds: 0, people: 0 } }
  }
  const tasks = state.students.map(s => s.currentTask)
  const maxTask = Math.max(...tasks)
  const fastCount = tasks.filter(t => t === maxTask).length

  const sorted = [...tasks].sort((a, b) => a - b)
  const medTask = sorted[Math.floor(sorted.length / 2)]
  const medPct = Math.round((tasks.filter(t => t === medTask).length / tasks.length) * 100)

  const now = Date.now()
  const stuckStudents = state.students.filter(s => {
    if (!s.stepStartedAt) return false
    return (now - new Date(s.stepStartedAt).getTime()) > 3 * 60 * 1000
  })
  const stuckTasks = stuckStudents.map(s => s.currentTask)
  const stuckMode = stuckTasks.length ? mostCommon(stuckTasks) : 0

  return {
    fastest: { step: maxTask, count: fastCount },
    median: { step: medTask, pct: medPct },
    stuck: { count: stuckStudents.length, where: stuckMode ? `T${stuckMode}` : '' },
    ai: { rounds: state.questions.length, people: new Set(state.questions.map(q => q.studentId)).size },
  }
}

function mostCommon(arr: number[]): number {
  const counts: Record<number, number> = {}
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
  return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 0)
}

type StudentStatus = 'done' | 'prog' | 'stuck' | 'reading'

function getStudentStatus(student: ClassroomState['students'][0], stepNum: number): StudentStatus {
  const sub = student.submissions
  if (sub && sub[stepNum]?.score) return 'done'
  if (student.currentTask !== stepNum) return 'done' // past this step
  if (student.stepStartedAt) {
    const elapsed = Date.now() - new Date(student.stepStartedAt).getTime()
    if (elapsed > 3 * 60 * 1000) return 'stuck'
  }
  if (student.currentPhase === 'listen') return 'reading'
  return 'prog'
}

function getStudentGlobalStatus(student: ClassroomState['students'][0]): StudentStatus {
  if (student.stepStartedAt) {
    const elapsed = Date.now() - new Date(student.stepStartedAt).getTime()
    if (elapsed > 3 * 60 * 1000) return 'stuck'
  }
  if (student.currentPhase === 'listen') return 'reading'
  const sub = student.submissions
  if (sub && sub[student.currentTask]?.score) return 'done'
  return 'prog'
}

function hasAI(student: ClassroomState['students'][0], questions: ClassroomState['questions']): boolean {
  return questions.some(q => q.studentId === student.id)
}

function getCatBadgeClass(cat: string): string {
  switch (cat) {
    case '概念理解': return 'concept'
    case '阅读策略': return 'strategy'
    case '课文内容': return 'content'
    case '解题求助': return 'task-help'
    default: return 'other'
  }
}

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  return `${Math.floor(mins / 60)}小时前`
}

// ── Main component ──

export default function TeacherShell({ manifest, embed, classroomState, sessionCode }: Props) {
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [modalStudent, setModalStudent] = useState<string | null>(null)
  const [stepModalNum, setStepModalNum] = useState<number | null>(null)
  const [coachOpen, setCoachOpen] = useState(false)

  // Self-fetch classroom state via SSE when not provided as prop
  const { state: streamState } = useTeacherStream(sessionCode || '')
  const state = classroomState || streamState || null
  const students = state?.students || []
  const questions = state?.questions || []
  const total = students.length

  const health = useMemo(() => computeHealthCards(state), [state])

  // Build step card data
  const stepCards = useMemo(() => {
    return manifest.readingSteps.map((rs, i) => {
      const stepNum = i + 1
      const inStep = students.filter(s => s.currentTask === stepNum)
      const doneCount = students.filter(s => {
        const sub = s.submissions
        return sub && sub[stepNum]?.score
      }).length
      const stuckCount = inStep.filter(s => {
        if (!s.stepStartedAt) return false
        return (Date.now() - new Date(s.stepStartedAt).getTime()) > 3 * 60 * 1000
      }).length
      const metrics = state?.stepMetrics?.[stepNum]
      const avgScore = metrics?.avgScore ?? 0
      const aiRoundsForStep = questions.filter(q => q.step === stepNum).length
      const aiPeopleForStep = new Set(questions.filter(q => q.step === stepNum).map(q => q.studentId)).size
      return {
        step: rs,
        stepNum,
        studentsInStep: inStep,
        doneCount,
        activeCount: inStep.length,
        stuckCount,
        avgScore,
        aiRounds: aiRoundsForStep,
        aiPeople: aiPeopleForStep,
        completionRate: metrics?.completionRate ?? 0,
      }
    })
  }, [manifest, students, state, questions])

  // Question queue grouped by category
  const queueByCategory = useMemo(() => {
    const grouped: Record<string, Array<{ studentName: string; question: string; answer?: string; category: string; timestamp: string }>> = {}
    for (const q of questions) {
      const cat = q.category || '其他'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push({ studentName: q.studentName, question: q.question, answer: q.answer, category: cat, timestamp: q.timestamp })
    }
    return grouped
  }, [questions])

  const [expandedQ, setExpandedQ] = useState<string | null>(null)

  const totalQuestions = questions.length

  // Listen for sync messages
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') setActiveStep(d.step + 1)
    }
    window.addEventListener('message', onMessage)
    try { window.parent?.postMessage({ type: 'ready', role: 'teacher' }, '*') } catch { /* noop */ }
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Modal student data
  const modalStudentData = useMemo(() => {
    if (!modalStudent) return null
    return students.find(s => s.name === modalStudent) || null
  }, [modalStudent, students])

  // ── EMPTY STATE ──
  if (!state || students.length === 0) {
    return (
      <div className="teacher-root">
        {!embed && <Band manifest={manifest} total={0} sessionCode={sessionCode} />}
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h2>等待学生加入…</h2>
          <p>课堂码: <strong>{sessionCode || '—'}</strong></p>
          <p>学生可通过 /join 页面输入课堂码加入</p>
        </div>
      </div>
    )
  }

  return (
    <div className="teacher-root">
      {/* ═══ BAND ═══ */}
      {!embed && <Band manifest={manifest} total={total} sessionCode={sessionCode} />}

      {/* ═══ TIMELINE ═══ */}
      <Timeline steps={manifest.readingSteps} />

      {/* ═══ BODY ═══ */}
      <div className="body">
        {/* ── Focus (left) ── */}
        <div className="focus">
          {/* Health Cards */}
          <div className="health">
            <div className="hcard good">
              <div className="hcard-lb">最快进度</div>
              <div className="hcard-v">T{health.fastest.step}</div>
              <div className="hcard-sub"><strong>{health.fastest.count} 人</strong>已到达</div>
            </div>
            <div className="hcard">
              <div className="hcard-lb">中位进度</div>
              <div className="hcard-v">T{health.median.step}</div>
              <div className="hcard-sub"><strong>{health.median.pct}%</strong> 学生在此</div>
            </div>
            <div className={`hcard${health.stuck.count > 0 ? ' warn' : ''}`}>
              <div className="hcard-lb">卡点学生</div>
              <div className="hcard-v">{health.stuck.count}</div>
              <div className="hcard-sub">{health.stuck.where ? `集中在 ${health.stuck.where}` : '暂无卡点'}</div>
            </div>
            <div className="hcard">
              <div className="hcard-lb">AI 对话</div>
              <div className="hcard-v">{health.ai.rounds} 轮</div>
              <div className="hcard-sub"><strong>{health.ai.people}</strong> 人触发</div>
            </div>
          </div>

          {/* ═══ STEP CARDS ═══ */}
          <div>
            <div className="sh" style={{ marginBottom: 6 }}>
              <span className="sh-lb">课堂进程 · 按 Step</span>
              <span className="sh-meta">点击展开详情</span>
            </div>
            <div className="step-cards">
              {stepCards.map(sc => {
                const isActive = activeStep === sc.stepNum
                const hasAlert = sc.stuckCount >= 5
                return (
                  <div
                    key={sc.stepNum}
                    className={`step-card${isActive ? ' active' : ''}${hasAlert ? ' has-alert' : ''}`}
                    onClick={() => setStepModalNum(sc.stepNum)}
                  >
                    <div className="sc-head">
                      <span className="sc-sn task">{sc.stepNum}</span>
                      <span className="sc-name">{sc.step.label}</span>
                      <span className="sc-type">{sc.step.duration} min · {sc.step.strategy || 'task'}</span>
                      <div className="sc-badges">
                        <span className={`sc-badge student-count${sc.activeCount >= 20 ? ' major' : ''}`}>{sc.activeCount} 人</span>
                        <span className={`sc-badge ai-rounds${sc.aiRounds >= 20 ? ' hot' : ''}`}>
                          <span className="pip" style={{ background: 'var(--ai-dot)' }} />{sc.aiRounds} 轮
                        </span>
                        {sc.stuckCount >= 5 && <span className="sc-badge alert-tag">{sc.stuckCount} 人卡住</span>}
                      </div>
                    </div>
                    <div className="sc-metrics">
                      <span className="sc-metric">
                        正确率{' '}
                        <strong style={{ color: sc.avgScore >= 80 ? 'var(--green)' : sc.avgScore >= 50 ? 'var(--amber)' : sc.avgScore > 0 ? 'var(--red)' : 'var(--t3)' }}>
                          {sc.avgScore > 0 ? `${Math.round(sc.avgScore)}%` : '—'}
                        </strong>
                      </span>
                      <span className="sc-metric">AI <strong>{sc.aiPeople}</strong> 人触发</span>
                    </div>
                    {sc.studentsInStep.length > 0 && (
                      <div className="sc-dots">
                        {sc.studentsInStep.map(s => {
                          const status = getStudentGlobalStatus(s)
                          const ai = hasAI(s, questions)
                          return (
                            <div
                              key={s.id}
                              className={`sdot ${status}`}
                              title={s.name}
                              onClick={(e) => { e.stopPropagation(); setModalStudent(s.name) }}
                            >
                              {s.name.substring(0, 3)}
                              {ai && <span className="ai-pip" />}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="swim-legend" style={{ marginTop: 6 }}>
              <div className="swim-legend-item"><span className="dot" style={{ background: 'var(--green-dot)' }} />已完成</div>
              <div className="swim-legend-item"><span className="dot" style={{ background: 'var(--blue)' }} />进行中</div>
              <div className="swim-legend-item"><span className="dot" style={{ background: 'var(--lecture)' }} />阅读中</div>
              <div className="swim-legend-item"><span className="dot" style={{ background: 'var(--amber-dot)' }} />卡住</div>
              <div className="swim-legend-item"><span className="dot" style={{ background: 'var(--ai-dot)', width: 6, height: 6, borderRadius: '50%' }} />AI 对话中</div>
            </div>
          </div>

          {/* ═══ PATTERNS ═══ */}
          <div>
            <div className="sh" style={{ marginBottom: 6 }}><span className="sh-lb">观察要点</span></div>
            <div className="patterns">
              <div className="pat">
                <div className="pat-h info"><span className="dot" />暂无模式识别</div>
                <div className="pat-body">需要更多数据来生成教学洞察。</div>
              </div>
              <div className="pat">
                <div className="pat-h info"><span className="dot" />数据收集中</div>
                <div className="pat-body">观察要点将随课堂进度自动生成。</div>
              </div>
            </div>
          </div>

          {/* ═══ COACHING ═══ */}
          <div className="coaching">
            <div className={`coaching-toggle${coachOpen ? ' open' : ''}`} onClick={() => setCoachOpen(!coachOpen)}>
              <span className="arrow">▶</span> 教学参考 · 低优先级
            </div>
            <div className={`coaching-body${coachOpen ? ' open' : ''}`}>
              <div className="coach-line">
                <div className="coach-line-lb">暂无教学建议</div>
                <div className="coach-line-text">教学建议将根据课堂数据自动生成。</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Overview (right) ── */}
        <div className="overview">
          <div className="ov-body">
            <div className="queue-section">
              <div className="queue-h">
                <span className="lb">问题聚类 · 按分类</span>
                <span className="cnt">{totalQuestions}</span>
              </div>
              <div className="queue">
                {totalQuestions === 0 && (
                  <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: 'var(--t3)' }}>
                    暂无学生提问
                  </div>
                )}
                {Object.entries(queueByCategory).map(([cat, items]) => (
                  <div key={cat}>
                    <div className="q-step-h">
                      <span className={`cat-badge ${getCatBadgeClass(cat)}`}>{cat}</span>
                      <span className="tot">{items.length}</span>
                    </div>
                    {items.map((item, qi) => {
                      const qKey = `${cat}:${qi}`
                      const isExpanded = expandedQ === qKey
                      return (
                        <div key={qi}>
                          <div className="qrow" onClick={() => setExpandedQ(isExpanded ? null : qKey)}>
                            <span className="q-student">{item.studentName}</span>
                            <div className="qq">{item.question}</div>
                            <span className="qmeta">{formatRelative(item.timestamp)}</span>
                          </div>
                          {isExpanded && item.answer && (
                            <div className="q-answer">
                              <span className="q-answer-label">AI 回答：</span>
                              {item.answer}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ STEP DETAIL MODAL ═══ */}
      {stepModalNum !== null && (
        <StepDetailModal
          stepNum={stepModalNum}
          manifest={manifest}
          state={state}
          questions={questions}
          onClose={() => setStepModalNum(null)}
          onStudentClick={(name) => { setStepModalNum(null); setModalStudent(name) }}
        />
      )}

      {/* ═══ STUDENT MODAL ═══ */}
      {modalStudent && modalStudentData && (
        <StudentModal
          student={modalStudentData}
          manifest={manifest}
          state={state}
          questions={questions}
          onClose={() => setModalStudent(null)}
        />
      )}
    </div>
  )
}

// ═══ BAND ═══
function Band({ manifest, total, sessionCode }: { manifest: ReadingManifest; total: number; sessionCode?: string }) {
  return (
    <div className="band">
      <div className="band-mark">R</div>
      <div className="band-title">课堂观察台</div>
      <div className="band-mode">观察模式</div>
      <div className="band-self">学生自主推进</div>
      <div className="band-class">
        {sessionCode && <>{sessionCode} · </>}
        {manifest.title} · {total} 人 · {manifest.readingSteps.length} Tasks
      </div>
      <div className="band-right">
        <div className="band-live">实时同步中</div>
      </div>
    </div>
  )
}

// ═══ TIMELINE ═══
function Timeline({ steps }: { steps: ReadingStep[] }) {
  const markers = steps.map((_, i) => ((i + 1) / steps.length) * 100)
  return (
    <div className="timeline">
      <button className="tl-btn">◀</button>
      <div className="tl-time">00:00</div>
      <div className="tl-track-wrap">
        <div className="tl-track">
          {markers.slice(0, -1).map((pos, i) => (
            <div key={i} className="tl-marker task" style={{ left: `${pos}%` }} />
          ))}
          <div className="tl-fill" style={{ width: '0%' }} />
        </div>
        <div className="tl-thumb" style={{ left: '0%' }} />
      </div>
      <div className="tl-total">45:00</div>
      <div className="tl-label" style={{ color: 'var(--green)' }}>实时</div>
      <button className="tl-btn">▶</button>
    </div>
  )
}

// ═══ STEP DETAIL MODAL ═══
function StepDetailModal({ stepNum, manifest, state, questions, onClose, onStudentClick }: {
  stepNum: number
  manifest: ReadingManifest
  state: ClassroomState
  questions: ClassroomState['questions']
  onClose: () => void
  onStudentClick: (name: string) => void
}) {
  const step = manifest.readingSteps[stepNum - 1]
  if (!step) return null
  const metrics = state.stepMetrics?.[stepNum]
  const inStep = state.students.filter(s => s.currentTask === stepNum)
  const stuckCount = inStep.filter(s => {
    if (!s.stepStartedAt) return false
    return (Date.now() - new Date(s.stepStartedAt).getTime()) > 3 * 60 * 1000
  }).length
  const aiRounds = questions.filter(q => q.step === stepNum).length
  const aiPeople = new Set(questions.filter(q => q.step === stepNum).map(q => q.studentId)).size
  const avgScore = metrics?.avgScore ?? 0

  // Issues
  const issues: string[] = []
  if (stuckCount > 0) issues.push(`${stuckCount} 人卡住`)
  if (avgScore > 0 && avgScore < 60) issues.push(`平均正确率偏低 (${Math.round(avgScore)}%)`)

  return (
    <div className="overlay2" onClick={(e) => { if ((e.target as HTMLElement).classList.contains('overlay2')) onClose() }}>
      <div className="modal2">
        <div className="m2-hd">
          <span className="sc-sn task">{stepNum}</span>
          <span className="m2-title">{step.label}</span>
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

          {/* Quality bars */}
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

// ═══ STUDENT MODAL ═══
function StudentModal({ student, manifest, state, questions, onClose }: {
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
      const isStuck = student.stepStartedAt && (Date.now() - new Date(student.stepStartedAt).getTime()) > 3 * 60 * 1000
      if (isStuck) return { sn, label: rs.label, status: 'stuck' as const, result: 'partial' as const, score: sub?.score?.total ?? 0 }
      return { sn, label: rs.label, status: 'prog' as const, result: 'partial' as const, score: sub?.score?.total ?? 0 }
    }
    return { sn, label: rs.label, status: 'future' as const, result: 'future' as const, score: 0 }
  })

  // Needs attention?
  const needsAttn = (js: typeof journeySteps[0]) =>
    js.status !== 'future' && (js.result === 'partial' || js.status === 'stuck')

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

// ── Compare Bar ──
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

