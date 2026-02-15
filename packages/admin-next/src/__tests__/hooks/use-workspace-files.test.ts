import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useWorkspaceFiles } from '@/hooks/use-workspace-files'
import { apiClient } from '@/lib/api-client'
import type { WorkspaceTreeResponse } from '@/types/workspace'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

describe('useWorkspaceFiles', () => {
  const mockResponse: WorkspaceTreeResponse = {
    tree: [
      {
        id: '1',
        name: 'src',
        type: 'folder',
        path: 'src',
        children: [
          { id: '2', name: 'index.ts', type: 'file', path: 'src/index.ts', size: 1024 },
        ],
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch workspace files on mount', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse })

    const { result } = renderHook(() =>
      useWorkspaceFiles({ sessionId: 'sess_123', enabled: true })
    )

    expect(result.current.loading).toBe(true)
    expect(result.current.tree).toEqual([])

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(apiClient.get).toHaveBeenCalledWith('/admin/sessions/sess_123/workspace')
    expect(result.current.tree).toEqual(mockResponse.tree)
    expect(result.current.error).toBeNull()
  })

  it('should not fetch when enabled is false', async () => {
    const { result } = renderHook(() =>
      useWorkspaceFiles({ sessionId: 'sess_123', enabled: false })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(apiClient.get).not.toHaveBeenCalled()
    expect(result.current.tree).toEqual([])
  })

  it('should handle API errors', async () => {
    const error = new Error('Failed to load workspace')
    vi.mocked(apiClient.get).mockRejectedValue(error)

    const { result } = renderHook(() =>
      useWorkspaceFiles({ sessionId: 'sess_123', enabled: true })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toEqual(error)
    expect(result.current.tree).toEqual([])
  })

  it('should refetch when refetch is called', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockResponse })

    const { result } = renderHook(() =>
      useWorkspaceFiles({ sessionId: 'sess_123', enabled: true })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(apiClient.get).toHaveBeenCalledTimes(1)

    // Call refetch
    result.current.refetch()

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle empty tree response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { tree: [] } })

    const { result } = renderHook(() =>
      useWorkspaceFiles({ sessionId: 'sess_123', enabled: true })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.tree).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('should handle missing tree in response', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} })

    const { result } = renderHook(() =>
      useWorkspaceFiles({ sessionId: 'sess_123', enabled: true })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.tree).toEqual([])
  })
})
