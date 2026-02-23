import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueueMonitorPage } from '@/pages/queue'

const mockRefetch = vi.fn()

vi.mock('@refinedev/core', () => ({
  useCustom: vi.fn(),
}))

// Import after mock declaration so vi.mocked works
import { useCustom } from '@refinedev/core'

function makeStats(pending: number, processing: number, workerCapacity = 5) {
  return {
    data: { data: { pending, processing, workerCapacity } },
    isLoading: false,
    refetch: mockRefetch,
  }
}

describe('QueueMonitorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title', () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(0, 0) as any)
    render(<QueueMonitorPage />)
    expect(screen.getByText('Queue Monitor')).toBeInTheDocument()
  })

  it('shows loading state when data is not yet available', () => {
    vi.mocked(useCustom).mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: mockRefetch,
    } as any)
    render(<QueueMonitorPage />)
    expect(screen.getByText(/loading queue stats/i)).toBeInTheDocument()
  })

  it('renders stat cards with counts from the API', () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(3, 2, 5) as any)
    render(<QueueMonitorPage />)
    // Stat card titles
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('Worker Capacity')).toBeInTheDocument()
    // Unique description texts confirm the right cards rendered
    expect(screen.getByText('Messages waiting to be processed')).toBeInTheDocument()
    expect(screen.getByText('Messages currently being processed')).toBeInTheDocument()
    expect(screen.getByText('Maximum concurrent workers')).toBeInTheDocument()
  })

  it('shows idle message when queue is empty', () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(0, 0) as any)
    render(<QueueMonitorPage />)
    expect(screen.getByText(/queue is idle/i)).toBeInTheDocument()
  })

  it('does not show idle message when queue has activity', () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(2, 1) as any)
    render(<QueueMonitorPage />)
    expect(screen.queryByText(/queue is idle/i)).not.toBeInTheDocument()
  })

  it('shows backlog warning when pending exceeds worker capacity', () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(10, 5, 5) as any)
    render(<QueueMonitorPage />)
    expect(screen.getByText(/queue backlog detected/i)).toBeInTheDocument()
  })

  it('does not show backlog warning when pending is within capacity', () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(3, 2, 5) as any)
    render(<QueueMonitorPage />)
    expect(screen.queryByText(/queue backlog detected/i)).not.toBeInTheDocument()
  })

  it('calls refetch when Refresh button is clicked', async () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(0, 0) as any)
    const user = userEvent.setup()
    render(<QueueMonitorPage />)
    await user.click(screen.getByRole('button', { name: /refresh/i }))
    expect(mockRefetch).toHaveBeenCalledOnce()
  })

  it('disables Refresh button while loading', () => {
    vi.mocked(useCustom).mockReturnValue({
      data: { data: { pending: 0, processing: 0, workerCapacity: 5 } },
      isLoading: true,
      refetch: mockRefetch,
    } as any)
    render(<QueueMonitorPage />)
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled()
  })

  it('renders the utilization bar section', () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(0, 2, 5) as any)
    render(<QueueMonitorPage />)
    expect(screen.getByText('Worker Utilization')).toBeInTheDocument()
  })

  it('renders the About the Queue informational card', () => {
    vi.mocked(useCustom).mockReturnValue(makeStats(0, 0) as any)
    render(<QueueMonitorPage />)
    expect(screen.getByText(/about the queue/i)).toBeInTheDocument()
  })
})
