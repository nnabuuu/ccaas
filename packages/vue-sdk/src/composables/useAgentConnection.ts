/**
 * useAgentConnection
 *
 * Manages connection to the CCAAS backend.
 *
 * Default transport is 'sse' (HTTP streaming, no WebSocket required).
 * Socket.IO transport is available via `transport: 'socket'` but is deprecated.
 *
 * When `tenantId` is provided, the sessionId is persisted in localStorage
 * under a tenant-scoped key (`ccaas_session_${tenantId}`) and uses the
 * `conv_${uuid}` format. This enables conversation recovery across page refreshes.
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { Socket } from 'socket.io-client'
import type { UseAgentConnectionOptions, UseAgentConnectionReturn } from '../types'
import { generateId } from '../utils/generateId'

/** Generate a conversation ID with conv_ prefix */
const generateConversationId = (): string => `conv_${generateId()}`

/** Get tenant-scoped localStorage key */
const getStorageKey = (tenantId: string): string => `ccaas_session_${tenantId}`

const safeGetItem = (key: string): string | null => {
  try { return localStorage.getItem(key) } catch { return null }
}

const safeSetItem = (key: string, value: string): void => {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

const safeRemoveItem = (key: string): void => {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

/**
 * Resolve the initial sessionId based on tenantId, forceNewConversation, and localStorage.
 */
function resolveSessionId(
  tenantId: string | undefined,
  sessionPrefix: string,
  forceNewConversation: boolean,
  explicitSessionId?: string,
): string {
  if (explicitSessionId) {
    if (tenantId) safeSetItem(getStorageKey(tenantId), explicitSessionId)
    return explicitSessionId
  }

  if (!tenantId) {
    return `${sessionPrefix}_${generateId()}`
  }

  const storageKey = getStorageKey(tenantId)

  if (forceNewConversation) {
    safeRemoveItem(storageKey)
    const newId = generateConversationId()
    safeSetItem(storageKey, newId)
    return newId
  }

  const saved = safeGetItem(storageKey)
  if (saved) return saved

  const newId = generateConversationId()
  safeSetItem(storageKey, newId)
  return newId
}

export function useAgentConnection(options: UseAgentConnectionOptions = {}): UseAgentConnectionReturn {
  const {
    serverUrl = '/',
    sessionPrefix = 'session',
    autoConnect = true,
    tenantId,
    forceNewConversation = false,
    transport = 'sse',
  } = options

  const socketRef = ref<Socket | null>(null)
  const socketConnected = ref(false)
  const error = ref<string | null>(null)
  const sessionReady = ref(false)
  const clientId = ref<string | null>(null)

  const initialSessionId = resolveSessionId(
    tenantId, sessionPrefix, forceNewConversation, options.sessionId,
  )
  const sessionId = ref<string>(initialSessionId)

  // SSE mode: always connected (HTTP stateless), no socket needed
  const connected = computed(() => transport === 'sse' ? true : socketConnected.value)

  function connect() {
    if (transport === 'sse') return // SSE mode: no socket to connect

    if (socketRef.value?.connected) return

    console.warn(
      '[ccaas] Socket.IO transport is deprecated. ' +
      'Use transport: "sse" (default) instead. ' +
      'The backend /completion endpoint returns 410 Gone.',
    )

    // Dynamic import of socket.io-client
    import('socket.io-client').then(({ io }) => {
      const socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
      })

      socketRef.value = socket

      socket.on('connect', () => {
        socketConnected.value = true
        error.value = null
        socket.emit('session:join', { sessionId: sessionId.value })
      })

      socket.on('client_id', (data: { clientId: string }) => {
        clientId.value = data.clientId
      })

      socket.on('disconnect', () => {
        socketConnected.value = false
      })

      socket.on('connect_error', (err: Error) => {
        error.value = `Connection error: ${err.message}`
        socketConnected.value = false
      })
    })
  }

  function markSessionReady() {
    sessionReady.value = true
  }

  function disconnect() {
    if (socketRef.value) {
      socketRef.value.disconnect()
      socketRef.value = null
      socketConnected.value = false
      clientId.value = null
    }
  }

  function startNewConversation() {
    // Clear old session from localStorage
    if (tenantId) {
      safeRemoveItem(getStorageKey(tenantId))
    }

    // Generate new session ID
    const newId = tenantId ? generateConversationId() : `${sessionPrefix}_${generateId()}`
    sessionId.value = newId
    sessionReady.value = false

    // Save new session to localStorage
    if (tenantId) {
      safeSetItem(getStorageKey(tenantId), newId)
    }

    if (transport !== 'sse') {
      disconnect()
      connect()
    }
  }

  // Warn once when serverUrl is empty or relative
  if (serverUrl === '' || serverUrl === '/') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '<unknown>'
    console.warn(
      `[CCAAS] Warning: serverUrl is "${serverUrl}". ` +
      `All API requests will target the current page origin (${origin}). ` +
      `Use an absolute URL like 'http://localhost:3001' to connect to the CCAAS backend. ` +
      `Vite proxy does NOT intercept SDK fetch() calls with full URLs.`,
    )
  }

  // Auto-connect on mount (socket mode only)
  onMounted(() => {
    if (transport !== 'sse' && autoConnect) {
      connect()
    }
  })

  // Cleanup on unmount
  onUnmounted(() => {
    if (socketRef.value) {
      socketRef.value.disconnect()
      socketRef.value = null
    }
  })

  return {
    socket: socketRef as UseAgentConnectionReturn['socket'],
    connected,
    clientId,
    sessionId,
    serverUrl,
    error,
    connect,
    disconnect,
    startNewConversation,
    sessionReady,
    markSessionReady,
  }
}
