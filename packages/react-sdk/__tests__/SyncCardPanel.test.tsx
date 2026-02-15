import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SyncCardPanel } from '../src/components/SyncCardPanel'
import type { OutputUpdate } from '../src/types'

describe('SyncCardPanel', () => {
  // ============================================================================
  // Rendering Tests
  // ============================================================================

  it('should not render when outputUpdates is empty', () => {
    const { container } = render(
      <SyncCardPanel outputUpdates={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should not render when all updates are synced', () => {
    const updates: OutputUpdate[] = [
      { field: 'title', value: 'Title', preview: 'Title', synced: true },
      { field: 'objective', value: 'Obj', preview: 'Obj', synced: true },
    ]

    const { container } = render(
      <SyncCardPanel outputUpdates={updates} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render when there are pending updates', () => {
    const updates: OutputUpdate[] = [
      { field: 'title', value: 'Title', preview: 'Title' },
    ]

    render(<SyncCardPanel outputUpdates={updates} />)

    expect(screen.getByText('📥 待同步内容')).toBeDefined()
    expect(screen.getByText('(1 项)')).toBeDefined()
    expect(screen.getByText('title')).toBeDefined()
    expect(screen.getByText('Title')).toBeDefined()
  })

  it('should filter out synced updates', () => {
    const updates: OutputUpdate[] = [
      { field: 'title', value: 'Title', preview: 'Title', synced: false },
      { field: 'objective', value: 'Obj', preview: 'Obj', synced: true },
      { field: 'process', value: 'Proc', preview: 'Proc', synced: false },
    ]

    render(<SyncCardPanel outputUpdates={updates} />)

    expect(screen.getByText('(2 项)')).toBeDefined() // Only 2 pending
    expect(screen.getByText('title')).toBeDefined()
    expect(screen.getByText('process')).toBeDefined()
    expect(screen.queryByText('objective')).toBeNull()
  })

  // ============================================================================
  // Callback Tests
  // ============================================================================

  it('should call onSync when sync button clicked', () => {
    const onSync = vi.fn()
    const updates: OutputUpdate[] = [
      { field: 'title', value: 'Title', preview: 'Title' },
    ]

    render(<SyncCardPanel outputUpdates={updates} onSync={onSync} />)

    const syncButton = screen.getByText('同步')
    fireEvent.click(syncButton)

    expect(onSync).toHaveBeenCalledTimes(1)
    expect(onSync).toHaveBeenCalledWith('title')
  })

  it('should call onDiscard when discard button clicked', () => {
    const onDiscard = vi.fn()
    const updates: OutputUpdate[] = [
      { field: 'title', value: 'Title', preview: 'Title' },
    ]

    render(<SyncCardPanel outputUpdates={updates} onDiscard={onDiscard} />)

    const discardButton = screen.getByText('×')
    fireEvent.click(discardButton)

    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onDiscard).toHaveBeenCalledWith('title')
  })

  it('should call correct callback for multiple updates', () => {
    const onSync = vi.fn()
    const onDiscard = vi.fn()
    const updates: OutputUpdate[] = [
      { field: 'title', value: 'Title', preview: 'Title' },
      { field: 'objective', value: 'Obj', preview: 'Obj' },
    ]

    render(<SyncCardPanel outputUpdates={updates} onSync={onSync} onDiscard={onDiscard} />)

    // Click sync on first update
    const syncButtons = screen.getAllByText('同步')
    fireEvent.click(syncButtons[0])
    expect(onSync).toHaveBeenCalledWith('title')

    // Click discard on second update
    const discardButtons = screen.getAllByText('×')
    fireEvent.click(discardButtons[1])
    expect(onDiscard).toHaveBeenCalledWith('objective')
  })

  // ============================================================================
  // Collapse/Expand Tests
  // ============================================================================

  it('should show collapse control when updates exceed maxVisible', () => {
    const updates: OutputUpdate[] = [
      { field: 'field1', value: '1', preview: '1' },
      { field: 'field2', value: '2', preview: '2' },
      { field: 'field3', value: '3', preview: '3' },
      { field: 'field4', value: '4', preview: '4' },
    ]

    render(<SyncCardPanel outputUpdates={updates} maxVisible={3} />)

    expect(screen.getByText('展开全部 (4)')).toBeDefined()
  })

  it('should not show collapse control when updates <= maxVisible', () => {
    const updates: OutputUpdate[] = [
      { field: 'field1', value: '1', preview: '1' },
      { field: 'field2', value: '2', preview: '2' },
    ]

    render(<SyncCardPanel outputUpdates={updates} maxVisible={3} />)

    expect(screen.queryByText(/展开全部/)).toBeNull()
  })

  it('should show only maxVisible cards initially when collapsed', () => {
    const updates: OutputUpdate[] = [
      { field: 'field1', value: '1', preview: '1' },
      { field: 'field2', value: '2', preview: '2' },
      { field: 'field3', value: '3', preview: '3' },
      { field: 'field4', value: '4', preview: '4' },
    ]

    render(<SyncCardPanel outputUpdates={updates} maxVisible={2} />)

    expect(screen.getByText('field1')).toBeDefined()
    expect(screen.getByText('field2')).toBeDefined()
    expect(screen.queryByText('field3')).toBeNull()
    expect(screen.queryByText('field4')).toBeNull()
  })

  it('should show all cards when expanded', () => {
    const updates: OutputUpdate[] = [
      { field: 'field1', value: '1', preview: '1' },
      { field: 'field2', value: '2', preview: '2' },
      { field: 'field3', value: '3', preview: '3' },
      { field: 'field4', value: '4', preview: '4' },
    ]

    render(<SyncCardPanel outputUpdates={updates} maxVisible={2} />)

    const expandButton = screen.getByText('展开全部 (4)')
    fireEvent.click(expandButton)

    expect(screen.getByText('field1')).toBeDefined()
    expect(screen.getByText('field2')).toBeDefined()
    expect(screen.getByText('field3')).toBeDefined()
    expect(screen.getByText('field4')).toBeDefined()
    expect(screen.getByText('收起')).toBeDefined()
  })

  it('should collapse when clicking collapse button', () => {
    const updates: OutputUpdate[] = [
      { field: 'field1', value: '1', preview: '1' },
      { field: 'field2', value: '2', preview: '2' },
      { field: 'field3', value: '3', preview: '3' },
    ]

    render(<SyncCardPanel outputUpdates={updates} maxVisible={2} />)

    // Expand
    const expandButton = screen.getByText('展开全部 (3)')
    fireEvent.click(expandButton)
    expect(screen.getByText('field3')).toBeDefined()

    // Collapse
    const collapseButton = screen.getByText('收起')
    fireEvent.click(collapseButton)
    expect(screen.queryByText('field3')).toBeNull()
    expect(screen.getByText('展开全部 (3)')).toBeDefined()
  })

  // ============================================================================
  // Custom Rendering Tests
  // ============================================================================

  it('should use renderSyncCard when provided', () => {
    const updates: OutputUpdate[] = [
      { field: 'custom-field', value: 'Custom Value', preview: 'Custom Preview' },
    ]

    const renderSyncCard = vi.fn((update, onSync, onDiscard) => (
      <div data-testid="custom-card">
        <span>{update.field}</span>
        <button onClick={onSync}>Custom Sync</button>
        <button onClick={onDiscard}>Custom Discard</button>
      </div>
    ))

    render(<SyncCardPanel outputUpdates={updates} renderSyncCard={renderSyncCard} />)

    expect(renderSyncCard).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('custom-card')).toBeDefined()
    expect(screen.getByText('Custom Sync')).toBeDefined()
    expect(screen.getByText('Custom Discard')).toBeDefined()
  })

  it('should pass correct callbacks to renderSyncCard', () => {
    const onSync = vi.fn()
    const onDiscard = vi.fn()
    const updates: OutputUpdate[] = [
      { field: 'field1', value: 'Value', preview: 'Preview' },
    ]

    const renderSyncCard = vi.fn((update, handleSync, handleDiscard) => (
      <div>
        <button onClick={handleSync}>Sync</button>
        <button onClick={handleDiscard}>Discard</button>
      </div>
    ))

    render(
      <SyncCardPanel
        outputUpdates={updates}
        onSync={onSync}
        onDiscard={onDiscard}
        renderSyncCard={renderSyncCard}
      />
    )

    const syncButton = screen.getByText('Sync')
    const discardButton = screen.getByText('Discard')

    fireEvent.click(syncButton)
    expect(onSync).toHaveBeenCalledWith('field1')

    fireEvent.click(discardButton)
    expect(onDiscard).toHaveBeenCalledWith('field1')
  })

  // ============================================================================
  // Default Card Rendering Tests
  // ============================================================================

  it('should render default card with field name and preview', () => {
    const updates: OutputUpdate[] = [
      { field: 'lessonTitle', value: 'Circles', preview: 'Title: Circles' },
    ]

    render(<SyncCardPanel outputUpdates={updates} />)

    expect(screen.getByText('lessonTitle')).toBeDefined()
    expect(screen.getByText('Title: Circles')).toBeDefined()
  })

  it('should render default card with sync and discard buttons', () => {
    const updates: OutputUpdate[] = [
      { field: 'field', value: 'value', preview: 'preview' },
    ]

    render(<SyncCardPanel outputUpdates={updates} />)

    expect(screen.getByText('同步')).toBeDefined()
    expect(screen.getByText('×')).toBeDefined()
  })

  // ============================================================================
  // Edge Cases
  // ============================================================================

  it('should handle updates without timestamp for deduplication', () => {
    const updates: OutputUpdate[] = [
      { field: 'field1', value: 'value1', preview: 'preview1' }, // No timestamp
    ]

    render(<SyncCardPanel outputUpdates={updates} />)

    expect(screen.getByText('field1')).toBeDefined()
  })

  it('should handle very long field names and previews', () => {
    const updates: OutputUpdate[] = [
      {
        field: 'veryLongFieldNameThatShouldBeTruncatedInTheUI',
        value: 'Long value',
        preview: 'This is a very long preview text that should be truncated with ellipsis in the UI to prevent overflow',
      },
    ]

    render(<SyncCardPanel outputUpdates={updates} />)

    expect(screen.getByText('veryLongFieldNameThatShouldBeTruncatedInTheUI')).toBeDefined()
  })

  it('should handle updates with undefined synced property as pending', () => {
    const updates: OutputUpdate[] = [
      { field: 'field1', value: 'value', preview: 'preview' }, // synced undefined
    ]

    render(<SyncCardPanel outputUpdates={updates} />)

    expect(screen.getByText('field1')).toBeDefined() // Should render
  })
})
