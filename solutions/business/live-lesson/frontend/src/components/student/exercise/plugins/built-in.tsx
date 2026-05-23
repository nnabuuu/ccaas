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

function partialOrAllDone(items: Array<{ correct: boolean }> | undefined): {
  allDone: boolean
  softDone: boolean
} {
  if (!items || items.length === 0) return { allDone: false, softDone: false }
  const allCorrect = items.every((i) => i.correct)
  return { allDone: allCorrect, softDone: true }
}

// ─────────────────────────── quiz ───────────────────────────

const quizPlugin: ExerciseUIPlugin = {
  type: 'quiz',
  observeType: 'mc',
  Component: function QuizPluginComp({ exercise, ans, setAns, checkResultState }: ExercisePluginProps) {
    return (
      <QuizExercise
        questions={exercise.questions}
        ans={ans}
        setAns={setAns as any}
        correctQs={(checkResultState.correctQs as Set<number>) ?? new Set<number>()}
        wrongQs={(checkResultState.wrongQs as Set<number>) ?? new Set<number>()}
        attemptCount={(qi: number) => (checkResultState.attempts?.[qi] ?? []).length + 1}
        serverHints={checkResultState.serverHints}
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
  handleCheckResult(result, _exercise, current): CheckResultHandlerOutput {
    const items = (result?.items as Array<{ idx: any; correct: boolean; hint?: string; hintZh?: string; walkthrough?: string; walkthroughZh?: string }>) ?? []
    const correctQs = new Set<number>(current.correctQs)
    const wrongQs = new Set<number>()
    const serverHints: Record<number, any> = { ...(((current as any).serverHints) ?? {}) }
    const clearAnsKeys: Array<string | number> = []
    items.forEach((it) => {
      const idx = Number(it.idx)
      if (it.correct) {
        correctQs.add(idx)
        wrongQs.delete(idx)
      } else {
        wrongQs.add(idx)
        clearAnsKeys.push(idx)
        if (it.hint || it.hintZh || it.walkthrough || it.walkthroughZh) {
          serverHints[idx] = it
        }
      }
    })
    const allCorrect = items.length > 0 && items.every((i) => i.correct)
    return {
      checkResultState: { ...current, correctQs, wrongQs, serverHints },
      allDone: allCorrect,
      softDone: allCorrect,
      clearAnsKeys,
    }
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
  Component: function MatchPluginComp({ exercise, ans, setAns, checkResultState }: ExercisePluginProps) {
    return (
      <MatchExercise
        pairs={exercise.pairs}
        ans={ans}
        setAns={setAns as any}
        correctQs={(checkResultState.correctQs as Set<number>) ?? new Set<number>()}
        wrongQs={(checkResultState.wrongQs as Set<number>) ?? new Set<number>()}
        attemptCount={(qi: number) => (checkResultState.attempts?.[qi] ?? []).length + 1}
        serverHints={checkResultState.serverHints}
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
  handleCheckResult: quizPlugin.handleCheckResult, // identical pattern (idx + correct + hint)
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
  Component: function OrderPluginComp({ exercise, ans, setAns, allDone, checkResultState }: ExercisePluginProps) {
    return (
      <OrderExercise
        items={exercise.items}
        ans={ans}
        setAns={setAns as any}
        done={allDone}
        wrongPositions={(checkResultState.wrongPositions as Set<number>) ?? new Set<number>()}
        attemptCount={(checkResultState.attempts?.[0] ?? []).length + 1}
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
    const items = (result?.items as Array<{ idx: any; correct: boolean }>) ?? []
    const wrongPositions = new Set<number>()
    items.forEach((it) => {
      if (!it.correct) wrongPositions.add(Number(it.idx))
    })
    const allCorrect = items.length > 0 && items.every((i) => i.correct)
    return {
      checkResultState: { ...current, wrongPositions },
      allDone: allCorrect,
      softDone: allCorrect,
      clearAnsKeys: allCorrect ? [] : ['order'],
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
  Component: function StancePluginComp({ exercise, ans, setAns, allDone }: ExercisePluginProps) {
    return (
      <StanceExercise
        stanceQ={exercise.stanceQ}
        stanceQZh={exercise.stanceQZh}
        stanceOpts={exercise.stanceOpts}
        evidence={exercise.evidence}
        ans={ans}
        setAns={setAns as any}
        softDone={allDone}
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
    const items = (result?.items as Array<{ idx: any; correct: boolean }>) ?? []
    const positionItem = items.find((i) => String(i.idx) === 'position')
    const evidenceItem = items.find((i) => String(i.idx) === 'evidence')
    const positionOk = !!positionItem?.correct
    const evidenceOk = !!evidenceItem?.correct
    return {
      checkResultState: { ...current, positionOk, evidenceOk },
      allDone: positionOk && evidenceOk,
      softDone: true, // stance always considered soft-completed after submit
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
  Component: function FillBlankPluginComp({ exercise, ans, setAns, allDone, checkResultState }: ExercisePluginProps) {
    return (
      <FillBlankExercise
        sentences={exercise.sentences}
        ans={ans as Record<string, string>}
        setAns={setAns as any}
        blankResults={checkResultState.blankResults}
        allDone={allDone}
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
    return { blanks: { ...ans } }
  },
  handleCheckResult(result, _exercise, current) {
    const items = (result?.items as Array<{ idx: string; correct: boolean }>) ?? []
    const blankResults: Record<string, boolean> = {}
    items.forEach((it) => {
      blankResults[String(it.idx)] = !!it.correct
    })
    const all = items.length > 0 && items.every((i) => i.correct)
    return {
      checkResultState: { ...current, blankResults },
      allDone: all,
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
  Component: function MatrixPluginComp({ exercise, allDone, checkResultState, setCheckResultState, stepIdx, studentId }: ExercisePluginProps) {
    const matrixAns = (checkResultState.matrixAns as Record<number, Record<string, string>>) ?? {}
    return (
      <MatrixExercise
        rows={exercise.rows ?? []}
        practiceCount={exercise.practiceCount}
        studentId={studentId}
        stepIdx={stepIdx}
        ans={matrixAns}
        onAnsChange={(ri, field, val) => {
          // Push the row delta into the dedicated per-plugin slot. Never into
          // the shared `ans` bag — that's reserved for the canonical answer
          // payload and gets keyed by question idx by other plugins.
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
      />
    )
  },
  canSubmit() {
    return true
  },
  formatSubmitData(_ans, state) {
    // NOTE (followup B8): this plugin method is currently dead code — PracticePhase.tsx still
    // routes through the legacy gradeItemSet.formatSubmitData which produces
    // `{rows: Record<rowIdx, fields>}`. The shape here `{rows: Array<{rowIdx, ...fields}>}` is
    // the target wire format once PracticePhase migrates render+submit through plugin.Component
    // and plugin.formatSubmitData. Until then DO NOT swap the call site without also updating
    // the backend matrix grader's expected shape.
    const matrixAns = (state.matrixAns as Record<number, Record<string, string>>) ?? {}
    const rows = Object.entries(matrixAns).map(([ri, fields]) => ({ rowIdx: Number(ri), ...fields }))
    return { rows }
  },
  handleCheckResult(result, _exercise, current) {
    const items = (result?.items as Array<{ idx: number; correct: boolean }>) ?? []
    const rowResults: Record<number, boolean> = {}
    items.forEach((it) => {
      rowResults[Number(it.idx)] = !!it.correct
    })
    const { allDone, softDone } = partialOrAllDone(items)
    return { checkResultState: { ...current, rowResults }, allDone, softDone }
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
  Component: function MapPluginComp({ exercise, ans, setAns, allDone, checkResultState, onOverlayChange }: ExercisePluginProps) {
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
        onActiveChange={(refs: number[]) => {
          if (!onOverlayChange) return
          if (refs.length > 0) {
            onOverlayChange({ paragraphIdx: refs[0], tokens: [] } as any)
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
    const items = (result?.items as Array<{ idx: string; correct: boolean }>) ?? []
    const itemResults: Record<string, boolean> = {}
    items.forEach((it) => {
      itemResults[String(it.idx)] = !!it.correct
    })
    const { allDone, softDone } = partialOrAllDone(items)
    return {
      checkResultState: { ...current, itemResults, feedback: (result as any).llmFeedback },
      allDone,
      softDone,
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
  Component: function ImageUploadPluginComp({ exercise, ans, setAns, allDone, checkResultState }: ExercisePluginProps) {
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
    const items = (result?.items as Array<{ idx: string; correct: boolean }>) ?? []
    const rubricResults: Record<string, boolean> = {}
    items.forEach((it) => {
      rubricResults[String(it.idx)] = !!it.correct
    })
    const { allDone, softDone } = partialOrAllDone(items)
    return {
      checkResultState: { ...current, rubricResults, feedback: (result as any).llmFeedback },
      allDone,
      softDone,
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
    const { exercise, onOverlayChange, onDone, submit, stepIdx } = props
    return (
      <SelectEvidenceExercise
        exercise={exercise as any}
        onOverlayChange={onOverlayChange || (() => {})}
        onSubmit={(data: any) => {
          if (stepIdx !== undefined && submit) submit(stepIdx, data)
        }}
        onDone={onDone}
      />
    )
  },
  canSubmit() {
    return false // self-managed
  },
  formatSubmitData(ans) {
    return ans
  },
  handleCheckResult(_result, _exercise, current) {
    return { checkResultState: current, allDone: true, softDone: true }
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
    const { exercise, onScaffoldPush, onDone, stepIdx, taskId } = props
    return (
      <RichContentQuizExercise
        parts={exercise.parts ?? []}
        subType={exercise.subType}
        prompt={exercise.prompt}
        promptImages={exercise.promptImages}
        maxImages={exercise.maxImages ?? 1}
        stepIdx={stepIdx}
        taskId={taskId}
        onScaffoldPush={onScaffoldPush}
        onDone={onDone}
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
    return { checkResultState: current, allDone: true, softDone: true }
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
  Component: function GdPluginComp({ exercise, ans, setAns, allDone, checkResultState }: ExercisePluginProps) {
    return (
      <GuidedDiscoveryExercise
        steps={exercise.gdSteps}
        title={exercise.gdTitle}
        summary={exercise.gdSummary}
        ans={ans}
        setAns={setAns as any}
        stepResults={checkResultState.stepResults}
        allDone={allDone}
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
    const { allDone, softDone } = partialOrAllDone(items)
    return { checkResultState: { ...current, stepResults }, allDone, softDone }
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
