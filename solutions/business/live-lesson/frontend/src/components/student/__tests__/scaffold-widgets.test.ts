import { describe, it, expect } from 'vitest'
import { flattenCards, type ScaffoldHint } from '../ScaffoldPanel'
import { parseFormula } from '../scaffold/FormulaAnimation'

// ── flattenCards ──

describe('flattenCards', () => {
  it('returns empty for empty hints', () => {
    expect(flattenCards([])).toEqual([])
  })

  it('renders legacy hints (no steps) as single cards', () => {
    const hints: ScaffoldHint[] = [
      { level: 0, hintZh: 'hint1', canRetry: true },
      { level: 1, hintZh: 'hint2', canRetry: false },
    ]
    const cards = flattenCards(hints)
    expect(cards).toHaveLength(2)
    expect(cards[0].stepNum).toBe(1)
    expect(cards[0].content).toBeNull()
    expect(cards[0].isSolution).toBe(false)
    expect(cards[1].stepNum).toBe(2)
    expect(cards[1].isSolution).toBe(true) // last hint, canRetry=false, hints.length>1
  })

  it('flattens widget steps into multiple cards', () => {
    const hints: ScaffoldHint[] = [
      {
        level: 0,
        hintZh: 'fallback',
        canRetry: true,
        steps: [
          { title: '第1步·理思路', hintZh: 'markdown content' },
          { title: '第2步·列公式', widget: 'formula-animation', props: { formula: '(a+b)(m+n)', pairs: [] } },
        ],
      },
    ]
    const cards = flattenCards(hints)
    expect(cards).toHaveLength(2)
    expect(cards[0].stepNum).toBe(1)
    expect(cards[0].title).toBe('第1步·理思路')
    expect(cards[0].content?.hintZh).toBe('markdown content')
    expect(cards[1].stepNum).toBe(2)
    expect(cards[1].title).toBe('第2步·列公式')
    expect(cards[1].content?.widget).toBe('formula-animation')
  })

  it('numbers steps sequentially across multiple levels', () => {
    const hints: ScaffoldHint[] = [
      {
        level: 0,
        hintZh: 'fallback',
        canRetry: true,
        steps: [
          { title: 'Step A' },
          { title: 'Step B' },
        ],
      },
      {
        level: 1,
        hintZh: 'fallback',
        canRetry: false,
        steps: [
          { title: 'Step C', widget: 'solution-display', props: { lines: [] } },
        ],
      },
    ]
    const cards = flattenCards(hints)
    expect(cards).toHaveLength(3)
    expect(cards.map(c => c.stepNum)).toEqual([1, 2, 3])
    expect(cards[2].isSolution).toBe(true)
  })

  it('marks solution correctly for single-hint scenario', () => {
    const hints: ScaffoldHint[] = [
      { level: 0, hintZh: 'only hint', canRetry: false },
    ]
    const cards = flattenCards(hints)
    // Single hint never gets isSolution (needs hints.length > 1)
    expect(cards[0].isSolution).toBe(false)
  })

  it('handles mixed legacy and widget hints', () => {
    const hints: ScaffoldHint[] = [
      { level: 0, hintZh: 'legacy hint', canRetry: true },
      {
        level: 1,
        hintZh: 'fallback',
        canRetry: false,
        steps: [{ title: 'Widget step', widget: 'solution-display', props: { lines: [] } }],
      },
    ]
    const cards = flattenCards(hints)
    expect(cards).toHaveLength(2)
    expect(cards[0].content).toBeNull() // legacy
    expect(cards[1].content?.widget).toBe('solution-display') // widget
    expect(cards[1].isSolution).toBe(true)
  })
})

// ── parseFormula ──

describe('parseFormula', () => {
  it('parses (a+b)(m+n) correctly', () => {
    const result = parseFormula('(a+b)(m+n)')
    expect(result.vars).toEqual(['a', 'b', 'm', 'n'])
    expect(result.ops[0]).toBe('+')
    expect(result.ops[1]).toBe('+')
  })

  it('parses (x-y)(a+b) with minus sign', () => {
    const result = parseFormula('(x-y)(a+b)')
    expect(result.vars).toEqual(['x', 'y', 'a', 'b'])
    expect(result.ops[0]).toBe('−') // normalized to unicode minus
    expect(result.ops[1]).toBe('+')
  })

  it('parses formulas with multi-char vars like (2a+3b)(c-d)', () => {
    const result = parseFormula('(2a+3b)(c-d)')
    expect(result.vars).toEqual(['2a', '3b', 'c', 'd'])
  })

  it('returns fallback for unparseable formula', () => {
    const result = parseFormula('not a formula')
    expect(result.vars).toEqual(['a', 'b', 'm', 'n'])
    expect(result.ruleLabel).toBe('乘法分配律')
  })

  it('handles unicode minus (−) in formula', () => {
    const result = parseFormula('(a−b)(m+n)')
    expect(result.vars).toEqual(['a', 'b', 'm', 'n'])
    expect(result.ops[0]).toBe('−')
  })
})
