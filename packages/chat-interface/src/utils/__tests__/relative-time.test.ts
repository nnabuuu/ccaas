import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '../relative-time'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for invalid ISO', () => {
    expect(formatRelativeTime('not-a-date')).toBe('')
    expect(formatRelativeTime('')).toBe('')
  })

  it('returns empty string for future timestamps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
    expect(formatRelativeTime('2026-03-27T13:00:00Z')).toBe('')
    vi.useRealTimers()
  })

  it('returns 刚刚 for <60s ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:30Z'))
    expect(formatRelativeTime('2026-03-27T12:00:00Z')).toBe('刚刚')
    vi.useRealTimers()
  })

  it('returns minutes for 1-59 min ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:05:00Z'))
    expect(formatRelativeTime('2026-03-27T12:00:00Z')).toBe('5 分钟前')
    vi.useRealTimers()
  })

  it('returns hours for 1-23 hours ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T15:00:00Z'))
    expect(formatRelativeTime('2026-03-27T12:00:00Z')).toBe('3 小时前')
    vi.useRealTimers()
  })

  it('returns days for 1-29 days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-30T12:00:00Z'))
    expect(formatRelativeTime('2026-03-27T12:00:00Z')).toBe('3 天前')
    vi.useRealTimers()
  })

  it('returns months for 30+ days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-27T12:00:00Z'))
    expect(formatRelativeTime('2026-03-27T12:00:00Z')).toBe('3 个月前')
    vi.useRealTimers()
  })

  it('returns years for 365+ days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2028-03-27T12:00:00Z'))
    expect(formatRelativeTime('2026-03-27T12:00:00Z')).toBe('2 年前')
    vi.useRealTimers()
  })

  it('handles boundary: exactly 60 seconds', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:01:00Z'))
    expect(formatRelativeTime('2026-03-27T12:00:00Z')).toBe('1 分钟前')
    vi.useRealTimers()
  })
})
