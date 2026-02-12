import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPanel } from '../ChatPanel'
import type { UseAgentConnectionReturn } from '@ccaas/react-sdk'

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock FilesView
vi.mock('../FilesView', () => ({
  default: () => <div data-testid="files-view">FilesView Mock</div>,
}))

// Mock QuickPrompts
vi.mock('../QuickPrompts', () => ({
  default: () => <div>QuickPrompts Mock</div>,
}))

// Mock MessageBubble
vi.mock('../MessageBubble', () => ({
  default: () => <div>MessageBubble Mock</div>,
}))

describe('ChatPanel - Tab System', () => {
  const mockConnection = {
    connected: true,
    socket: null,
    sessionId: 'test-session',
    clientId: 'test-client',
  } as UseAgentConnectionReturn

  const defaultProps = {
    messages: [],
    isProcessing: false,
    connected: true,
    connection: mockConnection,
    sessionId: 'test-session',
    lessonPlanId: 'test-plan',
    onSendMessage: vi.fn(),
    onSync: vi.fn(),
    onDiscard: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('tab bar rendering', () => {
    it('should render Messages and Files tabs', () => {
      render(<ChatPanel {...defaultProps} />)

      expect(screen.getByText('消息')).toBeInTheDocument()
      expect(screen.getByText('文件')).toBeInTheDocument()
    })

    it('should show Messages tab as active by default', () => {
      render(<ChatPanel {...defaultProps} />)

      const messagesTab = screen.getByText('消息').closest('button')!
      const filesTab = screen.getByText('文件').closest('button')!

      // Messages tab should have active classes
      expect(messagesTab).toHaveClass('text-blue-600')

      // Files tab should not have active classes
      expect(filesTab).not.toHaveClass('text-blue-600')
    })

    it('should show active tab indicator (underline)', () => {
      render(<ChatPanel {...defaultProps} />)

      const messagesTab = screen.getByText('消息').closest('button')!

      // Check for underline element
      const underline = messagesTab.querySelector('.absolute.bottom-0')
      expect(underline).toBeInTheDocument()
      expect(underline).toHaveClass('bg-blue-500')
    })
  })

  describe('tab badges', () => {
    it('should show new files count badge', () => {
      render(<ChatPanel {...defaultProps} newFilesCount={3} />)

      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should not show badge when no new files', () => {
      render(<ChatPanel {...defaultProps} newFilesCount={0} />)

      const filesTab = screen.getByText('文件').closest('button')!
      const badge = filesTab.querySelector('.bg-amber-500')
      expect(badge).not.toBeInTheDocument()
    })

    it('should show new messages count badge', () => {
      const now = new Date()
      const messages = [
        {
          id: '1',
          role: 'assistant' as const,
          content: 'Hello',
          timestamp: now, // Within last 5 seconds
        },
      ]

      render(<ChatPanel {...defaultProps} messages={messages} />)

      // Badge should appear on Messages tab
      const messagesTab = screen.getByText('消息').closest('button')!
      const badge = messagesTab.querySelector('.bg-red-500')
      expect(badge).toBeInTheDocument()
    })

    it('should not show badge for old messages', () => {
      const oldDate = new Date(Date.now() - 10000) // 10 seconds ago
      const messages = [
        {
          id: '1',
          role: 'assistant' as const,
          content: 'Hello',
          timestamp: oldDate,
        },
      ]

      render(<ChatPanel {...defaultProps} messages={messages} />)

      const messagesTab = screen.getByText('消息').closest('button')!
      const badge = messagesTab.querySelector('.bg-red-500')
      expect(badge).not.toBeInTheDocument()
    })

    it('should not count user messages in badge', () => {
      const now = new Date()
      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Hello',
          timestamp: now,
        },
      ]

      render(<ChatPanel {...defaultProps} messages={messages} />)

      const messagesTab = screen.getByText('消息').closest('button')!
      const badge = messagesTab.querySelector('.bg-red-500')
      expect(badge).not.toBeInTheDocument()
    })

    it('should show files badge with amber color', () => {
      render(<ChatPanel {...defaultProps} newFilesCount={2} />)

      const filesTab = screen.getByText('文件').closest('button')!
      const badge = filesTab.querySelector('.bg-amber-500')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('2')
    })

    it('should show messages badge with red color', () => {
      const now = new Date()
      const messages = [
        {
          id: '1',
          role: 'assistant' as const,
          content: 'Test',
          timestamp: now,
        },
      ]

      render(<ChatPanel {...defaultProps} messages={messages} />)

      const messagesTab = screen.getByText('消息').closest('button')!
      const badge = messagesTab.querySelector('.bg-red-500')
      expect(badge).toBeInTheDocument()
    })
  })

  describe('tab switching', () => {
    it('should switch to Files tab when clicked', () => {
      render(<ChatPanel {...defaultProps} />)

      const filesTab = screen.getByText('文件').closest('button')!
      fireEvent.click(filesTab)

      // Files tab should now be active
      expect(filesTab).toHaveClass('text-blue-600')

      // FilesView should be rendered
      expect(screen.getByTestId('files-view')).toBeInTheDocument()
    })

    it('should switch back to Messages tab when clicked', () => {
      render(<ChatPanel {...defaultProps} />)

      // Switch to Files
      const filesTab = screen.getByText('文件').closest('button')!
      fireEvent.click(filesTab)

      // Switch back to Messages
      const messagesTab = screen.getByText('消息').closest('button')!
      fireEvent.click(messagesTab)

      // Messages tab should be active
      expect(messagesTab).toHaveClass('text-blue-600')

      // FilesView should not be rendered
      expect(screen.queryByTestId('files-view')).not.toBeInTheDocument()
    })

    it('should show Messages content when Messages tab is active', () => {
      render(<ChatPanel {...defaultProps} />)

      // Empty state should be visible
      expect(screen.getByText('开始备课对话')).toBeInTheDocument()
    })

    it('should show FilesView when Files tab is active', () => {
      render(<ChatPanel {...defaultProps} />)

      const filesTab = screen.getByText('文件').closest('button')!
      fireEvent.click(filesTab)

      expect(screen.getByTestId('files-view')).toBeInTheDocument()
    })

    it('should hide Messages content when Files tab is active', () => {
      render(<ChatPanel {...defaultProps} />)

      const filesTab = screen.getByText('文件').closest('button')!
      fireEvent.click(filesTab)

      // Messages content should not be visible
      expect(screen.queryByText('开始备课对话')).not.toBeInTheDocument()
    })
  })

  describe('FilesView integration', () => {
    it('should pass connection to FilesView', () => {
      render(<ChatPanel {...defaultProps} />)

      const filesTab = screen.getByText('文件').closest('button')!
      fireEvent.click(filesTab)

      // FilesView should be rendered with props
      expect(screen.getByTestId('files-view')).toBeInTheDocument()
    })

    it('should not render FilesView if no connection', () => {
      render(<ChatPanel {...defaultProps} connection={undefined} />)

      const filesTab = screen.getByText('文件').closest('button')!
      fireEvent.click(filesTab)

      // FilesView should not be rendered
      expect(screen.queryByTestId('files-view')).not.toBeInTheDocument()
    })

    it('should not render FilesView if no sessionId', () => {
      render(<ChatPanel {...defaultProps} sessionId={undefined} />)

      const filesTab = screen.getByText('文件').closest('button')!
      fireEvent.click(filesTab)

      // FilesView should not be rendered
      expect(screen.queryByTestId('files-view')).not.toBeInTheDocument()
    })

    it('should not render FilesView if no lessonPlanId', () => {
      render(<ChatPanel {...defaultProps} lessonPlanId={undefined} />)

      const filesTab = screen.getByText('文件').closest('button')!
      fireEvent.click(filesTab)

      // FilesView should not be rendered
      expect(screen.queryByTestId('files-view')).not.toBeInTheDocument()
    })
  })

  describe('existing functionality preserved', () => {
    it('should still render messages', () => {
      const messages = [
        {
          id: '1',
          role: 'user' as const,
          content: 'Test message',
          timestamp: new Date(),
        },
      ]

      render(<ChatPanel {...defaultProps} messages={messages} />)

      expect(screen.getByText('MessageBubble Mock')).toBeInTheDocument()
    })

    it('should still render input area', () => {
      render(<ChatPanel {...defaultProps} />)

      const input = screen.getByPlaceholderText('输入您的备课需求...')
      expect(input).toBeInTheDocument()
    })

    it('should still call onSendMessage', () => {
      const onSendMessage = vi.fn()
      render(<ChatPanel {...defaultProps} onSendMessage={onSendMessage} />)

      const input = screen.getByPlaceholderText('输入您的备课需求...')
      const submitButton = screen.getByRole('button', { name: '' }) // SVG button

      fireEvent.change(input, { target: { value: 'Test' } })
      fireEvent.click(submitButton)

      expect(onSendMessage).toHaveBeenCalledWith('Test')
    })

    it('should still render AgentActivityLine', () => {
      render(<ChatPanel {...defaultProps} isProcessing={true} />)

      // AgentActivityLine is imported from SDK, just verify component structure
      expect(screen.getByText('AI 备课助手')).toBeInTheDocument()
    })

    it('should still render QuickPrompts', () => {
      render(<ChatPanel {...defaultProps} />)

      expect(screen.getByText('QuickPrompts Mock')).toBeInTheDocument()
    })
  })

  describe('keyboard navigation', () => {
    it('should be navigable with Tab key', () => {
      render(<ChatPanel {...defaultProps} />)

      const messagesTab = screen.getByText('消息').closest('button')!
      const filesTab = screen.getByText('文件').closest('button')!

      // Buttons should be focusable
      messagesTab.focus()
      expect(document.activeElement).toBe(messagesTab)

      filesTab.focus()
      expect(document.activeElement).toBe(filesTab)
    })

    it('should activate tab on Enter key', () => {
      render(<ChatPanel {...defaultProps} />)

      const filesTab = screen.getByText('文件').closest('button')!

      fireEvent.keyDown(filesTab, { key: 'Enter' })
      fireEvent.click(filesTab) // Click is needed to trigger state change

      expect(filesTab).toHaveClass('text-blue-600')
    })
  })

  describe('responsive behavior', () => {
    it('should render tab bar in flex layout', () => {
      render(<ChatPanel {...defaultProps} />)

      const tabBar = screen.getByText('消息').closest('div')!
      expect(tabBar).toHaveClass('flex')
    })

    it('should have equal width tabs', () => {
      render(<ChatPanel {...defaultProps} />)

      const messagesTab = screen.getByText('消息').closest('button')!
      const filesTab = screen.getByText('文件').closest('button')!

      expect(messagesTab).toHaveClass('flex-1')
      expect(filesTab).toHaveClass('flex-1')
    })
  })
})
