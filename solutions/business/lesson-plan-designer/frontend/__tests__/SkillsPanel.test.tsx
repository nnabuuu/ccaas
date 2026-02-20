import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import SkillsPanel from '../src/components/SkillsPanel'
import SkillItem from '../src/components/SkillItem'
import type { Skill } from '../src/types'

const mockSkills: Skill[] = [
  {
    id: '1',
    tenantId: 'test-tenant',
    name: '教学目标生成',
    slug: 'objectives-generator',
    description: '根据课程内容自动生成教学目标',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    tenantId: 'test-tenant',
    name: '教学活动设计',
    slug: 'activities-designer',
    description: '设计多样化的教学活动',
    status: 'draft',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

describe('SkillItem', () => {
  const defaultProps = {
    skill: mockSkills[0],
    enabled: false,
    onToggle: vi.fn(),
    onEdit: vi.fn(),
  }

  it('should render skill name', () => {
    render(<SkillItem {...defaultProps} />)

    expect(screen.getByText('教学目标生成')).toBeInTheDocument()
  })

  it('should render skill description', () => {
    render(<SkillItem {...defaultProps} />)

    expect(screen.getByText('根据课程内容自动生成教学目标')).toBeInTheDocument()
  })

  it('should show published status badge', () => {
    render(<SkillItem {...defaultProps} />)

    expect(screen.getByText('已发布')).toBeInTheDocument()
  })

  it('should show draft status badge', () => {
    render(<SkillItem {...defaultProps} skill={mockSkills[1]} />)

    expect(screen.getByText('草稿')).toBeInTheDocument()
  })

  it('should call onToggle when switch is clicked', () => {
    const onToggle = vi.fn()
    render(<SkillItem {...defaultProps} onToggle={onToggle} />)

    const toggleSwitch = screen.getByRole('switch')
    fireEvent.click(toggleSwitch)

    expect(onToggle).toHaveBeenCalled()
  })

  it('should show enabled state on switch', () => {
    render(<SkillItem {...defaultProps} enabled={true} />)

    const toggleSwitch = screen.getByRole('switch')
    expect(toggleSwitch).toHaveAttribute('aria-checked', 'true')
  })

  it('should show disabled state on switch', () => {
    render(<SkillItem {...defaultProps} enabled={false} />)

    const toggleSwitch = screen.getByRole('switch')
    expect(toggleSwitch).toHaveAttribute('aria-checked', 'false')
  })

  it('should call onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    render(<SkillItem {...defaultProps} onEdit={onEdit} />)

    const editButton = screen.getByTitle('编辑')
    fireEvent.click(editButton)

    expect(onEdit).toHaveBeenCalled()
  })
})

describe('SkillsPanel', () => {
  const defaultProps = {
    skills: mockSkills,
    loading: false,
    error: null,
    searchQuery: '',
    enabledSkillIds: new Set<string>(),
    onSearchChange: vi.fn(),
    onToggleSkill: vi.fn(),
    onEditSkill: vi.fn(),
  }

  it('should render panel title', () => {
    render(<SkillsPanel {...defaultProps} />)

    expect(screen.getByText('技能管理')).toBeInTheDocument()
  })

  it('should render all skills', () => {
    render(<SkillsPanel {...defaultProps} />)

    expect(screen.getByText('教学目标生成')).toBeInTheDocument()
    expect(screen.getByText('教学活动设计')).toBeInTheDocument()
  })

  it('should render search input', () => {
    render(<SkillsPanel {...defaultProps} />)

    expect(screen.getByPlaceholderText('搜索技能...')).toBeInTheDocument()
  })

  it('should call onSearchChange when search input changes', () => {
    const onSearchChange = vi.fn()
    render(<SkillsPanel {...defaultProps} onSearchChange={onSearchChange} />)

    const searchInput = screen.getByPlaceholderText('搜索技能...')
    fireEvent.change(searchInput, { target: { value: '目标' } })

    expect(onSearchChange).toHaveBeenCalledWith('目标')
  })

  it('should show loading state', () => {
    render(<SkillsPanel {...defaultProps} loading={true} skills={[]} />)

    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('should show error state', () => {
    render(<SkillsPanel {...defaultProps} error="Network error" skills={[]} />)

    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('should show empty state when no skills', () => {
    render(<SkillsPanel {...defaultProps} skills={[]} />)

    expect(screen.getByText('暂无技能')).toBeInTheDocument()
  })

  describe('collapse functionality', () => {
    it('should be expanded by default', () => {
      render(<SkillsPanel {...defaultProps} />)

      expect(screen.getByText('教学目标生成')).toBeInTheDocument()
    })

    it('should collapse when header button is clicked', () => {
      render(<SkillsPanel {...defaultProps} />)

      const collapseButton = screen.getByTitle('收起')
      fireEvent.click(collapseButton)

      expect(screen.queryByText('教学目标生成')).not.toBeInTheDocument()
    })

    it('should expand when header button is clicked again', () => {
      render(<SkillsPanel {...defaultProps} />)

      const collapseButton = screen.getByTitle('收起')
      fireEvent.click(collapseButton)

      const expandButton = screen.getByTitle('展开')
      fireEvent.click(expandButton)

      expect(screen.getByText('教学目标生成')).toBeInTheDocument()
    })
  })

  it('should pass enabled state to SkillItem', () => {
    const enabledSkillIds = new Set(['1'])
    render(<SkillsPanel {...defaultProps} enabledSkillIds={enabledSkillIds} />)

    const switches = screen.getAllByRole('switch')
    // First skill should be enabled
    expect(switches[0]).toHaveAttribute('aria-checked', 'true')
    // Second skill should be disabled
    expect(switches[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('should call onToggleSkill when skill toggle is clicked', () => {
    const onToggleSkill = vi.fn()
    render(<SkillsPanel {...defaultProps} onToggleSkill={onToggleSkill} />)

    const switches = screen.getAllByRole('switch')
    fireEvent.click(switches[0])

    expect(onToggleSkill).toHaveBeenCalledWith('1')
  })

  it('should call onEditSkill when skill edit is clicked', () => {
    const onEditSkill = vi.fn()
    render(<SkillsPanel {...defaultProps} onEditSkill={onEditSkill} />)

    const editButtons = screen.getAllByTitle('编辑')
    fireEvent.click(editButtons[0])

    expect(onEditSkill).toHaveBeenCalledWith(mockSkills[0])
  })
})
