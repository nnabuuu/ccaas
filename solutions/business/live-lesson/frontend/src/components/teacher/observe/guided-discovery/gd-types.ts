import type { ObserveData } from '../ObserveDrawer'

// ── Step spec types (mirrors backend GuidedDiscoveryStep) ──

export interface GdChoiceItem {
  id: string
  prompt: string
  options: string[]
  correct: number
}

export interface GdObservationChoiceSpec {
  type: 'observation_choice'
  id: string
  title: string
  choices: GdChoiceItem[]
}

export interface GdBlankItem {
  id: string
  label: string
  accepts: string[]
}

export interface GdFormulaBlanksSpec {
  type: 'formula_blanks'
  id: string
  title: string
  prompt?: string
  blanks: GdBlankItem[]
}

export interface GdDerivationLine {
  text: string
  blank?: { id: string; accepts: string[] }
}

export interface GdDerivationBlankSpec {
  type: 'derivation_blank'
  id: string
  title: string
  lines: GdDerivationLine[]
}

export interface GdTextBlanksSpec {
  type: 'text_blanks'
  id: string
  title: string
  template: string
  blanks: Array<{ id: string; accepts: string[] }>
}

export type GdStepSpec =
  | GdObservationChoiceSpec
  | GdFormulaBlanksSpec
  | GdDerivationBlankSpec
  | GdTextBlanksSpec

export interface GdStepDef {
  id: string
  title: string
  type: string
  spec: GdStepSpec
}

export interface GdData extends ObserveData {
  stats: {
    totalStudents: number; submitted: number; avgScore: number
    perfectCount: number; avgTime: number
  }
  stepDefs: GdStepDef[]
  stepStats: Array<{
    id: string; title: string; passedCount: number; passedRate: number
    errors: Array<{
      description: string; count: number
      students: Array<{ id: string; name: string }>
    }>
  }>
  students: Array<{
    id: string; name: string; submitted: boolean; score: number; time: number
    stepResults: Record<string, boolean>
    stepAnswers: Record<string, Record<string, unknown>>
    keyInsights: string[]
  }>
}
