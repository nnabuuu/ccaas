import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock socket.io-client
const { mockSocket, mockIo } = vi.hoisted(() => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  }
  const mockIo = vi.fn(() => mockSocket)
  return { mockSocket, mockIo }
})

vi.mock('socket.io-client', () => ({
  io: mockIo,
}))

import { useAgentConnection } from '../src/hooks/useAgentConnection'

describe('useAgentConnection - solution-scoped session storage', () => {
  let mockLocalStorage: Record<string, string>

  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.on.mockReset()
    mockSocket.emit.mockReset()
    mockSocket.disconnect.mockReset()
    mockIo.mockClear()
    mockIo.mockReturnValue(mockSocket)

    // Mock localStorage
    mockLocalStorage = {}
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
      (key: string) => mockLocalStorage[key] ?? null,
    )
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
      (key: string, value: string) => {
        mockLocalStorage[key] = value
      },
    )
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(
      (key: string) => {
        delete mockLocalStorage[key]
      },
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('conversationId format', () => {
    it('should generate conversationId with conv_ prefix when solutionId is provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-1' }),
      )

      expect(result.current.sessionId).toMatch(/^conv_/)
    })

    it('should generate conversationId with conv_ prefix matching UUID format', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-1' }),
      )

      // conv_ followed by a UUID-like string
      expect(result.current.sessionId).toMatch(
        /^conv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    })

    it('should use sessionPrefix format when solutionId is not provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ sessionPrefix: 'lpd' }),
      )

      expect(result.current.sessionId).toMatch(/^lpd_/)
    })
  })

  describe('localStorage persistence', () => {
    it('should save sessionId to localStorage with solution-scoped key', () => {
      renderHook(() =>
        useAgentConnection({ solutionId: 'solution-abc' }),
      )

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'ccaas_session_solution-abc',
        expect.stringMatching(/^conv_/),
      )
    })

    it('should recover sessionId from localStorage on mount', () => {
      const savedId = 'conv_12345678-1234-1234-1234-123456789012'
      mockLocalStorage['ccaas_session_solution-abc'] = savedId

      const { result } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-abc' }),
      )

      expect(result.current.sessionId).toBe(savedId)
    })

    it('should generate new sessionId when nothing saved in localStorage', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-new' }),
      )

      expect(result.current.sessionId).toMatch(/^conv_/)
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    it('should not use localStorage when solutionId is not provided', () => {
      renderHook(() =>
        useAgentConnection({ sessionPrefix: 'test' }),
      )

      expect(localStorage.getItem).not.toHaveBeenCalled()
      expect(localStorage.setItem).not.toHaveBeenCalled()
    })
  })

  describe('solution isolation', () => {
    it('should use different storage keys for different solutions', () => {
      const savedIdA = 'conv_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      const savedIdB = 'conv_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      mockLocalStorage['ccaas_session_solution-a'] = savedIdA
      mockLocalStorage['ccaas_session_solution-b'] = savedIdB

      const { result: resultA } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-a' }),
      )
      const { result: resultB } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-b' }),
      )

      expect(resultA.current.sessionId).toBe(savedIdA)
      expect(resultB.current.sessionId).toBe(savedIdB)
    })

    it('should not cross-contaminate sessions between solutions', () => {
      mockLocalStorage['ccaas_session_solution-x'] = 'conv_xxxx-session'

      const { result } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-y' }),
      )

      // Should not get solution-x's session
      expect(result.current.sessionId).not.toBe('conv_xxxx-session')
      expect(result.current.sessionId).toMatch(/^conv_/)
    })
  })

  describe('forceNewConversation', () => {
    it('should clear localStorage and generate new sessionId when forceNewConversation is true', () => {
      const savedId = 'conv_old-session-id'
      mockLocalStorage['ccaas_session_solution-1'] = savedId

      const { result } = renderHook(() =>
        useAgentConnection({
          solutionId: 'solution-1',
          forceNewConversation: true,
        }),
      )

      expect(result.current.sessionId).not.toBe(savedId)
      expect(result.current.sessionId).toMatch(/^conv_/)
      expect(localStorage.removeItem).toHaveBeenCalledWith(
        'ccaas_session_solution-1',
      )
    })

    it('should save the new sessionId to localStorage after forcing', () => {
      mockLocalStorage['ccaas_session_solution-1'] = 'conv_old'

      const { result } = renderHook(() =>
        useAgentConnection({
          solutionId: 'solution-1',
          forceNewConversation: true,
        }),
      )

      // Should save the newly generated id
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'ccaas_session_solution-1',
        result.current.sessionId,
      )
    })
  })

  describe('graceful error handling', () => {
    it('should generate new sessionId if localStorage.getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage disabled')
      })

      const { result } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-1' }),
      )

      expect(result.current.sessionId).toMatch(/^conv_/)
    })

    it('should not crash if localStorage.setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage full')
      })

      expect(() => {
        renderHook(() =>
          useAgentConnection({ solutionId: 'solution-1' }),
        )
      }).not.toThrow()
    })

    it('should not crash if localStorage.removeItem throws', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('localStorage error')
      })

      expect(() => {
        renderHook(() =>
          useAgentConnection({
            solutionId: 'solution-1',
            forceNewConversation: true,
          }),
        )
      }).not.toThrow()
    })
  })

  describe('backward compatibility', () => {
    it('should still work with sessionPrefix when solutionId is not provided', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ sessionPrefix: 'lpd' }),
      )

      expect(result.current.sessionId).toMatch(/^lpd_/)
      // Default transport is 'sse', which is always connected
      expect(result.current.connected).toBe(true)
    })

    it('should still auto-connect by default with socket transport', () => {
      renderHook(() =>
        useAgentConnection({ solutionId: 'solution-1', transport: 'socket' }),
      )

      expect(mockIo).toHaveBeenCalledWith('/', {
        transports: ['websocket', 'polling'],
      })
    })

    it('should return all existing fields in the return value', () => {
      const { result } = renderHook(() =>
        useAgentConnection({ solutionId: 'solution-1' }),
      )

      expect(result.current).toHaveProperty('socket')
      expect(result.current).toHaveProperty('connected')
      expect(result.current).toHaveProperty('clientId')
      expect(result.current).toHaveProperty('sessionId')
      expect(result.current).toHaveProperty('serverUrl')
      expect(result.current).toHaveProperty('error')
      expect(result.current).toHaveProperty('connect')
      expect(result.current).toHaveProperty('disconnect')
    })
  })
})
