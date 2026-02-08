import { useState, useEffect, useCallback, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { UseAgentConnectionOptions, UseAgentConnectionReturn } from '../types'

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Manages Socket.io connection to the CCAAS backend.
 *
 * Extracted from useLessonPlanSession and useProblemSession.
 * Handles connect/disconnect, client_id assignment, and session joining.
 */
export function useAgentConnection(options: UseAgentConnectionOptions = {}): UseAgentConnectionReturn {
  const { serverUrl = '/', sessionPrefix = 'session', autoConnect = true } = options

  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const sessionIdRef = useRef<string>(`${sessionPrefix}_${generateId()}`)
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

  return {
    socket: socketRef.current,
    connected,
    clientId,
    sessionId: sessionIdRef.current,
    serverUrl,
    error,
    connect,
    disconnect,
  }
}
