import { describe, it, expect } from 'vitest'
import { handleEmitTodoCard } from '../tools/todo.js'
import { handleEmitQuestionsCard } from '../tools/questions.js'
import { handleEmitVerifyCard } from '../tools/verify.js'

/**
 * Tool handler contract: each tool returns
 *   { content: [{ type: 'text', text: JSON.stringify({ kind, ...input }) }] }
 *
 * The `kind` discriminator is what the frontend keys off in
 * `useAgentChat.applyEvent` to route to the right card component. If
 * a handler drops `kind` or wraps the payload differently, the
 * frontend silently ignores the card. These tests lock the shape.
 */

describe('handleEmitTodoCard', () => {
  it('wraps input with kind: "todo" and JSON-stringifies into MCP text content', () => {
    const result = handleEmitTodoCard({
      title: 'X',
      items: [{ id: 't1', label: 'L', status: 'pending' }],
    })
    expect(result.content).toHaveLength(1)
    expect(result.content[0].type).toBe('text')
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.kind).toBe('todo')
    expect(parsed.title).toBe('X')
    expect(parsed.items[0].label).toBe('L')
  })

  it('throws on invalid input (caught by index.ts handler + returned as isError)', () => {
    expect(() => handleEmitTodoCard({ title: 'X' })).toThrow()
  })
})

describe('handleEmitQuestionsCard', () => {
  it('wraps input with kind: "questions"', () => {
    const result = handleEmitQuestionsCard({
      title: 'X',
      items: [
        {
          id: 'q1',
          label: 'L',
          type: 'radio',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
          ],
        },
      ],
    })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.kind).toBe('questions')
    expect(parsed.items[0].type).toBe('radio')
  })

  it('throws on invalid (radio with < 2 options)', () => {
    expect(() =>
      handleEmitQuestionsCard({
        title: 'X',
        items: [
          {
            id: 'q1',
            label: 'L',
            type: 'radio',
            options: [{ value: 'a', label: 'A' }],
          },
        ],
      }),
    ).toThrow()
  })
})

describe('handleEmitVerifyCard', () => {
  it('wraps input with kind: "verify"', () => {
    const result = handleEmitVerifyCard({
      title: 'X',
      target: 'manifest.json',
      schema: 'v1',
      status: 'done',
      startedAt: '10:00',
      completedAt: '10:01',
      checks: [{ id: 'c1', label: 'L', desc: 'D', status: 'pass' }],
    })
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.kind).toBe('verify')
    expect(parsed.status).toBe('done')
    expect(parsed.checks).toHaveLength(1)
  })

  it('preserves all fields verbatim (frontend trusts the echo)', () => {
    const input = {
      title: 'manifest 校验',
      target: 'manifest.json',
      schema: 'execution-schema v2.1',
      status: 'running' as const,
      startedAt: '10:32:15',
      completedAt: '',
      checks: [
        {
          id: 'c1',
          label: 'Schema 结构',
          desc: '顶层字段完整性',
          status: 'pass' as const,
        },
      ],
    }
    const parsed = JSON.parse(handleEmitVerifyCard(input).content[0].text)
    expect(parsed).toEqual({ kind: 'verify', ...input })
  })
})
