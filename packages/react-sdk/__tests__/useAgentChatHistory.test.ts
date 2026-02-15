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
    sessionId: 'conv_test-session-id',
    serverUrl: 'http://localhost:3001',
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    startNewConversation: vi.fn(),
    ...overrides,
  }
}

describe('useAgentChat - message history auto-loading', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(handlers).forEach(key => delete handlers[key])

    // Default fetch mock: success with empty messages for completion,
    // and message history for GET requests
    fetchMock = vi.fn((url: string, options?: RequestInit) => {
      // History endpoint (GET)
      if (typeof url === 'string' && url.includes('/messages') && (!options || options.method !== 'POST')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ messages: [] }),
        })
      }
      // Completion endpoint (POST)
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    })
    global.fetch = fetchMock as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('auto-loading on connection', () => {
    it('should load message history when connected', async () => {
      const connection = createMockConnection()

      renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining('/messages'),
          expect.objectContaining({ method: 'GET' }),
        )
      })
    })

    it('should call the correct history endpoint with session ID', async () => {
      const connection = createMockConnection({ sessionId: 'conv_my-session' })

      renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        const historyCalls = fetchMock.mock.calls.filter(
          (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/messages'),
        )
        expect(historyCalls.length).toBeGreaterThan(0)
        expect(historyCalls[0][0]).toContain('/api/v1/sessions/conv_my-session/messages')
      })
    })

    it('should include limit=100 in the history request', async () => {
      const connection = createMockConnection()

      renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        const historyCalls = fetchMock.mock.calls.filter(
          (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/messages'),
        )
        expect(historyCalls.length).toBeGreaterThan(0)
        expect(historyCalls[0][0]).toContain('limit=100')
      })
    })

    it('should populate messages from history response', async () => {
      const historyMessages = [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!', createdAt: '2026-01-01T00:00:01Z' },
      ]

      fetchMock.mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/messages') && (!options || options.method !== 'POST')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ messages: historyMessages }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      const connection = createMockConnection()
      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })

      expect(result.current.messages[0].role).toBe('user')
      expect(result.current.messages[0].content).toBe('Hello')
      expect(result.current.messages[1].role).toBe('assistant')
      expect(result.current.messages[1].content).toBe('Hi there!')
    })

    it('should not load history when disconnected', () => {
      const connection = createMockConnection({ connected: false })

      renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      const historyCalls = fetchMock.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/messages'),
      )
      expect(historyCalls).toHaveLength(0)
    })
  })

  describe('isLoadingHistory state', () => {
    it('should expose isLoadingHistory in the return value', () => {
      const connection = createMockConnection({ connected: false })

      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      expect(result.current).toHaveProperty('isLoadingHistory')
    })

    it('should set isLoadingHistory to false after loading completes', async () => {
      const connection = createMockConnection()

      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })
    })
  })

  describe('graceful error handling', () => {
    it('should fallback to empty messages on fetch error', async () => {
      fetchMock.mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/messages') && (!options || options.method !== 'POST')) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      const connection = createMockConnection()
      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(result.current.messages).toEqual([])
    })

    it('should fallback to empty messages on non-ok response', async () => {
      fetchMock.mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/messages') && (!options || options.method !== 'POST')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'Internal server error' }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      const connection = createMockConnection()
      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(result.current.messages).toEqual([])
    })

    it('should fallback when response has no messages field', async () => {
      fetchMock.mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/messages') && (!options || options.method !== 'POST')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}), // No messages field
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      const connection = createMockConnection()
      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      expect(result.current.messages).toEqual([])
    })
  })

  describe('interaction with sendMessage', () => {
    it('should append new messages after loaded history', async () => {
      const historyMessages = [
        { id: 'msg-1', role: 'user', content: 'Old message', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Old reply', createdAt: '2026-01-01T00:00:01Z' },
      ]

      fetchMock.mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/messages') && (!options || options.method !== 'POST')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ messages: historyMessages }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      const connection = createMockConnection()
      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      // Wait for history to load
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })

      // Send a new message
      await act(async () => {
        await result.current.sendMessage('New message')
      })

      // Should have history + user message + assistant placeholder
      expect(result.current.messages).toHaveLength(4)
      expect(result.current.messages[0].content).toBe('Old message')
      expect(result.current.messages[1].content).toBe('Old reply')
      expect(result.current.messages[2].content).toBe('New message')
      expect(result.current.messages[2].role).toBe('user')
      expect(result.current.messages[3].role).toBe('assistant')
    })
  })

  describe('clearConversation', () => {
    it('should expose clearConversation in the return value', () => {
      const connection = createMockConnection({ connected: false })

      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      expect(result.current).toHaveProperty('clearConversation')
      expect(typeof result.current.clearConversation).toBe('function')
    })

    it('should clear messages when clearConversation is called', async () => {
      const historyMessages = [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: '2026-01-01T00:00:00Z' },
        { id: 'msg-2', role: 'assistant', content: 'Hi!', createdAt: '2026-01-01T00:00:01Z' },
      ]

      fetchMock.mockImplementation((url: string, options?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/messages') && (!options || options.method !== 'POST')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ messages: historyMessages }),
          })
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })

      const connection = createMockConnection()
      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      // Wait for history to load
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2)
      })

      // Clear conversation
      act(() => {
        result.current.clearConversation()
      })

      expect(result.current.messages).toEqual([])
    })

    it('should call connection.startNewConversation when clearing', async () => {
      const startNewConversation = vi.fn()
      const connection = createMockConnection({ startNewConversation })

      const { result } = renderHook(() =>
        useAgentChat({ connection, tenantId: 'test' }),
      )

      await waitFor(() => {
        expect(result.current.isLoadingHistory).toBe(false)
      })

      act(() => {
        result.current.clearConversation()
      })

      expect(startNewConversation).toHaveBeenCalled()
    })
  })
})
