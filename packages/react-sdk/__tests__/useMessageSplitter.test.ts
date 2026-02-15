import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMessageSplitter } from '../src/hooks/useMessageSplitter'
import type { Message, ContentBlock } from '../src/types'

describe('useMessageSplitter', () => {
  // ============================================================================
  // Basic Splitting Tests
  // ============================================================================

  it('should return empty array for empty messages', () => {
    const { result } = renderHook(() => useMessageSplitter({ messages: [] }))
    expect(result.current.splitMessages).toEqual([])
    expect(result.current.outputUpdates).toEqual([])
  })

  it('should not split user messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        contentBlocks: [{ type: 'text', text: 'Hello' }],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    expect(result.current.splitMessages).toHaveLength(1)
    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.messageId).toBe('msg-1')
    expect(splitMsg.role).toBe('user')
    expect(splitMsg.segments).toHaveLength(1)
    expect(splitMsg.segments[0].type).toBe('text')
    expect(splitMsg.segments[0].blocks).toEqual([{ type: 'text', text: 'Hello' }])
  })

  it('should not split pure text assistant messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Let me help you',
        contentBlocks: [
          { type: 'text', text: 'Let me ' },
          { type: 'text', text: 'help you' },
        ],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    expect(result.current.splitMessages).toHaveLength(1)
    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments).toHaveLength(1)
    expect(splitMsg.segments[0].type).toBe('text')
    expect(splitMsg.segments[0].blocks).toHaveLength(2) // Both text blocks merged
  })

  it('should split text + tool + text into 3 segments', () => {
    const toolActivity = {
      toolName: 'read',
      toolId: 'tool-1',
      phase: 'end' as const,
      timestamp: new Date(),
      success: true,
    }

    const messages: Message[] = [
      {
        id: 'msg-3',
        role: 'assistant',
        content: 'Let me read the file',
        contentBlocks: [
          { type: 'text', text: 'Let me read' },
          { type: 'tool', tool: toolActivity },
          { type: 'text', text: 'the file' },
        ],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments).toHaveLength(3)
    expect(splitMsg.segments[0].type).toBe('text')
    expect(splitMsg.segments[0].blocks).toHaveLength(1)
    expect(splitMsg.segments[1].type).toBe('tool')
    expect(splitMsg.segments[1].blocks).toHaveLength(1)
    expect(splitMsg.segments[2].type).toBe('text')
    expect(splitMsg.segments[2].blocks).toHaveLength(1)
  })

  it('should merge consecutive tool blocks into tool-group', () => {
    const tool1 = {
      toolName: 'read',
      toolId: 'tool-1',
      phase: 'end' as const,
      timestamp: new Date(),
    }
    const tool2 = {
      toolName: 'grep',
      toolId: 'tool-2',
      phase: 'end' as const,
      timestamp: new Date(),
    }
    const tool3 = {
      toolName: 'edit',
      toolId: 'tool-3',
      phase: 'end' as const,
      timestamp: new Date(),
    }

    const messages: Message[] = [
      {
        id: 'msg-4',
        role: 'assistant',
        content: 'Running tools',
        contentBlocks: [
          { type: 'text', text: 'Running' },
          { type: 'tool', tool: tool1 },
          { type: 'tool', tool: tool2 },
          { type: 'tool', tool: tool3 },
          { type: 'text', text: 'Done' },
        ],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments).toHaveLength(3)
    expect(splitMsg.segments[0].type).toBe('text')
    expect(splitMsg.segments[1].type).toBe('tool-group') // 3 tools merged
    expect(splitMsg.segments[1].blocks).toHaveLength(3)
    expect(splitMsg.segments[2].type).toBe('text')
  })

  it('should use "tool" for single tool block', () => {
    const tool = {
      toolName: 'read',
      toolId: 'tool-1',
      phase: 'end' as const,
      timestamp: new Date(),
    }

    const messages: Message[] = [
      {
        id: 'msg-5',
        role: 'assistant',
        content: 'Reading...',
        contentBlocks: [{ type: 'tool', tool }],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments).toHaveLength(1)
    expect(splitMsg.segments[0].type).toBe('tool') // Not 'tool-group'
  })

  // ============================================================================
  // Streaming Tests
  // ============================================================================

  it('should mark last segment as streaming', () => {
    const messages: Message[] = [
      {
        id: 'msg-6',
        role: 'assistant',
        content: 'Processing...',
        contentBlocks: [
          { type: 'text', text: 'Processing' },
          { type: 'tool', tool: { toolName: 'read', toolId: 't1', phase: 'start', timestamp: new Date() } },
        ],
        isStreaming: true,
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments[0].isStreaming).toBe(false) // Not last
    expect(splitMsg.segments[1].isStreaming).toBe(true)  // Last segment
  })

  it('should not mark segments as streaming when message is not streaming', () => {
    const messages: Message[] = [
      {
        id: 'msg-7',
        role: 'assistant',
        content: 'Done',
        contentBlocks: [
          { type: 'text', text: 'Done' },
        ],
        isStreaming: false,
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments[0].isStreaming).toBe(false)
  })

  // ============================================================================
  // Fallback Tests
  // ============================================================================

  it('should handle messages with no contentBlocks but has content', () => {
    const messages: Message[] = [
      {
        id: 'msg-8',
        role: 'assistant',
        content: 'Fallback text',
        // No contentBlocks
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments).toHaveLength(1)
    expect(splitMsg.segments[0].type).toBe('text')
    expect(splitMsg.segments[0].blocks).toEqual([
      { type: 'text', text: 'Fallback text' },
    ])
  })

  it('should handle messages with empty contentBlocks', () => {
    const messages: Message[] = [
      {
        id: 'msg-9',
        role: 'assistant',
        content: 'Empty blocks',
        contentBlocks: [],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments).toHaveLength(1)
    expect(splitMsg.segments[0].type).toBe('text')
    expect(splitMsg.segments[0].blocks).toEqual([
      { type: 'text', text: 'Empty blocks' },
    ])
  })

  // ============================================================================
  // OutputUpdates Aggregation Tests
  // ============================================================================

  it('should aggregate outputUpdates from all assistant messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-10',
        role: 'assistant',
        content: 'First',
        outputUpdates: [
          { field: 'title', value: 'Title 1', preview: 'Title 1', timestamp: 1000 },
        ],
      },
      {
        id: 'msg-11',
        role: 'assistant',
        content: 'Second',
        outputUpdates: [
          { field: 'objective', value: 'Obj 1', preview: 'Obj 1', timestamp: 2000 },
        ],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    expect(result.current.outputUpdates).toHaveLength(2)
    expect(result.current.outputUpdates.map(u => u.field)).toEqual(['title', 'objective'])
  })

  it('should deduplicate outputUpdates by field (keep latest by timestamp)', () => {
    const messages: Message[] = [
      {
        id: 'msg-12',
        role: 'assistant',
        content: 'First',
        outputUpdates: [
          { field: 'title', value: 'Old Title', preview: 'Old Title', timestamp: 1000 },
        ],
      },
      {
        id: 'msg-13',
        role: 'assistant',
        content: 'Second',
        outputUpdates: [
          { field: 'title', value: 'New Title', preview: 'New Title', timestamp: 2000 },
        ],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    expect(result.current.outputUpdates).toHaveLength(1)
    expect(result.current.outputUpdates[0].value).toBe('New Title')
    expect(result.current.outputUpdates[0].timestamp).toBe(2000)
  })

  it('should ignore outputUpdates from user messages', () => {
    const messages: Message[] = [
      {
        id: 'msg-14',
        role: 'user',
        content: 'User',
        outputUpdates: [
          { field: 'user-field', value: 'Should ignore', preview: 'Ignore' },
        ],
      },
      {
        id: 'msg-15',
        role: 'assistant',
        content: 'Assistant',
        outputUpdates: [
          { field: 'assistant-field', value: 'Keep this', preview: 'Keep' },
        ],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    expect(result.current.outputUpdates).toHaveLength(1)
    expect(result.current.outputUpdates[0].field).toBe('assistant-field')
  })

  // ============================================================================
  // Enabled/Disabled Tests
  // ============================================================================

  it('should not split when enabled=false', () => {
    const tool = {
      toolName: 'read',
      toolId: 'tool-1',
      phase: 'end' as const,
      timestamp: new Date(),
    }

    const messages: Message[] = [
      {
        id: 'msg-16',
        role: 'assistant',
        content: 'Text and tool',
        contentBlocks: [
          { type: 'text', text: 'Text' },
          { type: 'tool', tool },
          { type: 'text', text: 'More text' },
        ],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages, enabled: false }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments).toHaveLength(1) // All in one segment
    expect(splitMsg.segments[0].type).toBe('text')
    expect(splitMsg.segments[0].blocks).toHaveLength(3) // All blocks together
  })

  // ============================================================================
  // Performance Tests (useMemo caching)
  // ============================================================================

  it('should cache results when messages array does not change', () => {
    const messages: Message[] = [
      {
        id: 'msg-17',
        role: 'assistant',
        content: 'Cached',
        contentBlocks: [{ type: 'text', text: 'Cached' }],
      },
    ]

    const { result, rerender } = renderHook(
      ({ msgs }) => useMessageSplitter({ messages: msgs }),
      { initialProps: { msgs: messages } }
    )

    const firstResult = result.current.splitMessages

    // Rerender with same messages array
    rerender({ msgs: messages })

    // Should return same reference (useMemo cached)
    expect(result.current.splitMessages).toBe(firstResult)
  })

  it('should recompute when messages array changes', () => {
    const messages1: Message[] = [
      {
        id: 'msg-18',
        role: 'assistant',
        content: 'First',
        contentBlocks: [{ type: 'text', text: 'First' }],
      },
    ]

    const messages2: Message[] = [
      {
        id: 'msg-19',
        role: 'assistant',
        content: 'Second',
        contentBlocks: [{ type: 'text', text: 'Second' }],
      },
    ]

    const { result, rerender } = renderHook(
      ({ msgs }) => useMessageSplitter({ messages: msgs }),
      { initialProps: { msgs: messages1 } }
    )

    const firstResult = result.current.splitMessages

    // Rerender with different messages array
    rerender({ msgs: messages2 })

    // Should return new reference (recomputed)
    expect(result.current.splitMessages).not.toBe(firstResult)
    expect(result.current.splitMessages[0].original.content).toBe('Second')
  })

  // ============================================================================
  // Segment ID Tests
  // ============================================================================

  it('should generate stable segment IDs', () => {
    const messages: Message[] = [
      {
        id: 'msg-20',
        role: 'assistant',
        content: 'Multi-segment',
        contentBlocks: [
          { type: 'text', text: 'First' },
          { type: 'tool', tool: { toolName: 'read', toolId: 't1', phase: 'end', timestamp: new Date() } },
          { type: 'text', text: 'Second' },
        ],
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.segments[0].id).toBe('msg-20-seg-0')
    expect(splitMsg.segments[1].id).toBe('msg-20-seg-1')
    expect(splitMsg.segments[2].id).toBe('msg-20-seg-2')
  })

  // ============================================================================
  // Metadata Preservation Tests
  // ============================================================================

  it('should preserve tokenUsage and timestamp', () => {
    const timestamp = new Date('2026-02-15T10:00:00Z')
    const tokenUsage = { inputTokens: 100, outputTokens: 50 }

    const messages: Message[] = [
      {
        id: 'msg-21',
        role: 'assistant',
        content: 'With metadata',
        contentBlocks: [{ type: 'text', text: 'With metadata' }],
        tokenUsage,
        timestamp,
      },
    ]

    const { result } = renderHook(() => useMessageSplitter({ messages }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.tokenUsage).toEqual(tokenUsage)
    expect(splitMsg.timestamp).toBe(timestamp)
  })

  it('should preserve original message reference', () => {
    const originalMessage: Message = {
      id: 'msg-22',
      role: 'assistant',
      content: 'Original',
      contentBlocks: [{ type: 'text', text: 'Original' }],
    }

    const { result } = renderHook(() => useMessageSplitter({ messages: [originalMessage] }))

    const splitMsg = result.current.splitMessages[0]
    expect(splitMsg.original).toBe(originalMessage)
  })
})
