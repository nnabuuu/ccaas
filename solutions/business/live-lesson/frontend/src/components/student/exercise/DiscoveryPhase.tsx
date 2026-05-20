import { useState, useCallback, useContext, useRef } from 'react'
import { GuidedDiscoveryExercise, serializeBlank } from './GuidedDiscoveryExercise'
import { SessionCtx } from '../TaskPanel'
import { checkAnswer, cacheSubmission, getCachedSubmission, type CheckItem } from '../../../hooks/useClassroom'
import type { Task } from '../task-data'
import type { Locale } from '../../../i18n'
import type { GdProgress } from './gd-types'

export type { GdProgress } from './gd-types'

/** Flatten BlankValue objects in step answers to plain strings for API/persistence */
function serializeStepAnswers(
  steps: Record<string, { answers?: Record<string, unknown> }>,
): Record<string, { answers: Record<string, string> }> {
  const out: Record<string, { answers: Record<string, string> }> = {}
  for (const [sid, step] of Object.entries(steps)) {
    out[sid] = {
      answers: Object.fromEntries(
        Object.entries(step.answers || {}).map(([k, v]) => [k, serializeBlank(v)]),
      ),
    }
  }
  return out
}

interface Props {
  task: Task
  onDone: () => void
  stepIdx?: number
  isRevisit?: boolean
  locale?: Locale
}

export function DiscoveryPhase({ task, onDone, stepIdx, isRevisit, locale }: Props) {
  const ctx = useContext(SessionCtx)
  const dk = task.discoveryKey
  const gdSteps = dk?.gdSteps || []

  // Attempt restore on mount (synchronous — no effects needed)
  const [cachedProgress] = useState<{ steps: Record<string, any>; progress: GdProgress } | null>(() => {
    if (stepIdx === undefined || isRevisit) return null
    const cached = ctx.sessionCode ? getCachedSubmission(ctx.sessionCode, stepIdx) : null
    const data = (cached?.data ?? ctx.restoredSubmissions?.[stepIdx]?.data) as Record<string, any> | undefined
    if (data?._gdProgress && Array.isArray(data._gdProgress.completedStepIds)) {
      return { steps: data.steps || {}, progress: data._gdProgress as GdProgress }
    }
    return null
  })

  const [ans, setAns] = useState<Record<string, any>>(
    cachedProgress ? { steps: cachedProgress.steps } : {},
  )
  const [stepResults, setStepResults] = useState<Record<string, boolean>>(
    cachedProgress?.progress.stepResults ?? {},
  )
  const [stepFeedbacks, setStepFeedbacks] = useState<Record<string, string>>(
    cachedProgress?.progress.stepFeedbacks ?? {},
  )
  const [allDone, setAllDone] = useState(!!isRevisit)
  const [submitting, setSubmitting] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(
    cachedProgress?.progress.currentStepIdx ?? 0,
  )
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    new Set(cachedProgress?.progress.completedStepIds ?? []),
  )

  // Ref for ans (needed in checkAnswer call to avoid re-creating on every keystroke)
  const ansRef = useRef(ans)
  ansRef.current = ans

  // Refs for current state values (read in saveProgress with overrides)
  const currentStepIdxRef = useRef(currentStepIdx)
  currentStepIdxRef.current = currentStepIdx
  const completedStepsRef = useRef(completedSteps)
  completedStepsRef.current = completedSteps
  const stepResultsRef = useRef(stepResults)
  stepResultsRef.current = stepResults
  const stepFeedbacksRef = useRef(stepFeedbacks)
  stepFeedbacksRef.current = stepFeedbacks

  // Guard: prevent saveProgress after final submit
  const doneRef = useRef(false)

  // Save progress to localStorage + backend. Callers pass overrides for values
  // they just changed (avoids stale-ref issues since setState hasn't committed yet).
  const saveProgress = useCallback((overrides?: Partial<GdProgress>) => {
    if (doneRef.current || stepIdx === undefined || !ctx.sessionCode) return
    const data = {
      steps: serializeStepAnswers(ansRef.current.steps || {}),
      _gdProgress: {
        currentStepIdx: overrides?.currentStepIdx ?? currentStepIdxRef.current,
        completedStepIds: overrides?.completedStepIds ?? [...completedStepsRef.current],
        stepResults: overrides?.stepResults ?? stepResultsRef.current,
        stepFeedbacks: overrides?.stepFeedbacks ?? stepFeedbacksRef.current,
      },
    }
    ctx.submit?.(stepIdx, data)
    cacheSubmission(ctx.sessionCode, stepIdx, data, null)
  }, [stepIdx, ctx.sessionCode, ctx.submit])

  // observation_choice: completed client-side, no server call needed
  const handleStepComplete = useCallback((stepId: string) => {
    const nextCompleted = new Set(completedStepsRef.current).add(stepId)
    setCompletedSteps(nextCompleted)
    saveProgress({ completedStepIds: [...nextCompleted] })
  }, [saveProgress])

  // Other step types: call /check, extract result for current step
  const handleStepSubmit = useCallback(async (stepId: string) => {
    if (!ctx.sessionCode || !ctx.studentId || stepIdx === undefined) return
    setSubmitting(true)
    try {
      const result = await checkAnswer(
        ctx.sessionCode, stepIdx, ctx.studentId,
        { steps: serializeStepAnswers(ansRef.current.steps || {}) },
        'guided-discovery',
      )
      if (result) {
        const item = result.items.find((it: CheckItem) => (it.idx as string) === stepId)
        // Compute new values before setState so we can pass them to saveProgress
        let newStepResults = stepResultsRef.current
        let newCompletedIds = [...completedStepsRef.current]
        let newStepFeedbacks = stepFeedbacksRef.current

        if (item) {
          newStepResults = { ...newStepResults, [stepId]: item.correct }
          setStepResults(newStepResults)
          if (item.correct) {
            const next = new Set(completedStepsRef.current).add(stepId)
            newCompletedIds = [...next]
            setCompletedSteps(next)
          }
        }
        const llmItem = result.items.find((it: CheckItem) => it.idx === '_llm')
        if (llmItem?.hint) {
          newStepFeedbacks = { ...newStepFeedbacks, [stepId]: llmItem.hint! }
          setStepFeedbacks(newStepFeedbacks)
        } else if (newStepFeedbacks[stepId]) {
          newStepFeedbacks = { ...newStepFeedbacks }
          delete newStepFeedbacks[stepId]
          setStepFeedbacks(newStepFeedbacks)
        }

        saveProgress({
          stepResults: newStepResults,
          completedStepIds: newCompletedIds,
          stepFeedbacks: newStepFeedbacks,
        })
      }
    } finally {
      setSubmitting(false)
    }
  }, [ctx.sessionCode, ctx.studentId, stepIdx, saveProgress])

  // Advance to next step, or finish if last
  const handleAdvance = useCallback(() => {
    const nextIdx = currentStepIdx + 1
    if (nextIdx >= gdSteps.length) {
      // Prevent any pending saveProgress from overwriting the clean final data
      doneRef.current = true
      // Final submit: clean data without _gdProgress for proper grading
      if (stepIdx !== undefined) {
        const finalData = { steps: serializeStepAnswers(ansRef.current.steps || {}) }
        ctx.submit?.(stepIdx, finalData)
        if (ctx.sessionCode) cacheSubmission(ctx.sessionCode, stepIdx, finalData, null)
      }
      setAllDone(true)
      onDone()
    } else {
      setCurrentStepIdx(nextIdx)
      saveProgress({ currentStepIdx: nextIdx })
    }
  }, [currentStepIdx, gdSteps.length, onDone, stepIdx, ctx.submit, ctx.sessionCode, saveProgress])

  if (!dk) return null

  return (
    <div id="phase-discovery" data-translate-ctx="discovery">
      <GuidedDiscoveryExercise
        steps={gdSteps}
        title={dk.gdTitle}
        summary={dk.gdSummary}
        ans={ans}
        setAns={setAns}
        stepResults={stepResults}
        stepFeedbacks={stepFeedbacks}
        allDone={allDone}
        locale={locale}
        currentStepIdx={currentStepIdx}
        completedSteps={completedSteps}
        onStepComplete={handleStepComplete}
        onStepSubmit={handleStepSubmit}
        onAdvance={handleAdvance}
        submitting={submitting}
      />
    </div>
  )
}
