import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

vi.mock('@/components/workspace/workspace-explorer', () => ({
  WorkspaceExplorer: () => <div data-testid="workspace-explorer-mock" />,
}))

import { useCustom, useCustomMutation } from '@refinedev/core'

const mockSession = {
  sessionId: 'sess_abc123',
  tenantId: 'tenant_1',
  clientId: 'client_1',
  status: 'idle',
  messageCount: 5,
  createdAt: new Date(Date.now() - 120_000).toISOString(),
  lastActivity: new Date(Date.now() - 30_000).toISOString(),
  hasActiveProcess: false,
  workspaceDir: '/workspace/sess_abc123',
}

const mockTurns = [
  {
    turnId: 'turn-0',
    turnNumber: 0,
    userMessageId: 'msg-user-0',
    assistantMessageId: 'msg-asst-0',
    totalTokens: 1500,
    durationMs: 3000,
    createdAt: new Date(Date.now() - 100_000).toISOString(),
    completedAt: new Date(Date.now() - 97_000).toISOString(),
    toolCount: 2,
    hasThinking: true,
    hasErrors: false,
  },
  {
    turnId: 'turn-1',
    turnNumber: 1,
    userMessageId: 'msg-user-1',
    assistantMessageId: null,
    totalTokens: 800,
    durationMs: 0,
    createdAt: new Date(Date.now() - 50_000).toISOString(),
    completedAt: null,
    toolCount: 0,
    hasThinking: false,
    hasErrors: true,
  },
]

const mockTimelineEvents = [
  {
    id: 'evt-msg-0',
    type: 'message',
    timestamp: new Date(Date.now() - 100_000).toISOString(),
    messageId: 'msg-user-0',
    turnNumber: 0,
    data: { role: 'user', content: 'Hello', messageIndex: 0 },
  },
  {
    id: 'evt-tool-0',
    type: 'tool_event',
    timestamp: new Date(Date.now() - 99_000).toISOString(),
    messageId: 'msg-asst-0',
    turnNumber: 0,
    data: { toolName: 'write_output', phase: 'end', success: true, durationMs: 100 },
  },
  {
    id: 'evt-proc-0',
    type: 'process_event',
    timestamp: new Date(Date.now() - 101_000).toISOString(),
    messageId: null,
    turnNumber: null,
    data: { eventType: 'spawn', pid: 12345 },
  },
  {
    id: 'evt-output-0',
    type: 'output_update',
    timestamp: new Date(Date.now() - 98_000).toISOString(),
    messageId: 'msg-asst-0',
    turnNumber: 0,
    data: { toolName: 'write_output', data: { title: 'Result' }, status: 'success' },
  },
]

/** Captured query params from the last /timeline useCustom call */
let lastTimelineQuery: Record<string, any> = {}

function setupMocks(opts: {
  turns?: typeof mockTurns
  events?: typeof mockTimelineEvents
} = {}) {
  const { turns = [], events = [] } = opts
  lastTimelineQuery = {}

  vi.mocked(useCustomMutation).mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
  } as any)

  vi.mocked(useCustom).mockImplementation(({ url, config }: any) => {
    if (url.includes('/turns')) {
      return { data: { data: turns }, isLoading: false } as any
    }
    if (url.includes('/timeline')) {
      lastTimelineQuery = config?.query ?? {}
      return {
        data: { data: { sessionId: 'sess_abc123', events, totalEvents: events.length } },
        isLoading: false,
        refetch: vi.fn(),
      } as any
    }
    if (url.includes('/queue')) {
      return { data: undefined, isLoading: false } as any
    }
    if (url.includes('/tokens')) {
      return { data: undefined, isLoading: false } as any
    }
    return { data: { data: mockSession }, isLoading: false } as any
  })
}

describe('SessionDetailPage – turns tab', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows "Turns" tab with count when turns exist', () => {
    setupMocks({ turns: mockTurns })
    render(<SessionDetailPage />)
    expect(screen.getByRole('tab', { name: /Turns \(2\)/ })).toBeInTheDocument()
  })

  it('shows "Turns" tab without count when no turns', () => {
    setupMocks({ turns: [] })
    render(<SessionDetailPage />)
    expect(screen.getByRole('tab', { name: /Turns/ })).toBeInTheDocument()
  })

  it('renders turn summaries when Turns tab is clicked', async () => {
    setupMocks({ turns: mockTurns })
    render(<SessionDetailPage />)

    await userEvent.click(screen.getByRole('tab', { name: /Turns/ }))

    expect(screen.getByText('T0')).toBeInTheDocument()
    expect(screen.getByText('T1')).toBeInTheDocument()
  })

  it('shows "In progress" badge for incomplete turns', async () => {
    setupMocks({ turns: mockTurns })
    render(<SessionDetailPage />)

    await userEvent.click(screen.getByRole('tab', { name: /Turns/ }))

    expect(screen.getByText('In progress')).toBeInTheDocument()
  })

  it('shows "No turns recorded" when turns list is empty', async () => {
    setupMocks({ turns: [] })
    render(<SessionDetailPage />)

    await userEvent.click(screen.getByRole('tab', { name: /Turns/ }))

    expect(screen.getByText('No turns recorded')).toBeInTheDocument()
  })
})

describe('SessionDetailPage – timeline turn badges', () => {
  beforeEach(() => vi.clearAllMocks())

  it('displays turn number badges on events that have a turnNumber', () => {
    setupMocks({ turns: mockTurns, events: mockTimelineEvents })
    render(<SessionDetailPage />)

    // Events with turnNumber=0 should show T0 badge
    const t0Badges = screen.getAllByText('T0')
    expect(t0Badges.length).toBeGreaterThan(0)
  })

  it('does not display turn badge on process_event (turnNumber=null)', () => {
    setupMocks({
      events: [
        {
          id: 'evt-proc',
          type: 'process_event',
          timestamp: new Date().toISOString(),
          messageId: null,
          turnNumber: null,
          data: { eventType: 'spawn', pid: 999 },
        },
      ] as any,
    })
    render(<SessionDetailPage />)

    // process_event should render but without a T-badge
    expect(screen.getByText('spawn')).toBeInTheDocument()
    expect(screen.queryByText(/^T\d+$/)).not.toBeInTheDocument()
  })
})

describe('SessionDetailPage – timeline turn filter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows turn filter dropdown when turns exist', () => {
    setupMocks({ turns: mockTurns, events: mockTimelineEvents })
    render(<SessionDetailPage />)

    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByText('All turns')).toBeInTheDocument()
  })

  it('does not show turn filter when no turns', () => {
    setupMocks({ turns: [], events: mockTimelineEvents })
    render(<SessionDetailPage />)

    expect(screen.queryByText('All turns')).not.toBeInTheDocument()
  })

  it('passes turnNumber to timeline query when a turn is selected', async () => {
    setupMocks({ turns: mockTurns, events: mockTimelineEvents })
    render(<SessionDetailPage />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, '0')

    // The mock should have been called with turnNumber
    expect(lastTimelineQuery.turnNumber).toBe(0)
  })

  it('shows Clear button when a turn filter is active', async () => {
    setupMocks({ turns: mockTurns, events: mockTimelineEvents })
    render(<SessionDetailPage />)

    const select = screen.getByRole('combobox')
    await userEvent.selectOptions(select, '1')

    expect(screen.getByText('Clear')).toBeInTheDocument()
  })
})

describe('SessionDetailPage – output_update event rendering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders output_update events with tool name and status', () => {
    setupMocks({
      events: [
        {
          id: 'evt-output',
          type: 'output_update',
          timestamp: new Date().toISOString(),
          messageId: 'msg-1',
          turnNumber: 0,
          data: { toolName: 'write_output', data: { key: 'val' }, status: 'success' },
        },
      ] as any,
    })
    render(<SessionDetailPage />)

    expect(screen.getByText('write_output')).toBeInTheDocument()
    expect(screen.getByText('success')).toBeInTheDocument()
  })
})
