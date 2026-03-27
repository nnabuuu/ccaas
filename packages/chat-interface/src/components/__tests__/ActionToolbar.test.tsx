import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionToolbar } from '../ActionToolbar'
import type { ContentBlock } from '@/types/chat'

vi.mock('lucide-react', () => ({
  Copy: (props: Record<string, unknown>) => <span data-testid="icon-copy" {...props} />,
  Check: (props: Record<string, unknown>) => <span data-testid="icon-check" {...props} />,
  RotateCcw: (props: Record<string, unknown>) => <span data-testid="icon-retry" {...props} />,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils/relative-time', () => ({
  formatRelativeTime: vi.fn(() => '5 分钟前'),
}))

vi.mock('../Tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const textContent: ContentBlock[] = [
  { type: 'text', content: 'Hello world' },
  { type: 'text', content: 'Second block' },
]

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ActionToolbar', () => {
  it('renders copy button with aria-label "复制"', () => {
    render(<ActionToolbar timestamp="2024-01-01T00:00:00Z" content={textContent} />)
    expect(screen.getByLabelText('复制')).toBeTruthy()
  })

  it('renders timestamp via formatRelativeTime', () => {
    render(<ActionToolbar timestamp="2024-01-01T00:00:00Z" content={textContent} />)
    screen.getByText('5 分钟前')
  })

  it('does NOT render retry button when onRetry is undefined', () => {
    render(<ActionToolbar timestamp="2024-01-01T00:00:00Z" content={textContent} />)
    expect(screen.queryByLabelText('重试')).toBeNull()
  })

  it('renders retry button with aria-label "重试" when onRetry is provided', () => {
    render(<ActionToolbar timestamp="2024-01-01T00:00:00Z" content={textContent} onRetry={() => {}} />)
    expect(screen.getByLabelText('重试')).toBeTruthy()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<ActionToolbar timestamp="2024-01-01T00:00:00Z" content={textContent} onRetry={onRetry} />)
    await user.click(screen.getByLabelText('重试'))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('calls navigator.clipboard.writeText with extracted text on copy click', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })

    render(<ActionToolbar timestamp="2024-01-01T00:00:00Z" content={textContent} />)
    // Wrap in act to capture the full async handleCopy chain
    await act(async () => {
      await user.click(screen.getByLabelText('复制'))
    })
    expect(writeText).toHaveBeenCalledWith('Hello world\nSecond block')
    expect(screen.getByLabelText('已复制')).toBeTruthy()
  })
})
