import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useStudentTask, TaskColumn, SessionCtx } from './TaskPanel'
import { buildTaskToStep, buildInstructionMap, buildTasksFromManifest, type TaskExercise } from './task-data'
import { fetchExerciseSpec, reportPhase, type ExerciseSpec, type CachedSubmission, type DiscussMeta } from '../../hooks/useClassroom'
import { enrichExerciseFromSpec } from './exercise/enrich-exercise'
import TextPanel from './TextPanel'
import type { TextOverlay } from './TextPanel'
import AiPanel from './ai-ask/AiPanel'
import TranslateButton from './TranslateButton'
import HelpGuide from './HelpGuide'
import StudentGuide from './StudentGuide'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
  sessionCode?: string
  studentId?: string
  studentName?: string
  submit?: (step: number, data: Record<string, unknown>) => Promise<boolean>
  initialProgress?: { currentTask: number; currentPhase: string; discussMeta?: DiscussMeta | null } | null
  initialSubmissions?: Record<number, CachedSubmission>
}

export default function StudentShell({ manifest, embed, sessionCode, studentId, studentName, submit, initialProgress, initialSubmissions }: Props) {
  // Lazy-load KaTeX CSS only for math-enabled lessons
  useEffect(() => {
    if (!manifest.enableMath) return
    import('katex/dist/katex.min.css')
  }, [manifest.enableMath])

  const tasks = useMemo(
    () => buildTasksFromManifest(manifest.readingSteps || []),
    [manifest.readingSteps],
  )
  const { taskId, task, currentFocus, doneSet, screen, setScreen, completeTask, taskCount, initialPhase } = useStudentTask(tasks, initialProgress)

  // Report 'completed' when student reaches personal-touch screen
  useEffect(() => {
    if (screen === 'personal-touch' && sessionCode && studentId) {
      reportPhase(sessionCode, studentId, taskCount, 'completed')
    }
  }, [screen]) // eslint-disable-line react-hooks/exhaustive-deps

  const [helpOpen, setHelpOpen] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<string>('listen')
  const handlePhaseChange = useCallback((phase: string) => setCurrentPhase(phase), [])

  const [textOverlay, setTextOverlay] = useState<TextOverlay | null>(null)
  const handleOverlayChange = useCallback((ov: TextOverlay | null) => setTextOverlay(ov), [])
  const [exerciseSpecs, setExerciseSpecs] = useState<Record<number, ExerciseSpec>>({})
  const [textbookOpen, setTextbookOpen] = useState(true)
  const [paraRefIds, setParaRefIds] = useState<string[]>([])

  // Listen for scroll-to-para events from paragraph reference links
  useEffect(() => {
    const handler = (e: Event) => {
      const ids = (e as CustomEvent).detail?.ids as string[] | undefined
      if (ids?.length) {
        setTextbookOpen(true)
        setParaRefIds(ids)
      }
    }
    window.addEventListener('scroll-to-para', handler)
    return () => window.removeEventListener('scroll-to-para', handler)
  }, [])

  // Clear paraRefIds after 3s highlight
  useEffect(() => {
    if (!paraRefIds.length) return
    const t = setTimeout(() => setParaRefIds([]), 5000)
    return () => clearTimeout(t)
  }, [paraRefIds])

  // Clear paraRefIds on task change
  useEffect(() => { setParaRefIds([]) }, [taskId])

  // Per-step onEnter.textbook
  const taskToStepRef = useMemo(() => buildTaskToStep(manifest.readingSteps || []), [manifest.readingSteps])
  useEffect(() => {
    if (!taskId) return
    const stepIdx = taskToStepRef[taskId]
    const step = manifest.readingSteps?.find(s => s.idx === stepIdx)
    if (step?.onEnter?.textbook) {
      setTextbookOpen(step.onEnter.textbook === 'open')
    }
  }, [taskId, taskToStepRef, manifest.readingSteps])

  // Keyboard: T to toggle, Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 't' || e.key === 'T') setTextbookOpen(o => !o)
      if (e.key === 'Escape' && textbookOpen) setTextbookOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [textbookOpen])

  // Signal ready to parent
  useEffect(() => {
    try { window.parent?.postMessage({ type: 'ready', role: 'student' }, window.location.origin) } catch { /* noop */ }
  }, [])

  // Fetch exercise spec from API (answer-safe) — fallback to manifest injection
  useEffect(() => {
    if (!sessionCode || !taskId) return
    const stepIdx = buildTaskToStep(manifest.readingSteps || [])[taskId]
    if (stepIdx === undefined || exerciseSpecs[stepIdx]) return
    fetchExerciseSpec(sessionCode, stepIdx, studentId).then(spec => {
      if (spec) setExerciseSpecs(prev => ({ ...prev, [stepIdx]: spec }))
    })
  }, [sessionCode, taskId, manifest.readingSteps, exerciseSpecs, studentId])

  // Compute task→step map from manifest (dynamic, not hardcoded)
  const taskToStep = taskToStepRef

  // Map each task to the preceding instruction's studentView
  const instructionMap = useMemo(
    () => buildInstructionMap(manifest.readingSteps || [], taskToStep),
    [manifest.readingSteps, taskToStep],
  )

  // Extract i0 intro studentView for rich course intro screen
  const courseIntroView = useMemo(() => {
    const introStep = (manifest.readingSteps || []).find(
      s => s.type === 'instruction' && s.studentView && s.idx === 0,
    )
    return introStep?.studentView ?? null
  }, [manifest.readingSteps])

  // Enrich task with manifest data — exercise content, discuss, hints, metadata
  const enrichedTask = useMemo(() => {
    if (!task) return task
    const stepIdx = taskToStep[task.id]
    const step = manifest.readingSteps?.find(s => s.idx === stepIdx)
    if (!step) return task

    let enriched = { ...task }

    // 1) Merge task-level metadata from manifest (subtitle, summary, exerciseLabel)
    if (step.subtitle) enriched.subtitle = step.subtitle
    if (step.summary) enriched.summary = step.summary

    // 2) Merge discuss (now built directly from manifest in buildTasksFromManifest)

    // 3) Build/merge exercise — prefer API exerciseSpec (answer-safe) over manifest answerKey
    const apiSpec = exerciseSpecs[stepIdx]
    const ak = step.answerKey

    const { exercise: enrichedEx, serverCheck } = enrichExerciseFromSpec(
      enriched.exercise, apiSpec, ak, step.exerciseLabel,
    )
    enriched = { ...enriched, exercise: enrichedEx }
    if (serverCheck) {
      ;(enriched.exercise as TaskExercise & { _serverCheck?: boolean })._serverCheck = true
    }

    if (instructionMap[enriched.id]) enriched.instructionView = instructionMap[enriched.id]

    return enriched
  }, [task, manifest.readingSteps, taskToStep, instructionMap, exerciseSpecs])

  // AI hints for current step (manifest-driven)
  const currentAiHints = useMemo(() => {
    if (!taskId) return undefined
    const stepIdx = taskToStep[taskId]
    const step = manifest.readingSteps?.find(s => s.idx === stepIdx)
    return step?.aiHints
  }, [taskId, taskToStep, manifest.readingSteps])

  // Convert focus numbers to paragraph IDs; para refs override when active
  const baseFocusIds = currentFocus.map(n => `p${n}`)
  const focusIds = paraRefIds.length > 0 ? paraRefIds : baseFocusIds

  // Student Guide (replaces SpotlightTour)
  const guideKey = studentName ? `student-guide-seen-${studentName}` : 'student-guide-seen'
  const [guideOpen, setGuideOpen] = useState(() => {
    try { return localStorage.getItem(guideKey) !== '1' } catch { return true }
  })
  const handleGuideClose = useCallback(() => {
    try { localStorage.setItem(guideKey, '1') } catch { /* noop */ }
    setGuideOpen(false)
    setTextbookOpen(true)
  }, [guideKey])
  const replayGuide = useCallback(() => setGuideOpen(true), [])

  return (
    <div className="stu-root">
      {/* Top bar */}
      {!embed && (
        <div className="stu-top">
          <div className="stu-top-title">{manifest.article.title}</div>
          <div className="stu-top-sub">Senior High English · AI 1-on-1</div>
          {task && (
            <div style={{ fontSize: 12, fontWeight: 600 }}>
              Task {task.id}: {task.name}
              <span style={{ color: 'var(--t3)', fontWeight: 400, marginLeft: 6 }}>{task.time}</span>
            </div>
          )}
          <HelpGuide onReplayGuide={replayGuide} open={helpOpen} onOpenChange={setHelpOpen} />
        </div>
      )}

      {/* Progress dots */}
      <div className="stu-prog-row">
        {tasks.map((t, i) => {
          const isAct = taskId === t.id
          const isDone = doneSet.has(t.id)
          const canClick = isDone || isAct || t.id === 1 || doneSet.has(t.id - 1)
          return (
            <Fragment key={t.id}>
              <div
                className="stu-prog-item"
                style={{ cursor: canClick ? 'pointer' : 'default' }}
                onClick={canClick ? () => setScreen(String(t.id)) : undefined}
              >
                <div className={`stu-prog-dot${isAct ? ' active' : ''}${isDone ? ' done' : ''}`}>
                  {isDone ? '✓' : t.id}
                </div>
                <div className={`stu-prog-name${isAct ? ' active' : ''}`}>{t.name}</div>
              </div>
              {i < tasks.length - 1 && <div className="stu-prog-line" />}
            </Fragment>
          )
        })}
      </div>

      {/* Main area: left col (tasks) + right col (text) */}
      <SessionCtx.Provider value={{ sessionCode, studentId, submit, config: { enableMath: manifest.enableMath }, boardData: manifest.boardData, restoredSubmissions: initialSubmissions, discussMeta: initialProgress?.discussMeta }}>
        <div className="stu-main-wrap">
          <TaskColumn
            screen={screen} setScreen={setScreen} task={enrichedTask} completeTask={completeTask}
            lessonId={manifest.id} stepIdx={taskId ? taskToStep[taskId] : undefined}
            articleTitle={manifest.article.title} lessonIntro={manifest.lessonIntro}
            lessonSummary={manifest.lessonSummary} phaseConfig={manifest.phaseConfig}
            onOverlayChange={handleOverlayChange}
            courseIntroView={courseIntroView}
            taskCount={taskCount}
            doneSet={doneSet}
            onPhaseChange={handlePhaseChange}
            initialPhase={initialPhase}
          />
          <TextPanel
            title={manifest.article.title}
            paragraphs={manifest.article.paragraphs}
            focusIds={focusIds}
            lessonId={manifest.id}
            showRoles={taskId != null && manifest.readingSteps?.find(s => s.idx === taskToStep[taskId])?.showRoles === true}
            overlay={textOverlay}
            collapsed={!textbookOpen}
            onToggle={() => setTextbookOpen(o => !o)}
            enableMath={manifest.enableMath}
          />
          <div className="stu-toolbar-h">
            <TranslateButton taskId={taskId || 1} phase={currentPhase} />
            <AiPanel
              taskId={taskId || 1}
              taskName={task?.name}
              phase={currentPhase}
              aiHints={currentAiHints}
            />
          </div>
        </div>
      </SessionCtx.Provider>
      <StudentGuide open={guideOpen} onClose={handleGuideClose} manifest={manifest} />
    </div>
  )
}
