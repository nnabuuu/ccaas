import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSkills } from '../src/hooks/useSkills'
import type { Skill } from '../src/types'

// Mock fetch
const mockSkills: Skill[] = [
  {
    id: '1',
    tenantId: 'test-tenant',
    name: '教学目标生成',
    slug: 'objectives-generator',
    description: '根据课程内容自动生成教学目标',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    tenantId: 'test-tenant',
    name: '教学活动设计',
    slug: 'activities-designer',
    description: '设计多样化的教学活动',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    tenantId: 'test-tenant',
    name: '评估方案生成',
    slug: 'assessment-generator',
    description: '生成形成性和总结性评估方案',
    status: 'draft',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
]

describe('useSkills', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initial state', () => {
    it('should start with loading true', () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)

      const { result } = renderHook(() => useSkills('test-tenant'))

      expect(result.current.loading).toBe(true)
    })

    it('should start with empty skills array', () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)

      const { result } = renderHook(() => useSkills('test-tenant'))

      expect(result.current.skills).toEqual([])
    })

    it('should start with no error', () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response)

      const { result } = renderHook(() => useSkills('test-tenant'))

      expect(result.current.error).toBeNull()
    })
  })

  describe('fetching skills', () => {
    it('should fetch skills from API', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSkills),
      } as Response)

      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(fetch).toHaveBeenCalledWith('/api/v1/skills?tenantId=test-tenant')
      expect(result.current.skills.length).toBe(3)
    })

    it('should set loading to false after fetch', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSkills),
      } as Response)

      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('should handle fetch error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
    })

    it('should handle non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response)

      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })
  })

  describe('search functionality', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSkills),
      } as Response)
    })

    it('should filter skills by name', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setSearchQuery('目标')
      })

      expect(result.current.filteredSkills.length).toBe(1)
      expect(result.current.filteredSkills[0].name).toBe('教学目标生成')
    })

    it('should filter skills by description', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setSearchQuery('多样化')
      })

      expect(result.current.filteredSkills.length).toBe(1)
      expect(result.current.filteredSkills[0].name).toBe('教学活动设计')
    })

    it('should be case insensitive', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setSearchQuery('OBJECTIVES')
      })

      expect(result.current.filteredSkills.length).toBe(1)
    })

    it('should return all skills when search query is empty', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.setSearchQuery('')
      })

      expect(result.current.filteredSkills.length).toBe(3)
    })
  })

  describe('toggle functionality', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSkills),
      } as Response)
    })

    it('should start with no skills enabled', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.enabledSkillIds.size).toBe(0)
    })

    it('should enable skill when toggled', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.toggleSkill('1')
      })

      expect(result.current.enabledSkillIds.has('1')).toBe(true)
    })

    it('should disable skill when toggled again', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.toggleSkill('1')
      })

      expect(result.current.enabledSkillIds.has('1')).toBe(true)

      act(() => {
        result.current.toggleSkill('1')
      })

      expect(result.current.enabledSkillIds.has('1')).toBe(false)
    })

    it('should allow multiple skills to be enabled', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.toggleSkill('1')
        result.current.toggleSkill('2')
      })

      expect(result.current.enabledSkillIds.size).toBe(2)
      expect(result.current.enabledSkillIds.has('1')).toBe(true)
      expect(result.current.enabledSkillIds.has('2')).toBe(true)
    })
  })

  describe('isSkillEnabled', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSkills),
      } as Response)
    })

    it('should return true for enabled skills', async () => {
      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.toggleSkill('1')
      })

      expect(result.current.isSkillEnabled('1')).toBe(true)
      expect(result.current.isSkillEnabled('2')).toBe(false)
    })
  })

  describe('refresh', () => {
    it('should refetch skills when refresh is called', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSkills),
      } as Response)

      const { result } = renderHook(() => useSkills('test-tenant'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(fetch).toHaveBeenCalledTimes(1)

      await act(async () => {
        await result.current.refresh()
      })

      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })
})
