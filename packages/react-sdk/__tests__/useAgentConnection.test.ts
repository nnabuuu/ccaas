import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Use vi.hoisted so the mock is available at vi.mock time
const { mockSocket, mockIo } = vi.hoisted(() => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }
  const mockIo = vi.fn(() => mockSocket)
  return { mockSocket, mockIo }
})

vi.mock('socket.io-client', () => ({
  io: mockIo,
}))

import { useAgentConnection } from '../src/hooks/useAgentConnection'

describe('useAgentConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.on.mockReset()
    mockSocket.emit.mockReset()
    mockSocket.disconnect.mockReset()
    mockIo.mockClear()
    mockIo.mockReturnValue(mockSocket)
  })

  it('should auto-connect on mount', () => {
    renderHook(() => useAgentConnection({ sessionPrefix: 'test' }))

    expect(mockIo).toHaveBeenCalledWith('/', {
      transports: ['websocket', 'polling'],
    })
  })

  it('should not connect when autoConnect is false', () => {
    renderHook(() => useAgentConnection({ autoConnect: false }))

    expect(mockIo).not.toHaveBeenCalled()
  })

  it('should have sessionId with prefix', () => {
    const { result } = renderHook(() =>
      useAgentConnection({ sessionPrefix: 'lpd' }),
    )

    expect(result.current.sessionId).toMatch(/^lpd_/)
  })

  it('should register connect/disconnect/client_id handlers', () => {
    renderHook(() => useAgentConnection())

    const eventNames = mockSocket.on.mock.calls.map((call: unknown[]) => call[0])
    expect(eventNames).toContain('connect')
    expect(eventNames).toContain('disconnect')
    expect(eventNames).toContain('client_id')
    expect(eventNames).toContain('connect_error')
  })

  it('should update connected state on connect event', () => {
    const { result } = renderHook(() => useAgentConnection())

    const connectCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect')
    expect(connectCall).toBeDefined()

    act(() => {
      connectCall![1]()
    })

    expect(result.current.connected).toBe(true)
  })

  it('should update clientId on client_id event', () => {
    const { result } = renderHook(() => useAgentConnection())

    const clientIdCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'client_id')
    expect(clientIdCall).toBeDefined()

    act(() => {
      clientIdCall![1]({ clientId: 'test-client-123' })
    })

    expect(result.current.clientId).toBe('test-client-123')
  })

  it('should set error on connect_error', () => {
    const { result } = renderHook(() => useAgentConnection())

    const errorCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect_error')

    act(() => {
      errorCall![1](new Error('Connection refused'))
    })

    expect(result.current.error).toBe('Connection error: Connection refused')
    expect(result.current.connected).toBe(false)
  })

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useAgentConnection())

    unmount()

    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('should join session on connect', () => {
    const { result } = renderHook(() => useAgentConnection({ sessionPrefix: 'pe' }))

    const connectCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect')

    act(() => {
      connectCall![1]()
    })

    expect(mockSocket.emit).toHaveBeenCalledWith('session:join', {
      sessionId: result.current.sessionId,
    })
  })

  describe('localStorage persistence (Task #5)', () => {
    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear()
    })

    it('should generate conv_ format sessionId when tenantId is provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test_tenant' })
      )

      expect(result.current.sessionId).toMatch(/^conv_/)
    })

    it('should persist sessionId to tenant-scoped localStorage', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test_tenant' })
      )

      const stored = localStorage.getItem('ccaas_session_test_tenant')
      expect(stored).toBe(result.current.sessionId)
    })

    it('should recover sessionId from localStorage on mount', () => {
      // Pre-populate localStorage
      localStorage.setItem('ccaas_session_test_tenant', 'conv_existing_123')

      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test_tenant' })
      )

      expect(result.current.sessionId).toBe('conv_existing_123')
    })

    it('should clear localStorage when forceNewConversation is true', () => {
      // Pre-populate localStorage
      localStorage.setItem('ccaas_session_test_tenant', 'conv_existing_123')

      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test_tenant', forceNewConversation: true })
      )

      expect(result.current.sessionId).not.toBe('conv_existing_123')
      expect(result.current.sessionId).toMatch(/^conv_/)
      const stored = localStorage.getItem('ccaas_session_test_tenant')
      expect(stored).toBe(result.current.sessionId)
    })

    it('should use legacy prefix format when no tenantId provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ sessionPrefix: 'demo' })
      )

      expect(result.current.sessionId).toMatch(/^demo_/)
      expect(localStorage.getItem('ccaas_session_demo')).toBeNull()
    })

    it('should isolate sessions by tenantId', () => {
      const { result: result1 } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant_a' })
      )
      const { result: result2 } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant_b' })
      )

      const storedA = localStorage.getItem('ccaas_session_tenant_a')
      const storedB = localStorage.getItem('ccaas_session_tenant_b')

      expect(storedA).toBe(result1.current.sessionId)
      expect(storedB).toBe(result2.current.sessionId)
      expect(storedA).not.toBe(storedB)
    })
  })

  describe('startNewConversation (Task #7)', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should clear localStorage and generate new sessionId', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test_tenant' })
      )

      const oldSessionId = result.current.sessionId

      act(() => {
        result.current.startNewConversation()
      })

      expect(result.current.sessionId).not.toBe(oldSessionId)
      expect(result.current.sessionId).toMatch(/^conv_/)
      const stored = localStorage.getItem('ccaas_session_test_tenant')
      expect(stored).toBe(result.current.sessionId)
    })

    it('should reconnect with new sessionId', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test_tenant' })
      )

      mockSocket.emit.mockClear()

      act(() => {
        result.current.startNewConversation()
      })

      // Trigger connect event to simulate reconnection
      const connectCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect')
      act(() => {
        connectCall![1]()
      })

      // Should join session with new sessionId
      expect(mockSocket.emit).toHaveBeenCalledWith('session:join', {
        sessionId: result.current.sessionId,
      })
    })

    it('should work without tenantId (legacy mode)', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ sessionPrefix: 'demo' })
      )

      const oldSessionId = result.current.sessionId

      act(() => {
        result.current.startNewConversation()
      })

      expect(result.current.sessionId).not.toBe(oldSessionId)
      expect(result.current.sessionId).toMatch(/^demo_/)
      // No localStorage in legacy mode
      expect(localStorage.getItem('ccaas_session_demo')).toBeNull()
    })
  })
})
