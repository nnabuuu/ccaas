import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionDetailPage } from '@/pages/sessions/detail'

vi.mock('react-router-dom', () => ({
  useParams: () => ({ sessionId: 'sess_abc123' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@refinedev/core', () => ({
  useCustom: vi.fn(),
  useCustomMutation: vi.fn(),
  HttpError: class HttpError extends Error {},
}))

// Avoid rendering the full workspace explorer (has its own dependencies)
vi.mock('@/components/workspace/workspace-explorer', () => ({
  WorkspaceExplorer: () => <div data-testid="workspace-explorer-mock" />,
}))

import { useCustom, useCustomMutation } from '@refinedev/core'

const mockSession = {
  sessionId: 'sess_abc123',
  tenantId: 'tenant_1',
  clientId: 'client_1',
  status: 'active',
  messageCount: 5,
  createdAt: new Date(Date.now() - 120_000).toISOString(),
  lastActivity: new Date(Date.now() - 30_000).toISOString(),
  hasActiveProcess: false,
  workspaceDir: '/workspace/sess_abc123',
}

const mockTimeline = { sessionId: 'sess_abc123', events: [], totalEvents: 0 }

function setupMocks(queueData: { total: number; pending: number; processing: number } | null) {
  vi.mocked(useCustomMutation).mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
  } as any)

  vi.mocked(useCustom).mockImplementation(({ url }: { url: string }) => {
    if (url.includes('/queue')) {
      return {
        data: queueData ? { data: queueData } : undefined,
        isLoading: false,
      } as any
    }
    if (url.includes('/timeline')) {
      return {
        data: { data: mockTimeline },
        isLoading: false,
        refetch: vi.fn(),
      } as any
    }
    if (url.includes('/tokens')) {
      return { data: undefined, isLoading: false } as any
    }
    // Default: session detail
    return { data: { data: mockSession }, isLoading: false } as any
  })
}

describe('SessionDetailPage – queue status card', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render the queue card when queue data is unavailable', () => {
    setupMocks(null)
    render(<SessionDetailPage />)
    expect(screen.queryByText('Queue Status')).not.toBeInTheDocument()
  })

  it('does not render the queue card when total is 0', () => {
    setupMocks({ total: 0, pending: 0, processing: 0 })
    render(<SessionDetailPage />)
    expect(screen.queryByText('Queue Status')).not.toBeInTheDocument()
  })

  it('renders the queue card when there are active queue items', () => {
    setupMocks({ total: 3, pending: 2, processing: 1 })
    render(<SessionDetailPage />)
    expect(screen.getByText('Queue Status')).toBeInTheDocument()
  })

  it('shows the Pending badge with correct count', () => {
    setupMocks({ total: 3, pending: 2, processing: 1 })
    render(<SessionDetailPage />)
    expect(screen.getByText('Pending:')).toBeInTheDocument()
    // Badge value
    const badges = screen.getAllByText('2')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows the Processing badge with correct count', () => {
    setupMocks({ total: 3, pending: 2, processing: 1 })
    render(<SessionDetailPage />)
    expect(screen.getByText('Processing:')).toBeInTheDocument()
    const badges = screen.getAllByText('1')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows the Total badge with correct count', () => {
    setupMocks({ total: 3, pending: 2, processing: 1 })
    render(<SessionDetailPage />)
    expect(screen.getByText('Total:')).toBeInTheDocument()
    const badges = screen.getAllByText('3')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('renders the queue card when only pending items exist (processing=0)', () => {
    setupMocks({ total: 2, pending: 2, processing: 0 })
    render(<SessionDetailPage />)
    expect(screen.getByText('Queue Status')).toBeInTheDocument()
  })

  it('renders the queue card when only a processing item exists (pending=0)', () => {
    setupMocks({ total: 1, pending: 0, processing: 1 })
    render(<SessionDetailPage />)
    expect(screen.getByText('Queue Status')).toBeInTheDocument()
  })

  it('shows session information card regardless of queue state', () => {
    setupMocks({ total: 0, pending: 0, processing: 0 })
    render(<SessionDetailPage />)
    expect(screen.getByText('Session Information')).toBeInTheDocument()
  })
})
