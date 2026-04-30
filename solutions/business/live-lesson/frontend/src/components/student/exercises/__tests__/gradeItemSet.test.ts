import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { gradeItemSet, formatSubmitData } from '../gradeItemSet'

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

/* ═══ formatSubmitData ═══ */

describe('formatSubmitData', () => {
  it('quiz: wraps answers in array', () => {
    const result = formatSubmitData('quiz', { 0: 1, 1: 0 })
    expect(result).toEqual({ answers: [1, 0] })
  })

  it('match: wraps pairs in array', () => {
    const result = formatSubmitData('match', { 0: 2, 1: 0 })
    expect(result).toEqual({ pairs: [2, 0] })
  })

  it('order: passes order array', () => {
    const result = formatSubmitData('order', { order: [2, 0, 1] })
    expect(result).toEqual({ order: [2, 0, 1] })
  })

  it('stance: maps to position + evidence', () => {
    const result = formatSubmitData('stance', { stance: 'agree', evidence: ['e1'] })
    expect(result).toEqual({ position: 'agree', evidence: ['e1'] })
  })

  it('matrix: passes rows', () => {
    const result = formatSubmitData('matrix', { rows: [{ place: 'A', answer: 'x' }] })
    expect(result).toEqual({ rows: [{ place: 'A', answer: 'x' }] })
  })

  it('select-evidence: passes sections', () => {
    const result = formatSubmitData('select-evidence', { sections: { s1: 'explain' } })
    expect(result).toEqual({ sections: { s1: 'explain' } })
  })

  it('map: passes placements + reasons', () => {
    const result = formatSubmitData('map', { placements: { i1: { x: 0.5, y: 0.3 } }, reasons: { i1: 'because' } })
    expect(result).toEqual({ placements: { i1: { x: 0.5, y: 0.3 } }, reasons: { i1: 'because' } })
  })

  it('unknown type: passes through raw', () => {
    const result = formatSubmitData('unknown', { foo: 'bar' })
    expect(result).toEqual({ foo: 'bar' })
  })

  it('attemptCounts appended when provided', () => {
    const result = formatSubmitData('quiz', { 0: 1 }, { attemptCounts: { 0: 2 } })
    expect(result.attemptCounts).toEqual({ 0: 2 })
  })

  it('missing fields default to empty arrays/objects', () => {
    expect(formatSubmitData('order', {})).toEqual({ order: [] })
    expect(formatSubmitData('stance', {})).toEqual({ position: undefined, evidence: [] })
    expect(formatSubmitData('select-evidence', {})).toEqual({ sections: {} })
    expect(formatSubmitData('map', {})).toEqual({ placements: {}, reasons: {} })
  })
})
