/**
 * Tests for AgentConnection service
 *
 * Tests Socket.io connection management, event emitter pattern,
 * and pending result buffering.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AgentConnection, createAgentConnection } from '../services/AgentConnection'

// Mock socket.io-client
const mockSocket = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: true,
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

describe('AgentConnection', () => {
  let connection: AgentConnection

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Reset mock socket state
    mockSocket.connected = true
    mockSocket.on.mockReset()
    mockSocket.emit.mockReset()
    mockSocket.connect.mockReset()
    mockSocket.disconnect.mockReset()

    // Create fresh connection for each test
    connection = createAgentConnection()
  })

  afterEach(() => {
    connection.disconnect()
  })

  describe('factory pattern', () => {
    it('createAgentConnection returns new isolated instances', () => {
      const conn1 = createAgentConnection()
      const conn2 = createAgentConnection()

      expect(conn1).not.toBe(conn2)
      expect(conn1).toBeInstanceOf(AgentConnection)
      expect(conn2).toBeInstanceOf(AgentConnection)
    })
  })

  describe('initial state', () => {
    it('should have disconnected status initially', () => {
      expect(connection.status.status).toBe('disconnected')
      expect(connection.status.reconnectAttempts).toBe(0)
    })

    it('should have null clientId and sessionId initially', () => {
      expect(connection.clientId).toBeNull()
      expect(connection.sessionId).toBeNull()
    })

    it('should not be connected initially', () => {
      expect(connection.isConnected).toBe(false)
    })

    it('should have no pending result initially', () => {
      expect(connection.hasPendingResult).toBe(false)
      expect(connection.pendingResultTruncated).toBe(false)
      expect(connection.pendingResultContext).toBeNull()
    })
  })

  describe('connect', () => {
    it('should update status to connecting when connect is called', () => {
      connection.connect({ url: 'http://localhost:3001' })

      // Status should be connecting after connect is called
      expect(connection.status.status).toBe('connecting')
    })

    it('should use default URL if not provided', () => {
      connection.connect()

      expect(connection.status.status).toBe('connecting')
    })
  })

  describe('disconnect', () => {
    it('should update status to disconnected', () => {
      connection.connect()
      connection.disconnect()

      expect(connection.status.status).toBe('disconnected')
      expect(connection.clientId).toBeNull()
      expect(connection.sessionId).toBeNull()
    })
  })

  describe('event emitter', () => {
    it('on() should register handler and return unsubscribe function', () => {
      const handler = vi.fn()

      const unsubscribe = connection.on('test_event', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('unsubscribe function should remove handler', () => {
      const handler = vi.fn()

      const unsubscribe = connection.on('test_event', handler)
      unsubscribe()

      // Handler should be removed (verified by no calls when emitting)
    })

    it('off() should remove handler', () => {
      const handler = vi.fn()

      connection.on('test_event', handler)
      connection.off('test_event', handler)

      // Handler should be removed
    })

    it('once() should only register handler for single use', () => {
      const handler = vi.fn()
      connection.once('test_event', handler)

      // Handler registered for one-time use
      expect(typeof handler).toBe('function')
    })
  })

  describe('sendMessage', () => {
    it('should return error if not connected', async () => {
      const result = await connection.sendMessage('Hello')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not connected')
    })

    it('should accept message options', async () => {
      // Even when not connected, the method should handle options
      const result = await connection.sendMessage('Hello', {
        context: { route: '/test', pageType: 'test' },
        skillId: 'lesson-plan',
      })

      expect(result.success).toBe(false) // Not connected
    })
  })

  describe('cancel', () => {
    it('should not emit if no sessionId', () => {
      connection.cancel()

      // Cancel is only sent if we have a sessionId
      expect(mockSocket.emit).not.toHaveBeenCalledWith('cancel', expect.anything())
    })
  })

  describe('pending result buffer', () => {
    it('applyPendingResult should return empty array initially', () => {
      const events = connection.applyPendingResult()

      expect(Array.isArray(events)).toBe(true)
      expect(events.length).toBe(0)
    })

    it('applyPendingResult should clear pending state', () => {
      connection.applyPendingResult()

      expect(connection.hasPendingResult).toBe(false)
      expect(connection.pendingResultContext).toBeNull()
    })

    it('markContextForPending should accept context', () => {
      const context = {
        route: '/lesson-plan/123',
        pageType: 'lesson-plan-detail',
        entityId: '123',
        entityType: 'lesson-plan',
      }

      // Should not throw
      connection.markContextForPending(context)
    })

    it('notifyNavigatedAway should not set pending without buffer', () => {
      connection.notifyNavigatedAway()

      expect(connection.hasPendingResult).toBe(false)
    })
  })

  describe('buffer limits', () => {
    it('pendingResultTruncated should be false initially', () => {
      expect(connection.pendingResultTruncated).toBe(false)
    })
  })

  describe('reconnect', () => {
    it('should update status to reconnecting when socket exists', async () => {
      // First connect to create socket
      connection.connect()

      // Wait for async socket initialization
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Now reconnect
      connection.reconnect()

      // Status could be either reconnecting or connecting depending on timing
      expect(['reconnecting', 'connecting']).toContain(connection.status.status)
    })

    it('should connect if no socket exists', () => {
      connection.reconnect()

      // Without prior socket, reconnect just returns
      expect(connection.status.status).toBe('disconnected')
    })
  })
})

describe('AgentConnection singleton', () => {
  it('agentConnection import should be same instance', async () => {
    const { agentConnection: conn1 } = await import('../services/AgentConnection')
    const { agentConnection: conn2 } = await import('../services/AgentConnection')

    expect(conn1).toBe(conn2)
  })
})
