import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import Header from '../src/components/Header'
import FormSection from '../src/components/FormSection'
import SyncButton from '../src/components/SyncButton'
import QuickPrompts from '../src/components/QuickPrompts'

describe('Header', () => {
  it('should render title', () => {
    render(
      <Header
        title="Test Lesson"
        connected={true}
        saving={false}
        hasChanges={false}
        onSave={vi.fn()}
        onNew={vi.fn()}
      />
    )

    expect(screen.getByText('Test Lesson')).toBeInTheDocument()
  })

  it('should show connected status', () => {
    render(
      <Header
        title="Test"
        connected={true}
        saving={false}
        hasChanges={false}
        onSave={vi.fn()}
        onNew={vi.fn()}
      />
    )

    expect(screen.getByText('已连接')).toBeInTheDocument()
  })

  it('should show disconnected status', () => {
    render(
      <Header
        title="Test"
        connected={false}
        saving={false}
        hasChanges={false}
        onSave={vi.fn()}
        onNew={vi.fn()}
      />
    )

    expect(screen.getByText('未连接')).toBeInTheDocument()
  })

  it('should show saving state', () => {
    render(
      <Header
        title="Test"
        connected={true}
        saving={true}
        hasChanges={true}
        onSave={vi.fn()}
        onNew={vi.fn()}
      />
    )

    expect(screen.getByText('保存中...')).toBeInTheDocument()
  })

  it('should call onSave when save button clicked', () => {
    const onSave = vi.fn()
    render(
      <Header
        title="Test"
        connected={true}
        saving={false}
        hasChanges={true}
        onSave={onSave}
        onNew={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('保存'))
    expect(onSave).toHaveBeenCalled()
  })

  it('should call onNew when new button clicked', () => {
    const onNew = vi.fn()
    render(
      <Header
        title="Test"
        connected={true}
        saving={false}
        hasChanges={false}
        onSave={vi.fn()}
        onNew={onNew}
      />
    )

    fireEvent.click(screen.getByText('新建'))
    expect(onNew).toHaveBeenCalled()
  })
})

describe('FormSection', () => {
  it('should render title', () => {
    render(
      <FormSection
        title="教学目标"
        collapsed={false}
        onToggle={vi.fn()}
      >
        <div>Content</div>
      </FormSection>
    )

    expect(screen.getByText('教学目标')).toBeInTheDocument()
  })

  it('should show content when not collapsed', () => {
    render(
      <FormSection
        title="Test Section"
        collapsed={false}
        onToggle={vi.fn()}
      >
        <div>Section Content</div>
      </FormSection>
    )

    expect(screen.getByText('Section Content')).toBeInTheDocument()
  })

  it('should hide content when collapsed', () => {
    render(
      <FormSection
        title="Test Section"
        collapsed={true}
        onToggle={vi.fn()}
      >
        <div>Section Content</div>
      </FormSection>
    )

    expect(screen.queryByText('Section Content')).not.toBeInTheDocument()
  })

  it('should show AI modified badge when modified', () => {
    render(
      <FormSection
        title="Test Section"
        isModified={true}
        collapsed={false}
        onToggle={vi.fn()}
      >
        <div>Content</div>
      </FormSection>
    )

    expect(screen.getByText('AI已修改')).toBeInTheDocument()
  })

  it('should show undo button when canUndo is true', () => {
    const onUndo = vi.fn()
    render(
      <FormSection
        title="Test Section"
        isModified={true}
        canUndo={true}
        onUndo={onUndo}
        collapsed={false}
        onToggle={vi.fn()}
      >
        <div>Content</div>
      </FormSection>
    )

    expect(screen.getByText('撤销')).toBeInTheDocument()
    fireEvent.click(screen.getByText('撤销'))
    expect(onUndo).toHaveBeenCalled()
  })

  it('should call onToggle when header clicked', () => {
    const onToggle = vi.fn()
    render(
      <FormSection
        title="Test Section"
        collapsed={false}
        onToggle={onToggle}
      >
        <div>Content</div>
      </FormSection>
    )

    fireEvent.click(screen.getByText('Test Section'))
    expect(onToggle).toHaveBeenCalled()
  })
})

describe('SyncButton', () => {
  it('should render sync button with preview', () => {
    render(
      <SyncButton
        field="objectives"
        preview="3个教学目标"
        onSync={vi.fn()}
        onDiscard={vi.fn()}
      />
    )

    expect(screen.getByText('建议更新「教学目标」')).toBeInTheDocument()
    expect(screen.getByText('3个教学目标')).toBeInTheDocument()
    expect(screen.getByText('同步到表单')).toBeInTheDocument()
  })

  it('should show synced state', () => {
    render(
      <SyncButton
        field="objectives"
        preview="3个教学目标"
        synced={true}
        onSync={vi.fn()}
        onDiscard={vi.fn()}
      />
    )

    expect(screen.getByText('已同步到「教学目标」')).toBeInTheDocument()
  })

  it('should call onSync when sync button clicked', () => {
    const onSync = vi.fn()
    render(
      <SyncButton
        field="objectives"
        preview="Preview"
        onSync={onSync}
        onDiscard={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('同步到表单'))
    expect(onSync).toHaveBeenCalled()
  })

  it('should call onDiscard when discard button clicked', () => {
    const onDiscard = vi.fn()
    render(
      <SyncButton
        field="objectives"
        preview="Preview"
        onSync={vi.fn()}
        onDiscard={onDiscard}
      />
    )

    // Find the discard button (X icon)
    const discardButton = screen.getByTitle('忽略')
    fireEvent.click(discardButton)
    expect(onDiscard).toHaveBeenCalled()
  })
})

describe('QuickPrompts', () => {
  it('should render all quick prompts', () => {
    render(<QuickPrompts onSelect={vi.fn()} />)

    expect(screen.getByText('教学目标')).toBeInTheDocument()
    expect(screen.getByText('教学活动')).toBeInTheDocument()
    expect(screen.getByText('评估方案')).toBeInTheDocument()
    expect(screen.getByText('差异化')).toBeInTheDocument()
  })

  it('should call onSelect with prompt when clicked', () => {
    const onSelect = vi.fn()
    render(<QuickPrompts onSelect={onSelect} />)

    fireEvent.click(screen.getByText('教学目标'))
    expect(onSelect).toHaveBeenCalledWith('帮我设计本课的教学目标')
  })

  it('should disable buttons when disabled prop is true', () => {
    render(<QuickPrompts onSelect={vi.fn()} disabled={true} />)

    const buttons = screen.getAllByRole('button')
    buttons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })
})
