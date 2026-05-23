import { useState, useEffect, useContext, useRef } from 'react'
import { linkParas } from '../utils/linkParas'
import { SessionCtx } from '../TaskPanel'
import type { Task, TaskExercise, ServerHintMap } from '../task-data'
import type { TextOverlay } from '../TextPanel'
import { reportAttempt } from './gradeItemSet'
import { checkAnswer, cacheSubmission, type CheckResult, type CachedSubmission, getCachedSubmission, getSubmission } from '../../../hooks/useClassroom'
import type { ScaffoldHint } from '../ScaffoldPanel'
import type { ReviewData } from '../../../hooks/useReviewRestore'
import { useT, LocaleScope, type Locale } from '../../../i18n'
// Plugin dispatch — built-in side-effect import registers all 11 plugins.
// Render + canSubmit + localGrade + enrich now all flow through these plugins;
// the previous per-type render blocks have been replaced by a single
// <PluginComp .../> call below.
import { getExerciseType } from './plugins'

export function PracticePhase({ task, onDone, stepIdx, onOverlayChange, isRevisit, onScaffoldPush, partIds, locale }: {
  task: Task; onDone: () => void; stepIdx?: number; onOverlayChange?: (overlay: TextOverlay | null) => void; isRevisit?: boolean; onScaffoldPush?: (hint: ScaffoldHint) => void; partIds?: string[]; locale?: Locale
}) {
  const ctx = useContext(SessionCtx)
  const t = useT(locale)
  const ex = task.exercise
  const [ans, setAns] = useState<Record<string, any>>({})
  const [attempts, setAttempts] = useState<Record<number, any[]>>({})
  const [wrongQs, setWrongQs] = useState<Set<number>>(new Set())
  const [correctQs, setCorrectQs] = useState<Set<number>>(new Set())
  const [allDone, setAllDone] = useState(false)
  const [softDone, setSoftDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  /**
   * Per-type transient UI state lives in a single bag instead of one useState
   * slot per type. Plugins read what they need by key (serverHints, matrixAns,
   * rowResults, feedback, itemResults, rubricResults, blankResults,
   * stepResults). Writes go through `setPluginState`. Keeping it as one bag
   * means PracticePhase stays type-agnostic for render — no per-type if/else.
   */
  const [pluginState, setPluginState] = useState<Record<string, any>>({})
  // Aliases used by handleCheckResult / canSub / submit (typed).
  const serverHints = (pluginState.serverHints ?? {}) as ServerHintMap
  const imageUploadRubricResults = (pluginState.rubricResults ?? {}) as Record<string, { score: number; hint?: string }>

  // Per-question timing: track when each question was first viewed
  const questionTimesRef = useRef<Record<number, number>>({})
  const [answerChanges, setAnswerChanges] = useState<Array<{ qi: number; from: number | null; to: number; at: number }>>([])
  const firstAttemptRef = useRef<unknown[] | null>(null)

  // ── Revisit / recovery: cache-first submission restore ──
  // Also load previous submission when phase=practice + score=100 (page reload recovery)
  const hasRestoredScore100 = stepIdx !== undefined
    && ctx.restoredSubmissions?.[stepIdx]?.score?.total === 100
  const shouldRestore = isRevisit || hasRestoredScore100

  const [prevSubmission, setPrevSubmission] = useState<CachedSubmission | null>(() => {
    if (!shouldRestore || stepIdx === undefined) return null
    const fromCtx = ctx.restoredSubmissions?.[stepIdx]
    if (fromCtx) return fromCtx
    if (ctx.sessionCode) return getCachedSubmission(ctx.sessionCode, stepIdx)
    return null
  })
  const [submissionChecked, setSubmissionChecked] = useState(!shouldRestore || prevSubmission != null)

  useEffect(() => {
    if (!shouldRestore || prevSubmission || !ctx.sessionCode || !ctx.studentId || stepIdx === undefined) return
    let cancelled = false
    getSubmission(ctx.sessionCode, ctx.studentId, stepIdx).then(sub => {
      if (cancelled) return
      if (sub) setPrevSubmission(sub)
      setSubmissionChecked(true)
    })
    return () => { cancelled = true }
  }, [shouldRestore, prevSubmission, ctx.sessionCode, ctx.studentId, stepIdx])

  const reviewMode = !!(shouldRestore && prevSubmission)

  const reviewPayload: ReviewData | undefined = reviewMode
    ? { data: prevSubmission!.data, checkItems: prevSubmission!.checkItems }
    : undefined

  // Restore firstAttemptRef from submission data (in effect to avoid ref mutation in render)
  useEffect(() => {
    if (!reviewMode || !prevSubmission?.data) return
    const fa = prevSubmission.data.firstAttemptAnswers ?? prevSubmission.data.firstAttemptOrder
    if (fa && !firstAttemptRef.current) {
      firstAttemptRef.current = fa as unknown[] | null
    }
  }, [reviewMode, prevSubmission])

  // Clear stale rubric results when student picks a new image (before re-submit)
  const imageKey = ex.type === 'image-upload' ? JSON.stringify(ans.images || []) : ''
  const prevImageKeyRef = useRef(imageKey)
  const hadRubricResults = useRef(false)
  hadRubricResults.current = Object.keys(imageUploadRubricResults).length > 0
  useEffect(() => {
    if (ex.type !== 'image-upload' || allDone) return
    if (prevImageKeyRef.current !== imageKey && hadRubricResults.current) {
      setPluginState(prev => ({ ...prev, feedback: null, rubricResults: {} }))
    }
    prevImageKeyRef.current = imageKey
  }, [imageKey, allDone, ex.type])

  // Defense in depth: PracticePhase forces allDone=true in reviewMode here,
  // and each exercise component also independently derives allDone from its restored state.
  const effectiveAllDone = reviewMode || allDone
  const effectiveSoftDone = reviewMode || softDone

  const canSub = () => {
    const plugin = getExerciseType(ex.type)
    if (!plugin) {
      // eslint-disable-next-line no-console
      console.warn(`[PracticePhase] no plugin registered for "${ex.type}"`)
      return false
    }
    const checkResultState = {
      correctQs,
      wrongQs,
      attempts,
      attemptCounts: undefined as Record<number, number> | undefined,
    }
    return plugin.canSubmit(ex as unknown as Record<string, unknown>, ans, checkResultState)
  }

  const useServerCheck = !!(ex as TaskExercise & { _serverCheck?: boolean })._serverCheck && ctx.sessionCode && ctx.studentId

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try { await doSubmit() } finally { setSubmitting(false) }
  }

  const doSubmit = async () => {
    // Per-question attempt counts (quiz/match only) — passed to plugin via state.
    let attemptCounts: Record<number, number> | undefined
    if (ex.type === 'quiz' || ex.type === 'match') {
      const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
      attemptCounts = {}
      items.forEach((_, idx) => {
        if (correctQs.has(idx)) {
          attemptCounts![idx] = (attempts[idx] || []).length
        } else if (ans[idx] !== undefined) {
          attemptCounts![idx] = (attempts[idx] || []).length + 1
        }
      })
    }

    const plugin = getExerciseType(ex.type)
    if (!plugin) {
      // eslint-disable-next-line no-console
      console.error(`[PracticePhase] no plugin for "${ex.type}" formatSubmitData; submission aborted`)
      return
    }
    // Wire payload comes from plugin.formatSubmitData. Per-type state
    // (matrixAns/etc.) lives in the shared `pluginState` bag.
    const submitData: Record<string, any> = plugin.formatSubmitData(ans, { ...pluginState, attemptCounts })

    // Attach per-question timing and answer changes (quiz/match only).
    if (ex.type === 'quiz' || ex.type === 'match') {
      const now = Date.now()
      const qTimes: Record<number, number> = {}
      for (const [qiStr, startTs] of Object.entries(questionTimesRef.current)) {
        qTimes[Number(qiStr)] = Math.round((now - startTs) / 1000)
      }
      submitData.questionTimes = qTimes
      submitData.answerChanges = answerChanges
    }

    // Freeze first attempt answers for quiz/match
    if ((ex.type === 'quiz' || ex.type === 'match') && !firstAttemptRef.current) {
      firstAttemptRef.current = [...(submitData.answers || submitData.pairs || [])]
    }
    // Freeze first attempt order
    if (ex.type === 'order' && !firstAttemptRef.current) {
      firstAttemptRef.current = [...(submitData.order || [])]
    }
    if (firstAttemptRef.current) {
      if (ex.type === 'order') {
        submitData.firstAttemptOrder = firstAttemptRef.current
      } else {
        submitData.firstAttemptAnswers = firstAttemptRef.current
      }
    }

    // Try server-side check API when available (no local answers needed)
    if (useServerCheck && stepIdx !== undefined) {
      const checkResult = await checkAnswer(
        ctx.sessionCode!, stepIdx, ctx.studentId!, submitData,
      )
      if (checkResult) {
        // Persist every check attempt so teacher observe has first-attempt data
        // Await so its cacheSubmission finishes before we overwrite with checkItems
        if (ctx.submit) {
          await ctx.submit(stepIdx, submitData)
        }
        // Cache checkItems for restore on refresh (after submit to avoid losing score)
        if (ctx.sessionCode) {
          const existing = getCachedSubmission(ctx.sessionCode, stepIdx)
          cacheSubmission(ctx.sessionCode, stepIdx, submitData, existing?.score ?? null, checkResult.items)
        }
        handleCheckResult(checkResult)
        return
      }
      // Fall through to local grading on API failure
    }

    // Persist submission for local grading path
    if (stepIdx !== undefined && ctx.submit) {
      ctx.submit(stepIdx, submitData)
    }

    // Local grading: dispatch to plugin.localGrade when available; otherwise
    // soft-complete (matrix/map/stance/etc. — types that don't ship a client
    // answer key, so the submission is trusted).
    const localResult = plugin?.localGrade?.(
      ex as unknown as Record<string, unknown>,
      ans,
      { correctQs, attempts },
      task.id,
    )
    if (localResult) {
      if (localResult.attempts) setAttempts(localResult.attempts)
      if (localResult.correctQs) setCorrectQs(localResult.correctQs)
      if (localResult.wrongQs) setWrongQs(localResult.wrongQs)
      if (localResult.clearAnsKeys && localResult.clearAnsKeys.length > 0) {
        if (localResult.clearAnsKeys.includes('order')) {
          setAns({})
        } else {
          const cleared = { ...ans }
          localResult.clearAnsKeys.forEach((k) => { delete cleared[k as keyof typeof cleared] })
          setAns(cleared)
        }
      }
      if (localResult.softDone) setSoftDone(true)
      if (localResult.allDone) { setAllDone(true); onDone() }
    } else {
      // No localGrade implementation → trust the submission.
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, true)
      onDone()
    }
  }

  /**
   * Handle server-side check result — dispatch to the registered plugin's
   * `handleCheckResult` and apply the returned state slots. Plugin output
   * covers: per-question attempts, correct/wrong sets, the consolidated
   * `pluginState` bag, ans-clear instructions, attempt reports, and the
   * allDone/softDone flags. PracticePhase's job here is purely orchestration —
   * no per-type branching.
   */
  const handleCheckResult = (result: CheckResult) => {
    const plugin = getExerciseType(ex.type)
    if (!plugin) {
      // eslint-disable-next-line no-console
      console.warn(`[PracticePhase] no plugin for "${ex.type}" handleCheckResult`)
      return
    }
    const output = plugin.handleCheckResult(result, ex as unknown as Record<string, any>, {
      ans,
      attempts,
      correctQs,
      serverHints,
      pluginState,
    })
    if (output.attempts) setAttempts(output.attempts)
    if (output.correctQs) setCorrectQs(output.correctQs)
    if (output.wrongQs) setWrongQs(output.wrongQs)
    setPluginState(output.checkResultState)
    if (output.clearAnsKeys && output.clearAnsKeys.length > 0) {
      if (output.clearAnsKeys.includes('order')) {
        setAns({})
      } else {
        const cleared = { ...ans }
        output.clearAnsKeys.forEach((k) => { delete cleared[k as keyof typeof cleared] })
        setAns(cleared)
      }
    }
    if (output.reportItems) {
      output.reportItems.forEach((r) => {
        reportAttempt(task.id, r.qi, r.attemptNum, r.selected, r.expected, r.isCorrect)
      })
    }
    if (output.softDone) setSoftDone(true)
    if (output.allDone) { setAllDone(true); onDone() }
  }

  // Loading state: revisit/recovery requested but submission not yet loaded from API
  if (shouldRestore && !submissionChecked) {
    return (
      <LocaleScope locale={locale}>
        <div id="phase-practice" data-translate-ctx="practice">
          <div className="stu-section-label"><span>{t('phase.practice')}</span><div className="stu-section-line" /></div>
          <div style={{ fontSize: 13, color: 'var(--t3)', padding: '16px 0' }}>{t('practice.loadingPrev')}</div>
        </div>
      </LocaleScope>
    )
  }

  // Wrapped setAns that tracks answer changes and question timing
  const trackedSetAns: typeof setAns = reviewMode ? () => {} : (updater) => {
    setAns(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      // Track per-question timing + answer changes for quiz/match
      if (ex.type === 'quiz' || ex.type === 'match') {
        const now = Date.now()
        for (const key of Object.keys(next)) {
          const qi = Number(key)
          if (isNaN(qi)) continue
          // Record first-view timestamp
          if (questionTimesRef.current[qi] == null) {
            questionTimesRef.current[qi] = now
          }
          // Record answer change if value changed
          if (prev[qi] !== undefined && next[qi] !== undefined && prev[qi] !== next[qi]) {
            setAnswerChanges(changes => [...changes, { qi, from: prev[qi] as number | null, to: next[qi] as number, at: now }])
          }
        }
      }
      return next
    })
  }
  const guardedSetAns: typeof setAns = reviewMode ? () => {} : trackedSetAns

  return (
    <LocaleScope locale={locale}>
    <div id="phase-practice" data-translate-ctx="practice">
      <div className="stu-section-label"><span>{t('phase.practice')}</span><div className="stu-section-line" /></div>
      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>{linkParas(ex.label)}</div>

      {(() => {
        // Single plugin dispatch — replaces the previous 11 per-type render
        // blocks. Plugin Component receives the consolidated `pluginState`
        // bag plus the shared {ans, attempts, correctQs, wrongQs} aliased
        // into the bag so plugins can stay type-agnostic.
        const plugin = getExerciseType(ex.type)
        if (!plugin) {
          return (
            <div style={{ fontSize: 13, color: 'var(--red)' }}>
              [PracticePhase] no plugin registered for type &quot;{ex.type}&quot;
            </div>
          )
        }
        const PluginComp = plugin.Component
        return (
          <PluginComp
            exercise={ex as unknown as Record<string, any>}
            ans={ans}
            setAns={guardedSetAns as any}
            allDone={effectiveAllDone}
            softDone={effectiveSoftDone}
            reviewData={reviewPayload}
            checkResultState={{ ...pluginState, correctQs, wrongQs, attempts }}
            setCheckResultState={setPluginState}
            onDone={() => { setAllDone(true); onDone() }}
            stepIdx={stepIdx}
            taskId={task.id}
            locale={locale}
            onOverlayChange={onOverlayChange}
            onScaffoldPush={onScaffoldPush}
            submit={ctx.submit}
            studentId={ctx.studentId}
            sessionCode={ctx.sessionCode}
            partIds={partIds}
          />
        )
      })()}

      {/* Submit/Done — plugins with selfManagedSubmit own their button. */}
      {(() => {
        const plugin = getExerciseType(ex.type)
        return !plugin?.selfManagedSubmit
      })() && (
        <div style={{ marginTop: 16 }}>
          {effectiveAllDone ? (
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16 }}>✓</span>{t('practice.complete')}
            </div>
          ) : (
            <>
              <button
                className="stu-btn pri"
                style={(!canSub() || submitting) ? { opacity: 0.35, cursor: 'default' } : undefined}
                onClick={(canSub() && !submitting) ? handleSubmit : undefined}
              >
                {submitting ? t('practice.checking')
                  : ex.type === 'image-upload' && Object.keys(imageUploadRubricResults).length > 0 ? t('practice.resubmit')
                  : Object.keys(attempts).length > 0 ? t('practice.tryAgain') : t('practice.submit')}
              </button>
              {ex.type === 'image-upload' && Object.keys(imageUploadRubricResults).length > 0 && !effectiveAllDone && (
                <button
                  className="stu-btn"
                  style={{ marginTop: 8, background: 'var(--surface)', color: 'var(--t2)', border: '1px solid var(--border)' }}
                  onClick={() => { setAllDone(true); onDone() }}
                >
                  {t('practice.continueToDiscuss')}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
    </LocaleScope>
  )
}
