/**
 * useRealSession Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealSession } from '../useRealSession'

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
}

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock window.open for downloads
const mockWindowOpen = vi.fn()
global.window.open = mockWindowOpen

describe('useRealSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    mockSocket.disconnect.mockClear()
    mockFetch.mockClear()
    mockWindowOpen.mockClear()

    // Default successful fetch response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with empty skills and disconnected state', () => {
    const { result } = renderHook(() => useRealSession())

    expect(result.current.skills).toEqual([])
    expect(result.current.connected).toBe(false)
    expect(result.current.loading).toBe(true)
  })

  it('initializes session state correctly', () => {
    const { result } = renderHook(() => useRealSession())

    expect(result.current.session.messages).toEqual([])
    expect(result.current.session.isProcessing).toBe(false)
    expect(result.current.session.activeSkill).toBe(null)
    expect(result.current.session.needsRestart).toBe(false)
    expect(result.current.session.sessionId).toMatch(/^session-\d+$/)
  })

  it('registers socket event handlers on mount', () => {
    renderHook(() => useRealSession())

    const registeredEvents = mockSocket.on.mock.calls.map(call => call[0])
    expect(registeredEvents).toContain('connect')
    expect(registeredEvents).toContain('disconnect')
    expect(registeredEvents).toContain('connect_error')
    expect(registeredEvents).toContain('agent_status')
    expect(registeredEvents).toContain('text_delta')
    expect(registeredEvents).toContain('tool_activity')
    expect(registeredEvents).toContain('skill_updated')
  })

  it('disconnects socket on unmount', () => {
    const { unmount } = renderHook(() => useRealSession())

    unmount()

    expect(mockSocket.disconnect).toHaveBeenCalled()
  })

  // Connection handling
  describe('connection handling', () => {
    it('sets connected to true on connect event', async () => {
      const { result } = renderHook(() => useRealSession())

      // Find the connect handler and call it
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]

      await act(async () => {
        connectHandler?.()
      })

      expect(result.current.connected).toBe(true)
    })

    it('sets connected to false on disconnect event', async () => {
      const { result } = renderHook(() => useRealSession())

      // First connect
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      await act(async () => {
        connectHandler?.()
      })

      // Then disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1]
      await act(async () => {
        disconnectHandler?.()
      })

      expect(result.current.connected).toBe(false)
    })

    it('sets error on connect_error event', async () => {
      const { result } = renderHook(() => useRealSession())

      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )?.[1]

      await act(async () => {
        errorHandler?.({ message: 'Connection failed' })
      })

      expect(result.current.error).toContain('Connection failed')
    })
  })

  // Fetch skills
  describe('fetchSkills', () => {
    it('fetches skills on connect', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          items: [
            {
              id: 'skill-1',
              name: 'Test Skill',
              slug: 'test-skill',
              description: 'A test skill',
              content: '# Test',
              type: 'skill',
              status: 'published',
              config: { icon: '⚡' },
              triggers: [{ type: 'keyword', value: 'test' }],
            },
          ],
        }),
      })

      const { result } = renderHook(() => useRealSession())

      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]

      await act(async () => {
        connectHandler?.()
      })

      await waitFor(() => {
        expect(result.current.skills).toHaveLength(1)
        expect(result.current.skills[0].name).toBe('Test Skill')
        expect(result.current.skills[0].enabled).toBe(true) // published = enabled
      })
    })

    it('sets error on fetch failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useRealSession())

      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]

      await act(async () => {
        connectHandler?.()
      })

      await waitFor(() => {
        expect(result.current.error).toContain('获取 skills 失败')
      })
    })
  })

  // Toggle skill
  describe('toggleSkill', () => {
    it('calls publish endpoint when enabling a skill', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: 'skill-1',
                name: 'Test',
                slug: 'test',
                description: '',
                content: '',
                type: 'skill',
                status: 'draft',
                config: {},
                triggers: [],
              },
            ],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      const { result } = renderHook(() => useRealSession())

      // Connect and fetch skills
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      await act(async () => {
        connectHandler?.()
      })

      await waitFor(() => {
        expect(result.current.skills).toHaveLength(1)
      })

      // Toggle skill (enable it)
      await act(async () => {
        await result.current.toggleSkill('skill-1')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/skills/skill-1/publish'),
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('calls unpublish endpoint when disabling a skill', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            items: [
              {
                id: 'skill-1',
                name: 'Test',
                slug: 'test',
                description: '',
                content: '',
                type: 'skill',
                status: 'published',
                config: {},
                triggers: [],
              },
            ],
          }),
        })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })

      const { result } = renderHook(() => useRealSession())

      // Connect and fetch skills
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      await act(async () => {
        connectHandler?.()
      })

      await waitFor(() => {
        expect(result.current.skills).toHaveLength(1)
        expect(result.current.skills[0].enabled).toBe(true)
      })

      // Toggle skill (disable it)
      await act(async () => {
        await result.current.toggleSkill('skill-1')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/skills/skill-1/unpublish'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  // Send message
  describe('sendMessage', () => {
    it('does not send when disconnected', async () => {
      const { result } = renderHook(() => useRealSession())

      await act(async () => {
        result.current.sendMessage('Hello')
      })

      expect(mockSocket.emit).not.toHaveBeenCalledWith('chat', expect.anything())
      expect(result.current.error).toContain('未连接')
    })

    it('emits chat event when connected', async () => {
      const { result } = renderHook(() => useRealSession())

      // Connect
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      await act(async () => {
        connectHandler?.()
      })

      // Send message
      await act(async () => {
        result.current.sendMessage('Hello')
      })

      expect(mockSocket.emit).toHaveBeenCalledWith('chat', expect.objectContaining({
        message: 'Hello',
        resumeSession: false,
      }))
    })

    it('adds user message to session', async () => {
      const { result } = renderHook(() => useRealSession())

      // Connect
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      await act(async () => {
        connectHandler?.()
      })

      // Send message
      await act(async () => {
        result.current.sendMessage('Hello')
      })

      expect(result.current.session.messages).toHaveLength(2) // user + placeholder assistant
      expect(result.current.session.messages[0].role).toBe('user')
      expect(result.current.session.messages[0].content).toBe('Hello')
    })

    it('sets isProcessing to true', async () => {
      const { result } = renderHook(() => useRealSession())

      // Connect
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      await act(async () => {
        connectHandler?.()
      })

      // Send message
      await act(async () => {
        result.current.sendMessage('Hello')
      })

      expect(result.current.session.isProcessing).toBe(true)
    })
  })

  // Restart session
  describe('restartSession', () => {
    it('generates new session ID', async () => {
      // Use fake timers to control Date.now()
      vi.useFakeTimers()

      const { result } = renderHook(() => useRealSession())

      const oldSessionId = result.current.session.sessionId

      // Advance time so Date.now() returns a different value
      vi.advanceTimersByTime(100)

      await act(async () => {
        result.current.restartSession()
      })

      expect(result.current.session.sessionId).not.toBe(oldSessionId)

      vi.useRealTimers()
    })

    it('clears messages', async () => {
      const { result } = renderHook(() => useRealSession())

      // Connect
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1]
      await act(async () => {
        connectHandler?.()
      })

      // Send a message
      await act(async () => {
        result.current.sendMessage('Hello')
      })

      expect(result.current.session.messages.length).toBeGreaterThan(0)

      // Restart
      await act(async () => {
        result.current.restartSession()
      })

      expect(result.current.session.messages).toEqual([])
    })

    it('clears needsRestart flag', async () => {
      const { result } = renderHook(() => useRealSession())

      // Manually set needsRestart (in reality this happens via skill toggle)
      await act(async () => {
        result.current.restartSession()
      })

      expect(result.current.session.needsRestart).toBe(false)
    })
  })

  // Download file
  describe('downloadFile', () => {
    it('opens download URL when file has ID', async () => {
      const { result } = renderHook(() => useRealSession())

      await act(async () => {
        result.current.downloadFile({
          id: 'file-123',
          name: 'test.pdf',
          size: 1024,
          type: 'application/pdf',
        })
      })

      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/files/file-123/download'),
        '_blank'
      )
    })
  })

  // CRUD operations
  describe('createSkill', () => {
    it('posts new skill and refreshes list', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [] }) })

      const { result } = renderHook(() => useRealSession())

      await act(async () => {
        await result.current.createSkill({
          name: 'New Skill',
          slug: 'new-skill',
          description: 'A new skill',
          content: '# New',
          type: 'skill',
          triggers: [],
          config: {},
        })
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/skills'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('New Skill'),
        })
      )
    })
  })

  describe('deleteSkill', () => {
    it('deletes skill and refreshes list', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ items: [] }) })

      const { result } = renderHook(() => useRealSession())

      await act(async () => {
        await result.current.deleteSkill('skill-1')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/skills/skill-1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })
})
