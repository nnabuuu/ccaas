/**
 * ChatPanel Component Tests
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatPanel } from '../ChatPanel'
import type { Message, FileInfo } from '../../types'

// Mock scrollIntoView which doesn't exist in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const mockMessages: Message[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Hello, create a report',
    timestamp: new Date('2024-01-01T10:00:00'),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Here is your report.',
    timestamp: new Date('2024-01-01T10:00:01'),
    status: 'complete',
  },
]

describe('ChatPanel', () => {
  const mockOnSend = vi.fn()
  const mockOnDownload = vi.fn()

  beforeEach(() => {
    mockOnSend.mockClear()
    mockOnDownload.mockClear()
  })

  it('renders empty state when no messages', () => {
    render(
      <ChatPanel
        messages={[]}
        activeSkill={null}
        isProcessing={false}
        onSend={mockOnSend}
        onDownload={mockOnDownload}
      />
    )
    expect(screen.getByText('Start a Conversation')).toBeInTheDocument()
    expect(screen.getByText(/Enable skills in the sidebar/)).toBeInTheDocument()
  })

  it('renders messages when provided', () => {
    render(
      <ChatPanel
        messages={mockMessages}
        activeSkill={null}
        isProcessing={false}
        onSend={mockOnSend}
        onDownload={mockOnDownload}
      />
    )
    expect(screen.getByText('Hello, create a report')).toBeInTheDocument()
    expect(screen.getByText('Here is your report.')).toBeInTheDocument()
  })

  it('shows active skill banner when skill is active', () => {
    render(
      <ChatPanel
        messages={mockMessages}
        activeSkill="report"
        isProcessing={false}
        onSend={mockOnSend}
        onDownload={mockOnDownload}
      />
    )
    expect(screen.getByText('Using: Report Generator')).toBeInTheDocument()
  })

  it('does not show active skill banner when no skill is active', () => {
    render(
      <ChatPanel
        messages={mockMessages}
        activeSkill={null}
        isProcessing={false}
        onSend={mockOnSend}
        onDownload={mockOnDownload}
      />
    )
    expect(screen.queryByText(/Using:/)).not.toBeInTheDocument()
  })

  // Input handling
  describe('input handling', () => {
    it('allows typing in input field', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const input = screen.getByPlaceholderText('Type a message...')
      fireEvent.change(input, { target: { value: 'Test message' } })
      expect(input).toHaveValue('Test message')
    })

    it('calls onSend when form is submitted', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const input = screen.getByPlaceholderText('Type a message...')
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.submit(input.closest('form')!)
      expect(mockOnSend).toHaveBeenCalledWith('Test message')
    })

    it('clears input after sending', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const input = screen.getByPlaceholderText('Type a message...')
      fireEvent.change(input, { target: { value: 'Test message' } })
      fireEvent.submit(input.closest('form')!)
      expect(input).toHaveValue('')
    })

    it('does not send empty messages', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const input = screen.getByPlaceholderText('Type a message...')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.submit(input.closest('form')!)
      expect(mockOnSend).not.toHaveBeenCalled()
    })

    it('trims whitespace from message', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const input = screen.getByPlaceholderText('Type a message...')
      fireEvent.change(input, { target: { value: '  Test message  ' } })
      fireEvent.submit(input.closest('form')!)
      expect(mockOnSend).toHaveBeenCalledWith('Test message')
    })
  })

  // Processing state
  describe('processing state', () => {
    it('disables input when processing', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={true}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const input = screen.getByPlaceholderText('Waiting for response...')
      expect(input).toBeDisabled()
    })

    it('disables send button when processing', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={true}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const sendButton = screen.getByText('Send')
      expect(sendButton).toBeDisabled()
    })

    it('does not send message when processing', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={true}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const input = screen.getByPlaceholderText('Waiting for response...')
      fireEvent.change(input, { target: { value: 'Test' } })
      fireEvent.submit(input.closest('form')!)
      expect(mockOnSend).not.toHaveBeenCalled()
    })
  })

  // Send button state
  describe('send button', () => {
    it('disables send button when input is empty', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const sendButton = screen.getByText('Send')
      expect(sendButton).toBeDisabled()
    })

    it('enables send button when input has content', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill={null}
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      const input = screen.getByPlaceholderText('Type a message...')
      fireEvent.change(input, { target: { value: 'Test' } })
      const sendButton = screen.getByText('Send')
      expect(sendButton).not.toBeDisabled()
    })
  })

  // Skill name mapping
  describe('skill name mapping', () => {
    it('displays correct name for hello-world skill', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill="hello-world"
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText('Using: Hello World')).toBeInTheDocument()
    })

    it('displays correct name for document skill', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill="document"
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText('Using: Document Writer')).toBeInTheDocument()
    })

    it('displays correct name for analysis skill', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill="analysis"
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText('Using: Data Analyzer')).toBeInTheDocument()
    })

    it('displays raw skill name for unknown skills', () => {
      render(
        <ChatPanel
          messages={[]}
          activeSkill="custom-skill"
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )
      expect(screen.getByText('Using: custom-skill')).toBeInTheDocument()
    })
  })

  // Download handling
  describe('download handling', () => {
    it('passes onDownload to MessageBubble', () => {
      const messageWithFile: Message = {
        id: 'msg-3',
        role: 'assistant',
        content: 'Here is your file',
        timestamp: new Date(),
        status: 'complete',
        files: [{ name: 'test.pdf', size: 1024, type: 'application/pdf' }],
      }

      render(
        <ChatPanel
          messages={[messageWithFile]}
          activeSkill={null}
          isProcessing={false}
          onSend={mockOnSend}
          onDownload={mockOnDownload}
        />
      )

      // File card should be rendered
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })
  })
})
