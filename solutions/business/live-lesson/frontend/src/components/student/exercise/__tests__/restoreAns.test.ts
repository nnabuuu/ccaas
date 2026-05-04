import { describe, it, expect } from 'vitest'
import { restoreAns } from '../PracticePhase'

describe('restoreAns', () => {
  /* ── quiz ── */
  describe('quiz', () => {
    it('converts answers array to indexed record', () => {
      expect(restoreAns('quiz', { answers: [0, 2, 1] }))
        .toEqual({ 0: 0, 1: 2, 2: 1 })
    })

    it('returns empty record when answers is missing', () => {
      expect(restoreAns('quiz', {})).toEqual({})
    })
  })

  /* ── match ── */
  describe('match', () => {
    it('converts pairs array to indexed record', () => {
      expect(restoreAns('match', { pairs: [1, 0, 2] }))
        .toEqual({ 0: 1, 1: 0, 2: 2 })
    })

    it('returns empty record when pairs is missing', () => {
      expect(restoreAns('match', {})).toEqual({})
    })
  })

  /* ── order ── */
  describe('order', () => {
    it('wraps order array in object', () => {
      expect(restoreAns('order', { order: [2, 0, 1, 3] }))
        .toEqual({ order: [2, 0, 1, 3] })
    })

    it('defaults to empty array when order is missing', () => {
      expect(restoreAns('order', {})).toEqual({ order: [] })
    })
  })

  /* ── stance ── */
  describe('stance', () => {
    it('maps position → stance and preserves evidence', () => {
      expect(restoreAns('stance', { position: 2, evidence: [0, 2] }))
        .toEqual({ stance: 2, evidence: [0, 2] })
    })

    it('defaults evidence to empty array', () => {
      expect(restoreAns('stance', { position: 1 }))
        .toEqual({ stance: 1, evidence: [] })
    })

    it('preserves position: 0 (falsy but valid)', () => {
      expect(restoreAns('stance', { position: 0, evidence: [1] }))
        .toEqual({ stance: 0, evidence: [1] })
    })
  })

  /* ── map ── */
  describe('map', () => {
    it('preserves placements and reasons', () => {
      const data = {
        placements: { item1: { x: 0.5, y: 0.3 } },
        reasons: { item1: 'because...' },
      }
      expect(restoreAns('map', data))
        .toEqual({ placements: data.placements, reasons: data.reasons })
    })

    it('defaults to empty objects when fields are missing', () => {
      expect(restoreAns('map', {}))
        .toEqual({ placements: {}, reasons: {} })
    })
  })

  /* ── matrix ── */
  describe('matrix', () => {
    it('returns data as-is (matrix state handled by effectiveMatrixAns)', () => {
      const data = { rows: { 0: { what: 'a', why: 'b' } } }
      expect(restoreAns('matrix', data)).toBe(data)
    })
  })

  /* ── select-evidence ── */
  describe('select-evidence', () => {
    it('returns empty object (review mode uses placeholder UI)', () => {
      expect(restoreAns('select-evidence', { sections: { s1: 'describe' } }))
        .toEqual({})
    })
  })

  /* ── edge cases ── */
  describe('edge cases', () => {
    it('returns empty object for null-ish data', () => {
      expect(restoreAns('quiz', null as unknown as Record<string, unknown>)).toEqual({})
    })

    it('returns data as-is for unknown exercise type', () => {
      const data = { custom: 'value' }
      expect(restoreAns('unknown-type', data)).toEqual(data)
    })
  })
})
