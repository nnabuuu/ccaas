import { useState, useEffect, useCallback, useRef, useMemo, useContext, createContext } from 'react'
import BoardInline from './BoardInline'
import AudioButton from './AudioButton'
import { DiscussPhase } from './discuss/DiscussPhase'
import { PracticePhase } from './exercise/PracticePhase'
import { PersonalTouchScreen } from './personal-touch/PersonalTouchScreen'
import { BonusPhase } from './personal-touch/BonusPhase'
import { renderMd } from './renderMd'
import { reportPhase, type CachedSubmission, type DiscussMeta } from '../../hooks/useClassroom'
import type { Task } from './task-data'
import type { PhaseConfig, BoardData } from '../../types/reading'
import type { TextOverlay } from './TextPanel'

export type { Task } from './task-data'

export interface SessionConfig {
  enableMath?: boolean
}

export const SessionCtx = createContext<{
  sessionCode?: string
  studentId?: string
  submit?: (step: number, data: Record<string, any>) => Promise<boolean>
  config: SessionConfig
  boardData?: BoardData | null
  restoredSubmissions?: Record<number, CachedSubmission>
  discussMeta?: DiscussMeta | null
}>({ config: {} })

const DEFAULT_PHASES: PhaseConfig[] = [
  { id: 'listen', label: 'Listen', unlockAfter: null },
  { id: 'practice', label: 'Practice', unlockAfter: 'listen' },
  { id: 'discuss', label: 'Discuss', unlockAfter: 'practice' },
  { id: 'takeaway', label: 'Takeaway', unlockAfter: 'discuss' },
]

/* ═══ LISTEN PHASE ═══ */
function ListenPhase({ task, onDone, lessonId, isRevisit }: { task: Task; onDone: () => void; lessonId?: string; isRevisit?: boolean }) {
  const { config } = useContext(SessionCtx)
  const [done, setDone] = useState(!!isRevisit)
  const handleClick = () => { setDone(true); onDone() }
  const iv = task.instructionView
  return (
    <div id="phase-listen">
      <div className="stu-section-label"><span>Listen</span><div className="stu-section-line" /></div>
      {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-intro.mp3`} />}
      <div className="stu-instr-card">
        <div className="stu-instr-badge">{task.name}</div>
        {iv ? (
          <>
            {iv.title && <div className="stu-instr-title">{iv.title}</div>}
            <div className="stu-instr-body" dangerouslySetInnerHTML={{ __html: iv.body }} />
            {iv.keyPoints && iv.keyPoints.length > 0 && (
              <div className="stu-instr-kp">
                <div className="stu-instr-kp-label">Remember</div>
                <ul>
                  {iv.keyPoints.map((kp, i) => <li key={i}>{kp}</li>)}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="stu-instr-title">{task.subtitle}</div>
            <div className="stu-instr-body">{renderMd(task.intro, { math: config.enableMath })}</div>
          </>
        )}
      </div>
      <button className={`stu-btn ${done ? 'ghost' : 'pri'}`} onClick={handleClick} disabled={done}>
        {done ? 'Confirmed ✓' : (iv?.confirmLabel || "I understand — let's practice →")}
      </button>
    </div>
  )
}

/* ═══ TAKEAWAY PHASE ═══ */
function TakeawayPhase({ task, onComplete, lessonId, taskCount }: { task: Task; onComplete: () => void; lessonId?: string; taskCount?: number }) {
  const { config, boardData } = useContext(SessionCtx)
  const total = taskCount ?? 5
  return (
    <div id="phase-takeaway">
      <div className="stu-section-label"><span>Takeaway</span><div className="stu-section-line" /></div>
      <div style={{ marginBottom: 16 }}>
        {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-summary.mp3`} />}
        <div style={{ fontSize: 15, lineHeight: 1.85, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{renderMd(task.summary, { math: config.enableMath })}</div>
      </div>
      <BoardInline taskId={task.id} boardData={boardData} />
      <button className="stu-btn pri" style={{ marginTop: 8 }} onClick={onComplete}>
        {task.id < total ? 'Next Task →' : 'Complete Course →'}
      </button>
    </div>
  )
}

/** Phase→component registry. Each entry renders the phase given standard props. */
const PHASE_REGISTRY: Record<string, (props: {
  task: Task; onDone: () => void; onComplete: () => void; lessonId?: string; stepIdx?: number; label: string; onOverlayChange?: (overlay: TextOverlay | null) => void; taskCount?: number; isRevisit?: boolean
}) => JSX.Element | null> = {
  listen: ({ task, onDone, lessonId, isRevisit }) => <ListenPhase key={`l${task.id}`} task={task} onDone={onDone} lessonId={lessonId} isRevisit={isRevisit} />,
  practice: ({ task, onDone, stepIdx, onOverlayChange, isRevisit }) => <PracticePhase key={`p${task.id}`} task={task} onDone={onDone} stepIdx={stepIdx} onOverlayChange={onOverlayChange} isRevisit={isRevisit} />,
  discuss: ({ task, onDone, isRevisit }) => <DiscussPhase key={`d${task.id}`} task={task} onDone={onDone} isRevisit={isRevisit} />,
  takeaway: ({ task, onComplete, lessonId, taskCount }) => <TakeawayPhase task={task} onComplete={onComplete} lessonId={lessonId} taskCount={taskCount} />,
}

/* ═══ TASK VIEW — main component ═══ */
function TaskView({ task, onComplete, lessonId, stepIdx, phaseConfig, onOverlayChange, taskCount, doneSet, onPhaseChange, initialPhase }: {
  task: Task; onComplete: () => void; lessonId?: string; stepIdx?: number; phaseConfig?: PhaseConfig[]; onOverlayChange?: (overlay: TextOverlay | null) => void; taskCount?: number; doneSet?: Set<number>; onPhaseChange?: (phase: string) => void; initialPhase?: string | null
}) {
  const ctx = useContext(SessionCtx)
  const phases = phaseConfig?.length ? phaseConfig : DEFAULT_PHASES
  const phaseIds = useMemo(() => phases.map(p => p.id), [phases])
  const isRevisit = doneSet?.has(task.id) ?? false

  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePhase, setActivePhase] = useState(phaseIds[0])
  const [donePhases, setDonePhases] = useState<Set<string>>(new Set())
  const prevDoneRef = useRef<Set<string>>(new Set())

  // Reset on task change — pre-fill phases done from persisted progress or revisit
  useEffect(() => {
    if (isRevisit) {
      const allDone = new Set(phaseIds)
      setDonePhases(allDone); prevDoneRef.current = new Set(allDone)
    } else if (initialPhase) {
      // Restore: all phases BEFORE the current phase are done
      const idx = phaseIds.indexOf(initialPhase)
      const done = new Set(phaseIds.slice(0, idx > 0 ? idx : 0))
      setDonePhases(done); prevDoneRef.current = new Set(done)
    } else {
      setDonePhases(new Set()); prevDoneRef.current = new Set()
    }
    setActivePhase(phaseIds[0]); onOverlayChange?.(null)
  }, [task.id, phaseIds, isRevisit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear text overlay when practice phase completes (e.g., select-evidence section mask)
  useEffect(() => {
    if (donePhases.has('practice') && !prevDoneRef.current.has('practice')) {
      onOverlayChange?.(null)
    }
  }, [donePhases, onOverlayChange])

  const isUnlocked = useCallback((phase: PhaseConfig) => {
    return phase.unlockAfter === null || donePhases.has(phase.unlockAfter)
  }, [donePhases])

  // Notify parent when active phase changes
  useEffect(() => {
    onPhaseChange?.(activePhase)
  }, [activePhase, onPhaseChange])

  // IntersectionObserver for phase tracking
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio > 0.15) {
          setActivePhase(e.target.id.replace('phase-', ''))
        }
      })
    }, { root: container, rootMargin: '-40px 0px -60% 0px', threshold: [0.15] })
    const t = setTimeout(() => {
      phaseIds.forEach(id => { const el = container.querySelector(`#phase-${id}`); if (el) observer.observe(el) })
    }, 100)
    return () => { clearTimeout(t); observer.disconnect() }
  }, [task.id, phaseIds, donePhases])

  // Auto-scroll to newly unlocked phase
  useEffect(() => {
    const prev = prevDoneRef.current
    for (const phase of phases) {
      if (phase.unlockAfter && donePhases.has(phase.unlockAfter) && !prev.has(phase.unlockAfter)) {
        const el = scrollRef.current?.querySelector(`#phase-${phase.id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      }
    }
    prevDoneRef.current = new Set(donePhases)
  }, [donePhases, phases])

  // Report initial phase ('listen') when task mounts
  useEffect(() => {
    if (isRevisit || !ctx.sessionCode || !ctx.studentId) return
    reportPhase(ctx.sessionCode, ctx.studentId, task.id, phaseIds[0])
  }, [task.id, isRevisit, ctx.sessionCode, ctx.studentId, phaseIds])

  const markDone = useCallback((phaseId: string) => {
    setDonePhases(prev => { const next = new Set(prev); next.add(phaseId); return next })
    if (isRevisit || !ctx.sessionCode || !ctx.studentId) return
    const idx = phaseIds.indexOf(phaseId)
    const nextPhase = idx < phaseIds.length - 1 ? phaseIds[idx + 1] : null
    if (nextPhase) {
      reportPhase(ctx.sessionCode, ctx.studentId, task.id, nextPhase)
    }
  }, [phaseIds, task.id, isRevisit, ctx.sessionCode, ctx.studentId])

  const jumpTo = useCallback((phaseId: string) => {
    const phase = phases.find(p => p.id === phaseId)
    if (!phase || !isUnlocked(phase)) return
    const el = scrollRef.current?.querySelector(`#phase-${phaseId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phases, isUnlocked])

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto' }}>
      {/* Sticky phase nav */}
      <div className="stu-phase-nav">
        {phases.map(phase => {
          const isAct = activePhase === phase.id
          const vis = isUnlocked(phase)
          return (
            <div
              key={phase.id}
              className={`stu-phase-tab${isAct ? ' active' : ''}${!vis ? ' locked' : ''}`}
              onClick={vis ? () => jumpTo(phase.id) : undefined}
            >
              <span>{phase.label}</span>
              {!vis && <span style={{ fontSize: 8, marginLeft: 2, color: 'var(--t3)' }}>🔒</span>}
            </div>
          )
        })}
      </div>

      <div className="stu-task-inner">
        <div style={{ paddingTop: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
            Task {task.id} · {task.name} — {task.time}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', lineHeight: 1.3, marginBottom: 8, color: 'var(--t1)' }}>
            {task.subtitle}
          </div>
        </div>
        {phases.map((phase, i) => {
          const unlocked = isUnlocked(phase)
          const renderer = PHASE_REGISTRY[phase.id]
          if (!renderer) return null
          const prevPhase = phases[i - 1]
          const showLocked = !unlocked && prevPhase && isUnlocked(prevPhase)
          return (
            <div key={phase.id}>
              {unlocked && renderer({
                task, lessonId, stepIdx, label: phase.label,
                onDone: () => markDone(phase.id),
                onComplete,
                onOverlayChange,
                taskCount,
                isRevisit: isRevisit || donePhases.has(phase.id),
              })}
              {showLocked && (
                <div className="stu-phase-locked-msg">Complete {prevPhase.label} to unlock {phase.label}</div>
              )}
            </div>
          )
        })}
        <div style={{ height: 80 }} />
      </div>
    </div>
  )
}

/* ═══ CUSTOM HOOK — useStudentTask ═══ */
export function useStudentTask(
  tasks: Task[],
  initialProgress?: { currentTask: number; currentPhase: string } | null,
) {
  const [screen, setScreen] = useState<string>(() => {
    if (!initialProgress) return 'intro'
    const { currentTask, currentPhase } = initialProgress
    if (currentTask > tasks.length) return 'personal-touch'
    if (currentTask === tasks.length && currentPhase === 'completed') return 'personal-touch'
    return String(currentTask)
  })
  const [doneSet, setDoneSet] = useState<Set<number>>(() => {
    if (!initialProgress) return new Set()
    const { currentTask, currentPhase } = initialProgress
    const done = new Set<number>()
    for (let i = 1; i < currentTask; i++) done.add(i)
    if (currentPhase === 'completed') done.add(currentTask)
    return done
  })

  let taskId = 0
  if (screen !== 'intro' && screen !== 'summary' && screen !== 'personal-touch' && screen !== 'bonus-unlock' && screen !== 'bonus') taskId = parseInt(screen)
  const task = tasks.find(t => t.id === taskId)

  // Listen for sync messages from parent (demo orchestrator)
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data
      if (!d || typeof d !== 'object') return
      if (d.type === 'sync' && typeof d.step === 'number') {
        setScreen(String(d.step + 1))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const taskCount = tasks.length
  const completeTask = useCallback((tid: number) => {
    setDoneSet(d => { const n = new Set(d); n.add(tid); return n })
    if (tid < taskCount) setScreen(String(tid + 1)); else setScreen('personal-touch')
  }, [taskCount])

  const currentFocus = task ? task.focus : []

  // Derive initial phase for the current task (used to restore donePhases on refresh)
  const initialPhase = initialProgress && initialProgress.currentTask === taskId
    ? initialProgress.currentPhase : null

  return { taskId, task, currentFocus, doneSet, screen, setScreen, completeTask, taskCount, initialPhase }
}

/* ═══ TASK COLUMN — rendered as a proper component ═══ */
export function TaskColumn({ screen, setScreen, task, completeTask, lessonId, stepIdx, articleTitle, lessonIntro, lessonSummary, phaseConfig, onOverlayChange, courseIntroView, taskCount, doneSet, onPhaseChange, initialPhase }: {
  screen: string
  setScreen: (s: string) => void
  task: Task | undefined
  completeTask: (tid: number) => void
  lessonId?: string
  stepIdx?: number
  articleTitle?: string
  lessonIntro?: string
  lessonSummary?: string
  phaseConfig?: PhaseConfig[]
  onOverlayChange?: (overlay: TextOverlay | null) => void
  courseIntroView?: { title: string; body: string; keyPoints?: string[]; confirmLabel?: string } | null
  taskCount?: number
  doneSet?: Set<number>
  initialPhase?: string | null
  onPhaseChange?: (phase: string) => void
}) {
  const { config } = useContext(SessionCtx)
  const introText = lessonIntro || ''
  const summaryText = lessonSummary || ''
  const title = articleTitle || 'Untitled Lesson'

  return (
    <div className="stu-left-col" data-translate-ctx="task-panel">
      {screen === 'intro' && (
        <div className="stu-task-inner" style={{ paddingTop: 32 }}>
          <div style={{ marginBottom: 20 }}>
            {courseIntroView ? (
              <div className="stu-instr-card">
                {courseIntroView.title && <div className="stu-instr-title">{courseIntroView.title}</div>}
                {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-i0-intro.mp3`} />}
                <div className="stu-instr-body" dangerouslySetInnerHTML={{ __html: courseIntroView.body }} />
                {courseIntroView.keyPoints && courseIntroView.keyPoints.length > 0 && (
                  <div className="stu-instr-kp">
                    <div className="stu-instr-kp-label">Remember</div>
                    <ul>{courseIntroView.keyPoints.map((kp, i) => <li key={i}>{kp}</li>)}</ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Welcome</div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>{title}</div>
                {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/lesson-intro.mp3`} />}
                <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(introText, { math: config.enableMath })}</div>
              </>
            )}
          </div>
          {(taskCount ?? 0) > 0 ? (
            <button className="stu-btn pri" onClick={() => setScreen('1')}>
              {courseIntroView?.confirmLabel || 'Start Task 1 →'}
            </button>
          ) : (
            <div style={{ color: 'var(--t3)', fontSize: 14 }}>No tasks available for this lesson.</div>
          )}
        </div>
      )}
      {screen === 'summary' && (
        <div className="stu-task-inner" style={{ paddingTop: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Complete</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>Great job today!</div>
            {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/lesson-summary.mp3`} />}
            <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(summaryText, { math: config.enableMath })}</div>
          </div>
        </div>
      )}
      {screen === 'personal-touch' && (
        <PersonalTouchScreen onContinue={(bonusUnlocked) => {
          if (bonusUnlocked) setScreen('bonus-unlock')
          else setScreen('summary')
        }} />
      )}
      {screen === 'bonus-unlock' && (
        <div className="stu-task-inner" style={{ paddingTop: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🗝️</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: 'var(--t1)' }}>隐藏关卡</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--t2)' }}>Hidden Level Unlocked!</div>
          <p style={{ color: 'var(--t2)', marginBottom: 4 }}>你比大多数同学更快完成了所有任务！</p>
          <p style={{ color: 'var(--t2)', marginBottom: 6 }}>这里有一篇新文章等你挑战 —— 做不完也完全没问题。</p>
          <p style={{ fontSize: 15, marginBottom: 20 }}>📖 <strong>"Beyond the Plate"</strong></p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="stu-btn pri" onClick={() => setScreen('bonus')}>挑战一下 →</button>
            <button className="stu-btn ghost" onClick={() => setScreen('summary')}>直接结束</button>
          </div>
        </div>
      )}
      {screen === 'bonus' && (
        <BonusPhase onComplete={() => setScreen('summary')} />
      )}
      {task && <TaskView key={task.id} task={task} onComplete={() => completeTask(task.id)} lessonId={lessonId} stepIdx={stepIdx} phaseConfig={phaseConfig} onOverlayChange={onOverlayChange} taskCount={taskCount} doneSet={doneSet} onPhaseChange={onPhaseChange} initialPhase={initialPhase} />}
    </div>
  )
}

/* default export kept for backwards compat — re-export the hook */
export default useStudentTask
