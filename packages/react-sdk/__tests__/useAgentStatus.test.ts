import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    serverUrl: 'http://localhost:3001',
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    startNewConversation: vi.fn(),
    switchSession: vi.fn(),
    sessionReady: false,
    markSessionReady: vi.fn(),
  }
}

function createSSEConnection(): UseAgentConnectionReturn {
  return {
    socket: null as any,
    connected: true,
    clientId: 'sse:test-session',
    sessionId: 'test-session',
    serverUrl: 'http://localhost:3001',
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    startNewConversation: vi.fn(),
    switchSession: vi.fn(),
    sessionReady: true,
    markSessionReady: vi.fn(),
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

    // Tool is kept in map with phase='end' and endTime recorded
    expect(result.current.activeTools.size).toBe(1)
    expect(result.current.activeTools.get('tool-1')?.phase).toBe('end')
    expect(result.current.activeTools.get('tool-1')?.endTime).toBeDefined()
  })

  it('should track thinking state', () => {
    const { result } = renderHook(() =>
      useAgentStatus({ connection: createMockConnection() }),
    )

    act(() => {
      handlers['agent_thinking']?.({ payload: { phase: 'start' } })
    })

    expect(result.current.isThinking).toBe(true)
    expect(result.current.thinkingStartTime).toBeDefined()

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

    // Thinking state is kept for 3 seconds after end
    expect(result.current.isThinking).toBe(true)
    expect(result.current.thinkingContent).toBe('Hmm... Let me think.')
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

  describe('subagent tracking (socket mode)', () => {
    it('should add agent on subagent_started', () => {
      const { result } = renderHook(() =>
        useAgentStatus({ connection: createMockConnection() }),
      )

      act(() => {
        handlers['subagent_started']?.({
          type: 'subagent_started',
          sessionId: 'test',
          timestamp: new Date().toISOString(),
          payload: {
            subAgentId: 'toolu_01ABC',
            agentType: 'Task',
            description: 'Running background task',
            startedAt: new Date().toISOString(),
            status: 'running',
            nestingLevel: 1,
          },
        })
      })

      expect(result.current.activeSubAgents).toHaveLength(1)
      expect(result.current.activeSubAgents[0].subAgentId).toBe('toolu_01ABC')
    })

    it('should not duplicate agents on repeated subagent_started', () => {
      const { result } = renderHook(() =>
        useAgentStatus({ connection: createMockConnection() }),
      )
      const payload = {
        subAgentId: 'toolu_01ABC',
        agentType: 'Task',
        description: 'Running background task',
        startedAt: new Date().toISOString(),
        status: 'running',
        nestingLevel: 1,
      }

      act(() => {
        handlers['subagent_started']?.({ type: 'subagent_started', sessionId: 'test', timestamp: new Date().toISOString(), payload })
        handlers['subagent_started']?.({ type: 'subagent_started', sessionId: 'test', timestamp: new Date().toISOString(), payload })
      })

      expect(result.current.activeSubAgents).toHaveLength(1)
    })

    it('should update status on subagent_completed', () => {
      vi.useFakeTimers()
      const { result } = renderHook(() =>
        useAgentStatus({ connection: createMockConnection() }),
      )

      act(() => {
        handlers['subagent_started']?.({
          type: 'subagent_started',
          sessionId: 'test',
          timestamp: new Date().toISOString(),
          payload: {
            subAgentId: 'toolu_01ABC',
            agentType: 'Task',
            description: 'task',
            startedAt: new Date().toISOString(),
            status: 'running',
            nestingLevel: 1,
          },
        })
      })

      act(() => {
        handlers['subagent_completed']?.({
          type: 'subagent_completed',
          sessionId: 'test',
          timestamp: new Date().toISOString(),
          payload: { subAgentId: 'toolu_01ABC', status: 'completed', durationMs: 5000 },
        })
      })

      expect(result.current.activeSubAgents[0].status).toBe('completed')

      // After 3 seconds, agent should be removed
      act(() => {
        vi.advanceTimersByTime(3001)
      })

      expect(result.current.activeSubAgents).toHaveLength(0)
      vi.useRealTimers()
    })

    it('should cancel pending removal timeouts on unmount', () => {
      vi.useFakeTimers()
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      const { result, unmount } = renderHook(() =>
        useAgentStatus({ connection: createMockConnection() }),
      )

      act(() => {
        handlers['subagent_started']?.({
          type: 'subagent_started',
          sessionId: 'test',
          timestamp: new Date().toISOString(),
          payload: {
            subAgentId: 'toolu_01ABC',
            agentType: 'Task',
            description: 'task',
            startedAt: new Date().toISOString(),
            status: 'running',
            nestingLevel: 1,
          },
        })
        handlers['subagent_completed']?.({
          type: 'subagent_completed',
          sessionId: 'test',
          timestamp: new Date().toISOString(),
          payload: { subAgentId: 'toolu_01ABC', status: 'completed', durationMs: 5000 },
        })
      })

      // Unmount before the 3s timeout fires
      unmount()

      // clearTimeout should have been called for the pending removal
      expect(clearTimeoutSpy).toHaveBeenCalled()

      vi.useRealTimers()
      clearTimeoutSpy.mockRestore()
    })
  })

  describe('SSE mode (socket is null)', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      // Mock fetch to return a hanging SSE stream
      fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
        new Promise(() => {}) // Never resolves — simulates open SSE connection
      )
    })

    afterEach(() => {
      fetchSpy.mockRestore()
    })

    it('should call fetch with /events endpoint when socket is null', () => {
      renderHook(() =>
        useAgentStatus({ connection: createSSEConnection() }),
      )

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/sessions/test-session/events',
        expect.objectContaining({ headers: { Accept: 'text/event-stream' } }),
      )
    })

    it('should NOT call fetch when socket is present', () => {
      renderHook(() =>
        useAgentStatus({ connection: createMockConnection() }),
      )

      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('should abort fetch on unmount', () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort')

      const { unmount } = renderHook(() =>
        useAgentStatus({ connection: createSSEConnection() }),
      )

      unmount()

      expect(abortSpy).toHaveBeenCalled()
      abortSpy.mockRestore()
    })
  })
})
