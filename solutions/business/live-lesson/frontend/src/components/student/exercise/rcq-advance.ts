type PartPhase = 'work' | 'wrong' | 'retry' | 'wrong2' | 'done'

export type AdvanceAction =
  | { type: 'advance'; idx: number }
  | { type: 'done' }
  | { type: 'noop' }

/**
 * Pure decision logic for RCQ part advancement after a successful submit/pass.
 *
 * Returns which action the component should take:
 * - advance: move to part at idx
 * - done: all parts in this phase complete → call onDone()
 * - noop: nothing to do (should not happen in practice)
 */
export function resolveAdvance(
  partIds: string[],
  updatedPhases: Record<string, PartPhase>,
  nextPartId: string | null | undefined,
): AdvanceAction {
  if (nextPartId) {
    const nextIdx = partIds.indexOf(nextPartId)
    if (nextIdx >= 0) {
      return { type: 'advance', idx: nextIdx }
    }
    if (partIds.every(id => updatedPhases[id] === 'done')) {
      return { type: 'done' }
    }
    return { type: 'noop' }
  }

  if (partIds.every(id => updatedPhases[id] === 'done')) {
    return { type: 'done' }
  }

  const nextIncomplete = partIds.findIndex(id => updatedPhases[id] !== 'done')
  if (nextIncomplete >= 0) {
    return { type: 'advance', idx: nextIncomplete }
  }

  return { type: 'noop' }
}
