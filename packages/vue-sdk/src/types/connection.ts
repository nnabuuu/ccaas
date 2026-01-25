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
 * Page context for context-aware skills
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
