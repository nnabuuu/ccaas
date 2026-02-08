/**
 * Integration Test: WebSocket Connection
 *
 * Tests real WebSocket connection to CCAAS backend.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Socket } from 'socket.io-client'
import {
  isBackendRunning,
  createConnectedSocket,
  disconnectSocket,
  BACKEND_URL,
} from './helpers'

describe('WebSocket Connection Integration', () => {
  let sockets: Socket[] = []

  beforeAll(async () => {
    const running = await isBackendRunning()
    if (!running) {
      throw new Error(
        `CCAAS backend is not running on ${BACKEND_URL}\n` +
        'Start it with: cd packages/backend && npm run start:dev'
      )
    }
  }, 10000)

  afterEach(() => {
    // Clean up all sockets after each test
    sockets.forEach(disconnectSocket)
    sockets = []
  })

  it('should connect to CCAAS backend via WebSocket', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    expect(socket.connected).toBe(true)
    expect(clientId).toBeTruthy()
    expect(typeof clientId).toBe('string')
  }, 10000)

  it('should receive client_id event after connection', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    // Client ID should be a non-empty string
    expect(clientId).toBeTruthy()
    expect(clientId.length).toBeGreaterThan(0)
  }, 10000)

  it('should maintain connection', async () => {
    const { socket } = await createConnectedSocket()
    sockets.push(socket)

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Should still be connected
    expect(socket.connected).toBe(true)
  }, 10000)

  it('should disconnect cleanly', async () => {
    const { socket } = await createConnectedSocket()
    sockets.push(socket)

    expect(socket.connected).toBe(true)

    // Disconnect
    socket.disconnect()

    // Should be disconnected
    expect(socket.connected).toBe(false)
  }, 10000)

  it('should support multiple concurrent connections', async () => {
    // Create 3 connections
    const connections = await Promise.all([
      createConnectedSocket(),
      createConnectedSocket(),
      createConnectedSocket(),
    ])

    connections.forEach(({ socket }) => sockets.push(socket))

    // All should be connected
    connections.forEach(({ socket, clientId }) => {
      expect(socket.connected).toBe(true)
      expect(clientId).toBeTruthy()
    })

    // All should have unique client IDs
    const clientIds = connections.map(c => c.clientId)
    const uniqueIds = new Set(clientIds)
    expect(uniqueIds.size).toBe(3)
  }, 15000)
})
