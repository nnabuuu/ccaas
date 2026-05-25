import { useState, useEffect, useCallback, useRef, useMemo, useContext, createContext } from 'react'
import BoardInline from './BoardInline'
import AudioButton from './AudioButton'
import { DiscussPhase } from './discuss/DiscussPhase'
import { PracticePhase } from './exercise/PracticePhase'
import { DiscoveryPhase } from './exercise/DiscoveryPhase'
import { PersonalTouchScreen } from './personal-touch/PersonalTouchScreen'
import { SummaryScreen } from './personal-touch/SummaryScreen'
import { BonusPhase } from './personal-touch/BonusPhase'
import { renderMd, renderHtmlWithMath } from './renderMd'
import { reportPhase, type CachedSubmission, type DiscussMeta, type SubmitResult } from '../../hooks/useClassroom'
import type { Task } from './task-data'
import ExampleDemoCard from './scaffold/ExampleDemoCard'
import type { PhaseConfig, BoardData } from '../../types/reading'
import type { TextOverlay } from './TextPanel'
import { useT, LocaleScope, type TFn, type Locale } from '../../i18n'

export type { Task } from './task-data'

export interface SessionConfig {
  enableMath?: boolean
}

export const SessionCtx = createContext<{
  sessionCode?: string
  studentId?: string
  submit?: (step: number, data: Record<string, any>) => Promise<SubmitResult>
  config: SessionConfig
  boardData?: BoardData | null
  restoredSubmissions?: Record<number, CachedSubmission>
  discussMeta?: DiscussMeta | null
}>({ config: {} })

function getDefaultPhases(t: TFn): PhaseConfig[] {
  return [
    { id: 'listen', label: t('phase.listen'), unlockAfter: null },
    { id: 'practice', label: t('phase.practice'), unlockAfter: 'listen' },
    { id: 'discuss', label: t('phase.discuss'), unlockAfter: 'practice' },
    { id: 'takeaway', label: t('phase.takeaway'), unlockAfter: 'discuss' },
  ]
}

/* ═══ LISTEN PHASE ═══ */
function ListenPhase({ task, onDone, lessonId, isRevisit, label, onSidebarStep }: { task: Task; onDone: () => void; lessonId?: string; isRevisit?: boolean; label?: string; onSidebarStep?: (step: number) => void }) {
  const t = useT()
  const { config } = useContext(SessionCtx)
  const [done, setDone] = useState(!!isRevisit)
  const handleClick = () => { setDone(true); onDone() }
  const iv = task.instructionView
  if (iv?.demoConfig) {
    return (
      <div id="phase-listen" data-translate-ctx="instruction">
        <div className="stu-section-label"><span>{label || t('phase.listen')}</span><div className="stu-section-line" /></div>
        {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-intro.mp3`} />}
        <ExampleDemoCard
          config={iv.demoConfig}
          onDone={handleClick}
          skipAnimation={done}
          confirmLabel={iv.confirmLabel}
          onSidebarStep={onSidebarStep}
        />
      </div>
    )
  }
  return (
    <div id="phase-listen" data-translate-ctx="instruction">
      <div className="stu-section-label"><span>{label || t('phase.listen')}</span><div className="stu-section-line" /></div>
      {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-intro.mp3`} />}
      <div className="stu-instr-card">
        <div className="stu-instr-badge">{task.name}</div>
        {iv ? (
          <>
            {iv.title && <div className="stu-instr-title">{config.enableMath ? renderMd(iv.title, { math: true }) : iv.title}</div>}
            <div className="stu-instr-body" dangerouslySetInnerHTML={{ __html: config.enableMath ? renderHtmlWithMath(iv.body) : iv.body }} />
            {iv.keyPoints && iv.keyPoints.length > 0 && (
              <div className="stu-instr-kp">
                <div className="stu-instr-kp-label">{t('listen.remember')}</div>
                <ul>
                  {iv.keyPoints.map((kp, i) => <li key={i}>{config.enableMath ? renderMd(kp, { math: true }) : kp}</li>)}
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
        {done ? t('listen.confirmed') : (iv?.confirmLabel || t('listen.understand'))}
      </button>
    </div>
  )
}

/* ═══ TAKEAWAY PHASE ═══ */
function TakeawayPhase({ task, onComplete, lessonId, taskCount, label }: { task: Task; onComplete: () => void; lessonId?: string; taskCount?: number; label?: string }) {
  const t = useT()
  const { config, boardData } = useContext(SessionCtx)
  const total = taskCount ?? 5
  return (
    <div id="phase-takeaway" data-translate-ctx="takeaway">
      <div className="stu-section-label"><span>{label || t('phase.takeaway')}</span><div className="stu-section-line" /></div>
      <div style={{ marginBottom: 16 }}>
        {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/step-${task.id}-summary.mp3`} />}
        <div style={{ fontSize: 15, lineHeight: 1.85, color: 'var(--t1)', whiteSpace: 'pre-line' }}>{renderMd(task.summary, { math: config.enableMath })}</div>
      </div>
      <BoardInline taskId={task.id} boardData={boardData} />
      <button className="stu-btn pri" style={{ marginTop: 8 }} onClick={onComplete}>
        {task.id < total ? t('takeaway.nextTask') : t('takeaway.completeCourse')}
      </button>
    </div>
  )
}

import type { ScaffoldHint } from './ScaffoldPanel'

/** Phase→component registry. Each entry renders the phase given standard props. */
const PHASE_REGISTRY: Record<string, (props: {
  task: Task; onDone: () => void; onComplete: () => void; lessonId?: string; stepIdx?: number; label: string; partIds?: string[]; onOverlayChange?: (overlay: TextOverlay | null) => void; taskCount?: number; isRevisit?: boolean; onScaffoldPush?: (hint: ScaffoldHint) => void; onSidebarStep?: (step: number) => void
}) => JSX.Element | null> = {
  listen: ({ task, onDone, lessonId, isRevisit, label, onSidebarStep }) => <ListenPhase key={`l${task.id}`} task={task} onDone={onDone} lessonId={lessonId} isRevisit={isRevisit} label={label} onSidebarStep={onSidebarStep} />,
  practice: ({ task, onDone, stepIdx, onOverlayChange, isRevisit, onScaffoldPush, partIds }) => <PracticePhase key={`p${task.id}`} task={task} onDone={onDone} stepIdx={stepIdx} onOverlayChange={onOverlayChange} isRevisit={isRevisit} onScaffoldPush={onScaffoldPush} partIds={partIds} />,
  discuss: ({ task, onDone, isRevisit }) => <DiscussPhase key={`d${task.id}`} task={task} onDone={onDone} isRevisit={isRevisit} />,
  discovery: ({ task, onDone, stepIdx, isRevisit }) => <DiscoveryPhase key={`disc${task.id}`} task={task} onDone={onDone} stepIdx={stepIdx} isRevisit={isRevisit} />,
  takeaway: ({ task, onComplete, lessonId, taskCount, label }) => <TakeawayPhase task={task} onComplete={onComplete} lessonId={lessonId} taskCount={taskCount} label={label} />,
}

/** Resolve phase renderer: exact match first, then prefix match (e.g. practice-1 → practice) */
function getPhaseRenderer(phaseId: string) {
  if (PHASE_REGISTRY[phaseId]) return PHASE_REGISTRY[phaseId]
  const prefix = phaseId.split('-')[0]
  return PHASE_REGISTRY[prefix] ?? null
}

/* ═══ TASK VIEW — main component ═══ */
function TaskView({ task, onComplete, lessonId, stepIdx, phaseConfig, onOverlayChange, taskCount, doneSet, onPhaseChange, initialPhase, onScaffoldPush, onSidebarStep }: {
  task: Task; onComplete: () => void; lessonId?: string; stepIdx?: number; phaseConfig?: PhaseConfig[]; onOverlayChange?: (overlay: TextOverlay | null) => void; taskCount?: number; doneSet?: Set<number>; onPhaseChange?: (phase: string) => void; initialPhase?: string | null; onScaffoldPush?: (hint: ScaffoldHint) => void; onSidebarStep?: (step: number) => void
}) {
  const t = useT()
  const ctx = useContext(SessionCtx)
  const phases = phaseConfig?.length ? phaseConfig : getDefaultPhases(t)
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
            {t('task.header', { id: task.id })} · {task.name} — {task.time}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', lineHeight: 1.3, marginBottom: 8, color: 'var(--t1)' }}>
            {task.subtitle}
          </div>
        </div>
        {phases.map((phase, i) => {
          const unlocked = isUnlocked(phase)
          const renderer = getPhaseRenderer(phase.id)
          if (!renderer) return null
          const prevPhase = phases[i - 1]
          const showLocked = !unlocked && prevPhase && isUnlocked(prevPhase)
          return (
            <div key={phase.id}>
              {unlocked && renderer({
                task, lessonId, stepIdx, label: phase.label,
                partIds: phase.partIds,
                onDone: () => markDone(phase.id),
                onComplete,
                onOverlayChange,
                onScaffoldPush,
                onSidebarStep: phase.id === 'listen' || phase.id.startsWith('listen') ? onSidebarStep : undefined,
                taskCount,
                isRevisit: isRevisit || donePhases.has(phase.id),
              })}
              {showLocked && (
                <div className="stu-phase-locked-msg">{t('phase.lockedMsg', { prev: prevPhase.label, next: phase.label })}</div>
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
  if (screen !== 'intro' && screen !== 'summary' && screen !== 'personal-touch' && screen !== 'bonus-unlock' && screen !== 'bonus' && screen !== 'bonus-review') taskId = parseInt(screen)
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
export function TaskColumn({ screen, setScreen, task, completeTask, lessonId, stepIdx, articleTitle, lessonIntro, lessonSummary, phaseConfig, onOverlayChange, courseIntroView, taskCount, doneSet, onPhaseChange, initialPhase, onScaffoldPush, onSidebarStep, locale }: {
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
  onScaffoldPush?: (hint: ScaffoldHint) => void
  onSidebarStep?: (step: number) => void
  locale?: Locale
}) {
  const t = useT(locale)
  const { config } = useContext(SessionCtx)
  const introText = lessonIntro || ''
  const summaryText = lessonSummary || ''
  const title = articleTitle || t('intro.untitledLesson')

  return (
    <LocaleScope locale={locale}>
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
                    <div className="stu-instr-kp-label">{t('listen.remember')}</div>
                    <ul>{courseIntroView.keyPoints.map((kp, i) => <li key={i}>{kp}</li>)}</ul>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{t('intro.welcome')}</div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 16 }}>{title}</div>
                {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/lesson-intro.mp3`} />}
                <div style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--t2)', whiteSpace: 'pre-line' }}>{renderMd(introText, { math: config.enableMath })}</div>
              </>
            )}
          </div>
          {(taskCount ?? 0) > 0 ? (
            <button className="stu-btn pri" onClick={() => setScreen('1')}>
              {courseIntroView?.confirmLabel || t('intro.startTask')}
            </button>
          ) : (
            <div style={{ color: 'var(--t3)', fontSize: 14 }}>{t('intro.noTasks')}</div>
          )}
        </div>
      )}
      {screen === 'summary' && (
        <SummaryScreen lessonSummary={summaryText} lessonId={lessonId} enableMath={config.enableMath} onReviewBonus={() => setScreen('bonus-review')} />
      )}
      {screen === 'bonus-review' && (
        <BonusPhase reviewMode onComplete={() => setScreen('summary')} />
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
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: 'var(--t1)' }}>{t('bonus.unlockTitle')}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: 'var(--t2)' }}>{t('bonus.unlockSubtitle')}</div>
          <p style={{ color: 'var(--t2)', marginBottom: 4 }}>{t('bonus.unlockMsg1')}</p>
          <p style={{ color: 'var(--t2)', marginBottom: 6 }}>{t('bonus.unlockMsg2')}</p>
          <p style={{ fontSize: 15, marginBottom: 20 }}>{t('bonus.unlockArticle')}</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="stu-btn pri" onClick={() => setScreen('bonus')}>{t('bonus.unlockAccept')}</button>
            <button className="stu-btn ghost" onClick={() => setScreen('summary')}>{t('bonus.unlockSkip')}</button>
          </div>
        </div>
      )}
      {screen === 'bonus' && (
        <BonusPhase onComplete={() => setScreen('summary')} />
      )}
      {task && <TaskView key={task.id} task={task} onComplete={() => completeTask(task.id)} lessonId={lessonId} stepIdx={stepIdx} phaseConfig={phaseConfig} onOverlayChange={onOverlayChange} taskCount={taskCount} doneSet={doneSet} onPhaseChange={onPhaseChange} initialPhase={initialPhase} onScaffoldPush={onScaffoldPush} onSidebarStep={onSidebarStep} />}
    </div>
    </LocaleScope>
  )
}

/* default export kept for backwards compat — re-export the hook */
export default useStudentTask
