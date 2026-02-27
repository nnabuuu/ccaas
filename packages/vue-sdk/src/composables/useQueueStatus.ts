/**
 * useQueueStatus Composable
 *
 * Message queue monitoring via WebSocket events and REST API.
 * Tracks queue depth, processing status, and individual queue items.
 *
 * Ported from @kedge-agentic/react-sdk useQueueStatus hook.
 */

import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { Socket } from 'socket.io-client'

// ============================================================================
// Types (defined inline per requirements)
// ============================================================================

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
 * Queue processing event (WebSocket) - message started
 */
export interface MessageProcessingStartedEvent {
  queueItemId: string
  sessionId: string
  position: number
  message: string
}

/**
 * Queue processing event (WebSocket) - message completed
 */
export interface MessageProcessingCompletedEvent {
  queueItemId: string
  sessionId: string
  userMessageId: string
  assistantMessageId: string
  durationMs: number
}

/**
 * Queue processing event (WebSocket) - message failed
 */
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
 * Composable options
 */
export interface UseQueueStatusOptions {
  /** Socket.io connection (from useAgentConnection) */
  socket: Ref<Socket | null>

  /** Session ID to monitor */
  sessionId: Ref<string>

  /** Backend server URL (for REST API calls) */
  serverUrl: string

  /** Whether to auto-load queue status on mount (default: true) */
  autoLoad?: boolean

  /** Polling interval for queue status in ms (0 = no polling, default: 0) */
  pollingInterval?: number
}

/**
 * Composable return value
 */
export interface UseQueueStatusReturn {
  /** Current processing status */
  processingStatus: Readonly<Ref<ProcessingStatus>>

  /** Queue depth (total, pending, processing counts) */
  queueDepth: Readonly<Ref<QueueDepth>>

  /** Queue items list (only active items by default) */
  queueItems: Readonly<Ref<QueueItem[]>>

  /** Loading state for initial load */
  loading: Readonly<Ref<boolean>>

  /** Error state */
  error: Readonly<Ref<Error | null>>

  /** Manually refresh queue status from API */
  refresh: () => Promise<void>

  /** Get details of a specific queue item by ID */
  getQueueItem: (queueItemId: string) => Promise<QueueItem | null>
}

/**
 * Queue status composable for monitoring message queue events.
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
 * ```vue
 * <script setup>
 * import { useAgentConnection } from '@kedge-agentic/vue-sdk'
 * import { useQueueStatus } from '@kedge-agentic/vue-sdk'
 * import { toRef } from 'vue'
 *
 * const connection = useAgentConnection({ serverUrl: 'http://localhost:3001' })
 * const queue = useQueueStatus({
 *   socket: toRef(() => connection.socket),
 *   sessionId: toRef(() => connection.sessionId),
 *   serverUrl: 'http://localhost:3001',
 * })
 * </script>
 *
 * <template>
 *   <div>
 *     <div v-if="queue.processingStatus.value.status === 'processing'">
 *       Processing message...
 *     </div>
 *     <div v-if="queue.queueDepth.value.pending > 0">
 *       {{ queue.queueDepth.value.pending }} messages in queue
 *     </div>
 *   </div>
 * </template>
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
  const processingStatus = ref<ProcessingStatus>({ status: 'idle' })
  const queueDepth = ref<QueueDepth>({ total: 0, pending: 0, processing: 0 })
  const queueItems = ref<QueueItem[]>([])
  const loading = ref(autoLoad)
  const error = ref<Error | null>(null)

  // Polling timer
  let pollingTimer: ReturnType<typeof setInterval> | null = null

  // Completion reset timer
  let completionResetTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Fetch queue status from REST API
   */
  async function fetchQueueStatus(): Promise<void> {
    if (!sessionId.value || !serverUrl) return

    try {
      const url = `${serverUrl}/api/v1/sessions/${sessionId.value}/queue`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch queue status: ${response.statusText}`)
      }

      const data = await response.json()

      queueDepth.value = {
        total: data.total || 0,
        pending: data.pending || 0,
        processing: data.processing || 0,
      }

      queueItems.value = data.items || []

      // Update processing status based on queue state
      if (data.processing > 0) {
        const processingItem = data.items?.find((item: QueueItem) => item.status === 'processing')
        if (processingItem) {
          processingStatus.value = {
            status: 'processing',
            queueItemId: processingItem.id,
            position: data.total,
          }
        }
      } else if (data.pending > 0) {
        processingStatus.value = {
          status: 'idle',
          position: data.pending,
        }
      } else {
        processingStatus.value = { status: 'idle' }
      }

      error.value = null
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Unknown error')
      console.error('[useQueueStatus] Failed to fetch queue status:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * Get details of a specific queue item
   */
  async function getQueueItem(queueItemId: string): Promise<QueueItem | null> {
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
  }

  // --- Socket event handlers ---

  function handleQueueStatus(data: QueueStatusEvent): void {
    queueDepth.value = {
      total: data.pending + data.processing,
      pending: data.pending,
      processing: data.processing,
    }

    processingStatus.value = {
      status: data.processing > 0 ? 'processing' : 'idle',
      queueItemId: data.queueItemId,
      position: data.position,
    }
  }

  function handleProcessingStarted(data: MessageProcessingStartedEvent): void {
    processingStatus.value = {
      status: 'processing',
      queueItemId: data.queueItemId,
      position: data.position,
    }

    // Update queue items
    queueItems.value = queueItems.value.map((item) =>
      item.id === data.queueItemId
        ? { ...item, status: 'processing' as QueueItemStatus, startedAt: new Date() }
        : item,
    )
  }

  function handleProcessingCompleted(data: MessageProcessingCompletedEvent): void {
    processingStatus.value = {
      status: 'completed',
      queueItemId: data.queueItemId,
      durationMs: data.durationMs,
    }

    // Update queue items
    queueItems.value = queueItems.value.map((item) =>
      item.id === data.queueItemId
        ? {
            ...item,
            status: 'completed' as QueueItemStatus,
            completedAt: new Date(),
            durationMs: data.durationMs,
            userMessageId: data.userMessageId,
            assistantMessageId: data.assistantMessageId,
          }
        : item,
    )

    // Update queue depth (decrease processing count)
    queueDepth.value = {
      total: Math.max(0, queueDepth.value.total - 1),
      pending: queueDepth.value.pending,
      processing: Math.max(0, queueDepth.value.processing - 1),
    }

    // Reset to idle after a short delay
    if (completionResetTimer) clearTimeout(completionResetTimer)
    completionResetTimer = setTimeout(() => {
      processingStatus.value = { status: 'idle' }
    }, 2000)
  }

  function handleProcessingFailed(data: MessageProcessingFailedEvent): void {
    if (data.status === 'pending') {
      // Will retry
      processingStatus.value = {
        status: 'retrying',
        queueItemId: data.queueItemId,
        retryCount: data.retryCount,
        maxRetries: data.maxRetries,
        nextRetryAt: data.nextRetryAt ? new Date(data.nextRetryAt) : null,
        error: data.error,
      }
    } else {
      // Permanent failure
      processingStatus.value = {
        status: 'failed',
        queueItemId: data.queueItemId,
        retryCount: data.retryCount,
        maxRetries: data.maxRetries,
        error: data.error,
      }
    }

    // Update queue items
    queueItems.value = queueItems.value.map((item) =>
      item.id === data.queueItemId
        ? {
            ...item,
            status: data.status as QueueItemStatus,
            retryCount: data.retryCount,
            error: data.error,
            nextRetryAt: data.nextRetryAt ? new Date(data.nextRetryAt) : null,
          }
        : item,
    )
  }

  /**
   * Attach/detach socket event listeners when socket changes
   */
  function attachListeners(sock: Socket): void {
    sock.on('queue_status', handleQueueStatus)
    sock.on('message_processing_started', handleProcessingStarted)
    sock.on('message_processing_completed', handleProcessingCompleted)
    sock.on('message_processing_failed', handleProcessingFailed)
  }

  function detachListeners(sock: Socket): void {
    sock.off('queue_status', handleQueueStatus)
    sock.off('message_processing_started', handleProcessingStarted)
    sock.off('message_processing_completed', handleProcessingCompleted)
    sock.off('message_processing_failed', handleProcessingFailed)
  }

  // Watch socket changes
  let currentSocket: Socket | null = null

  watch(socket, (newSocket, oldSocket) => {
    if (oldSocket) detachListeners(oldSocket)
    if (newSocket) attachListeners(newSocket)
    currentSocket = newSocket
  }, { immediate: true })

  // Auto-load on mount
  if (autoLoad) {
    fetchQueueStatus()
  }

  // Setup polling if enabled
  if (pollingInterval > 0) {
    pollingTimer = setInterval(fetchQueueStatus, pollingInterval)
  }

  // Cleanup on unmount
  onUnmounted(() => {
    if (currentSocket) detachListeners(currentSocket)
    if (pollingTimer) clearInterval(pollingTimer)
    if (completionResetTimer) clearTimeout(completionResetTimer)
  })

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

export default useQueueStatus
