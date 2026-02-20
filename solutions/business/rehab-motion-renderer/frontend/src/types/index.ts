// ═══════════════════════════════════════════════════════════
// SyncFields — what AI writes via write_output
// ═══════════════════════════════════════════════════════════

export type SyncField =
  | 'title'
  | 'subtitle'
  | 'medicalSummary'
  | 'contraindications'
  | 'principlesDo'
  | 'principlesAvoid'
  | 'frequency'
  | 'exercises'
  | 'progressionPlan'
  | 'medicalReminder'

// ═══════════════════════════════════════════════════════════
// RehabPlan — the form data model
// ═══════════════════════════════════════════════════════════

export interface RehabPlan {
  title: string
  subtitle: string
  medicalSummary: string
  contraindications: string
  principlesDo: string
  principlesAvoid: string
  frequency: string
  exercises: ExerciseRenderData[]
  progressionPlan: string
  medicalReminder: string
}

export const EMPTY_REHAB_PLAN: RehabPlan = {
  title: '',
  subtitle: '',
  medicalSummary: '',
  contraindications: '',
  principlesDo: '',
  principlesAvoid: '',
  frequency: '',
  exercises: [],
  progressionPlan: '',
  medicalReminder: '',
}

// ═══════════════════════════════════════════════════════════
// ExerciseSpec — AI-generated exercise parameters (no keyframes)
// ═══════════════════════════════════════════════════════════

export interface ExerciseSpec {
  type: string
  sets: number
  reps: number
  restSec: number
  tempo: string
  howTo: string[]
  safety: string[]
}

// ═══════════════════════════════════════════════════════════
// ExerciseLibraryEntry — from exercise-library.json
// ═══════════════════════════════════════════════════════════

export type FigureType = 'lying' | 'cat' | 'seated'

export type Keyframe = Record<string, number>

export interface ExerciseLibraryEntry {
  name: string
  nameZh: string
  muscles: string
  figure: FigureType
  phases: string[]
  phaseDurations: number[]
  keyframes: Keyframe[]
  visualHints?: VisualHint[]
}

export interface VisualHint {
  type: 'label' | 'glow' | 'arrow' | 'indicator'
  trigger: {
    field: string
    condition: 'gt' | 'lt' | 'eq'
    value: number
  }
  text?: string
  color?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

// ═══════════════════════════════════════════════════════════
// ExerciseRenderData — merged ExerciseSpec + library keyframes
// ═══════════════════════════════════════════════════════════

export interface ExerciseRenderData extends ExerciseSpec {
  // From library
  id: string
  name: string
  nameZh: string
  muscles: string
  phases: string[]
  phaseDurations: number[]
  figure: FigureType
  keyframes: Keyframe[]
  visualHints?: VisualHint[]
}

// ═══════════════════════════════════════════════════════════
// PendingUpdate — output_update from AI, pending user sync
// ═══════════════════════════════════════════════════════════

export interface PendingUpdate {
  field: SyncField
  value: string
  preview: string
}
