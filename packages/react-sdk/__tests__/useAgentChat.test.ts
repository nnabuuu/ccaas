import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAgentChat } from '../src/hooks/useAgentChat'
import type { UseAgentConnectionReturn } from '../src/types'

/**
 * Helper: create a ReadableStream that emits SSE-formatted events.
 * Each event is wrapped in the SSE envelope format used by the backend.
 */
function createSseStream(events: Array<Record<string, unknown>> = []): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let idx = 0
  return new ReadableStream({
    pull(controller) {
      if (idx < events.length) {
        const envelope = {
          seq: idx + 1,
          sessionId: 'test-session-id',
          timestamp: new Date().toISOString(),
          event: events[idx],
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(envelope)}\n\n`))
        idx++
      } else {
        controller.close()
      }
    },
  })
}

function createMockConnection(overrides: Partial<UseAgentConnectionReturn> = {}): UseAgentConnectionReturn {
  return {
    socket: null as any,
    connected: true,
    clientId: null,
    sessionId: 'test-session-id',
    serverUrl: '',
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    startNewConversation: vi.fn(),
    markSessionReady: vi.fn(),
    ...overrides,
  }
}

/** Set up fetch mock with SSE stream support */
function mockFetch(sseEvents: Array<Record<string, unknown>> = []) {
  global.fetch = vi.fn((url: string, options?: RequestInit) => {
    // GET /messages - history endpoint
    if (typeof url === 'string' && url.includes('/messages') && (!options || options.method === 'GET')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ messages: [] }),
      })
    }
    // POST /messages - SSE stream endpoint
    if (typeof url === 'string' && url.includes('/messages') && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        body: createSseStream(sseEvents),
      })
    }
    // Fallback
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    })
  }) as any
}

/** Helper to find the POST /messages call */
function findPostCall(fetchMock: ReturnType<typeof vi.fn>): unknown[] | undefined {
  return fetchMock.mock.calls.find(
    (call: unknown[]) => {
      const url = call[0] as string
      const opts = call[1] as Record<string, unknown> | undefined
      return opts?.method === 'POST' && url.includes('/messages')
    },
  )
}

describe('useAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start with empty messages', () => {
    mockFetch()
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test' }),
    )

    expect(result.current.messages).toEqual([])
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.currentStreamContent).toBe('')
  })

  it('should send message via SSE stream', async () => {
    mockFetch()
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test-tenant' }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    const callArgs = findPostCall(global.fetch as ReturnType<typeof vi.fn>)
    expect(callArgs).toBeDefined()
    const url = callArgs![0] as string
    expect(url).toContain('/api/v1/sessions/test-session-id/messages')
    const body = JSON.parse((callArgs![1] as Record<string, string>).body)
    expect(body.message).toBe('Hello')
    expect(body.solutionId).toBe('test-tenant')
    // SSE mode does not include clientId
    expect(body.clientId).toBeUndefined()
  })

  it('should add user and assistant messages when sending', async () => {
    mockFetch()
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test' }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].role).toBe('user')
    expect(result.current.messages[0].content).toBe('Hello')
    expect(result.current.messages[1].role).toBe('assistant')
  })

  it('should not send when no sessionId', async () => {
    mockFetch()
    const connection = createMockConnection({ sessionId: '' })
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test' }),
    )

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(findPostCall(global.fetch as ReturnType<typeof vi.fn>)).toBeUndefined()
  })

  it('should accumulate text_delta into stream content', async () => {
    mockFetch([
      { type: 'text_delta', delta: 'Hello ' },
      { type: 'text_delta', delta: 'world' },
    ])
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test' }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.currentStreamContent).toBe('Hello world')
  })

  it('should call onOutputUpdate when output_update received', async () => {
    const onOutputUpdate = vi.fn()
    mockFetch([
      {
        type: 'output_update',
        sessionId: 'test',
        payload: {
          status: 'success',
          data: {
            field: 'title',
            value: 'New Title',
            preview: 'Title updated',
          },
        },
      },
    ])
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test', onOutputUpdate }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(onOutputUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'title',
        value: 'New Title',
        preview: 'Update title',
      }),
    )
  })

  it('should finalize message on agent_status complete', async () => {
    mockFetch([
      { type: 'text_delta', delta: 'response' },
      { type: 'agent_status', status: 'complete' },
    ])
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test' }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.isProcessing).toBe(false)
    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.isStreaming).toBe(false)
  })

  it('should clear messages', async () => {
    mockFetch()
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test' }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.messages.length).toBeGreaterThan(0)

    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.messages).toEqual([])
  })

  it('should include attachments in payload', async () => {
    mockFetch()
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test' }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Check this', {
        attachments: [{ type: 'image', path: '/tmp/img.png' }],
      })
    })

    const callArgs = findPostCall(global.fetch as ReturnType<typeof vi.fn>)
    expect(callArgs).toBeDefined()
    const body = JSON.parse((callArgs![1] as Record<string, string>).body)
    expect(body.attachments).toEqual([{ type: 'image', path: '/tmp/img.png' }])
  })

  it('should call onTokenUsage callback when token_usage received', async () => {
    const onTokenUsage = vi.fn()
    mockFetch([
      {
        type: 'token_usage',
        payload: {
          inputTokens: 100,
          outputTokens: 50,
          cacheReadTokens: 30,
        },
      },
    ])
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test', onTokenUsage }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(onTokenUsage).toHaveBeenCalledWith({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 30,
    })
  })

  it('should not fail when onTokenUsage is not provided', async () => {
    mockFetch([
      {
        type: 'token_usage',
        payload: { inputTokens: 100, outputTokens: 50 },
      },
    ])
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, solutionId: 'test' }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    // Should not throw
    await act(async () => {
      await result.current.sendMessage('Hello')
    })
  })

  it('should include enabledSkills in payload', async () => {
    mockFetch()
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({
        connection,
        solutionId: 'test',
        enabledSkills: ['skill-a', 'skill-b'],
      }),
    )

    await waitFor(() => expect(result.current.isLoadingHistory).toBe(false))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    const callArgs = findPostCall(global.fetch as ReturnType<typeof vi.fn>)
    expect(callArgs).toBeDefined()
    const body = JSON.parse((callArgs![1] as Record<string, string>).body)
    expect(body.enabledSkills).toEqual(['skill-a', 'skill-b'])
  })
})
