import { useState, useCallback, useContext, useRef } from 'react'
import { GuidedDiscoveryExercise } from './GuidedDiscoveryExercise'
import { SessionCtx } from '../TaskPanel'
import { checkAnswer, type CheckItem } from '../../../hooks/useClassroom'
import type { Task } from '../task-data'
import type { Locale } from '../../../i18n'

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

  const [ans, setAns] = useState<Record<string, any>>({})
  const [stepResults, setStepResults] = useState<Record<string, boolean>>({})
  const [allDone, setAllDone] = useState(!!isRevisit)
  const [submitting, setSubmitting] = useState(false)
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  // Use ref for ans to avoid re-creating handleStepSubmit on every keystroke
  const ansRef = useRef(ans)
  ansRef.current = ans

  // observation_choice: completed client-side, no server call needed
  const handleStepComplete = useCallback((stepId: string) => {
    setCompletedSteps(prev => new Set(prev).add(stepId))
  }, [])

  // Other step types: call /check, extract result for current step
  const handleStepSubmit = useCallback(async (stepId: string) => {
    if (!ctx.sessionCode || !ctx.studentId || stepIdx === undefined) return
    setSubmitting(true)
    try {
      const result = await checkAnswer(
        ctx.sessionCode, stepIdx, ctx.studentId,
        { steps: ansRef.current.steps || {} },
        'guided-discovery',
      )
      if (result) {
        const item = result.items.find((it: CheckItem) => (it.idx as string) === stepId)
        if (item) {
          setStepResults(prev => ({ ...prev, [stepId]: item.correct }))
          if (item.correct) {
            setCompletedSteps(prev => new Set(prev).add(stepId))
          }
        }
      }
    } finally {
      setSubmitting(false)
    }
  }, [ctx.sessionCode, ctx.studentId, stepIdx])

  // Advance to next step, or finish if last
  const handleAdvance = useCallback(() => {
    const nextIdx = currentStepIdx + 1
    if (nextIdx >= gdSteps.length) {
      setAllDone(true)
      onDone()
    } else {
      setCurrentStepIdx(nextIdx)
    }
  }, [currentStepIdx, gdSteps.length, onDone])

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
