import { describe, it, expect } from 'vitest'
import {
  formatTime,
  computeUrgency,
  determineInitialPhase,
  detectFallbackOnRestore,
  deriveCompletionType,
  filterMessagesForApi,
  findNewHits,
  mcOptionClass,
} from '../discuss-helpers'

// ── formatTime ──

describe('formatTime', () => {
  it('formats 0 as "0:00"', () => {
    expect(formatTime(0)).toBe('0:00')
  })

  it('formats 65 as "1:05"', () => {
    expect(formatTime(65)).toBe('1:05')
  })

  it('formats 599 as "9:59"', () => {
    expect(formatTime(599)).toBe('9:59')
  })

  it('formats 3600 as "60:00"', () => {
    expect(formatTime(3600)).toBe('60:00')
  })
})

// ── computeUrgency ──

describe('computeUrgency', () => {
  it('returns green when urgency < 0.5', () => {
    const { urgency, color } = computeUrgency(1, 6, 30, 300)
    expect(urgency).toBeLessThan(0.5)
    expect(color).toBe('var(--green)')
  })

  it('returns amber when urgency >= 0.5 and < 0.8', () => {
    const { urgency, color } = computeUrgency(3, 6, 30, 300)
    expect(urgency).toBeGreaterThanOrEqual(0.5)
    expect(urgency).toBeLessThan(0.8)
    expect(color).toBe('var(--amber)')
  })

  it('returns red when urgency >= 0.8', () => {
    const { urgency, color } = computeUrgency(5, 6, 30, 300)
    expect(urgency).toBeGreaterThanOrEqual(0.8)
    expect(color).toBe('var(--red)')
  })

  it('uses max of round ratio and time ratio', () => {
    // time ratio (250/300 = 0.833) dominates over round ratio (1/6 = 0.167)
    const { urgency } = computeUrgency(1, 6, 250, 300)
    expect(urgency).toBeCloseTo(250 / 300)
  })
})

// ── determineInitialPhase ──

describe('determineInitialPhase', () => {
  it('returns done when isRevisit is true', () => {
    expect(determineInitialPhase(true, false)).toBe('done')
  })

  it('returns done when goalReached is true', () => {
    expect(determineInitialPhase(false, true)).toBe('done')
  })

  it('returns chat when both are false', () => {
    expect(determineInitialPhase(false, false)).toBe('chat')
  })
})

// ── detectFallbackOnRestore ──

describe('detectFallbackOnRestore', () => {
  it('returns fallback + rounds when studentMsgCount >= maxRounds', () => {
    const result = detectFallbackOnRestore({
      studentMsgCount: 6,
      maxRounds: 6,
      maxTimeSeconds: 300,
    })
    expect(result).toEqual({ phase: 'fallback', reason: 'rounds' })
  })

  it('returns fallback + time when elapsed >= maxTimeSeconds', () => {
    const now = Date.now()
    const startedAt = new Date(now - 400_000).toISOString() // 400s ago
    const result = detectFallbackOnRestore({
      studentMsgCount: 2,
      maxRounds: 6,
      startedAt,
      goalReached: false,
      maxTimeSeconds: 300,
      now,
    })
    expect(result).toEqual({ phase: 'fallback', reason: 'time' })
  })

  it('returns rounds when both exceeded (rounds checked first)', () => {
    const now = Date.now()
    const startedAt = new Date(now - 400_000).toISOString()
    const result = detectFallbackOnRestore({
      studentMsgCount: 6,
      maxRounds: 6,
      startedAt,
      goalReached: false,
      maxTimeSeconds: 300,
      now,
    })
    expect(result).toEqual({ phase: 'fallback', reason: 'rounds' })
  })

  it('returns chat when neither exceeded', () => {
    const now = Date.now()
    const startedAt = new Date(now - 100_000).toISOString()
    const result = detectFallbackOnRestore({
      studentMsgCount: 2,
      maxRounds: 6,
      startedAt,
      goalReached: false,
      maxTimeSeconds: 300,
      now,
    })
    expect(result).toEqual({ phase: 'chat', reason: '' })
  })

  it('returns chat when no startedAt is provided', () => {
    const result = detectFallbackOnRestore({
      studentMsgCount: 2,
      maxRounds: 6,
      maxTimeSeconds: 300,
    })
    expect(result).toEqual({ phase: 'chat', reason: '' })
  })

  it('returns chat when goalReached is true even if time exceeded', () => {
    const now = Date.now()
    const result = detectFallbackOnRestore({
      studentMsgCount: 2,
      maxRounds: 6,
      startedAt: new Date(now - 400_000).toISOString(),
      goalReached: true,
      maxTimeSeconds: 300,
      now,
    })
    expect(result).toEqual({ phase: 'chat', reason: '' })
  })
})

// ── deriveCompletionType ──

describe('deriveCompletionType', () => {
  it('returns goal_reached when goalReached is true', () => {
    expect(deriveCompletionType(true, '')).toBe('goal_reached')
  })

  it('returns fallback_rounds for rounds reason', () => {
    expect(deriveCompletionType(false, 'rounds')).toBe('fallback_rounds')
  })

  it('returns fallback_time for time reason', () => {
    expect(deriveCompletionType(false, 'time')).toBe('fallback_time')
  })

  it('defaults to fallback_time when reason is empty and goalReached is false', () => {
    expect(deriveCompletionType(false, '')).toBe('fallback_time')
  })
})

// ── filterMessagesForApi ──

describe('filterMessagesForApi', () => {
  it('strips notification messages', () => {
    const msgs = [
      { role: 'ai', text: 'Hello' },
      { role: 'notification', text: 'Point 1 discovered' },
      { role: 'student', text: 'Hi' },
    ]
    const result = filterMessagesForApi(msgs)
    expect(result).toHaveLength(2)
    expect(result.every(m => (m.role as string) !== 'notification')).toBe(true)
  })

  it('keeps ai and student messages', () => {
    const msgs = [
      { role: 'ai', text: 'Q1' },
      { role: 'student', text: 'A1' },
    ]
    const result = filterMessagesForApi(msgs)
    expect(result).toEqual([
      { role: 'ai', text: 'Q1' },
      { role: 'student', text: 'A1' },
    ])
  })

  it('only retains role and text fields', () => {
    const msgs = [
      { role: 'student', text: 'Hi', highlight: { score: 5, gist: 'g' }, extra: true },
    ]
    const result = filterMessagesForApi(msgs)
    expect(result[0]).toEqual({ role: 'student', text: 'Hi' })
    expect('highlight' in result[0]).toBe(false)
  })
})

// ── findNewHits ──

describe('findNewHits', () => {
  it('returns all hit items when prev is empty', () => {
    const prev = new Set<string>()
    const clusters = [
      { id: 'tp_1_1', hit: true },
      { id: 'tp_1_2', hit: true },
      { id: 'tp_2_1', hit: false },
    ]
    const result = findNewHits(prev, clusters)
    expect(result).toEqual([{ id: 'tp_1_1', hit: true }, { id: 'tp_1_2', hit: true }])
  })

  it('returns only truly new hits when prev has some', () => {
    const prev = new Set(['tp_1_1'])
    const clusters = [
      { id: 'tp_1_1', hit: true },
      { id: 'tp_1_2', hit: true },
      { id: 'tp_2_1', hit: false },
    ]
    const result = findNewHits(prev, clusters)
    expect(result).toEqual([{ id: 'tp_1_2', hit: true }])
  })

  it('excludes items where hit is false', () => {
    const prev = new Set<string>()
    const clusters = [
      { id: 'tp_1_1', hit: false },
      { id: 'tp_1_2', hit: false },
    ]
    const result = findNewHits(prev, clusters)
    expect(result).toEqual([])
  })
})

// ── mcOptionClass ──

describe('mcOptionClass', () => {
  it('returns base class when not selected and not submitted', () => {
    expect(mcOptionClass(0, null, false, 2)).toBe('sd-mc-option')
  })

  it('appends selected when index matches selection and not submitted', () => {
    expect(mcOptionClass(1, 1, false, 2)).toBe('sd-mc-option selected')
  })

  it('appends correct when submitted and index is correct', () => {
    expect(mcOptionClass(2, 1, true, 2)).toBe('sd-mc-option correct')
  })

  it('appends wrong when submitted, index is selected but not correct', () => {
    expect(mcOptionClass(1, 1, true, 2)).toBe('sd-mc-option wrong')
  })

  it('returns base class for unselected wrong option when submitted', () => {
    expect(mcOptionClass(0, 1, true, 2)).toBe('sd-mc-option')
  })
})
