import { describe, it, expect } from 'vitest'
import { resolveAdvance } from '../rcq-advance'

describe('resolveAdvance', () => {
  /* ═══ nextPartId present and found in local parts ═══ */

  it('advances to nextPartId when found in local parts', () => {
    const result = resolveAdvance(
      ['q1', 'q2', 'q3'],
      { q1: 'done', q2: 'work', q3: 'work' },
      'q2',
    )
    expect(result).toEqual({ type: 'advance', idx: 1 })
  })

  /* ═══ nextPartId present but NOT in local parts (split-phase) ═══ */

  it('returns done when nextPartId is outside local parts and all local parts done', () => {
    // practice-1 has [q1], backend returns nextPartId: "q2" (belongs to practice-2)
    const result = resolveAdvance(
      ['q1'],
      { q1: 'done' },
      'q2',
    )
    expect(result).toEqual({ type: 'done' })
  })

  it('returns noop when nextPartId is outside local parts but some local parts incomplete', () => {
    const result = resolveAdvance(
      ['q1', 'q2'],
      { q1: 'done', q2: 'work' },
      'q3',
    )
    expect(result).toEqual({ type: 'noop' })
  })

  /* ═══ no nextPartId ═══ */

  it('returns done when no nextPartId and all parts done', () => {
    const result = resolveAdvance(
      ['q1', 'q2'],
      { q1: 'done', q2: 'done' },
      undefined,
    )
    expect(result).toEqual({ type: 'done' })
  })

  it('advances to next incomplete part when no nextPartId', () => {
    const result = resolveAdvance(
      ['q1', 'q2', 'q3'],
      { q1: 'done', q2: 'done', q3: 'work' },
      undefined,
    )
    expect(result).toEqual({ type: 'advance', idx: 2 })
  })

  it('skips done parts and finds first incomplete', () => {
    const result = resolveAdvance(
      ['q1', 'q2', 'q3'],
      { q1: 'done', q2: 'wrong', q3: 'work' },
      undefined,
    )
    expect(result).toEqual({ type: 'advance', idx: 1 })
  })
})
