/**
 * AgentConnection Service
 *
 * Singleton Socket.io connection manager for claude-code-as-a-service backend.
 * Provides event emitter pattern for multiple subscribers.
 *
 * @example
 * ```ts
 * // Production usage - use default singleton
 * import { agentConnection } from '@kedge-agentic/vue-sdk'
 * agentConnection.connect()
 *
 * // Testing - use factory for isolation
 * import { createAgentConnection } from '@kedge-agentic/vue-sdk'
 * const connection = createAgentConnection()
 * ```
 */

import type { Socket } from 'socket.io-client'
import type {
  AgentConnectionConfig,
  ConnectionState,
  SendMessageOptions,
  SendMessageResult,
  PageContext,
} from '../types/connection'
import type { OutputUpdateEvent } from '../types/events'

// Event emitter types
type EventHandler<T = unknown> = (data: T) => void
type EventMap = Map<string, Set<EventHandler>>

/**
 * Pending result context for cross-page navigation
 */
export interface PendingResultContext {
  /** Entity type (e.g., 'lesson-plan', 'test-paper') */
  entityType: string
  /** Entity ID */
  entityId: string
  /** Generated data keyed by field name */
  data: Record<string, unknown>
  /** Timestamp when generation completed */
  completedAt: Date
}

/**
 * Buffer limits for pending results
 */
const BUFFER_MAX_EVENTS = 50
const BUFFER_MAX_SIZE = 1024 * 1024 // 1MB

/**
 * AgentConnection class
 *
 * Manages Socket.io connection to backend with event emitter pattern.
 */
export class AgentConnection {
  private socket: Socket | null = null
  private eventHandlers: EventMap = new Map()
  private _status: ConnectionState = {
    status: 'disconnected',
    reconnectAttempts: 0,
  }
  private _clientId: string | null = null
  private _sessionId: string | null = null
  private config: AgentConnectionConfig | null = null

  // Pending result buffer
  private pendingBuffer: OutputUpdateEvent[] = []
  private pendingBufferSize = 0
  private _pendingResultTruncated = false
  private _pendingResultContext: PendingResultContext | null = null
  private _hasPendingResult = false
  private originalContext: PageContext | null = null

  // Connection state
  get status(): ConnectionState {
    return this._status
  }

  get clientId(): string | null {
    return this._clientId
  }

  get sessionId(): string | null {
    return this._sessionId
  }

  get isConnected(): boolean {
    return this._status.status === 'connected'
  }

  // Pending result state
  get hasPendingResult(): boolean {
    return this._hasPendingResult
  }

  get pendingResultTruncated(): boolean {
    return this._pendingResultTruncated
  }

  get pendingResultContext(): PendingResultContext | null {
    return this._pendingResultContext
  }

  /**
   * Connect to the backend
   */
  connect(config?: AgentConnectionConfig): void {
    // Already connected, skip
    if (this.socket && this._status.status === 'connected') {
      console.log('[AgentConnection] Already connected, skipping')
      return
    }

    this.config = {
      url: config?.url ?? 'http://localhost:3001',
      autoConnect: config?.autoConnect ?? true,
      getAuthToken: config?.getAuthToken ?? (() => null),
      reconnection: {
        enabled: config?.reconnection?.enabled ?? true,
        maxAttempts: config?.reconnection?.maxAttempts ?? Infinity,
        delayMs: config?.reconnection?.delayMs ?? 5000,
      },
      debug: config?.debug ?? false,
    }

    this.updateStatus('connecting')

    // Dynamically import socket.io-client
    import('socket.io-client').then(({ io }) => {
      const token = this.config!.getAuthToken?.()

      this.socket = io(this.config!.url!, {
        autoConnect: this.config!.autoConnect,
        auth: token ? { token } : undefined,
        reconnection: this.config!.reconnection?.enabled,
        reconnectionAttempts: this.config!.reconnection?.maxAttempts,
        reconnectionDelay: this.config!.reconnection?.delayMs,
      })

      this.setupSocketListeners()

      if (this.config!.autoConnect) {
        this.socket.connect()
      }
    }).catch((err) => {
      console.error('[AgentConnection] Failed to load socket.io-client:', err)
      this.updateStatus('disconnected', err.message)
    })
  }

  /**
   * Disconnect from the backend
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.updateStatus('disconnected')
    this._clientId = null
    this._sessionId = null
  }

  /**
   * Reconnect to the backend
   */
  reconnect(): void {
    if (this.socket) {
      this.updateStatus('reconnecting')
      this.socket.connect()
    } else if (this.config) {
      this.connect(this.config)
    }
  }

  /**
   * Send a chat message
   */
  async sendMessage(
    message: string,
    options?: SendMessageOptions
  ): Promise<SendMessageResult> {
    if (!this.socket || !this.isConnected) {
      return { success: false, error: 'Not connected' }
    }

    // Store original context for pending result tracking
    if (options?.context) {
      this.originalContext = options.context
    }

    // Clear pending buffer when starting new message
    this.clearPendingBuffer()

    return new Promise((resolve) => {
      const payload = {
        message,
        skillId: options?.skillId,
        context: options?.context,
        sessionId: options?.sessionId ?? this._sessionId,
        startNewSession: options?.startNewSession,
      }

      this.socket!.emit('skill_chat', payload, (response: SendMessageResult) => {
        if (response.sessionId) {
          this._sessionId = response.sessionId
        }
        resolve(response)
      })

      // Fallback timeout if no ack
      setTimeout(() => {
        resolve({ success: true, sessionId: this._sessionId ?? undefined })
      }, 5000)
    })
  }

  /**
   * Cancel the current operation
   */
  cancel(): void {
    if (this.socket && this._sessionId) {
      this.socket.emit('cancel', { sessionId: this._sessionId })
    }
  }

  /**
   * Subscribe to an event
   */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler as EventHandler)

    // Return unsubscribe function
    return () => this.off(event, handler)
  }

  /**
   * Unsubscribe from an event
   */
  off<T = unknown>(event: string, handler: EventHandler<T>): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler as EventHandler)
    }
  }

  /**
   * Subscribe to an event once
   */
  once<T = unknown>(event: string, handler: EventHandler<T>): void {
    const onceHandler: EventHandler<T> = (data) => {
      this.off(event, onceHandler)
      handler(data)
    }
    this.on(event, onceHandler)
  }

  /**
   * Apply pending result to a new EntityBridge
   */
  applyPendingResult(): OutputUpdateEvent[] {
    const events = [...this.pendingBuffer]
    this.clearPendingBuffer()
    this._hasPendingResult = false
    this._pendingResultContext = null
    return events
  }

  /**
   * Mark current context for pending result tracking
   */
  markContextForPending(context: PageContext): void {
    this.originalContext = context
  }

  /**
   * Notify that user has navigated away
   */
  notifyNavigatedAway(): void {
    // If we have buffered events and a context, mark as pending
    if (this.pendingBuffer.length > 0 && this.originalContext) {
      this._hasPendingResult = true
      this._pendingResultContext = {
        entityType: this.originalContext.entityType ?? 'unknown',
        entityId: this.originalContext.entityId ?? 'unknown',
        data: this.collectBufferedData(),
        completedAt: new Date(),
      }
    }
  }

  // Private methods

  private setupSocketListeners(): void {
    if (!this.socket) return

    this.socket.on('connect', () => {
      this.updateStatus('connected')
      this._status.reconnectAttempts = 0
      this.emit('connection_change', { status: this._status })
    })

    this.socket.on('disconnect', (reason) => {
      this.updateStatus('disconnected', reason)
      this.emit('connection_change', { status: this._status })
    })

    this.socket.on('connect_error', (error) => {
      this._status.reconnectAttempts++
      this.updateStatus('reconnecting', error.message)
      this.emit('connection_change', { status: this._status })
    })

    // Client ID event
    this.socket.on('client_id', (data: { clientId: string }) => {
      this._clientId = data.clientId
      this.emit('client_id', data)
    })

    // Session created
    this.socket.on('session_created', (data: { sessionId: string }) => {
      this._sessionId = data.sessionId
      this.emit('session_created', data)
    })

    // Forward all other events
    const forwardEvents = [
      'text_delta',
      'output_update',
      'tool_activity',
      'todo_update',
      'agent_status',
      'agent_thinking',
      'exploration_activity',
      'token_usage',
      'plan_proposal',
      'complete',
      'error',
    ]

    for (const event of forwardEvents) {
      this.socket.on(event, (data: unknown) => {
        // Buffer output_update events for pending result
        if (event === 'output_update') {
          this.bufferOutputUpdate(data as OutputUpdateEvent)
        }

        // Handle completion
        if (event === 'complete') {
          this.handleComplete()
        }

        this.emit(event, data)
      })
    }
  }

  private bufferOutputUpdate(event: OutputUpdateEvent): void {
    // Check event count limit
    if (this.pendingBuffer.length >= BUFFER_MAX_EVENTS) {
      this._pendingResultTruncated = true
      return
    }

    // Check size limit (rough estimate)
    const eventSize = JSON.stringify(event).length
    if (this.pendingBufferSize + eventSize > BUFFER_MAX_SIZE) {
      this._pendingResultTruncated = true
      return
    }

    this.pendingBuffer.push(event)
    this.pendingBufferSize += eventSize
  }

  private handleComplete(): void {
    // If we have buffered data and context, prepare pending result
    if (this.pendingBuffer.length > 0 && this.originalContext) {
      this._pendingResultContext = {
        entityType: this.originalContext.entityType ?? 'unknown',
        entityId: this.originalContext.entityId ?? 'unknown',
        data: this.collectBufferedData(),
        completedAt: new Date(),
      }
    }
  }

  private collectBufferedData(): Record<string, unknown> {
    // Merge all data objects from buffered events
    const merged: Record<string, unknown> = {}
    for (const event of this.pendingBuffer) {
      if (event.data) {
        // Spread the data fields into merged object
        Object.assign(merged, event.data)
      }
    }
    return merged
  }

  private clearPendingBuffer(): void {
    this.pendingBuffer = []
    this.pendingBufferSize = 0
    this._pendingResultTruncated = false
  }

  private updateStatus(
    status: ConnectionState['status'],
    error?: string
  ): void {
    this._status = {
      ...this._status,
      status,
      error,
    }
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      // Convert Set to array for iteration (avoids downlevelIteration requirement)
      Array.from(handlers).forEach((handler) => {
        try {
          handler(data)
        } catch (err) {
          console.error(`[AgentConnection] Error in handler for ${event}:`, err)
        }
      })
    }
  }
}

/**
 * Factory function for creating AgentConnection instances.
 * Use this for testing to get isolated instances.
 */
export function createAgentConnection(): AgentConnection {
  return new AgentConnection()
}

/**
 * Default singleton instance for production use.
 */
export const agentConnection = createAgentConnection()
