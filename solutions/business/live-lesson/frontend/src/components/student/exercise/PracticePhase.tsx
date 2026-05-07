import { useState, useEffect, useContext, useRef } from 'react'
import { linkParas } from '../utils/linkParas'
import { SessionCtx } from '../TaskPanel'
import type { Task, TaskExercise, ServerHintMap } from '../task-data'
import type { TextOverlay } from '../TextPanel'
import { gradeItemSet, reportAttempt, formatSubmitData } from './gradeItemSet'
import { checkAnswer, type CheckResult, type CachedSubmission, getCachedSubmission, getSubmission } from '../../../hooks/useClassroom'
import { QuizExercise } from './QuizExercise'
import { MatchExercise } from './MatchExercise'
import { MatrixExercise } from './MatrixExercise'
import { StanceExercise } from './StanceExercise'
import { OrderExercise } from './OrderExercise'
import { SelectEvidenceExercise } from './SelectEvidenceExercise'
import { MapExercise } from './MapExercise'

/** Reverse formatSubmitData: convert persisted submission data back to component ans state */
export function restoreAns(type: string, data: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {}
  switch (type) {
    case 'quiz': {
      const ans: Record<string, unknown> = {}
      ;((data.answers as unknown[]) || []).forEach((v, i) => { ans[i] = v })
      return ans
    }
    case 'match': {
      const ans: Record<string, unknown> = {}
      ;((data.pairs as unknown[]) || []).forEach((v, i) => { ans[i] = v })
      return ans
    }
    case 'order':
      return { order: data.order || [] }
    case 'stance':
      return { stance: data.position, evidence: data.evidence || [] }
    case 'map':
      return { placements: data.placements || {}, reasons: data.reasons || {} }
    case 'matrix':
      return data // matrix restoration handled separately via effectiveMatrixAns
    case 'select-evidence':
      return {} // select-evidence uses placeholder UI in review mode
    default:
      return data as Record<string, unknown>
  }
}

export function PracticePhase({ task, onDone, stepIdx, onOverlayChange, isRevisit }: {
  task: Task; onDone: () => void; stepIdx?: number; onOverlayChange?: (overlay: TextOverlay | null) => void; isRevisit?: boolean
}) {
  const ctx = useContext(SessionCtx)
  const ex = task.exercise
  const [ans, setAns] = useState<Record<string, any>>({})
  const [attempts, setAttempts] = useState<Record<number, any[]>>({})
  const [wrongQs, setWrongQs] = useState<Set<number>>(new Set())
  const [correctQs, setCorrectQs] = useState<Set<number>>(new Set())
  const [allDone, setAllDone] = useState(false)
  const [softDone, setSoftDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverHints, setServerHints] = useState<ServerHintMap>({})
  const [mapFeedback, setMapFeedback] = useState<string | null>(null)
  const [matrixAns, setMatrixAns] = useState<Record<number, { what?: string; why?: string }>>({})

  // Per-question timing: track when each question was first viewed
  const questionTimesRef = useRef<Record<number, number>>({})
  const [answerChanges, setAnswerChanges] = useState<Array<{ qi: number; from: number | null; to: number; at: number }>>([])
  const firstAttemptRef = useRef<unknown[] | null>(null)

  // ── Revisit: cache-first submission restore ──
  const [prevSubmission, setPrevSubmission] = useState<CachedSubmission | null>(() => {
    if (!isRevisit || stepIdx === undefined) return null
    const fromCtx = ctx.restoredSubmissions?.[stepIdx]
    if (fromCtx) return fromCtx
    if (ctx.sessionCode) return getCachedSubmission(ctx.sessionCode, stepIdx)
    return null
  })
  const [submissionChecked, setSubmissionChecked] = useState(!isRevisit || prevSubmission != null)

  useEffect(() => {
    if (!isRevisit || prevSubmission || !ctx.sessionCode || !ctx.studentId || stepIdx === undefined) return
    let cancelled = false
    getSubmission(ctx.sessionCode, ctx.studentId, stepIdx).then(sub => {
      if (cancelled) return
      if (sub) setPrevSubmission(sub)
      setSubmissionChecked(true)
    })
    return () => { cancelled = true }
  }, [isRevisit, prevSubmission, ctx.sessionCode, ctx.studentId, stepIdx])

  const reviewMode = !!(isRevisit && prevSubmission)

  // Derive effective state for review mode (pre-filled, locked answers)
  const effectiveAns = reviewMode ? restoreAns(ex.type, prevSubmission.data) : ans
  const effectiveMatrixAns = reviewMode && ex.type === 'matrix'
    ? (prevSubmission.data.rows || {}) as Record<number, { what?: string; why?: string }>
    : matrixAns
  const effectiveCorrectQs = reviewMode && (ex.type === 'quiz' || ex.type === 'match')
    ? new Set((ex.type === 'quiz' ? ex.questions! : ex.pairs!).map((_, i) => i))
    : correctQs
  const effectiveAllDone = reviewMode || allDone
  const effectiveSoftDone = reviewMode || softDone

  const canSub = () => {
    if (ex.type === 'quiz') return !ex.questions!.some((_, qi) => !correctQs.has(qi) && ans[qi] === undefined)
    if (ex.type === 'match') return !ex.pairs!.some((_, pi) => !correctQs.has(pi) && ans[pi] === undefined)
    if (ex.type === 'matrix') return true
    if (ex.type === 'stance') return ans.stance !== undefined && (ans.evidence || []).length >= 1
    if (ex.type === 'order') return (ans.order || []).length === ex.items!.length
    if (ex.type === 'select-evidence') return false // handled internally
    if (ex.type === 'map') {
      const items = ex.mapItems || []
      const practiceSet = ex.practiceItemIds ? new Set(ex.practiceItemIds) : null
      const practice = practiceSet
        ? items.filter(it => practiceSet.has(it.id))
        : ex.practiceCount ? items.slice(0, ex.practiceCount) : items
      const pl = ans.placements || {}
      const rs = ans.reasons || {}
      const min = ex.minReasonLength || 8
      return practice.every(it => pl[it.id] && (rs[it.id] || '').trim().length >= min)
    }
    return true
  }

  const useServerCheck = !!(ex as TaskExercise & { _serverCheck?: boolean })._serverCheck && ctx.sessionCode && ctx.studentId

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try { await doSubmit() } finally { setSubmitting(false) }
  }

  const doSubmit = async () => {
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

    const effectiveAns = ex.type === 'matrix' ? { ...ans, rows: matrixAns } : ans
    const submitData = formatSubmitData(ex.type, effectiveAns, { attemptCounts })

    // Attach per-question timing and answer changes
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
        if (ctx.submit) {
          ctx.submit(stepIdx, submitData)
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

    // Local grading fallback
    if (ex.type === 'quiz' || ex.type === 'match') {
      const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
      const result = gradeItemSet(items as { correct: number }[], ans, { correctQs, attempts }, task.id)
      setAttempts(result.attempts); setCorrectQs(result.correctQs); setWrongQs(result.wrongQs)
      if (result.wrongQs.size > 0) {
        const cleared = { ...ans }; result.wrongQs.forEach(qi => { delete cleared[qi] }); setAns(cleared)
      }
      if (result.allDone) { setAllDone(true); onDone() }
    } else if (ex.type === 'order') {
      const order = ans.order || []
      const isOk = order.every((idx: number, pos: number) => ex.correctOrder![pos] === idx)
      const newAttempts = { ...attempts }
      if (!newAttempts[0]) newAttempts[0] = []
      newAttempts[0].push({ selected: [...order], correct: ex.correctOrder, isCorrect: isOk, ts: Date.now() })
      reportAttempt(task.id, 0, newAttempts[0].length, order, ex.correctOrder, isOk)
      setAttempts(newAttempts)
      if (isOk) {
        setAllDone(true); onDone()
      } else {
        const wrong = new Set<number>()
        order.forEach((idx: number, pos: number) => { if (ex.correctOrder![pos] !== idx) wrong.add(pos) })
        setWrongQs(wrong); setAns({})
      }
    } else {
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, true)
      onDone()
    }
  }

  const toIdx = (v: unknown) => typeof v === 'number' ? v : parseInt(String(v), 10)

  /** Handle server-side check result — update local state based on per-item feedback */
  const handleCheckResult = (result: CheckResult) => {
    if (result.allCorrect) {
      if (ex.type === 'quiz' || ex.type === 'match') {
        const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
        setCorrectQs(new Set(items.map((_, i) => i)))
      }
      setAllDone(true); onDone()
      return
    }

    if (ex.type === 'quiz' || ex.type === 'match') {
      const newCorrectQs = new Set(correctQs)
      const newWrongQs = new Set<number>()
      const newAttempts = { ...attempts }

      const newHints = { ...serverHints }
      result.items.forEach(item => {
        const idx = toIdx(item.idx)
        if (!newAttempts[idx]) newAttempts[idx] = []
        newAttempts[idx].push({ selected: ans[idx], isCorrect: item.correct, ts: Date.now() })
        reportAttempt(task.id, idx, newAttempts[idx].length, ans[idx], null, item.correct)
        if (item.correct) newCorrectQs.add(idx)
        else {
          newWrongQs.add(idx)
          if (item.hint || item.hintZh || item.walkthrough || item.walkthroughZh) {
            newHints[idx] = { hint: item.hint, hintZh: item.hintZh, walkthrough: item.walkthrough, walkthroughZh: item.walkthroughZh }
          }
        }
      })
      setServerHints(newHints)

      setAttempts(newAttempts); setCorrectQs(newCorrectQs); setWrongQs(newWrongQs)
      if (newWrongQs.size > 0) {
        const cleared = { ...ans }; newWrongQs.forEach(qi => { delete cleared[qi] }); setAns(cleared)
      }
      const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
      if (newWrongQs.size === 0 && newCorrectQs.size === items.length) {
        setAllDone(true); onDone()
      }
    } else if (ex.type === 'order') {
      const newAttempts = { ...attempts }
      if (!newAttempts[0]) newAttempts[0] = []
      newAttempts[0].push({ selected: ans.order, isCorrect: false, ts: Date.now() })
      reportAttempt(task.id, 0, newAttempts[0].length, ans.order, null, false)
      setAttempts(newAttempts)
      // Mark wrong positions from items (use item.idx, not array index)
      const wrong = new Set<number>()
      result.items.forEach(item => {
        const pos = toIdx(item.idx)
        if (!item.correct) wrong.add(pos)
      })
      setWrongQs(wrong); setAns({})
    } else if (ex.type === 'matrix') {
      const newHints = { ...serverHints }
      result.items.forEach(item => {
        const idx = toIdx(item.idx)
        if (!item.correct && (item.hint || item.hintZh)) {
          newHints[idx] = { hint: item.hint, hintZh: item.hintZh }
        }
      })
      setServerHints(newHints)
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, result.allCorrect)
      onDone()
    } else if (ex.type === 'map') {
      const llmItem = result.items.find(it => it.idx === '_llm')
      if (llmItem?.hint) setMapFeedback(llmItem.hint)
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, result.allCorrect)
      onDone()
    } else {
      // stance — soft done
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, result.allCorrect)
      onDone()
    }
  }

  const attemptCount = (qi: number) => (attempts[qi] || []).length

  // Loading state: revisit requested but submission not yet loaded from API
  if (isRevisit && !submissionChecked) {
    return (
      <div id="phase-practice">
        <div className="stu-section-label"><span>Practice</span><div className="stu-section-line" /></div>
        <div style={{ fontSize: 13, color: 'var(--t3)', padding: '16px 0' }}>Loading previous answers...</div>
      </div>
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
  const noopSetAns: typeof setAns = reviewMode ? () => {} : trackedSetAns

  return (
    <div id="phase-practice">
      <div className="stu-section-label"><span>Practice</span><div className="stu-section-line" /></div>
      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>{linkParas(ex.label)}</div>

      {ex.type === 'quiz' && (
        <QuizExercise
          questions={ex.questions!}
          ans={effectiveAns}
          setAns={noopSetAns}
          correctQs={effectiveCorrectQs}
          wrongQs={wrongQs}
          attemptCount={attemptCount}
          serverHints={serverHints}
        />
      )}
      {ex.type === 'match' && (
        <MatchExercise
          pairs={ex.pairs!}
          ans={effectiveAns}
          setAns={noopSetAns}
          correctQs={effectiveCorrectQs}
          wrongQs={wrongQs}
          attemptCount={attemptCount}
          serverHints={serverHints}
        />
      )}
      {ex.type === 'matrix' && (
        <MatrixExercise
          rows={ex.rows!}
          practiceCount={ex.practiceCount}
          studentId={ctx.studentId}
          stepIdx={stepIdx}
          serverHints={serverHints}
          ans={effectiveMatrixAns}
          onAnsChange={reviewMode
            ? (() => {})
            : (ri, field, val) => setMatrixAns(prev => ({ ...prev, [ri]: { ...prev[ri], [field]: val } }))}
          disabled={effectiveAllDone}
        />
      )}
      {ex.type === 'stance' && <StanceExercise stanceQ={ex.stanceQ!} stanceQZh={ex.stanceQZh} stanceOpts={ex.stanceOpts!} evidence={ex.evidence!} ans={effectiveAns} setAns={noopSetAns} softDone={effectiveSoftDone} />}
      {ex.type === 'order' && <OrderExercise items={ex.items!} ans={effectiveAns} setAns={noopSetAns} done={effectiveAllDone} wrongPositions={wrongQs} attemptCount={(attempts[0] || []).length} />}
      {ex.type === 'map' && ex.axes && ex.mapItems && (
        <MapExercise
          prompt={ex.prompt || ''}
          axes={ex.axes}
          mapItems={ex.mapItems}
          minReasonLength={ex.minReasonLength || 8}
          ans={effectiveAns}
          setAns={noopSetAns}
          allDone={effectiveAllDone}
          feedback={mapFeedback}
          givenPlacements={ex.givenPlacements}
          practiceCount={ex.practiceCount}
          practiceItemIds={ex.practiceItemIds}
          onActiveChange={(refs) => {
            if (!onOverlayChange) return
            if (refs.length > 0) {
              onOverlayChange({ tokens: {}, activeParagraphs: refs, tokenStates: {} })
            } else {
              onOverlayChange(null)
            }
          }}
        />
      )}
      {ex.type === 'select-evidence' && ex.sections && ex.functionOptions && ex.paragraphTokens && (
        reviewMode ? (
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>✓</span>Evidence analysis submitted
          </div>
        ) : (
          <SelectEvidenceExercise
            exercise={ex}
            onOverlayChange={onOverlayChange || (() => {})}
            onSubmit={(data) => {
              if (stepIdx !== undefined && ctx.submit) {
                ctx.submit(stepIdx, formatSubmitData('select-evidence', data))
              }
            }}
            onDone={() => { setAllDone(true); onDone() }}
          />
        )
      )}

      {/* Submit/Done */}
      <div style={{ marginTop: 16 }}>
        {effectiveAllDone ? (
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>✓</span>Practice complete!
          </div>
        ) : (
          <button
            className="stu-btn pri"
            style={(!canSub() || submitting) ? { opacity: 0.35, cursor: 'default' } : undefined}
            onClick={(canSub() && !submitting) ? handleSubmit : undefined}
          >
            {submitting ? 'Checking...' : Object.keys(attempts).length > 0 ? 'Try Again' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  )
}
