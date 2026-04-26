import { useState, useEffect, useCallback, useRef, useMemo, createContext } from 'react'
import BoardInline from './BoardInline'
import AudioButton from './AudioButton'
import { DiscussPhase } from './DiscussPhase'
import { PracticePhase } from './PracticePhase'
import { renderMd } from './renderMd'
import { TASKS, LESSON_INTRO, LESSON_SUMMARY } from './task-data'
import type { Task } from './task-data'
import type { PhaseConfig } from '../../types/reading'

export { TASKS } from './task-data'
export type { Task } from './task-data'

export const SessionCtx = createContext<{ sessionCode?: string; studentId?: string; submit?: (step: number, data: Record<string, any>) => Promise<boolean> }>({})

const DEFAULT_PHASES: PhaseConfig[] = [
  { id: 'listen', label: 'Listen', unlockAfter: null },
  { id: 'practice', label: 'Practice', unlockAfter: 'listen' },
  { id: 'discuss', label: 'Discuss', unlockAfter: 'practice' },
  { id: 'takeaway', label: 'Takeaway', unlockAfter: 'discuss' },
]

/* ═══ LISTEN PHASE ═══ */
function ListenPhase({ task, onDone, lessonId }: { task: Task; onDone: () => void; lessonId?: string }) {
  const [done, setDone] = useState(false)
  const handleClick = () => { setDone(true); onDone() }
  const iv = task.instructionView
  return (
    <div id="phase-listen">
      <div className="stu-section-label"><span>Listen</span><div className="stu-section-line" /></div>
      <div style={{ marginBottom: 20 }}>
        {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-intro.mp3`} />}
        {iv ? (
          <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)' }}>
            {iv.title && <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', marginBottom: 12 }}>{iv.title}</div>}
            <div dangerouslySetInnerHTML={{ __html: iv.body }} />
            {iv.keyPoints && iv.keyPoints.length > 0 && (
              <ul style={{ margin: '12px 0', paddingLeft: 20 }}>
                {iv.keyPoints.map((kp, i) => <li key={i} style={{ marginBottom: 4 }}>{kp}</li>)}
              </ul>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>
            {renderMd(task.intro)}
          </div>
        )}
      </div>
      <button className={`stu-btn ${done ? 'ghost' : 'pri'}`} onClick={handleClick} disabled={done}>
        {done ? 'Confirmed ✓' : (iv?.confirmLabel || "Got it, let's practice →")}
      </button>
    </div>
  )
}

/* ═══ TAKEAWAY PHASE ═══ */
function TakeawayPhase({ task, onComplete, lessonId }: { task: Task; onComplete: () => void; lessonId?: string }) {
  return (
    <div id="phase-takeaway">
      <div className="stu-section-label"><span>Takeaway</span><div className="stu-section-line" /></div>
      <div style={{ marginBottom: 16 }}>
        {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-summary.mp3`} />}
        <div style={{ fontSize: 15, lineHeight: 1.85, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{renderMd(task.summary)}</div>
      </div>
      <BoardInline taskId={task.id} />
      <button className="stu-btn pri" style={{ marginTop: 8 }} onClick={onComplete}>
        {task.id < 5 ? 'Next Task →' : 'Complete Course →'}
      </button>
    </div>
  )
}

/** Phase→component registry. Each entry renders the phase given standard props. */
const PHASE_REGISTRY: Record<string, (props: {
  task: Task; onDone: () => void; onComplete: () => void; lessonId?: string; stepIdx?: number; label: string
}) => JSX.Element | null> = {
  listen: ({ task, onDone, lessonId }) => <ListenPhase key={`l${task.id}`} task={task} onDone={onDone} lessonId={lessonId} />,
  practice: ({ task, onDone, stepIdx }) => <PracticePhase key={`p${task.id}`} task={task} onDone={onDone} stepIdx={stepIdx} />,
  discuss: ({ task, onDone }) => <DiscussPhase key={`d${task.id}`} task={task} onDone={onDone} />,
  takeaway: ({ task, onComplete, lessonId }) => <TakeawayPhase task={task} onComplete={onComplete} lessonId={lessonId} />,
}

/* ═══ TASK VIEW — main component ═══ */
function TaskView({ task, onComplete, lessonId, stepIdx, phaseConfig }: {
  task: Task; onComplete: () => void; lessonId?: string; stepIdx?: number; phaseConfig?: PhaseConfig[]
}) {
  const phases = phaseConfig?.length ? phaseConfig : DEFAULT_PHASES
  const phaseIds = useMemo(() => phases.map(p => p.id), [phases])

  const scrollRef = useRef<HTMLDivElement>(null)
  const [activePhase, setActivePhase] = useState(phaseIds[0])
  const [donePhases, setDonePhases] = useState<Set<string>>(new Set())
  const prevDoneRef = useRef<Set<string>>(new Set())

  // Reset on task change
  useEffect(() => { setDonePhases(new Set()); prevDoneRef.current = new Set(); setActivePhase(phaseIds[0]) }, [task.id, phaseIds])

  const isUnlocked = useCallback((phase: PhaseConfig) => {
    return phase.unlockAfter === null || donePhases.has(phase.unlockAfter)
  }, [donePhases])

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

  const markDone = useCallback((phaseId: string) => {
    setDonePhases(prev => { const next = new Set(prev); next.add(phaseId); return next })
  }, [])

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
          const isLast = i === phases.length - 1
          const prevPhase = phases[i - 1]
          const showLocked = !unlocked && prevPhase && isUnlocked(prevPhase)
          return (
            <div key={phase.id}>
              {unlocked && renderer({
                task, lessonId, stepIdx, label: phase.label,
                onDone: () => markDone(phase.id),
                onComplete,
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
export function useStudentTask() {
  const [screen, setScreen] = useState<string>('intro')
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set())

  let taskId = 0
  if (screen !== 'intro' && screen !== 'summary') taskId = parseInt(screen)
  const task = TASKS.find(t => t.id === taskId)

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

  const completeTask = useCallback((tid: number) => {
    setDoneSet(d => { const n = new Set(d); n.add(tid); return n })
    if (tid < 5) setScreen(String(tid + 1)); else setScreen('summary')
  }, [])

  const currentFocus = task ? task.focus : []

  return { taskId, task, currentFocus, doneSet, screen, setScreen, completeTask }
}

/* ═══ TASK COLUMN — rendered as a proper component ═══ */
export function TaskColumn({ screen, setScreen, task, completeTask, lessonId, stepIdx, articleTitle, lessonIntro, lessonSummary, phaseConfig }: {
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
}) {
  const introText = lessonIntro || LESSON_INTRO
  const summaryText = lessonSummary || LESSON_SUMMARY
  const title = articleTitle || 'Ideal Beauty'

  return (
    <div className="stu-left-col">
      {screen === 'intro' && (
        <div className="stu-task-inner" style={{ paddingTop: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Welcome</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>{title}</div>
            {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/lesson-intro.mp3`} />}
            <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(introText)}</div>
          </div>
          <button className="stu-btn pri" onClick={() => setScreen('1')}>Start Task 1 →</button>
        </div>
      )}
      {screen === 'summary' && (
        <div className="stu-task-inner" style={{ paddingTop: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>Complete</div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>Great job today!</div>
            {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/lesson-summary.mp3`} />}
            <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(summaryText)}</div>
          </div>
        </div>
      )}
      {task && <TaskView key={task.id} task={task} onComplete={() => completeTask(task.id)} lessonId={lessonId} stepIdx={stepIdx} phaseConfig={phaseConfig} />}
    </div>
  )
}

/* default export kept for backwards compat — re-export the hook */
export default useStudentTask
