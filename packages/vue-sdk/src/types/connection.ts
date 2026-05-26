/**
 * Connection Types
 *
 * Type definitions for Socket.io connection management.
 */

/**
 * Connection state for Socket.io connection
 */
export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  error?: string
  reconnectAttempts: number
}

/**
 * Agent connection configuration
 */
export interface AgentConnectionConfig {
  /** Backend URL (default: http://localhost:3001) */
  url?: string
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean
  /** Auth token provider function */
  getAuthToken?: () => string | null
  /** Reconnection settings */
  reconnection?: {
    enabled?: boolean
    maxAttempts?: number
    delayMs?: number
  }
  /** Debug mode (default: false) */
  debug?: boolean
}

/**
 * Default connection configuration
 */
export const DEFAULT_CONNECTION_CONFIG: Required<AgentConnectionConfig> = {
  url: 'http://localhost:3001',
  autoConnect: true,
  getAuthToken: () => null,
  reconnection: {
    enabled: true,
    maxAttempts: Infinity,
    delayMs: 5000,
  },
  debug: false,
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /** Skill ID to use for this message */
  skillId?: string
  /** Page context to include */
  context?: PageContext
  /** Session ID (for continuing a session) */
  sessionId?: string
  /** Whether to start a new session */
  startNewSession?: boolean
}

/**
 * Send message result
 */
export interface SendMessageResult {
  success: boolean
  sessionId?: string
  error?: string
}

/**
 * Page context for context-aware skills (legacy, form-bridge style)
 */
export interface PageContext {
  /** Current route path */
  route: string
  /** Page type identifier */
  pageType: string
  /** Entity ID being viewed/edited */
  entityId?: string
  /** Entity type name */
  entityType?: string
  /** Whether user is in edit mode */
  editMode?: boolean
  /** Selected/focused fields */
  selectedFields?: string[]
  /** Fields with unsaved changes */
  dirtyFields?: string[]
  /** Current form/entity state */
  currentData?: Record<string, unknown>
  /** User-selected text */
  selectedText?: string
  /** Cursor position in editor */
  cursorPosition?: {
    field: string
    offset: number
  }
}

// ============================================================================
// SSE-first Connection Types (Phase 2+)
// ============================================================================

import type { Ref, ComputedRef } from 'vue'
import type { Socket } from 'socket.io-client'

/**
 * Page context for SSE-first chat hooks (simpler than legacy PageContext)
 */
export interface ChatPageContext {
  pageType: string
  pageData: Record<string, unknown>
  metadata?: {
    timestamp?: number
    userId?: string
  }
}

export interface UseAgentConnectionOptions {
  /** Server URL. MUST be absolute URL (e.g., http://localhost:3001) */
  serverUrl?: string
  /** Session ID prefix, e.g., 'lpd', 'pe'. Used when solutionId is not provided. */
  sessionPrefix?: string
  /** Whether to auto-connect on mount. Defaults to true */
  autoConnect?: boolean
  /** Solution ID for solution-scoped localStorage persistence */
  solutionId?: string
  /** Force a new conversation, clearing any saved sessionId from localStorage */
  forceNewConversation?: boolean
  /** Explicit session ID. When provided, skips localStorage resolution. */
  sessionId?: string
  /**
   * Transport to use for chat messages. Defaults to 'sse'.
   * - 'sse' (default): HTTP streaming via POST /messages. No WebSocket required.
   * - 'socket' (deprecated): Socket.IO transport.
   */
  transport?: 'sse' | 'socket'
}

export interface UseAgentConnectionReturn {
  socket: Ref<Socket | null>
  connected: ComputedRef<boolean>
  clientId: Ref<string | null>
  sessionId: Ref<string>
  serverUrl: string
  error: Ref<string | null>
  connect: () => void
  disconnect: () => void
  /** Clear current session storage and start a new conversation with a fresh sessionId */
  startNewConversation: () => void
  /** Whether the backend session is known to exist (true after first sendMessage call) */
  sessionReady: Ref<boolean>
  /** Called by useSseChat when a message is about to be sent, marking the session as ready */
  markSessionReady: () => void
}

export interface UseSseChatV2Options {
  connection: UseAgentConnectionReturn
  solutionId: string
  enabledSkills?: string[]
  onOutputUpdate?: (update: import('./chat').OutputUpdate) => void
  onTokenUsage?: (usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number }) => void
  /** Page context to send with every message */
  context?: ChatPageContext | null
  /** Session template name to use */
  sessionTemplate?: string
  /**
   * Transport mode for receiving events.
   * - 'sse' (default): HTTP Streaming. No WebSocket required.
   * - 'socket' (deprecated): Socket.IO.
   */
  transport?: 'socket' | 'sse'
}

export interface ChatSendMessageOptions {
  attachments?: { type: string; path: string }[]
  context?: Record<string, unknown>
}

export interface UseSseChatV2Return {
  messages: Ref<import('./chat').Message[]>
  isProcessing: Ref<boolean>
  isLoadingHistory: Ref<boolean>
  currentStreamContent: Ref<string>
  sendMessage: (content: string, options?: ChatSendMessageOptions) => Promise<void>
  clearMessages: () => void
  /** Clear messages and start a new conversation (new sessionId, new storage) */
  clearConversation: () => void
  cancelProcessing: () => void
}
