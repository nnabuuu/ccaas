/**
 * Integration Tests: Rehab Solution ↔ CCAAS Backend
 *
 * Tests the full pipeline against a real CCAAS backend at localhost:3001.
 * The backend handles the Anthropic API key server-side — no client-side key needed.
 *
 * Environment variables:
 *   CCAAS_BOOTSTRAP_KEY  — Admin key from backend startup logs (sk-default-...)
 *   CCAAS_BACKEND_URL    — Default: http://localhost:3001
 *
 * Groups:
 *   A — Connectivity (no keys needed)
 *   B — Tenant + API key (needs CCAAS_BOOTSTRAP_KEY)
 *   C — Skill registration (needs CCAAS_BOOTSTRAP_KEY)
 *   D — Full E2E with AI (needs CCAAS_BOOTSTRAP_KEY; backend provides Anthropic key)
 *
 * Run:
 *   CCAAS_BOOTSTRAP_KEY=sk-... npm run test:integration
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BACKEND_URL = process.env.CCAAS_BACKEND_URL ?? 'http://localhost:3001'
const BOOTSTRAP_KEY = process.env.CCAAS_BOOTSTRAP_KEY ?? ''
const HAS_BOOTSTRAP_KEY = BOOTSTRAP_KEY.length > 0

const TENANT_SLUG = 'rehab-integration-test'
const SKILL_SLUG = 'exercise-planner'

// Shared state populated by Group B, consumed by Groups C and D
let tenantId = ''
let apiKey = ''

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

async function adminFetch(path: string, options: RequestInit = {}) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': BOOTSTRAP_KEY,
      ...(options.headers ?? {}),
    },
  })
}

async function tenantFetch(path: string, options: RequestInit = {}) {
  return fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-tenant-id': tenantId,
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

  const body = JSON.stringify({
    message,
    tenantId,
    enabledSkillSlugs: [SKILL_SLUG],
    mcpServers: {
      'rehab-tools': {
        command: 'node',
        args: [mcpServerPath],
      },
    },
  })

  const response = await fetch(`${BACKEND_URL}/api/v1/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-tenant-id': tenantId,
    },
    body,
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

  const done = new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error('SSE timeout')), timeout)

    async function pump() {
      try {
        while (true) {
          const { value, done: streamDone } = await reader.read()
          if (streamDone) {
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

              // Stop on completion
              const evt = envelope.event
              if (
                evt &&
                evt.type === 'agent_status' &&
                (evt as any).payload?.status === 'complete'
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

  await done
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
        `Cannot reach CCAAS backend at ${BACKEND_URL}. ` +
          'Start it with: npm run dev:backend (from monorepo root)'
      )
    }
    expect(res.status).toBeLessThan(500)
  })
})

// ═══════════════════════════════════════════
// Group B: Tenant + API key
// ═══════════════════════════════════════════

describe('Group B: Tenant + API key', () => {
  // Skip entire group if no bootstrap key
  beforeAll(() => {
    if (!HAS_BOOTSTRAP_KEY) {
      console.log(
        '[integration] Skipping Group B/C/D: CCAAS_BOOTSTRAP_KEY not set.\n' +
          'Find it in backend startup logs (sk-default-...) and re-run with:\n' +
          `  CCAAS_BOOTSTRAP_KEY=<key> npm run test:integration`
      )
    }
  })

  it('creates or retrieves test tenant (idempotent)', async () => {
    if (!HAS_BOOTSTRAP_KEY) return

    // Try to find existing tenant by slug
    const listRes = await adminFetch('/api/v1/tenants')
    if (listRes.ok) {
      const tenants = (await listRes.json()) as Array<{ id: string; slug: string }>
      const existing = tenants.find((t) => t.slug === TENANT_SLUG)
      if (existing) {
        tenantId = existing.id
        console.log(`[integration] Using existing tenant: ${tenantId}`)
        return
      }
    }

    // Create new tenant
    const createRes = await adminFetch('/api/v1/tenants', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Rehab Integration Test',
        slug: TENANT_SLUG,
        autoCreateApiKey: false,
      }),
    })

    expect(createRes.status).toBe(201)
    const tenant = (await createRes.json()) as { id: string; slug: string }
    expect(tenant.id).toBeTruthy()
    expect(tenant.slug).toBe(TENANT_SLUG)

    tenantId = tenant.id
    console.log(`[integration] Created tenant: ${tenantId}`)
  })

  it('creates an API key for the test tenant', async () => {
    if (!HAS_BOOTSTRAP_KEY || !tenantId) return

    const createRes = await adminFetch('/api/v1/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        name: 'rehab-integration-test-key',
        scopes: ['chat', 'skills:read', 'skills:write', 'skills:execute'],
      }),
    })

    expect(createRes.status).toBe(201)
    const body = (await createRes.json()) as { rawKey?: string; apiKey?: { key?: string } }

    // Backend may return rawKey directly or nested
    const raw = body.rawKey ?? (body.apiKey as any)?.rawKey ?? ''
    expect(raw).toBeTruthy()

    apiKey = raw
    console.log(`[integration] Created API key: ${raw.slice(0, 20)}...`)
  })

  it('API key is accepted by backend (GET /api/v1/skills → 200)', async () => {
    if (!HAS_BOOTSTRAP_KEY || !apiKey || !tenantId) return

    const res = await tenantFetch('/api/v1/skills')
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════
// Group C: Skill registration
// ═══════════════════════════════════════════

describe('Group C: Skill registration', () => {
  it('registers exercise-planner skill from SKILL.md', async () => {
    if (!HAS_BOOTSTRAP_KEY || !apiKey || !tenantId) return

    // Read SKILL.md
    const skillMdPath = resolve(__dirname, '../../../../skills/exercise-planner/SKILL.md')
    const skillContent = readFileSync(skillMdPath, 'utf-8')

    // Parse frontmatter (---\nname: ...\n---)
    const frontmatterMatch = skillContent.match(/^---\n([\s\S]*?)\n---/)
    const nameMatch = frontmatterMatch?.[1].match(/^name:\s*(.+)$/m)
    const descriptionMatch = frontmatterMatch?.[1].match(/^description:\s*(.+)$/m)

    const skillName = nameMatch?.[1]?.trim() ?? '康复训练规划师'
    const skillDescription = descriptionMatch?.[1]?.trim() ?? '个性化康复训练方案'
    const systemPrompt = skillContent

    // If skill already exists, delete it first (ensure fresh content)
    const listRes = await tenantFetch('/api/v1/skills')
    if (listRes.ok) {
      const skills = (await listRes.json()) as Array<{ id: string; slug: string }>
      const existing = Array.isArray(skills)
        ? skills.find((s) => s.slug === SKILL_SLUG)
        : undefined
      if (existing) {
        console.log(`[integration] Deleting existing skill: ${existing.id}`)
        await tenantFetch(`/api/v1/skills/${existing.id}`, { method: 'DELETE' })
      }
    }

    // Create skill
    const createRes = await tenantFetch('/api/v1/skills', {
      method: 'POST',
      body: JSON.stringify({
        name: skillName,
        slug: SKILL_SLUG,
        description: skillDescription,
        type: 'prompt',
        systemPrompt,
        enabled: true,
      }),
    })

    expect(createRes.status).toBe(201)
    const skill = (await createRes.json()) as { id: string; slug: string }
    expect(skill.id).toBeTruthy()
    expect(skill.slug).toBe(SKILL_SLUG)

    console.log(`[integration] Created skill: ${skill.id}`)

    // Publish the skill
    const publishRes = await tenantFetch(`/api/v1/skills/${skill.id}/publish`, {
      method: 'POST',
    })
    expect(publishRes.status).toBeLessThan(300)
    console.log(`[integration] Published skill: ${skill.id}`)
  })

  it('GET /api/v1/skills returns exercise-planner', async () => {
    if (!HAS_BOOTSTRAP_KEY || !apiKey || !tenantId) return

    const res = await tenantFetch('/api/v1/skills')
    expect(res.status).toBe(200)

    const body = await res.json()
    const skills = Array.isArray(body) ? body : (body.items ?? [])
    const found = skills.find((s: { slug: string }) => s.slug === SKILL_SLUG)
    expect(found).toBeTruthy()
  })
})

// ═══════════════════════════════════════════
// Group D: Full E2E with AI
// ═══════════════════════════════════════════

describe('Group D: Full E2E with AI', () => {
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

  // Ensure MCP server dist is built
  beforeAll(() => {
    if (!HAS_BOOTSTRAP_KEY) return

    const distPath = resolve(__dirname, '../../dist/index.js')
    if (!existsSync(distPath)) {
      console.log('[integration] Building MCP server dist...')
      execSync('npm run build', {
        cwd: resolve(__dirname, '../..'),
        stdio: 'pipe',
      })
    }
  })

  it.skipIf(!HAS_BOOTSTRAP_KEY)(
    'POST /api/v1/sessions/:sessionId/messages → text/event-stream (200)',
    async () => {
      const sessionId = `rehab-integration-${Date.now()}`
      const distPath = resolve(__dirname, '../../dist/index.js')

      const response = await fetch(
        `${BACKEND_URL}/api/v1/sessions/${sessionId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'x-tenant-id': tenantId,
          },
          body: JSON.stringify({
            message: '请帮我制定骨盆前倾康复训练方案',
            tenantId,
            enabledSkillSlugs: [SKILL_SLUG],
            mcpServers: {
              'rehab-tools': {
                command: 'node',
                args: [distPath],
              },
            },
          }),
          signal: AbortSignal.timeout(10_000),
        }
      )

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toContain('text/event-stream')

      // Abort immediately — we just verified the stream opened correctly
      response.body?.cancel()
    }
  )

  it.skipIf(!HAS_BOOTSTRAP_KEY)(
    'receives at least 1 output_update event within 90s',
    async () => {
      const sessionId = `rehab-integration-${Date.now()}`
      const distPath = resolve(__dirname, '../../dist/index.js')

      const events = await collectSSEEvents({
        sessionId,
        message: '请帮我制定骨盆前倾康复训练方案',
        mcpServerPath: distPath,
      })

      const outputUpdates = events.filter((e) => e.event?.type === 'output_update')
      expect(outputUpdates.length).toBeGreaterThanOrEqual(1)

      console.log(`[integration] Received ${outputUpdates.length} output_update events`)
    }
  )

  it.skipIf(!HAS_BOOTSTRAP_KEY)(
    'output_update.field is one of the 10 valid SyncFields',
    async () => {
      const sessionId = `rehab-integration-${Date.now()}`
      const distPath = resolve(__dirname, '../../dist/index.js')

      const events = await collectSSEEvents({
        sessionId,
        message: '请帮我制定骨盆前倾康复训练方案',
        mcpServerPath: distPath,
      })

      const outputUpdates = events.filter((e) => e.event?.type === 'output_update')
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

  it.skipIf(!HAS_BOOTSTRAP_KEY)(
    'output_update.value is a non-empty string',
    async () => {
      const sessionId = `rehab-integration-${Date.now()}`
      const distPath = resolve(__dirname, '../../dist/index.js')

      const events = await collectSSEEvents({
        sessionId,
        message: '请帮我制定骨盆前倾康复训练方案',
        mcpServerPath: distPath,
      })

      const outputUpdates = events.filter((e) => e.event?.type === 'output_update')
      expect(outputUpdates.length).toBeGreaterThanOrEqual(1)

      for (const envelope of outputUpdates) {
        const payload = (envelope.event as any)?.payload ?? {}
        const data = payload.data ?? payload
        const value = data.value as string

        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
      }
    }
  )

  it.skipIf(!HAS_BOOTSTRAP_KEY)(
    'receives agent_status:complete event within 90s',
    async () => {
      const sessionId = `rehab-integration-${Date.now()}`
      const distPath = resolve(__dirname, '../../dist/index.js')

      const events = await collectSSEEvents({
        sessionId,
        message: '请帮我制定骨盆前倾康复训练方案',
        mcpServerPath: distPath,
      })

      const completeEvents = events.filter(
        (e) =>
          e.event?.type === 'agent_status' &&
          (e.event as any)?.payload?.status === 'complete'
      )

      expect(completeEvents.length).toBeGreaterThanOrEqual(1)
      console.log(
        `[integration] agent_status:complete received after ${events.length} total events`
      )
    }
  )
})
