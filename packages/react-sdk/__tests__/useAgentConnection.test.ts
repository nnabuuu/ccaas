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
    localStorage.clear()
  })

  // =========================================================================
  // SSE mode (default transport)
  // =========================================================================

  describe('SSE mode (default)', () => {
    it('should be connected immediately in SSE mode', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test' })
      )

      // SSE mode: always connected (HTTP is stateless)
      expect(result.current.connected).toBe(true)
      // Should NOT create a socket
      expect(mockIo).not.toHaveBeenCalled()
    })

    it('should not create socket on mount in SSE mode', () => {
      renderHook(() => useAgentConnection())

      expect(mockIo).not.toHaveBeenCalled()
    })

    it('should have sessionId with prefix when no tenantId', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ sessionPrefix: 'lpd' }),
      )

      expect(result.current.sessionId).toMatch(/^lpd_/)
    })
  })

  // =========================================================================
  // Socket transport (deprecated, explicit opt-in)
  // =========================================================================

  describe('Socket transport (deprecated)', () => {
    it('should auto-connect on mount', () => {
      renderHook(() => useAgentConnection({ sessionPrefix: 'test', transport: 'socket' }))

      expect(mockIo).toHaveBeenCalledWith('/', {
        transports: ['websocket', 'polling'],
      })
    })

    it('should not connect when autoConnect is false', () => {
      renderHook(() => useAgentConnection({ autoConnect: false, transport: 'socket' }))

      expect(mockIo).not.toHaveBeenCalled()
    })

    it('should register connect/disconnect/client_id handlers', () => {
      renderHook(() => useAgentConnection({ transport: 'socket' }))

      const eventNames = mockSocket.on.mock.calls.map((call: unknown[]) => call[0])
      expect(eventNames).toContain('connect')
      expect(eventNames).toContain('disconnect')
      expect(eventNames).toContain('client_id')
      expect(eventNames).toContain('connect_error')
    })

    it('should update connected state on connect event', () => {
      const { result } = renderHook(() => useAgentConnection({ transport: 'socket' }))

      const connectCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect')
      expect(connectCall).toBeDefined()

      act(() => {
        connectCall![1]()
      })

      expect(result.current.connected).toBe(true)
    })

    it('should update clientId on client_id event', () => {
      const { result } = renderHook(() => useAgentConnection({ transport: 'socket' }))

      const clientIdCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'client_id')
      expect(clientIdCall).toBeDefined()

      act(() => {
        clientIdCall![1]({ clientId: 'test-client-123' })
      })

      expect(result.current.clientId).toBe('test-client-123')
    })

    it('should set error on connect_error', () => {
      const { result } = renderHook(() => useAgentConnection({ transport: 'socket' }))

      const errorCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect_error')

      act(() => {
        errorCall![1](new Error('Connection refused'))
      })

      expect(result.current.error).toBe('Connection error: Connection refused')
      expect(result.current.connected).toBe(false)
    })

    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useAgentConnection({ transport: 'socket' }))

      unmount()

      expect(mockSocket.disconnect).toHaveBeenCalled()
    })

    it('should join session on connect', () => {
      const { result } = renderHook(() => useAgentConnection({ sessionPrefix: 'pe', transport: 'socket' }))

      const connectCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect')

      act(() => {
        connectCall![1]()
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('session:join', {
        sessionId: result.current.sessionId,
      })
    })
  })

  // =========================================================================
  // localStorage persistence (tenant-scoped, no userId)
  // =========================================================================

  describe('localStorage persistence (Task #5)', () => {
    beforeEach(() => {
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

  // =========================================================================
  // User-scoped session persistence (userId parameter)
  // =========================================================================

  describe('user-scoped session persistence', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should use tenant+user-scoped localStorage key when userId is provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'user_alice' })
      )

      // Should persist under the user-scoped key
      const stored = localStorage.getItem('ccaas_session_tenant1_user_alice')
      expect(stored).toBe(result.current.sessionId)

      // Should NOT persist under the tenant-only key
      const tenantOnly = localStorage.getItem('ccaas_session_tenant1')
      expect(tenantOnly).toBeNull()
    })

    it('should use tenant-only key when userId is not provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1' })
      )

      const stored = localStorage.getItem('ccaas_session_tenant1')
      expect(stored).toBe(result.current.sessionId)
    })

    it('should isolate sessions between different users on the same tenant', () => {
      const { result: alice } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'alice' })
      )
      const { result: bob } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'bob' })
      )

      const storedAlice = localStorage.getItem('ccaas_session_tenant1_alice')
      const storedBob = localStorage.getItem('ccaas_session_tenant1_bob')

      expect(storedAlice).toBe(alice.current.sessionId)
      expect(storedBob).toBe(bob.current.sessionId)
      // Different users should get different session IDs
      expect(storedAlice).not.toBe(storedBob)
    })

    it('should recover user-scoped sessionId from localStorage', () => {
      // Pre-populate with user-scoped key
      localStorage.setItem('ccaas_session_tenant1_alice', 'conv_alice_saved_123')

      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'alice' })
      )

      expect(result.current.sessionId).toBe('conv_alice_saved_123')
    })

    it('should not recover from tenant-only key when userId is provided', () => {
      // Pre-populate tenant-only key (from before userId was added)
      localStorage.setItem('ccaas_session_tenant1', 'conv_old_tenant_only')

      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'alice' })
      )

      // Should NOT recover from the tenant-only key
      expect(result.current.sessionId).not.toBe('conv_old_tenant_only')
      // Should generate a new conv_ ID
      expect(result.current.sessionId).toMatch(/^conv_/)
    })

    it('should persist explicit sessionId under user-scoped key', () => {
      renderHook(() =>
        useAgentConnection({
          tenantId: 'tenant1',
          userId: 'alice',
          sessionId: 'conv_explicit_999',
        })
      )

      const stored = localStorage.getItem('ccaas_session_tenant1_alice')
      expect(stored).toBe('conv_explicit_999')
    })

    it('should clear user-scoped key when forceNewConversation is true', () => {
      localStorage.setItem('ccaas_session_tenant1_alice', 'conv_alice_old')

      const { result } = renderHook(() =>
        useAgentConnection({
          tenantId: 'tenant1',
          userId: 'alice',
          forceNewConversation: true,
        })
      )

      expect(result.current.sessionId).not.toBe('conv_alice_old')
      expect(result.current.sessionId).toMatch(/^conv_/)
      const stored = localStorage.getItem('ccaas_session_tenant1_alice')
      expect(stored).toBe(result.current.sessionId)
    })

    it('should not affect other users when one user forces new conversation', () => {
      localStorage.setItem('ccaas_session_tenant1_alice', 'conv_alice_original')
      localStorage.setItem('ccaas_session_tenant1_bob', 'conv_bob_original')

      // Alice forces new conversation
      renderHook(() =>
        useAgentConnection({
          tenantId: 'tenant1',
          userId: 'alice',
          forceNewConversation: true,
        })
      )

      // Bob's session should remain untouched
      const storedBob = localStorage.getItem('ccaas_session_tenant1_bob')
      expect(storedBob).toBe('conv_bob_original')
    })
  })

  // =========================================================================
  // startNewConversation
  // =========================================================================

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

    it('should reconnect with new sessionId (socket transport)', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test_tenant', transport: 'socket' })
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

    it('should clear user-scoped localStorage key when userId is provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'alice' })
      )

      const oldSessionId = result.current.sessionId
      expect(localStorage.getItem('ccaas_session_tenant1_alice')).toBe(oldSessionId)

      act(() => {
        result.current.startNewConversation()
      })

      const newSessionId = result.current.sessionId
      expect(newSessionId).not.toBe(oldSessionId)
      expect(newSessionId).toMatch(/^conv_/)
      // New session should be saved under user-scoped key
      expect(localStorage.getItem('ccaas_session_tenant1_alice')).toBe(newSessionId)
    })

    it('should not affect other users sessions when starting new conversation', () => {
      // Set up bob's session
      localStorage.setItem('ccaas_session_tenant1_bob', 'conv_bob_999')

      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'alice' })
      )

      act(() => {
        result.current.startNewConversation()
      })

      // Bob's session should be untouched
      expect(localStorage.getItem('ccaas_session_tenant1_bob')).toBe('conv_bob_999')
    })

    it('should reset sessionReady to false', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'test_tenant' })
      )

      // Mark session as ready
      act(() => {
        result.current.markSessionReady()
      })
      expect(result.current.sessionReady).toBe(true)

      act(() => {
        result.current.startNewConversation()
      })

      expect(result.current.sessionReady).toBe(false)
    })
  })

  // =========================================================================
  // switchSession
  // =========================================================================

  describe('switchSession', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should update sessionId to the provided value', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1' })
      )

      act(() => {
        result.current.switchSession('conv_target_session')
      })

      expect(result.current.sessionId).toBe('conv_target_session')
    })

    it('should persist switched session to tenant-scoped localStorage', () => {
      renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1' })
      )

      // switchSession is on result.current, need to get it first
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1' })
      )

      act(() => {
        result.current.switchSession('conv_switched_456')
      })

      const stored = localStorage.getItem('ccaas_session_tenant1')
      expect(stored).toBe('conv_switched_456')
    })

    it('should persist switched session to user-scoped localStorage when userId provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'alice' })
      )

      act(() => {
        result.current.switchSession('conv_alice_switched_789')
      })

      const stored = localStorage.getItem('ccaas_session_tenant1_alice')
      expect(stored).toBe('conv_alice_switched_789')
      // Should NOT affect tenant-only key
      expect(localStorage.getItem('ccaas_session_tenant1')).toBeNull()
    })

    it('should not affect other users when switching session', () => {
      localStorage.setItem('ccaas_session_tenant1_bob', 'conv_bob_original')

      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1', userId: 'alice' })
      )

      act(() => {
        result.current.switchSession('conv_alice_new')
      })

      // Bob's session untouched
      expect(localStorage.getItem('ccaas_session_tenant1_bob')).toBe('conv_bob_original')
    })

    it('should not persist to localStorage when tenantId is absent', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ sessionPrefix: 'demo' })
      )

      act(() => {
        result.current.switchSession('demo_switched')
      })

      expect(result.current.sessionId).toBe('demo_switched')
      // No localStorage persistence without tenantId
      expect(localStorage.length).toBe(0)
    })

    it('should reset sessionReady to false', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ tenantId: 'tenant1' })
      )

      // Mark session as ready
      act(() => {
        result.current.markSessionReady()
      })
      expect(result.current.sessionReady).toBe(true)

      act(() => {
        result.current.switchSession('conv_another_session')
      })

      expect(result.current.sessionReady).toBe(false)
    })
  })

  // =========================================================================
  // Explicit sessionId parameter
  // =========================================================================

  describe('explicit sessionId option', () => {
    beforeEach(() => {
      localStorage.clear()
    })

    it('should use explicit sessionId and skip localStorage resolution', () => {
      // Pre-populate localStorage with a different value
      localStorage.setItem('ccaas_session_tenant1', 'conv_old_saved')

      const { result } = renderHook(() =>
        useAgentConnection({
          tenantId: 'tenant1',
          sessionId: 'conv_explicit_override',
        })
      )

      expect(result.current.sessionId).toBe('conv_explicit_override')
    })

    it('should persist explicit sessionId to user-scoped key', () => {
      renderHook(() =>
        useAgentConnection({
          tenantId: 'tenant1',
          userId: 'alice',
          sessionId: 'conv_from_sidebar',
        })
      )

      expect(localStorage.getItem('ccaas_session_tenant1_alice')).toBe('conv_from_sidebar')
    })
  })
})
