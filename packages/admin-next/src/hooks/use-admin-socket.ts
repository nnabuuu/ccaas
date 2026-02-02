import { useEffect, useCallback, useRef } from 'react'
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket'
import type { Socket } from 'socket.io-client'

export function useAdminSocket() {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    connectSocket()
    socketRef.current = getSocket()

    return () => {
      disconnectSocket()
    }
  }, [])

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler)
    return () => {
      socketRef.current?.off(event, handler)
    }
  }, [])

  const emit = useCallback((event: string, ...args: unknown[]) => {
    socketRef.current?.emit(event, ...args)
  }, [])

  return { on, emit, socket: socketRef.current }
}
