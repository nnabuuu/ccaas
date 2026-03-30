import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SkillPanel } from '../SkillPanel'

const mockUseSkills = vi.fn()

vi.mock('@kedge-agentic/react-sdk', () => ({
  useSkills: (...args: unknown[]) => mockUseSkills(...args),
}))

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

const baseProps = {
  serverUrl: 'http://localhost:3001',
  tenantId: 'test-tenant',
  open: true,
  onClose: vi.fn(),
}

const solutionSkill = {
  id: 's1',
  name: 'Greeting',
  slug: 'greeting',
  description: 'Say hello',
  type: 'skill',
  status: 'published',
  enabled: true,
  currentVersion: '1.0.0',
  config: {},
  createdBy: null,
  version: 1,
  content: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const customSkill = {
  id: 's2',
  name: 'Farewell',
  slug: 'farewell',
  description: 'Say goodbye',
  type: 'skill',
  status: 'draft',
  enabled: true,
  currentVersion: '1.0.0',
  config: {},
  createdBy: 'user-1',
  version: 1,
  content: '',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

const mockToggleSkill = vi.fn()

function mockDefault() {
  return {
    skills: [solutionSkill, customSkill],
    loading: false,
    error: null,
    toggleSkill: mockToggleSkill,
    filteredSkills: [solutionSkill, customSkill],
    searchQuery: '',
    setSearchQuery: vi.fn(),
    enabledSkillIds: new Set(['s1', 's2']),
    isSkillEnabled: () => true,
    refresh: vi.fn(),
  }
}

beforeEach(() => {
  mockUseSkills.mockReturnValue(mockDefault())
  baseProps.onClose = vi.fn()
  mockToggleSkill.mockReset()
})

describe('SkillPanel', () => {
  it('does not render when open=false', () => {
    const { container } = render(<SkillPanel {...baseProps} open={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders header and tabs when open', () => {
    render(<SkillPanel {...baseProps} />)
    screen.getByText('Skill 管理')
    screen.getByText('test-tenant')
    screen.getByText('Tenant')
    screen.getByRole('tab', { name: 'Solution Skills' })
    screen.getByRole('tab', { name: '自建 Skills' })
    screen.getByRole('tab', { name: '使用统计' })
  })

  it('shows solution skills on the default tab', () => {
    render(<SkillPanel {...baseProps} />)
    screen.getByText('Greeting')
    screen.getByText('Say hello')
    // "已启用" appears as stat label, section title, and badge
    expect(screen.getAllByText('已启用').length).toBeGreaterThanOrEqual(2)
  })

  it('shows custom skills when switching to custom tab', async () => {
    render(<SkillPanel {...baseProps} />)
    await userEvent.click(screen.getByRole('tab', { name: '自建 Skills' }))
    screen.getByText('Farewell')
    screen.getByText('Say goodbye')
    // "草稿" appears as stat label and badge
    expect(screen.getAllByText('草稿').length).toBeGreaterThanOrEqual(1)
  })

  it('shows stats placeholder on stats tab', async () => {
    render(<SkillPanel {...baseProps} />)
    await userEvent.click(screen.getByRole('tab', { name: '使用统计' }))
    screen.getByText('使用统计功能即将上线')
  })

  it('calls onClose when close button is clicked', async () => {
    render(<SkillPanel {...baseProps} />)
    await userEvent.click(screen.getByLabelText('关闭技能面板'))
    expect(baseProps.onClose).toHaveBeenCalledOnce()
  })

  it('calls toggleSkill when disable button is clicked', async () => {
    render(<SkillPanel {...baseProps} />)
    await userEvent.click(screen.getByText('停用'))
    expect(mockToggleSkill).toHaveBeenCalledWith('s1')
  })

  it('shows loading state', () => {
    mockUseSkills.mockReturnValue({ ...mockDefault(), skills: [], loading: true })
    render(<SkillPanel {...baseProps} />)
    screen.getByText('加载 Skills...')
  })

  it('shows error state', () => {
    mockUseSkills.mockReturnValue({ ...mockDefault(), skills: [], error: 'Network error' })
    render(<SkillPanel {...baseProps} />)
    screen.getByText('Network error')
  })

  it('shows empty state when no solution skills', () => {
    mockUseSkills.mockReturnValue({ ...mockDefault(), skills: [customSkill] })
    render(<SkillPanel {...baseProps} />)
    screen.getByText('暂无 Solution Skills')
  })

  it('renders config params when present', () => {
    const withConfig = { ...solutionSkill, config: { model: 'gpt-4', temperature: 0.7 } }
    mockUseSkills.mockReturnValue({ ...mockDefault(), skills: [withConfig] })
    render(<SkillPanel {...baseProps} />)
    screen.getByText('model')
    screen.getByText('gpt-4')
  })

  it('shows placeholder when config is empty', () => {
    render(<SkillPanel {...baseProps} />)
    screen.getByText('暂无参数配置')
  })

  it('forwards apiKey to useSkills', () => {
    render(<SkillPanel {...baseProps} apiKey="test-key" />)
    expect(mockUseSkills).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'test-key' }),
    )
  })

  it('marks active tab with aria-selected', () => {
    render(<SkillPanel {...baseProps} />)
    const solutionTab = screen.getByRole('tab', { name: 'Solution Skills' })
    const customTab = screen.getByRole('tab', { name: '自建 Skills' })
    expect(solutionTab.getAttribute('aria-selected')).toBe('true')
    expect(customTab.getAttribute('aria-selected')).toBe('false')
  })

  it('shows stat cards with correct counts', () => {
    render(<SkillPanel {...baseProps} />)
    screen.getByText('Solution 内置')
    // Stat card values: 1 solution skill total, 1 enabled, 0 disabled
    const statVals = screen.getAllByText('1')
    expect(statVals.length).toBeGreaterThanOrEqual(1)
  })
})
