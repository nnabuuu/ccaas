import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { ChatCoreProvider, useChatCore } from '../ChatCoreContext'

// Mock react-sdk hooks
const mockSendMessage = vi.fn()
const mockCancelProcessing = vi.fn()

// Stable references to prevent infinite re-render loops
// (useEffect depends on messages array identity)
const EMPTY_MESSAGES: never[] = []

vi.mock('@kedge-agentic/react-sdk', () => ({
  useAgentConnection: () => ({
    sessionReady: true,
  }),
  useAgentChat: () => ({
    sendMessage: mockSendMessage,
    isProcessing: false,
    messages: EMPTY_MESSAGES,
    isLoadingHistory: false,
    currentStreamContent: null,
    cancelProcessing: mockCancelProcessing,
  }),
  useAgentStatus: () => ({
    isThinking: false,
    thinkingVerb: '',
  }),
}))

const baseProps = {
  serverUrl: 'http://localhost:3001',
  tenantId: 'test-tenant',
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ChatCoreProvider {...baseProps}>{children}</ChatCoreProvider>
}

beforeEach(() => {
  mockSendMessage.mockReset()
  mockCancelProcessing.mockReset()
})

describe('ChatCoreContext', () => {
  it('throws when used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => {
      renderHook(() => useChatCore())
    }).toThrow('useChatCore must be used within a ChatCoreProvider')
    spy.mockRestore()
  })

  it('provides default values', () => {
    const { result } = renderHook(() => useChatCore(), { wrapper: Wrapper })

    expect(result.current.sessionReady).toBe(true)
    expect(result.current.messages).toEqual([])
    expect(result.current.isProcessing).toBe(false)
    expect(result.current.isThinking).toBe(false)
    expect(result.current.input).toBe('')
    expect(result.current.skillPanelOpen).toBe(false)
    expect(result.current.serverUrl).toBe('http://localhost:3001')
    expect(result.current.tenantId).toBe('test-tenant')
    expect(result.current.quickSuggestions).toEqual([])
  })

  it('setInput updates input value', () => {
    const { result } = renderHook(() => useChatCore(), { wrapper: Wrapper })

    act(() => {
      result.current.setInput('hello')
    })

    expect(result.current.input).toBe('hello')
  })

  it('setSkillPanelOpen toggles skill panel', () => {
    const { result } = renderHook(() => useChatCore(), { wrapper: Wrapper })

    act(() => {
      result.current.setSkillPanelOpen(true)
    })
    expect(result.current.skillPanelOpen).toBe(true)

    act(() => {
      result.current.setSkillPanelOpen((prev: boolean) => !prev)
    })
    expect(result.current.skillPanelOpen).toBe(false)
  })

  it('handleSend calls sendMessage and clears input', async () => {
    mockSendMessage.mockResolvedValue(undefined)
    const { result } = renderHook(() => useChatCore(), { wrapper: Wrapper })

    act(() => {
      result.current.setInput('test message')
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(mockSendMessage).toHaveBeenCalledWith('test message')
    expect(result.current.input).toBe('')
  })

  it('handleSend does nothing for empty input', async () => {
    const { result } = renderHook(() => useChatCore(), { wrapper: Wrapper })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('handleSend restores input on error', async () => {
    mockSendMessage.mockRejectedValue(new Error('fail'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => useChatCore(), { wrapper: Wrapper })

    act(() => {
      result.current.setInput('test message')
    })

    await act(async () => {
      await result.current.handleSend()
    })

    expect(result.current.input).toBe('test message')
    spy.mockRestore()
  })

  it('handleWidgetStateChange updates widget state', () => {
    const { result } = renderHook(() => useChatCore(), { wrapper: Wrapper })

    act(() => {
      result.current.handleWidgetStateChange('msg-1', 'field', 'value')
    })

    expect(result.current.widgetStates['msg-1']).toEqual({ field: 'value' })
  })

  it('handleSuggestionSelect sets input to suggestion prompt', () => {
    const { result } = renderHook(() => useChatCore(), { wrapper: Wrapper })

    act(() => {
      result.current.handleSuggestionSelect({
        label: 'Test',
        prompt: 'test prompt',
        category: 'general',
        score: 10,
      })
    })

    expect(result.current.input).toBe('test prompt')
  })

  it('passes through quickSuggestions prop', () => {
    const suggestions = [
      { label: 'Q1', prompt: 'p1', category: 'c', score: 1 },
    ]
    const W = ({ children }: { children: React.ReactNode }) => (
      <ChatCoreProvider {...baseProps} quickSuggestions={suggestions}>
        {children}
      </ChatCoreProvider>
    )

    const { result } = renderHook(() => useChatCore(), { wrapper: W })
    expect(result.current.quickSuggestions).toBe(suggestions)
  })

  it('passes through apiKey prop', () => {
    const W = ({ children }: { children: React.ReactNode }) => (
      <ChatCoreProvider {...baseProps} apiKey="sk-test">
        {children}
      </ChatCoreProvider>
    )

    const { result } = renderHook(() => useChatCore(), { wrapper: W })
    expect(result.current.apiKey).toBe('sk-test')
  })
})
