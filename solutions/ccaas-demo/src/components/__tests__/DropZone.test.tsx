/**
 * DropZone Component Tests
 *
 * Tests for the empty state drop zone component.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DropZone } from '../DropZone'

describe('DropZone', () => {
  describe('rendering', () => {
    it('should render when isEmpty is true', () => {
      render(<DropZone isEmpty={true} />)

      expect(screen.getByText('No files yet')).toBeInTheDocument()
    })

    it('should not render when isEmpty is false', () => {
      render(<DropZone isEmpty={false} />)

      expect(screen.queryByText('No files yet')).not.toBeInTheDocument()
    })

    it('should show drag and drop hint', () => {
      render(<DropZone isEmpty={true} />)

      expect(screen.getByText(/Drag and drop/)).toBeInTheDocument()
    })

    it('should mention AI-created files', () => {
      render(<DropZone isEmpty={true} />)

      expect(screen.getByText(/Files created by the AI/)).toBeInTheDocument()
    })

    it('should render folder icon', () => {
      render(<DropZone isEmpty={true} />)

      expect(screen.getByText('📂')).toBeInTheDocument()
    })
  })
})
