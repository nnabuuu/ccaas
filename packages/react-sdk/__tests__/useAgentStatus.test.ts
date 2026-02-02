import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentStatus } from '../src/hooks/useAgentStatus'
import type { UseAgentConnectionReturn } from '../src/types'

const handlers: Record<string, Function> = {}
const mockSocket = {
  on: vi.fn((event: string, handler: Function) => {
    handlers[event] = handler
  }),
  off: vi.fn((event: string) => {
    delete handlers[event]
  }),
}

function createMockConnection(): UseAgentConnectionReturn {
  return {
    socket: mockSocket as any,
    connected: true,
    clientId: 'test',
    sessionId: 'test',
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

describe('useAgentStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(handlers).forEach(key => delete handlers[key])
  })

  it('should start idle', () => {
    const { result } = renderHook(() =>
      useAgentStatus({ connection: createMockConnection() }),
    )

    expect(result.current.agentStatus).toBe('idle')
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.isThinking).toBe(false)
    expect(result.current.tokenUsage).toBeNull()
  })

  it('should update status on agent_status event', () => {
    const { result } = renderHook(() =>
      useAgentStatus({ connection: createMockConnection() }),
    )

    act(() => {
      handlers['agent_status']?.({ status: 'running' })
    })

    expect(result.current.agentStatus).toBe('running')
    expect(result.current.isProcessing).toBe(true)
  })

  it('should track active tools', () => {
    const { result } = renderHook(() =>
      useAgentStatus({ connection: createMockConnection() }),
    )

    act(() => {
      handlers['tool_activity']?.({
        payload: {
          toolId: 'tool-1',
          toolName: 'write_output',
          phase: 'start',
          description: 'Writing output',
        },
      })
    })

    expect(result.current.activeTools.size).toBe(1)
    expect(result.current.activeTools.get('tool-1')?.toolName).toBe('write_output')

    act(() => {
      handlers['tool_activity']?.({
        payload: {
          toolId: 'tool-1',
          toolName: 'write_output',
          phase: 'end',
          duration: 100,
          success: true,
        },
      })
    })

    expect(result.current.activeTools.size).toBe(0)
  })

  it('should track thinking state', () => {
    const { result } = renderHook(() =>
      useAgentStatus({ connection: createMockConnection() }),
    )

    act(() => {
      handlers['agent_thinking']?.({ payload: { phase: 'start' } })
    })

    expect(result.current.isThinking).toBe(true)

    act(() => {
      handlers['agent_thinking']?.({ payload: { phase: 'delta', content: 'Hmm...' } })
    })

    expect(result.current.thinkingContent).toBe('Hmm...')

    act(() => {
      handlers['agent_thinking']?.({ payload: { phase: 'delta', content: ' Let me think.' } })
    })

    expect(result.current.thinkingContent).toBe('Hmm... Let me think.')

    act(() => {
      handlers['agent_thinking']?.({ payload: { phase: 'end' } })
    })

    expect(result.current.isThinking).toBe(false)
  })

  it('should update token usage', () => {
    const { result } = renderHook(() =>
      useAgentStatus({ connection: createMockConnection() }),
    )

    act(() => {
      handlers['token_usage']?.({
        payload: {
          inputTokens: 100,
          outputTokens: 50,
          sessionTotalTokens: 150,
          sessionInputTokens: 100,
          sessionOutputTokens: 50,
          model: 'claude-3',
          stopReason: 'end_turn',
          messageId: 'msg-1',
          cachedInputTokens: 10,
        },
      })
    })

    expect(result.current.tokenUsage).toEqual({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
    })
  })

  it('should clear tools and thinking on complete', () => {
    const { result } = renderHook(() =>
      useAgentStatus({ connection: createMockConnection() }),
    )

    // Start tool + thinking
    act(() => {
      handlers['tool_activity']?.({
        payload: { toolId: 't1', toolName: 'test', phase: 'start' },
      })
      handlers['agent_thinking']?.({ payload: { phase: 'start' } })
    })

    expect(result.current.activeTools.size).toBe(1)
    expect(result.current.isThinking).toBe(true)

    // Complete
    act(() => {
      handlers['agent_status']?.({ status: 'complete' })
    })

    expect(result.current.activeTools.size).toBe(0)
    expect(result.current.isThinking).toBe(false)
    expect(result.current.isProcessing).toBe(false)
  })

  it('should consider exploring and executing as processing', () => {
    const { result } = renderHook(() =>
      useAgentStatus({ connection: createMockConnection() }),
    )

    for (const status of ['thinking', 'running', 'exploring', 'executing']) {
      act(() => {
        handlers['agent_status']?.({ status })
      })
      expect(result.current.isProcessing).toBe(true)
    }

    for (const status of ['idle', 'complete', 'error']) {
      act(() => {
        handlers['agent_status']?.({ status })
      })
      expect(result.current.isProcessing).toBe(false)
    }
  })
})
