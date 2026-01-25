/**
 * useAgentChat Composable
 *
 * Provides reactive Socket.io connection management for Vue components.
 * Wraps the AgentConnection singleton with Vue reactivity.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useAgentChat } from '@ccaas/vue-sdk'
 *
 * const {
 *   isConnected,
 *   sessionId,
 *   sendMessage,
 *   on,
 *   cancel
 * } = useAgentChat()
 *
 * // Send a message
 * await sendMessage('Help me create a lesson plan', {
 *   context: { entityType: 'lesson-plan', entityId: '123' }
 * })
 *
 * // Subscribe to events
 * on('text_delta', (data) => {
 *   console.log('Received:', data.text)
 * })
 * </script>
 * ```
 */

import { ref, computed, onMounted, onUnmounted, readonly } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import {
  AgentConnection,
  agentConnection as defaultConnection,
  createAgentConnection,
  type PendingResultContext,
} from '../services/AgentConnection'
import type {
  AgentConnectionConfig,
  ConnectionState,
  SendMessageOptions,
  SendMessageResult,
  PageContext,
} from '../types/connection'

/**
 * Options for useAgentChat
 */
export interface UseAgentChatOptions extends AgentConnectionConfig {
  /**
   * Custom AgentConnection instance (for testing).
   * If not provided, uses the default singleton.
   */
  connection?: AgentConnection

  /**
   * Auto-connect on mount (default: true)
   */
  autoConnect?: boolean
}

/**
 * Return type for useAgentChat
 */
export interface UseAgentChatReturn {
  // Connection state
  /** Whether connected to the backend */
  isConnected: ComputedRef<boolean>
  /** Full connection state */
  connectionStatus: Readonly<Ref<ConnectionState>>
  /** Current session ID */
  sessionId: Readonly<Ref<string | null>>
  /** Client ID assigned by backend */
  clientId: Readonly<Ref<string | null>>

  // Pending result state
  /** Whether there's a pending result from cross-page navigation */
  hasPendingResult: Readonly<Ref<boolean>>
  /** Whether pending result was truncated due to buffer limits */
  pendingResultTruncated: Readonly<Ref<boolean>>
  /** Context of the pending result */
  pendingResultContext: Readonly<Ref<PendingResultContext | null>>

  // Methods
  /** Send a chat message */
  sendMessage: (message: string, options?: SendMessageOptions) => Promise<SendMessageResult>
  /** Cancel the current operation */
  cancel: () => void
  /** Reconnect to an existing session */
  reconnectSession: (sessionId: string) => Promise<SendMessageResult>
  /** Apply pending result (returns buffered events) */
  applyPendingResult: () => import('../types/events').OutputUpdateEvent[]
  /** Notify that user has navigated away */
  notifyNavigatedAway: () => void
  /** Mark context for pending result tracking */
  markContextForPending: (context: PageContext) => void

  // Event subscription
  /** Subscribe to an event */
  on: <T = unknown>(event: string, handler: (data: T) => void) => () => void
  /** Unsubscribe from an event */
  off: <T = unknown>(event: string, handler: (data: T) => void) => void

  // Connection management
  /** Connect to the backend */
  connect: (config?: AgentConnectionConfig) => void
  /** Disconnect from the backend */
  disconnect: () => void
  /** Reconnect to the backend */
  reconnect: () => void
}

/**
 * Agent chat composable
 *
 * Provides reactive Socket.io connection management.
 */
export function useAgentChat(options?: UseAgentChatOptions): UseAgentChatReturn {
  // Use provided connection or default singleton
  const connection = options?.connection ?? defaultConnection

  // Reactive state
  const connectionStatus = ref<ConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0,
  })
  const sessionId = ref<string | null>(null)
  const clientId = ref<string | null>(null)
  const hasPendingResult = ref(false)
  const pendingResultTruncated = ref(false)
  const pendingResultContext = ref<PendingResultContext | null>(null)

  // Computed
  const isConnected = computed(() => connectionStatus.value.status === 'connected')

  // Sync state from connection
  function syncState(): void {
    connectionStatus.value = connection.status
    sessionId.value = connection.sessionId
    clientId.value = connection.clientId
    hasPendingResult.value = connection.hasPendingResult
    pendingResultTruncated.value = connection.pendingResultTruncated
    pendingResultContext.value = connection.pendingResultContext
  }

  // Event handlers for state sync
  function handleConnectionChange(): void {
    syncState()
  }

  function handleClientId(data: { clientId: string }): void {
    clientId.value = data.clientId
  }

  function handleSessionCreated(data: { sessionId: string }): void {
    sessionId.value = data.sessionId
  }

  // Subscribe to connection events
  let unsubscribeConnection: (() => void) | null = null
  let unsubscribeClientId: (() => void) | null = null
  let unsubscribeSession: (() => void) | null = null

  function setupSubscriptions(): void {
    unsubscribeConnection = connection.on('connection_change', handleConnectionChange)
    unsubscribeClientId = connection.on('client_id', handleClientId)
    unsubscribeSession = connection.on('session_created', handleSessionCreated)
  }

  function cleanupSubscriptions(): void {
    unsubscribeConnection?.()
    unsubscribeClientId?.()
    unsubscribeSession?.()
  }

  // Lifecycle
  onMounted(() => {
    setupSubscriptions()
    syncState()

    // Auto-connect if configured
    if (options?.autoConnect !== false && !connection.isConnected) {
      connection.connect(options)
    }
  })

  onUnmounted(() => {
    cleanupSubscriptions()
  })

  // Methods
  async function sendMessage(
    message: string,
    messageOptions?: SendMessageOptions
  ): Promise<SendMessageResult> {
    const result = await connection.sendMessage(message, messageOptions)
    syncState()
    return result
  }

  function cancel(): void {
    connection.cancel()
  }

  async function reconnectSession(sid: string): Promise<SendMessageResult> {
    return connection.sendMessage('', {
      sessionId: sid,
      startNewSession: false,
    })
  }

  function applyPendingResult(): import('../types/events').OutputUpdateEvent[] {
    const events = connection.applyPendingResult()
    syncState()
    return events
  }

  function notifyNavigatedAway(): void {
    connection.notifyNavigatedAway()
    syncState()
  }

  function markContextForPending(context: PageContext): void {
    connection.markContextForPending(context)
  }

  function on<T = unknown>(event: string, handler: (data: T) => void): () => void {
    return connection.on(event, handler)
  }

  function off<T = unknown>(event: string, handler: (data: T) => void): void {
    connection.off(event, handler)
  }

  function connect(config?: AgentConnectionConfig): void {
    connection.connect(config ?? options)
    syncState()
  }

  function disconnect(): void {
    connection.disconnect()
    syncState()
  }

  function reconnect(): void {
    connection.reconnect()
    syncState()
  }

  return {
    // State
    isConnected,
    connectionStatus: readonly(connectionStatus),
    sessionId: readonly(sessionId),
    clientId: readonly(clientId),
    hasPendingResult: readonly(hasPendingResult),
    pendingResultTruncated: readonly(pendingResultTruncated),
    pendingResultContext: readonly(pendingResultContext),

    // Methods
    sendMessage,
    cancel,
    reconnectSession,
    applyPendingResult,
    notifyNavigatedAway,
    markContextForPending,

    // Event subscription
    on,
    off,

    // Connection management
    connect,
    disconnect,
    reconnect,
  }
}

export default useAgentChat
