import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { UseAgentConnectionOptions, UseAgentConnectionReturn } from '../types'
import { generateId } from '../utils/generateId'

/** Generate a conversation ID with conv_ prefix */
const generateConversationId = (): string => `conv_${generateId()}`

/** Get tenant-scoped localStorage key */
const getStorageKey = (tenantId: string): string => `ccaas_session_${tenantId}`

/**
 * Try to read a value from localStorage, returning null on any error.
 */
const safeGetItem = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Try to write a value to localStorage, silently ignoring errors.
 */
const safeSetItem = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore - localStorage may be full or disabled
  }
}

/**
 * Try to remove a value from localStorage, silently ignoring errors.
 */
const safeRemoveItem = (key: string): void => {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}

/**
 * Resolve the initial sessionId based on tenantId, forceNewConversation, and localStorage.
 */
const resolveSessionId = (
  tenantId: string | undefined,
  sessionPrefix: string,
  forceNewConversation: boolean,
): string => {
  // No tenantId: use legacy prefix-based ID (no persistence)
  if (!tenantId) {
    return `${sessionPrefix}_${generateId()}`
  }

  const storageKey = getStorageKey(tenantId)

  // Force new conversation: clear storage and generate fresh
  if (forceNewConversation) {
    safeRemoveItem(storageKey)
    const newId = generateConversationId()
    safeSetItem(storageKey, newId)
    return newId
  }

  // Try to recover from localStorage
  const saved = safeGetItem(storageKey)
  if (saved) {
    return saved
  }

  // No saved session: generate new and persist
  const newId = generateConversationId()
  safeSetItem(storageKey, newId)
  return newId
}

/**
 * Manages connection to the CCAAS backend.
 *
 * Default transport is 'sse' (HTTP streaming, no WebSocket required).
 * Socket.IO transport is available via `transport: 'socket'` but is deprecated.
 *
 * When `tenantId` is provided, the sessionId is persisted in localStorage
 * under a tenant-scoped key (`ccaas_session_${tenantId}`) and uses the
 * `conv_${uuid}` format. This enables conversation recovery across page refreshes.
 */
export function useAgentConnection(options: UseAgentConnectionOptions = {}): UseAgentConnectionReturn {
  const {
    serverUrl = '/',
    sessionPrefix = 'session',
    autoConnect = true,
    tenantId,
    forceNewConversation = false,
    transport = 'sse',
  } = options

  // In SSE mode, connection is always "ready" (HTTP is stateless)
  const [socketConnected, setSocketConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const initialSessionId = useRef<string>(
    resolveSessionId(tenantId, sessionPrefix, forceNewConversation),
  ).current
  const [sessionId, setSessionId] = useState<string>(initialSessionId)
  const sessionIdRef = useRef<string>(initialSessionId)
  const clientIdRef = useRef<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)

  // SSE mode: always connected (HTTP stateless), no socket needed
  const connected = transport === 'sse' ? true : socketConnected

  const connect = useCallback(() => {
    if (transport === 'sse') return // SSE mode: no socket to connect

    if (socketRef.current?.connected) return

    console.warn(
      '[ccaas] Socket.IO transport is deprecated. ' +
      'Use transport: "sse" (default) instead. ' +
      'The backend /completion endpoint returns 410 Gone.',
    )

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setSocketConnected(true)
      setError(null)
      // Join session room
      socket.emit('session:join', { sessionId: sessionIdRef.current })
    })

    socket.on('client_id', (data: { clientId: string }) => {
      clientIdRef.current = data.clientId
      setClientId(data.clientId)
    })

    socket.on('disconnect', () => {
      setSocketConnected(false)
    })

    socket.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`)
      setSocketConnected(false)
    })
  }, [serverUrl, transport])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setSocketConnected(false)
      clientIdRef.current = null
      setClientId(null)
    }
  }, [])

  // Warn once (on mount or serverUrl change) when serverUrl is empty or relative.
  // All SDK API calls use full URLs, so Vite proxy will NOT intercept them.
  useEffect(() => {
    if (serverUrl === '' || serverUrl === '/') {
      const origin = typeof window !== 'undefined' ? window.location.origin : '<unknown>'
      console.warn(
        `[CCAAS] Warning: serverUrl is "${serverUrl}". ` +
        `All API requests will target the current page origin (${origin}). ` +
        `Use an absolute URL like 'http://localhost:3001' to connect to the CCAAS backend. ` +
        `Vite proxy does NOT intercept SDK fetch() calls with full URLs.`,
      )
    }
  }, [serverUrl])

  useEffect(() => {
    if (transport === 'sse') return // SSE mode: no socket lifecycle

    if (autoConnect) {
      connect()
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [autoConnect, connect, transport])

  const startNewConversation = useCallback(() => {
    // Clear old session from localStorage
    if (tenantId) {
      safeRemoveItem(getStorageKey(tenantId))
    }

    // Generate new session ID
    const newId = tenantId ? generateConversationId() : `${sessionPrefix}_${generateId()}`
    sessionIdRef.current = newId
    setSessionId(newId)

    // Save new session to localStorage
    if (tenantId) {
      safeSetItem(getStorageKey(tenantId), newId)
    }

    if (transport !== 'sse') {
      // Socket mode: disconnect and reconnect
      disconnect()
      connect()
    }
  }, [tenantId, sessionPrefix, disconnect, connect, transport])

  return {
    socket: socketRef.current,
    connected,
    clientId,
    sessionId: sessionId,
    serverUrl,
    error,
    connect,
    disconnect,
    startNewConversation,
  }
}
