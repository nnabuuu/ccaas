import { useState, useEffect, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'

/**
 * Queue item status
 */
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/**
 * Queue item
 */
export interface QueueItem {
  id: string
  status: QueueItemStatus
  message: string
  priority: number
  retryCount: number
  maxRetries: number
  nextRetryAt: Date | null
  createdAt: Date
  startedAt: Date | null
  completedAt?: Date | null
  durationMs?: number | null
  error?: string | null
  userMessageId?: string | null
  assistantMessageId?: string | null
}

/**
 * Queue depth statistics
 */
export interface QueueDepth {
  total: number
  pending: number
  processing: number
}

/**
 * Queue processing event (WebSocket)
 */
export interface MessageProcessingStartedEvent {
  queueItemId: string
  sessionId: string
  position: number
  message: string
}

export interface MessageProcessingCompletedEvent {
  queueItemId: string
  sessionId: string
  userMessageId: string
  assistantMessageId: string
  durationMs: number
}

export interface MessageProcessingFailedEvent {
  queueItemId: string
  sessionId: string
  error: string
  retryCount: number
  maxRetries: number
  nextRetryAt: Date | null
  status: 'pending' | 'failed' // 'pending' = will retry, 'failed' = permanent
}

/**
 * Queue status event (from chat enqueue)
 */
export interface QueueStatusEvent {
  queueItemId: string
  position: number
  pending: number
  processing: number
}

/**
 * Current processing status
 */
export interface ProcessingStatus {
  status: 'idle' | 'processing' | 'retrying' | 'completed' | 'failed'
  queueItemId?: string
  position?: number
  retryCount?: number
  maxRetries?: number
  nextRetryAt?: Date | null
  error?: string
  durationMs?: number
}

/**
 * Hook options
 */
export interface UseQueueStatusOptions {
  /** Socket.io connection (from useAgentConnection) */
  socket: Socket | null

  /** Session ID to monitor */
  sessionId: string

  /** Backend server URL (for REST API calls) */
  serverUrl: string

  /** Whether to auto-load queue status on mount (default: true) */
  autoLoad?: boolean

  /** Polling interval for queue status in ms (0 = no polling, default: 0) */
  pollingInterval?: number
}

/**
 * Hook return value
 */
export interface UseQueueStatusReturn {
  /** Current processing status */
  processingStatus: ProcessingStatus

  /** Queue depth (total, pending, processing counts) */
  queueDepth: QueueDepth

  /** Queue items list (only active items by default) */
  queueItems: QueueItem[]

  /** Loading state for initial load */
  loading: boolean

  /** Error state */
  error: Error | null

  /** Manually refresh queue status from API */
  refresh: () => Promise<void>

  /** Get details of a specific queue item by ID */
  getQueueItem: (queueItemId: string) => Promise<QueueItem | null>
}

/**
 * useQueueStatus - Monitor message queue status and events
 *
 * Monitors message queue status via WebSocket events and REST API.
 *
 * **Features**:
 * - Real-time queue events (started, completed, failed)
 * - Queue depth tracking (total, pending, processing)
 * - Queue item list management
 * - Automatic state recovery on mount
 * - Optional polling for queue updates
 *
 * **WebSocket Events**:
 * - `queue_status` - Initial queue status (on enqueue)
 * - `message_processing_started` - Message processing started
 * - `message_processing_completed` - Message completed successfully
 * - `message_processing_failed` - Message failed (with retry info)
 *
 * @example
 * ```tsx
 * function ChatWithQueue() {
 *   const connection = useAgentConnection({ serverUrl: 'http://localhost:3001' })
 *   const queue = useQueueStatus({
 *     socket: connection.socket,
 *     sessionId: 'session-123',
 *     serverUrl: 'http://localhost:3001',
 *   })
 *
 *   return (
 *     <div>
 *       {queue.processingStatus.status === 'processing' && (
 *         <Alert>Processing message {queue.processingStatus.position}...</Alert>
 *       )}
 *       {queue.queueDepth.pending > 0 && (
 *         <Alert>{queue.queueDepth.pending} messages in queue</Alert>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useQueueStatus(options: UseQueueStatusOptions): UseQueueStatusReturn {
  const {
    socket,
    sessionId,
    serverUrl,
    autoLoad = true,
    pollingInterval = 0,
  } = options

  // State
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({ status: 'idle' })
  const [queueDepth, setQueueDepth] = useState<QueueDepth>({ total: 0, pending: 0, processing: 0 })
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(autoLoad)
  const [error, setError] = useState<Error | null>(null)

  // Refs for polling
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Fetch queue status from REST API
   */
  const fetchQueueStatus = useCallback(async () => {
    if (!sessionId || !serverUrl) return

    try {
      const url = `${serverUrl}/api/v1/sessions/${sessionId}/queue`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch queue status: ${response.statusText}`)
      }

      const data = await response.json()

      setQueueDepth({
        total: data.total || 0,
        pending: data.pending || 0,
        processing: data.processing || 0,
      })

      setQueueItems(data.items || [])

      // Update processing status based on queue state
      if (data.processing > 0) {
        const processingItem = data.items?.find((item: QueueItem) => item.status === 'processing')
        if (processingItem) {
          setProcessingStatus({
            status: 'processing',
            queueItemId: processingItem.id,
            position: data.total,
          })
        }
      } else if (data.pending > 0) {
        setProcessingStatus({
          status: 'idle',
          position: data.pending,
        })
      } else {
        setProcessingStatus({ status: 'idle' })
      }

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
      console.error('[useQueueStatus] Failed to fetch queue status:', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId, serverUrl])

  /**
   * Get details of a specific queue item
   */
  const getQueueItem = useCallback(async (queueItemId: string): Promise<QueueItem | null> => {
    if (!serverUrl) return null

    try {
      const url = `${serverUrl}/api/v1/queue/${queueItemId}`
      const response = await fetch(url)

      if (!response.ok) {
        if (response.status === 404) return null
        throw new Error(`Failed to fetch queue item: ${response.statusText}`)
      }

      return await response.json()
    } catch (err) {
      console.error('[useQueueStatus] Failed to fetch queue item:', err)
      return null
    }
  }, [serverUrl])

  /**
   * Handle queue_status event (initial queue status on enqueue)
   */
  useEffect(() => {
    if (!socket) return

    const handleQueueStatus = (data: QueueStatusEvent) => {
      setQueueDepth({
        total: data.pending + data.processing,
        pending: data.pending,
        processing: data.processing,
      })

      setProcessingStatus({
        status: data.processing > 0 ? 'processing' : 'idle',
        queueItemId: data.queueItemId,
        position: data.position,
      })
    }

    socket.on('queue_status', handleQueueStatus)
    return () => {
      socket.off('queue_status', handleQueueStatus)
    }
  }, [socket])

  /**
   * Handle message_processing_started event
   */
  useEffect(() => {
    if (!socket) return

    const handleProcessingStarted = (data: MessageProcessingStartedEvent) => {
      setProcessingStatus({
        status: 'processing',
        queueItemId: data.queueItemId,
        position: data.position,
      })

      // Update queue items
      setQueueItems((prev) =>
        prev.map((item) =>
          item.id === data.queueItemId
            ? { ...item, status: 'processing' as QueueItemStatus, startedAt: new Date() }
            : item
        )
      )
    }

    socket.on('message_processing_started', handleProcessingStarted)
    return () => {
      socket.off('message_processing_started', handleProcessingStarted)
    }
  }, [socket])

  /**
   * Handle message_processing_completed event
   */
  useEffect(() => {
    if (!socket) return

    const handleProcessingCompleted = (data: MessageProcessingCompletedEvent) => {
      setProcessingStatus({
        status: 'completed',
        queueItemId: data.queueItemId,
        durationMs: data.durationMs,
      })

      // Update queue items
      setQueueItems((prev) =>
        prev.map((item) =>
          item.id === data.queueItemId
            ? {
                ...item,
                status: 'completed' as QueueItemStatus,
                completedAt: new Date(),
                durationMs: data.durationMs,
                userMessageId: data.userMessageId,
                assistantMessageId: data.assistantMessageId,
              }
            : item
        )
      )

      // Update queue depth (decrease processing count)
      setQueueDepth((prev) => ({
        total: Math.max(0, prev.total - 1),
        pending: prev.pending,
        processing: Math.max(0, prev.processing - 1),
      }))

      // Reset to idle after a short delay
      setTimeout(() => {
        setProcessingStatus({ status: 'idle' })
      }, 2000)
    }

    socket.on('message_processing_completed', handleProcessingCompleted)
    return () => {
      socket.off('message_processing_completed', handleProcessingCompleted)
    }
  }, [socket])

  /**
   * Handle message_processing_failed event
   */
  useEffect(() => {
    if (!socket) return

    const handleProcessingFailed = (data: MessageProcessingFailedEvent) => {
      if (data.status === 'pending') {
        // Will retry
        setProcessingStatus({
          status: 'retrying',
          queueItemId: data.queueItemId,
          retryCount: data.retryCount,
          maxRetries: data.maxRetries,
          nextRetryAt: data.nextRetryAt ? new Date(data.nextRetryAt) : null,
          error: data.error,
        })
      } else {
        // Permanent failure
        setProcessingStatus({
          status: 'failed',
          queueItemId: data.queueItemId,
          retryCount: data.retryCount,
          maxRetries: data.maxRetries,
          error: data.error,
        })
      }

      // Update queue items
      setQueueItems((prev) =>
        prev.map((item) =>
          item.id === data.queueItemId
            ? {
                ...item,
                status: data.status as QueueItemStatus,
                retryCount: data.retryCount,
                error: data.error,
                nextRetryAt: data.nextRetryAt ? new Date(data.nextRetryAt) : null,
              }
            : item
        )
      )
    }

    socket.on('message_processing_failed', handleProcessingFailed)
    return () => {
      socket.off('message_processing_failed', handleProcessingFailed)
    }
  }, [socket])

  /**
   * Initial load on mount
   */
  useEffect(() => {
    if (autoLoad) {
      fetchQueueStatus()
    }
  }, [autoLoad, fetchQueueStatus])

  /**
   * Setup polling if enabled
   */
  useEffect(() => {
    if (pollingInterval > 0) {
      pollingTimerRef.current = setInterval(fetchQueueStatus, pollingInterval)
      return () => {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current)
        }
      }
    }
  }, [pollingInterval, fetchQueueStatus])

  return {
    processingStatus,
    queueDepth,
    queueItems,
    loading,
    error,
    refresh: fetchQueueStatus,
    getQueueItem,
  }
}
