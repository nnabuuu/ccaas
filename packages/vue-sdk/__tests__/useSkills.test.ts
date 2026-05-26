import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useSkills } from '../src/composables/useSkills'

// Mock onMounted to call the callback immediately (no component context needed)
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
  }
})

const mockSkills = [
  {
    id: 'skill-1',
    solutionId: 'tenant-1',
    name: 'Math Helper',
    slug: 'math-helper',
    description: 'Helps with math',
    type: 'custom',
    status: 'active',
    content: 'You are a math helper',
    version: 1,
    enabled: true,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'skill-2',
    solutionId: 'tenant-1',
    name: 'Writing Coach',
    slug: 'writing-coach',
    description: 'Helps with writing',
    type: 'custom',
    status: 'active',
    content: 'You are a writing coach',
    version: 1,
    enabled: false,
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
]

describe('useSkills', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should fetch skills on init', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSkills),
    } as Response)

    const result = useSkills({ serverUrl: 'http://localhost:3001', solutionId: 'tenant-1' })

    // Wait for fetch to resolve
    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    expect(result.skills.value).toHaveLength(2)
    expect(result.error.value).toBeNull()
  })

  it('should handle fetch error', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response)

    const result = useSkills({ serverUrl: 'http://localhost:3001', solutionId: 'tenant-1' })

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    expect(result.skills.value).toHaveLength(0)
    expect(result.error.value).toBe('HTTP 500: Internal Server Error')
  })

  it('should filter skills by search query', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSkills),
    } as Response)

    const result = useSkills({ serverUrl: 'http://localhost:3001', solutionId: 'tenant-1' })

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    expect(result.filteredSkills.value).toHaveLength(2)

    result.searchQuery.value = 'math'
    expect(result.filteredSkills.value).toHaveLength(1)
    expect(result.filteredSkills.value[0].name).toBe('Math Helper')
  })

  it('should compute enabled skill IDs', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSkills),
    } as Response)

    const result = useSkills({ serverUrl: 'http://localhost:3001', solutionId: 'tenant-1' })

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    expect(result.enabledSkillIds.value.size).toBe(1)
    expect(result.enabledSkillIds.value.has('skill-1')).toBe(true)
    expect(result.isSkillEnabled('skill-1')).toBe(true)
    expect(result.isSkillEnabled('skill-2')).toBe(false)
  })

  it('should toggle skill', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSkills),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockSkills[1], enabled: true }),
      } as Response)

    const result = useSkills({ serverUrl: 'http://localhost:3001', solutionId: 'tenant-1' })

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    await result.toggleSkill('skill-2')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith(
      'http://localhost:3001/api/v1/skills/skill-2/toggle',
      expect.objectContaining({ method: 'PATCH' }),
    )
  })

  it('should handle data wrapped in items property', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: mockSkills }),
    } as Response)

    const result = useSkills({ serverUrl: 'http://localhost:3001', solutionId: 'tenant-1' })

    await vi.waitFor(() => {
      expect(result.loading.value).toBe(false)
    })

    expect(result.skills.value).toHaveLength(2)
  })
})
