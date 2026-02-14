import { describe, it, expect } from 'vitest'
import { formatDuration, formatDurationCompact } from '../src/utils/formatDuration'

describe('formatDuration', () => {
  it('should format 0 milliseconds as "0s"', () => {
    expect(formatDuration(0)).toBe('0s')
  })

  it('should format sub-second durations as "0s"', () => {
    expect(formatDuration(500)).toBe('0s')
    expect(formatDuration(999)).toBe('0s')
  })

  it('should format seconds without minutes', () => {
    expect(formatDuration(1000)).toBe('1s')
    expect(formatDuration(5000)).toBe('5s')
    expect(formatDuration(30000)).toBe('30s')
    expect(formatDuration(59000)).toBe('59s')
  })

  it('should format exact minutes without seconds', () => {
    expect(formatDuration(60000)).toBe('1m')
    expect(formatDuration(120000)).toBe('2m')
    expect(formatDuration(300000)).toBe('5m')
  })

  it('should format minutes with seconds', () => {
    expect(formatDuration(65000)).toBe('1m 5s')
    expect(formatDuration(90000)).toBe('1m 30s')
    expect(formatDuration(125000)).toBe('2m 5s')
  })

  it('should handle large durations', () => {
    expect(formatDuration(600000)).toBe('10m')
    expect(formatDuration(3665000)).toBe('61m 5s')
  })

  it('should handle negative values gracefully', () => {
    // Negative durations should be treated as 0
    expect(formatDuration(-1000)).toBe('0s')
    expect(formatDuration(-60000)).toBe('0s')
  })

  it('should handle edge cases', () => {
    expect(formatDuration(1000.9)).toBe('1s')  // Rounds down
    expect(formatDuration(59999)).toBe('59s')
    expect(formatDuration(60001)).toBe('1m')
  })
})

describe('formatDurationCompact', () => {
  it('should return null for 0 milliseconds', () => {
    expect(formatDurationCompact(0)).toBeNull()
  })

  it('should return null for negative values', () => {
    expect(formatDurationCompact(-100)).toBeNull()
    expect(formatDurationCompact(-1000)).toBeNull()
  })

  it('should return null for invalid values', () => {
    expect(formatDurationCompact(NaN)).toBeNull()
    expect(formatDurationCompact(Infinity)).toBeNull()
  })

  it('should format sub-second durations as milliseconds', () => {
    expect(formatDurationCompact(1)).toBe('1ms')
    expect(formatDurationCompact(50)).toBe('50ms')
    expect(formatDurationCompact(500)).toBe('500ms')
    expect(formatDurationCompact(999)).toBe('999ms')
  })

  it('should format >= 1000ms as decimal seconds', () => {
    expect(formatDurationCompact(1000)).toBe('1.0s')
    expect(formatDurationCompact(1500)).toBe('1.5s')
    expect(formatDurationCompact(2300)).toBe('2.3s')
    expect(formatDurationCompact(5000)).toBe('5.0s')
  })

  it('should handle large durations', () => {
    expect(formatDurationCompact(60000)).toBe('60.0s')  // 1 minute
    expect(formatDurationCompact(125000)).toBe('125.0s')  // 2m 5s
  })

  it('should format with one decimal place', () => {
    expect(formatDurationCompact(1234)).toBe('1.2s')  // Rounds to 1 decimal
    expect(formatDurationCompact(9999)).toBe('10.0s')  // Rounds up
  })
})

