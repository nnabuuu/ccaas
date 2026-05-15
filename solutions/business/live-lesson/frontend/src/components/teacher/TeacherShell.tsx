import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useTeacherPolling } from '../../hooks/useClassroom'
import type { ClassroomState, StateSnapshot } from '../../hooks/useClassroom'
import {
  STUCK_THRESHOLD_MS, computeHealthCards, getStudentGlobalStatus, hasAI,
  getStepName, computePhaseDistribution,
  getObserveType, countHighlights,
} from './teacher-helpers'
import { Band } from './Band'
import { Timeline } from './Timeline'
import { DiscussInsightTab } from './DiscussInsightTab'
import { StudentModal } from './StudentModal'
import { SummaryTab } from './summary/SummaryTab'
import { DepthLeaderboardCard } from './summary/DepthLeaderboardCard'
import { ClassroomStatusTab } from './ClassroomStatusTab'
import { SubTaskRow } from './SubTaskRow'
import { ProgressBar } from './ProgressBar'
import { useDrawerState } from './useDrawerState'

const ObserveDrawer = lazy(() => import('./observe/ObserveDrawer'))
const SummaryOverlay = lazy(() => import('./summary/SummaryOverlay'))
const DepthLeaderboardOverlay = lazy(() => import('./summary/DepthLeaderboardOverlay'))
const DiscussInsightDrawer = lazy(() => import('./DiscussInsightDrawer'))
const ClassroomStatusDrawer = lazy(() => import('./ClassroomStatusDrawer'))

type RightTab = 'discuss' | 'analysis' | 'status' | 'depth'

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
  const [rightTab, setRightTab] = useState<RightTab>('discuss')
  const [depthExpanded, setDepthExpanded] = useState(false)

  const {
    observeParams, summaryOpen, openSummary, closeSummary,
    discussDrawerOpen, openDiscussDrawer, closeDiscussDrawer,
    statusDrawerOpen, openStatusDrawer, closeStatusDrawer,
    openObserve, closeObserve,
  } = useDrawerState()

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

  // Highlight count for tab badge
  const highlightCount = useMemo(() => countHighlights(state?.clusterStats), [state?.clusterStats])

  // Urgent alert count for tab badge
  const urgentAlertCount = state?.observation?.alerts?.filter(a => a.severity === 'urgent').length ?? 0

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
    try { window.parent?.postMessage({ type: 'ready', role: 'teacher' }, window.location.origin) } catch { /* noop */ }
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
            <button className={`right-tab${rightTab === 'discuss' ? ' active' : ''}`} onClick={() => setRightTab('discuss')}>
              讨论洞察
              {highlightCount > 0 && <span className="right-tab-cnt" style={{ color: 'var(--amber)' }}>✦ {highlightCount}</span>}
            </button>
            <button className={`right-tab${rightTab === 'analysis' ? ' active' : ''}`} onClick={() => setRightTab('analysis')}>
              学生分析
            </button>
            <button className={`right-tab${rightTab === 'status' ? ' active' : ''}`} onClick={() => setRightTab('status')}>
              课堂状态
              {urgentAlertCount > 0 && <span className="obs-badge urgent">{urgentAlertCount}</span>}
            </button>
            <button className={`right-tab${rightTab === 'depth' ? ' active' : ''}`} onClick={() => setRightTab('depth')}>
              深度排行
              {(state?.depthLeaderboard?.rankings?.length ?? 0) > 0 && (
                <span className="right-tab-cnt depth">
                  {state?.depthLeaderboard?.rankings?.length}
                </span>
              )}
            </button>
          </div>

          <div className="ov-body">
            {/* Tab 1: 讨论洞察 */}
            {rightTab === 'discuss' && (
              <DiscussInsightTab
                state={state}
                stepNames={stepNames}
                questions={questions}
                onStudentClick={setModalStudent}
                onExpandDrawer={openDiscussDrawer}
              />
            )}

            {/* Tab 2: 学生分析 */}
            {rightTab === 'analysis' && state && (
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

            {/* Tab 3: 课堂状态 */}
            {rightTab === 'status' && state && (
              <ClassroomStatusTab
                state={state}
                health={health}
                stepNames={stepNames}
                taskSteps={taskSteps}
                onStudentClick={setModalStudent}
                onExpandDrawer={openStatusDrawer}
              />
            )}

            {/* Tab 4: 深度排行 */}
            {rightTab === 'depth' && (
              <div>
                <div className="panel-header">
                  <span className="title">深度排行</span>
                  <button className="expand-btn" onClick={() => setDepthExpanded(true)}>展开 ↗</button>
                </div>
                <DepthLeaderboardCard
                  rankings={state?.depthLeaderboard?.rankings ?? []}
                  coaching={state?.coaching}
                  sessionCode={sessionCode || ''}
                  onStudentClick={setModalStudent}
                  onExpandOverlay={() => setDepthExpanded(true)}
                />
              </div>
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
            manifest={manifest}
          />
        </Suspense>
      )}

      {/* ═══ DEPTH LEADERBOARD OVERLAY ═══ */}
      {depthExpanded && (
        <Suspense fallback={null}>
          <DepthLeaderboardOverlay
            open={depthExpanded}
            onClose={() => setDepthExpanded(false)}
            rankings={state?.depthLeaderboard?.rankings ?? []}
            state={state}
            sessionCode={sessionCode || ''}
          />
        </Suspense>
      )}

      {/* ═══ DISCUSS INSIGHT DRAWER ═══ */}
      {discussDrawerOpen && state && (
        <Suspense fallback={null}>
          <DiscussInsightDrawer
            open={discussDrawerOpen}
            onClose={closeDiscussDrawer}
            state={state}
            stepNames={stepNames}
            onStudentClick={setModalStudent}
          />
        </Suspense>
      )}

      {/* ═══ CLASSROOM STATUS DRAWER ═══ */}
      {statusDrawerOpen && state && (
        <Suspense fallback={null}>
          <ClassroomStatusDrawer
            open={statusDrawerOpen}
            onClose={closeStatusDrawer}
            state={state}
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

