import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Use vi.hoisted so the mock is available at vi.mock time
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

describe('useAgentConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.on.mockReset()
    mockSocket.emit.mockReset()
    mockSocket.disconnect.mockReset()
    mockIo.mockClear()
    mockIo.mockReturnValue(mockSocket)
  })

  it('should auto-connect on mount', () => {
    renderHook(() => useAgentConnection({ sessionPrefix: 'test' }))

    expect(mockIo).toHaveBeenCalledWith('/', {
      transports: ['websocket', 'polling'],
    })
  })

  it('should not connect when autoConnect is false', () => {
    renderHook(() => useAgentConnection({ autoConnect: false }))

    expect(mockIo).not.toHaveBeenCalled()
  })

  it('should have sessionId with prefix', () => {
    const { result } = renderHook(() =>
      useAgentConnection({ sessionPrefix: 'lpd' }),
    )

    expect(result.current.sessionId).toMatch(/^lpd_/)
  })

  it('should register connect/disconnect/client_id handlers', () => {
    renderHook(() => useAgentConnection())

    const eventNames = mockSocket.on.mock.calls.map((call: unknown[]) => call[0])
    expect(eventNames).toContain('connect')
    expect(eventNames).toContain('disconnect')
    expect(eventNames).toContain('client_id')
    expect(eventNames).toContain('connect_error')
  })

  it('should update connected state on connect event', () => {
    const { result } = renderHook(() => useAgentConnection())

    const connectCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect')
    expect(connectCall).toBeDefined()

    act(() => {
      connectCall![1]()
    })

    expect(result.current.connected).toBe(true)
  })

  it('should update clientId on client_id event', () => {
    const { result } = renderHook(() => useAgentConnection())

    const clientIdCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'client_id')
    expect(clientIdCall).toBeDefined()

    act(() => {
      clientIdCall![1]({ clientId: 'test-client-123' })
    })

    expect(result.current.clientId).toBe('test-client-123')
  })

  it('should set error on connect_error', () => {
    const { result } = renderHook(() => useAgentConnection())

    const errorCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect_error')

    act(() => {
      errorCall![1](new Error('Connection refused'))
    })

    expect(result.current.error).toBe('Connection error: Connection refused')
    expect(result.current.connected).toBe(false)
  })

  it('should disconnect on unmount', () => {
    const { unmount } = renderHook(() => useAgentConnection())

    unmount()

    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  it('should join session on connect', () => {
    const { result } = renderHook(() => useAgentConnection({ sessionPrefix: 'pe' }))

    const connectCall = mockSocket.on.mock.calls.find((call: unknown[]) => call[0] === 'connect')

    act(() => {
      connectCall![1]()
    })

    expect(mockSocket.emit).toHaveBeenCalledWith('session:join', {
      sessionId: result.current.sessionId,
    })
  })
})
