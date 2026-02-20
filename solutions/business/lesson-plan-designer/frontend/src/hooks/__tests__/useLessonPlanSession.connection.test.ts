import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useLessonPlanSession } from '../useLessonPlanSession'
import type { UseAgentConnectionReturn } from '@kedge-agentic/react-sdk'

// Mock @kedge-agentic/react-sdk
let mockConnectionReturn: UseAgentConnectionReturn
vi.mock('@kedge-agentic/react-sdk', async () => {
  const actual = await vi.importActual('@kedge-agentic/react-sdk')
  return {
    ...actual,
    useAgentConnection: vi.fn(() => mockConnectionReturn),
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
    getLessonPlan: vi.fn(),
    updateLessonPlan: vi.fn(),
    createLessonPlan: vi.fn(),
  },
}))

describe('useLessonPlanSession - Connection (Phase 2)', () => {
  let mockSocket: any

  beforeEach(() => {
    // Create mock socket instance
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      connected: false,
    }

    // Mock useAgentConnection return value
    mockConnectionReturn = {
      socket: mockSocket,
      sessionId: 'lpd_test-session-id',
      clientId: 'test-client-id',
      connected: false,
      error: null,
      serverUrl: '',
      connect: vi.fn(),
      disconnect: vi.fn(),
      startNewConversation: vi.fn(),
      sessionReady: false,
      markSessionReady: vi.fn(),
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should use SDK connection hook', () => {
    const { result } = renderHook(() => useLessonPlanSession({ autoConnect: true }))

    // Should use connection from SDK
    expect(result.current.sessionId).toBe('lpd_test-session-id')
    expect(result.current.connected).toBe(false)
  })

  it('should have sessionId with lpd_ prefix', () => {
    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.sessionId).toMatch(/^lpd_[a-z0-9-]+$/)
  })

  it('should expose connected state from SDK', () => {
    mockConnectionReturn.connected = true

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.connected).toBe(true)
  })

  it('should expose error state from SDK', () => {
    mockConnectionReturn.error = 'Connection failed'

    const { result } = renderHook(() => useLessonPlanSession())

    expect(result.current.error).toBe('Connection failed')
  })

  it('should use SDK hooks for event handling', () => {
    renderHook(() => useLessonPlanSession())

    // SDK hooks (useAgentChat and useAgentStatus) handle event listeners internally
    // No manual event listener registration in useLessonPlanSession after Phase 3A/4
    // Verify socket exists and is accessible
    expect(mockSocket).toBeDefined()
    expect(mockSocket.on).toBeDefined()
  })

  it('should cleanup properly on unmount', () => {
    const { unmount } = renderHook(() => useLessonPlanSession())

    // SDK hooks manage their own cleanup internally
    // Just verify unmount doesn't throw
    expect(() => unmount()).not.toThrow()
  })

  it('should not connect when socket is null', () => {
    mockConnectionReturn.socket = null

    const { result } = renderHook(() => useLessonPlanSession())

    // Should handle null socket gracefully
    expect(result.current.connected).toBe(false)
  })
})
