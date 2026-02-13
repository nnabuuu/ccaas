/**
 * Integration Test: CCAAS Backend Availability
 *
 * These tests verify that the CCAAS backend is running and accessible.
 *
 * Prerequisites:
 * - CCAAS backend must be running on port 3001
 * - Run: cd packages/backend && npm run start:dev
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { isBackendRunning, waitForBackend, BACKEND_URL } from './helpers'

describe('CCAAS Backend Integration', () => {
  beforeAll(async () => {
    const running = await isBackendRunning()
    if (!running) {
      throw new Error(
        `CCAAS backend is not running on ${BACKEND_URL}\n` +
        'Start it with: cd packages/backend && npm run start:dev'
      )
    }
  }, 10000)

  it('should be accessible at health endpoint', async () => {
    const response = await fetch(`${BACKEND_URL}/api/v1/chat/health`)
    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toEqual({ status: 'ok' })
  })

  it('should wait for backend to be ready', async () => {
    // Should resolve immediately since backend is already running
    await expect(waitForBackend(5000)).resolves.toBeUndefined()
  })

  it('should have sessions completion endpoint (standard API)', async () => {
    // Test that the endpoint exists (will return 400 without valid clientId, not 404)
    const response = await fetch(
      `${BACKEND_URL}/api/v1/sessions/test-session/completion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: 'fake-client-id',
          message: 'test',
        }),
      }
    )

    // Should NOT be 404 (endpoint doesn't exist)
    expect(response.status).not.toBe(404)

    // Should be 400 (bad request - fake clientId not connected)
    expect(response.status).toBe(400)

    const data = await response.json()
    expect(data.message).toContain('not connected')
  })

  it('should have status endpoint for server metrics', async () => {
    const response = await fetch(`${BACKEND_URL}/api/v1/chat/status`)
    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data).toHaveProperty('authenticated')
    expect(data).toHaveProperty('status')
    expect(data).toHaveProperty('sessions')
  })
})
