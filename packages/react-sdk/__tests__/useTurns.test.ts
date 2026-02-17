import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTurns } from '../src/hooks/useTurns'

describe('useTurns', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should load turns for a conversation', async () => {
    const mockTurns = [
      {
        id: 'turn-1',
        conversationId: 'conv_abc',
        turnNumber: 1,
        userMessageId: 'msg-1',
        assistantMessageId: 'msg-2',
        totalTokens: 500,
        durationMs: 3000,
        createdAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T00:00:03Z',
      },
      {
        id: 'turn-2',
        conversationId: 'conv_abc',
        turnNumber: 2,
        userMessageId: 'msg-3',
        assistantMessageId: 'msg-4',
        totalTokens: 800,
        durationMs: 5000,
        createdAt: '2026-01-01T00:01:00Z',
        completedAt: '2026-01-01T00:01:05Z',
      },
    ]

    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ turns: mockTurns }),
    })

    const { result } = renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: 'conv_abc' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.turns).toHaveLength(2)
    expect(result.current.turns[0].turnNumber).toBe(1)
    expect(result.current.turns[0].totalTokens).toBe(500)
    expect(result.current.turns[1].turnNumber).toBe(2)
  })

  it('should call the correct API endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ turns: [] }),
    })

    renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: 'conv_xyz' }),
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/conversations/conv_xyz/turns',
        expect.objectContaining({ method: 'GET' }),
      )
    })
  })

  it('should return empty array if no turns', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ turns: [] }),
    })

    const { result } = renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: 'conv_empty' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.turns).toEqual([])
  })

  it('should return empty array when response has no turns field', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    const { result } = renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: 'conv_abc' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.turns).toEqual([])
  })

  it('should toggle isLoading state correctly', async () => {
    let resolvePromise: (value: unknown) => void
    const pending = new Promise((resolve) => {
      resolvePromise = resolve
    })

    fetchMock.mockReturnValue(pending)

    const { result } = renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: 'conv_abc' }),
    )

    // Should be loading initially
    expect(result.current.isLoading).toBe(true)

    // Resolve the fetch
    await act(async () => {
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ turns: [] }),
      })
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
  })

  it('should handle fetch errors gracefully', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: 'conv_abc' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.turns).toEqual([])
    expect(result.current.error).toBeTruthy()
  })

  it('should handle non-ok response gracefully', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    })

    const { result } = renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: 'conv_abc' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.turns).toEqual([])
    expect(result.current.error).toBeTruthy()
  })

  it('should reload turns when reload() is called', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ turns: [{ id: 'turn-1', turnNumber: 1 }] }),
    })

    const { result } = renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: 'conv_abc' }),
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Update mock for reload
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        turns: [
          { id: 'turn-1', turnNumber: 1 },
          { id: 'turn-2', turnNumber: 2 },
        ],
      }),
    })

    await act(async () => {
      await result.current.reload()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.turns).toHaveLength(2)
  })

  it('should not fetch when conversationId is empty', () => {
    renderHook(() =>
      useTurns({ serverUrl: 'http://localhost:3001', conversationId: '' }),
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should refetch when conversationId changes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ turns: [] }),
    })

    const { rerender } = renderHook(
      (props: { conversationId: string }) =>
        useTurns({ serverUrl: 'http://localhost:3001', conversationId: props.conversationId }),
      { initialProps: { conversationId: 'conv_1' } },
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    rerender({ conversationId: 'conv_2' })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    const lastCall = fetchMock.mock.calls[1]
    expect(lastCall[0]).toContain('conv_2')
  })
})
