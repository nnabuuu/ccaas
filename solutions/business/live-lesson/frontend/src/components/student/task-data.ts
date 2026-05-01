/* ═══ TASKS DATA — types, builders, TASK_TO_STEP ═══ */

export interface TaskQuestion {
  q: string; opts: string[]; correct?: number
  hint?: string; hintZh?: string; translate?: string
  walkthrough?: string; walkthroughZh?: string
}
export interface TaskMatchPair {
  left: string; opts: string[]; correct?: number
  hint?: string; hintZh?: string
  walkthrough?: string; walkthroughZh?: string
}

export type ServerHintMap = Record<number, {
  hint?: string; hintZh?: string
  walkthrough?: string; walkthroughZh?: string
}>
export interface TaskMatrixRow {
  place: string; demo?: boolean; practice?: string; reason?: string
  hint?: string; hintZh?: string
}
export interface MapAxis { neg: string; pos: string; label: string }
export interface MapItem { id: string; label: string; hint?: string; refs?: number[] }
export interface TaskExercise {
  type: 'quiz' | 'match' | 'matrix' | 'stance' | 'order' | 'select-evidence' | 'map'
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
  // map fields
  prompt?: string
  axes?: { x: MapAxis; y: MapAxis }
  mapItems?: MapItem[]
  minReasonLength?: number
}
export interface TaskDiscussProbe {
  q: string; translate: string
}
export interface TaskDiscuss {
  probe: TaskDiscussProbe
  insight: string; insightZh: string
}
/** Manifest-sourced discuss metadata for AI generation */
export interface ManifestDiscuss {
  probe: { q: string; translate?: string }
  targetInsight?: string
  commonMisconceptions?: string[]
  scaffoldStrategies?: string[]
  insight: string; insightZh?: string
}
export interface InstructionView {
  title: string
  body: string
  keyPoints?: string[]
  confirmLabel?: string
}

export interface Task {
  id: number; name: string; subtitle: string; time: string
  focus: number[]; intro: string; exercise: TaskExercise
  discuss: TaskDiscuss; summary: string
  manifestDiscuss?: ManifestDiscuss
  instructionView?: InstructionView
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
  readingSteps: Array<{ idx: number; type?: string; label: string; labelEn?: string;
    displayName?: string; subtitle?: string; duration?: number; description?: string;
    focusParagraphs?: string[]; exerciseLabel?: string; summary?: string;
    discuss?: any; answerKey?: any; studentView?: any }>,
): Task[] {
  return readingSteps
    .filter(s => s.type === 'task' || (!s.type && s.answerKey))
    .sort((a, b) => a.idx - b.idx)
    .map((step, i) => ({
      id: i + 1,
      name: step.displayName || step.labelEn || step.label,
      subtitle: step.subtitle || '',
      time: step.duration ? `${step.duration} min` : '',
      focus: (step.focusParagraphs || []).map(pid => parseInt(pid.replace('p', ''))),
      intro: step.description || '',
      exercise: {
        type: (step.answerKey?.type || 'quiz') as TaskExercise['type'],
        label: step.exerciseLabel || '',
      },
      discuss: {
        probe: { q: step.discuss?.probe?.q || '', translate: step.discuss?.probe?.translate || '' },
        insight: step.discuss?.insight || '',
        insightZh: step.discuss?.insightZh || '',
      },
      summary: step.summary || '',
    }))
}

