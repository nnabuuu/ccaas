import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useTeacherPolling } from '../../hooks/useClassroom'
import type { ClassroomState, StateSnapshot } from '../../hooks/useClassroom'
import {
  STUCK_THRESHOLD_MS, computeHealthCards, getStudentGlobalStatus, hasAI,
  getCatBadgeClass, formatRelative, getStepName, computePhaseDistribution,
  getObserveType, clusterQuestions,
} from './teacher-helpers'
import { Band } from './Band'
import { Timeline } from './Timeline'
import { ObservationPanel } from './ObservationPanel'
import { StudentModal } from './StudentModal'
import { SummaryTab } from './summary/SummaryTab'
import { CoachingPanel } from './CoachingPanel'
import { useSearchParams } from 'react-router-dom'

const ObserveDrawer = lazy(() => import('./observe/ObserveDrawer'))
const SummaryOverlay = lazy(() => import('./summary/SummaryOverlay'))

type RightTab = 'questions' | 'observation' | 'students' | 'coaching'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
  classroomState?: ClassroomState | null
  sessionCode?: string
  onEndSession?: () => void
  ending?: boolean
}

export default function TeacherShell({ manifest, embed, classroomState, sessionCode, onEndSession, ending }: Props) {
  const [modalStudent, setModalStudent] = useState<string | null>(null)
  const [expandedStep, setExpandedStep] = useState<number | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('questions')

  // URL-driven observe drawer
  const [searchParams, setSearchParams] = useSearchParams()
  const VALID_OBSERVE_TYPES = useMemo(() => new Set(['mc', 'evidence', 'map', 'discuss', 'matrix']), [])
  const observeParams = useMemo(() => {
    const type = searchParams.get('observe')
    const step = searchParams.get('step')
    return type && step && VALID_OBSERVE_TYPES.has(type) ? { type, step: +step } : null
  }, [searchParams, VALID_OBSERVE_TYPES])

  const summaryOpen = searchParams.get('summary') === 'open'
  const openSummary = useCallback(() => {
    setSearchParams(prev => { prev.set('summary', 'open'); return prev })
  }, [setSearchParams])
  const closeSummary = useCallback(() => {
    setSearchParams(prev => { prev.delete('summary'); return prev })
  }, [setSearchParams])

  const openObserve = useCallback((type: string, step: number) => {
    setSearchParams(prev => {
      prev.set('observe', type)
      prev.set('step', String(step))
      return prev
    })
  }, [setSearchParams])

  const closeObserve = useCallback(() => {
    setSearchParams(prev => {
      prev.delete('observe')
      prev.delete('step')
      return prev
    })
  }, [setSearchParams])

  // Self-fetch classroom state via polling when not provided as prop
  const { state: streamState, snapshots } = useTeacherPolling(sessionCode || '')

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

  // Session start time
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

  const bonusStats = useMemo(() => {
    const active = students.filter(s => s.bonusStatus === 'active').length
    const completed = students.filter(s => s.bonusStatus === 'completed').length
    return { total: active + completed, active, completed }
  }, [students])

  // Task steps (sorted, stable reference for step mapping)
  const taskSteps = useMemo(() =>
    manifest.readingSteps
      .filter(rs => rs.type === 'task')
      .sort((a, b) => a.idx - b.idx),
    [manifest],
  )

  // Build step card data
  const stepCards = useMemo(() => {
    return taskSteps.map((rs, i) => {
      const taskNum = i + 1
      const stepIdx = rs.idx
      const inStep = students.filter(s => s.currentTask === taskNum)
      const doneCount = students.filter(s => s.submissions?.[stepIdx]?.score).length
      const stuckCount = inStep.filter(s => {
        if (!s.stepStartedAt) return false
        return (Date.now() - new Date(s.stepStartedAt).getTime()) > STUCK_THRESHOLD_MS
      }).length
      const metrics = state?.stepMetrics?.[taskNum]
      const avgScore = metrics?.avgScore ?? 0
      const aiRoundsForStep = questions.filter(q => q.step === stepIdx).length
      const aiPeopleForStep = new Set(questions.filter(q => q.step === stepIdx).map(q => q.studentId)).size
      const phaseDist = computePhaseDistribution(students, taskNum)
      return {
        step: rs,
        stepNum: taskNum,
        stepIdx,
        studentsInStep: inStep,
        doneCount,
        activeCount: inStep.length,
        stuckCount,
        avgScore,
        aiRounds: aiRoundsForStep,
        aiPeople: aiPeopleForStep,
        completionRate: metrics?.completionRate ?? 0,
        phaseDist,
      }
    })
  }, [taskSteps, students, state, questions])

  // Question clustering: filter out discuss, group by step, cluster similar questions
  const clusteredQuestions = useMemo(() => {
    const askQuestions = questions.filter(q => q.category !== 'discuss')

    const byStep: Record<number, typeof askQuestions> = {}
    for (const q of askQuestions) {
      const s = q.step ?? 0
      if (!byStep[s]) byStep[s] = []
      byStep[s].push(q)
    }

    return Object.entries(byStep)
      .map(([step, qs]) => {
        const clusters = clusterQuestions(qs)
        return { step: Number(step), clusters, total: qs.length }
      })
      .sort((a, b) => a.step - b.step)
  }, [questions])

  const totalAskQuestions = useMemo(
    () => clusteredQuestions.reduce((sum, g) => sum + g.total, 0),
    [clusteredQuestions],
  )

  const [expandedQ, setExpandedQ] = useState<string | null>(null)

  // Listen for sync messages
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') {
        // Expand the synced step
        setExpandedStep(d.step + 1)
      }
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
        {!embed && <Band manifest={manifest} total={0} sessionCode={sessionCode} onEndSession={onEndSession} ending={ending} />}
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
      {!embed && <Band manifest={manifest} total={total} sessionCode={sessionCode} onEndSession={onEndSession} ending={ending} />}

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
        {/* ── Focus Panel (left) ── */}
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
            {bonusStats.total > 0 && (
              <div className="hcard good">
                <div className="hcard-lb">隐藏关卡</div>
                <div className="hcard-v">{bonusStats.total} 人</div>
                <div className="hcard-sub">
                  {bonusStats.completed > 0
                    ? <><strong>{bonusStats.completed}</strong> 已完成</>
                    : '进行中'}
                </div>
              </div>
            )}
          </div>

          {/* ═══ STEP CARDS (expandable) ═══ */}
          <div>
            <div className="sh" style={{ marginBottom: 6 }}>
              <span className="sh-lb">课堂进程 · 按 Step</span>
              <span className="sh-meta">点击展开详情</span>
            </div>
            <div className="step-cards">
              {stepCards.map(sc => {
                const isExpanded = expandedStep === sc.stepNum
                const hasAlert = sc.stuckCount >= 5
                return (
                  <div
                    key={sc.stepNum}
                    className={`step-card${isExpanded ? ' expanded' : ''}${hasAlert ? ' has-alert' : ''}`}
                    onClick={() => setExpandedStep(isExpanded ? null : sc.stepNum)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* ── Step Card Head ── */}
                    <div className="sc-head">
                      <span className={`sc-chevron${isExpanded ? ' open' : ''}`}>▶</span>
                      <span className="sc-name">{getStepName(sc.step)}</span>
                      <span className="sc-type">{sc.step.duration} min · {sc.step.strategy || 'task'}</span>
                      <div className="sc-badges">
                        {(() => {
                          const obsType = getObserveType(sc.step.answerKey?.type)
                          return obsType ? (
                            <button
                              className="sc-observe-btn"
                              title="查看 Observe 面板"
                              onClick={(e) => { e.stopPropagation(); openObserve(obsType, sc.stepNum) }}
                            >📊</button>
                          ) : null
                        })()}
                        <span className={`sc-badge student-count${sc.activeCount >= 20 ? ' major' : ''}`}>{sc.activeCount} 人</span>
                        <span className={`sc-badge ai-rounds${sc.aiRounds >= 20 ? ' hot' : ''}`}>
                          <span className="pip" style={{ background: 'var(--ai-dot)' }} />{sc.aiRounds} 轮
                        </span>
                        {sc.stuckCount >= 5 && <span className="sc-badge alert-tag">{sc.stuckCount} 人卡住</span>}
                      </div>
                    </div>

                    {/* ── Progress Distribution Bar (always visible) ── */}
                    <ProgressBar dist={sc.phaseDist} total={total} />

                    {/* ── Collapsed: student dots preview ── */}
                    {!isExpanded && sc.studentsInStep.length > 0 && (
                      <div className="sc-dots">
                        {sc.studentsInStep.slice(0, 12).map(s => {
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
                              {s.bonusStatus && s.bonusStatus !== 'none' && <span className="bonus-pip" />}
                            </div>
                          )
                        })}
                        {sc.studentsInStep.length > 12 && (
                          <span className="sdot-more">+{sc.studentsInStep.length - 12}</span>
                        )}
                      </div>
                    )}

                    {/* ── Expanded: SubTask Rows ── */}
                    {isExpanded && (
                      <div className="step-expanded">
                        <SubTaskRow
                          label="Listen"
                          icon="🎧"
                          count={sc.phaseDist.listen}
                          students={students.filter(s => s.currentTask === sc.stepNum && s.currentPhase === 'listen')}
                          onStudentClick={setModalStudent}
                          questions={questions}
                        />
                        <SubTaskRow
                          label="Practice"
                          icon="✏️"
                          count={sc.phaseDist.practice}
                          students={students.filter(s => s.currentTask === sc.stepNum && s.currentPhase === 'practice')}
                          onStudentClick={setModalStudent}
                          questions={questions}
                          onClick={() => {
                            const obsType = getObserveType(sc.step.answerKey?.type)
                            if (obsType) openObserve(obsType, sc.stepNum)
                          }}
                          clickable
                          avgScore={sc.avgScore}
                        />
                        <SubTaskRow
                          label="Discuss"
                          icon="💬"
                          count={sc.phaseDist.discuss}
                          students={students.filter(s => s.currentTask === sc.stepNum && s.currentPhase === 'discuss')}
                          onStudentClick={setModalStudent}
                          questions={questions}
                          onClick={() => openObserve('discuss', sc.stepNum)}
                          clickable
                        />
                        <SubTaskRow
                          label="Takeaway"
                          icon="📝"
                          count={sc.phaseDist.takeaway}
                          students={students.filter(s => s.currentTask === sc.stepNum && s.currentPhase === 'takeaway')}
                          onStudentClick={setModalStudent}
                          questions={questions}
                        />
                        {/* Completed row */}
                        {sc.phaseDist.completed > 0 && (
                          <div className="subtask-row completed">
                            <span className="str-icon">✓</span>
                            <span className="str-label">Completed</span>
                            <span className="str-count">{sc.phaseDist.completed}</span>
                          </div>
                        )}
                        {/* Metrics summary */}
                        <div className="sc-metrics">
                          <span className="sc-metric">
                            正确率{' '}
                            <strong style={{ color: sc.avgScore >= 80 ? 'var(--green)' : sc.avgScore >= 50 ? 'var(--amber)' : sc.avgScore > 0 ? 'var(--red)' : 'var(--t3)' }}>
                              {sc.avgScore > 0 ? `${Math.round(sc.avgScore)}%` : '—'}
                            </strong>
                          </span>
                          <span className="sc-metric">AI <strong>{sc.aiPeople}</strong> 人触发</span>
                        </div>
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
              <div className="swim-legend-item"><span className="dot" style={{ background: 'var(--amber-dot)', width: 6, height: 6, borderRadius: '50%' }} />隐藏关卡</div>
            </div>
          </div>
        </div>

        {/* ── Right Panel (tabs) ── */}
        <div className="overview">
          {/* Tab Bar */}
          <div className="right-tab-bar">
            <button className={`right-tab${rightTab === 'questions' ? ' active' : ''}`} onClick={() => setRightTab('questions')}>
              问题聚类
              {totalAskQuestions > 0 && <span className="right-tab-cnt">{totalAskQuestions}</span>}
            </button>
            <button className={`right-tab${rightTab === 'observation' ? ' active' : ''}`} onClick={() => setRightTab('observation')}>
              观察要点
              {(() => {
                const urgentCount = state.observation?.alerts?.filter(a => a.severity === 'urgent').length ?? 0
                return urgentCount > 0 ? <span className="obs-badge urgent">{urgentCount}</span> : null
              })()}
            </button>
            <button className={`right-tab${rightTab === 'students' ? ' active' : ''}`} onClick={() => setRightTab('students')}>
              学生总览
            </button>
            <button className={`right-tab${rightTab === 'coaching' ? ' active' : ''}`} onClick={() => setRightTab('coaching')}>
              教学参考
            </button>
          </div>

          <div className="ov-body">
            {/* Questions Tab — cluster stats + fallback text-similarity */}
            {rightTab === 'questions' && (
              <div className="queue-section">
                <div className="queue-h">
                  <span className="lb">问题聚类 · 按 Step</span>
                  <span className="cnt">{totalAskQuestions}</span>
                </div>
                <div className="queue">
                  {/* ── Cluster Stats (per-question LLM classification) ── */}
                  {state.clusterStats && Object.keys(state.clusterStats).length > 0 && (
                    <div className="qc-cluster-stats">
                      {Object.entries(state.clusterStats)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([taskNumStr, data]) => {
                          const taskNum = Number(taskNumStr)
                          const stepLabel = stepNames[taskNum] || `Task ${taskNum}`
                          const defs = data.definitions
                          const clusterList = data.clusters

                          if (defs.length === 0 && clusterList.length === 0) return null

                          // Build label map from definitions
                          const labelMap: Record<string, string> = {}
                          for (const d of defs) labelMap[d.id] = d.label
                          labelMap['other'] = '未分类'

                          // Sort by student count descending, 'other' always last
                          const sorted = [...clusterList].sort((a, b) => {
                            if (a.clusterId === 'other') return 1
                            if (b.clusterId === 'other') return -1
                            return b.uniqueStudents - a.uniqueStudents || a.clusterId.localeCompare(b.clusterId)
                          })

                          // Show empty state if definitions exist but no observations
                          if (defs.length > 0 && clusterList.length === 0) {
                            return (
                              <div key={taskNum} className="qc-step-group">
                                <div className="q-step-h">
                                  <span className="step-name">{stepLabel}</span>
                                  <span className="tot">暂无观察数据</span>
                                </div>
                              </div>
                            )
                          }

                          const totalDiscussing = new Set(clusterList.flatMap(c => c.observations.map((o: { studentName: string }) => o.studentName))).size

                          return (
                            <div key={taskNum} className="qc-step-group">
                              <div className="q-step-h">
                                <span className="step-name">{stepLabel}</span>
                                <span className="tot">{totalDiscussing}人讨论中</span>
                              </div>
                              {sorted.map(cs => {
                                const label = labelMap[cs.clusterId] || cs.clusterId
                                const isOther = cs.clusterId === 'other'
                                // Deduplicate student names from observations
                                const studentNames = [...new Set(cs.observations.map((obs: { studentName: string }) => obs.studentName))]

                                if (isOther && studentNames.length === 0) return null

                                return (
                                  <div key={cs.clusterId} className={`qc-cluster-card${isOther ? ' other' : ''}`}>
                                    <div className="qc-head">
                                      <div className="qc-question">
                                        {isOther ? <span className="qc-other-label">{label}</span> : label}
                                      </div>
                                      <div className="qc-meta">
                                        <span className={`qc-count${cs.uniqueStudents >= 3 ? ' hot' : ''}`}>{cs.uniqueStudents}人</span>
                                      </div>
                                    </div>
                                    <div className="qc-student-tags">
                                      {studentNames.map(name => (
                                        <span key={name} className="qc-student-tag" onClick={() => setModalStudent(name)}>{name}</span>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                    </div>
                  )}

                  {/* ── Fallback: text-similarity clustering (no cluster defs) ── */}
                  {totalAskQuestions === 0 && (!state.clusterStats || Object.keys(state.clusterStats).length === 0) && (
                    <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 11, color: 'var(--t3)' }}>
                      暂无学生提问
                    </div>
                  )}
                  {clusteredQuestions.map(group => {
                    const stepLabel = stepNames[group.step] || `Step ${group.step}`
                    return (
                      <div key={group.step} className="qc-step-group">
                        <div className="q-step-h">
                          <span className="step-name">{stepLabel}</span>
                          <span className="tot">{group.total} 条提问</span>
                        </div>
                        {group.clusters.map((cluster, ci) => {
                          const qKey = `${group.step}:${ci}`
                          const isQExpanded = expandedQ === qKey
                          const isHot = cluster.students.length >= 3
                          return (
                            <div key={ci} className={`qc-cluster${isHot ? ' qc-hot' : ''}`}>
                              <div className="qc-head" onClick={() => setExpandedQ(isQExpanded ? null : qKey)}>
                                <div className="qc-question">{cluster.representative.question}</div>
                                <div className="qc-meta">
                                  <span className={`qc-count${isHot ? ' hot' : ''}`}>{cluster.students.length}人提问</span>
                                  <span className={`cat-badge ${getCatBadgeClass(cluster.category)}`}>{cluster.category}</span>
                                </div>
                              </div>
                              <div className="qc-students">
                                {cluster.students.map(name => (
                                  <span key={name} className="qc-student-tag">{name}</span>
                                ))}
                              </div>
                              {isQExpanded && (
                                <div className="qc-expanded">
                                  {cluster.items.map((item, ii) => (
                                    <div key={ii} className="qc-item">
                                      <div className="qc-item-head">
                                        <span className="q-student">{item.studentName}</span>
                                        <span className="qmeta">{formatRelative(item.timestamp)}</span>
                                      </div>
                                      <div className="qq">{item.question}</div>
                                      {item.answer && (
                                        <div className="q-answer">
                                          <span className="q-answer-label">AI 回答：</span>
                                          {item.answer}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Observation Tab */}
            {rightTab === 'observation' && (
              <div style={{ padding: '12px 14px' }}>
                <ObservationPanel state={state} />
              </div>
            )}

            {/* Student Summary Tab */}
            {rightTab === 'students' && state && (
              <SummaryTab
                state={state}
                students={students}
                questions={questions}
                stepNames={stepNames}
                totalSteps={stepCards.length}
                taskSteps={taskSteps}
                onStudentClick={setModalStudent}
                onExpandOverlay={openSummary}
              />
            )}

            {/* Coaching Tab */}
            {rightTab === 'coaching' && state && (
              <CoachingPanel
                state={state}
                health={health}
                stepNames={stepNames}
                taskSteps={taskSteps}
                questions={questions}
                onStudentClick={setModalStudent}
              />
            )}
          </div>
        </div>
      </div>

      {/* ═══ OBSERVE DRAWER ═══ */}
      {observeParams && (
        <Suspense fallback={<div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Loading...</div>}>
          <ObserveDrawer
            type={observeParams.type}
            stepNum={observeParams.step}
            manifest={manifest}
            sessionCode={sessionCode || ''}
            onClose={closeObserve}
          />
        </Suspense>
      )}

      {/* ═══ SUMMARY OVERLAY ═══ */}
      {summaryOpen && state && (
        <Suspense fallback={null}>
          <SummaryOverlay
            open={summaryOpen}
            onClose={closeSummary}
            state={state}
            students={students}
            questions={questions}
            stepNames={stepNames}
            totalSteps={stepCards.length}
            taskSteps={taskSteps}
            onStudentClick={setModalStudent}
          />
        </Suspense>
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

// ── SubTask Row ──
function SubTaskRow({ label, icon, count, students, onStudentClick, questions, onClick, clickable, avgScore }: {
  label: string
  icon: string
  count: number
  students: ClassroomState['students']
  onStudentClick: (name: string) => void
  questions: ClassroomState['questions']
  onClick?: () => void
  clickable?: boolean
  avgScore?: number
}) {
  return (
    <div
      className={`subtask-row${clickable ? ' clickable' : ''}`}
      onClick={clickable ? (e) => { e.stopPropagation(); onClick?.() } : undefined}
    >
      <span className="str-icon">{icon}</span>
      <span className="str-label">{label}</span>
      <span className="str-count">{count}</span>
      {avgScore != null && avgScore > 0 && (
        <span className="str-score" style={{ color: avgScore >= 80 ? 'var(--green)' : avgScore >= 50 ? 'var(--amber)' : 'var(--red)' }}>
          {Math.round(avgScore)}%
        </span>
      )}
      {clickable && <span className="str-arrow">→</span>}
      {students.length > 0 && (
        <div className="str-dots">
          {students.slice(0, 8).map(s => {
            const status = getStudentGlobalStatus(s)
            const ai = hasAI(s, questions)
            return (
              <div
                key={s.id}
                className={`sdot sm ${status}`}
                title={s.name}
                onClick={(e) => { e.stopPropagation(); onStudentClick(s.name) }}
              >
                {s.name.substring(0, 2)}
                {ai && <span className="ai-pip" />}
                {s.bonusStatus && s.bonusStatus !== 'none' && <span className="bonus-pip" />}
              </div>
            )
          })}
          {students.length > 8 && <span className="sdot-more">+{students.length - 8}</span>}
        </div>
      )}
    </div>
  )
}

// ── Progress Distribution Bar ──
function ProgressBar({ dist, total }: {
  dist: { listen: number; practice: number; discuss: number; takeaway: number; completed: number }
  total: number
}) {
  if (total === 0) return null
  const all = dist.listen + dist.practice + dist.discuss + dist.takeaway + dist.completed
  if (all === 0) return null
  const base = Math.max(all, total)
  const pct = (n: number) => `${(n / base) * 100}%`
  return (
    <div className="phase-bar" title={`Listen:${dist.listen} Practice:${dist.practice} Discuss:${dist.discuss} Takeaway:${dist.takeaway} Done:${dist.completed}`}>
      {dist.listen > 0 && <div className="pb-seg listen" style={{ width: pct(dist.listen) }} />}
      {dist.practice > 0 && <div className="pb-seg practice" style={{ width: pct(dist.practice) }} />}
      {dist.discuss > 0 && <div className="pb-seg discuss" style={{ width: pct(dist.discuss) }} />}
      {dist.takeaway > 0 && <div className="pb-seg takeaway" style={{ width: pct(dist.takeaway) }} />}
      {dist.completed > 0 && <div className="pb-seg completed" style={{ width: pct(dist.completed) }} />}
    </div>
  )
}

