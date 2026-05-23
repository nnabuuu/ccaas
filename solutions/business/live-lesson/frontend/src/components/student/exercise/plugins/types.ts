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

/** Props passed to every plugin's render component. */
export interface ExercisePluginProps {
  // ── Core ──
  exercise: Record<string, any>
  ans: Record<string, any>
  setAns: (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => void
  allDone: boolean
  reviewData?: { data: Record<string, unknown>; checkItems?: Array<Record<string, unknown>> }
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
  onScaffoldPush?: (hint: Record<string, any>) => void
  submit?: (step: number, data: Record<string, any>) => void
  studentId?: string
  sessionCode?: string

  /** Upload a file, returning an accessible URL — injected by host (prod or preview) */
  uploadFile?: (file: File) => Promise<{ url: string }>
  /** Resolve a resource relative path to an absolute URL */
  resolveResourceUrl?: (relativePath: string) => string
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

  /** Process a /check response into PracticePhase state */
  handleCheckResult(
    result: CheckResultLike,
    exercise: Record<string, any>,
    currentState: {
      ans: Record<string, any>
      attempts: Record<number, any[]>
      correctQs: Set<number>
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
  /** Backend observe-type alias (e.g. 'quiz' → 'mc'). Defaults to `type`. */
  readonly observeType?: string
}
