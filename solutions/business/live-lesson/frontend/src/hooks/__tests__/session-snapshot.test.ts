import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchSessionSnapshot, getCachedSubmission } from '../useClassroom'

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

/* ═══ fetchSessionSnapshot ═══ */

describe('fetchSessionSnapshot', () => {
  it('returns progress and submissions on success', async () => {
    const apiResponse = {
      progress: { currentTask: 2, currentPhase: 'practice' },
      submissions: {
        1: { data: { answers: [1, 0] }, score: { total: 100 } },
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    } as Response)

    const result = await fetchSessionSnapshot('ABC123', 'stu-1')
    expect(result).toEqual(apiResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/classroom/ABC123/students/stu-1/snapshot',
    )
  })

  it('caches submissions to localStorage on success', async () => {
    const apiResponse = {
      progress: { currentTask: 2, currentPhase: 'discuss' },
      submissions: {
        1: { data: { answers: [1, 0] }, score: { total: 100 } },
        3: { data: { pairs: ['a', 'b'] }, score: null },
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    } as Response)

    await fetchSessionSnapshot('CODE', 'stu-1')
    expect(getCachedSubmission('CODE', 1)).toEqual({ data: { answers: [1, 0] }, score: { total: 100 } })
    expect(getCachedSubmission('CODE', 3)).toEqual({ data: { pairs: ['a', 'b'] }, score: null })
  })

  it('returns null when API responds with non-ok status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    const result = await fetchSessionSnapshot('CODE', 'stu-1')
    expect(result).toBeNull()
  })

  it('returns null when fetch throws (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network error'))

    const result = await fetchSessionSnapshot('CODE', 'stu-1')
    expect(result).toBeNull()
  })

  it('returns snapshot with empty submissions map', async () => {
    const apiResponse = {
      progress: { currentTask: 1, currentPhase: 'listen' },
      submissions: {},
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    } as Response)

    const result = await fetchSessionSnapshot('CODE', 'stu-1')
    expect(result).toEqual(apiResponse)
  })

  it('does not crash when API returns null submissions', async () => {
    const apiResponse = {
      progress: { currentTask: 1, currentPhase: 'listen' },
      submissions: null,
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    } as Response)

    const result = await fetchSessionSnapshot('CODE', 'stu-1')
    expect(result).not.toBeNull()
    expect(result!.progress.currentTask).toBe(1)
  })

  it('preserves discussMeta in progress from snapshot API', async () => {
    const apiResponse = {
      progress: {
        currentTask: 1,
        currentPhase: 'discuss',
        discussMeta: { startedAt: '2025-01-01T00:00:00Z', goalReached: true },
      },
      submissions: {},
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    } as Response)

    const result = await fetchSessionSnapshot('CODE', 'stu-1')
    expect(result!.progress.discussMeta).toEqual({
      startedAt: '2025-01-01T00:00:00Z',
      goalReached: true,
    })
  })

  it('preserves discussMeta: null for non-discuss phases', async () => {
    const apiResponse = {
      progress: {
        currentTask: 1,
        currentPhase: 'listen',
        discussMeta: null,
      },
      submissions: {},
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(apiResponse),
    } as Response)

    const result = await fetchSessionSnapshot('CODE', 'stu-1')
    expect(result!.progress.discussMeta).toBeNull()
  })

  it('returns null when API returns null body (nonexistent student)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    } as Response)

    const result = await fetchSessionSnapshot('CODE', 'no-such-student')
    expect(result).toBeNull()
  })

  it('returns null when API response missing progress field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ submissions: {} }),
    } as Response)

    const result = await fetchSessionSnapshot('CODE', 'stu-1')
    expect(result).toBeNull()
  })
})
