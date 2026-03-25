import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as z from 'zod'
import { EditTenantModal } from '@/components/tenants/edit-tenant-modal'

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

const defaultTenant = {
  id: 'tenant-123',
  name: 'Test Tenant',
  description: 'A test tenant',
  plan: 'starter',
  status: 'active',
  billingEmail: 'test@example.com',
  maxSessions: 100,
  maxSkills: 10,
  sessionTtlMs: 1800000,
}

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  tenant: defaultTenant,
}

describe('EditTenantModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render form fields when open', () => {
    render(<EditTenantModal {...defaultProps} />)

    expect(screen.getByText('Edit Tenant')).toBeInTheDocument()
    expect(document.querySelector('#name')).toBeInTheDocument()
    expect(document.querySelector('#description')).toBeInTheDocument()
    expect(document.querySelector('#billingEmail')).toBeInTheDocument()
    expect(document.querySelector('#maxSessions')).toBeInTheDocument()
    expect(document.querySelector('#maxSkills')).toBeInTheDocument()
    expect(document.querySelector('#sessionTtlMs')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<EditTenantModal {...defaultProps} open={false} />)

    expect(screen.queryByText('Edit Tenant')).not.toBeInTheDocument()
  })

  it('should pre-fill form with tenant values', () => {
    render(<EditTenantModal {...defaultProps} />)

    expect(document.querySelector('#name')).toHaveValue('Test Tenant')
    expect(document.querySelector('#description')).toHaveValue('A test tenant')
    expect(document.querySelector('#billingEmail')).toHaveValue('test@example.com')
    expect(document.querySelector('#maxSessions')).toHaveValue(100)
    expect(document.querySelector('#maxSkills')).toHaveValue(10)
    expect(document.querySelector('#sessionTtlMs')).toHaveValue(1800000)
  })

  it('should call API and callbacks on successful submit', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })

    render(<EditTenantModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/admin/tenants/tenant-123',
        expect.objectContaining({
          name: 'Test Tenant',
          description: 'A test tenant',
          plan: 'starter',
          status: 'active',
          billingEmail: 'test@example.com',
          maxSessions: 100,
          maxSkills: 10,
          sessionTtlMs: 1800000,
        }),
      )
    })

    expect(toast.success).toHaveBeenCalled()
    expect(defaultProps.onSuccess).toHaveBeenCalled()
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should show error message on API failure', async () => {
    const user = userEvent.setup()
    const apiError = Object.assign(new Error('Server error'), {
      response: { data: { message: 'Tenant name already exists' } },
    })
    vi.mocked(apiClient.put).mockRejectedValue(apiError)

    render(<EditTenantModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Tenant name already exists')).toBeInTheDocument()
    })

    expect(defaultProps.onSuccess).not.toHaveBeenCalled()
    expect(defaultProps.onClose).not.toHaveBeenCalled()
  })

  it('should show generic error when API error has no message', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockRejectedValue(new Error('Network error'))

    render(<EditTenantModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText('Failed to update tenant')).toBeInTheDocument()
    })
  })

  it('should disable save button while submitting', async () => {
    const user = userEvent.setup()
    let resolvePromise: (v: unknown) => void
    vi.mocked(apiClient.put).mockImplementation(
      () => new Promise((resolve) => { resolvePromise = resolve }),
    )

    render(<EditTenantModal {...defaultProps} />)

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

    render(<EditTenantModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('should have min attributes on numeric inputs', () => {
    render(<EditTenantModal {...defaultProps} />)

    expect(document.querySelector('#maxSessions')).toHaveAttribute('min', '1')
    expect(document.querySelector('#maxSkills')).toHaveAttribute('min', '1')
    expect(document.querySelector('#sessionTtlMs')).toHaveAttribute('min', '60000')
  })

  it('should reset form values when reopened with new tenant data', () => {
    const { rerender } = render(<EditTenantModal {...defaultProps} />)

    expect(document.querySelector('#name')).toHaveValue('Test Tenant')

    rerender(<EditTenantModal {...defaultProps} open={false} />)

    rerender(
      <EditTenantModal
        {...defaultProps}
        open={true}
        tenant={{
          ...defaultTenant,
          name: 'Updated Tenant',
          maxSessions: 500,
        }}
      />,
    )

    expect(document.querySelector('#name')).toHaveValue('Updated Tenant')
    expect(document.querySelector('#maxSessions')).toHaveValue(500)
  })

  it('should allow editing field values before submitting', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.put).mockResolvedValue({ data: {} })

    render(<EditTenantModal {...defaultProps} />)

    const nameInput = document.querySelector('#name') as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'New Name')

    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/admin/tenants/tenant-123',
        expect.objectContaining({ name: 'New Name' }),
      )
    })
  })
})

describe('EditTenantModal schema validation', () => {
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional().default(''),
    plan: z.enum(['free', 'paid', 'starter', 'professional', 'enterprise']),
    status: z.enum(['active', 'suspended', 'pending', 'deleted']),
    billingEmail: z.string().email('Invalid email').or(z.literal('')).optional(),
    maxSessions: z.coerce.number().int().min(1, 'Min 1'),
    maxSkills: z.coerce.number().int().min(1, 'Min 1'),
    sessionTtlMs: z.coerce.number().int().min(60000, 'Min 60 seconds'),
  })

  it('should reject empty name', () => {
    const result = schema.safeParse({
      name: '',
      plan: 'free',
      status: 'active',
      maxSessions: 10,
      maxSkills: 5,
      sessionTtlMs: 60000,
    })
    expect(result.success).toBe(false)
  })

  it('should reject invalid plan', () => {
    const result = schema.safeParse({
      name: 'test',
      plan: 'platinum',
      status: 'active',
      maxSessions: 10,
      maxSkills: 5,
      sessionTtlMs: 60000,
    })
    expect(result.success).toBe(false)
  })

  it('should reject sessionTtlMs below 60000', () => {
    const result = schema.safeParse({
      name: 'test',
      plan: 'free',
      status: 'active',
      maxSessions: 10,
      maxSkills: 5,
      sessionTtlMs: 30000,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Min 60 seconds')
    }
  })

  it('should reject maxSessions below 1', () => {
    const result = schema.safeParse({
      name: 'test',
      plan: 'free',
      status: 'active',
      maxSessions: 0,
      maxSkills: 5,
      sessionTtlMs: 60000,
    })
    expect(result.success).toBe(false)
  })

  it('should accept valid values', () => {
    const result = schema.safeParse({
      name: 'My Tenant',
      plan: 'professional',
      status: 'active',
      billingEmail: 'admin@example.com',
      maxSessions: 100,
      maxSkills: 10,
      sessionTtlMs: 3600000,
    })
    expect(result.success).toBe(true)
  })

  it('should accept empty billingEmail', () => {
    const result = schema.safeParse({
      name: 'My Tenant',
      plan: 'free',
      status: 'active',
      billingEmail: '',
      maxSessions: 10,
      maxSkills: 5,
      sessionTtlMs: 60000,
    })
    expect(result.success).toBe(true)
  })

  it('should coerce string numbers', () => {
    const result = schema.safeParse({
      name: 'test',
      plan: 'free',
      status: 'active',
      maxSessions: '100',
      maxSkills: '10',
      sessionTtlMs: '1800000',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxSessions).toBe(100)
      expect(result.data.sessionTtlMs).toBe(1800000)
    }
  })
})
