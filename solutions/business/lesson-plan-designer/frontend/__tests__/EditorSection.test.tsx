import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import EditorSection from '../src/components/EditorSection'

describe('EditorSection', () => {
  const defaultProps = {
    id: 'objectives',
    title: '教学目标',
    children: <div>Section Content</div>,
    isEditing: false,
    isSaving: false,
    onStartEdit: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
  }

  it('should render section with title', () => {
    render(<EditorSection {...defaultProps} />)

    expect(screen.getByText('教学目标')).toBeInTheDocument()
    expect(screen.getByText('Section Content')).toBeInTheDocument()
  })

  it('should have the correct id for scroll targeting', () => {
    const { container } = render(<EditorSection {...defaultProps} />)

    const section = container.querySelector('#objectives')
    expect(section).toBeInTheDocument()
  })

  describe('view mode (not editing)', () => {
    it('should show edit button when not editing', () => {
      render(<EditorSection {...defaultProps} />)

      expect(screen.getByText('编辑')).toBeInTheDocument()
    })

    it('should not show save/cancel buttons when not editing', () => {
      render(<EditorSection {...defaultProps} />)

      expect(screen.queryByText('保存')).not.toBeInTheDocument()
      expect(screen.queryByText('取消')).not.toBeInTheDocument()
    })

    it('should call onStartEdit when edit button clicked', () => {
      const onStartEdit = vi.fn()
      render(<EditorSection {...defaultProps} onStartEdit={onStartEdit} />)

      fireEvent.click(screen.getByText('编辑'))
      expect(onStartEdit).toHaveBeenCalled()
    })

    it('should not have editing highlight border', () => {
      const { container } = render(<EditorSection {...defaultProps} />)

      const section = container.querySelector('#objectives')
      expect(section).not.toHaveClass('border-l-4')
    })
  })

  describe('edit mode', () => {
    const editingProps = {
      ...defaultProps,
      isEditing: true,
    }

    it('should show save and cancel buttons when editing', () => {
      render(<EditorSection {...editingProps} />)

      expect(screen.getByText('保存')).toBeInTheDocument()
      expect(screen.getByText('取消')).toBeInTheDocument()
    })

    it('should not show edit button when editing', () => {
      render(<EditorSection {...editingProps} />)

      expect(screen.queryByText('编辑')).not.toBeInTheDocument()
    })

    it('should have editing highlight border', () => {
      const { container } = render(<EditorSection {...editingProps} />)

      const section = container.querySelector('#objectives')
      expect(section).toHaveClass('border-l-4')
      expect(section).toHaveClass('border-primary-500')
    })

    it('should call onSave when save button clicked', () => {
      const onSave = vi.fn()
      render(<EditorSection {...editingProps} onSave={onSave} />)

      fireEvent.click(screen.getByText('保存'))
      expect(onSave).toHaveBeenCalled()
    })

    it('should call onCancel when cancel button clicked', () => {
      const onCancel = vi.fn()
      render(<EditorSection {...editingProps} onCancel={onCancel} />)

      fireEvent.click(screen.getByText('取消'))
      expect(onCancel).toHaveBeenCalled()
    })
  })

  describe('saving state', () => {
    const savingProps = {
      ...defaultProps,
      isEditing: true,
      isSaving: true,
    }

    it('should show saving indicator', () => {
      render(<EditorSection {...savingProps} />)

      expect(screen.getByText('保存中...')).toBeInTheDocument()
    })

    it('should disable save button while saving', () => {
      render(<EditorSection {...savingProps} />)

      const saveButton = screen.getByText('保存中...')
      expect(saveButton).toBeDisabled()
    })

    it('should disable cancel button while saving', () => {
      render(<EditorSection {...savingProps} />)

      const cancelButton = screen.getByText('取消')
      expect(cancelButton).toBeDisabled()
    })
  })

  describe('AI modified indicator', () => {
    it('should show AI modified badge when isModified is true', () => {
      render(<EditorSection {...defaultProps} isModified={true} />)

      expect(screen.getByText('AI已修改')).toBeInTheDocument()
    })

    it('should not show AI modified badge when isModified is false', () => {
      render(<EditorSection {...defaultProps} isModified={false} />)

      expect(screen.queryByText('AI已修改')).not.toBeInTheDocument()
    })
  })

  describe('undo functionality', () => {
    it('should show undo button when canUndo is true', () => {
      render(<EditorSection {...defaultProps} canUndo={true} onUndo={vi.fn()} />)

      expect(screen.getByText('撤销')).toBeInTheDocument()
    })

    it('should not show undo button when canUndo is false', () => {
      render(<EditorSection {...defaultProps} canUndo={false} />)

      expect(screen.queryByText('撤销')).not.toBeInTheDocument()
    })

    it('should call onUndo when undo button clicked', () => {
      const onUndo = vi.fn()
      render(<EditorSection {...defaultProps} canUndo={true} onUndo={onUndo} />)

      fireEvent.click(screen.getByText('撤销'))
      expect(onUndo).toHaveBeenCalled()
    })
  })

  describe('AI assist button', () => {
    it('should show AI button when onAiAssist is provided', () => {
      render(<EditorSection {...defaultProps} onAiAssist={vi.fn()} />)

      expect(screen.getByTitle('AI 辅助')).toBeInTheDocument()
    })

    it('should call onAiAssist when AI button clicked', () => {
      const onAiAssist = vi.fn()
      render(<EditorSection {...defaultProps} onAiAssist={onAiAssist} />)

      fireEvent.click(screen.getByTitle('AI 辅助'))
      expect(onAiAssist).toHaveBeenCalled()
    })
  })
})
