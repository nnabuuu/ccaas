import { describe, it, expect } from 'vitest'
import type { CheckItem, CheckResult, CachedSubmission } from '../../../../hooks/useClassroom'

/**
 * These tests verify the PracticePhase restore derivation logic:
 *   checkItems → restoredCheck → effective{CorrectQs,WrongQs,MatrixRowResults,MapFeedback,MapItemResults}
 *
 * The logic is inline in PracticePhase.tsx. We replicate the exact derivation
 * here as pure functions to test without rendering the full component.
 */

const toIdx = (v: unknown) => typeof v === 'number' ? v : parseInt(String(v), 10)

function buildRestoredCheck(
  exType: string,
  submission: CachedSubmission | null,
): CheckResult | undefined {
  if (!submission?.checkItems) return undefined
  return {
    type: exType,
    allCorrect: (submission.score as any)?.total === 100
      || submission.checkItems.every(it => it.correct),
    items: submission.checkItems,
  }
}

function deriveCorrectQs(restoredCheck: CheckResult | undefined): Set<number> {
  if (!restoredCheck?.items) return new Set()
  return new Set(restoredCheck.items.filter(it => it.correct).map(it => toIdx(it.idx)))
}

function deriveWrongQs(restoredCheck: CheckResult | undefined): Set<number> {
  if (!restoredCheck) return new Set()
  return new Set(restoredCheck.items.filter(it => !it.correct).map(it => toIdx(it.idx)))
}

function deriveMatrixRowResults(restoredCheck: CheckResult | undefined): Record<number, boolean> {
  if (!restoredCheck) return {}
  const r: Record<number, boolean> = {}
  restoredCheck.items.forEach(it => { r[toIdx(it.idx)] = it.correct })
  return r
}

function deriveMapFeedback(restoredCheck: CheckResult | undefined): string | null {
  if (!restoredCheck) return null
  return restoredCheck.items.find(it => it.idx === '_llm')?.hint ?? null
}

function deriveMapItemResults(restoredCheck: CheckResult | undefined): Record<string, { correct: boolean; hint?: string }> {
  if (!restoredCheck) return {}
  const r: Record<string, { correct: boolean; hint?: string }> = {}
  restoredCheck.items.forEach(it => {
    if (it.idx === '_llm') return
    r[it.idx as string] = { correct: it.correct, hint: it.hint }
  })
  return r
}

// ── Tests ──

describe('PracticePhase restore derivation', () => {
  describe('buildRestoredCheck', () => {
    it('returns undefined when checkItems is missing', () => {
      const sub: CachedSubmission = { data: { answers: [1] }, score: { total: 100 } }
      expect(buildRestoredCheck('quiz', sub)).toBeUndefined()
    })

    it('returns undefined for null submission', () => {
      expect(buildRestoredCheck('quiz', null)).toBeUndefined()
    })

    it('derives allCorrect from score.total === 100', () => {
      const sub: CachedSubmission = {
        data: { answers: [1, 0] },
        score: { total: 100 },
        checkItems: [{ idx: 0, correct: true }, { idx: 1, correct: true }],
      }
      const check = buildRestoredCheck('quiz', sub)!
      expect(check.allCorrect).toBe(true)
      expect(check.type).toBe('quiz')
    })

    it('derives allCorrect from checkItems when score is null', () => {
      const sub: CachedSubmission = {
        data: { answers: [1, 0] },
        score: null,
        checkItems: [{ idx: 0, correct: true }, { idx: 1, correct: true }],
      }
      expect(buildRestoredCheck('quiz', sub)!.allCorrect).toBe(true)
    })

    it('allCorrect is false when any item is wrong and score is null', () => {
      const sub: CachedSubmission = {
        data: {},
        score: null,
        checkItems: [{ idx: 0, correct: true }, { idx: 1, correct: false }],
      }
      expect(buildRestoredCheck('quiz', sub)!.allCorrect).toBe(false)
    })

    it('allCorrect true from score even if checkItems has wrong items (score wins)', () => {
      // This can happen if checkItems was cached from a check attempt but score
      // was later updated by the submit endpoint
      const sub: CachedSubmission = {
        data: {},
        score: { total: 100 },
        checkItems: [{ idx: 0, correct: false }],
      }
      expect(buildRestoredCheck('quiz', sub)!.allCorrect).toBe(true)
    })
  })

  describe('quiz / match — correctQs and wrongQs', () => {
    it('separates correct and wrong question indices', () => {
      const items: CheckItem[] = [
        { idx: 0, correct: true },
        { idx: 1, correct: false, hint: 'Try again' },
        { idx: 2, correct: true },
      ]
      const check: CheckResult = { type: 'quiz', allCorrect: false, items }

      expect(deriveCorrectQs(check)).toEqual(new Set([0, 2]))
      expect(deriveWrongQs(check)).toEqual(new Set([1]))
    })

    it('all correct → no wrong questions', () => {
      const items: CheckItem[] = [
        { idx: 0, correct: true },
        { idx: 1, correct: true },
      ]
      const check: CheckResult = { type: 'match', allCorrect: true, items }

      expect(deriveCorrectQs(check)).toEqual(new Set([0, 1]))
      expect(deriveWrongQs(check)).toEqual(new Set())
    })

    it('handles string idx (e.g. from stance) via toIdx', () => {
      const items: CheckItem[] = [
        { idx: 'position' as unknown as number, correct: true },
        { idx: 'evidence' as unknown as number, correct: false },
      ]
      const check: CheckResult = { type: 'stance', allCorrect: false, items }

      // String indices become NaN via parseInt — stance doesn't use correctQs/wrongQs
      // in production, but the function still works without crashing
      expect(deriveWrongQs(check).size).toBe(1)
    })
  })

  describe('matrix — rowResults', () => {
    it('maps row indices to correct/wrong', () => {
      const items: CheckItem[] = [
        { idx: 1, correct: true },
        { idx: 2, correct: false, hint: 'Row2 hint' },
      ]
      const check: CheckResult = { type: 'matrix', allCorrect: false, items }

      expect(deriveMatrixRowResults(check)).toEqual({ 1: true, 2: false })
    })

    it('returns empty object for undefined check', () => {
      expect(deriveMatrixRowResults(undefined)).toEqual({})
    })
  })

  describe('map — feedback and itemResults', () => {
    const mapItems: CheckItem[] = [
      { idx: 'a', correct: true, hint: 'Well placed' },
      { idx: 'b', correct: false, hint: 'Try repositioning' },
      { idx: '_llm' as unknown as number, correct: true, hint: 'Overall good work' },
    ]
    const check: CheckResult = { type: 'map', allCorrect: false, items: mapItems }

    it('extracts _llm feedback', () => {
      expect(deriveMapFeedback(check)).toBe('Overall good work')
    })

    it('returns null when no _llm item', () => {
      const noLlm: CheckResult = { type: 'map', allCorrect: true, items: [{ idx: 'a', correct: true }] }
      expect(deriveMapFeedback(noLlm)).toBeNull()
    })

    it('builds per-item results excluding _llm', () => {
      const results = deriveMapItemResults(check)
      expect(results).toEqual({
        a: { correct: true, hint: 'Well placed' },
        b: { correct: false, hint: 'Try repositioning' },
      })
      expect(results['_llm']).toBeUndefined()
    })

    it('returns empty object for undefined check', () => {
      expect(deriveMapItemResults(undefined)).toEqual({})
    })
  })

  describe('end-to-end: submission → restore derivation', () => {
    it('quiz with partial score restores correct feedback state', () => {
      const sub: CachedSubmission = {
        data: { answers: [1, 0, 2] },
        score: { total: 67 },
        checkItems: [
          { idx: 0, correct: true },
          { idx: 1, correct: false, hint: 'Review paragraph 2', hintZh: '复习第二段' },
          { idx: 2, correct: true },
        ],
      }

      const check = buildRestoredCheck('quiz', sub)!
      expect(check.allCorrect).toBe(false)
      expect(deriveCorrectQs(check)).toEqual(new Set([0, 2]))
      expect(deriveWrongQs(check)).toEqual(new Set([1]))
    })

    it('map with LLM feedback restores full state', () => {
      const sub: CachedSubmission = {
        data: { placements: { x: { x: 0.5, y: 0.5 } }, reasons: { x: 'because...' } },
        score: { total: 80 },
        checkItems: [
          { idx: 'x' as unknown as number, correct: true, hint: 'Good placement' },
          { idx: 'y' as unknown as number, correct: false, hint: 'Reconsider' },
          { idx: '_llm' as unknown as number, correct: true, hint: 'Nice effort overall' },
        ],
      }

      const check = buildRestoredCheck('map', sub)!
      expect(check.allCorrect).toBe(false)
      expect(deriveMapFeedback(check)).toBe('Nice effort overall')
      const itemResults = deriveMapItemResults(check)
      expect(itemResults.x).toEqual({ correct: true, hint: 'Good placement' })
      expect(itemResults.y).toEqual({ correct: false, hint: 'Reconsider' })
    })

    it('100% quiz with null score still derives allCorrect from items', () => {
      const sub: CachedSubmission = {
        data: { answers: [1, 0] },
        score: null,
        checkItems: [
          { idx: 0, correct: true },
          { idx: 1, correct: true },
        ],
      }

      const check = buildRestoredCheck('quiz', sub)!
      expect(check.allCorrect).toBe(true)
      expect(deriveCorrectQs(check)).toEqual(new Set([0, 1]))
      expect(deriveWrongQs(check)).toEqual(new Set())
    })
  })
})
