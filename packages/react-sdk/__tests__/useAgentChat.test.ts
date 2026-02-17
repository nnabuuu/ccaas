import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAgentChat } from '../src/hooks/useAgentChat'
import type { UseAgentConnectionReturn } from '../src/types'

// Mock socket
const handlers: Record<string, Function> = {}
const mockSocket = {
  on: vi.fn((event: string, handler: Function) => {
    handlers[event] = handler
  }),
  off: vi.fn((event: string) => {
    delete handlers[event]
  }),
  emit: vi.fn(),
  connected: true,
}

function createMockConnection(overrides: Partial<UseAgentConnectionReturn> = {}): UseAgentConnectionReturn {
  return {
    socket: mockSocket as any,
    connected: true,
    clientId: 'test-client-id',
    sessionId: 'test-session-id',
    serverUrl: '', // Empty string creates relative URLs for testing
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    startNewConversation: vi.fn(),
    ...overrides,
  }
}

/** Helper to find the POST completion call from fetch mock calls */
function findPostCall(fetchMock: ReturnType<typeof vi.fn>): unknown[] | undefined {
  return fetchMock.mock.calls.find(
    (call: unknown[]) => {
      const opts = call[1] as Record<string, unknown> | undefined
      return opts?.method === 'POST'
    },
  )
}

describe('useAgentChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(handlers).forEach(key => delete handlers[key])
    global.fetch = vi.fn((url: string, options?: RequestInit) => {
      // History endpoint (GET) - return empty messages
      if (typeof url === 'string' && url.includes('/messages') && (!options || options.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] }),
        })
      }
      // Completion endpoint (POST) and others
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    }) as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should start with empty messages', () => {
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test' }),
    )

    expect(result.current.messages).toEqual([])
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.currentStreamContent).toBe('')
  })

  it('should register socket event handlers', () => {
    const connection = createMockConnection()
    renderHook(() => useAgentChat({ connection, tenantId: 'test' }))

    const registeredEvents = mockSocket.on.mock.calls.map((c: unknown[]) => c[0])
    expect(registeredEvents).toContain('text_delta')
    expect(registeredEvents).toContain('output_update')
    expect(registeredEvents).toContain('agent_status')
    expect(registeredEvents).toContain('tool_activity')
    expect(registeredEvents).toContain('tool_event')
  })

  it('should send message via REST API', async () => {
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test-tenant' }),
    )

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/sessions/test-session-id/completion',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    // Check the payload (find POST call, not the GET history call)
    const callArgs = findPostCall(global.fetch as ReturnType<typeof vi.fn>)
    expect(callArgs).toBeDefined()
    const body = JSON.parse((callArgs![1] as Record<string, string>).body)
    expect(body.clientId).toBe('test-client-id')
    expect(body.message).toBe('Hello')
    expect(body.tenantId).toBe('test-tenant')
  })

  it('should add user and assistant messages when sending', async () => {
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test' }),
    )

    // Wait for history loading to complete
    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false)
    })

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].role).toBe('user')
    expect(result.current.messages[0].content).toBe('Hello')
    expect(result.current.messages[1].role).toBe('assistant')
    expect(result.current.messages[1].isStreaming).toBe(true)
  })

  it('should not send when disconnected', async () => {
    const connection = createMockConnection({ connected: false })
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test' }),
    )

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    // No POST completion call should have been made
    expect(findPostCall(global.fetch as ReturnType<typeof vi.fn>)).toBeUndefined()
  })

  it('should not send when no clientId', async () => {
    const connection = createMockConnection({ clientId: null })
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test' }),
    )

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    // No POST completion call should have been made (GET history may have fired)
    expect(findPostCall(global.fetch as ReturnType<typeof vi.fn>)).toBeUndefined()
  })

  it('should accumulate text_delta into stream content', async () => {
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test' }),
    )

    // Wait for history loading to complete
    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false)
    })

    // First send a message to create assistant placeholder
    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    // Simulate text_delta
    act(() => {
      handlers['text_delta']?.({ delta: 'Hello ' })
    })

    act(() => {
      handlers['text_delta']?.({ delta: 'world' })
    })

    expect(result.current.currentStreamContent).toBe('Hello world')
  })

  it('should call onOutputUpdate when output_update received', () => {
    const onOutputUpdate = vi.fn()
    const connection = createMockConnection()

    renderHook(() =>
      useAgentChat({ connection, tenantId: 'test', onOutputUpdate }),
    )

    act(() => {
      handlers['output_update']?.({
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
      })
    })

    expect(onOutputUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        field: 'title',
        value: 'New Title',
        preview: 'Title updated',
      }),
    )
  })

  it('should finalize message on agent_status complete', async () => {
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test' }),
    )

    // Wait for history loading to complete
    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false)
    })

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(result.current.isProcessing).toBe(true)

    act(() => {
      handlers['agent_status']?.({ status: 'complete' })
    })

    expect(result.current.isProcessing).toBe(false)
  })

  it('should clear messages', async () => {
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test' }),
    )

    // Wait for history loading to complete
    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false)
    })

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
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({ connection, tenantId: 'test' }),
    )

    // Wait for history loading to complete
    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false)
    })

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

  it('should include enabledSkillSlugs in payload', async () => {
    const connection = createMockConnection()
    const { result } = renderHook(() =>
      useAgentChat({
        connection,
        tenantId: 'test',
        enabledSkillSlugs: ['skill-a', 'skill-b'],
      }),
    )

    // Wait for history loading to complete
    await waitFor(() => {
      expect(result.current.isLoadingHistory).toBe(false)
    })

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    const callArgs = findPostCall(global.fetch as ReturnType<typeof vi.fn>)
    expect(callArgs).toBeDefined()
    const body = JSON.parse((callArgs![1] as Record<string, string>).body)
    expect(body.enabledSkillSlugs).toEqual(['skill-a', 'skill-b'])
  })
})
