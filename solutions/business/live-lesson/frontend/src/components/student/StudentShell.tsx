import { useEffect, useMemo, Fragment } from 'react'
import type { ReadingManifest } from '../../types/reading'
import { useStudentTask, TaskColumn, TASKS, SessionCtx } from './TaskPanel'
import { buildTaskToStep, buildInstructionMap } from './task-data'
import TextPanel from './TextPanel'
import AiPanel from './AiPanel'

interface Props {
  manifest: ReadingManifest
  embed?: boolean
  sessionCode?: string
  studentId?: string
  submit?: (step: number, data: Record<string, any>) => Promise<boolean>
}

export default function StudentShell({ manifest, embed, sessionCode, studentId, submit }: Props) {
  const { taskId, task, currentFocus, doneSet, screen, setScreen, completeTask } = useStudentTask()

  // Signal ready to parent
  useEffect(() => {
    try { window.parent?.postMessage({ type: 'ready', role: 'student' }, window.location.origin) } catch { /* noop */ }
  }, [])

  // Compute task→step map from manifest (dynamic, not hardcoded)
  const taskToStep = useMemo(() => buildTaskToStep(manifest.readingSteps || []), [manifest.readingSteps])

  // Map each task to the preceding instruction's studentView
  const instructionMap = useMemo(
    () => buildInstructionMap(manifest.readingSteps || [], taskToStep),
    [manifest.readingSteps, taskToStep],
  )

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

    // 3) Build/merge exercise from answerKey
    const ak = step.answerKey
    if (ak) {
      const ex = { ...enriched.exercise }
      if (step.exerciseLabel) ex.label = step.exerciseLabel

      // Quiz: merge questionText/options/translate into questions
      if (ak.type === 'quiz' && ak.answers?.length) {
        const questions = ak.answers.map((a: any, i: number) => {
          const base = ex.questions?.[i] || {} as any
          return {
            ...base,
            ...(a.questionText && { q: a.questionText }),
            ...(a.questionTranslate && { translate: a.questionTranslate }),
            ...(a.options && { opts: a.options }),
            ...(typeof a.correct === 'number' && { correct: a.correct }),
            ...(a.hint && { hint: a.hint }),
            ...(a.hintZh && { hintZh: a.hintZh }),
            ...(a.walkthrough && { walkthrough: a.walkthrough }),
            ...(a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
          }
        })
        ex.questions = questions
      }

      // Match: merge shared options pool + pair hints
      if (ak.type === 'match' && ak.answers?.length) {
        const sharedOpts = ak.options
        const pairs = ak.answers.map((a: any, i: number) => {
          const base = ex.pairs?.[i] || {} as any
          return {
            ...base,
            ...(a.left && { left: a.left }),
            ...(sharedOpts && { opts: sharedOpts }),
            ...(a.correct != null && { correct: typeof a.correct === 'number' ? a.correct : sharedOpts?.indexOf(a.correct) ?? 0 }),
            ...(a.hint && { hint: a.hint }),
            ...(a.hintZh && { hintZh: a.hintZh }),
            ...(a.walkthrough && { walkthrough: a.walkthrough }),
            ...(a.walkthroughZh && { walkthroughZh: a.walkthroughZh }),
          }
        })
        ex.pairs = pairs
      }

      // Matrix: merge row fields
      if (ak.type === 'matrix' && ak.answers?.length) {
        const rows = ak.answers.map((a: any, i: number) => {
          const base = ex.rows?.[i] || {} as any
          return {
            ...base,
            ...(a.place && { place: a.place }),
            ...(a.isDemo != null && { demo: a.isDemo }),
            ...(a.practice && { practice: a.practice }),
            ...(a.reason && { reason: a.reason }),
            ...(a.hint && { hint: a.hint }),
            ...(a.hintZh && { hintZh: a.hintZh }),
          }
        })
        ex.rows = rows
      }

      // Stance: merge stance fields
      if (ak.type === 'stance') {
        if (ak.stanceQ) ex.stanceQ = ak.stanceQ
        if (ak.stanceQZh) ex.stanceQZh = ak.stanceQZh
        if (ak.stanceOpts) ex.stanceOpts = ak.stanceOpts
        if (ak.evidence) ex.evidence = ak.evidence
      }

      // Order: merge items + correctOrder
      if (ak.type === 'order') {
        if (ak.items) ex.items = ak.items
        if (ak.correctOrder) ex.correctOrder = ak.correctOrder
      }

      enriched = { ...enriched, exercise: ex }
    }

    if (instructionMap[enriched.id]) enriched.instructionView = instructionMap[enriched.id]

    return enriched
  }, [task, manifest.readingSteps, taskToStep, instructionMap])

  // Convert focus numbers to paragraph IDs
  const focusIds = currentFocus.map(n => `p${n}`)

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
        {TASKS.map((t, i) => {
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
              {i < TASKS.length - 1 && <div className="stu-prog-line" />}
            </Fragment>
          )
        })}
      </div>

      {/* Main area: left col (tasks) + right col (text) */}
      <SessionCtx.Provider value={{ sessionCode, studentId, submit }}>
        <div className="stu-main-wrap">
          <TaskColumn screen={screen} setScreen={setScreen} task={enrichedTask} completeTask={completeTask} lessonId={manifest.id} stepIdx={taskId ? taskToStep[taskId] : undefined} articleTitle={manifest.article.title} lessonIntro={manifest.lessonIntro} lessonSummary={manifest.lessonSummary} phaseConfig={manifest.phaseConfig} />
          <TextPanel
            title={manifest.article.title}
            paragraphs={manifest.article.paragraphs}
            focusIds={focusIds}
            lessonId={manifest.id}
            showRoles={taskId != null && manifest.readingSteps?.find(s => s.idx === taskToStep[taskId])?.showRoles === true}
          />
          <AiPanel taskId={taskId || 1} />
        </div>
      </SessionCtx.Provider>
    </div>
  )
}
