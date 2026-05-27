import { describe, it, expect } from 'vitest'
import { CARD_TOOL_NAMES, tryParseCardPayload } from './chat-cards'

describe('CARD_TOOL_NAMES', () => {
  it('matches the 3 tools registered in creator-mcp-server', () => {
    // If a new card tool is added (e.g. emit_chart_card), this set
    // must grow OR the new card won't survive history reload (the
    // hoist guard in useAgentChat keys off this set).
    expect(CARD_TOOL_NAMES.has('emit_todo_card')).toBe(true)
    expect(CARD_TOOL_NAMES.has('emit_questions_card')).toBe(true)
    expect(CARD_TOOL_NAMES.has('emit_verify_card')).toBe(true)
    expect(CARD_TOOL_NAMES.size).toBe(3)
  })

  it('rejects non-card tool names', () => {
    expect(CARD_TOOL_NAMES.has('Bash')).toBe(false)
    expect(CARD_TOOL_NAMES.has('emit_other_card')).toBe(false)
    expect(CARD_TOOL_NAMES.has('')).toBe(false)
  })
})

describe('tryParseCardPayload', () => {
  it('returns null for null / undefined', () => {
    expect(tryParseCardPayload(null)).toBeNull()
    expect(tryParseCardPayload(undefined)).toBeNull()
  })

  it('returns null for primitives (numbers, booleans)', () => {
    expect(tryParseCardPayload(42)).toBeNull()
    expect(tryParseCardPayload(true)).toBeNull()
  })

  it('parses a JSON-string payload (typical persisted form)', () => {
    const json = JSON.stringify({
      kind: 'todo',
      title: 'X',
      items: [{ id: 't1', label: 'L', status: 'done' }],
    })
    const card = tryParseCardPayload(json)
    expect(card?.kind).toBe('todo')
    expect((card as { title: string }).title).toBe('X')
  })

  it('accepts an already-parsed object (in case backend deserialized)', () => {
    const obj = {
      kind: 'verify',
      title: 'V',
      target: 'manifest.json',
      schema: 'v1',
      status: 'done',
      startedAt: '10:00',
      completedAt: '10:01',
      checks: [{ id: 'c1', label: 'L', desc: 'D', status: 'pass' }],
    }
    const card = tryParseCardPayload(obj)
    expect(card?.kind).toBe('verify')
  })

  it('returns null when JSON string is malformed', () => {
    expect(tryParseCardPayload('{not json')).toBeNull()
  })

  it('returns null when kind is missing', () => {
    expect(tryParseCardPayload({ title: 'X', items: [] })).toBeNull()
  })

  it('returns null when kind is unknown (forward-compat for future card types)', () => {
    // If chat-cards adds 'chart' but this build doesn't know it,
    // we silently skip — better than throwing in render.
    expect(tryParseCardPayload({ kind: 'chart', data: [] })).toBeNull()
  })

  it('accepts kind-tagged input even when structurally invalid (parser only checks kind)', () => {
    // Lock the parser's contract: it's a kind discriminator gate,
    // NOT a full validator. Deeper validation lives on the backend
    // when the tool was first called. If a corrupt write somehow
    // bypassed that, renderers must stay defensive — they're the
    // last line.
    expect(tryParseCardPayload({ kind: 'todo' /* missing title + items */ })).toEqual({
      kind: 'todo',
    })
    expect(tryParseCardPayload({ kind: 'verify' /* missing target + checks */ })).toEqual({
      kind: 'verify',
    })
  })

  it('preserves all fields when kind is recognized (trusts backend Zod validation)', () => {
    // Deeper field validation lives on the backend (Zod-validated
    // when the tool was called); the frontend trusts the discriminator
    // and renders defensively. This test locks the contract: any
    // valid kind → payload returned verbatim.
    const obj = {
      kind: 'questions',
      title: 'Q',
      items: [
        {
          id: 'q1',
          label: 'L',
          type: 'radio',
          options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        },
      ],
    }
    const card = tryParseCardPayload(obj)
    expect(card).toEqual(obj)
  })
})
