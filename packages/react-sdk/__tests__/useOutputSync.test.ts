import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOutputSync } from '../src/hooks/useOutputSync'
import type { OutputUpdate } from '../src/types'

describe('useOutputSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('manual mode', () => {
    it('should queue updates in pendingUpdates', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'manual' }),
      )

      const update: OutputUpdate = {
        field: 'title',
        value: 'New Title',
        preview: 'Updated title',
      }

      act(() => {
        result.current.handleOutputUpdate(update)
      })

      expect(result.current.pendingUpdates.size).toBe(1)
      expect(result.current.pendingUpdates.get('title')).toEqual(update)
    })

    it('should sync pending update to form', () => {
      const { result } = renderHook(() =>
        useOutputSync<{ title: string }>({ mode: 'manual' }),
      )

      const update: OutputUpdate = {
        field: 'title',
        value: 'New Title',
        preview: 'Updated title',
      }

      act(() => {
        result.current.handleOutputUpdate(update)
      })

      const data = { title: 'Old Title' }
      const setData = vi.fn()

      act(() => {
        result.current.syncToForm('title', data, setData)
      })

      expect(setData).toHaveBeenCalledWith(expect.any(Function))
      // Verify the setter function produces correct result
      const setterFn = setData.mock.calls[0][0]
      const newData = setterFn({ title: 'Old Title' })
      expect(newData.title).toBe('New Title')
    })

    it('should discard update', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'manual' }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'title', value: 'X', preview: '' })
      })

      expect(result.current.pendingUpdates.size).toBe(1)

      act(() => {
        result.current.discardUpdate('title')
      })

      expect(result.current.pendingUpdates.size).toBe(0)
    })
  })

  describe('auto mode', () => {
    it('should still queue updates (for external access)', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'auto' }),
      )

      act(() => {
        result.current.handleOutputUpdate({
          field: 'keyKnowledge',
          value: ['algebra'],
          preview: 'Knowledge updated',
        })
      })

      expect(result.current.pendingUpdates.size).toBe(1)
    })
  })

  describe('undo', () => {
    it('should support undo within timeout', () => {
      const { result } = renderHook(() =>
        useOutputSync<{ title: string }>({ mode: 'manual', undoTimeout: 30000 }),
      )

      act(() => {
        result.current.handleOutputUpdate({
          field: 'title',
          value: 'New',
          preview: 'title update',
        })
      })

      const data = { title: 'Old' }
      const setData = vi.fn()

      act(() => {
        result.current.syncToForm('title', data, setData)
      })

      expect(result.current.canUndo('title')).toBe(true)

      act(() => {
        result.current.undoSync('title', { title: 'New' }, setData)
      })

      // Should have called setData to restore
      expect(setData).toHaveBeenCalledTimes(2) // once for sync, once for undo
    })

    it('should expire undo after timeout', () => {
      const { result } = renderHook(() =>
        useOutputSync<{ title: string }>({ mode: 'manual', undoTimeout: 5000 }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'title', value: 'New', preview: '' })
      })

      const setData = vi.fn()
      act(() => {
        result.current.syncToForm('title', { title: 'Old' }, setData)
      })

      expect(result.current.canUndo('title')).toBe(true)

      // Advance past timeout
      act(() => {
        vi.advanceTimersByTime(6000)
      })

      expect(result.current.canUndo('title')).toBe(false)
    })
  })

  describe('normalizeField', () => {
    it('should apply normalizeField function during sync', () => {
      const normalizeField = vi.fn((field: string, value: unknown) => {
        if (field === 'title') return String(value).toUpperCase()
        return value
      })

      const { result } = renderHook(() =>
        useOutputSync<{ title: string }>({ mode: 'manual', normalizeField }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'title', value: 'hello', preview: '' })
      })

      const setData = vi.fn()
      act(() => {
        result.current.syncToForm('title', { title: '' }, setData)
      })

      expect(normalizeField).toHaveBeenCalledWith('title', 'hello')
      const setterFn = setData.mock.calls[0][0]
      const newData = setterFn({ title: '' })
      expect(newData.title).toBe('HELLO')
    })

    it('should parse JSON strings before normalizing', () => {
      const normalizeField = vi.fn((_field: string, value: unknown) => value)

      const { result } = renderHook(() =>
        useOutputSync<{ items: string[] }>({ mode: 'manual', normalizeField }),
      )

      act(() => {
        result.current.handleOutputUpdate({
          field: 'items',
          value: '["a", "b"]',
          preview: '',
        })
      })

      const setData = vi.fn()
      act(() => {
        result.current.syncToForm('items', { items: [] }, setData)
      })

      // Should have parsed JSON string before passing to normalizeField
      expect(normalizeField).toHaveBeenCalledWith('items', ['a', 'b'])
    })
  })

  describe('reset', () => {
    it('should clear all state', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'manual' }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'a', value: 1, preview: '' })
        result.current.handleOutputUpdate({ field: 'b', value: 2, preview: '' })
      })

      expect(result.current.pendingUpdates.size).toBe(2)

      act(() => {
        result.current.reset()
      })

      expect(result.current.pendingUpdates.size).toBe(0)
      expect(result.current.modifiedFields.size).toBe(0)
    })
  })

  describe('syncAllToForm', () => {
    it('should sync all pending updates', () => {
      const { result } = renderHook(() =>
        useOutputSync<{ a: number; b: number }>({ mode: 'manual' }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'a', value: 10, preview: '' })
        result.current.handleOutputUpdate({ field: 'b', value: 20, preview: '' })
      })

      const setData = vi.fn()
      act(() => {
        result.current.syncAllToForm({ a: 0, b: 0 }, setData)
      })

      // setData called for each field + once for marking synced
      expect(setData).toHaveBeenCalled()
    })
  })

  describe('page grouping', () => {
    it('should group updates by page in pendingUpdatesByPage', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'manual' }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'title', value: 'T', preview: '', page: 'patientInfo' })
        result.current.handleOutputUpdate({ field: 'exercises', value: [], preview: '', page: 'exercisePlan' })
        result.current.handleOutputUpdate({ field: 'frequency', value: '3x/week', preview: '' }) // no page
      })

      expect(result.current.pendingUpdatesByPage.size).toBe(3)
      expect(result.current.pendingUpdatesByPage.has('patientInfo')).toBe(true)
      expect(result.current.pendingUpdatesByPage.has('exercisePlan')).toBe(true)
      expect(result.current.pendingUpdatesByPage.has('__default__')).toBe(true)
      expect(result.current.pendingUpdatesByPage.get('patientInfo')?.has('title')).toBe(true)
      expect(result.current.pendingUpdatesByPage.get('exercisePlan')?.has('exercises')).toBe(true)
    })

    it('getPendingUpdatesForPage should return correct subset', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'manual' }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'title', value: 'T', preview: '', page: 'patientInfo' })
        result.current.handleOutputUpdate({ field: 'subtitle', value: 'S', preview: '', page: 'patientInfo' })
        result.current.handleOutputUpdate({ field: 'exercises', value: [], preview: '', page: 'exercisePlan' })
      })

      const patientInfoUpdates = result.current.getPendingUpdatesForPage('patientInfo')
      expect(patientInfoUpdates.size).toBe(2)
      expect(patientInfoUpdates.has('title')).toBe(true)
      expect(patientInfoUpdates.has('subtitle')).toBe(true)
      expect(patientInfoUpdates.has('exercises')).toBe(false)

      const exercisePlanUpdates = result.current.getPendingUpdatesForPage('exercisePlan')
      expect(exercisePlanUpdates.size).toBe(1)
      expect(exercisePlanUpdates.has('exercises')).toBe(true)
    })

    it('getPendingUpdatesForPage(undefined) returns __default__ updates', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'manual' }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'frequency', value: '3x', preview: '' }) // no page
        result.current.handleOutputUpdate({ field: 'exercises', value: [], preview: '', page: 'plan' })
      })

      const defaultUpdates = result.current.getPendingUpdatesForPage()
      expect(defaultUpdates.size).toBe(1)
      expect(defaultUpdates.has('frequency')).toBe(true)
    })

    it('getPendingUpdatesForPage returns empty Map for unknown page', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'manual' }),
      )

      const updates = result.current.getPendingUpdatesForPage('nonexistent')
      expect(updates.size).toBe(0)
    })

    it('pendingUpdatesByPage stays in sync after reset', () => {
      const { result } = renderHook(() =>
        useOutputSync({ mode: 'manual' }),
      )

      act(() => {
        result.current.handleOutputUpdate({ field: 'title', value: 'T', preview: '', page: 'p1' })
      })

      expect(result.current.pendingUpdatesByPage.size).toBe(1)

      act(() => {
        result.current.reset()
      })

      expect(result.current.pendingUpdatesByPage.size).toBe(0)
    })
  })
})
