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
 * Manages Socket.io connection to the CCAAS backend.
 *
 * Extracted from useLessonPlanSession and useProblemSession.
 * Handles connect/disconnect, client_id assignment, and session joining.
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
  } = options

  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const initialSessionId = useRef<string>(
    resolveSessionId(tenantId, sessionPrefix, forceNewConversation),
  ).current
  const [sessionId, setSessionId] = useState<string>(initialSessionId)
  const sessionIdRef = useRef<string>(initialSessionId)
  const clientIdRef = useRef<string | null>(null)
  const [clientId, setClientId] = useState<string | null>(null)

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      setError(null)
      // Join session room
      socket.emit('session:join', { sessionId: sessionIdRef.current })
    })

    socket.on('client_id', (data: { clientId: string }) => {
      clientIdRef.current = data.clientId
      setClientId(data.clientId)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`)
      setConnected(false)
    })
  }, [serverUrl])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setConnected(false)
      clientIdRef.current = null
      setClientId(null)
    }
  }, [])

  useEffect(() => {
    if (autoConnect) {
      connect()
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [autoConnect, connect])

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

    // Disconnect and reconnect
    disconnect()
    connect()
  }, [tenantId, sessionPrefix, disconnect, connect])

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
