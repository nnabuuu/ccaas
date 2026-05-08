import { describe, it, expect } from 'vitest'
import {
  pct,
  pctNum,
  severityColor,
  severityBg,
  scoreColor,
  formatTime,
  coordToPct,
  deviationColor,
  qColor,
  qBg,
  qLabel,
  statusLevel,
} from '../observe-helpers'

// ── pct / pctNum ──

describe('pct', () => {
  it('formats percentage string', () => {
    expect(pct(3, 10)).toBe('30%')
  })

  it('returns 0% when total is 0', () => {
    expect(pct(5, 0)).toBe('0%')
  })

  it('rounds to nearest integer', () => {
    expect(pct(1, 3)).toBe('33%')
  })
})

describe('pctNum', () => {
  it('returns numeric percentage', () => {
    expect(pctNum(1, 4)).toBe(25)
  })

  it('returns 0 when total is 0', () => {
    expect(pctNum(5, 0)).toBe(0)
  })
})

// ── severityColor / severityBg ──

describe('severityColor', () => {
  it.each([
    ['high', 'var(--red)'],
    ['medium', 'var(--amber)'],
    ['low', 'var(--t3)'],
    ['unknown', 'var(--t3)'],
  ])('maps %s → %s', (input, expected) => {
    expect(severityColor(input)).toBe(expected)
  })
})

describe('severityBg', () => {
  it.each([
    ['high', 'var(--red-soft)'],
    ['medium', 'var(--amber-soft)'],
    ['low', 'var(--surface2)'],
    ['unknown', 'var(--surface2)'],
  ])('maps %s → %s', (input, expected) => {
    expect(severityBg(input)).toBe(expected)
  })
})

// ── scoreColor ──

describe('scoreColor', () => {
  it('returns green for >= 80', () => {
    expect(scoreColor(80)).toBe('var(--green)')
    expect(scoreColor(100)).toBe('var(--green)')
  })

  it('returns amber for >= 50', () => {
    expect(scoreColor(50)).toBe('var(--amber)')
    expect(scoreColor(79)).toBe('var(--amber)')
  })

  it('returns red for < 50', () => {
    expect(scoreColor(49)).toBe('var(--red)')
    expect(scoreColor(0)).toBe('var(--red)')
  })
})

// ── formatTime ──

describe('formatTime', () => {
  it('formats < 60s', () => {
    expect(formatTime(45)).toBe('45s')
  })

  it('formats >= 60s as m:ss', () => {
    expect(formatTime(90)).toBe('1:30')
  })

  it('rounds fractional seconds', () => {
    expect(formatTime(30.7)).toBe('31s')
  })

  it('handles exact minutes', () => {
    expect(formatTime(120)).toBe('2:00')
  })
})

// ── coordToPct ──

describe('coordToPct', () => {
  it('maps -1 → 0', () => {
    expect(coordToPct(-1)).toBe(0)
  })

  it('maps 0 → 50', () => {
    expect(coordToPct(0)).toBe(50)
  })

  it('maps 1 → 100', () => {
    expect(coordToPct(1)).toBe(100)
  })
})

// ── deviationColor ──

describe('deviationColor', () => {
  it('returns green for < 0.3', () => {
    expect(deviationColor(0.1)).toBe('var(--green-dot)')
  })

  it('returns blue for 0.3-0.6', () => {
    expect(deviationColor(0.4)).toBe('var(--blue)')
  })

  it('returns red for >= 0.6', () => {
    expect(deviationColor(0.8)).toBe('var(--red)')
  })
})

// ── qColor / qBg / qLabel ──

describe('qColor', () => {
  it.each([
    [0, 'var(--t3)'],
    [1, 'var(--amber)'],
    [2, 'var(--blue)'],
    [3, 'var(--green)'],
  ])('maps %i → %s', (input, expected) => {
    expect(qColor(input)).toBe(expected)
  })

  it('falls back to index 0 for out-of-range', () => {
    expect(qColor(5)).toBe('var(--t3)')
  })
})

describe('qBg', () => {
  it.each([
    [0, 'var(--surface2)'],
    [1, 'var(--amber-soft)'],
    [2, 'var(--blue-soft)'],
    [3, 'var(--green-soft)'],
  ])('maps %i → %s', (input, expected) => {
    expect(qBg(input)).toBe(expected)
  })
})

describe('qLabel', () => {
  it.each([
    [0, '未填'],
    [1, '基本'],
    [2, '良好'],
    [3, '优秀'],
  ])('maps %i → %s', (input, expected) => {
    expect(qLabel(input)).toBe(expected)
  })

  it('falls back to 未填 for out-of-range', () => {
    expect(qLabel(99)).toBe('未填')
  })
})

// ── statusLevel ──

describe('statusLevel', () => {
  it('returns green for >= 90', () => {
    const result = statusLevel(90)
    expect(result.level).toBe('green')
    expect(result.title).toBe('表现优秀')
  })

  it('returns blue for >= 70', () => {
    expect(statusLevel(70).level).toBe('blue')
  })

  it('returns amber for >= 40', () => {
    expect(statusLevel(40).level).toBe('amber')
  })

  it('returns red for < 40', () => {
    expect(statusLevel(39).level).toBe('red')
    expect(statusLevel(39).title).toBe('需重点关注')
  })
})
