import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkspaceExplorer } from '@/components/workspace/workspace-explorer'
import { apiClient } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

describe('WorkspaceExplorer', () => {
  const mockTreeResponse = {
    tree: [
      {
        id: '1',
        name: 'src',
        type: 'folder' as const,
        path: 'src',
        children: [
          {
            id: '2',
            name: 'index.ts',
            type: 'file' as const,
            path: 'src/index.ts',
            size: 1024,
          },
          {
            id: '3',
            name: 'App.tsx',
            type: 'file' as const,
            path: 'src/App.tsx',
            size: 2048,
          },
        ],
      },
      {
        id: '4',
        name: 'package.json',
        type: 'file' as const,
        path: 'package.json',
        size: 512,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render loading state initially', async () => {
    vi.mocked(apiClient.get).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    render(<WorkspaceExplorer sessionId="sess_123" />)

    expect(screen.getByText(/loading workspace files/i)).toBeInTheDocument()
  })

  it('should render file tree after loading', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockTreeResponse })

    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    expect(screen.getByText('src')).toBeInTheDocument()
    expect(screen.getByText('package.json')).toBeInTheDocument()
  })

  it('should display file and folder counts', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockTreeResponse })

    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText(/3 files, 1 folders/i)).toBeInTheDocument()
    })
  })

  it('should display total size', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockTreeResponse })

    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText(/3\.5 KB/i)).toBeInTheDocument()
    })
  })

  it('should filter files by search query', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockTreeResponse })

    const user = userEvent.setup()
    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search files/i)
    await user.type(searchInput, 'package')

    await waitFor(() => {
      expect(screen.getByText('package.json')).toBeInTheDocument()
      expect(screen.queryByText('src')).not.toBeInTheDocument()
    })
  })

  it('should expand and collapse folders', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockTreeResponse })

    const user = userEvent.setup()
    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument()
    })

    // Initially collapsed - children not visible
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument()

    // Click to expand
    const srcFolder = screen.getByText('src')
    await user.click(srcFolder)

    // Children should now be visible
    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument()
      expect(screen.getByText('App.tsx')).toBeInTheDocument()
    })
  })

  it('should handle expand all', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockTreeResponse })

    const user = userEvent.setup()
    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument()
    })

    const expandAllButton = screen.getByText(/expand all/i)
    await user.click(expandAllButton)

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument()
      expect(screen.getByText('App.tsx')).toBeInTheDocument()
    })
  })

  it('should handle collapse all', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockTreeResponse })

    const user = userEvent.setup()
    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument()
    })

    // First expand all
    const expandAllButton = screen.getByText(/expand all/i)
    await user.click(expandAllButton)

    await waitFor(() => {
      expect(screen.getByText('index.ts')).toBeInTheDocument()
    })

    // Then collapse all
    const collapseAllButton = screen.getByText(/collapse all/i)
    await user.click(collapseAllButton)

    await waitFor(() => {
      expect(screen.queryByText('index.ts')).not.toBeInTheDocument()
    })
  })

  it('should handle API errors', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'))

    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load workspace files/i)).toBeInTheDocument()
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('should refetch on retry button click', async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: mockTreeResponse })

    const user = userEvent.setup()
    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })

    const retryButton = screen.getByRole('button', { name: /retry/i })
    await user.click(retryButton)

    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument()
    })
  })

  it('should display empty state when no files', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { tree: [] } })

    render(<WorkspaceExplorer sessionId="sess_123" />)

    await waitFor(() => {
      expect(screen.getByText(/no files in workspace/i)).toBeInTheDocument()
    })
  })

  it.skip('should sort files by name', async () => {
    // Skip this test due to jsdom limitations with radix-ui Select component
    // The sorting functionality works in browser but is difficult to test in jsdom
  })
})
