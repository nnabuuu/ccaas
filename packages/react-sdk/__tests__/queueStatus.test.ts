import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useQueueStatus } from '../src/hooks/useQueueStatus'
import type { Socket } from 'socket.io-client'

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

describe('useQueueStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(handlers).forEach(key => delete handlers[key])
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: false,
      })
    )

    expect(result.current.processingStatus).toEqual({ status: 'idle' })
    expect(result.current.queueDepth).toEqual({ total: 0, pending: 0, processing: 0 })
    expect(result.current.queueItems).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('should register WebSocket event listeners', () => {
    renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: false,
      })
    )

    expect(mockSocket.on).toHaveBeenCalledWith('queue_status', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('message_processing_started', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('message_processing_completed', expect.any(Function))
    expect(mockSocket.on).toHaveBeenCalledWith('message_processing_failed', expect.any(Function))
  })

  it('should fetch queue status on mount when autoLoad is true', async () => {
    const mockResponse = {
      total: 2,
      pending: 1,
      processing: 1,
      items: [
        {
          id: 'item-1',
          sessionId: 'test-session',
          status: 'processing' as const,
          message: 'Test message',
          priority: 0,
          retryCount: 0,
          maxRetries: 2,
          nextRetryAt: null,
          createdAt: new Date(),
          startedAt: new Date(),
          completedAt: null,
          error: null,
        },
      ],
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })

    const { result } = renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: true,
      })
    )

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.queueDepth).toEqual({ total: 2, pending: 1, processing: 1 })
    expect(result.current.queueItems).toHaveLength(1)
  })

  it('should handle queue_status event', () => {
    const { result } = renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: false,
      })
    )

    // Get the queue_status handler
    const queueStatusHandler = handlers['queue_status']

    // Simulate queue_status event
    act(() => {
      queueStatusHandler({
        queueItemId: 'item-1',
        position: 1,
        pending: 2,
        processing: 1,
      })
    })

    expect(result.current.queueDepth).toEqual({ total: 3, pending: 2, processing: 1 })
    expect(result.current.processingStatus).toEqual({
      status: 'processing',
      queueItemId: 'item-1',
      position: 1,
    })
  })

  it('should handle message_processing_started event', () => {
    const { result } = renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: false,
      })
    )

    // Get the handler
    const handler = handlers['message_processing_started']

    // Simulate event
    act(() => {
      handler({
        queueItemId: 'item-1',
        sessionId: 'test-session',
        position: 1,
        message: 'Test message',
      })
    })

    expect(result.current.processingStatus).toEqual({
      status: 'processing',
      queueItemId: 'item-1',
      position: 1,
    })
  })

  it('should handle message_processing_completed event', async () => {
    vi.useFakeTimers()

    const { result } = renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: false,
      })
    )

    // Get the handler
    const handler = handlers['message_processing_completed']

    // Simulate event
    act(() => {
      handler({
        queueItemId: 'item-1',
        sessionId: 'test-session',
        userMessageId: 'user-msg-1',
        assistantMessageId: 'assistant-msg-1',
        durationMs: 5000,
      })
    })

    expect(result.current.processingStatus).toEqual({
      status: 'completed',
      queueItemId: 'item-1',
      durationMs: 5000,
    })

    // Should reset to idle after 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.processingStatus).toEqual({ status: 'idle' })

    vi.useRealTimers()
  })

  it('should handle message_processing_failed event with retry', () => {
    const { result } = renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: false,
      })
    )

    // Get the handler
    const handler = handlers['message_processing_failed']

    // Simulate event (will retry)
    act(() => {
      handler({
        queueItemId: 'item-1',
        sessionId: 'test-session',
        error: 'Test error',
        retryCount: 1,
        maxRetries: 2,
        nextRetryAt: new Date(Date.now() + 2000),
        status: 'pending',
      })
    })

    expect(result.current.processingStatus.status).toBe('retrying')
    expect(result.current.processingStatus.error).toBe('Test error')
    expect(result.current.processingStatus.retryCount).toBe(1)
  })

  it('should handle message_processing_failed event permanent failure', () => {
    const { result } = renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: false,
      })
    )

    // Get the handler
    const handler = handlers['message_processing_failed']

    // Simulate event (permanent failure)
    act(() => {
      handler({
        queueItemId: 'item-1',
        sessionId: 'test-session',
        error: 'Test error',
        retryCount: 3,
        maxRetries: 2,
        nextRetryAt: null,
        status: 'failed',
      })
    })

    expect(result.current.processingStatus.status).toBe('failed')
    expect(result.current.processingStatus.error).toBe('Test error')
  })

  it('should unregister event listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      useQueueStatus({
        socket: mockSocket as unknown as Socket,
        sessionId: 'test-session',
        serverUrl: 'http://localhost:3001',
        autoLoad: false,
      })
    )

    unmount()

    expect(mockSocket.off).toHaveBeenCalledWith('queue_status', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('message_processing_started', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('message_processing_completed', expect.any(Function))
    expect(mockSocket.off).toHaveBeenCalledWith('message_processing_failed', expect.any(Function))
  })
})
