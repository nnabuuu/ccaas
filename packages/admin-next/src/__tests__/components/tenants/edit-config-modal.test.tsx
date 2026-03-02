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
    eventPersistence: {
      enabled: true,
      excludeTypes: ['text_delta'],
    },
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
    expect(screen.getByText('Event Persistence')).toBeInTheDocument()
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
              eventPersistence: {
                enabled: true,
                excludeTypes: ['text_delta'],
              },
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

  it('should render event persistence sub-toggles when master toggle is on', () => {
    render(<EditConfigModal {...defaultProps} />)

    expect(screen.getByLabelText('text_delta')).toBeInTheDocument()
    expect(screen.getByLabelText('thinking')).toBeInTheDocument()
    expect(screen.getByLabelText('tool events')).toBeInTheDocument()
    expect(screen.getByLabelText('exploration')).toBeInTheDocument()
  })

  it('should hide sub-toggles when event persistence master toggle is off', async () => {
    const user = userEvent.setup()
    render(
      <EditConfigModal
        {...defaultProps}
        currentConfig={{
          ...defaultConfig,
          features: {
            ...defaultConfig.features,
            eventPersistence: { enabled: false, excludeTypes: [] },
          },
        }}
      />,
    )

    expect(screen.queryByLabelText('text_delta')).not.toBeInTheDocument()

    // Toggle on
    await user.click(screen.getByLabelText('Event Persistence'))

    expect(screen.getByLabelText('text_delta')).toBeInTheDocument()
  })

  it('should show text_delta warning when its toggle is on', async () => {
    const user = userEvent.setup()
    render(<EditConfigModal {...defaultProps} />)

    // text_delta is off by default (excluded), no warning
    expect(screen.queryByText(/High volume/)).not.toBeInTheDocument()

    // Enable text_delta
    await user.click(screen.getByLabelText('text_delta'))

    expect(screen.getByText(/High volume/)).toBeInTheDocument()
  })

  it('should construct excludeTypes correctly from toggle states', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })

    // Config with everything persisted (no excludes)
    render(
      <EditConfigModal
        {...defaultProps}
        currentConfig={{
          ...defaultConfig,
          features: {
            ...defaultConfig.features,
            eventPersistence: { enabled: true, excludeTypes: [] },
          },
        }}
      />,
    )

    // Turn off thinking and tool events
    await user.click(screen.getByLabelText('thinking'))
    await user.click(screen.getByLabelText('tool events'))

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const call = vi.mocked(apiClient.put).mock.calls[0]
      const config = (call[1] as { config: Record<string, unknown> }).config
      const features = config.features as { eventPersistence: { excludeTypes: string[] } }
      expect(features.eventPersistence.excludeTypes).toEqual(
        expect.arrayContaining(['thinking_start', 'thinking_delta', 'thinking_end', 'tool_start', 'tool_end']),
      )
      expect(features.eventPersistence.excludeTypes).not.toContain('text_delta')
      expect(features.eventPersistence.excludeTypes).not.toContain('exploration_activity')
    })
  })

  it('should preserve event persistence config on modal reopen', () => {
    const configWithEp = {
      ...defaultConfig,
      features: {
        ...defaultConfig.features,
        eventPersistence: {
          enabled: true,
          excludeTypes: ['text_delta', 'exploration_activity'],
        },
      },
    }

    const { rerender } = render(
      <EditConfigModal {...defaultProps} currentConfig={configWithEp} />,
    )

    // text_delta excluded → toggle off
    expect(screen.getByLabelText('text_delta')).not.toBeChecked()
    // exploration excluded → toggle off
    expect(screen.getByLabelText('exploration')).not.toBeChecked()
    // thinking not excluded → toggle on
    expect(screen.getByLabelText('thinking')).toBeChecked()

    // Close and reopen
    rerender(<EditConfigModal {...defaultProps} open={false} currentConfig={configWithEp} />)
    rerender(<EditConfigModal {...defaultProps} open={true} currentConfig={configWithEp} />)

    expect(screen.getByLabelText('text_delta')).not.toBeChecked()
    expect(screen.getByLabelText('exploration')).not.toBeChecked()
    expect(screen.getByLabelText('thinking')).toBeChecked()
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
    eventPersistenceEnabled: z.boolean(),
    persistTextDelta: z.boolean(),
    persistThinking: z.boolean(),
    persistToolEvents: z.boolean(),
    persistExploration: z.boolean(),
  })

  it('should accept valid values', () => {
    const result = schema.safeParse({
      defaultModel: 'claude-sonnet-4-5-20250514',
      maxTokensPerRequest: 4096,
      enableSubAgents: true,
      enableCustomMcp: false,
      enableAnalytics: true,
      eventPersistenceEnabled: true,
      persistTextDelta: false,
      persistThinking: true,
      persistToolEvents: true,
      persistExploration: true,
    })
    expect(result.success).toBe(true)
  })

  it('should accept empty defaultModel', () => {
    const result = schema.safeParse({
      defaultModel: '',
      enableSubAgents: false,
      enableCustomMcp: false,
      enableAnalytics: false,
      eventPersistenceEnabled: false,
      persistTextDelta: false,
      persistThinking: false,
      persistToolEvents: false,
      persistExploration: false,
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
      eventPersistenceEnabled: true,
      persistTextDelta: true,
      persistThinking: true,
      persistToolEvents: true,
      persistExploration: true,
    })
    expect(result.success).toBe(true)
  })

  it('should require boolean feature flags', () => {
    const result = schema.safeParse({
      defaultModel: '',
      enableSubAgents: 'yes',
      enableCustomMcp: false,
      enableAnalytics: false,
      eventPersistenceEnabled: true,
      persistTextDelta: false,
      persistThinking: true,
      persistToolEvents: true,
      persistExploration: true,
    })
    expect(result.success).toBe(false)
  })
})
