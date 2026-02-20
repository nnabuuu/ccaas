import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLessonPlanSession } from '../useLessonPlanSession'
import type { UseAgentConnectionReturn, UseAgentChatReturn, UseAgentStatusReturn } from '@ccaas/react-sdk'

// Mock @ccaas/react-sdk
let mockConnectionReturn: UseAgentConnectionReturn
let mockChatReturn: UseAgentChatReturn
let mockStatusReturn: UseAgentStatusReturn

vi.mock('@ccaas/react-sdk', async () => {
  const actual = await vi.importActual('@ccaas/react-sdk')
  return {
    ...actual,
    useAgentConnection: vi.fn(() => mockConnectionReturn),
    useAgentChat: vi.fn(() => mockChatReturn),
    useAgentStatus: vi.fn(() => mockStatusReturn),
  }
})

// Mock other dependencies
vi.mock('../useLessonPlanSync', () => ({
  useLessonPlanSync: () => ({
    pendingUpdates: new Map(),
    modifiedFields: new Set(),
    addPendingUpdate: vi.fn(),
    removePendingUpdate: vi.fn(),
    syncToForm: vi.fn(),
    undoSync: vi.fn(),
    canUndo: vi.fn(),
    resetSyncState: vi.fn(),
  }),
}))

// useSubAgentPolling removed - subAgent tracking now handled by SDK's useAgentStatus via WebSocket

vi.mock('../../utils/api', () => ({
  api: {
    getSolutionConfig: vi.fn().mockResolvedValue({
      mcpServers: [],
      skillPath: '/skills',
    }),
  },
}))

describe('useLessonPlanSession - Status (Phase 4)', () => {
  let mockSocket: any

  beforeEach(() => {
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: true,
    }

    mockConnectionReturn = {
      socket: mockSocket,
      sessionId: 'lpd_test-session-id',
      clientId: 'test-client-id',
      connected: true,
      error: null,
      serverUrl: '',
      connect: vi.fn(),
      disconnect: vi.fn(),
      startNewConversation: vi.fn(),
      sessionReady: false,
      markSessionReady: vi.fn(),
    }

    mockChatReturn = {
      messages: [],
      isProcessing: false,
      isLoadingHistory: false,
      currentStreamContent: '',
      sendMessage: vi.fn(),
      cancelProcessing: vi.fn(),
      clearMessages: vi.fn(),
      clearConversation: vi.fn(),
    }

    mockStatusReturn = {
      agentStatus: 'idle',
      isProcessing: false,
      activeTools: new Map(),
      isThinking: false,
      thinkingContent: '',
      thinkingStartTime: null,
      thinkingVerb: '思考',
      tokenUsage: null,
      todoItems: [],
      todoStats: { completed: 0, inProgress: 0, pending: 0, total: 0 },
      activeSubAgents: [],
      currentActivity: '',
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should expose activeTools from SDK status', () => {
    const mockTools = new Map([['tool1', {
      toolId: 'tool1',
      toolName: 'test_tool',
      phase: 'start' as const,
      timestamp: new Date(),
    }]])
    mockStatusReturn.activeTools = mockTools

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.activeTools).toBe(mockTools)
  })

  it('should expose isThinking from SDK status', () => {
    mockStatusReturn.isThinking = true
    mockStatusReturn.thinkingContent = 'Thinking about the problem...'

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.isThinking).toBe(true)
    expect(result.current.thinkingContent).toBe('Thinking about the problem...')
  })

  it('should expose tokenUsage from SDK status', () => {
    const mockTokenUsage = {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    }
    mockStatusReturn.tokenUsage = mockTokenUsage

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.tokenUsage).toBe(mockTokenUsage)
  })

  it('should expose todoItems from SDK status', () => {
    const mockTodos = [
      { id: '1', content: 'Task 1', status: 'pending' as const },
      { id: '2', content: 'Task 2', status: 'completed' as const },
    ]
    mockStatusReturn.todoItems = mockTodos

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.todoItems).toBe(mockTodos)
  })

  it('should expose todoStats from SDK status', () => {
    const mockStats = {
      total: 5,
      completed: 2,
      pending: 2,
      inProgress: 1,
    }
    mockStatusReturn.todoStats = mockStats

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.todoStats).toBe(mockStats)
  })

  it('should expose activeSubAgents from SDK status', () => {
    const mockSubAgents = [
      {
        subAgentId: 'sub1',
        agentType: 'Explore',
        status: 'running' as const,
        startedAt: new Date().toISOString(),
      },
    ]
    mockStatusReturn.activeSubAgents = mockSubAgents

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.activeSubAgents).toBe(mockSubAgents)
  })

  it('should compute hasActiveSubAgents correctly', () => {
    mockStatusReturn.activeSubAgents = [
      {
        subAgentId: 'sub1',
        agentType: 'Explore',
        status: 'running' as const,
        startedAt: new Date().toISOString(),
      },
    ]

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.hasActiveSubAgents).toBe(true)
  })

  it('should compute isMainProcessing correctly when processing without subagents', () => {
    mockChatReturn.isProcessing = true
    mockStatusReturn.activeSubAgents = []

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.isMainProcessing).toBe(true)
  })

  it('should compute isMainProcessing correctly when processing with subagents', () => {
    mockChatReturn.isProcessing = true
    mockStatusReturn.activeSubAgents = [
      {
        subAgentId: 'sub1',
        agentType: 'Explore',
        status: 'running' as const,
        startedAt: new Date().toISOString(),
      },
    ]

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.isMainProcessing).toBe(false)
  })
})
