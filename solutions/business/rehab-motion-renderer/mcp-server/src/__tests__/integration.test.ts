/**
 * Integration Tests: Rehab Solution ↔ CCAAS Backend
 *
 * Tests the full pipeline against a running CCAAS backend (localhost:3001).
 * Assumes the solution has already been set up via setup.sh, which creates
 * the tenant, API key, and registers the exercise-planner skill.
 *
 * Environment variables:
 *   SOLUTION_API_KEY  — Solution API key output by setup.sh (required for B/C)
 *   CCAAS_TENANT_ID   — Tenant ID output by setup.sh (required for B/C)
 *   CCAAS_BACKEND_URL — Default: http://localhost:3001
 *
 * Groups:
 *   A — Connectivity (no keys needed)
 *   B — API key + skill verification (needs SOLUTION_API_KEY + CCAAS_TENANT_ID)
 *   C — Full E2E with AI (needs SOLUTION_API_KEY + CCAAS_TENANT_ID;
 *         backend provides Anthropic key)
 *
 * Workflow:
 *   1. cd solutions/business/rehab-motion-renderer && ./setup.sh
 *   2. Copy SOLUTION_API_KEY and TENANT_ID from setup.sh output
 *   3. SOLUTION_API_KEY=sk-... CCAAS_TENANT_ID=... npm run test:integration
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BACKEND_URL = process.env.CCAAS_BACKEND_URL ?? 'http://localhost:3001'
const API_KEY = process.env.SOLUTION_API_KEY ?? ''
const TENANT_ID = process.env.CCAAS_TENANT_ID ?? ''
const HAS_SOLUTION_KEYS = API_KEY.length > 0 && TENANT_ID.length > 0

const SKILL_SLUG = 'exercise-planner'

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

async function solutionFetch(path: string, options: RequestInit = {}) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-tenant-id': TENANT_ID,
      ...(options.headers ?? {}),
    },
  })
}

interface SseEvent {
  seq: number
  sessionId: string
  timestamp: string
  event: Record<string, unknown>
}

/**
 * Stream SSE events from POST /api/v1/sessions/:sessionId/messages.
 * Stops on agent_status:complete or timeout.
 */
async function collectSSEEvents(opts: {
  sessionId: string
  message: string
  mcpServerPath: string
  timeout?: number
}): Promise<SseEvent[]> {
  const { sessionId, message, mcpServerPath, timeout = 90_000 } = opts

  const response = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-tenant-id': TENANT_ID,
    },
    body: JSON.stringify({
      message,
      tenantId: TENANT_ID,
      enabledSkills: [SKILL_SLUG],
      mcpServers: {
        'rehab-tools': {
          command: 'node',
          args: [mcpServerPath],
        },
      },
    }),
    signal: AbortSignal.timeout(timeout),
  })

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '')
    throw new Error(`SSE request failed ${response.status}: ${text}`)
  }

  const events: SseEvent[] = []
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('SSE timeout')), timeout)

    async function pump() {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) {
            clearTimeout(deadline)
            resolve()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue

            const jsonStr = trimmed.slice(5).trim()
            if (!jsonStr || jsonStr === '[DONE]') continue

            try {
              const envelope = JSON.parse(jsonStr) as SseEvent
              events.push(envelope)

              const evt = envelope.event
              // agent_status has status at top level: { type, status, sessionId, ... }
              if (
                evt?.type === 'agent_status' &&
                (evt as any).status === 'complete'
              ) {
                clearTimeout(deadline)
                reader.cancel()
                resolve()
                return
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      } catch (err) {
        clearTimeout(deadline)
        reject(err)
      }
    }

    pump()
  })

  return events
}

// ═══════════════════════════════════════════
// Group A: Connectivity (no key needed)
// ═══════════════════════════════════════════

describe('Group A: Connectivity', () => {
  it('backend is accessible at the configured URL', async () => {
    const res = await fetch(`${BACKEND_URL}/api/v1/health`).catch(() => null)
    if (!res) {
      throw new Error(
        `Cannot reach CCAAS backend at ${BACKEND_URL}.\n` +
          'Start it with: npm run dev:backend (from monorepo root)'
      )
    }
    expect(res.status).toBeLessThan(500)
  })
})

// ═══════════════════════════════════════════
// Group B: API key + skill verification
// ═══════════════════════════════════════════

describe('Group B: API key + skill verification', () => {
  beforeAll(() => {
    if (!HAS_SOLUTION_KEYS) {
      console.log(
        '[integration] Skipping Group B/C: SOLUTION_API_KEY or CCAAS_TENANT_ID not set.\n' +
          'Run setup.sh first, then re-run with:\n' +
          '  SOLUTION_API_KEY=sk-... CCAAS_TENANT_ID=<id> npm run test:integration'
      )
    }
  })

  it('solution API key is accepted by backend (GET /api/v1/skills → 200)', async () => {
    if (!HAS_SOLUTION_KEYS) return

    const res = await solutionFetch('/api/v1/skills')
    expect(res.status).toBe(200)
  })

  it('exercise-planner skill is registered and published', async () => {
    if (!HAS_SOLUTION_KEYS) return

    const res = await solutionFetch('/api/v1/skills')
    expect(res.status).toBe(200)

    const body = await res.json()
    const skills = Array.isArray(body) ? body : (body.items ?? [])
    const skill = skills.find((s: { slug: string }) => s.slug === SKILL_SLUG)

    expect(skill).toBeTruthy()
    expect(skill.slug).toBe(SKILL_SLUG)
    console.log(`[integration] Found skill: ${skill.id} (${skill.slug})`)
  })
})

// ═══════════════════════════════════════════
// Group C: Full E2E with AI
// ═══════════════════════════════════════════

describe('Group C: Full E2E with AI', () => {
  const VALID_SYNC_FIELDS = [
    'title',
    'subtitle',
    'medicalSummary',
    'contraindications',
    'principlesDo',
    'principlesAvoid',
    'frequency',
    'exercises',
    'progressionPlan',
    'medicalReminder',
  ]

  // Shared session — run the AI ONCE in beforeAll, assert on cached events
  let sessionEvents: SseEvent[] = []
  let sessionError: Error | null = null

  // Provide enough detail so the AI generates the plan directly without follow-up questions.
  const TEST_MESSAGE =
    '体态性骨盆前倾（自我评估，无腰椎病变），主要症状：腰部酸痛和大腿前侧紧张，' +
    '零基础运动，家中有瑜伽垫和椅子，无合并症。请直接生成完整康复训练方案，不需要再询问我任何问题。'

  beforeAll(async () => {
    if (!HAS_SOLUTION_KEYS) return

    const distPath = resolve(__dirname, '../../dist/index.js')
    if (!existsSync(distPath)) {
      console.log('[integration] Building MCP server dist...')
      execSync('npm run build', { cwd: resolve(__dirname, '../..'), stdio: 'pipe' })
    }

    const sessionId = `rehab-integration-${Date.now()}`
    console.log(`[integration] Starting AI session: ${sessionId}`)

    try {
      sessionEvents = await collectSSEEvents({
        sessionId,
        message: TEST_MESSAGE,
        mcpServerPath: distPath,
        timeout: 200_000,
      })
      console.log(`[integration] Session complete. Total events: ${sessionEvents.length}`)
    } catch (err) {
      sessionError = err as Error
      console.error(`[integration] Session error: ${sessionError.message}`)
    }
  })

  it.skipIf(!HAS_SOLUTION_KEYS)(
    'SSE stream opens with 2xx status and correct content-type',
    async () => {
      const distPath = resolve(__dirname, '../../dist/index.js')
      const response = await fetch(
        `${BACKEND_URL}/api/v1/sessions/rehab-probe-${Date.now()}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            'x-tenant-id': TENANT_ID,
          },
          body: JSON.stringify({
            message: TEST_MESSAGE,
            tenantId: TENANT_ID,
            enabledSkills: [SKILL_SLUG],
            mcpServers: { 'rehab-tools': { command: 'node', args: [distPath] } },
          }),
          signal: AbortSignal.timeout(10_000),
        }
      )
      // NestJS POST defaults to 201
      expect(response.status).toBeLessThan(300)
      expect(response.headers.get('content-type')).toContain('text/event-stream')
      response.body?.cancel()
    }
  )

  it.skipIf(!HAS_SOLUTION_KEYS)(
    'receives at least 1 output_update event within 200s',
    () => {
      if (sessionError) throw sessionError

      const outputUpdates = sessionEvents.filter((e) => e.event?.type === 'output_update')
      console.log(`[integration] Received ${outputUpdates.length} output_update events`)
      expect(outputUpdates.length).toBeGreaterThanOrEqual(1)
    }
  )

  it.skipIf(!HAS_SOLUTION_KEYS)(
    'output_update.field is one of the 10 valid SyncFields',
    () => {
      if (sessionError) throw sessionError

      const outputUpdates = sessionEvents.filter((e) => e.event?.type === 'output_update')
      expect(outputUpdates.length).toBeGreaterThanOrEqual(1)

      for (const envelope of outputUpdates) {
        const payload = (envelope.event as any)?.payload ?? {}
        const data = payload.data ?? payload
        const field = data.field as string
        expect(VALID_SYNC_FIELDS).toContain(field)
        console.log(`[integration] output_update: field=${field}`)
      }
    }
  )

  it.skipIf(!HAS_SOLUTION_KEYS)(
    'output_update.value is a non-empty string',
    () => {
      if (sessionError) throw sessionError

      const outputUpdates = sessionEvents.filter((e) => e.event?.type === 'output_update')
      expect(outputUpdates.length).toBeGreaterThanOrEqual(1)

      for (const envelope of outputUpdates) {
        const payload = (envelope.event as any)?.payload ?? {}
        const data = payload.data ?? payload
        expect(typeof data.value).toBe('string')
        expect((data.value as string).length).toBeGreaterThan(0)
      }
    }
  )

  it.skipIf(!HAS_SOLUTION_KEYS)(
    'receives agent_status:complete event within 200s',
    () => {
      if (sessionError) throw sessionError

      // agent_status has status at top level: { type, status, sessionId, ... }
      const completeEvents = sessionEvents.filter(
        (e) =>
          e.event?.type === 'agent_status' &&
          (e.event as any)?.status === 'complete'
      )
      expect(completeEvents.length).toBeGreaterThanOrEqual(1)
      console.log(
        `[integration] agent_status:complete received after ${sessionEvents.length} total events`
      )
    }
  )
})
