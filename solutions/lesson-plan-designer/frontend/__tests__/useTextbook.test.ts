import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useTextbook } from '../src/hooks/useTextbook'
import type { TextbookSubject, TextbookGrade, TextbookPublisher, TextbookVolume, TextbookChapter } from '../src/types'

// Mock data
const mockSubjects: TextbookSubject[] = [
  { id: 'math', label: '数学' },
  { id: 'chinese', label: '语文' },
  { id: 'english', label: '英语' },
]

const mockGrades: TextbookGrade[] = [
  { id: 1, label: '一年级', stage: '义务教育阶段第一学段' },
  { id: 2, label: '二年级', stage: '义务教育阶段第一学段' },
  { id: 3, label: '三年级', stage: '义务教育阶段第二学段' },
]

const mockPublishers: TextbookPublisher[] = [
  { id: 'pep', label: '人教版' },
  { id: 'bsd', label: '北师大版' },
]

const mockVolumes: TextbookVolume[] = [
  { id: 'vol1', label: '上册' },
  { id: 'vol2', label: '下册' },
]

const mockChapters: TextbookChapter[] = [
  {
    id: 1,
    title: '第一单元 时、分、秒',
    children: [
      { id: 11, title: '秒的认识' },
      { id: 12, title: '时间的计算' },
    ],
  },
  {
    id: 2,
    title: '第二单元 万以内的加法和减法',
    children: [
      { id: 21, title: '两位数加两位数' },
    ],
  },
]

describe('useTextbook', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initial state', () => {
    it('should start with loading subjects', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSubjects),
      } as Response)

      const { result } = renderHook(() => useTextbook())

      expect(result.current.loadingSubjects).toBe(true)

      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })
    })

    it('should start with empty selections', () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSubjects),
      } as Response)

      const { result } = renderHook(() => useTextbook())

      expect(result.current.selectedSubject).toBe('')
      expect(result.current.selectedGradeId).toBeNull()
      expect(result.current.selectedPublisher).toBe('')
      expect(result.current.selectedVolume).toBe('')
      expect(result.current.selectedChapterId).toBeNull()
      expect(result.current.selectedChapterTitle).toBe('')
    })

    it('should have no error initially', () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSubjects),
      } as Response)

      const { result } = renderHook(() => useTextbook())

      expect(result.current.error).toBeNull()
    })
  })

  describe('fetching subjects', () => {
    it('should fetch subjects on mount', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSubjects),
      } as Response)

      const { result } = renderHook(() => useTextbook())

      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/textbook/subjects'))
      expect(result.current.subjects).toEqual(mockSubjects)
    })

    it('should handle fetch error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useTextbook())

      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
    })
  })

  describe('cascading selection - subject to grades', () => {
    it('should fetch grades when subject is selected', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSubjects),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGrades),
        } as Response)

      const { result } = renderHook(() => useTextbook())

      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })

      act(() => {
        result.current.setSelectedSubject('math')
      })

      await waitFor(() => {
        expect(result.current.loadingGrades).toBe(false)
      })

      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/textbook/grades?subject=math')
      )
      expect(result.current.grades).toEqual(mockGrades)
    })

    it('should clear downstream data when subject changes', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSubjects),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGrades),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPublishers),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        } as Response)

      const { result } = renderHook(() => useTextbook())

      // Wait for subjects
      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })

      // Select subject
      act(() => {
        result.current.setSelectedSubject('math')
      })

      await waitFor(() => {
        expect(result.current.grades.length).toBeGreaterThan(0)
      })

      // Select grade
      act(() => {
        result.current.setSelectedGradeId(3)
      })

      await waitFor(() => {
        expect(result.current.publishers.length).toBeGreaterThan(0)
      })

      // Change subject - should clear grade, publisher, volume, chapter
      act(() => {
        result.current.setSelectedSubject('chinese')
      })

      expect(result.current.selectedGradeId).toBeNull()
      expect(result.current.selectedPublisher).toBe('')
      expect(result.current.selectedVolume).toBe('')
      expect(result.current.selectedChapterId).toBeNull()
      expect(result.current.grades).toEqual([])
      expect(result.current.publishers).toEqual([])
      expect(result.current.volumes).toEqual([])
      expect(result.current.chapters).toEqual([])
    })
  })

  describe('cascading selection - grade to publishers', () => {
    it('should fetch publishers when grade is selected', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSubjects),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGrades),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPublishers),
        } as Response)

      const { result } = renderHook(() => useTextbook())

      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })

      act(() => {
        result.current.setSelectedSubject('math')
      })

      await waitFor(() => {
        expect(result.current.loadingGrades).toBe(false)
      })

      act(() => {
        result.current.setSelectedGradeId(3)
      })

      await waitFor(() => {
        expect(result.current.loadingPublishers).toBe(false)
      })

      // Verify publishers were fetched
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/textbook/publishers?subject=math&gradeId=3')
      )
      expect(result.current.publishers).toEqual(mockPublishers)
      // Auto-select should have selected the first publisher
      expect(result.current.selectedPublisher).toBe(mockPublishers[0].label)
    })
  })

  describe('cascading selection - full flow', () => {
    it('should auto-select and fetch chapters through cascade', async () => {
      // With auto-selection, the flow is:
      // 1. subjects (on mount)
      // 2. grades (after subject selected)
      // 3. publishers (after grade selected) -> auto-selects first publisher
      // 4. volumes (auto-triggered by publisher auto-select) -> auto-selects first volume
      // 5. chapters (auto-triggered by volume auto-select)
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSubjects),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGrades),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPublishers),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVolumes),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockChapters),
        } as Response)

      const { result } = renderHook(() => useTextbook())

      // Wait for subjects
      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })

      // Select subject
      act(() => {
        result.current.setSelectedSubject('math')
      })

      await waitFor(() => {
        expect(result.current.grades.length).toBeGreaterThan(0)
      })

      // Select grade - this triggers auto-selection cascade
      act(() => {
        result.current.setSelectedGradeId(3)
      })

      // Wait for the full cascade to complete (publishers -> volumes -> chapters)
      await waitFor(() => {
        expect(result.current.chapters.length).toBeGreaterThan(0)
      }, { timeout: 3000 })

      // Verify auto-selections happened
      expect(result.current.selectedPublisher).toBe(mockPublishers[0].label)
      expect(result.current.selectedVolume).toBe(mockVolumes[0].label)
      expect(result.current.chapters).toEqual(mockChapters)
    })
  })

  describe('chapter selection', () => {
    it('should set selected chapter', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSubjects),
      } as Response)

      const { result } = renderHook(() => useTextbook())

      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })

      act(() => {
        result.current.setSelectedChapter(11, '秒的认识')
      })

      expect(result.current.selectedChapterId).toBe(11)
      expect(result.current.selectedChapterTitle).toBe('秒的认识')
    })
  })

  describe('reset', () => {
    it('should reset all selections and data', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockSubjects),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGrades),
        } as Response)

      const { result } = renderHook(() => useTextbook())

      await waitFor(() => {
        expect(result.current.loadingSubjects).toBe(false)
      })

      // Make some selections
      act(() => {
        result.current.setSelectedSubject('math')
      })

      await waitFor(() => {
        expect(result.current.grades.length).toBeGreaterThan(0)
      })

      act(() => {
        result.current.setSelectedChapter(11, '秒的认识')
      })

      // Reset
      act(() => {
        result.current.reset()
      })

      expect(result.current.selectedSubject).toBe('')
      expect(result.current.selectedGradeId).toBeNull()
      expect(result.current.selectedPublisher).toBe('')
      expect(result.current.selectedVolume).toBe('')
      expect(result.current.selectedChapterId).toBeNull()
      expect(result.current.selectedChapterTitle).toBe('')
      expect(result.current.grades).toEqual([])
      expect(result.current.publishers).toEqual([])
      expect(result.current.volumes).toEqual([])
      expect(result.current.chapters).toEqual([])
    })
  })
})
