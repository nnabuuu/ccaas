import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useStudentTask, TaskColumn, SessionCtx } from './TaskPanel'
import { buildTaskToStep, buildInstructionMap, buildTasksFromManifest, type TaskExercise, type TaskQuestion, type TaskMatchPair, type TaskMatrixRow } from './task-data'
import { fetchExerciseSpec, type ExerciseSpec } from '../../hooks/useClassroom'
import TextPanel from './TextPanel'
import type { TextOverlay } from './TextPanel'
import AiPanel from './AiPanel'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
  sessionCode?: string
  studentId?: string
  submit?: (step: number, data: Record<string, unknown>) => Promise<boolean>
}

export default function StudentShell({ manifest, embed, sessionCode, studentId, submit }: Props) {
  // Lazy-load KaTeX CSS only for math-enabled lessons
  useEffect(() => {
    if (!manifest.enableMath) return
    import('katex/dist/katex.min.css')
  }, [manifest.enableMath])

  const tasks = useMemo(
    () => buildTasksFromManifest(manifest.readingSteps || []),
    [manifest.readingSteps],
  )
  const { taskId, task, currentFocus, doneSet, screen, setScreen, completeTask, taskCount } = useStudentTask(tasks)
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
    const t = setTimeout(() => setParaRefIds([]), 3000)
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
    fetchExerciseSpec(sessionCode, stepIdx).then(spec => {
      if (spec) setExerciseSpecs(prev => ({ ...prev, [stepIdx]: spec }))
    })
  }, [sessionCode, taskId, manifest.readingSteps, exerciseSpecs])

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

    // 2) Merge discuss
    if (step.discuss) enriched.manifestDiscuss = step.discuss

    // 3) Build/merge exercise — prefer API exerciseSpec (answer-safe) over manifest answerKey
    const apiSpec = exerciseSpecs[stepIdx]
    const ak = step.answerKey

    if (apiSpec) {
      // Use sanitized exercise spec from API (no answers embedded)
      const ex = { ...enriched.exercise }
      ex.type = apiSpec.type
      if (apiSpec.label) ex.label = apiSpec.label

      if (apiSpec.type === 'quiz' && apiSpec.questions) {
        ex.questions = apiSpec.questions.map((q, i) => {
          const base = ex.questions?.[i] || {} as Partial<TaskQuestion>
          return { ...base, q: q.text, translate: q.translate, opts: q.options } as TaskQuestion
        })
      }
      if (apiSpec.type === 'match' && apiSpec.pairs) {
        ex.pairs = apiSpec.pairs.map((p, i) => {
          const base = ex.pairs?.[i] || {} as Partial<TaskMatchPair>
          return { ...base, left: p.left, opts: p.options } as TaskMatchPair
        })
      }
      if (apiSpec.type === 'matrix' && apiSpec.rows) {
        ex.rows = apiSpec.rows.map((r, i) => {
          const base = ex.rows?.[i] || {} as Partial<TaskMatrixRow>
          return { ...base, place: r.place, demo: r.isDemo, ...(r.practice && { practice: r.practice }), ...(r.reason && { reason: r.reason }) } as TaskMatrixRow
        })
      }
      if (apiSpec.type === 'stance') {
        if (apiSpec.stanceQ) ex.stanceQ = apiSpec.stanceQ
        if (apiSpec.stanceQZh) ex.stanceQZh = apiSpec.stanceQZh
        if (apiSpec.stanceOpts) ex.stanceOpts = apiSpec.stanceOpts
        if (apiSpec.evidence) ex.evidence = apiSpec.evidence
      }
      if (apiSpec.type === 'order') {
        if (apiSpec.items) ex.items = apiSpec.items
        // No correctOrder — grading via check API
      }
      if (apiSpec.type === 'map') {
        if (apiSpec.prompt) ex.prompt = apiSpec.prompt
        if (apiSpec.axes) ex.axes = apiSpec.axes
        if (apiSpec.mapItems) ex.mapItems = apiSpec.mapItems
        if (apiSpec.minReasonLength) ex.minReasonLength = apiSpec.minReasonLength
      }
      if (apiSpec.type === 'select-evidence') {
        // Internal grading needs full manifest data (correctFunction, kind, why).
        // Don't overwrite with stripped API spec — just keep manifest fields.
      }

      // Mark that this exercise uses server-side checking (no local answers)
      // except select-evidence which uses self-contained internal grading
      if (apiSpec.type !== 'select-evidence') {
        ;(ex as TaskExercise & { _serverCheck?: boolean })._serverCheck = true
      }

      enriched = { ...enriched, exercise: ex }
    } else if (ak) {
      // Fallback: manifest answerKey injection (may contain answers from sanitized manifest)
      const ex = { ...enriched.exercise }
      if (step.exerciseLabel) ex.label = step.exerciseLabel

      if (ak.type === 'quiz' && ak.answers?.length) {
        ex.questions = ak.answers.map((a: Record<string, unknown>, i: number) => {
          const base = ex.questions?.[i] || {} as Partial<TaskQuestion>
          return {
            ...base,
            ...(a.questionText && { q: a.questionText as string }),
            ...(a.questionTranslate && { translate: a.questionTranslate as string }),
            ...(a.options && { opts: a.options as string[] }),
            ...(typeof a.correct === 'number' && { correct: a.correct }),
            ...(a.hint && { hint: a.hint as string }),
            ...(a.hintZh && { hintZh: a.hintZh as string }),
            ...(a.walkthrough && { walkthrough: a.walkthrough as string }),
            ...(a.walkthroughZh && { walkthroughZh: a.walkthroughZh as string }),
          } as TaskQuestion
        })
        // Sanitized manifest uses ExerciseSpec format (text/translate/options fields)
        if (ak.questions?.length) {
          ex.questions = ak.questions.map((q: Record<string, unknown>, i: number) => {
            const base = ex.questions?.[i] || {} as Partial<TaskQuestion>
            return { ...base, q: (q.text as string) || base.q, translate: (q.translate as string) || base.translate, opts: (q.options as string[]) || base.opts } as TaskQuestion
          })
        }
      }
      if (ak.type === 'match' && ak.answers?.length) {
        const sharedOpts = ak.options
        ex.pairs = ak.answers.map((a: Record<string, unknown>, i: number) => {
          const base = ex.pairs?.[i] || {} as Partial<TaskMatchPair>
          return {
            ...base,
            ...(a.left && { left: a.left as string }),
            ...(sharedOpts && { opts: sharedOpts }),
            ...(a.correct != null && { correct: typeof a.correct === 'number' ? a.correct : (sharedOpts as string[] | undefined)?.indexOf(a.correct as string) ?? 0 }),
            ...(a.hint && { hint: a.hint as string }),
            ...(a.hintZh && { hintZh: a.hintZh as string }),
          } as TaskMatchPair
        })
        // Sanitized manifest uses ExerciseSpec format
        if (ak.pairs?.length) {
          ex.pairs = ak.pairs.map((p: Record<string, unknown>, i: number) => {
            const base = ex.pairs?.[i] || {} as Partial<TaskMatchPair>
            return { ...base, left: (p.left as string) || base.left, opts: (p.options as string[]) || base.opts } as TaskMatchPair
          })
        }
      }
      if (ak.type === 'matrix' && ak.answers?.length) {
        ex.rows = ak.answers.map((a: Record<string, unknown>, i: number) => {
          const base = ex.rows?.[i] || {} as Partial<TaskMatrixRow>
          return {
            ...base,
            ...(a.place && { place: a.place as string }),
            ...(a.isDemo != null && { demo: a.isDemo as boolean }),
            ...(a.practice && { practice: a.practice as string }),
            ...(a.reason && { reason: a.reason as string }),
            ...(a.hint && { hint: a.hint as string }),
            ...(a.hintZh && { hintZh: a.hintZh as string }),
          } as TaskMatrixRow
        })
        // Sanitized manifest uses ExerciseSpec format
        if (ak.rows?.length) {
          ex.rows = ak.rows.map((r: Record<string, unknown>, i: number) => {
            const base = ex.rows?.[i] || {} as Partial<TaskMatrixRow>
            return { ...base, place: (r.place as string) || base.place, demo: (r.isDemo as boolean) ?? base.demo, ...(r.practice && { practice: r.practice as string }), ...(r.reason && { reason: r.reason as string }) } as TaskMatrixRow
          })
        }
      }
      if (ak.type === 'stance') {
        if (ak.stanceQ) ex.stanceQ = ak.stanceQ
        if (ak.stanceQZh) ex.stanceQZh = ak.stanceQZh
        if (ak.stanceOpts) ex.stanceOpts = ak.stanceOpts
        if (ak.evidence) ex.evidence = ak.evidence
      }
      if (ak.type === 'order') {
        if (ak.items) ex.items = ak.items
        if (ak.correctOrder) ex.correctOrder = ak.correctOrder
      }
      if (ak.type === 'select-evidence') {
        ex.type = 'select-evidence'
        if (ak.functionOptions) ex.functionOptions = ak.functionOptions
        if (ak.sections) ex.sections = ak.sections
        if (ak.paragraphTokens) ex.paragraphTokens = ak.paragraphTokens
      }
      if (ak.type === 'map') {
        if (ak.prompt) ex.prompt = ak.prompt
        if (ak.axes) ex.axes = ak.axes
        if (ak.mapItems) ex.mapItems = ak.mapItems
        else if (ak.items) ex.mapItems = ak.items
        if (ak.minReasonLength) ex.minReasonLength = ak.minReasonLength
      }
      enriched = { ...enriched, exercise: ex }
    }

    if (instructionMap[enriched.id]) enriched.instructionView = instructionMap[enriched.id]

    return enriched
  }, [task, manifest.readingSteps, taskToStep, instructionMap, exerciseSpecs])

  // Convert focus numbers to paragraph IDs; para refs override when active
  const baseFocusIds = currentFocus.map(n => `p${n}`)
  const focusIds = paraRefIds.length > 0 ? paraRefIds : baseFocusIds

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
      <SessionCtx.Provider value={{ sessionCode, studentId, submit, config: { enableMath: manifest.enableMath } }}>
        <div className="stu-main-wrap">
          <TaskColumn
            screen={screen} setScreen={setScreen} task={enrichedTask} completeTask={completeTask}
            lessonId={manifest.id} stepIdx={taskId ? taskToStep[taskId] : undefined}
            articleTitle={manifest.article.title} lessonIntro={manifest.lessonIntro}
            lessonSummary={manifest.lessonSummary} phaseConfig={manifest.phaseConfig}
            onOverlayChange={handleOverlayChange}
            courseIntroView={courseIntroView}
            taskCount={taskCount}
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
          <AiPanel taskId={taskId || 1} />
        </div>
      </SessionCtx.Provider>
    </div>
  )
}
