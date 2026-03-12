import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionTemplateFormPage } from '@/pages/session-templates/form'

const mockNavigate = vi.fn()
const mockParams: Record<string, string | undefined> = {}

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}))

vi.mock('@refinedev/core', () => ({
  useOne: vi.fn(),
  useCreate: vi.fn(),
  useUpdate: vi.fn(),
}))

vi.mock('@/hooks/use-tenant-context', () => ({
  useTenantContext: () => ({ selectedTenantId: null }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useOne, useCreate, useUpdate } from '@refinedev/core'

describe('SessionTemplateFormPage – autoClose toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to create mode (no name param)
    delete mockParams.name
    vi.mocked(useOne).mockReturnValue({ data: undefined } as any)
    vi.mocked(useCreate).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}) } as any)
    vi.mocked(useUpdate).mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}) } as any)
  })

  it('renders the autoClose toggle', () => {
    render(<SessionTemplateFormPage />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('renders the One-shot Mode label', () => {
    render(<SessionTemplateFormPage />)
    expect(screen.getByText(/one-shot mode/i)).toBeInTheDocument()
  })

  it('toggle is unchecked by default in create mode', () => {
    render(<SessionTemplateFormPage />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('shows helper text describing one-shot behavior', () => {
    render(<SessionTemplateFormPage />)
    expect(
      screen.getByText(/session is destroyed after each response/i)
    ).toBeInTheDocument()
  })

  it('can be toggled on', async () => {
    const user = userEvent.setup()
    render(<SessionTemplateFormPage />)
    const toggle = screen.getByRole('switch')
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('can be toggled on then off again', async () => {
    const user = userEvent.setup()
    render(<SessionTemplateFormPage />)
    const toggle = screen.getByRole('switch')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })

  it('populates autoClose=true when editing a template that has it set', () => {
    mockParams.name = 'my-template'
    vi.mocked(useOne).mockReturnValue({
      data: {
        data: {
          name: 'my-template',
          template: {
            description: 'Test',
            appendSystemPrompt: '',
            enabledSkills: [],
            mcpServers: {},
            autoClose: true,
          },
        },
      },
    } as any)

    render(<SessionTemplateFormPage />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('leaves autoClose unchecked when editing a template without it', () => {
    mockParams.name = 'my-template'
    vi.mocked(useOne).mockReturnValue({
      data: {
        data: {
          name: 'my-template',
          template: {
            description: 'Test',
            appendSystemPrompt: '',
            enabledSkills: [],
            mcpServers: {},
          },
        },
      },
    } as any)

    render(<SessionTemplateFormPage />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('shows Create Template heading in create mode', () => {
    render(<SessionTemplateFormPage />)
    expect(screen.getByText('Create Template')).toBeInTheDocument()
  })

  it('shows Edit Template heading in edit mode', () => {
    mockParams.name = 'my-template'
    vi.mocked(useOne).mockReturnValue({
      data: {
        data: {
          name: 'my-template',
          template: { description: '', appendSystemPrompt: '', enabledSkills: [], mcpServers: {} },
        },
      },
    } as any)
    render(<SessionTemplateFormPage />)
    expect(screen.getByText('Edit Template')).toBeInTheDocument()
  })
})
