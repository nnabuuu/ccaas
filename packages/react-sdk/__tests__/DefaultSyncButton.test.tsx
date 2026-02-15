import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DefaultSyncButton } from '../src/components/DefaultSyncButton'
import type { OutputUpdate } from '../src/types'

describe('DefaultSyncButton', () => {
  const baseUpdate: OutputUpdate = {
    field: '标题',
    value: '圆的面积',
    preview: '圆的面积',
    synced: false,
  }

  describe('Basic Rendering', () => {
    it('should display field name and preview', () => {
      render(
        <DefaultSyncButton
          update={baseUpdate}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      expect(screen.getByText('标题')).toBeInTheDocument()
      expect(screen.getByText('圆的面积')).toBeInTheDocument()
    })

    it('should show sync and discard buttons when not synced', () => {
      render(
        <DefaultSyncButton
          update={baseUpdate}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      expect(screen.getByText('同步')).toBeInTheDocument()
      expect(screen.getByText('忽略')).toBeInTheDocument()
    })

    it('should show synced status when synced=true', () => {
      const syncedUpdate: OutputUpdate = {
        ...baseUpdate,
        synced: true,
        syncedAt: new Date('2026-02-15T10:30:00'),
      }
      render(
        <DefaultSyncButton
          update={syncedUpdate}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      expect(screen.getByText(/已同步/)).toBeInTheDocument()
      expect(screen.queryByText('同步')).not.toBeInTheDocument()
      expect(screen.queryByText('忽略')).not.toBeInTheDocument()
    })

    it('should display syncedAt time when provided', () => {
      const syncedUpdate: OutputUpdate = {
        ...baseUpdate,
        synced: true,
        syncedAt: new Date('2026-02-15T10:30:00'),
      }
      render(
        <DefaultSyncButton
          update={syncedUpdate}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      expect(screen.getByText(/10:30/)).toBeInTheDocument()
    })
  })

  describe('Actions', () => {
    it('should call onSync when sync button clicked', () => {
      const onSync = vi.fn()
      render(
        <DefaultSyncButton
          update={baseUpdate}
          onSync={onSync}
          onDiscard={vi.fn()}
        />
      )
      fireEvent.click(screen.getByText('同步'))
      expect(onSync).toHaveBeenCalledTimes(1)
    })

    it('should call onDiscard when discard button clicked', () => {
      const onDiscard = vi.fn()
      render(
        <DefaultSyncButton
          update={baseUpdate}
          onSync={vi.fn()}
          onDiscard={onDiscard}
        />
      )
      fireEvent.click(screen.getByText('忽略'))
      expect(onDiscard).toHaveBeenCalledTimes(1)
    })

    it('should not render buttons when synced', () => {
      const syncedUpdate: OutputUpdate = { ...baseUpdate, synced: true }
      const onSync = vi.fn()
      const onDiscard = vi.fn()

      const { container } = render(
        <DefaultSyncButton
          update={syncedUpdate}
          onSync={onSync}
          onDiscard={onDiscard}
        />
      )

      const buttons = container.querySelectorAll('button')
      expect(buttons.length).toBe(0)
    })
  })

  describe('Styling', () => {
    it('should apply correct button styles for sync action', () => {
      const { container } = render(
        <DefaultSyncButton
          update={baseUpdate}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      const syncButton = screen.getByText('同步').closest('button')
      expect(syncButton).toHaveClass('bg-blue-600')
      expect(syncButton).toHaveClass('text-white')
    })

    it('should apply correct button styles for discard action', () => {
      const { container } = render(
        <DefaultSyncButton
          update={baseUpdate}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      const discardButton = screen.getByText('忽略').closest('button')
      expect(discardButton).toHaveClass('bg-gray-100')
      expect(discardButton).toHaveClass('text-gray-600')
    })

    it('should show green checkmark icon when synced', () => {
      const syncedUpdate: OutputUpdate = { ...baseUpdate, synced: true }
      const { container } = render(
        <DefaultSyncButton
          update={syncedUpdate}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      const checkIcon = container.querySelector('svg[viewBox="0 0 24 24"]')
      expect(checkIcon).toBeInTheDocument()
      expect(checkIcon?.parentElement).toHaveClass('text-green-600')
    })
  })

  describe('Preview Truncation', () => {
    it('should truncate long preview text', () => {
      const longUpdate: OutputUpdate = {
        ...baseUpdate,
        preview: 'A'.repeat(200),
      }
      const { container } = render(
        <DefaultSyncButton
          update={longUpdate}
          onSync={vi.fn()}
          onDiscard={vi.fn()}
        />
      )
      const previewElement = container.querySelector('.line-clamp-2')
      expect(previewElement).toBeInTheDocument()
    })
  })
})
