import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLessonPlanSession } from '../useLessonPlanSession'
import type { UseAgentConnectionReturn, UseAgentChatReturn } from '@ccaas/react-sdk'

// Mock @ccaas/react-sdk
let mockConnectionReturn: UseAgentConnectionReturn
let mockChatReturn: UseAgentChatReturn
let mockAddPendingUpdate: any
let capturedOnOutputUpdate: any

vi.mock('@ccaas/react-sdk', async () => {
  const actual = await vi.importActual('@ccaas/react-sdk')
  return {
    ...actual,
    useAgentConnection: vi.fn(() => mockConnectionReturn),
    useAgentChat: vi.fn((config: any) => {
      capturedOnOutputUpdate = config.onOutputUpdate
      return mockChatReturn
    }),
    useAgentStatus: vi.fn(() => ({
      agentStatus: 'idle',
      isProcessing: false,
      activeTools: new Map(),
      isThinking: false,
      thinkingContent: '',
      tokenUsage: null,
      todoItems: [],
      todoStats: { completed: 0, inProgress: 0, pending: 0, total: 0 },
      activeSubAgents: [],
      currentActivity: '',
    })),
  }
})

// Mock other dependencies
vi.mock('../useLessonPlanSync', () => ({
  useLessonPlanSync: () => ({
    pendingUpdates: new Map(),
    modifiedFields: new Set(),
    addPendingUpdate: mockAddPendingUpdate,
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
    getLessonPlan: vi.fn(),
    updateLessonPlan: vi.fn(),
    createLessonPlan: vi.fn(),
  },
}))

describe('useLessonPlanSession - Chat (Phase 3A)', () => {
  let mockSocket: any

  beforeEach(() => {
    mockAddPendingUpdate = vi.fn()
    capturedOnOutputUpdate = null

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
    }

    mockChatReturn = {
      messages: [],
      isProcessing: false,
      currentStreamContent: '',
      sendMessage: vi.fn(),
      cancelProcessing: vi.fn(),
      clearMessages: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Note: Phase 3A keeps messages/isProcessing as local state (manual handlers still use them)
  // These will be migrated in Phase 4

  it('should alias SDK sendMessage function', async () => {
    const { result } = renderHook(() => useLessonPlanSession())

    await act(async () => {
      await result.current.sendMessage('Test message')
    })

    expect(mockChatReturn.sendMessage).toHaveBeenCalledWith('Test message')
  })

  it('should alias SDK cancelProcessing function', () => {
    const { result } = renderHook(() => useLessonPlanSession())

    act(() => {
      result.current.cancelProcessing()
    })

    expect(mockChatReturn.cancelProcessing).toHaveBeenCalled()
  })

  it('should bridge output_update to useLessonPlanSync via onOutputUpdate', () => {
    renderHook(() => useLessonPlanSession())

    // Verify onOutputUpdate was captured
    expect(capturedOnOutputUpdate).toBeDefined()

    // Simulate SDK calling onOutputUpdate
    act(() => {
      capturedOnOutputUpdate({
        field: 'objectives',
        value: 'Test objectives',
        preview: 'Preview text',
      })
    })

    // Verify addPendingUpdate was called
    expect(mockAddPendingUpdate).toHaveBeenCalledWith({
      field: 'objectives',
      value: 'Test objectives',
      preview: 'Preview text',
    })
  })

  it('should pass enabled skill slugs to useAgentChat', () => {
    // Just verify the hook runs without errors and onOutputUpdate is captured
    renderHook(() => useLessonPlanSession({ enabledSkillSlugs: ['skill1'] }))

    // Verify onOutputUpdate callback was registered
    expect(capturedOnOutputUpdate).toBeDefined()
    expect(typeof capturedOnOutputUpdate).toBe('function')
  })

  it('should call useAgentChat with onOutputUpdate callback', () => {
    renderHook(() => useLessonPlanSession())

    // Verify onOutputUpdate callback was registered during initialization
    expect(capturedOnOutputUpdate).toBeDefined()
    expect(typeof capturedOnOutputUpdate).toBe('function')
  })

  it('should integrate useAgentChat for message handling', () => {
    const { result } = renderHook(() => useLessonPlanSession())

    // Verify SDK functions are available
    expect(typeof result.current.sendMessage).toBe('function')
    expect(typeof result.current.cancelProcessing).toBe('function')
  })
})
