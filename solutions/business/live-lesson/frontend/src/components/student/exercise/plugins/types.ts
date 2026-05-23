/**
 * Frontend ExerciseUIPlugin contract — mirrors the design in
 * docs/exercise-plugin-architecture.zh-CN.md §4.1.
 *
 * One plugin object describes a single exercise type's complete UI behaviour:
 * rendering, submit logic, check-result handling, optional enrichment.
 *
 * Plugins are registered via `registerExerciseType()` in registry.ts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ComponentType } from 'react'
import type { ReviewData } from '../../../../hooks/useReviewRestore'
import type { ScaffoldHint } from '../../ScaffoldPanel'

/** Props passed to every plugin's render component. */
export interface ExercisePluginProps {
  // ── Core ──
  exercise: Record<string, any>
  ans: Record<string, any>
  setAns: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  /** True once exercise is fully complete (advances to next phase). */
  allDone: boolean
  /**
   * True after submission was accepted but before "fully complete" — set for
   * types where the student can move on even with a non-100 score
   * (matrix/map/stance/image-upload/etc.). Use when the underlying component
   * needs to know "user is past the editing stage".
   */
  softDone: boolean
  reviewData?: ReviewData
  /**
   * Per-plugin transient state managed by PracticePhase. Plugin reads from
   * `checkResultState[plugin.type]` and writes via `setCheckResultState`.
   * Never use the `ans` bag for transient per-type UI state — that bag is
   * reserved for the actual student answer payload.
   */
  checkResultState: Record<string, any>
  /** Update the per-plugin transient state slot. */
  setCheckResultState?: (
    updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>),
  ) => void

  // ── Platform capabilities (always passed) ──
  onDone: () => void
  stepIdx?: number
  taskId?: number
  locale?: string

  // ── Optional capabilities (parent provides on demand) ──
  onOverlayChange?: (overlay: any | null) => void
  onScaffoldPush?: (hint: ScaffoldHint) => void
  submit?: (step: number, data: Record<string, any>) => void
  studentId?: string
  sessionCode?: string

  /** Upload a file, returning an accessible URL — injected by host (prod or preview) */
  uploadFile?: (file: File) => Promise<{ url: string }>
  /** Resolve a resource relative path to an absolute URL */
  resolveResourceUrl?: (relativePath: string) => string

  /**
   * For rich-content-quiz only: subset of part IDs the student should solve in
   * this view (the rest are hidden). Plugin filters `exercise.parts` itself.
   */
  partIds?: string[]
}

export interface CheckResultLike {
  type?: string
  allCorrect?: boolean
  items?: Array<Record<string, any>>
  [k: string]: any
}

/** Output of plugin.handleCheckResult — guides PracticePhase state update */
export interface CheckResultHandlerOutput {
  /** Opaque state to store in PracticePhase, fed back to plugin on next render */
  checkResultState: Record<string, any>
  /** Exercise fully complete (advances to next phase) */
  allDone: boolean
  /** Soft completion — submitted but maybe not 100% (matrix/map style) */
  softDone: boolean
  /** Keys in ans to clear (used for retry-after-wrong patterns) */
  clearAnsKeys?: Array<string | number>
  /** Updated per-question attempts map (PracticePhase replaces its state). */
  attempts?: Record<number, any[]>
  /** Updated correct-question set. */
  correctQs?: Set<number>
  /** Updated wrong-question set. */
  wrongQs?: Set<number>
  /** Per-item attempt reports — PracticePhase loops these and calls reportAttempt. */
  reportItems?: Array<{
    qi: number
    attemptNum: number
    selected: any
    expected: any | null
    isCorrect: boolean
  }>
}

/** Local grade result (when serverCheck=false and localGrade is implemented) */
export interface LocalGradeResult {
  allDone: boolean
  softDone: boolean
  correctQs?: Set<number>
  wrongQs?: Set<number>
  attempts?: Record<number, any[]>
  clearAnsKeys?: Array<string | number>
}

/** Props for the observe ClassView (teacher dashboard, class-wide) */
export interface ObserveClassViewProps {
  data: Record<string, any>
  onStudentSelect: (studentId: string) => void
}

/** Props for the observe StudentView (teacher dashboard, single student) */
export interface ObserveStudentViewProps {
  data: Record<string, any>
  studentId: string
}

export interface ExerciseUIPlugin {
  /** Unique type identifier — must match backend @ExerciseType() */
  readonly type: string

  /** React component used in the student stage */
  readonly Component: ComponentType<ExercisePluginProps>

  /** When true, plugin owns its own submit button (used by select-evidence, rich-content-quiz, guided-discovery) */
  readonly selfManagedSubmit?: boolean

  /** When false, skip the server /check call (client-side grading) */
  readonly serverCheck?: boolean

  /** Whether the student can submit right now */
  canSubmit(
    exercise: Record<string, any>,
    ans: Record<string, any>,
    checkResultState: Record<string, any>,
  ): boolean

  /** Transform ans into the payload sent to /check */
  formatSubmitData(
    ans: Record<string, any>,
    checkResultState: Record<string, any>,
  ): Record<string, any>

  /**
   * Process a /check response into PracticePhase state.
   *
   * `currentState` carries everything the plugin might need to compute a new
   * state without round-tripping through PracticePhase:
   *  - ans / attempts / correctQs: shared state
   *  - serverHints: current hint bag (plugins for quiz/match/matrix merge in)
   *  - pluginState: full per-type bag (so e.g. matrix can read prior rowResults)
   */
  handleCheckResult(
    result: CheckResultLike,
    exercise: Record<string, any>,
    currentState: {
      ans: Record<string, any>
      attempts: Record<number, any[]>
      correctQs: Set<number>
      serverHints?: Record<string, any>
      pluginState?: Record<string, any>
    },
  ): CheckResultHandlerOutput

  /** Optional client-side grade (when serverCheck=false) */
  localGrade?(
    exercise: Record<string, any>,
    ans: Record<string, any>,
    prev: { correctQs: Set<number>; attempts: Record<number, any[]> },
    taskId: number,
  ): LocalGradeResult | null

  /** Transform API response into TaskExercise component fields (mutates) */
  enrichFromApi?(exercise: Record<string, any>, spec: Record<string, any>): void

  /** Transform manifest answerKey into TaskExercise fields (offline / fallback) */
  enrichFromManifest?(exercise: Record<string, any>, answerKey: Record<string, any>): void

  // ── Teacher observe ──
  readonly ObserveClassView?: ComponentType<ObserveClassViewProps>
  readonly ObserveStudentView?: ComponentType<ObserveStudentViewProps>
  /**
   * Backend observe-type alias.
   * - `undefined` → defaults to plugin.type (e.g. `'matrix'` → `'matrix'`).
   * - `string`    → overrides (e.g. quiz declares `'mc'`).
   * - `null`      → explicitly no observe surface for this type
   *                 (teacher dashboard hides the observe button).
   */
  readonly observeType?: string | null
}
