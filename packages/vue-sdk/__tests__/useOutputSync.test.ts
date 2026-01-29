import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useOutputSync } from '../src/composables/useOutputSync'
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
      const sync = useOutputSync({ mode: 'manual' })

      const update: OutputUpdate = {
        field: 'title',
        value: 'New Title',
        preview: 'Updated title',
      }

      sync.handleOutputUpdate(update)

      expect(sync.pendingUpdates.value.size).toBe(1)
      expect(sync.pendingUpdates.value.get('title')).toEqual(update)
    })

    it('should sync pending update to form', () => {
      const sync = useOutputSync<{ title: string }>({ mode: 'manual' })

      const update: OutputUpdate = {
        field: 'title',
        value: 'New Title',
        preview: 'Updated title',
      }

      sync.handleOutputUpdate(update)

      const formData = ref({ title: 'Old Title' })
      sync.syncToForm('title', formData)

      expect(formData.value.title).toBe('New Title')
    })

    it('should mark synced update', () => {
      const sync = useOutputSync<{ title: string }>({ mode: 'manual' })

      sync.handleOutputUpdate({ field: 'title', value: 'New', preview: '' })

      const formData = ref({ title: 'Old' })
      sync.syncToForm('title', formData)

      const update = sync.pendingUpdates.value.get('title')
      expect(update?.synced).toBe(true)
      expect(update?.syncedAt).toBeInstanceOf(Date)
    })

    it('should discard update', () => {
      const sync = useOutputSync({ mode: 'manual' })

      sync.handleOutputUpdate({ field: 'title', value: 'X', preview: '' })
      expect(sync.pendingUpdates.value.size).toBe(1)

      sync.discardUpdate('title')
      expect(sync.pendingUpdates.value.size).toBe(0)
    })
  })

  describe('auto mode', () => {
    it('should still queue updates (for external access)', () => {
      const sync = useOutputSync({ mode: 'auto' })

      sync.handleOutputUpdate({
        field: 'keyKnowledge',
        value: ['algebra'],
        preview: 'Knowledge updated',
      })

      expect(sync.pendingUpdates.value.size).toBe(1)
    })
  })

  describe('undo', () => {
    it('should support undo within timeout', () => {
      const sync = useOutputSync<{ title: string }>({ mode: 'manual', undoTimeout: 30000 })

      sync.handleOutputUpdate({
        field: 'title',
        value: 'New',
        preview: 'title update',
      })

      const formData = ref({ title: 'Old' })
      sync.syncToForm('title', formData)

      expect(formData.value.title).toBe('New')
      expect(sync.canUndo('title')).toBe(true)

      sync.undoSync('title', formData)
      expect(formData.value.title).toBe('Old')
    })

    it('should expire undo after timeout', () => {
      const sync = useOutputSync<{ title: string }>({ mode: 'manual', undoTimeout: 5000 })

      sync.handleOutputUpdate({ field: 'title', value: 'New', preview: '' })

      const formData = ref({ title: 'Old' })
      sync.syncToForm('title', formData)

      expect(sync.canUndo('title')).toBe(true)

      // Advance past timeout
      vi.advanceTimersByTime(6000)

      expect(sync.canUndo('title')).toBe(false)
    })

    it('should remove field from modifiedFields on undo', () => {
      const sync = useOutputSync<{ title: string }>({ mode: 'manual' })

      sync.handleOutputUpdate({ field: 'title', value: 'New', preview: '' })

      const formData = ref({ title: 'Old' })
      sync.syncToForm('title', formData)

      expect(sync.modifiedFields.value.has('title')).toBe(true)

      sync.undoSync('title', formData)
      expect(sync.modifiedFields.value.has('title')).toBe(false)
    })
  })

  describe('normalizeField', () => {
    it('should apply normalizeField function during sync', () => {
      const normalizeField = vi.fn((field: string, value: unknown) => {
        if (field === 'title') return String(value).toUpperCase()
        return value
      })

      const sync = useOutputSync<{ title: string }>({ mode: 'manual', normalizeField })

      sync.handleOutputUpdate({ field: 'title', value: 'hello', preview: '' })

      const formData = ref({ title: '' })
      sync.syncToForm('title', formData)

      expect(normalizeField).toHaveBeenCalledWith('title', 'hello')
      expect(formData.value.title).toBe('HELLO')
    })

    it('should parse JSON strings before normalizing', () => {
      const normalizeField = vi.fn((_field: string, value: unknown) => value)

      const sync = useOutputSync<{ items: string[] }>({ mode: 'manual', normalizeField })

      sync.handleOutputUpdate({
        field: 'items',
        value: '["a", "b"]',
        preview: '',
      })

      const formData = ref({ items: [] as string[] })
      sync.syncToForm('items', formData)

      // Should have parsed JSON string before passing to normalizeField
      expect(normalizeField).toHaveBeenCalledWith('items', ['a', 'b'])
    })
  })

  describe('reset', () => {
    it('should clear all state', () => {
      const sync = useOutputSync({ mode: 'manual' })

      sync.handleOutputUpdate({ field: 'a', value: 1, preview: '' })
      sync.handleOutputUpdate({ field: 'b', value: 2, preview: '' })

      expect(sync.pendingUpdates.value.size).toBe(2)

      sync.reset()

      expect(sync.pendingUpdates.value.size).toBe(0)
      expect(sync.modifiedFields.value.size).toBe(0)
    })
  })

  describe('syncAllToForm', () => {
    it('should sync all pending updates', () => {
      const sync = useOutputSync<{ a: number; b: number }>({ mode: 'manual' })

      sync.handleOutputUpdate({ field: 'a', value: 10, preview: '' })
      sync.handleOutputUpdate({ field: 'b', value: 20, preview: '' })

      const formData = ref({ a: 0, b: 0 })
      sync.syncAllToForm(formData)

      expect(formData.value.a).toBe(10)
      expect(formData.value.b).toBe(20)
    })

    it('should mark all as synced', () => {
      const sync = useOutputSync<{ a: number; b: number }>({ mode: 'manual' })

      sync.handleOutputUpdate({ field: 'a', value: 10, preview: '' })
      sync.handleOutputUpdate({ field: 'b', value: 20, preview: '' })

      const formData = ref({ a: 0, b: 0 })
      sync.syncAllToForm(formData)

      for (const update of sync.pendingUpdates.value.values()) {
        expect(update.synced).toBe(true)
      }
    })
  })
})
