/**
 * Built-in plugin registrations for all 11 exercise types.
 *
 * Each plugin wraps the existing exercise component. The plugin's Component
 * reads `ExercisePluginProps` and forwards typed props to the underlying
 * implementation. canSubmit / formatSubmitData / handleCheckResult mirror the
 * legacy per-type logic from PracticePhase.tsx so behavior is byte-equivalent.
 *
 * Importing this file (side effects) is sufficient to populate the registry.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { registerExerciseType } from './registry'
import type {
  ExerciseUIPlugin,
  ExercisePluginProps,
  CheckResultHandlerOutput,
} from './types'

import { gradeItemSet, reportAttempt } from '../gradeItemSet'
import { toIdx } from '../../../../utils/parse-helpers'
import { QuizExercise } from '../QuizExercise'
import { MatchExercise } from '../MatchExercise'
import { OrderExercise } from '../OrderExercise'
import { StanceExercise } from '../StanceExercise'
import { FillBlankExercise } from '../FillBlankExercise'
import { MatrixExercise } from '../MatrixExercise'
import { MapExercise } from '../MapExercise'
import { ImageUploadExercise } from '../ImageUploadExercise'
import { SelectEvidenceExercise } from '../SelectEvidenceExercise'
import { RichContentQuizExercise } from '../RichContentQuizExercise'
import { GuidedDiscoveryExercise } from '../GuidedDiscoveryExercise'

// ─────────────────────────── helpers ───────────────────────────

/**
 * Shared per-item check handler used by quiz + match (they have the same
 * shape: indexed items + correctQs/wrongQs/serverHints). `itemsField` picks
 * the source array on `exercise` (`questions` for quiz, `pairs` for match).
 */
function buildIndexedCheckResult(
  result: any,
  exercise: Record<string, any>,
  current: { ans: Record<string, any>; attempts: Record<number, any[]>; correctQs: Set<number>; serverHints?: Record<string, any>; pluginState?: Record<string, any> },
  itemsField: 'questions' | 'pairs',
): CheckResultHandlerOutput {
  const allItems = (exercise[itemsField] ?? []) as Array<unknown>
  if (result.allCorrect) {
    return {
      checkResultState: { ...(current.pluginState ?? {}) },
      allDone: true,
      softDone: true,
      correctQs: new Set(allItems.map((_, i) => i)),
    }
  }
  const items = (result?.items as Array<{ idx: any; correct: boolean; hint?: string; hintZh?: string; walkthrough?: string; walkthroughZh?: string }>) ?? []
  const newCorrectQs = new Set<number>(current.correctQs)
  const newWrongQs = new Set<number>()
  const newAttempts = { ...current.attempts }
  const newHints = { ...((current.serverHints as Record<number, any>) ?? {}) }
  const reportItems: NonNullable<CheckResultHandlerOutput['reportItems']> = []
  const clearAnsKeys: Array<string | number> = []
  items.forEach((it) => {
    const idx = toIdx(it.idx)
    if (!newAttempts[idx]) newAttempts[idx] = []
    newAttempts[idx].push({ selected: current.ans[idx], isCorrect: it.correct, ts: Date.now() })
    reportItems.push({ qi: idx, attemptNum: newAttempts[idx].length, selected: current.ans[idx], expected: null, isCorrect: it.correct })
    if (it.correct) {
      newCorrectQs.add(idx)
    } else {
      newWrongQs.add(idx)
      clearAnsKeys.push(idx)
      if (it.hint || it.hintZh || it.walkthrough || it.walkthroughZh) {
        newHints[idx] = { hint: it.hint, hintZh: it.hintZh, walkthrough: it.walkthrough, walkthroughZh: it.walkthroughZh }
      }
    }
  })
  const allDone = newWrongQs.size === 0 && newCorrectQs.size === allItems.length
  return {
    checkResultState: { ...(current.pluginState ?? {}), serverHints: newHints },
    allDone,
    softDone: allDone,
    clearAnsKeys,
    attempts: newAttempts,
    correctQs: newCorrectQs,
    wrongQs: newWrongQs,
    reportItems,
  }
}

// ─────────────────────────── quiz ───────────────────────────

const quizPlugin: ExerciseUIPlugin = {
  type: 'quiz',
  observeType: 'mc',
  Component: function QuizPluginComp({ exercise, ans, setAns, checkResultState, reviewData }: ExercisePluginProps) {
    return (
      <QuizExercise
        questions={exercise.questions}
        ans={ans}
        setAns={setAns as any}
        correctQs={(checkResultState.correctQs as Set<number>) ?? new Set<number>()}
        wrongQs={(checkResultState.wrongQs as Set<number>) ?? new Set<number>()}
        attemptCount={(qi: number) => (checkResultState.attempts?.[qi] ?? []).length}
        serverHints={checkResultState.serverHints}
        reviewData={reviewData}
      />
    )
  },
  canSubmit(exercise, ans, state) {
    const correctQs: Set<number> = state.correctQs ?? new Set()
    return !exercise.questions?.some(
      (_: any, qi: number) => !correctQs.has(qi) && ans[qi] === undefined,
    )
  },
  formatSubmitData(ans, state) {
    const attemptCounts = state.attemptCounts as Record<number, number> | undefined
    const answers = Object.keys(ans)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => ans[k])
    return { answers, ...(attemptCounts && { attemptCounts }) }
  },
  handleCheckResult(result, exercise, current): CheckResultHandlerOutput {
    return buildIndexedCheckResult(result, exercise, current, 'questions')
  },
  localGrade(exercise, ans, prev, taskId) {
    const items = exercise.questions as Array<{ correct: number }> | undefined
    if (!items) return null
    const result = gradeItemSet(items, ans, prev, taskId)
    return {
      allDone: result.allDone,
      softDone: result.allDone,
      correctQs: result.correctQs,
      wrongQs: result.wrongQs,
      attempts: result.attempts,
      clearAnsKeys: Array.from(result.wrongQs),
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.questions) {
      ex.questions = (spec.questions as Array<any>).map((q, i) => {
        const base = (ex.questions as Array<any>)?.[i] || {}
        return {
          ...base,
          q: q.text,
          translate: q.translate,
          opts: q.options,
          ...(q.paraRef && { paraRef: q.paraRef }),
        }
      })
    }
  },
  enrichFromManifest(ex, ak) {
    if ((ak.answers as any[])?.length) {
      ex.questions = (ak.answers as Array<any>).map((a, i) => {
        const base = (ex.questions as Array<any>)?.[i] || {}
        return {
          ...base,
          ...(a.questionText ? { q: a.questionText } : {}),
          ...(a.questionTranslate ? { translate: a.questionTranslate } : {}),
          ...(a.options ? { opts: a.options } : {}),
          ...(typeof a.correct === 'number' ? { correct: a.correct } : {}),
          ...(a.hint ? { hint: a.hint } : {}),
          ...(a.hintZh ? { hintZh: a.hintZh } : {}),
          ...(a.walkthrough ? { walkthrough: a.walkthrough } : {}),
          ...(a.walkthroughZh ? { walkthroughZh: a.walkthroughZh } : {}),
          ...(a.paraRef ? { paraRef: a.paraRef } : {}),
        }
      })
    }
    // Sanitized manifest uses ExerciseSpec format (text/translate/options fields)
    if ((ak.questions as any[])?.length) {
      ex.questions = (ak.questions as Array<any>).map((q, i) => {
        const base = (ex.questions as Array<any>)?.[i] || {}
        return {
          ...base,
          q: q.text || base.q,
          translate: q.translate || base.translate,
          opts: q.options || base.opts,
        }
      })
    }
  },
}

// ─────────────────────────── match ───────────────────────────

const matchPlugin: ExerciseUIPlugin = {
  type: 'match',
  observeType: 'mc',
  Component: function MatchPluginComp({ exercise, ans, setAns, checkResultState, reviewData }: ExercisePluginProps) {
    return (
      <MatchExercise
        pairs={exercise.pairs}
        ans={ans}
        setAns={setAns as any}
        correctQs={(checkResultState.correctQs as Set<number>) ?? new Set<number>()}
        wrongQs={(checkResultState.wrongQs as Set<number>) ?? new Set<number>()}
        attemptCount={(qi: number) => (checkResultState.attempts?.[qi] ?? []).length}
        serverHints={checkResultState.serverHints}
        reviewData={reviewData}
      />
    )
  },
  canSubmit(exercise, ans, state) {
    const correctQs: Set<number> = state.correctQs ?? new Set()
    return !exercise.pairs?.some(
      (_: any, pi: number) => !correctQs.has(pi) && ans[pi] === undefined,
    )
  },
  formatSubmitData(ans, state) {
    const attemptCounts = state.attemptCounts as Record<number, number> | undefined
    const pairs = Object.keys(ans)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => ans[k])
    return { pairs, ...(attemptCounts && { attemptCounts }) }
  },
  handleCheckResult(result, exercise, current): CheckResultHandlerOutput {
    return buildIndexedCheckResult(result, exercise, current, 'pairs')
  },
  localGrade(exercise, ans, prev, taskId) {
    const items = exercise.pairs as Array<{ correct: number }> | undefined
    if (!items) return null
    const result = gradeItemSet(items, ans, prev, taskId)
    return {
      allDone: result.allDone,
      softDone: result.allDone,
      correctQs: result.correctQs,
      wrongQs: result.wrongQs,
      attempts: result.attempts,
      clearAnsKeys: Array.from(result.wrongQs),
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.pairs) {
      ex.pairs = (spec.pairs as Array<any>).map((p, i) => {
        const base = (ex.pairs as Array<any>)?.[i] || {}
        return {
          ...base,
          left: p.left,
          opts: p.options,
          ...(p.paraRef && { paraRef: p.paraRef }),
        }
      })
    }
  },
  enrichFromManifest(ex, ak) {
    if ((ak.answers as any[])?.length) {
      const sharedOpts = ak.options as string[] | undefined
      ex.pairs = (ak.answers as Array<any>).map((a, i) => {
        const base = (ex.pairs as Array<any>)?.[i] || {}
        return {
          ...base,
          ...(a.left ? { left: a.left } : {}),
          ...(sharedOpts ? { opts: sharedOpts } : {}),
          ...(a.correct != null
            ? { correct: typeof a.correct === 'number' ? a.correct : (sharedOpts?.indexOf(a.correct) ?? 0) }
            : {}),
          ...(a.hint ? { hint: a.hint } : {}),
          ...(a.hintZh ? { hintZh: a.hintZh } : {}),
          ...(a.paraRef ? { paraRef: a.paraRef } : {}),
        }
      })
    }
    // Sanitized manifest uses ExerciseSpec format (pairs, not answers)
    if ((ak.pairs as any[])?.length) {
      ex.pairs = (ak.pairs as Array<any>).map((p, i) => {
        const base = (ex.pairs as Array<any>)?.[i] || {}
        return {
          ...base,
          left: p.left || base.left,
          opts: p.options || base.opts,
        }
      })
    }
  },
}

// ─────────────────────────── order ───────────────────────────

const orderPlugin: ExerciseUIPlugin = {
  type: 'order',
  observeType: 'mc',
  Component: function OrderPluginComp({ exercise, ans, setAns, allDone, checkResultState, reviewData }: ExercisePluginProps) {
    return (
      <OrderExercise
        items={exercise.items}
        ans={ans}
        setAns={setAns as any}
        done={allDone}
        wrongPositions={(checkResultState.wrongQs as Set<number>) ?? new Set<number>()}
        attemptCount={(checkResultState.attempts?.[0] ?? []).length}
        reviewData={reviewData}
      />
    )
  },
  canSubmit(exercise, ans) {
    return (ans.order || []).length === (exercise.items || []).length
  },
  formatSubmitData(ans) {
    return { order: ans.order ?? [] }
  },
  handleCheckResult(result, _exercise, current) {
    if (result.allCorrect) {
      return {
        checkResultState: { ...(current.pluginState ?? {}) },
        allDone: true,
        softDone: true,
      }
    }
    const items = (result?.items as Array<{ idx: any; correct: boolean }>) ?? []
    const wrongQs = new Set<number>()
    items.forEach((it) => {
      if (!it.correct) wrongQs.add(toIdx(it.idx))
    })
    const newAttempts = { ...current.attempts }
    if (!newAttempts[0]) newAttempts[0] = []
    newAttempts[0].push({ selected: current.ans.order, isCorrect: false, ts: Date.now() })
    return {
      checkResultState: { ...(current.pluginState ?? {}) },
      allDone: false,
      softDone: false,
      attempts: newAttempts,
      wrongQs,
      clearAnsKeys: ['order'],
      reportItems: [{ qi: 0, attemptNum: newAttempts[0].length, selected: current.ans.order, expected: null, isCorrect: false }],
    }
  },
  localGrade(exercise, ans, prev, taskId) {
    const order: number[] = ans.order || []
    const correctOrder: number[] | undefined = exercise.correctOrder
    if (!correctOrder) return null
    const isOk = order.every((idx, pos) => correctOrder[pos] === idx)
    const newAttempts = { ...prev.attempts }
    if (!newAttempts[0]) newAttempts[0] = []
    newAttempts[0].push({ selected: [...order], correct: correctOrder, isCorrect: isOk, ts: Date.now() })
    reportAttempt(taskId, 0, newAttempts[0].length, order, correctOrder, isOk)
    if (isOk) {
      return {
        allDone: true,
        softDone: true,
        attempts: newAttempts,
      }
    }
    const wrong = new Set<number>()
    order.forEach((idx, pos) => { if (correctOrder[pos] !== idx) wrong.add(pos) })
    return {
      allDone: false,
      softDone: false,
      wrongQs: wrong,
      attempts: newAttempts,
      clearAnsKeys: ['order'],
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.items) ex.items = spec.items
  },
  enrichFromManifest(ex, ak) {
    if (ak.items) ex.items = ak.items
    if (ak.correctOrder) ex.correctOrder = ak.correctOrder
  },
}

// ─────────────────────────── stance ───────────────────────────

const stancePlugin: ExerciseUIPlugin = {
  type: 'stance',
  observeType: null, // no teacher-observe surface for stance
  Component: function StancePluginComp({ exercise, ans, setAns, softDone, reviewData }: ExercisePluginProps) {
    return (
      <StanceExercise
        stanceQ={exercise.stanceQ}
        stanceQZh={exercise.stanceQZh}
        stanceOpts={exercise.stanceOpts}
        evidence={exercise.evidence}
        ans={ans}
        setAns={setAns as any}
        softDone={softDone}
        reviewData={reviewData}
      />
    )
  },
  canSubmit(_exercise, ans) {
    return ans.stance !== undefined && (ans.evidence || []).length >= 1
  },
  formatSubmitData(ans) {
    return { position: ans.stance, evidence: ans.evidence ?? [] }
  },
  handleCheckResult(result, _exercise, current) {
    // Stance "submits and is done" regardless of correctness.
    return {
      checkResultState: { ...(current.pluginState ?? {}) },
      allDone: true,
      softDone: true,
      reportItems: [{ qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: !!result.allCorrect }],
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.stanceQ) ex.stanceQ = spec.stanceQ
    if (spec.stanceQZh) ex.stanceQZh = spec.stanceQZh
    if (spec.stanceOpts) ex.stanceOpts = spec.stanceOpts
    if (spec.evidence) ex.evidence = spec.evidence
  },
  enrichFromManifest(ex, ak) {
    if (ak.stanceQ) ex.stanceQ = ak.stanceQ
    if (ak.stanceQZh) ex.stanceQZh = ak.stanceQZh
    if (ak.stanceOpts) ex.stanceOpts = ak.stanceOpts
    if (ak.evidence) ex.evidence = ak.evidence
  },
}

// ─────────────────────────── fill-blank ───────────────────────────

const fillBlankPlugin: ExerciseUIPlugin = {
  type: 'fill-blank',
  observeType: null, // no teacher-observe surface for fill-blank
  Component: function FillBlankPluginComp({ exercise, ans, setAns, allDone, checkResultState, reviewData }: ExercisePluginProps) {
    const blankResults = (checkResultState.blankResults as Record<string, boolean>) ?? {}
    return (
      <FillBlankExercise
        sentences={exercise.sentences}
        ans={ans as Record<string, string>}
        setAns={setAns as any}
        blankResults={Object.keys(blankResults).length > 0 ? blankResults : undefined}
        allDone={allDone}
        reviewData={reviewData}
      />
    )
  },
  canSubmit(exercise, ans) {
    if (!exercise.sentences) return false
    return exercise.sentences.every((s: any) => {
      const blankIds = [...s.template.matchAll(/\{\{(\d+)\}\}/g)].map((m: any) => m[1])
      return blankIds.every((id: string) => (ans[`${s.id}_${id}`] || '').trim().length > 0)
    })
  },
  formatSubmitData(ans) {
    // Only forward string-valued keys; matches legacy gradeItemSet behavior
    // which guards against accidental leakage of non-blank ans fields
    // (e.g. firstAttemptAnswers added by PracticePhase later).
    const blanks: Record<string, string> = {}
    for (const [k, v] of Object.entries(ans)) {
      if (typeof v === 'string') blanks[k] = v
    }
    return { blanks }
  },
  handleCheckResult(result, _exercise, current) {
    if (result.allCorrect) {
      return {
        checkResultState: { ...(current.pluginState ?? {}) },
        allDone: true,
        softDone: true,
      }
    }
    const items = (result?.items as Array<{ idx: string; correct: boolean }>) ?? []
    const blankResults: Record<string, boolean> = {}
    items.forEach((it) => {
      blankResults[String(it.idx)] = !!it.correct
    })
    return {
      checkResultState: { ...(current.pluginState ?? {}), blankResults },
      // Fill-blank uses a soft-pass: once submitted, advance even if some
      // blanks were wrong (legacy PracticePhase L342-344 behavior).
      allDone: true,
      softDone: true,
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.sentences) ex.sentences = spec.sentences
  },
  enrichFromManifest(ex, ak) {
    if (ak.sentences) ex.sentences = ak.sentences
  },
}

// ─────────────────────────── matrix ───────────────────────────

const matrixPlugin: ExerciseUIPlugin = {
  type: 'matrix',
  Component: function MatrixPluginComp({ exercise, allDone, checkResultState, setCheckResultState, stepIdx, studentId, reviewData }: ExercisePluginProps) {
    const matrixAns = (checkResultState.matrixAns as Record<number, Record<string, string>>) ?? {}
    return (
      <MatrixExercise
        rows={exercise.rows ?? []}
        practiceCount={exercise.practiceCount}
        studentId={studentId}
        stepIdx={stepIdx}
        serverHints={checkResultState.serverHints}
        ans={matrixAns}
        onAnsChange={(ri, field, val) => {
          if (!setCheckResultState) return
          setCheckResultState((prev) => ({
            ...prev,
            matrixAns: {
              ...((prev.matrixAns as Record<number, Record<string, string>>) ?? {}),
              [ri]: {
                ...(((prev.matrixAns as Record<number, Record<string, string>>) ?? {})[ri] ?? {}),
                [field]: val,
              },
            },
          }))
        }}
        disabled={allDone}
        rowResults={
          Object.keys((checkResultState.rowResults as Record<number, any>) ?? {}).length > 0
            ? checkResultState.rowResults
            : undefined
        }
        reviewData={reviewData}
      />
    )
  },
  canSubmit() {
    return true
  },
  formatSubmitData(_ans, state) {
    // Matrix reads rows from the per-plugin slot (`state.matrixAns`), keyed by
    // rowIdx → field map. Backend MatrixGrader (matrix.grader.ts:21) accepts
    // this shape (it indexes `studentRows[a.rowIdx]`, which works for both
    // Record and Array thanks to JS coercion). Don't change to an Array
    // without aligning the backend contract.
    return { rows: (state.matrixAns as Record<number, Record<string, string>>) ?? {} }
  },
  handleCheckResult(result, _exercise, current) {
    if (result.allCorrect) {
      return {
        checkResultState: { ...(current.pluginState ?? {}) },
        allDone: true,
        softDone: true,
        // Telemetry: matrix originally reported a single attempt regardless
        // of allCorrect (PracticePhase HEAD~1:307 — `reportAttempt(...)` was
        // unconditional). Keep it so teacher-observe sees first-try wins.
        reportItems: [{ qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: true }],
      }
    }
    const items = (result?.items as Array<{ idx: number; correct: boolean; hint?: string; hintZh?: string }>) ?? []
    const rowResults: Record<number, boolean> = {}
    const newHints = { ...((current.serverHints as Record<number, any>) ?? {}) }
    items.forEach((it) => {
      const idx = toIdx(it.idx)
      rowResults[idx] = !!it.correct
      if (!it.correct && (it.hint || it.hintZh)) {
        newHints[idx] = { hint: it.hint, hintZh: it.hintZh }
      }
    })
    return {
      checkResultState: { ...(current.pluginState ?? {}), serverHints: newHints, rowResults },
      // Matrix is always "done after submit" — partial credit is fine.
      allDone: true,
      softDone: true,
      reportItems: [{ qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: false }],
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.rows) {
      ex.rows = (spec.rows as Array<any>).map((r, i) => {
        const base = (ex.rows as Array<any>)?.[i] || {}
        return {
          ...base,
          place: r.place,
          demo: r.isDemo,
          ...(r.practice && { practice: r.practice }),
          ...(r.reason && { reason: r.reason }),
          ...(r.paraRef && { paraRef: r.paraRef }),
          ...(r.whatPrompt && { whatPrompt: r.whatPrompt }),
          ...(r.whyPrompt && { whyPrompt: r.whyPrompt }),
        }
      })
      if (spec.practiceCount) ex.practiceCount = spec.practiceCount
    }
  },
  enrichFromManifest(ex, ak) {
    if ((ak.answers as any[])?.length) {
      ex.rows = (ak.answers as Array<any>).map((a, i) => {
        const base = (ex.rows as Array<any>)?.[i] || {}
        return {
          ...base,
          ...(a.place ? { place: a.place } : {}),
          ...(a.isDemo != null ? { demo: a.isDemo } : {}),
          ...(a.practice ? { practice: a.practice } : {}),
          ...(a.reason ? { reason: a.reason } : {}),
          ...(a.hint ? { hint: a.hint } : {}),
          ...(a.hintZh ? { hintZh: a.hintZh } : {}),
          ...(a.paraRef ? { paraRef: a.paraRef } : {}),
          ...(a.whatPrompt ? { whatPrompt: a.whatPrompt } : {}),
          ...(a.whyPrompt ? { whyPrompt: a.whyPrompt } : {}),
        }
      })
      if (ak.practiceCount) ex.practiceCount = ak.practiceCount
    }
    // Sanitized manifest uses ExerciseSpec format (rows, not answers)
    if ((ak.rows as any[])?.length) {
      ex.rows = (ak.rows as Array<any>).map((r, i) => {
        const base = (ex.rows as Array<any>)?.[i] || {}
        return {
          ...base,
          place: r.place || base.place,
          demo: r.isDemo ?? base.demo,
          ...(r.practice ? { practice: r.practice } : {}),
          ...(r.reason ? { reason: r.reason } : {}),
          ...(r.paraRef ? { paraRef: r.paraRef } : {}),
          ...(r.whatPrompt ? { whatPrompt: r.whatPrompt } : {}),
          ...(r.whyPrompt ? { whyPrompt: r.whyPrompt } : {}),
        }
      })
      if (ak.practiceCount) ex.practiceCount = ak.practiceCount
    }
  },
}

// ─────────────────────────── map ───────────────────────────

const mapPlugin: ExerciseUIPlugin = {
  type: 'map',
  Component: function MapPluginComp({ exercise, ans, setAns, allDone, checkResultState, onOverlayChange, reviewData }: ExercisePluginProps) {
    return (
      <MapExercise
        prompt={exercise.prompt ?? ''}
        axes={exercise.axes}
        mapItems={exercise.mapItems}
        minReasonLength={exercise.minReasonLength ?? 8}
        ans={ans}
        setAns={setAns as any}
        allDone={allDone}
        feedback={checkResultState.feedback}
        givenPlacements={exercise.givenPlacements}
        practiceCount={exercise.practiceCount}
        practiceItemIds={exercise.practiceItemIds}
        itemResults={
          Object.keys((checkResultState.itemResults as Record<string, any>) ?? {}).length > 0
            ? checkResultState.itemResults
            : undefined
        }
        reviewData={reviewData}
        onActiveChange={(refs: number[]) => {
          if (!onOverlayChange) return
          if (refs.length > 0) {
            // Match the shape PracticePhase used inline (TextOverlay with
            // activeParagraphs + empty tokens/tokenStates).
            onOverlayChange({ tokens: {}, activeParagraphs: refs, tokenStates: {} } as any)
          } else {
            onOverlayChange(null)
          }
        }}
      />
    )
  },
  canSubmit(exercise, ans) {
    const items = exercise.mapItems ?? []
    const practiceSet = exercise.practiceItemIds ? new Set<string>(exercise.practiceItemIds) : null
    const practice = practiceSet
      ? items.filter((it: any) => practiceSet.has(it.id))
      : exercise.practiceCount
        ? items.slice(0, exercise.practiceCount)
        : items
    const pl = ans.placements || {}
    const rs = ans.reasons || {}
    const min = exercise.minReasonLength || 8
    return practice.every(
      (it: any) => pl[it.id] && (rs[it.id] || '').trim().length >= min,
    )
  },
  formatSubmitData(ans) {
    return {
      placements: ans.placements ?? {},
      reasons: ans.reasons ?? {},
      practiceItemIds: ans.practiceItemIds,
    }
  },
  handleCheckResult(result, _exercise, current) {
    if (result.allCorrect) {
      return {
        checkResultState: { ...(current.pluginState ?? {}) },
        allDone: true,
        softDone: true,
        // Preserve the original unconditional reportAttempt
        // (HEAD~1 PracticePhase L319-321) for first-try-correct telemetry.
        reportItems: [{ qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: true }],
      }
    }
    const items = (result?.items as Array<{ idx: string; correct: boolean; hint?: string }>) ?? []
    const llmItem = items.find((it) => it.idx === '_llm')
    const itemResults: Record<string, { correct: boolean; hint?: string }> = {}
    items.forEach((it) => {
      if (it.idx === '_llm') return
      itemResults[String(it.idx)] = { correct: it.correct, hint: it.hint }
    })
    return {
      checkResultState: {
        ...(current.pluginState ?? {}),
        ...(llmItem?.hint ? { feedback: llmItem.hint } : {}),
        itemResults,
      },
      allDone: true,
      softDone: true,
      reportItems: [{ qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: false }],
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.prompt) ex.prompt = spec.prompt
    if (spec.axes) ex.axes = spec.axes
    if (spec.mapItems) ex.mapItems = spec.mapItems
    if (spec.minReasonLength) ex.minReasonLength = spec.minReasonLength
    if (spec.givenPlacements) ex.givenPlacements = spec.givenPlacements
    if (spec.practiceCount) ex.practiceCount = spec.practiceCount
    if (spec.practiceItemIds) ex.practiceItemIds = spec.practiceItemIds
  },
  enrichFromManifest(ex, ak) {
    if (ak.prompt) ex.prompt = ak.prompt
    if (ak.axes) ex.axes = ak.axes
    if (ak.mapItems) ex.mapItems = ak.mapItems
    else if (ak.items) ex.mapItems = ak.items
    if (ak.minReasonLength) ex.minReasonLength = ak.minReasonLength
    if (ak.givenPlacements) ex.givenPlacements = ak.givenPlacements
    if (ak.practiceCount) ex.practiceCount = ak.practiceCount
    if (ak.practiceItemIds) ex.practiceItemIds = ak.practiceItemIds
  },
}

// ─────────────────────────── image-upload ───────────────────────────

const imageUploadPlugin: ExerciseUIPlugin = {
  type: 'image-upload',
  Component: function ImageUploadPluginComp({ exercise, ans, setAns, allDone, checkResultState, reviewData }: ExercisePluginProps) {
    return (
      <ImageUploadExercise
        prompt={exercise.prompt ?? ''}
        promptImages={exercise.promptImages}
        rubric={exercise.rubric}
        maxImages={exercise.maxImages ?? 1}
        ans={ans}
        setAns={setAns as any}
        allDone={allDone}
        feedback={checkResultState.feedback}
        rubricResults={
          Object.keys((checkResultState.rubricResults as Record<string, any>) ?? {}).length > 0
            ? checkResultState.rubricResults
            : undefined
        }
        reviewData={reviewData}
      />
    )
  },
  canSubmit(_exercise, ans) {
    return (ans.images || []).length > 0
  },
  formatSubmitData(ans) {
    return { images: ans.images ?? [] }
  },
  handleCheckResult(result, _exercise, current) {
    if (result.allCorrect) {
      return {
        checkResultState: { ...(current.pluginState ?? {}) },
        allDone: true,
        softDone: true,
        // Telemetry must fire on first-try-correct too (HEAD~1 L327
        // called reportAttempt unconditionally before the allCorrect check).
        reportItems: [{ qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: true }],
      }
    }
    const items = (result?.items as Array<{ idx: string; correct: boolean; score?: number; hint?: string }>) ?? []
    const llmItem = items.find((it) => it.idx === '_llm')
    const rubricResults: Record<string, { score: number; hint?: string }> = {}
    items.forEach((it) => {
      if (it.idx === '_llm') return
      rubricResults[String(it.idx)] = { score: it.score ?? 0, hint: it.hint }
    })
    return {
      checkResultState: {
        ...(current.pluginState ?? {}),
        ...(llmItem?.hint ? { feedback: llmItem.hint } : {}),
        rubricResults,
      },
      // Image-upload keeps UI active when not allCorrect so student can retry.
      allDone: false,
      softDone: false,
      reportItems: [{ qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: false }],
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.prompt) ex.prompt = spec.prompt
    if (spec.promptImages) ex.promptImages = spec.promptImages
    if (spec.rubric) ex.rubric = spec.rubric
    if (spec.maxImages) ex.maxImages = spec.maxImages
  },
  enrichFromManifest(ex, ak) {
    if (ak.prompt) ex.prompt = ak.prompt
    if (ak.promptImages) ex.promptImages = ak.promptImages
    if (ak.rubric) ex.rubric = ak.rubric
    if (ak.maxImages) ex.maxImages = ak.maxImages
  },
}

// ─────────────────────────── select-evidence ───────────────────────────

const selectEvidencePlugin: ExerciseUIPlugin = {
  type: 'select-evidence',
  observeType: 'evidence',
  selfManagedSubmit: true,
  serverCheck: false,
  Component: function SelectEvidencePluginComp(props: ExercisePluginProps) {
    const { exercise, onOverlayChange, onDone, submit, stepIdx, reviewData } = props
    return (
      <SelectEvidenceExercise
        exercise={exercise as any}
        onOverlayChange={onOverlayChange || (() => {})}
        onSubmit={(data: any) => {
          if (stepIdx !== undefined && submit) {
            const payload: Record<string, any> = { sections: data.sections ?? {} }
            if (data.firstAttemptSections) payload.firstAttemptSections = data.firstAttemptSections
            submit(stepIdx, payload)
          }
        }}
        onDone={onDone}
        reviewData={reviewData}
      />
    )
  },
  canSubmit() {
    return false // self-managed
  },
  formatSubmitData(ans) {
    const payload: Record<string, any> = { sections: ans.sections ?? {} }
    if (ans.firstAttemptSections) payload.firstAttemptSections = ans.firstAttemptSections
    return payload
  },
  handleCheckResult(result, _exercise, current) {
    // Dead path under normal use (selfManagedSubmit + serverCheck:false), but
    // honoring the contract: emit reportItems so any future caller routing a
    // check result through this plugin still sees telemetry.
    return {
      checkResultState: { ...(current.pluginState ?? {}) },
      allDone: true,
      softDone: true,
      reportItems: [{ qi: 0, attemptNum: 1, selected: current.ans, expected: null, isCorrect: !!result.allCorrect }],
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.functionOptions) ex.functionOptions = spec.functionOptions
    if (spec.sections) ex.sections = spec.sections
    if (spec.paragraphTokens) ex.paragraphTokens = spec.paragraphTokens
  },
  enrichFromManifest(ex, ak) {
    ex.type = 'select-evidence'
    if (ak.functionOptions) ex.functionOptions = ak.functionOptions
    if (ak.sections) ex.sections = ak.sections
    if (ak.paragraphTokens) ex.paragraphTokens = ak.paragraphTokens
  },
}

// ─────────────────────────── rich-content-quiz ───────────────────────────

const richContentQuizPlugin: ExerciseUIPlugin = {
  type: 'rich-content-quiz',
  observeType: 'image-upload',
  selfManagedSubmit: true,
  Component: function RcqPluginComp(props: ExercisePluginProps) {
    const { exercise, onScaffoldPush, onDone, stepIdx, taskId, partIds, reviewData } = props
    const allParts = (exercise.parts as Array<{ id: string }>) ?? []
    const parts = partIds ? allParts.filter((p) => partIds.includes(p.id)) : allParts
    return (
      <RichContentQuizExercise
        parts={parts as any}
        subType={exercise.subType}
        prompt={exercise.prompt}
        promptImages={exercise.promptImages}
        maxImages={exercise.maxImages ?? 1}
        stepIdx={stepIdx}
        taskId={taskId}
        onScaffoldPush={onScaffoldPush}
        onDone={onDone}
        reviewData={reviewData}
      />
    )
  },
  canSubmit() {
    return false
  },
  formatSubmitData(ans) {
    return ans
  },
  handleCheckResult(_result, _exercise, current) {
    // Rich-content-quiz is selfManagedSubmit + has its own multi-part scoring
    // flow — this handler is a no-op contract stub that returns a clean state
    // bag (not the merged current{ans,attempts,...}).
    return {
      checkResultState: { ...(current.pluginState ?? {}) },
      allDone: true,
      softDone: true,
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.prompt) ex.prompt = spec.prompt
    if (spec.promptImages) ex.promptImages = spec.promptImages
    if (spec.maxImages) ex.maxImages = spec.maxImages
    if (spec.subType) ex.subType = spec.subType
    if (spec.inputMethods) ex.inputMethods = spec.inputMethods
    if (spec.parts) {
      ex.parts = (spec.parts as Array<any>).map((p) => ({
        id: p.id,
        prompt: p.prompt,
        ...(p.expression && { expression: p.expression }),
        ...(p.inputMethods && { inputMethods: p.inputMethods }),
      }))
    }
  },
  enrichFromManifest(ex, ak) {
    ex.type = 'rich-content-quiz'
    if (ak.prompt) ex.prompt = ak.prompt
    if (ak.promptImages) ex.promptImages = ak.promptImages
    if (ak.maxImages) ex.maxImages = ak.maxImages
    if (ak.subType) ex.subType = ak.subType
    if (ak.inputMethods) ex.inputMethods = ak.inputMethods
    if (ak.parts) {
      ex.parts = (ak.parts as Array<any>).map((p) => ({
        id: p.id,
        prompt: p.prompt,
        ...(p.expression && { expression: p.expression }),
        ...(p.inputMethods && { inputMethods: p.inputMethods }),
      }))
    }
  },
}

// ─────────────────────────── guided-discovery ───────────────────────────

const guidedDiscoveryPlugin: ExerciseUIPlugin = {
  type: 'guided-discovery',
  selfManagedSubmit: true,
  Component: function GdPluginComp({ exercise, ans, setAns, allDone, checkResultState, reviewData }: ExercisePluginProps) {
    const stepResults = (checkResultState.stepResults as Record<string, boolean>) ?? {}
    return (
      <GuidedDiscoveryExercise
        steps={exercise.gdSteps}
        title={exercise.gdTitle}
        summary={exercise.gdSummary}
        ans={ans}
        setAns={setAns as any}
        stepResults={Object.keys(stepResults).length > 0 ? stepResults : undefined}
        allDone={allDone}
        reviewData={reviewData}
      />
    )
  },
  canSubmit(exercise, ans) {
    if (!exercise.gdSteps) return false
    const steps = ans.steps || {}
    return exercise.gdSteps.every((step: any) => {
      const sd = steps[step.id]?.answers || {}
      switch (step.type) {
        case 'observation_choice':
          return step.choices.every((c: any) => sd[c.id] !== undefined)
        case 'formula_blanks':
          return step.blanks.every((b: any) => (sd[b.id] || '').trim().length > 0)
        case 'derivation_blank':
          return step.lines.every((l: any) => !l.blank || (sd[l.blank.id] || '').trim().length > 0)
        case 'text_blanks':
          return step.textBlanks.every((b: any) => (sd[b.id] || '').trim().length > 0)
        default:
          return false
      }
    })
  },
  formatSubmitData(ans) {
    return { steps: ans.steps ?? {} }
  },
  handleCheckResult(result, _exercise, current) {
    const items = (result?.items as Array<{ idx: string; correct: boolean }>) ?? []
    const stepResults: Record<string, boolean> = {}
    items.forEach((it) => {
      stepResults[String(it.idx)] = !!it.correct
    })
    return {
      checkResultState: { ...(current.pluginState ?? {}), stepResults },
      // Guided-discovery is always done after submit, partial OK.
      allDone: true,
      softDone: true,
    }
  },
  enrichFromApi(ex, spec) {
    if (spec.gdTitle) ex.gdTitle = spec.gdTitle
    if (spec.gdSteps) ex.gdSteps = spec.gdSteps
    if (spec.gdSummary) ex.gdSummary = spec.gdSummary
  },
  enrichFromManifest(ex, ak) {
    ex.type = 'guided-discovery'
    if (ak.gdTitle) ex.gdTitle = ak.gdTitle
    else if (ak.title) ex.gdTitle = ak.title
    if (ak.gdSteps) ex.gdSteps = ak.gdSteps
    if (ak.gdSummary) ex.gdSummary = ak.gdSummary
  },
}

// ─────────────────────────── register all ───────────────────────────

registerExerciseType(quizPlugin)
registerExerciseType(matchPlugin)
registerExerciseType(orderPlugin)
registerExerciseType(stancePlugin)
registerExerciseType(fillBlankPlugin)
registerExerciseType(matrixPlugin)
registerExerciseType(mapPlugin)
registerExerciseType(imageUploadPlugin)
registerExerciseType(selectEvidencePlugin)
registerExerciseType(richContentQuizPlugin)
registerExerciseType(guidedDiscoveryPlugin)

export {
  quizPlugin,
  matchPlugin,
  orderPlugin,
  stancePlugin,
  fillBlankPlugin,
  matrixPlugin,
  mapPlugin,
  imageUploadPlugin,
  selectEvidencePlugin,
  richContentQuizPlugin,
  guidedDiscoveryPlugin,
}
