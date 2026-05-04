import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cacheSubmission, getCachedSubmission, getSubmission } from '../useClassroom'

/* ── localStorage mock ── */

let store: Record<string, string> = {}

beforeEach(() => {
  store = {}
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v }),
    removeItem: vi.fn((k: string) => { delete store[k] }),
  })
})
afterEach(() => { vi.restoreAllMocks() })

/* ═══ cacheSubmission / getCachedSubmission ═══ */

describe('cacheSubmission + getCachedSubmission', () => {
  it('round-trips data and score through localStorage', () => {
    const data = { answers: [0, 1] }
    const score = { total: 2, byDimension: {} }
    cacheSubmission('ABC123', 1, data, score)
    const result = getCachedSubmission('ABC123', 1)
    expect(result).toEqual({ data, score })
  })

  it('returns null when no cache exists', () => {
    expect(getCachedSubmission('NONE', 0)).toBeNull()
  })

  it('returns null when localStorage has corrupt JSON', () => {
    store['sub:BAD:0'] = '{not json'
    expect(getCachedSubmission('BAD', 0)).toBeNull()
  })

  it('handles null score', () => {
    cacheSubmission('X', 2, { pairs: [1] }, null)
    const result = getCachedSubmission('X', 2)
    expect(result).toEqual({ data: { pairs: [1] }, score: null })
  })

  it('silently catches setItem quota errors', () => {
    ;(localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })
    expect(() => cacheSubmission('Q', 0, {}, null)).not.toThrow()
  })

  it('uses different keys for different steps', () => {
    cacheSubmission('S', 1, { a: 1 }, null)
    cacheSubmission('S', 2, { b: 2 }, null)
    expect(getCachedSubmission('S', 1)!.data).toEqual({ a: 1 })
    expect(getCachedSubmission('S', 2)!.data).toEqual({ b: 2 })
  })
})

/* ═══ getSubmission (cache-first + API fallback) ═══ */

describe('getSubmission', () => {
  it('returns cached submission without calling fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    cacheSubmission('CODE', 3, { order: [1, 0] }, { total: 1 })

    const result = await getSubmission('CODE', 'student-1', 3)
    expect(result).toEqual({ data: { order: [1, 0] }, score: { total: 1 } })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back to API when localStorage misses', async () => {
    const apiResponse = { data: { answers: [2] }, score: { total: 1 } }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    } as Response)

    const result = await getSubmission('CODE', 'stu-1', 1)
    expect(result).toEqual(apiResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/classroom/CODE/students/stu-1/submissions/1',
    )
  })

  it('backfills localStorage after successful API fetch', async () => {
    const apiResponse = { data: { pairs: [0] }, score: null }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    } as Response)

    await getSubmission('CODE', 'stu-1', 5)
    expect(getCachedSubmission('CODE', 5)).toEqual(apiResponse)
  })

  it('returns null when API responds with non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    const result = await getSubmission('CODE', 'stu-1', 9)
    expect(result).toBeNull()
  })

  it('returns null when fetch throws (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network error'))

    const result = await getSubmission('CODE', 'stu-1', 1)
    expect(result).toBeNull()
  })

  it('does not backfill cache when API returns null body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    } as Response)

    const result = await getSubmission('CODE', 'stu-1', 7)
    expect(result).toBeNull()
    expect(getCachedSubmission('CODE', 7)).toBeNull()
  })
})
