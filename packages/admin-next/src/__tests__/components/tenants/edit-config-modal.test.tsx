import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as z from 'zod'
import { EditConfigModal } from '@/components/tenants/edit-config-modal'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    put: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'

const defaultConfig = {
  defaultModel: 'claude-sonnet-4-5-20250514',
  maxTokensPerRequest: 4096,
  features: {
    enableSubAgents: true,
    enableCustomMcp: false,
    enableAnalytics: true,
  },
  webhookUrl: 'https://example.com/webhook',
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  tenantId: 'tenant-123',
  currentConfig: defaultConfig,
}

describe('EditConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render form fields when open', () => {
    render(<EditConfigModal {...defaultProps} />)

    expect(screen.getByText('Edit Configuration')).toBeInTheDocument()
    expect(screen.getByLabelText('Default Model')).toBeInTheDocument()
    expect(screen.getByLabelText('Max Tokens per Request')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Sub-Agents')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Custom MCP')).toBeInTheDocument()
    expect(screen.getByLabelText('Enable Analytics')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<EditConfigModal {...defaultProps} open={false} />)

    expect(screen.queryByText('Edit Configuration')).not.toBeInTheDocument()
  })

  it('should pre-fill form with current config values', () => {
    render(<EditConfigModal {...defaultProps} />)

    expect(screen.getByLabelText('Default Model')).toHaveValue('claude-sonnet-4-5-20250514')
    expect(screen.getByLabelText('Max Tokens per Request')).toHaveValue(4096)
  })

  it('should use defaults when currentConfig is undefined', () => {
    render(<EditConfigModal {...defaultProps} currentConfig={undefined} />)

    expect(screen.getByLabelText('Default Model')).toHaveValue('')
  })

  it('should call API with merged config on successful submit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })

    render(<EditConfigModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/admin/tenants/tenant-123/sdk-config',
        {
          config: expect.objectContaining({
            defaultModel: 'claude-sonnet-4-5-20250514',
            maxTokensPerRequest: 4096,
            webhookUrl: 'https://example.com/webhook',
            features: expect.objectContaining({
              enableSubAgents: true,
              enableCustomMcp: false,
              enableAnalytics: true,
            }),
          }),
        },
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Configuration updated successfully')
    expect(defaultProps.onSuccess).toHaveBeenCalled()
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should preserve existing config fields not in form', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })

    render(<EditConfigModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const call = vi.mocked(apiClient.put).mock.calls[0]
      const config = (call[1] as { config: Record<string, unknown> }).config
      expect(config.webhookUrl).toBe('https://example.com/webhook')
    })
  })

  it('should show error message on API failure', async () => {
    const user = userEvent.setup()
    const apiError = Object.assign(new Error('Server error'), {
      response: { data: { message: 'Invalid configuration' } },
    })
    vi.mocked(apiClient.put).mockRejectedValue(apiError)

    render(<EditConfigModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid configuration')).toBeInTheDocument()
    })

    expect(defaultProps.onSuccess).not.toHaveBeenCalled()
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('should show generic error when API error has no message', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockRejectedValue(new Error('Network error'))

    render(<EditConfigModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to update configuration')).toBeInTheDocument()
    })
  })

  it('should disable save button while submitting', async () => {
    const user = userEvent.setup()
    let resolvePromise: (v: unknown) => void
    vi.mocked(apiClient.put).mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve }),
    )

    render(<EditConfigModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    })

    resolvePromise!({ data: {} })

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled()
    })
  })

  it('should call onClose when cancel button is clicked', async () => {
    const user = userEvent.setup()

    render(<EditConfigModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should reset form values when reopened with new config', () => {
    const { rerender } = render(<EditConfigModal {...defaultProps} />)

    expect(screen.getByLabelText('Default Model')).toHaveValue('claude-sonnet-4-5-20250514')

    rerender(<EditConfigModal {...defaultProps} open={false} />)

    rerender(
      <EditConfigModal
        {...defaultProps}
        open={true}
        currentConfig={{
          defaultModel: 'gpt-4',
          maxTokensPerRequest: 8192,
          features: {
            enableSubAgents: false,
            enableCustomMcp: true,
            enableAnalytics: false,
          },
        }}
      />,
    )

    expect(screen.getByLabelText('Default Model')).toHaveValue('gpt-4')
    expect(screen.getByLabelText('Max Tokens per Request')).toHaveValue(8192)
  })

  it('should allow editing the default model before submitting', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })

    render(<EditConfigModal {...defaultProps} />)

    const modelInput = screen.getByLabelText('Default Model')
    await user.clear(modelInput)
    await user.type(modelInput, 'gpt-4-turbo')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const call = vi.mocked(apiClient.put).mock.calls[0]
      const config = (call[1] as { config: Record<string, unknown> }).config
      expect(config.defaultModel).toBe('gpt-4-turbo')
    })
  })
})

describe('EditConfigModal schema validation', () => {
  const schema = z.object({
    defaultModel: z.string().optional().default(''),
    maxTokensPerRequest: z.coerce.number().int().positive('Must be positive').optional().or(z.literal('')),
    enableSubAgents: z.boolean(),
    enableCustomMcp: z.boolean(),
    enableAnalytics: z.boolean(),
  })

  it('should accept valid values', () => {
    const result = schema.safeParse({
      defaultModel: 'claude-sonnet-4-5-20250514',
      maxTokensPerRequest: 4096,
      enableSubAgents: true,
      enableCustomMcp: false,
      enableAnalytics: true,
    })
    expect(result.success).toBe(true)
  })

  it('should accept empty defaultModel', () => {
    const result = schema.safeParse({
      defaultModel: '',
      enableSubAgents: false,
      enableCustomMcp: false,
      enableAnalytics: false,
    })
    expect(result.success).toBe(true)
  })

  it('should accept empty maxTokensPerRequest', () => {
    const result = schema.safeParse({
      defaultModel: '',
      maxTokensPerRequest: '',
      enableSubAgents: false,
      enableCustomMcp: false,
      enableAnalytics: false,
    })
    expect(result.success).toBe(true)
  })

  it('should require boolean feature flags', () => {
    const result = schema.safeParse({
      defaultModel: '',
      enableSubAgents: 'yes',
      enableCustomMcp: false,
      enableAnalytics: false,
    })
    expect(result.success).toBe(false)
  })
})
