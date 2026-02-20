import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSectionEditor } from '../src/hooks/useSectionEditor'

describe('useSectionEditor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should start with no sections in editing mode', () => {
      const { result } = renderHook(() => useSectionEditor())

      expect(result.current.editingSections.size).toBe(0)
    })

    it('should start with no sections saving', () => {
      const { result } = renderHook(() => useSectionEditor())

      expect(result.current.isEditing('basic')).toBe(false)
      expect(result.current.isSaving('basic')).toBe(false)
    })
  })

  describe('startEdit', () => {
    it('should add section to editing set', () => {
      const { result } = renderHook(() => useSectionEditor())

      act(() => {
        result.current.startEdit('objectives')
      })

      expect(result.current.isEditing('objectives')).toBe(true)
      expect(result.current.editingSections.has('objectives')).toBe(true)
    })

    it('should allow multiple sections to be edited simultaneously', () => {
      const { result } = renderHook(() => useSectionEditor())

      act(() => {
        result.current.startEdit('objectives')
        result.current.startEdit('activities')
      })

      expect(result.current.isEditing('objectives')).toBe(true)
      expect(result.current.isEditing('activities')).toBe(true)
      expect(result.current.editingSections.size).toBe(2)
    })
  })

  describe('cancelEdit', () => {
    it('should remove section from editing set', () => {
      const { result } = renderHook(() => useSectionEditor())

      act(() => {
        result.current.startEdit('objectives')
      })

      expect(result.current.isEditing('objectives')).toBe(true)

      act(() => {
        result.current.cancelEdit('objectives')
      })

      expect(result.current.isEditing('objectives')).toBe(false)
    })

    it('should not affect other sections being edited', () => {
      const { result } = renderHook(() => useSectionEditor())

      act(() => {
        result.current.startEdit('objectives')
        result.current.startEdit('activities')
      })

      act(() => {
        result.current.cancelEdit('objectives')
      })

      expect(result.current.isEditing('objectives')).toBe(false)
      expect(result.current.isEditing('activities')).toBe(true)
    })
  })

  describe('saveEdit', () => {
    it('should set saving state during save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const { result } = renderHook(() => useSectionEditor({ onSave }))

      act(() => {
        result.current.startEdit('objectives')
      })

      // Start save but don't await
      let savePromise: Promise<void>
      act(() => {
        savePromise = result.current.saveEdit('objectives')
      })

      // Should be saving
      expect(result.current.isSaving('objectives')).toBe(true)

      // Wait for save to complete
      await act(async () => {
        await savePromise
      })

      // Should no longer be saving or editing
      expect(result.current.isSaving('objectives')).toBe(false)
      expect(result.current.isEditing('objectives')).toBe(false)
    })

    it('should call onSave callback with section id', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const { result } = renderHook(() => useSectionEditor({ onSave }))

      act(() => {
        result.current.startEdit('objectives')
      })

      await act(async () => {
        await result.current.saveEdit('objectives')
      })

      expect(onSave).toHaveBeenCalledWith('objectives')
    })

    it('should remove section from editing set after successful save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined)
      const { result } = renderHook(() => useSectionEditor({ onSave }))

      act(() => {
        result.current.startEdit('objectives')
      })

      await act(async () => {
        await result.current.saveEdit('objectives')
      })

      expect(result.current.isEditing('objectives')).toBe(false)
    })

    it('should keep section in editing mode on save failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Save failed'))
      const { result } = renderHook(() => useSectionEditor({ onSave }))

      act(() => {
        result.current.startEdit('objectives')
      })

      await act(async () => {
        try {
          await result.current.saveEdit('objectives')
        } catch {
          // Expected to throw
        }
      })

      expect(result.current.isEditing('objectives')).toBe(true)
      expect(result.current.isSaving('objectives')).toBe(false)
    })
  })

  describe('isEditing', () => {
    it('should return true for sections being edited', () => {
      const { result } = renderHook(() => useSectionEditor())

      act(() => {
        result.current.startEdit('basic')
      })

      expect(result.current.isEditing('basic')).toBe(true)
      expect(result.current.isEditing('objectives')).toBe(false)
    })
  })

  describe('isSaving', () => {
    it('should return true only during save operation', async () => {
      let resolvePromise: () => void
      const onSave = vi.fn().mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolvePromise = resolve
        })
      })

      const { result } = renderHook(() => useSectionEditor({ onSave }))

      act(() => {
        result.current.startEdit('basic')
      })

      // Start save
      let savePromise: Promise<void>
      act(() => {
        savePromise = result.current.saveEdit('basic')
      })

      expect(result.current.isSaving('basic')).toBe(true)

      // Complete save
      await act(async () => {
        resolvePromise!()
        await savePromise
      })

      expect(result.current.isSaving('basic')).toBe(false)
    })
  })

  describe('getEditingCount', () => {
    it('should return correct count of sections being edited', () => {
      const { result } = renderHook(() => useSectionEditor())

      expect(result.current.getEditingCount()).toBe(0)

      act(() => {
        result.current.startEdit('basic')
      })

      expect(result.current.getEditingCount()).toBe(1)

      act(() => {
        result.current.startEdit('objectives')
        result.current.startEdit('activities')
      })

      expect(result.current.getEditingCount()).toBe(3)
    })
  })

  describe('cancelAllEdits', () => {
    it('should cancel all sections being edited', () => {
      const { result } = renderHook(() => useSectionEditor())

      act(() => {
        result.current.startEdit('basic')
        result.current.startEdit('objectives')
        result.current.startEdit('activities')
      })

      expect(result.current.getEditingCount()).toBe(3)

      act(() => {
        result.current.cancelAllEdits()
      })

      expect(result.current.getEditingCount()).toBe(0)
    })
  })
})
