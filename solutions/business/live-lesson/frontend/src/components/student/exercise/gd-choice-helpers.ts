import type { GdChoiceItem } from '../task-data'

export type ChoiceStatus = 'correct' | 'wrong' | null

/**
 * Evaluate whether a selected option matches the correct answer.
 * Returns null if no correct answer is defined (server-only grading).
 */
export function evaluateChoice(correctAnswer: number | undefined, selected: number): ChoiceStatus {
  if (correctAnswer === undefined) return null
  return selected === correctAnswer ? 'correct' : 'wrong'
}

/**
 * Apply a choice selection to the current status map and check step completion.
 * Returns the updated statuses and whether all choices in the step are correct.
 */
export function applyChoiceSelection(
  currentStatuses: Record<string, ChoiceStatus>,
  choices: Pick<GdChoiceItem, 'id' | 'correct'>[],
  choiceId: string,
  selectedIdx: number,
): { updated: Record<string, ChoiceStatus>; allCorrect: boolean } {
  const choice = choices.find(c => c.id === choiceId)
  const status = evaluateChoice(choice?.correct, selectedIdx)

  if (status === null) {
    return { updated: currentStatuses, allCorrect: false }
  }

  const updated = { ...currentStatuses, [choiceId]: status }
  const allCorrect = choices.every(c => updated[c.id] === 'correct')

  return { updated, allCorrect }
}
