import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'
import type { Message, FileInfo } from '../../types'

describe('MessageBubble', () => {
  const createMessage = (overrides: Partial<Message> = {}): Message => ({
    id: 'msg-1',
    role: 'assistant',
    content: 'Hello, world!',
    timestamp: new Date(),
    ...overrides,
  })

  it('renders message content', () => {
    const message = createMessage({ content: 'Test message content' })
    render(<MessageBubble message={message} onDownload={() => {}} />)
    expect(screen.getByText('Test message content')).toBeInTheDocument()
  })

  it('renders single file', () => {
    const file: FileInfo = {
      id: 'file-1',
      name: 'document.md',
      size: 1024,
      type: 'text/markdown',
    }
    const message = createMessage({ files: [file] })
    render(<MessageBubble message={message} onDownload={() => {}} />)

    expect(screen.getByText('document.md')).toBeInTheDocument()
  })

  it('renders multiple files', () => {
    const files: FileInfo[] = [
      { id: 'file-1', name: 'readme.md', size: 512, type: 'text/markdown' },
      { id: 'file-2', name: 'config.json', size: 256, type: 'application/json' },
      { id: 'file-3', name: 'script.ts', size: 1024, type: 'text/typescript' },
    ]
    const message = createMessage({ files })
    render(<MessageBubble message={message} onDownload={() => {}} />)

    expect(screen.getByText('readme.md')).toBeInTheDocument()
    expect(screen.getByText('config.json')).toBeInTheDocument()
    expect(screen.getByText('script.ts')).toBeInTheDocument()
  })

  it('renders no files when files array is empty', () => {
    const message = createMessage({ files: [] })
    render(<MessageBubble message={message} onDownload={() => {}} />)

    // Should render message but no file cards
    expect(screen.getByText('Hello, world!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument()
  })

  it('renders no files when files is undefined', () => {
    const message = createMessage({ files: undefined })
    render(<MessageBubble message={message} onDownload={() => {}} />)

    expect(screen.getByText('Hello, world!')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument()
  })

  it('calls onDownload with correct file when download button clicked', () => {
    const files: FileInfo[] = [
      { id: 'file-1', name: 'first.md', size: 100, type: 'text/markdown' },
      { id: 'file-2', name: 'second.json', size: 200, type: 'application/json' },
    ]
    const handleDownload = vi.fn()
    const message = createMessage({ files })
    render(<MessageBubble message={message} onDownload={handleDownload} />)

    // Click the first download button
    const downloadButtons = screen.getAllByRole('button', { name: /download/i })
    const firstButton = downloadButtons[0]
    if (firstButton) {
      firstButton.click()
    }

    expect(handleDownload).toHaveBeenCalledWith(files[0])
  })

  it('shows skill indicator when skill is present', () => {
    const message = createMessage({
      role: 'assistant',
      skill: 'hello-world',
    })
    render(<MessageBubble message={message} onDownload={() => {}} />)

    expect(screen.getByText(/Using:/)).toBeInTheDocument()
    expect(screen.getByText(/Hello World/)).toBeInTheDocument()
  })

  it('shows streaming indicator when status is streaming', () => {
    const message = createMessage({
      status: 'streaming',
      content: 'Typing...',
    })
    render(<MessageBubble message={message} onDownload={() => {}} />)

    expect(screen.getByText('|')).toBeInTheDocument()
  })
})
