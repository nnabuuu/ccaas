/**
 * Tests for the plain-function API clients exported from useClassroom.ts.
 *
 * Coverage targets the function exports that were untested:
 *   - reportPhase            — fire-and-forget POST
 *   - fetchSessionSnapshot   — GET progress + cache backfill
 *   - fetchExerciseSpec      — GET (with/without studentId)
 *   - checkAnswer            — POST check, with optional exerciseType
 *   - translateText          — POST translate
 *   - translateChat          — POST translate/chat
 *
 * Each function returns null on non-OK status or thrown fetch (network error)
 * — verified explicitly so we don't regress that contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  reportPhase,
  fetchSessionSnapshot,
  fetchExerciseSpec,
  checkAnswer,
  translateText,
  translateChat,
  getCachedSubmission,
} from '../useClassroom'

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

function okResponse<T>(body: T): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body as unknown),
  } as unknown as Response
}

function notOkResponse(status = 500): Response {
  return { ok: false, status } as Response
}

describe('reportPhase', () => {
  it('POSTs to /phase with the correct body and swallows fetch errors', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({}))
    reportPhase('ABC123', 'st1', 2, 'practice')
    expect(fetchSpy).toHaveBeenCalledWith('/api/classroom/ABC123/phase', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'st1', task: 2, phase: 'practice' }),
    }))
  })

  it('does not throw when fetch rejects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    expect(() => reportPhase('A', 's', 1, 'p')).not.toThrow()
  })
})

describe('fetchSessionSnapshot', () => {
  it('returns null when the response is not OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(notOkResponse(404))
    expect(await fetchSessionSnapshot('CODE', 'stu1')).toBeNull()
  })

  it('returns null when currentTask is missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ currentPhase: 'listen' }))
    expect(await fetchSessionSnapshot('CODE', 'stu1')).toBeNull()
  })

  it('hydrates submissions into the localStorage cache and returns the snapshot', async () => {
    const body = {
      currentTask: 2,
      currentPhase: 'practice',
      submissions: {
        '1': { data: { a: 1 }, score: { total: 50 } },
        '2': { data: { b: 2 }, score: null, checkItems: [{ idx: 0, correct: true }] },
      },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(body))
    const snap = await fetchSessionSnapshot('CODE', 'stu1')
    expect(snap?.progress).toEqual({ currentTask: 2, currentPhase: 'practice' })
    expect(snap?.submissions).toEqual(body.submissions)
    // Verify cache was backfilled:
    expect(getCachedSubmission('CODE', 1)).toEqual({ data: { a: 1 }, score: { total: 50 } })
    expect(getCachedSubmission('CODE', 2)?.checkItems).toEqual([{ idx: 0, correct: true }])
  })

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('net'))
    expect(await fetchSessionSnapshot('C', 's')).toBeNull()
  })

  it('returns an empty submissions object when none are returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ currentTask: 1, currentPhase: 'listen' }))
    const snap = await fetchSessionSnapshot('C', 's')
    expect(snap?.submissions).toEqual({})
  })
})

describe('fetchExerciseSpec', () => {
  it('appends studentId as a query param when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ type: 'quiz' }))
    await fetchExerciseSpec('CODE', 3, 'stu1')
    expect(fetchSpy).toHaveBeenCalledWith('/api/classroom/CODE/steps/3/exercise?studentId=stu1')
  })

  it('omits the query param when studentId is missing', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ type: 'quiz' }))
    await fetchExerciseSpec('CODE', 3)
    expect(fetchSpy).toHaveBeenCalledWith('/api/classroom/CODE/steps/3/exercise')
  })

  it('returns null on non-OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(notOkResponse())
    expect(await fetchExerciseSpec('C', 1)).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))
    expect(await fetchExerciseSpec('C', 1)).toBeNull()
  })
})

describe('checkAnswer', () => {
  it('POSTs studentId + data, no exerciseType when omitted', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ allCorrect: true, items: [] }))
    await checkAnswer('CODE', 2, 'stu1', { answers: [0] })
    expect(fetchSpy).toHaveBeenCalledWith('/api/classroom/CODE/steps/2/check', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ studentId: 'stu1', data: { answers: [0] } }),
    }))
  })

  it('includes exerciseType in the body when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({}))
    await checkAnswer('CODE', 1, 'stu1', { x: 1 }, 'quiz')
    const call = fetchSpy.mock.calls[0]
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.exerciseType).toBe('quiz')
  })

  it('returns null on non-OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(notOkResponse(500))
    expect(await checkAnswer('C', 1, 's', {})).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('x'))
    expect(await checkAnswer('C', 1, 's', {})).toBeNull()
  })
})

describe('translateText', () => {
  it('POSTs the translate payload with phase when provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({
      definition: 'def', contextAnalysis: 'ctx', suggestedQuestions: ['q?'],
    }))
    const result = await translateText('CODE', 'stu1', 'word', 1, 'source', 'practice')
    expect(result?.definition).toBe('def')
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)
    expect(body.phase).toBe('practice')
  })

  it('returns null on non-OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(notOkResponse(500))
    expect(await translateText('C', 's', 't', 1, 'src')).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('x'))
    expect(await translateText('C', 's', 't', 1, 'src')).toBeNull()
  })
})

describe('translateChat', () => {
  it('POSTs the chat payload and returns the reply', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse({ reply: 'sure' }))
    const result = await translateChat('CODE', 'stu1', 1, 'word', 'why?', 'sourceText')
    expect(result?.reply).toBe('sure')
  })

  it('returns null on non-OK', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(notOkResponse(500))
    expect(await translateChat('C', 's', 1, 'o', 'q', 'src')).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))
    expect(await translateChat('C', 's', 1, 'o', 'q', 'src')).toBeNull()
  })
})
