/**
 * Pure function extracted from StudentShell.tsx enrichedTask useMemo.
 * Enriches a TaskExercise from either API spec (answer-safe) or manifest answerKey.
 */

import type { TaskExercise, TaskQuestion, TaskMatchPair, TaskMatrixRow } from './task-data'
import type { ExerciseSpec } from '../../hooks/useClassroom'

export interface EnrichResult {
  exercise: TaskExercise
  serverCheck: boolean
}

export function enrichExerciseFromSpec(
  exercise: TaskExercise,
  apiSpec: ExerciseSpec | undefined,
  answerKey: any | undefined,
  exerciseLabel?: string,
): EnrichResult {
  if (apiSpec) {
    return enrichFromApi(exercise, apiSpec)
  }
  if (answerKey) {
    return enrichFromManifest(exercise, answerKey, exerciseLabel)
  }
  return { exercise, serverCheck: false }
}

function enrichFromApi(exercise: TaskExercise, apiSpec: ExerciseSpec): EnrichResult {
  const ex = { ...exercise }
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
  }
  if (apiSpec.type === 'map') {
    if (apiSpec.prompt) ex.prompt = apiSpec.prompt
    if (apiSpec.axes) ex.axes = apiSpec.axes
    if (apiSpec.mapItems) ex.mapItems = apiSpec.mapItems
    if (apiSpec.minReasonLength) ex.minReasonLength = apiSpec.minReasonLength
  }
  if (apiSpec.type === 'select-evidence') {
    if (apiSpec.functionOptions) ex.functionOptions = apiSpec.functionOptions
    if (apiSpec.sections) ex.sections = apiSpec.sections as TaskExercise['sections']
    if (apiSpec.paragraphTokens) ex.paragraphTokens = apiSpec.paragraphTokens as TaskExercise['paragraphTokens']
  }

  const serverCheck = apiSpec.type !== 'select-evidence'
  return { exercise: ex, serverCheck }
}

function enrichFromManifest(exercise: TaskExercise, ak: any, exerciseLabel?: string): EnrichResult {
  const ex = { ...exercise }
  if (exerciseLabel) ex.label = exerciseLabel

  if (ak.type === 'quiz' && ak.answers?.length) {
    ex.questions = ak.answers.map((a: Record<string, unknown>, i: number) => {
      const base = ex.questions?.[i] || {} as Partial<TaskQuestion>
      return {
        ...base,
        ...(a.questionText ? { q: a.questionText as string } : {}),
        ...(a.questionTranslate ? { translate: a.questionTranslate as string } : {}),
        ...(a.options ? { opts: a.options as string[] } : {}),
        ...(typeof a.correct === 'number' ? { correct: a.correct } : {}),
        ...(a.hint ? { hint: a.hint as string } : {}),
        ...(a.hintZh ? { hintZh: a.hintZh as string } : {}),
        ...(a.walkthrough ? { walkthrough: a.walkthrough as string } : {}),
        ...(a.walkthroughZh ? { walkthroughZh: a.walkthroughZh as string } : {}),
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
        ...(a.left ? { left: a.left as string } : {}),
        ...(sharedOpts ? { opts: sharedOpts } : {}),
        ...(a.correct != null ? { correct: typeof a.correct === 'number' ? a.correct : (sharedOpts as string[] | undefined)?.indexOf(a.correct as string) ?? 0 } : {}),
        ...(a.hint ? { hint: a.hint as string } : {}),
        ...(a.hintZh ? { hintZh: a.hintZh as string } : {}),
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
        ...(a.place ? { place: a.place as string } : {}),
        ...(a.isDemo != null ? { demo: a.isDemo as boolean } : {}),
        ...(a.practice ? { practice: a.practice as string } : {}),
        ...(a.reason ? { reason: a.reason as string } : {}),
        ...(a.hint ? { hint: a.hint as string } : {}),
        ...(a.hintZh ? { hintZh: a.hintZh as string } : {}),
      } as TaskMatrixRow
    })
    // Sanitized manifest uses ExerciseSpec format
    if (ak.rows?.length) {
      ex.rows = ak.rows.map((r: Record<string, unknown>, i: number) => {
        const base = ex.rows?.[i] || {} as Partial<TaskMatrixRow>
        return { ...base, place: (r.place as string) || base.place, demo: (r.isDemo as boolean) ?? base.demo, ...(r.practice ? { practice: r.practice as string } : {}), ...(r.reason ? { reason: r.reason as string } : {}) } as TaskMatrixRow
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
    if (ak.correctOrder) ex.correctOrder = ak.correctOrder as number[]
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
    else if (ak.items) ex.mapItems = ak.items as any
    if (ak.minReasonLength) ex.minReasonLength = ak.minReasonLength
  }

  return { exercise: ex, serverCheck: false }
}
