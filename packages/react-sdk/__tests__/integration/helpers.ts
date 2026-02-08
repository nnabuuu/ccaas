/**
 * Integration test helpers
 *
 * These utilities help verify that the CCAAS backend is running
 * and ready to accept connections.
 */

import { io, Socket } from 'socket.io-client'

export const BACKEND_URL = 'http://localhost:3001'
export const TIMEOUT = 10000 // 10 seconds

/**
 * Check if CCAAS backend is running
 */
export async function isBackendRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/chat/health`, {
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Wait for backend to be ready
 */
export async function waitForBackend(maxWaitMs = 5000): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    if (await isBackendRunning()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  throw new Error(`CCAAS backend not ready after ${maxWaitMs}ms`)
}

/**
 * Create a connected socket and wait for client_id
 */
export async function createConnectedSocket(): Promise<{ socket: Socket; clientId: string }> {
  return new Promise((resolve, reject) => {
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
    })

    const timeout = setTimeout(() => {
      socket.disconnect()
      reject(new Error('Socket connection timeout'))
    }, TIMEOUT)

    let clientId: string | null = null

    socket.on('connect', () => {
      // Wait for client_id before resolving
    })

    socket.on('client_id', (data: { clientId: string }) => {
      clientId = data.clientId
      clearTimeout(timeout)
      resolve({ socket, clientId })
    })

    socket.on('connect_error', (err) => {
      clearTimeout(timeout)
      socket.disconnect()
      reject(new Error(`Socket connection error: ${err.message}`))
    })
  })
}

/**
 * Cleanup socket connection
 */
export function disconnectSocket(socket: Socket): void {
  if (socket.connected) {
    socket.disconnect()
  }
}

/**
 * Wait for a specific socket event
 */
export function waitForEvent<T = any>(
  socket: Socket,
  eventName: string,
  timeoutMs = TIMEOUT,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handler)
      reject(new Error(`Timeout waiting for event: ${eventName}`))
    }, timeoutMs)

    const handler = (data: T) => {
      clearTimeout(timeout)
      socket.off(eventName, handler)
      resolve(data)
    }

    socket.on(eventName, handler)
  })
}

/**
 * Generate a unique session ID for testing
 */
export function generateSessionId(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
