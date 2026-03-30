import React, { createRef } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ScrollToBottom } from '../ScrollToBottom'

// Mock lucide-react
vi.mock('lucide-react', () => ({
  ChevronDown: (props: Record<string, unknown>) => <svg data-testid="chevron-down" {...props} />,
}))

describe('ScrollToBottom', () => {
  function createMockScrollRef(overrides: Partial<HTMLElement> = {}) {
    const el = document.createElement('div')
    Object.defineProperty(el, 'scrollHeight', { value: overrides.scrollHeight ?? 1000, configurable: true })
    Object.defineProperty(el, 'scrollTop', { value: overrides.scrollTop ?? 0, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: overrides.clientHeight ?? 500, configurable: true })
    const ref = createRef<HTMLDivElement>()
    Object.defineProperty(ref, 'current', { value: el, writable: true })
    return ref
  }

  it('is hidden when near bottom', () => {
    const ref = createMockScrollRef({ scrollHeight: 500, scrollTop: 400, clientHeight: 500 })
    const { container } = render(<ScrollToBottom scrollRef={ref} />)
    expect(container.querySelector('button')).toBeNull()
  })

  it('becomes visible when scroll fires and far from bottom', () => {
    const ref = createMockScrollRef({ scrollHeight: 2000, scrollTop: 0, clientHeight: 500 })
    render(<ScrollToBottom scrollRef={ref} />)
    // Trigger scroll event
    fireEvent.scroll(ref.current!)
    expect(screen.getByLabelText('Scroll to bottom')).toBeTruthy()
  })

  it('calls scrollTo on click', () => {
    const ref = createMockScrollRef({ scrollHeight: 2000, scrollTop: 0, clientHeight: 500 })
    ref.current!.scrollTo = vi.fn()
    render(<ScrollToBottom scrollRef={ref} />)
    fireEvent.scroll(ref.current!)
    fireEvent.click(screen.getByLabelText('Scroll to bottom'))
    expect(ref.current!.scrollTo).toHaveBeenCalledWith({ top: 2000, behavior: 'smooth' })
  })
})
