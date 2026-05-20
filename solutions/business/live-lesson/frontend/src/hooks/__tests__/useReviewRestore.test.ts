import { describe, it, expect, vi } from 'vitest'
import type { ReviewData, ReviewRestoreResult } from '../useReviewRestore'

describe('useReviewRestore contract', () => {
  it('parse receives ReviewData with data and checkItems', () => {
    const parseSpy = vi.fn<(r: ReviewData) => ReviewRestoreResult<{ x: number }>>(() => ({ state: { x: 1 }, allDone: true }))
    const reviewData: ReviewData = { data: { a: 1 }, checkItems: [{ idx: 0, correct: true }] }
    const result = parseSpy(reviewData)
    expect(parseSpy).toHaveBeenCalledWith(reviewData)
    expect(result.state).toEqual({ x: 1 })
    expect(result.allDone).toBe(true)
  })

  it('ReviewData shape matches CachedSubmission fields', () => {
    // Verify ReviewData matches the subset used from CachedSubmission
    const submission = {
      data: { answers: [1, 0] },
      score: { total: 100 },
      checkItems: [{ idx: 0, correct: true }, { idx: 1, correct: true }],
    }
    const reviewData: ReviewData = { data: submission.data, checkItems: submission.checkItems }
    expect(reviewData.data).toBe(submission.data)
    expect(reviewData.checkItems).toBe(submission.checkItems)
  })

  it('parse can return allDone=false for partial completion', () => {
    const parse = (review: ReviewData): ReviewRestoreResult<{ done: boolean }> => {
      const total = Object.keys(review.data).length
      return { state: { done: total > 2 }, allDone: total > 2 }
    }
    expect(parse({ data: { a: 1 } }).allDone).toBe(false)
    expect(parse({ data: { a: 1, b: 2, c: 3 } }).allDone).toBe(true)
  })

  it('ReviewData.checkItems is optional', () => {
    const reviewData: ReviewData = { data: { answers: [1] } }
    expect(reviewData.checkItems).toBeUndefined()
  })

  it('parse result state can be any shape', () => {
    type ComplexState = { ans: Record<string, number>; feedback: string | null; results: boolean[] }
    const parse = (_: ReviewData): ReviewRestoreResult<ComplexState> => ({
      state: { ans: { a: 1 }, feedback: 'good', results: [true, false] },
      allDone: true,
    })
    const result = parse({ data: {} })
    expect(result.state.ans).toEqual({ a: 1 })
    expect(result.state.feedback).toBe('good')
    expect(result.state.results).toEqual([true, false])
  })
})
