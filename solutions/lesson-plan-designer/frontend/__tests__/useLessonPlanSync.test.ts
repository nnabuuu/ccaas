import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLessonPlanSync } from '../src/hooks/useLessonPlanSync'
import type { LessonPlan, OutputUpdate } from '../src/types'

// Mock lesson plan for testing
function createMockLessonPlan(): LessonPlan {
  return {
    id: 'test-id',
    tenantId: 'test-tenant',
    title: 'Original Title',
    subject: '数学',
    gradeLevel: '三年级',
    duration: '1课时',
    objectives: [],
    standards: [],
    materials: [],
    activities: [],
    assessment: { formative: [], summative: [] },
    differentiation: { struggling: [], onLevel: [], advanced: [] },
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe('useLessonPlanSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('pendingUpdates', () => {
    it('should start with empty pending updates', () => {
      const { result } = renderHook(() => useLessonPlanSync())
      expect(result.current.pendingUpdates.size).toBe(0)
    })

    it('should add pending update', () => {
      const { result } = renderHook(() => useLessonPlanSync())

      const update: OutputUpdate = {
        field: 'title',
        value: 'New Title',
        preview: 'New Title Preview',
      }

      act(() => {
        result.current.addPendingUpdate(update)
      })

      expect(result.current.pendingUpdates.size).toBe(1)
      expect(result.current.pendingUpdates.get('title')).toEqual(update)
    })

    it('should remove pending update', () => {
      const { result } = renderHook(() => useLessonPlanSync())

      act(() => {
        result.current.addPendingUpdate({
          field: 'title',
          value: 'New Title',
          preview: 'Preview',
        })
      })

      expect(result.current.pendingUpdates.size).toBe(1)

      act(() => {
        result.current.removePendingUpdate('title')
      })

      expect(result.current.pendingUpdates.size).toBe(0)
    })
  })

  describe('syncToForm', () => {
    it('should sync pending update to form', () => {
      const { result } = renderHook(() => useLessonPlanSync())
      const mockPlan = createMockLessonPlan()
      let updatedPlan: LessonPlan | null = null
      const setLessonPlan = vi.fn((plan: LessonPlan) => { updatedPlan = plan })

      // Add pending update
      act(() => {
        result.current.addPendingUpdate({
          field: 'title',
          value: 'New Title',
          preview: 'Preview',
        })
      })

      // Sync to form
      act(() => {
        result.current.syncToForm('title', mockPlan, setLessonPlan)
      })

      expect(setLessonPlan).toHaveBeenCalled()
      expect(updatedPlan?.title).toBe('New Title')
      expect(result.current.modifiedFields.has('title')).toBe(true)
      expect(result.current.pendingUpdates.has('title')).toBe(false)
    })

    it('should add to undo stack after sync', () => {
      const { result } = renderHook(() => useLessonPlanSync())
      const mockPlan = createMockLessonPlan()
      const setLessonPlan = vi.fn()

      act(() => {
        result.current.addPendingUpdate({
          field: 'title',
          value: 'New Title',
          preview: 'Preview',
        })
      })

      act(() => {
        result.current.syncToForm('title', mockPlan, setLessonPlan)
      })

      expect(result.current.undoStack.length).toBe(1)
      expect(result.current.undoStack[0].field).toBe('title')
      expect(result.current.undoStack[0].previousValue).toBe('Original Title')
    })
  })

  describe('undoSync', () => {
    it('should undo sync and restore previous value', () => {
      const { result } = renderHook(() => useLessonPlanSync())
      const mockPlan = createMockLessonPlan()
      let currentPlan = { ...mockPlan }
      const setLessonPlan = vi.fn((plan: LessonPlan) => { currentPlan = plan })

      // Add and sync
      act(() => {
        result.current.addPendingUpdate({
          field: 'title',
          value: 'New Title',
          preview: 'Preview',
        })
      })

      act(() => {
        result.current.syncToForm('title', mockPlan, setLessonPlan)
      })

      // setLessonPlan was called with the new title
      expect(setLessonPlan).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: 'New Title' })
      )

      // Update currentPlan to simulate state update
      currentPlan = { ...mockPlan, title: 'New Title' }

      // Undo
      act(() => {
        result.current.undoSync('title', currentPlan, setLessonPlan)
      })

      // Should restore original title
      expect(setLessonPlan).toHaveBeenLastCalledWith(
        expect.objectContaining({ title: 'Original Title' })
      )
      expect(result.current.modifiedFields.has('title')).toBe(false)
      expect(result.current.undoStack.length).toBe(0)
    })
  })

  describe('canUndo', () => {
    it('should return true within timeout period', () => {
      const { result } = renderHook(() => useLessonPlanSync())
      const mockPlan = createMockLessonPlan()
      const setLessonPlan = vi.fn()

      act(() => {
        result.current.addPendingUpdate({
          field: 'title',
          value: 'New Title',
          preview: 'Preview',
        })
      })

      act(() => {
        result.current.syncToForm('title', mockPlan, setLessonPlan)
      })

      expect(result.current.canUndo('title')).toBe(true)
    })

    it('should return false after timeout', () => {
      const { result } = renderHook(() => useLessonPlanSync())
      const mockPlan = createMockLessonPlan()
      const setLessonPlan = vi.fn()

      act(() => {
        result.current.addPendingUpdate({
          field: 'title',
          value: 'New Title',
          preview: 'Preview',
        })
      })

      act(() => {
        result.current.syncToForm('title', mockPlan, setLessonPlan)
      })

      // Advance time past the 30 second timeout
      act(() => {
        vi.advanceTimersByTime(31000)
      })

      expect(result.current.canUndo('title')).toBe(false)
    })
  })

  describe('resetSyncState', () => {
    it('should clear all state', () => {
      const { result } = renderHook(() => useLessonPlanSync())
      const mockPlan = createMockLessonPlan()
      const setLessonPlan = vi.fn()

      // Add pending update
      act(() => {
        result.current.addPendingUpdate({
          field: 'subject',
          value: '语文',
          preview: 'Preview',
        })
      })

      // Add and sync a different field
      act(() => {
        result.current.addPendingUpdate({
          field: 'title',
          value: 'New Title',
          preview: 'Preview',
        })
      })

      act(() => {
        result.current.syncToForm('title', mockPlan, setLessonPlan)
      })

      expect(result.current.pendingUpdates.size).toBe(1) // subject only
      expect(result.current.modifiedFields.size).toBe(1)
      expect(result.current.undoStack.length).toBe(1)

      // Reset
      act(() => {
        result.current.resetSyncState()
      })

      expect(result.current.pendingUpdates.size).toBe(0)
      expect(result.current.modifiedFields.size).toBe(0)
      expect(result.current.undoStack.length).toBe(0)
    })
  })
})
