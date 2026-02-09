import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSolutionConfig } from '../useSolutionConfig'
import { api } from '../../utils/api'

// Mock API
vi.mock('../../utils/api', () => ({
  api: {
    getSolutionConfig: vi.fn(),
  },
}))

describe('useSolutionConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should load solution config on mount', async () => {
    const mockConfig = {
      mcpServers: { 'test-server': { command: 'test', args: [] } },
      skillPath: '/test/skills',
      skillSlug: null,
    }
    vi.mocked(api.getSolutionConfig).mockResolvedValue(mockConfig)

    const { result } = renderHook(() => useSolutionConfig())

    // Initially loading
    expect(result.current.loading).toBe(true)
    expect(result.current.config).toBe(null)
    expect(result.current.error).toBe(null)

    // Wait for config to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.config).toEqual(mockConfig)
    expect(result.current.error).toBe(null)
    expect(api.getSolutionConfig).toHaveBeenCalledTimes(1)
  })

  it('should handle config loading error', async () => {
    const mockError = new Error('Failed to fetch config')
    vi.mocked(api.getSolutionConfig).mockRejectedValue(mockError)

    const { result } = renderHook(() => useSolutionConfig())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.config).toBe(null)
    expect(result.current.error).toBe('加载配置失败: Failed to fetch config')
  })

  it('should only load config once', async () => {
    const mockConfig = { mcpServers: {}, skillPath: null, skillSlug: null }
    vi.mocked(api.getSolutionConfig).mockResolvedValue(mockConfig)

    const { rerender } = renderHook(() => useSolutionConfig())

    await waitFor(() => {
      expect(api.getSolutionConfig).toHaveBeenCalledTimes(1)
    })

    // Rerender should not trigger another load
    rerender()

    expect(api.getSolutionConfig).toHaveBeenCalledTimes(1)
  })
})
