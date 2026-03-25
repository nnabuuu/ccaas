import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

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

describe('useAgentConnection - startNewConversation', () => {
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

  it('should expose startNewConversation in the return value', () => {
    const { result } = renderHook(() =>
      useAgentConnection({ tenantId: 'tenant-1' }),
    )

    expect(result.current).toHaveProperty('startNewConversation')
    expect(typeof result.current.startNewConversation).toBe('function')
  })

  it('should generate a new sessionId with conv_ prefix', () => {
    const { result } = renderHook(() =>
      useAgentConnection({ tenantId: 'tenant-1' }),
    )

    const oldSessionId = result.current.sessionId

    act(() => {
      result.current.startNewConversation()
    })

    expect(result.current.sessionId).not.toBe(oldSessionId)
    expect(result.current.sessionId).toMatch(/^conv_/)
  })

  it('should clear old sessionId from localStorage', () => {
    mockLocalStorage['ccaas_session_tenant-1'] = 'conv_old-session'

    const { result } = renderHook(() =>
      useAgentConnection({ tenantId: 'tenant-1' }),
    )

    act(() => {
      result.current.startNewConversation()
    })

    // Should have removed the old key and set a new one
    expect(localStorage.removeItem).toHaveBeenCalledWith('ccaas_session_tenant-1')
  })

  it('should save the new sessionId to localStorage', () => {
    const { result } = renderHook(() =>
      useAgentConnection({ tenantId: 'tenant-1' }),
    )

    act(() => {
      result.current.startNewConversation()
    })

    // The latest setItem call should save the new session
    const setItemCalls = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = setItemCalls[setItemCalls.length - 1]
    expect(lastCall[0]).toBe('ccaas_session_tenant-1')
    expect(lastCall[1]).toBe(result.current.sessionId)
  })

  it('should disconnect the existing socket (socket transport)', () => {
    const { result } = renderHook(() =>
      useAgentConnection({ tenantId: 'tenant-1', transport: 'socket' }),
    )

    act(() => {
      result.current.startNewConversation()
    })

    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('should reconnect with a new socket (socket transport)', () => {
    const { result } = renderHook(() =>
      useAgentConnection({ tenantId: 'tenant-1', transport: 'socket' }),
    )

    // Initial connect call
    const initialCallCount = mockIo.mock.calls.length

    act(() => {
      result.current.startNewConversation()
    })

    // Should have called io() again
    expect(mockIo.mock.calls.length).toBeGreaterThan(initialCallCount)
  })

  it('should work without tenantId (no localStorage interaction)', () => {
    const { result } = renderHook(() =>
      useAgentConnection({ sessionPrefix: 'test' }),
    )

    const oldSessionId = result.current.sessionId

    act(() => {
      result.current.startNewConversation()
    })

    // Should generate new ID but not interact with localStorage for removal
    expect(result.current.sessionId).not.toBe(oldSessionId)
  })

  it('should not crash if localStorage operations fail', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('Storage error')
    })

    const { result } = renderHook(() =>
      useAgentConnection({ tenantId: 'tenant-1' }),
    )

    expect(() => {
      act(() => {
        result.current.startNewConversation()
      })
    }).not.toThrow()
  })
})
