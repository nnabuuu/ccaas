import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkillPanel } from '../SkillPanel'

const mockUseSkills = vi.fn()

vi.mock('@kedge-agentic/react-sdk', () => ({
  useSkills: (...args: unknown[]) => mockUseSkills(...args),
}))

const baseProps = {
  serverUrl: 'http://localhost:3001',
  tenantId: 'test-tenant',
  open: true,
  onClose: vi.fn(),
}

const mockSkills = [
  { id: 's1', name: 'Greeting', slug: 'greeting', description: 'Say hello' },
  { id: 's2', name: 'Farewell', slug: 'farewell', description: 'Say goodbye' },
]

function mockDefault() {
  return {
    filteredSkills: mockSkills,
    loading: false,
    error: null,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    isSkillEnabled: (id: string) => id === 's1',
  }
}

beforeEach(() => {
  mockUseSkills.mockReturnValue(mockDefault())
  baseProps.onClose = vi.fn()
})

describe('SkillPanel', () => {
  it('does not render when open=false', () => {
    const { container } = render(<SkillPanel {...baseProps} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders skill list when open=true', () => {
    render(<SkillPanel {...baseProps} />)
    screen.getByText('Greeting')
    screen.getByText('Farewell')
    screen.getByText('Say hello')
    screen.getByText('Say goodbye')
  })

  it('has no toggle switch (read-only panel)', () => {
    render(<SkillPanel {...baseProps} />)
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('renders search input', () => {
    render(<SkillPanel {...baseProps} />)
    screen.getByPlaceholderText('搜索技能...')
  })

  it('shows a11y status dots with correct labels', () => {
    render(<SkillPanel {...baseProps} />)
    const statuses = screen.getAllByRole('status')
    expect(statuses).toHaveLength(2)
    expect(statuses[0].getAttribute('aria-label')).toBe('已启用')
    expect(statuses[1].getAttribute('aria-label')).toBe('未启用')
  })

  it('calls onClose when close button is clicked', async () => {
    render(<SkillPanel {...baseProps} />)
    await userEvent.click(screen.getByLabelText('关闭技能面板'))
    expect(baseProps.onClose).toHaveBeenCalledOnce()
  })

  it('shows loading state', () => {
    mockUseSkills.mockReturnValue({ ...mockDefault(), filteredSkills: [], loading: true })
    render(<SkillPanel {...baseProps} />)
    screen.getByText('加载技能...')
  })

  it('shows error state', () => {
    mockUseSkills.mockReturnValue({ ...mockDefault(), filteredSkills: [], error: 'Network error' })
    render(<SkillPanel {...baseProps} />)
    screen.getByText('Network error')
  })

  it('shows empty state', () => {
    mockUseSkills.mockReturnValue({ ...mockDefault(), filteredSkills: [] })
    render(<SkillPanel {...baseProps} />)
    screen.getByText('未找到技能')
  })

  it('forwards apiKey to useSkills', () => {
    render(<SkillPanel {...baseProps} apiKey="test-key" />)
    expect(mockUseSkills).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'test-key' }),
    )
  })
})
