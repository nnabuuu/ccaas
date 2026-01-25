/**
 * Tests for useAgentChat composable
 *
 * Tests reactive state management, event subscription,
 * and connection management wrapping.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { AgentConnection, createAgentConnection } from '../services/AgentConnection'
import { useAgentChat } from '../composables/useAgentChat'

describe('useAgentChat', () => {
  let mockConnection: AgentConnection

  beforeEach(() => {
    vi.clearAllMocks()

    // Create a fresh connection instance for each test
    mockConnection = createAgentConnection()

    // Spy on connection methods
    vi.spyOn(mockConnection, 'connect')
    vi.spyOn(mockConnection, 'disconnect')
    vi.spyOn(mockConnection, 'reconnect')
    vi.spyOn(mockConnection, 'sendMessage').mockResolvedValue({ success: true, sessionId: 'mock-session' })
    vi.spyOn(mockConnection, 'cancel')
    vi.spyOn(mockConnection, 'on').mockReturnValue(vi.fn())
    vi.spyOn(mockConnection, 'off')
    vi.spyOn(mockConnection, 'applyPendingResult').mockReturnValue([])
    vi.spyOn(mockConnection, 'notifyNavigatedAway')
    vi.spyOn(mockConnection, 'markContextForPending')
  })

  describe('initial state', () => {
    it('should initialize with disconnected state', () => {
      const { isConnected, connectionStatus } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      expect(isConnected.value).toBe(false)
      expect(connectionStatus.value.status).toBe('disconnected')
    })

    it('should have null sessionId and clientId initially', () => {
      const { sessionId, clientId } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      expect(sessionId.value).toBeNull()
      expect(clientId.value).toBeNull()
    })

    it('should have no pending result initially', () => {
      const { hasPendingResult, pendingResultTruncated, pendingResultContext } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      expect(hasPendingResult.value).toBe(false)
      expect(pendingResultTruncated.value).toBe(false)
      expect(pendingResultContext.value).toBeNull()
    })
  })

  describe('sendMessage', () => {
    it('should call connection.sendMessage with message and options', async () => {
      const { sendMessage } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      const options = {
        context: { route: '/test', pageType: 'test' },
        skillId: 'lesson-plan',
      }

      await sendMessage('Hello', options)

      expect(mockConnection.sendMessage).toHaveBeenCalledWith('Hello', options)
    })

    it('should return result from connection.sendMessage', async () => {
      vi.spyOn(mockConnection, 'sendMessage').mockResolvedValueOnce({
        success: true,
        sessionId: 'new-session-123',
      })

      const { sendMessage } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      const result = await sendMessage('Hello')

      expect(result.success).toBe(true)
      expect(result.sessionId).toBe('new-session-123')
    })

    it('should handle sendMessage failure', async () => {
      vi.spyOn(mockConnection, 'sendMessage').mockResolvedValueOnce({
        success: false,
        error: 'Not connected',
      })

      const { sendMessage } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      const result = await sendMessage('Hello')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not connected')
    })
  })

  describe('on/off event subscription', () => {
    it('on() should forward to connection.on and return unsubscribe', () => {
      const handler = vi.fn()
      const mockUnsubscribe = vi.fn()
      vi.spyOn(mockConnection, 'on').mockReturnValueOnce(mockUnsubscribe)

      const { on } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      const unsubscribe = on('text_delta', handler)

      expect(mockConnection.on).toHaveBeenCalledWith('text_delta', handler)
      expect(typeof unsubscribe).toBe('function')
    })

    it('off() should forward to connection.off', () => {
      const handler = vi.fn()

      const { off } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      off('text_delta', handler)

      expect(mockConnection.off).toHaveBeenCalledWith('text_delta', handler)
    })

    it('unsubscribe function from on() should work', () => {
      const handler = vi.fn()
      const mockUnsubscribe = vi.fn()
      vi.spyOn(mockConnection, 'on').mockReturnValueOnce(mockUnsubscribe)

      const { on } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      const unsubscribe = on('text_delta', handler)
      unsubscribe()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('cancel', () => {
    it('should forward to connection.cancel', () => {
      const { cancel } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      cancel()

      expect(mockConnection.cancel).toHaveBeenCalled()
    })
  })

  describe('applyPendingResult', () => {
    it('should return buffered events from connection', () => {
      const mockEvents = [
        { field: 'textbook_analysis', content: 'Analysis content' },
        { field: 'learning_objectives', content: 'Objectives content' },
      ]
      vi.spyOn(mockConnection, 'applyPendingResult').mockReturnValueOnce(mockEvents as any)

      const { applyPendingResult } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      const events = applyPendingResult()

      expect(events).toEqual(mockEvents)
      expect(mockConnection.applyPendingResult).toHaveBeenCalled()
    })
  })

  describe('notifyNavigatedAway', () => {
    it('should forward to connection.notifyNavigatedAway', () => {
      const { notifyNavigatedAway } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      notifyNavigatedAway()

      expect(mockConnection.notifyNavigatedAway).toHaveBeenCalled()
    })
  })

  describe('markContextForPending', () => {
    it('should forward to connection.markContextForPending', () => {
      const context = {
        route: '/lesson-plan/123',
        pageType: 'lesson-plan-detail',
        entityId: '123',
        entityType: 'lesson-plan',
      }

      const { markContextForPending } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      markContextForPending(context)

      expect(mockConnection.markContextForPending).toHaveBeenCalledWith(context)
    })
  })

  describe('connection management', () => {
    it('connect() should forward to connection.connect', () => {
      const { connect } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      connect({ url: 'http://localhost:4000' })

      expect(mockConnection.connect).toHaveBeenCalled()
    })

    it('disconnect() should forward to connection.disconnect', () => {
      const { disconnect } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      disconnect()

      expect(mockConnection.disconnect).toHaveBeenCalled()
    })

    it('reconnect() should forward to connection.reconnect', () => {
      const { reconnect } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      reconnect()

      expect(mockConnection.reconnect).toHaveBeenCalled()
    })
  })

  describe('reconnectSession', () => {
    it('should call sendMessage with sessionId and startNewSession: false', async () => {
      vi.spyOn(mockConnection, 'sendMessage').mockResolvedValueOnce({
        success: true,
        sessionId: 'existing-session',
      })

      const { reconnectSession } = useAgentChat({
        autoConnect: false,
        connection: mockConnection,
      })

      await reconnectSession('existing-session')

      expect(mockConnection.sendMessage).toHaveBeenCalledWith('', {
        sessionId: 'existing-session',
        startNewSession: false,
      })
    })
  })
})
