/**
 * Exercise enrichment dispatcher.
 *
 * The actual per-type enrichment logic now lives on each plugin's
 * `enrichFromApi` / `enrichFromManifest` methods (see `plugins/built-in.tsx`).
 * This module is a thin orchestrator that looks the plugin up in the registry
 * and forwards. Adding a new exercise type means writing a plugin — no edit
 * here, no edit in PracticePhase, no other "core" file to touch.
 *
 * The per-type `*ExerciseSpec` interfaces below remain the canonical typed
 * contract for what the backend `/exercise` API returns and are consumed by
 * StudentShell.tsx + plugin implementations.
 */

import type { TaskExercise, GdStep } from '../task-data'
import { getExerciseType } from './plugins/registry'

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
    expression?: string
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

// ── Orchestrator ──

/**
 * Enrich a TaskExercise using either an API ExerciseSpec (answer-safe) or a
 * manifest answerKey. Dispatches to `plugin.enrichFromApi` /
 * `enrichFromManifest`. When no plugin is registered for the type, the
 * exercise is returned unchanged and a warning is logged — this only fires
 * if `plugins/built-in.tsx` failed to import.
 */
export function enrichExerciseFromSpec(
  exercise: TaskExercise,
  apiSpec: ExerciseSpec | undefined,
  answerKey: Record<string, unknown> | undefined,
  exerciseLabel?: string,
): EnrichResult {
  if (apiSpec) {
    const ex = { ...exercise }
    ex.type = apiSpec.type
    if (apiSpec.label) ex.label = apiSpec.label
    const plugin = getExerciseType(apiSpec.type)
    if (!plugin) {
      // eslint-disable-next-line no-console
      console.warn(`[enrichExerciseFromSpec] no plugin for type "${apiSpec.type}"`)
      return { exercise: ex, serverCheck: false }
    }
    plugin.enrichFromApi?.(ex as unknown as Record<string, unknown>, apiSpec as unknown as Record<string, unknown>)
    // serverCheck defaults to true; plugins opt out by setting serverCheck: false
    return { exercise: ex, serverCheck: plugin.serverCheck !== false }
  }
  if (answerKey) {
    const ex = { ...exercise }
    if (exerciseLabel) ex.label = exerciseLabel
    const type = answerKey.type as string | undefined
    const plugin = type ? getExerciseType(type) : undefined
    plugin?.enrichFromManifest?.(ex as unknown as Record<string, unknown>, answerKey)
    // Manifest path: server check requires API spec (which carries the
    // _serverCheck signal). Without a spec we always grade locally.
    return { exercise: ex, serverCheck: false }
  }
  return { exercise, serverCheck: false }
}
