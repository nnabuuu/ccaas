import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContextSync } from '../useContextSync'
import type { LessonPlan } from '../../types'

// Mock fetch
global.fetch = vi.fn()

describe('useContextSync', () => {
  const mockSessionId = 'lpd_test-session-id'
  const mockLessonPlan: LessonPlan = {
    id: 'test-plan-1',
    title: 'Test Plan',
    subject: 'math',
    gradeLevel: 3,
    durationMinutes: 45,
    objectives: 'Test objectives',
    content: 'Test content',
    teachingMethods: 'Test methods',
    materialsNeeded: 'Test materials',
    assessmentMethods: 'Test assessment',
    lessonPlanCode: 'TEST-001',
    publisher: '人教版',
    volume: '上册',
    chapterId: 1,
    chapterTitle: 'Chapter 1',
    curriculumRequirements: [],
    studentAnalysis: 'Test analysis',
    extraProperties: {},
    status: 'DRAFT',
    attachments: [],
    createBy: 'test-user',
    createTime: new Date().toISOString(),
    updateBy: 'test-user',
    updateTime: new Date().toISOString(),
    deleted: 0,
    remark: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('syncContext', () => {
    it('should sync context successfully', async () => {
      const mockResponse = { ok: true }
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response)

      const { result } = renderHook(() =>
        useContextSync({ sessionId: mockSessionId, enabled: true })
      )

      act(() => {
        result.current.syncContext(mockLessonPlan)
      })

      // Fast-forward debounce timer and flush promises
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(fetch).toHaveBeenCalledWith(
        `/api/v1/sessions/${mockSessionId}/context`,
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining(mockLessonPlan.id),
        })
      )
    })

    it('should not sync if plan is null', async () => {
      const { result } = renderHook(() =>
        useContextSync({ sessionId: mockSessionId, enabled: true })
      )

      act(() => {
        result.current.syncContext(null)
      })

      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      expect(fetch).not.toHaveBeenCalled()
    })

    it('should not sync if disabled', async () => {
      const { result } = renderHook(() =>
        useContextSync({ sessionId: mockSessionId, enabled: false })
      )

      act(() => {
        result.current.syncContext(mockLessonPlan)
      })

      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      expect(fetch).not.toHaveBeenCalled()
    })

    it('should debounce multiple calls', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

      const { result } = renderHook(() =>
        useContextSync({ sessionId: mockSessionId, enabled: true, debounceMs: 500 })
      )

      // Call sync 3 times rapidly
      act(() => {
        result.current.syncContext(mockLessonPlan)
        result.current.syncContext(mockLessonPlan)
        result.current.syncContext(mockLessonPlan)
      })

      // Fast-forward debounce timer and flush promises
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      // Should only call fetch once (debounced)
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should handle sync error', async () => {
      const mockError = new Error('Network error')
      vi.mocked(fetch).mockRejectedValue(mockError)

      const onError = vi.fn()
      const { result } = renderHook(() =>
        useContextSync({ sessionId: mockSessionId, enabled: true, onError })
      )

      act(() => {
        result.current.syncContext(mockLessonPlan)
      })

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(onError).toHaveBeenCalledWith('Context 同步失败: Network error')
    })

    it('should handle HTTP error response', async () => {
      const mockResponse = { ok: false, status: 500 }
      vi.mocked(fetch).mockResolvedValue(mockResponse as Response)

      const onError = vi.fn()
      const { result } = renderHook(() =>
        useContextSync({ sessionId: mockSessionId, enabled: true, onError })
      )

      act(() => {
        result.current.syncContext(mockLessonPlan)
      })

      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(onError).toHaveBeenCalledWith('Context 同步失败: HTTP 500')
    })

    it('should use custom debounce time', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

      const { result } = renderHook(() =>
        useContextSync({ sessionId: mockSessionId, enabled: true, debounceMs: 1000 })
      )

      act(() => {
        result.current.syncContext(mockLessonPlan)
      })

      // Fast-forward 500ms (not enough)
      await act(async () => {
        vi.advanceTimersByTime(500)
      })
      expect(fetch).not.toHaveBeenCalled()

      // Fast-forward another 500ms (total 1000ms) and flush promises
      await act(async () => {
        await vi.runAllTimersAsync()
      })

      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanup', () => {
    it('should clear timeout on unmount', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

      const { result, unmount } = renderHook(() =>
        useContextSync({ sessionId: mockSessionId, enabled: true })
      )

      act(() => {
        result.current.syncContext(mockLessonPlan)
      })

      // Unmount before debounce completes
      unmount()

      // Fast-forward time
      await act(async () => {
        vi.advanceTimersByTime(500)
      })

      // Should not have called fetch because component unmounted
      expect(fetch).not.toHaveBeenCalled()
    })
  })
})
