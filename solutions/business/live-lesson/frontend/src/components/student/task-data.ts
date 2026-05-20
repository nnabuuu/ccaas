/* ═══ TASKS DATA — types, builders, TASK_TO_STEP ═══ */

export interface TaskQuestion {
  q: string; opts: string[]; correct?: number
  hint?: string; hintZh?: string; translate?: string
  walkthrough?: string; walkthroughZh?: string
  paraRef?: number[]
}
export interface TaskMatchPair {
  left: string; opts: string[]; correct?: number
  hint?: string; hintZh?: string
  walkthrough?: string; walkthroughZh?: string
  paraRef?: number[]
}

export type ServerHintMap = Record<number, {
  hint?: string; hintZh?: string
  walkthrough?: string; walkthroughZh?: string
}>
export interface TaskMatrixRow {
  place: string; demo?: boolean; practice?: string; reason?: string
  hint?: string; hintZh?: string
  paraRef?: number[]
  whatPrompt?: string; whyPrompt?: string
}
export interface MapAxis { neg: string; pos: string; label: string }
export interface MapItem { id: string; label: string; hint?: string; refs?: number[] }
export interface RichContentQuizPart {
  id: string
  prompt?: string
  expression?: string
  promptImages?: Array<{ url: string; alt?: string }>
  inputMethods?: string[]
}

// Guided Discovery step types (student-safe, no answers)
export interface GdChoiceItem { id: string; prompt?: string; options: string[]; correct?: number }
export interface GdBlankItem { id: string; label: string; placeholder?: string; inputMethods?: string[] }
export interface GdLineItem { text: string; blank?: { id: string; placeholder?: string; inputMethods?: string[] } }
export interface GdTextBlankItem { id: string; inputMethods?: string[] }

export interface GdStepBase { id: string; title: string }
export interface GdObservationStep extends GdStepBase {
  type: 'observation_choice'
  table?: Array<{ expression: string; result: string }>
  highlights?: {
    same: { color: string; terms: string[][] }
    opposite: { color: string; terms: string[][] }
  }
  choices: GdChoiceItem[]
  conclusion?: string
}
export interface GdFormulaBlanksStep extends GdStepBase {
  type: 'formula_blanks'
  prompt?: string
  blanks: GdBlankItem[]
  inputMethods?: string[]
}
export interface GdDerivationBlankStep extends GdStepBase {
  type: 'derivation_blank'
  lines: GdLineItem[]
  inputMethods?: string[]
}
export interface GdTextBlanksStep extends GdStepBase {
  type: 'text_blanks'
  template: string
  textBlanks: GdTextBlankItem[]
  inputMethods?: string[]
}
export type GdStep = GdObservationStep | GdFormulaBlanksStep | GdDerivationBlankStep | GdTextBlanksStep

export interface TaskExercise {
  type: 'quiz' | 'match' | 'matrix' | 'stance' | 'order' | 'select-evidence' | 'map' | 'image-upload' | 'fill-blank' | 'rich-content-quiz' | 'guided-discovery'
  label: string
  questions?: TaskQuestion[]
  pairs?: TaskMatchPair[]
  rows?: TaskMatrixRow[]
  stanceQ?: string; stanceQZh?: string; stanceOpts?: string[]; evidence?: string[]
  items?: string[]; correctOrder?: number[]
  // select-evidence fields (injected from manifest answerKey at runtime)
  functionOptions?: string[]
  sections?: Array<{ id: string; label: string; range: number[]; correctFunction: string; minHits?: number; hint?: string; hintZh?: string; aiCorrect?: string; aiPartial?: string }>
  paragraphTokens?: Record<string, Array<{ t: string; kind?: 'evidence' | 'pick' | 'distractor'; why?: string }>>
  // matrix + map fields
  practiceCount?: number
  // map fields
  prompt?: string
  axes?: { x: MapAxis; y: MapAxis }
  mapItems?: MapItem[]
  minReasonLength?: number
  givenPlacements?: Record<string, { x: number; y: number }>
  practiceItemIds?: string[]
  // image-upload fields
  promptImages?: Array<{ url: string; alt?: string }>
  rubric?: Array<{ id: string; label: string; weight: number }>
  maxImages?: number
  // fill-blank fields
  sentences?: Array<{ id: string; template: string }>
  // rich-content-quiz fields
  parts?: RichContentQuizPart[]
  subType?: string
  inputMethods?: string[]
  // guided-discovery fields
  gdTitle?: string
  gdSteps?: GdStep[]
  gdSummary?: { formula?: string; name?: string; description?: string }
}
export interface FallbackMC {
  question: string; questionZh?: string
  options: string[]; correctIndex: number
  explanation: string; explanationZh?: string
}
export interface TaskDiscuss {
  openingQ: string; openingQZh?: string
  scaffolds?: string[]
  maxRounds: number; maxTimeSeconds: number
  fallbackMC: FallbackMC
  insight: string; insightZh?: string
}
export interface InstructionView {
  title: string
  body: string
  keyPoints?: string[]
  confirmLabel?: string
}

export interface DiscoveryKey {
  type: 'guided-discovery'
  gdTitle?: string
  gdSteps?: GdStep[]
  gdSummary?: { formula?: string; name?: string; description?: string }
}

export interface Task {
  id: number; name: string; subtitle: string; time: string
  focus: number[]; intro: string; exercise: TaskExercise
  discuss: TaskDiscuss; summary: string
  instructionView?: InstructionView
  discoveryKey?: DiscoveryKey
}

/** Dynamically compute task→step mapping from manifest readingSteps */
export function buildTaskToStep(readingSteps: Array<{ idx: number; type?: string; answerKey?: any }>): Record<number, number> {
  return readingSteps
    .filter(s => s.type === 'task' || (!s.type && s.answerKey))
    .sort((a, b) => a.idx - b.idx)
    .reduce<Record<number, number>>((map, s, i) => ({ ...map, [i + 1]: s.idx }), {})
}

/** Map each task to its instruction content (studentView).
 *  Priority: task's own studentView > preceding instruction's studentView (backward compat). */
export function buildInstructionMap(
  readingSteps: Array<{ idx: number; type?: string; studentView?: any }>,
  taskToStep: Record<number, number>,
): Record<number, InstructionView> {
  const stepToTask: Record<number, number> = {}
  for (const [tid, sid] of Object.entries(taskToStep)) stepToTask[+sid] = +tid

  const map: Record<number, InstructionView> = {}
  const sorted = [...readingSteps].sort((a, b) => a.idx - b.idx)

  for (let i = 0; i < sorted.length; i++) {
    const step = sorted[i]
    // Task with its own studentView → use it directly
    if (stepToTask[step.idx] !== undefined && step.studentView) {
      map[stepToTask[step.idx]] = step.studentView
      continue
    }
    // Fallback: instruction step → pair with next task (backward compat)
    if (step.type === 'instruction' && step.studentView) {
      const next = sorted.slice(i + 1).find(n => stepToTask[n.idx] !== undefined)
      if (next && !map[stepToTask[next.idx]]) {
        map[stepToTask[next.idx]] = step.studentView
      }
    }
  }
  return map
}

/** Build Task[] dynamically from manifest readingSteps. */
export function buildTasksFromManifest(
  readingSteps: Array<{ idx: number; type?: string; label?: string; labelEn?: string;
    displayName?: string; subtitle?: string; duration?: number; description?: string;
    focusParagraphs?: string[]; exerciseLabel?: string; summary?: string;
    discuss?: any; answerKey?: any; discoveryKey?: any; studentView?: any }>,
): Task[] {
  return readingSteps
    .filter(s => s.type === 'task' || (!s.type && s.answerKey))
    .sort((a, b) => a.idx - b.idx)
    .map((step, i) => ({
      id: i + 1,
      name: step.displayName || step.labelEn || step.label || '',
      subtitle: step.subtitle || '',
      time: step.duration ? `${step.duration} min` : '',
      focus: (step.focusParagraphs || []).map(pid => parseInt(pid.replace('p', ''))),
      intro: step.description || '',
      exercise: {
        type: (step.answerKey?.type || 'quiz') as TaskExercise['type'],
        label: step.exerciseLabel || '',
      },
      discuss: {
        openingQ: step.discuss?.openingQ || '',
        openingQZh: step.discuss?.openingQZh,
        scaffolds: step.discuss?.scaffolds,
        maxRounds: step.discuss?.maxRounds || 6,
        maxTimeSeconds: step.discuss?.maxTimeSeconds || 300,
        fallbackMC: step.discuss?.fallbackMC || { question: '', options: [], correctIndex: 0, explanation: '' },
        insight: step.discuss?.insight || '',
        insightZh: step.discuss?.insightZh,
      },
      summary: step.summary || '',
      ...(step.discoveryKey && {
        discoveryKey: {
          type: 'guided-discovery' as const,
          gdTitle: step.discoveryKey.gdTitle || step.discoveryKey.title,
          gdSteps: step.discoveryKey.gdSteps || step.discoveryKey.steps,
          gdSummary: step.discoveryKey.gdSummary || step.discoveryKey.summary,
        },
      }),
    }))
}

