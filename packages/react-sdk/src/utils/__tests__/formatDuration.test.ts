import { describe, it, expect } from 'vitest'
import { formatDuration } from '../formatDuration'

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
