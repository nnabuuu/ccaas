import { describe, it, expect, vi, afterEach } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../index.js'

// vi.mock is hoisted above imports by vitest — wraps readFileSync in a vi.fn
// so individual tests can override it with mockImplementationOnce.
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs')
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
  }
})

import { readFileSync } from 'fs'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

async function createTestClient(): Promise<Client> {
  const server = createServer()
  const client = new Client({ name: 'test-client', version: '1.0' }, { capabilities: {} })
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  return client
}

const VALID_EXERCISE = {
  type: 'pelvic-tilt',
  sets: 3,
  reps: 12,
  restSec: 20,
  tempo: '5秒保持',
  howTo: ['平躺', '收紧腹部'],
  safety: ['不要憋气'],
}

// ─────────────────────────────────────────────
// list_tools
// ─────────────────────────────────────────────

describe('list_tools', () => {
  it('returns exactly 2 tools (write_output + get_exercise_library)', async () => {
    const client = await createTestClient()
    const result = await client.listTools()
    expect(result.tools).toHaveLength(2)
    const names = result.tools.map((t) => t.name)
    expect(names).toContain('write_output')
    expect(names).toContain('get_exercise_library')
  })
})

// ─────────────────────────────────────────────
// get_exercise_library
// ─────────────────────────────────────────────

describe('get_exercise_library', () => {
  it('returns 4 exercises', async () => {
    const client = await createTestClient()
    const result = await client.callTool({ name: 'get_exercise_library', arguments: {} })
    const content = result.content[0] as { type: string; text: string }
    const library = JSON.parse(content.text) as unknown[]
    expect(library).toHaveLength(4)
  })

  it('each exercise contains id, name, nameZh, muscles, figure, phases', async () => {
    const client = await createTestClient()
    const result = await client.callTool({ name: 'get_exercise_library', arguments: {} })
    const content = result.content[0] as { type: string; text: string }
    const library = JSON.parse(content.text) as Record<string, unknown>[]
    for (const exercise of library) {
      expect(exercise).toHaveProperty('id')
      expect(exercise).toHaveProperty('name')
      expect(exercise).toHaveProperty('nameZh')
      expect(exercise).toHaveProperty('muscles')
      expect(exercise).toHaveProperty('figure')
      expect(exercise).toHaveProperty('phases')
    }
  })

  it('does NOT include keyframes field', async () => {
    const client = await createTestClient()
    const result = await client.callTool({ name: 'get_exercise_library', arguments: {} })
    const content = result.content[0] as { type: string; text: string }
    const library = JSON.parse(content.text) as Record<string, unknown>[]
    for (const exercise of library) {
      expect(exercise).not.toHaveProperty('keyframes')
    }
  })
})

// ─────────────────────────────────────────────
// write_output — valid inputs
// ─────────────────────────────────────────────

describe('write_output — valid inputs', () => {
  async function callWriteOutput(
    client: Client,
    field: string,
    value: string,
    preview = 'test preview'
  ) {
    const result = await client.callTool({
      name: 'write_output',
      arguments: { field, value, preview },
    })
    const content = result.content[0] as { type: string; text: string }
    return { result, parsed: JSON.parse(content.text) as Record<string, unknown> }
  }

  it('title (1–50 chars) returns {field, value, preview}', async () => {
    const client = await createTestClient()
    const { parsed } = await callWriteOutput(client, 'title', '腰椎核心康复方案')
    expect(parsed.field).toBe('title')
    expect(parsed.value).toBe('腰椎核心康复方案')
    expect(parsed.preview).toBe('test preview')
  })

  it('subtitle (1–100 chars)', async () => {
    const client = await createTestClient()
    const { result } = await callWriteOutput(client, 'subtitle', '适合腰椎管狭窄患者的低冲击训练')
    expect(result.isError).toBeFalsy()
  })

  it('medicalSummary', async () => {
    const client = await createTestClient()
    const { result } = await callWriteOutput(client, 'medicalSummary', '患者存在L4-L5椎间盘突出')
    expect(result.isError).toBeFalsy()
  })

  it('contraindications', async () => {
    const client = await createTestClient()
    const { result } = await callWriteOutput(client, 'contraindications', '急性疼痛期禁止训练')
    expect(result.isError).toBeFalsy()
  })

  it('principlesDo', async () => {
    const client = await createTestClient()
    const { result } = await callWriteOutput(client, 'principlesDo', '保持腹部核心激活')
    expect(result.isError).toBeFalsy()
  })

  it('principlesAvoid', async () => {
    const client = await createTestClient()
    const { result } = await callWriteOutput(client, 'principlesAvoid', '避免高冲击跳跃动作')
    expect(result.isError).toBeFalsy()
  })

  it('frequency', async () => {
    const client = await createTestClient()
    const { result } = await callWriteOutput(client, 'frequency', '每周3次，每次30分钟')
    expect(result.isError).toBeFalsy()
  })

  it('progressionPlan', async () => {
    const client = await createTestClient()
    const { result } = await callWriteOutput(client, 'progressionPlan', '第2周增加重复次数')
    expect(result.isError).toBeFalsy()
  })

  it('medicalReminder', async () => {
    const client = await createTestClient()
    const { result } = await callWriteOutput(
      client,
      'medicalReminder',
      '训练前请咨询主治医生'
    )
    expect(result.isError).toBeFalsy()
  })

  it('exercises (valid ExerciseSpec[] JSON)', async () => {
    const client = await createTestClient()
    const value = JSON.stringify([VALID_EXERCISE])
    const { result, parsed } = await callWriteOutput(client, 'exercises', value)
    expect(result.isError).toBeFalsy()
    expect(parsed.field).toBe('exercises')
    expect(parsed.value).toBe(value)
  })
})

// ─────────────────────────────────────────────
// write_output — validation failures (isError: true)
// ─────────────────────────────────────────────

describe('write_output — validation failures', () => {
  async function callAndExpectError(client: Client, field: string, value: string) {
    const result = await client.callTool({
      name: 'write_output',
      arguments: { field, value, preview: 'test' },
    })
    expect(result.isError).toBe(true)
    return result
  }

  it('invalid field name → isError', async () => {
    const client = await createTestClient()
    await callAndExpectError(client, 'unknownField', 'some value')
  })

  it('title exceeds 50 characters → isError', async () => {
    const client = await createTestClient()
    await callAndExpectError(client, 'title', 'a'.repeat(51))
  })

  it('title is empty string → isError', async () => {
    const client = await createTestClient()
    await callAndExpectError(client, 'title', '')
  })

  it('subtitle exceeds 100 characters → isError', async () => {
    const client = await createTestClient()
    await callAndExpectError(client, 'subtitle', 'a'.repeat(101))
  })

  it('exercises is invalid JSON → isError', async () => {
    const client = await createTestClient()
    await callAndExpectError(client, 'exercises', 'not valid json')
  })

  it('exercises is empty array [] → isError', async () => {
    const client = await createTestClient()
    await callAndExpectError(client, 'exercises', '[]')
  })

  it('exercises has sets=0 (must be positive integer) → isError', async () => {
    const client = await createTestClient()
    const badExercise = { ...VALID_EXERCISE, sets: 0 }
    await callAndExpectError(client, 'exercises', JSON.stringify([badExercise]))
  })
})

// ─────────────────────────────────────────────
// Unknown tool
// ─────────────────────────────────────────────

describe('unknown tool', () => {
  it('returns isError: true', async () => {
    const client = await createTestClient()
    const result = await client.callTool({ name: 'nonexistent_tool', arguments: {} })
    expect(result.isError).toBe(true)
  })
})

// ─────────────────────────────────────────────
// Exercise library fallback
// ─────────────────────────────────────────────

describe('exercise library fallback', () => {
  afterEach(() => {
    vi.mocked(readFileSync).mockClear()
  })

  it('returns 4 hardcoded fallback exercises when file cannot be read', async () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw new Error('File not found')
    })
    const client = await createTestClient()
    const result = await client.callTool({ name: 'get_exercise_library', arguments: {} })
    expect(result.isError).toBeFalsy()
    const content = result.content[0] as { type: string; text: string }
    const library = JSON.parse(content.text) as Record<string, unknown>[]
    expect(library).toHaveLength(4)
    const ids = library.map((e) => e.id)
    expect(ids).toContain('pelvic-tilt')
    expect(ids).toContain('dead-bug')
    expect(ids).toContain('cat-cow')
    expect(ids).toContain('seated-boxing')
  })
})
