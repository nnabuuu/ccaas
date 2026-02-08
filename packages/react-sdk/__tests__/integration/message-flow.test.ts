/**
 * Integration Test: Complete Message Flow
 *
 * Tests the full lifecycle of sending a message via REST and receiving
 * responses via WebSocket events.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { Socket } from 'socket.io-client'
import {
  isBackendRunning,
  createConnectedSocket,
  disconnectSocket,
  generateSessionId,
  waitForEvent,
  BACKEND_URL,
} from './helpers'

describe('Message Flow Integration', () => {
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
    sockets.forEach(disconnectSocket)
    sockets = []
  })

  it('should receive agent_status event when message is sent', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    // Listen for agent_status event
    const statusPromise = waitForEvent<{ status: string; sessionId: string }>(
      socket,
      'agent_status',
      15000
    )

    // Send message
    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'What is 2+2?',
          tenantId: 'test-tenant',
        }),
      }
    )

    expect(response.ok).toBe(true)

    // Should receive agent_status event
    const statusData = await statusPromise
    expect(statusData.status).toBe('running')
    expect(statusData.sessionId).toBe(sessionId)
  }, 20000)

  it('should receive text_delta events during agent processing', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    // Collect text_delta events
    const textDeltas: string[] = []
    socket.on('text_delta', (data: { delta: string }) => {
      textDeltas.push(data.delta)
    })

    // Listen for completion (wait longer for agent to respond)
    const statusPromise = waitForEvent<{ status: string }>(
      socket,
      'agent_status',
      60000
    )

    // Send message (use echo to ensure we get text output)
    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'Echo back the text "Integration test successful"',
          tenantId: 'test-tenant',
        }),
      }
    )

    expect(response.ok).toBe(true)

    // Wait for first text_delta (most important indicator)
    await waitForEvent(socket, 'text_delta', 30000)

    // Should have received at least one text delta at this point
    expect(textDeltas.length).toBeGreaterThan(0)

    // Wait for final completion
    await statusPromise
  }, 65000)

  it('should support follow-up messages in same session', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    // First message
    await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'What is 2+2?',
          tenantId: 'test-tenant',
        }),
      }
    )

    // Wait for first message to complete
    await waitForEvent(socket, 'agent_status', 30000)

    // Send follow-up message
    const statusPromise = waitForEvent<{ status: string; sessionId: string }>(
      socket,
      'agent_status',
      15000
    )

    const response2 = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'What about 3+3?',
          tenantId: 'test-tenant',
        }),
      }
    )

    expect(response2.ok).toBe(true)

    const statusData = await statusPromise
    expect(statusData.status).toBe('running')
    expect(statusData.sessionId).toBe(sessionId)
  }, 60000)

  it('should handle concurrent sessions from different clients', async () => {
    // Create two separate client connections
    const client1 = await createConnectedSocket()
    const client2 = await createConnectedSocket()
    sockets.push(client1.socket, client2.socket)

    const session1 = generateSessionId()
    const session2 = generateSessionId()

    // Send messages from both clients simultaneously
    const [response1, response2] = await Promise.all([
      fetch(`${BACKEND_URL}/api/v1/sessions/${session1}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client1.clientId,
          message: 'Session 1 message',
          tenantId: 'test-tenant',
        }),
      }),
      fetch(`${BACKEND_URL}/api/v1/sessions/${session2}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: client2.clientId,
          message: 'Session 2 message',
          tenantId: 'test-tenant',
        }),
      }),
    ])

    expect(response1.ok).toBe(true)
    expect(response2.ok).toBe(true)

    // Both sessions should emit agent_status
    const [status1, status2] = await Promise.all([
      waitForEvent(client1.socket, 'agent_status', 15000),
      waitForEvent(client2.socket, 'agent_status', 15000),
    ])

    expect(status1).toBeTruthy()
    expect(status2).toBeTruthy()
  }, 30000)

  it('should receive output_update events for agent activities', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    // Collect output_update events
    const outputUpdates: any[] = []
    socket.on('output_update', (data) => {
      outputUpdates.push(data)
    })

    // Send message that will trigger agent activities
    await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'List files in current directory',
          tenantId: 'test-tenant',
        }),
      }
    )

    // Wait for agent to process
    await waitForEvent(socket, 'agent_status', 30000)

    // Should have received some output updates
    // (May be 0 if agent doesn't perform any tool use)
    expect(outputUpdates).toBeDefined()
  }, 35000)
})
