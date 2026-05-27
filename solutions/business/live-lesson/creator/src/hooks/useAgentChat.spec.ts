import { describe, it, expect } from 'vitest'
import { expandHistoryMessage } from './useAgentChat'

/**
 * Pure-helper tests for the history → ChatMessage[] expansion.
 * `useAgentChat` itself owns network + React state — tested via
 * component-level smoke + manual flow rather than here.
 */

describe('expandHistoryMessage', () => {
  it('user messages pass through unchanged (no card expansion)', () => {
    const out = expandHistoryMessage({
      id: 'u1',
      role: 'user',
      content: 'hello',
      createdAt: '2026-05-28T00:00:00Z',
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'u1', role: 'user', text: 'hello' })
  })

  it('skips system / unknown roles entirely (returns [])', () => {
    expect(
      expandHistoryMessage({
        id: 's1',
        role: 'system',
        content: 'init',
        createdAt: '2026-05-28T00:00:00Z',
      }),
    ).toEqual([])
  })

  it('assistant with no tool events → single agent message', () => {
    const out = expandHistoryMessage({
      id: 'a1',
      role: 'assistant',
      content: 'response',
      createdAt: '2026-05-28T00:00:00Z',
      toolEvents: [],
    })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({
      role: 'agent',
      text: 'response',
      toolEvents: [],
    })
  })

  it('hoists a single emit_todo_card toolEvent into a separate card message', () => {
    const out = expandHistoryMessage({
      id: 'a1',
      role: 'assistant',
      content: 'here is the plan',
      createdAt: '2026-05-28T00:00:00Z',
      toolEvents: [
        {
          toolName: 'emit_todo_card',
          toolId: 'tool-abc',
          phase: 'end',
          createdAt: '2026-05-28T00:00:01Z',
          toolOutput: JSON.stringify({
            kind: 'todo',
            title: 'Plan',
            items: [{ id: 't1', label: 'Step 1', status: 'pending' }],
          }),
        },
      ],
    })
    expect(out).toHaveLength(2)
    // Card comes first, agent text after.
    expect(out[0]).toMatchObject({
      id: 'tool-abc',
      role: 'agent',
      type: 'card',
      card: { kind: 'todo', title: 'Plan' },
    })
    expect(out[1]).toMatchObject({
      id: 'a1',
      role: 'agent',
      text: 'here is the plan',
    })
    // The hoisted tool event is removed from the agent message's
    // toolEvents (would otherwise double-render as a generic label).
    expect((out[1] as { toolEvents: unknown[] }).toolEvents).toEqual([])
  })

  it('hoists all 3 card types from a single message', () => {
    const out = expandHistoryMessage({
      id: 'a1',
      role: 'assistant',
      content: 'all three',
      createdAt: '2026-05-28T00:00:00Z',
      toolEvents: [
        {
          toolName: 'emit_todo_card',
          toolId: 'tool-1',
          phase: 'end',
          toolOutput: { kind: 'todo', title: 'T', items: [] },
        },
        {
          toolName: 'emit_questions_card',
          toolId: 'tool-2',
          phase: 'end',
          toolOutput: { kind: 'questions', title: 'Q', items: [] },
        },
        {
          toolName: 'emit_verify_card',
          toolId: 'tool-3',
          phase: 'end',
          toolOutput: { kind: 'verify', title: 'V', target: 'x', schema: 'v1', status: 'done', startedAt: '', completedAt: '', checks: [] },
        },
      ],
    })
    expect(out).toHaveLength(4) // 3 cards + 1 agent
    expect(out.slice(0, 3).map((m) => (m as { type?: string }).type)).toEqual([
      'card',
      'card',
      'card',
    ])
    expect(out[3]).toMatchObject({ id: 'a1', role: 'agent', text: 'all three' })
  })

  it('preserves non-card toolEvents on the agent message (e.g. Bash)', () => {
    const out = expandHistoryMessage({
      id: 'a1',
      role: 'assistant',
      content: 'mixed',
      createdAt: '2026-05-28T00:00:00Z',
      toolEvents: [
        {
          toolName: 'emit_todo_card',
          toolId: 'tool-1',
          phase: 'end',
          toolOutput: { kind: 'todo', title: 'T', items: [] },
        },
        {
          toolName: 'Bash',
          toolId: 'tool-2',
          phase: 'end',
        },
      ],
    })
    expect(out).toHaveLength(2) // 1 card + 1 agent (with Bash still attached)
    const agentMsg = out[1] as { toolEvents: Array<{ toolName: string }> }
    expect(agentMsg.toolEvents).toHaveLength(1)
    expect(agentMsg.toolEvents[0].toolName).toBe('Bash')
  })

  it('keeps emit_*_card toolEvent attached if toolOutput is corrupt (graceful degrade)', () => {
    // If the persisted toolOutput got mangled, we leave the generic
    // "调用 emit_X_card" label so the user knows something happened
    // (rather than the call vanishing entirely).
    const out = expandHistoryMessage({
      id: 'a1',
      role: 'assistant',
      content: 'corrupt card',
      createdAt: '2026-05-28T00:00:00Z',
      toolEvents: [
        {
          toolName: 'emit_todo_card',
          toolId: 'tool-1',
          phase: 'end',
          toolOutput: '{ this is not valid json',
        },
      ],
    })
    expect(out).toHaveLength(1) // no card hoisted
    const agentMsg = out[0] as { toolEvents: Array<{ toolName: string }> }
    expect(agentMsg.toolEvents).toHaveLength(1)
    expect(agentMsg.toolEvents[0].toolName).toBe('emit_todo_card')
  })

  it('uses tool.toolId as the card message id (stable across reloads)', () => {
    // Critical for React keys: if id were generated with Math.random()
    // every reload, React would unmount + remount card components
    // losing local state (expanded/collapsed, in-flight form input).
    const out = expandHistoryMessage({
      id: 'a1',
      role: 'assistant',
      content: '',
      createdAt: '2026-05-28T00:00:00Z',
      toolEvents: [
        {
          toolName: 'emit_todo_card',
          toolId: 'backend-assigned-id-123',
          phase: 'end',
          toolOutput: { kind: 'todo', title: 'T', items: [] },
        },
      ],
    })
    expect(out[0].id).toBe('backend-assigned-id-123')
  })
})
