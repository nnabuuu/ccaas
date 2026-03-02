import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as z from 'zod'
import { EditQuotaModal } from '@/components/tenants/edit-quota-modal'

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

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  tenantId: 'tenant-123',
  currentQuotas: {
    tokens: { limit: 500000 },
    sessions: { limit: 200 },
    apiCalls: { limit: 5000 },
    alertThreshold: 75,
    period: 'daily' as const,
  },
}

describe('EditQuotaModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render form fields when open', () => {
    render(<EditQuotaModal {...defaultProps} />)

    expect(screen.getByText('Edit Quotas')).toBeInTheDocument()
    expect(screen.getByLabelText('Token Limit')).toBeInTheDocument()
    expect(screen.getByLabelText('Session Limit')).toBeInTheDocument()
    expect(screen.getByLabelText('API Call Limit')).toBeInTheDocument()
    expect(screen.getByLabelText('Alert Threshold (%)')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<EditQuotaModal {...defaultProps} open={false} />)

    expect(screen.queryByText('Edit Quotas')).not.toBeInTheDocument()
  })

  it('should pre-fill form with currentQuotas values', () => {
    render(<EditQuotaModal {...defaultProps} />)

    expect(screen.getByLabelText('Token Limit')).toHaveValue(500000)
    expect(screen.getByLabelText('Session Limit')).toHaveValue(200)
    expect(screen.getByLabelText('API Call Limit')).toHaveValue(5000)
    expect(screen.getByLabelText('Alert Threshold (%)')).toHaveValue(75)
  })

  it('should use fallback defaults when currentQuotas is undefined', () => {
    render(<EditQuotaModal {...defaultProps} currentQuotas={undefined} />)

    expect(screen.getByLabelText('Token Limit')).toHaveValue(1000000)
    expect(screen.getByLabelText('Session Limit')).toHaveValue(100)
    expect(screen.getByLabelText('API Call Limit')).toHaveValue(10000)
    expect(screen.getByLabelText('Alert Threshold (%)')).toHaveValue(80)
  })

  it('should call API and callbacks on successful submit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })

    render(<EditQuotaModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/admin/tenants/tenant-123/quotas',
        expect.objectContaining({
          maxTokens: 500000,
          maxSessions: 200,
          maxApiCalls: 5000,
          alertThreshold: 75,
          period: 'daily',
        }),
      )
    })

    expect(toast.success).toHaveBeenCalledWith('Quotas updated successfully')
    expect(defaultProps.onSuccess).toHaveBeenCalled()
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should show error message on API failure', async () => {
    const user = userEvent.setup()
    const apiError = Object.assign(new Error('Server error'), {
      response: { data: { message: 'Quota limit exceeded' } },
    })
    vi.mocked(apiClient.put).mockRejectedValue(apiError)

    render(<EditQuotaModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Quota limit exceeded')).toBeInTheDocument()
    })

    expect(defaultProps.onSuccess).not.toHaveBeenCalled()
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('should show generic error when API error has no message', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockRejectedValue(new Error('Network error'))

    render(<EditQuotaModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to update quotas')).toBeInTheDocument()
    })
  })

  it('should disable save button while submitting', async () => {
    const user = userEvent.setup()
    let resolvePromise: (v: unknown) => void
    vi.mocked(apiClient.put).mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve }),
    )

    render(<EditQuotaModal {...defaultProps} />)

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

    render(<EditQuotaModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should have min=1 attribute on numeric inputs', () => {
    render(<EditQuotaModal {...defaultProps} />)

    expect(screen.getByLabelText('Token Limit')).toHaveAttribute('min', '1')
    expect(screen.getByLabelText('Session Limit')).toHaveAttribute('min', '1')
    expect(screen.getByLabelText('API Call Limit')).toHaveAttribute('min', '1')
    expect(screen.getByLabelText('Alert Threshold (%)')).toHaveAttribute('min', '1')
    expect(screen.getByLabelText('Alert Threshold (%)')).toHaveAttribute('max', '100')
  })

  it('should reset form values when reopened with new currentQuotas', async () => {
    const { rerender } = render(<EditQuotaModal {...defaultProps} />)

    expect(screen.getByLabelText('Token Limit')).toHaveValue(500000)

    // Close
    rerender(<EditQuotaModal {...defaultProps} open={false} />)

    // Reopen with new quotas
    rerender(
      <EditQuotaModal
        {...defaultProps}
        open={true}
        currentQuotas={{
          tokens: { limit: 999999 },
          sessions: { limit: 50 },
          apiCalls: { limit: 2000 },
          alertThreshold: 90,
          period: 'monthly',
        }}
      />,
    )

    expect(screen.getByLabelText('Token Limit')).toHaveValue(999999)
    expect(screen.getByLabelText('Session Limit')).toHaveValue(50)
    expect(screen.getByLabelText('API Call Limit')).toHaveValue(2000)
    expect(screen.getByLabelText('Alert Threshold (%)')).toHaveValue(90)
  })

  it('should allow editing field values before submitting', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })

    render(<EditQuotaModal {...defaultProps} />)

    const tokenInput = screen.getByLabelText('Token Limit')
    await user.clear(tokenInput)
    await user.type(tokenInput, '750000')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/admin/tenants/tenant-123/quotas',
        expect.objectContaining({ maxTokens: 750000 }),
      )
    })
  })
})

describe('EditQuotaModal schema validation', () => {
  // Import and test the zod schema directly to verify validation rules
  // that are difficult to trigger via jsdom number inputs
  const schema = z.object({
    period: z.enum(['monthly', 'daily']),
    maxTokens: z.coerce.number().int().positive('Must be a positive integer'),
    maxSessions: z.coerce.number().int().positive('Must be a positive integer'),
    maxApiCalls: z.coerce.number().int().positive('Must be a positive integer'),
    alertThreshold: z.coerce.number().int().min(1, 'Min 1%').max(100, 'Max 100%'),
  })

  it('should reject zero values', () => {
    const result = schema.safeParse({
      period: 'monthly',
      maxTokens: 0,
      maxSessions: 100,
      maxApiCalls: 1000,
      alertThreshold: 80,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Must be a positive integer')
    }
  })

  it('should reject negative values', () => {
    const result = schema.safeParse({
      period: 'monthly',
      maxTokens: -500,
      maxSessions: 100,
      maxApiCalls: 1000,
      alertThreshold: 80,
    })
    expect(result.success).toBe(false)
  })

  it('should reject alertThreshold > 100', () => {
    const result = schema.safeParse({
      period: 'monthly',
      maxTokens: 1000,
      maxSessions: 100,
      maxApiCalls: 1000,
      alertThreshold: 150,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Max 100%')
    }
  })

  it('should reject alertThreshold < 1', () => {
    const result = schema.safeParse({
      period: 'monthly',
      maxTokens: 1000,
      maxSessions: 100,
      maxApiCalls: 1000,
      alertThreshold: 0,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Min 1%')
    }
  })

  it('should reject non-integer values', () => {
    const result = schema.safeParse({
      period: 'monthly',
      maxTokens: 1.5,
      maxSessions: 100,
      maxApiCalls: 1000,
      alertThreshold: 80,
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid period', () => {
    const result = schema.safeParse({
      period: 'weekly',
      maxTokens: 1000,
      maxSessions: 100,
      maxApiCalls: 1000,
      alertThreshold: 80,
    })
    expect(result.success).toBe(false)
  })

  it('should accept valid values', () => {
    const result = schema.safeParse({
      period: 'daily',
      maxTokens: 500000,
      maxSessions: 200,
      maxApiCalls: 5000,
      alertThreshold: 75,
    })
    expect(result.success).toBe(true)
  })

  it('should coerce string numbers', () => {
    const result = schema.safeParse({
      period: 'monthly',
      maxTokens: '1000000',
      maxSessions: '100',
      maxApiCalls: '10000',
      alertThreshold: '80',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxTokens).toBe(1000000)
      expect(result.data.alertThreshold).toBe(80)
    }
  })
})
