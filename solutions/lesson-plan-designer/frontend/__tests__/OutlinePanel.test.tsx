import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import OutlinePanel from '../src/components/OutlinePanel'

const mockItems = [
  { id: 'basic', label: '1. 基本信息' },
  { id: 'objectives', label: '2. 教学目标' },
  { id: 'activities', label: '3. 教学活动' },
  { id: 'assessment', label: '4. 评估方式' },
  { id: 'differentiation', label: '5. 差异化教学' },
]

describe('OutlinePanel', () => {
  it('should render all outline items', () => {
    render(
      <OutlinePanel
        items={mockItems}
        activeSection="basic"
        onSelect={vi.fn()}
      />
    )

    mockItems.forEach(item => {
      expect(screen.getByText(item.label)).toBeInTheDocument()
    })
  })

  it('should highlight the active section', () => {
    render(
      <OutlinePanel
        items={mockItems}
        activeSection="objectives"
        onSelect={vi.fn()}
      />
    )

    const activeItem = screen.getByText('2. 教学目标').closest('button')
    expect(activeItem).toHaveClass('bg-primary-50')
  })

  it('should not highlight inactive sections', () => {
    render(
      <OutlinePanel
        items={mockItems}
        activeSection="basic"
        onSelect={vi.fn()}
      />
    )

    const inactiveItem = screen.getByText('2. 教学目标').closest('button')
    expect(inactiveItem).not.toHaveClass('bg-primary-50')
  })

  it('should call onSelect when item is clicked', () => {
    const onSelect = vi.fn()
    render(
      <OutlinePanel
        items={mockItems}
        activeSection="basic"
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByText('3. 教学活动'))
    expect(onSelect).toHaveBeenCalledWith('activities')
  })

  it('should render with correct structure', () => {
    const { container } = render(
      <OutlinePanel
        items={mockItems}
        activeSection="basic"
        onSelect={vi.fn()}
      />
    )

    // Check for sticky positioning class
    const panel = container.firstChild
    expect(panel).toHaveClass('sticky')
  })

  it('should render empty list when no items provided', () => {
    render(
      <OutlinePanel
        items={[]}
        activeSection=""
        onSelect={vi.fn()}
      />
    )

    // Should render container but no items
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should show title if provided', () => {
    render(
      <OutlinePanel
        items={mockItems}
        activeSection="basic"
        onSelect={vi.fn()}
        title="目录"
      />
    )

    expect(screen.getByText('目录')).toBeInTheDocument()
  })

  it('should handle keyboard navigation', () => {
    const onSelect = vi.fn()
    render(
      <OutlinePanel
        items={mockItems}
        activeSection="basic"
        onSelect={onSelect}
      />
    )

    const firstItem = screen.getByText('1. 基本信息')
    fireEvent.keyDown(firstItem, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith('basic')
  })
})
