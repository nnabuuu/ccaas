import { describe, it, expect } from 'vitest'
import { parseStepAnchor, EMPTY_SIGNAL } from './scroll-anchor'

describe('parseStepAnchor', () => {
  describe('simple step-N form (idx only)', () => {
    it('parses well-formed step-N anchors as { idx, id: null }', () => {
      expect(parseStepAnchor('step-1')).toEqual({ idx: 1, id: null })
      expect(parseStepAnchor('step-7')).toEqual({ idx: 7, id: null })
      expect(parseStepAnchor('step-99')).toEqual({ idx: 99, id: null })
    })
  })

  describe('dual step-N|<id> form', () => {
    it('parses idx + id when both are present', () => {
      expect(parseStepAnchor('step-1|s-abc')).toEqual({
        idx: 1,
        id: 's-abc',
      })
      // Real stepId shape: `s-${Date.now()}-${counter}`
      expect(parseStepAnchor('step-3|s-1700000001-3')).toEqual({
        idx: 3,
        id: 's-1700000001-3',
      })
    })

    it('accepts ids with embedded dots, slashes, or odd chars (LLM may emit anything)', () => {
      expect(parseStepAnchor('step-1|abc.def/ghi')).toEqual({
        idx: 1,
        id: 'abc.def/ghi',
      })
    })

    it('treats everything after the first pipe as the id (multi-pipe locks greedy capture)', () => {
      // Real step ids never contain pipes (shape: `s-${Date.now()}-N`),
      // so this case won't match any DOM element and we silently
      // fall back to idx. The test pins behavior: don't try to be
      // clever about parsing — first pipe wins as the separator.
      expect(parseStepAnchor('step-1|s-abc|extra')).toEqual({
        idx: 1,
        id: 's-abc|extra',
      })
    })

    it('collapses trailing pipe with empty id to id: null', () => {
      expect(parseStepAnchor('step-1|')).toEqual({ idx: 1, id: null })
    })
  })

  describe('rejected forms', () => {
    it('returns null for null / undefined / empty', () => {
      expect(parseStepAnchor(null)).toBeNull()
      expect(parseStepAnchor(undefined)).toBeNull()
      expect(parseStepAnchor('')).toBeNull()
    })

    it('rejects 0 and missing-digits', () => {
      expect(parseStepAnchor('step-0')).toBeNull()
      expect(parseStepAnchor('step-')).toBeNull()
      expect(parseStepAnchor('step')).toBeNull()
    })

    it('rejects non-numeric idx', () => {
      expect(parseStepAnchor('step-abc')).toBeNull()
      expect(parseStepAnchor('step-1.5')).toBeNull()
    })

    it('rejects trailing junk between idx and pipe', () => {
      expect(parseStepAnchor('step-1abc')).toBeNull()
      expect(parseStepAnchor('step-1 |s-abc')).toBeNull()
    })

    it('rejects plan-style anchors (no step- prefix)', () => {
      expect(parseStepAnchor('r-1.2.3')).toBeNull()
      // Bare id without `step-N|` prefix is ambiguous on purpose —
      // an audit could emit such a form by mistake; we silently
      // ignore rather than guessing.
      expect(parseStepAnchor('s-abc')).toBeNull()
      expect(parseStepAnchor('|s-abc')).toBeNull()
    })

    it('rejects surrounding whitespace (strict match)', () => {
      expect(parseStepAnchor(' step-1')).toBeNull()
      expect(parseStepAnchor('step-1 ')).toBeNull()
    })
  })
})

describe('EMPTY_SIGNAL', () => {
  it('exposes a stable null-anchor sentinel for initial state', () => {
    expect(EMPTY_SIGNAL.anchor).toBeNull()
    expect(EMPTY_SIGNAL.nonce).toBe(0)
  })
})
