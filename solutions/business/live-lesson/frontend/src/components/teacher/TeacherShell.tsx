import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useTeacherStream } from '../../hooks/useClassroom'
import type { ClassroomState, StateSnapshot } from '../../hooks/useClassroom'
import { STUCK_THRESHOLD_MS, computeHealthCards, getStudentGlobalStatus, hasAI, getCatBadgeClass, formatRelative, getStepName } from './teacher-helpers'
import { Band } from './Band'
import { Timeline } from './Timeline'
import { ObservationPanel } from './ObservationPanel'
import { StepDetailModal } from './StepDetailModal'
import { StudentModal } from './StudentModal'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
  classroomState?: ClassroomState | null
  sessionCode?: string
}

export default function TeacherShell({ manifest, embed, classroomState, sessionCode }: Props) {
  const [activeStep, setActiveStep] = useState<number | null>(null)
  const [modalStudent, setModalStudent] = useState<string | null>(null)
  const [stepModalNum, setStepModalNum] = useState<number | null>(null)
  const [coachOpen, setCoachOpen] = useState(false)

  // Self-fetch classroom state via SSE when not provided as prop
  const { state: streamState, snapshots } = useTeacherStream(sessionCode || '')

  // Replay state management
  const [replayState, setReplayState] = useState<ClassroomState | null>(null)
  const [seekTimestamp, setSeekTimestamp] = useState<number | null>(null)
  const isLive = replayState === null

  const handleSeek = useCallback((snapshot: StateSnapshot | null) => {
    if (snapshot) {
      setReplayState(snapshot.state)
      setSeekTimestamp(snapshot.timestamp)
    } else {
      setReplayState(null)
      setSeekTimestamp(null)
    }
  }, [])

  const liveState = classroomState || streamState || null
  const state = replayState || liveState
  const students = state?.students || []
  const questions = state?.questions || []
  const total = students.length

  // Session start time: use first snapshot timestamp or fallback to mount time
  const fallbackStart = useRef(Date.now())
  const sessionStartedAt = useMemo(() => {
    if (snapshots.length > 0) return snapshots[0].timestamp
    return fallbackStart.current
  }, [snapshots])

  const stepNames = useMemo(() => {
    const map: Record<number, string> = {}
    manifest.readingSteps
      .filter(rs => rs.type === 'task')
      .sort((a, b) => a.idx - b.idx)
      .forEach((rs, i) => { map[i + 1] = getStepName(rs) })
    return map
  }, [manifest])

  const health = useMemo(() => computeHealthCards(state, stepNames), [state, stepNames])

  // Build step card data — only task steps (filter out instruction steps)
  const stepCards = useMemo(() => {
    const taskSteps = manifest.readingSteps
      .filter(rs => rs.type === 'task')
      .sort((a, b) => a.idx - b.idx)
    return taskSteps.map((rs, i) => {
      const taskNum = i + 1           // 1-5, matches backend currentTask & stepMetrics keys
      const stepIdx = rs.idx          // raw idx for submission & question lookup
      const inStep = students.filter(s => s.currentTask === taskNum)
      const doneCount = students.filter(s => {
        return s.submissions?.[stepIdx]?.score
      }).length
      const stuckCount = inStep.filter(s => {
        if (!s.stepStartedAt) return false
        return (Date.now() - new Date(s.stepStartedAt).getTime()) > STUCK_THRESHOLD_MS
      }).length
      const metrics = state?.stepMetrics?.[taskNum]
      const avgScore = metrics?.avgScore ?? 0
      const aiRoundsForStep = questions.filter(q => q.step === stepIdx).length
      const aiPeopleForStep = new Set(questions.filter(q => q.step === stepIdx).map(q => q.studentId)).size
      return {
        step: rs,
        stepNum: taskNum,
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

      {/* ═══ REPLAY BANNER ═══ */}
      {!isLive && seekTimestamp && (
        <div className="replay-banner">
          回放中 · {new Date(seekTimestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          <span style={{ marginLeft: 8, cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleSeek(null)}>回到实时</span>
        </div>
      )}

      {/* ═══ TIMELINE ═══ */}
      <Timeline
        steps={manifest.readingSteps.filter(rs => rs.type === 'task')}
        snapshots={snapshots}
        sessionStartedAt={sessionStartedAt}
        isLive={isLive}
        seekTimestamp={seekTimestamp}
        onSeek={handleSeek}
      />

      {/* ═══ BODY ═══ */}
      <div className="body">
        {/* ── Focus (left) ── */}
        <div className="focus">
          {/* Health Cards */}
          <div className="health">
            <div className="hcard good">
              <div className="hcard-lb">最快进度</div>
              <div className="hcard-v">{health.fastest.step}</div>
              <div className="hcard-sub"><strong>{health.fastest.count} 人</strong>已到达</div>
            </div>
            <div className="hcard">
              <div className="hcard-lb">中位进度</div>
              <div className="hcard-v">{health.median.step}</div>
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
                      <span className="sc-name">{getStepName(sc.step)}</span>
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

          {/* ═══ OBSERVATION PANEL ═══ */}
          <ObservationPanel state={state} />

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
