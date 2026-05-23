import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { gradeItemSet } from '../gradeItemSet'
// Side-effect import: registers all 11 plugins so `getExerciseType` returns
// the real implementations. The old per-type `formatSubmitData` switch has
// been split into per-plugin methods — this test file now exercises them
// through the registry instead of the deleted switch function.
import '../plugins/built-in'
import { getExerciseType } from '../plugins/registry'

// Stub window.parent.postMessage for reportAttempt
let origWindow: any
beforeEach(() => {
  origWindow = globalThis.window
  globalThis.window = { parent: { postMessage: vi.fn() }, location: { origin: '' } } as any
})
afterEach(() => {
  globalThis.window = origWindow
})

/* ═══ gradeItemSet ═══ */

describe('gradeItemSet', () => {
  const items = [{ correct: 1 }, { correct: 0 }, { correct: 2 }]
  const emptyPrev = { correctQs: new Set<number>(), attempts: {} as Record<number, any[]> }

  it('all correct → allDone=true', () => {
    const ans = { 0: 1, 1: 0, 2: 2 }
    const result = gradeItemSet(items, ans, emptyPrev, 1)
    expect(result.allDone).toBe(true)
    expect(result.correctQs.size).toBe(3)
    expect(result.wrongQs.size).toBe(0)
  })

  it('all wrong → allDone=false, wrongQs populated', () => {
    const ans = { 0: 0, 1: 1, 2: 0 }
    const result = gradeItemSet(items, ans, emptyPrev, 1)
    expect(result.allDone).toBe(false)
    expect(result.wrongQs.size).toBe(3)
    expect(result.correctQs.size).toBe(0)
  })

  it('partial: mix of correct and wrong', () => {
    const ans = { 0: 1, 1: 1, 2: 2 }
    const result = gradeItemSet(items, ans, emptyPrev, 1)
    expect(result.correctQs.has(0)).toBe(true)
    expect(result.wrongQs.has(1)).toBe(true)
    expect(result.correctQs.has(2)).toBe(true)
    expect(result.allDone).toBe(false)
  })

  it('already-correct items are skipped', () => {
    const prev = { correctQs: new Set([0]), attempts: { 0: [{ selected: 1, correct: 1, isCorrect: true, ts: 0 }] } }
    const ans = { 0: 0, 1: 0 } // tries to change Q0 to wrong, but Q0 already correct
    const result = gradeItemSet(items, ans, prev, 1)
    expect(result.correctQs.has(0)).toBe(true) // still correct
    expect(result.correctQs.has(1)).toBe(true)
  })

  it('undefined answers are skipped', () => {
    const ans = { 1: 0 } // only answering Q1
    const result = gradeItemSet(items, ans, emptyPrev, 1)
    expect(result.correctQs.size).toBe(1)
    expect(result.wrongQs.size).toBe(0)
    expect(result.allDone).toBe(false)
  })

  it('allDone requires all items answered correctly', () => {
    // Only 2 of 3 correct
    const ans = { 0: 1, 1: 0 }
    const result = gradeItemSet(items, ans, emptyPrev, 1)
    expect(result.allDone).toBe(false)
    expect(result.correctQs.size).toBe(2)
  })

  it('accumulates attempts across calls', () => {
    const first = gradeItemSet(items, { 0: 0 }, emptyPrev, 1) // wrong
    const second = gradeItemSet(items, { 0: 1 }, { correctQs: first.correctQs, attempts: first.attempts }, 1) // correct
    expect(second.attempts[0]).toHaveLength(2)
    expect(second.attempts[0][0].isCorrect).toBe(false)
    expect(second.attempts[0][1].isCorrect).toBe(true)
  })

  it('calls reportAttempt via postMessage', () => {
    gradeItemSet(items, { 0: 1 }, emptyPrev, 42)
    expect(globalThis.window.parent.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'student_attempt', taskId: 42, questionIdx: 0, isCorrect: true }),
      '',
    )
  })
})

/* ═══ plugin.formatSubmitData (per-type) ═══
 *
 * Exercises each plugin's `formatSubmitData` via the registry. The shape
 * each plugin emits is the wire format the backend graders expect, so this
 * test pins down per-type contracts after the §B8 migration removed the
 * monolithic gradeItemSet.formatSubmitData switch.
 */

function fmt(type: string, ans: Record<string, any>, state: Record<string, any> = {}): Record<string, any> {
  const plugin = getExerciseType(type)
  if (!plugin) throw new Error(`no plugin for "${type}"`)
  return plugin.formatSubmitData(ans, state)
}

describe('plugin.formatSubmitData', () => {
  it('quiz: numeric-key ans → answers array', () => {
    expect(fmt('quiz', { 0: 1, 1: 0 })).toEqual({ answers: [1, 0] })
  })

  it('match: numeric-key ans → pairs array', () => {
    expect(fmt('match', { 0: 2, 1: 0 })).toEqual({ pairs: [2, 0] })
  })

  it('order: passes order array', () => {
    expect(fmt('order', { order: [2, 0, 1] })).toEqual({ order: [2, 0, 1] })
  })

  it('stance: maps to position + evidence', () => {
    expect(fmt('stance', { stance: 'agree', evidence: ['e1'] })).toEqual({
      position: 'agree',
      evidence: ['e1'],
    })
  })

  it('matrix: reads rows from per-plugin state.matrixAns slot', () => {
    expect(fmt('matrix', {}, { matrixAns: { 0: { what: 'x', why: 'y' } } })).toEqual({
      rows: { 0: { what: 'x', why: 'y' } },
    })
  })

  it('select-evidence: forwards sections + firstAttemptSections', () => {
    expect(fmt('select-evidence', { sections: { s1: 'explain' } })).toEqual({
      sections: { s1: 'explain' },
    })
    expect(
      fmt('select-evidence', {
        sections: { s1: 'a' },
        firstAttemptSections: { s1: 'b' },
      }),
    ).toEqual({
      sections: { s1: 'a' },
      firstAttemptSections: { s1: 'b' },
    })
  })

  it('map: passes placements + reasons', () => {
    expect(
      fmt('map', { placements: { i1: { x: 0.5, y: 0.3 } }, reasons: { i1: 'because' } }),
    ).toMatchObject({
      placements: { i1: { x: 0.5, y: 0.3 } },
      reasons: { i1: 'because' },
    })
  })

  it('image-upload: forwards images', () => {
    expect(fmt('image-upload', { images: ['a.png'] })).toEqual({ images: ['a.png'] })
  })

  it('fill-blank: only string-valued keys forwarded as blanks', () => {
    // numeric / non-string ans values are filtered out (matches legacy behavior)
    expect(fmt('fill-blank', { s1_0: 'foo', s1_1: 42 as any })).toEqual({ blanks: { s1_0: 'foo' } })
  })

  it('guided-discovery: forwards steps map', () => {
    expect(fmt('guided-discovery', { steps: { s1: { answers: { a: 1 } } } })).toEqual({
      steps: { s1: { answers: { a: 1 } } },
    })
  })

  it('quiz: ignores non-numeric keys (firstAttemptAnswers etc.)', () => {
    // Plugin must filter to numeric keys so PracticePhase additions like
    // firstAttemptAnswers / questionTimes don't pollute the answers array.
    expect(fmt('quiz', { 0: 1, 1: 0, firstAttemptAnswers: [9, 9] })).toEqual({
      answers: [1, 0],
    })
  })

  it('quiz: attemptCounts forwarded when present on state', () => {
    expect(fmt('quiz', { 0: 1 }, { attemptCounts: { 0: 2 } })).toEqual({
      answers: [1],
      attemptCounts: { 0: 2 },
    })
  })

  it('missing fields default to empty arrays/objects', () => {
    expect(fmt('order', {})).toEqual({ order: [] })
    expect(fmt('stance', {})).toEqual({ position: undefined, evidence: [] })
    expect(fmt('select-evidence', {})).toEqual({ sections: {} })
    expect(fmt('map', {})).toMatchObject({ placements: {}, reasons: {} })
  })
})
