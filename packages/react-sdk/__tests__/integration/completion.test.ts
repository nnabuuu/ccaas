/**
 * Integration Test: /sessions/:id/completion Endpoint
 *
 * Tests the session completion endpoint that react-sdk uses.
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

describe('Session Completion Endpoint Integration', () => {
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

  it('should accept POST request to /sessions/:id/completion', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'Hello, test!',
          tenantId: 'test-tenant',
        }),
      }
    )

    expect(response.ok).toBe(true)
    expect(response.status).toBe(201)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.sessionId).toBe(sessionId)
  }, 15000)

  it('should reject request without clientId', async () => {
    const sessionId = generateSessionId()

    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello',
        }),
      }
    )

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.message).toContain('clientId')
  })

  it('should reject request without message', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
        }),
      }
    )

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.message).toContain('message')
  })

  it('should reject request with disconnected clientId', async () => {
    const sessionId = generateSessionId()

    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'fake-disconnected-client',
          message: 'Hello',
        }),
      }
    )

    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.message).toContain('not connected')
  })

  it('should trigger agent_status event after sending message', async () => {
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
    expect(statusData.status).toBeTruthy()
    expect(statusData.sessionId).toBe(sessionId)
  }, 20000)

  it('should include tenantId in request payload', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'Test message',
          tenantId: 'quiz-analyzer',
        }),
      }
    )

    expect(response.ok).toBe(true)
  }, 15000)

  it('should accept optional mcpServers parameter', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'Test',
          tenantId: 'test',
          mcpServers: {
            'test-server': {
              command: 'node',
              args: ['test.js'],
            },
          },
        }),
      }
    )

    expect(response.ok).toBe(true)
  }, 15000)

  it('should accept optional enabledSkillSlugs parameter', async () => {
    const { socket, clientId } = await createConnectedSocket()
    sockets.push(socket)

    const sessionId = generateSessionId()

    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/${sessionId}/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          message: 'Test',
          tenantId: 'test',
          enabledSkillSlugs: ['skill-a', 'skill-b'],
        }),
      }
    )

    expect(response.ok).toBe(true)
  }, 15000)
})
