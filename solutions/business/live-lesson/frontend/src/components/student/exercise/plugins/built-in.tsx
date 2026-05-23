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
    // matrix reads rows from its dedicated pluginState slot, NOT from `ans`
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
