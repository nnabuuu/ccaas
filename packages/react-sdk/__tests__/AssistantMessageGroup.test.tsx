import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AssistantMessageGroup } from '../src/components/AssistantMessageGroup'
import type { SplitMessage, OutputUpdate, TokenUsage } from '../src/types'

describe('AssistantMessageGroup', () => {
  const baseSplitMessage: SplitMessage = {
    messageId: 'msg-1',
    role: 'assistant',
    segments: [
      {
        id: 'msg-1-seg-0',
        type: 'text',
        blocks: [{ type: 'text', text: 'Hello, this is a test message.' }],
      },
    ],
    original: {} as any,
  }

  describe('Basic Layout', () => {
    it('should render avatar once', () => {
      const { container } = render(<AssistantMessageGroup splitMessage={baseSplitMessage} />)
      const avatars = container.querySelectorAll('.rounded-full')
      expect(avatars.length).toBe(1)
    })

    it('should render all segments', () => {
      const splitMessage: SplitMessage = {
        ...baseSplitMessage,
        segments: [
          {
            id: 'msg-1-seg-0',
            type: 'text',
            blocks: [{ type: 'text', text: 'First segment' }],
          },
          {
            id: 'msg-1-seg-1',
            type: 'text',
            blocks: [{ type: 'text', text: 'Second segment' }],
          },
        ],
      }
      render(<AssistantMessageGroup splitMessage={splitMessage} />)
      expect(screen.getByText('First segment')).toBeInTheDocument()
      expect(screen.getByText('Second segment')).toBeInTheDocument()
    })

    it('should render timestamp when provided', () => {
      const timestamp = new Date('2026-02-15T10:30:00')
      render(<AssistantMessageGroup splitMessage={baseSplitMessage} timestamp={timestamp} />)
      expect(screen.getByText('10:30')).toBeInTheDocument()
    })
  })

  describe('SyncButton Rendering (Message Round Binding)', () => {
    const outputUpdates: OutputUpdate[] = [
      { field: '标题', value: '圆的面积', preview: '圆的面积', synced: false },
      { field: '学习目标', value: '理解圆的面积公式', preview: '理解圆的面积公式', synced: false },
    ]

    it('should render SyncButtons when outputUpdates provided', () => {
      render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          outputUpdates={outputUpdates}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      expect(screen.getByText('标题')).toBeInTheDocument()
      expect(screen.getByText('学习目标')).toBeInTheDocument()
    })

    it('should not render SyncButtons when outputUpdates empty', () => {
      render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          outputUpdates={[]}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      expect(screen.queryByText('同步')).not.toBeInTheDocument()
    })

    it('should not render SyncButtons when outputUpdates not provided', () => {
      render(<AssistantMessageGroup splitMessage={baseSplitMessage} />)
      expect(screen.queryByText('同步')).not.toBeInTheDocument()
    })

    it('should call onSync with correct field when sync clicked', () => {
      const onSync = vi.fn()
      render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          outputUpdates={outputUpdates}
          onSync={onSync}
          onDiscard={vi.fn()}
        />
      )
      const syncButtons = screen.getAllByText('同步')
      fireEvent.click(syncButtons[0])
      expect(onSync).toHaveBeenCalledWith('标题')
    })

    it('should call onDiscard with correct field when discard clicked', () => {
      const onDiscard = vi.fn()
      render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          outputUpdates={outputUpdates}
          onSync={vi.fn()}
          onDiscard={onDiscard}
        />
      )
      const discardButtons = screen.getAllByText('忽略')
      fireEvent.click(discardButtons[0])
      expect(onDiscard).toHaveBeenCalledWith('标题')
    })

    it('should use custom renderSyncButton when provided', () => {
      const renderSyncButton = vi.fn((update) => (
        <div key={update.field}>Custom Sync: {update.field}</div>
      ))
      render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          outputUpdates={outputUpdates}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
          renderSyncButton={renderSyncButton}
        />
      )
      expect(screen.getByText('Custom Sync: 标题')).toBeInTheDocument()
      expect(screen.getByText('Custom Sync: 学习目标')).toBeInTheDocument()
      expect(renderSyncButton).toHaveBeenCalledTimes(2)
    })

    it('should use DefaultSyncButton when renderSyncButton not provided', () => {
      render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          outputUpdates={outputUpdates}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      // DefaultSyncButton renders "同步" and "忽略" buttons
      expect(screen.getAllByText('同步').length).toBe(2)
      expect(screen.getAllByText('忽略').length).toBe(2)
    })
  })

  describe('TokenUsage Rendering', () => {
    const tokenUsage: TokenUsage = {
      inputTokens: 1500,
      outputTokens: 800,
      cacheReadTokens: 500,
    }

    it('should render token usage when provided', () => {
      render(<AssistantMessageGroup splitMessage={baseSplitMessage} tokenUsage={tokenUsage} />)
      expect(screen.getByText(/1.5k/)).toBeInTheDocument() // input
      expect(screen.getByText(/800/)).toBeInTheDocument() // output
      expect(screen.getByText(/500 cached/)).toBeInTheDocument()
    })

    it('should not render token usage when not provided', () => {
      const { container } = render(<AssistantMessageGroup splitMessage={baseSplitMessage} />)
      expect(container.querySelector('.border-t')).not.toBeInTheDocument()
    })

    it('should use custom renderTokenUsage when provided', () => {
      const renderTokenUsage = vi.fn(() => <div>Custom Token Display</div>)
      render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          tokenUsage={tokenUsage}
          renderTokenUsage={renderTokenUsage}
        />
      )
      expect(screen.getByText('Custom Token Display')).toBeInTheDocument()
      expect(renderTokenUsage).toHaveBeenCalledWith(tokenUsage)
    })

    it('should format large token counts', () => {
      const largeUsage: TokenUsage = {
        inputTokens: 1_500_000,
        outputTokens: 2_000,
      }
      render(<AssistantMessageGroup splitMessage={baseSplitMessage} tokenUsage={largeUsage} />)
      expect(screen.getByText(/1.5M/)).toBeInTheDocument()
      expect(screen.getByText(/2.0k/)).toBeInTheDocument()
    })
  })

  describe('Custom Segment Rendering', () => {
    it('should use custom renderSegment when provided', () => {
      const renderSegment = vi.fn((segment) => (
        <div key={segment.id}>Custom Segment: {segment.type}</div>
      ))
      render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          renderSegment={renderSegment}
        />
      )
      expect(screen.getByText('Custom Segment: text')).toBeInTheDocument()
      expect(renderSegment).toHaveBeenCalledTimes(1)
    })

    it('should use default renderer when renderSegment not provided', () => {
      render(<AssistantMessageGroup splitMessage={baseSplitMessage} />)
      expect(screen.getByText('Hello, this is a test message.')).toBeInTheDocument()
    })
  })

  describe('Layout Order', () => {
    const tokenUsage: TokenUsage = { inputTokens: 100, outputTokens: 50 }
    const outputUpdates: OutputUpdate[] = [
      { field: '标题', value: '圆的面积', preview: '圆的面积', synced: false },
    ]
    const timestamp = new Date('2026-02-15T10:30:00')

    it('should render in correct order: segments → outputUpdates → tokenUsage → timestamp', () => {
      const { container } = render(
        <AssistantMessageGroup
          splitMessage={baseSplitMessage}
          outputUpdates={outputUpdates}
          tokenUsage={tokenUsage}
          timestamp={timestamp}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )

      const elements = Array.from(container.querySelectorAll('.flex-1 > *'))
      const textContent = elements.map((el) => el.textContent)

      // Segments first
      expect(textContent[0]).toContain('Hello, this is a test message')
      // OutputUpdates (SyncButtons) second
      expect(textContent[1]).toContain('标题')
      // TokenUsage third
      expect(textContent[2]).toContain('100')
      // Timestamp last
      expect(textContent[3]).toContain('10:30')
    })
  })

  describe('Default Segment Renderer', () => {
    it('should render text segments with bubble background', () => {
      const { container } = render(<AssistantMessageGroup splitMessage={baseSplitMessage} />)
      const textBubble = container.querySelector('.bg-gray-100')
      expect(textBubble).toBeInTheDocument()
      expect(textBubble?.textContent).toContain('Hello, this is a test message')
    })

    it('should render tool segments indented without bubble', () => {
      const splitMessage: SplitMessage = {
        ...baseSplitMessage,
        segments: [
          {
            id: 'msg-1-seg-0',
            type: 'tool',
            blocks: [
              {
                type: 'tool',
                tool: {
                  toolName: 'Read',
                  toolId: 'tool-1',
                  phase: 'end',
                  timestamp: new Date(),
                },
              },
            ],
          },
        ],
      }
      const { container } = render(<AssistantMessageGroup splitMessage={splitMessage} />)
      const toolSection = container.querySelector('.ml-4')
      expect(toolSection).toBeInTheDocument()
      expect(toolSection?.textContent).toContain('[Tool: Read]')
    })
  })
})
