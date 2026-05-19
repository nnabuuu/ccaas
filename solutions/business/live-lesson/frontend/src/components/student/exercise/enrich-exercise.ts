/**
 * Pure function extracted from StudentShell.tsx enrichedTask useMemo.
 * Enriches a TaskExercise from either API spec (answer-safe) or manifest answerKey.
 *
 * Uses a handler registry pattern — each exercise type is a self-contained handler.
 * Adding a new type = create handler object + register in `handlers` map.
 */

import type { TaskExercise, TaskQuestion, TaskMatchPair, TaskMatrixRow, GdStep } from '../task-data'

// ── Per-type spec interfaces (discriminated union) ──

export interface ExerciseSpecBase { label: string }

export interface QuizExerciseSpec extends ExerciseSpecBase {
  type: 'quiz'
  questions?: Array<{ idx: number; text: string; translate?: string; options: string[]; paraRef?: number[] }>
}

export interface MatchExerciseSpec extends ExerciseSpecBase {
  type: 'match'
  pairs?: Array<{ idx: number; left: string; options: string[]; paraRef?: number[] }>
}

export interface MatrixExerciseSpec extends ExerciseSpecBase {
  type: 'matrix'
  rows?: Array<{ idx: number; place: string; isDemo: boolean; practice?: string; reason?: string; paraRef?: number[]; whatPrompt?: string; whyPrompt?: string }>
  practiceCount?: number
}

export interface StanceExerciseSpec extends ExerciseSpecBase {
  type: 'stance'
  stanceQ?: string; stanceQZh?: string; stanceOpts?: string[]; evidence?: string[]
}

export interface OrderExerciseSpec extends ExerciseSpecBase {
  type: 'order'
  items?: string[]
}

export interface SelectEvidenceExerciseSpec extends ExerciseSpecBase {
  type: 'select-evidence'
  functionOptions?: string[]
  sections?: Array<{ id: string; label: string; range: number[]; correctFunction?: string; minHits?: number; hint?: string; hintZh?: string; aiCorrect?: string; aiPartial?: string }>
  paragraphTokens?: Record<string, Array<{ t: string; interactive?: boolean; kind?: string; why?: string }>>
}

export interface MapExerciseSpec extends ExerciseSpecBase {
  type: 'map'
  prompt?: string
  axes?: { x: { neg: string; pos: string; label: string }; y: { neg: string; pos: string; label: string } }
  mapItems?: Array<{ id: string; label: string; hint?: string; refs?: number[] }>
  minReasonLength?: number
  givenPlacements?: Record<string, { x: number; y: number }>
  practiceCount?: number
  practiceItemIds?: string[]
}

export interface ImageUploadExerciseSpec extends ExerciseSpecBase {
  type: 'image-upload'
  prompt?: string
  promptImages?: Array<{ url: string; alt?: string }>
  rubric?: Array<{ id: string; label: string; weight: number }>
  maxImages?: number
}

export interface RichContentQuizExerciseSpec extends ExerciseSpecBase {
  type: 'rich-content-quiz'
  subType?: string
  prompt?: string
  promptImages?: Array<{ url: string; alt?: string }>
  maxImages?: number
  inputMethods?: string[]
  parts?: Array<{
    id: string; prompt: string
    rubric: Array<{ id: string; label: string; weight: number }>
    maxImages?: number; hasScaffold?: boolean
    inputMethods?: string[]
  }>
}

export interface FillBlankExerciseSpec extends ExerciseSpecBase {
  type: 'fill-blank'
  sentences?: Array<{ id: string; template: string }>
}

export interface GuidedDiscoveryExerciseSpec extends ExerciseSpecBase {
  type: 'guided-discovery'
  gdTitle?: string
  gdSteps?: GdStep[]
  gdSummary?: { formula?: string; name?: string; description?: string }
}

export type ExerciseSpec =
  | QuizExerciseSpec
  | MatchExerciseSpec
  | MatrixExerciseSpec
  | StanceExerciseSpec
  | OrderExerciseSpec
  | SelectEvidenceExerciseSpec
  | MapExerciseSpec
  | ImageUploadExerciseSpec
  | RichContentQuizExerciseSpec
  | FillBlankExerciseSpec
  | GuidedDiscoveryExerciseSpec

export interface EnrichResult {
  exercise: TaskExercise
  serverCheck: boolean
}

// ── Handler interface ──

export interface ExerciseEnrichHandler<S extends ExerciseSpec = ExerciseSpec> {
  fromApi(ex: TaskExercise, spec: S): void
  fromManifest(ex: TaskExercise, ak: any): void
  /** false = client-side grading (select-evidence). Default: true */
  serverCheck?: boolean
}

// ── Handlers ──

const quizHandler: ExerciseEnrichHandler<QuizExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.questions) {
      ex.questions = spec.questions.map((q, i) => {
        const base = ex.questions?.[i] || {} as Partial<TaskQuestion>
        return {
          ...base,
          q: q.text,
          translate: q.translate,
          opts: q.options,
          ...(q.paraRef && { paraRef: q.paraRef }),
        } as TaskQuestion
      })
    }
  },
  fromManifest(ex, ak) {
    if (ak.answers?.length) {
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
          ...(a.paraRef ? { paraRef: a.paraRef as number[] } : {}),
        } as TaskQuestion
      })
    }
    // Sanitized manifest uses ExerciseSpec format (text/translate/options fields)
    if (ak.questions?.length) {
      ex.questions = ak.questions.map((q: Record<string, unknown>, i: number) => {
        const base = ex.questions?.[i] || {} as Partial<TaskQuestion>
        return {
          ...base,
          q: (q.text as string) || base.q,
          translate: (q.translate as string) || base.translate,
          opts: (q.options as string[]) || base.opts,
        } as TaskQuestion
      })
    }
  },
}

const matchHandler: ExerciseEnrichHandler<MatchExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.pairs) {
      ex.pairs = spec.pairs.map((p, i) => {
        const base = ex.pairs?.[i] || {} as Partial<TaskMatchPair>
        return {
          ...base,
          left: p.left,
          opts: p.options,
          ...(p.paraRef && { paraRef: p.paraRef }),
        } as TaskMatchPair
      })
    }
  },
  fromManifest(ex, ak) {
    if (ak.answers?.length) {
      const sharedOpts = ak.options
      ex.pairs = ak.answers.map((a: Record<string, unknown>, i: number) => {
        const base = ex.pairs?.[i] || {} as Partial<TaskMatchPair>
        return {
          ...base,
          ...(a.left ? { left: a.left as string } : {}),
          ...(sharedOpts ? { opts: sharedOpts } : {}),
          ...(a.correct != null
            ? { correct: typeof a.correct === 'number'
                ? a.correct
                : (sharedOpts as string[] | undefined)?.indexOf(a.correct as string) ?? 0 }
            : {}),
          ...(a.hint ? { hint: a.hint as string } : {}),
          ...(a.hintZh ? { hintZh: a.hintZh as string } : {}),
          ...(a.paraRef ? { paraRef: a.paraRef as number[] } : {}),
        } as TaskMatchPair
      })
    }
    // Sanitized manifest uses ExerciseSpec format (pairs, not answers)
    if (ak.pairs?.length) {
      ex.pairs = ak.pairs.map((p: Record<string, unknown>, i: number) => {
        const base = ex.pairs?.[i] || {} as Partial<TaskMatchPair>
        return {
          ...base,
          left: (p.left as string) || base.left,
          opts: (p.options as string[]) || base.opts,
        } as TaskMatchPair
      })
    }
  },
}

const matrixHandler: ExerciseEnrichHandler<MatrixExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.rows) {
      ex.rows = spec.rows.map((r, i) => {
        const base = ex.rows?.[i] || {} as Partial<TaskMatrixRow>
        return {
          ...base,
          place: r.place,
          demo: r.isDemo,
          ...(r.practice && { practice: r.practice }),
          ...(r.reason && { reason: r.reason }),
          ...(r.paraRef && { paraRef: r.paraRef }),
          ...(r.whatPrompt && { whatPrompt: r.whatPrompt }),
          ...(r.whyPrompt && { whyPrompt: r.whyPrompt }),
        } as TaskMatrixRow
      })
      if (spec.practiceCount) ex.practiceCount = spec.practiceCount
    }
  },
  fromManifest(ex, ak) {
    if (ak.answers?.length) {
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
          ...(a.paraRef ? { paraRef: a.paraRef as number[] } : {}),
          ...(a.whatPrompt ? { whatPrompt: a.whatPrompt as string } : {}),
          ...(a.whyPrompt ? { whyPrompt: a.whyPrompt as string } : {}),
        } as TaskMatrixRow
      })
      if (ak.practiceCount) ex.practiceCount = ak.practiceCount
    }
    // Sanitized manifest uses ExerciseSpec format (rows, not answers)
    if (ak.rows?.length) {
      ex.rows = ak.rows.map((r: Record<string, unknown>, i: number) => {
        const base = ex.rows?.[i] || {} as Partial<TaskMatrixRow>
        return {
          ...base,
          place: (r.place as string) || base.place,
          demo: (r.isDemo as boolean) ?? base.demo,
          ...(r.practice ? { practice: r.practice as string } : {}),
          ...(r.reason ? { reason: r.reason as string } : {}),
          ...(r.paraRef ? { paraRef: r.paraRef as number[] } : {}),
          ...(r.whatPrompt ? { whatPrompt: r.whatPrompt as string } : {}),
          ...(r.whyPrompt ? { whyPrompt: r.whyPrompt as string } : {}),
        } as TaskMatrixRow
      })
      if (ak.practiceCount) ex.practiceCount = ak.practiceCount
    }
  },
}

const stanceHandler: ExerciseEnrichHandler<StanceExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.stanceQ) ex.stanceQ = spec.stanceQ
    if (spec.stanceQZh) ex.stanceQZh = spec.stanceQZh
    if (spec.stanceOpts) ex.stanceOpts = spec.stanceOpts
    if (spec.evidence) ex.evidence = spec.evidence
  },
  fromManifest(ex, ak) {
    if (ak.stanceQ) ex.stanceQ = ak.stanceQ
    if (ak.stanceQZh) ex.stanceQZh = ak.stanceQZh
    if (ak.stanceOpts) ex.stanceOpts = ak.stanceOpts
    if (ak.evidence) ex.evidence = ak.evidence
  },
}

const orderHandler: ExerciseEnrichHandler<OrderExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.items) ex.items = spec.items
  },
  fromManifest(ex, ak) {
    if (ak.items) ex.items = ak.items
    if (ak.correctOrder) ex.correctOrder = ak.correctOrder as number[]
  },
}

const selectEvidenceHandler: ExerciseEnrichHandler<SelectEvidenceExerciseSpec> = {
  serverCheck: false,
  fromApi(ex, spec) {
    if (spec.functionOptions) ex.functionOptions = spec.functionOptions
    if (spec.sections) ex.sections = spec.sections as TaskExercise['sections']
    if (spec.paragraphTokens) ex.paragraphTokens = spec.paragraphTokens as TaskExercise['paragraphTokens']
  },
  fromManifest(ex, ak) {
    ex.type = 'select-evidence'
    if (ak.functionOptions) ex.functionOptions = ak.functionOptions
    if (ak.sections) ex.sections = ak.sections
    if (ak.paragraphTokens) ex.paragraphTokens = ak.paragraphTokens
  },
}

const mapHandler: ExerciseEnrichHandler<MapExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.prompt) ex.prompt = spec.prompt
    if (spec.axes) ex.axes = spec.axes
    if (spec.mapItems) ex.mapItems = spec.mapItems
    if (spec.minReasonLength) ex.minReasonLength = spec.minReasonLength
    if (spec.givenPlacements) ex.givenPlacements = spec.givenPlacements
    if (spec.practiceCount) ex.practiceCount = spec.practiceCount
    if (spec.practiceItemIds) ex.practiceItemIds = spec.practiceItemIds
  },
  fromManifest(ex, ak) {
    if (ak.prompt) ex.prompt = ak.prompt
    if (ak.axes) ex.axes = ak.axes
    if (ak.mapItems) ex.mapItems = ak.mapItems
    else if (ak.items) ex.mapItems = ak.items as any
    if (ak.minReasonLength) ex.minReasonLength = ak.minReasonLength
    if (ak.givenPlacements) ex.givenPlacements = ak.givenPlacements
    if (ak.practiceCount) ex.practiceCount = ak.practiceCount
    if (ak.practiceItemIds) ex.practiceItemIds = ak.practiceItemIds
  },
}

const imageUploadHandler: ExerciseEnrichHandler<ImageUploadExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.prompt) ex.prompt = spec.prompt
    if (spec.promptImages) ex.promptImages = spec.promptImages
    if (spec.rubric) ex.rubric = spec.rubric
    if (spec.maxImages) ex.maxImages = spec.maxImages
  },
  fromManifest(ex, ak) {
    if (ak.prompt) ex.prompt = ak.prompt
    if (ak.promptImages) ex.promptImages = ak.promptImages
    if (ak.rubric) ex.rubric = ak.rubric
    if (ak.maxImages) ex.maxImages = ak.maxImages
  },
}

const richContentQuizHandler: ExerciseEnrichHandler<RichContentQuizExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.prompt) ex.prompt = spec.prompt
    if (spec.promptImages) ex.promptImages = spec.promptImages
    if (spec.maxImages) ex.maxImages = spec.maxImages
    if (spec.subType) ex.subType = spec.subType
    if (spec.inputMethods) ex.inputMethods = spec.inputMethods
    if (spec.parts) {
      ex.parts = spec.parts.map(p => ({
        id: p.id,
        prompt: p.prompt,
        ...(p.inputMethods && { inputMethods: p.inputMethods }),
      }))
    }
  },
  fromManifest(ex, ak) {
    ex.type = 'rich-content-quiz'
    if (ak.prompt) ex.prompt = ak.prompt
    if (ak.promptImages) ex.promptImages = ak.promptImages
    if (ak.maxImages) ex.maxImages = ak.maxImages
    if (ak.subType) ex.subType = ak.subType
    if (ak.inputMethods) ex.inputMethods = ak.inputMethods
    if (ak.parts) {
      ex.parts = ak.parts.map((p: any) => ({
        id: p.id,
        prompt: p.prompt,
        ...(p.inputMethods && { inputMethods: p.inputMethods }),
      }))
    }
  },
}

const fillBlankHandler: ExerciseEnrichHandler<FillBlankExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.sentences) ex.sentences = spec.sentences
  },
  fromManifest(ex, ak) {
    if (ak.sentences) ex.sentences = ak.sentences
  },
}

const guidedDiscoveryHandler: ExerciseEnrichHandler<GuidedDiscoveryExerciseSpec> = {
  fromApi(ex, spec) {
    if (spec.gdTitle) ex.gdTitle = spec.gdTitle
    if (spec.gdSteps) ex.gdSteps = spec.gdSteps
    if (spec.gdSummary) ex.gdSummary = spec.gdSummary
  },
  fromManifest(ex, ak) {
    ex.type = 'guided-discovery'
    if (ak.gdTitle) ex.gdTitle = ak.gdTitle
    else if (ak.title) ex.gdTitle = ak.title
    if (ak.gdSteps) ex.gdSteps = ak.gdSteps
    if (ak.gdSummary) ex.gdSummary = ak.gdSummary
  },
}

// ── Registry ──

const handlers: Record<ExerciseSpec['type'], ExerciseEnrichHandler> = {
  quiz: quizHandler,
  match: matchHandler,
  matrix: matrixHandler,
  stance: stanceHandler,
  order: orderHandler,
  'select-evidence': selectEvidenceHandler,
  map: mapHandler,
  'image-upload': imageUploadHandler,
  'rich-content-quiz': richContentQuizHandler,
  'fill-blank': fillBlankHandler,
  'guided-discovery': guidedDiscoveryHandler,
}

// ── Orchestrator ──

export function enrichExerciseFromSpec(
  exercise: TaskExercise,
  apiSpec: ExerciseSpec | undefined,
  answerKey: any | undefined,
  exerciseLabel?: string,
): EnrichResult {
  if (apiSpec) {
    const ex = { ...exercise }
    ex.type = apiSpec.type
    if (apiSpec.label) ex.label = apiSpec.label
    const handler = handlers[apiSpec.type]
    handler.fromApi(ex, apiSpec)
    return { exercise: ex, serverCheck: handler.serverCheck !== false }
  }
  if (answerKey) {
    const ex = { ...exercise }
    if (exerciseLabel) ex.label = exerciseLabel
    // answerKey.type is untyped (any) — may not match a registered handler
    const handler = handlers[answerKey.type as ExerciseSpec['type']]
    handler?.fromManifest(ex, answerKey)
    return { exercise: ex, serverCheck: false }
  }
  return { exercise, serverCheck: false }
}
