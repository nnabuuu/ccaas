import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAutoSave, useInlineAutoSave } from '../useAutoSave'

// Mock toast module
vi.mock('../../utils/toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

import toast from '../../utils/toast'

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('starts not saving', () => {
      const { saving } = useAutoSave()
      expect(saving.value).toBe(false)
    })

    it('starts without error', () => {
      const { error } = useAutoSave()
      expect(error.value).toBe(null)
    })

    it('starts without lastSaved', () => {
      const { lastSaved } = useAutoSave()
      expect(lastSaved.value).toBe(null)
    })

    it('starts without pending save', () => {
      const { hasPending } = useAutoSave()
      expect(hasPending()).toBe(false)
    })
  })

  describe('save (debounced)', () => {
    it('does not call onSave immediately', () => {
      const onSave = vi.fn()
      const { save } = useAutoSave({ onSave })

      save('test')
      expect(onSave).not.toHaveBeenCalled()
    })

    it('calls onSave after debounce delay', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { save } = useAutoSave({ onSave, debounceMs: 300 })

      save('test')
      vi.advanceTimersByTime(300)
      await vi.runAllTimersAsync()

      expect(onSave).toHaveBeenCalledWith('test')
    })

    it('uses custom debounce delay', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { save } = useAutoSave({ onSave, debounceMs: 500 })

      save('test')
      vi.advanceTimersByTime(300)
      expect(onSave).not.toHaveBeenCalled()

      vi.advanceTimersByTime(200)
      await vi.runAllTimersAsync()
      expect(onSave).toHaveBeenCalled()
    })

    it('resets timer on subsequent calls', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { save } = useAutoSave({ onSave, debounceMs: 300 })

      save('first')
      vi.advanceTimersByTime(200)
      save('second')
      vi.advanceTimersByTime(200)
      expect(onSave).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)
      await vi.runAllTimersAsync()
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith('second')
    })

    it('indicates pending save', () => {
      const { save, hasPending } = useAutoSave({ debounceMs: 300 })

      expect(hasPending()).toBe(false)
      save('test')
      expect(hasPending()).toBe(true)
    })
  })

  describe('saveNow', () => {
    it('saves immediately bypassing debounce', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { saveNow } = useAutoSave({ onSave, debounceMs: 300 })

      await saveNow('test')
      expect(onSave).toHaveBeenCalledWith('test')
    })

    it('cancels pending debounced save', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { save, saveNow } = useAutoSave({ onSave, debounceMs: 300 })

      save('debounced')
      vi.advanceTimersByTime(100)
      await saveNow('immediate')

      vi.advanceTimersByTime(300)
      await vi.runAllTimersAsync()

      expect(onSave).toHaveBeenCalledTimes(1)
      expect(onSave).toHaveBeenCalledWith('immediate')
    })

    it('uses pending value if no value provided', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { save, saveNow } = useAutoSave({ onSave, debounceMs: 300 })

      save('pending value')
      await saveNow()

      expect(onSave).toHaveBeenCalledWith('pending value')
    })

    it('returns true immediately if nothing to save', async () => {
      const onSave = vi.fn()
      const { saveNow } = useAutoSave({ onSave })

      const result = await saveNow()
      expect(result).toBe(true)
      expect(onSave).not.toHaveBeenCalled()
    })
  })

  describe('cancel', () => {
    it('cancels pending debounced save', async () => {
      const onSave = vi.fn()
      const { save, cancel } = useAutoSave({ onSave, debounceMs: 300 })

      save('test')
      cancel()
      vi.advanceTimersByTime(300)
      await vi.runAllTimersAsync()

      expect(onSave).not.toHaveBeenCalled()
    })

    it('clears pending value', () => {
      const { save, cancel, hasPending } = useAutoSave({ debounceMs: 300 })

      save('test')
      expect(hasPending()).toBe(true)
      cancel()
      expect(hasPending()).toBe(false)
    })
  })

  describe('save success', () => {
    it('sets saving state during save', async () => {
      let resolveSave
      const onSave = () => new Promise(resolve => { resolveSave = resolve })
      const { saving, saveNow } = useAutoSave({ onSave })

      const savePromise = saveNow('test')
      expect(saving.value).toBe(true)

      resolveSave()
      await savePromise
      expect(saving.value).toBe(false)
    })

    it('updates lastSaved on success', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { lastSaved, saveNow } = useAutoSave({ onSave })

      expect(lastSaved.value).toBe(null)
      await saveNow('test')
      expect(lastSaved.value).toBeInstanceOf(Date)
    })

    it('clears pending value on success', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { save, hasPending } = useAutoSave({ onSave, debounceMs: 300 })

      save('test')
      vi.advanceTimersByTime(300)
      await vi.runAllTimersAsync()

      expect(hasPending()).toBe(false)
    })

    it('shows success toast when enabled', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { saveNow } = useAutoSave({ onSave, showToast: true, successMessage: '已保存' })

      await saveNow('test')
      expect(toast.success).toHaveBeenCalledWith('已保存', { duration: 2000 })
    })

    it('does not show toast when disabled', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { saveNow } = useAutoSave({ onSave, showToast: false })

      await saveNow('test')
      expect(toast.success).not.toHaveBeenCalled()
    })

    it('returns true on success', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { saveNow } = useAutoSave({ onSave })

      const result = await saveNow('test')
      expect(result).toBe(true)
    })
  })

  describe('save failure', () => {
    it('sets error on failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'))
      const { error, saveNow } = useAutoSave({ onSave })

      await saveNow('test')
      expect(error.value).toBe('Network error')
    })

    it('uses default error message when none provided', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error())
      const { error, saveNow } = useAutoSave({ onSave, errorMessage: '保存失败' })

      await saveNow('test')
      expect(error.value).toBe('保存失败')
    })

    it('shows error toast when enabled', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Failed'))
      const { saveNow } = useAutoSave({ onSave, showToast: true })

      await saveNow('test')
      expect(toast.error).toHaveBeenCalledWith('Failed')
    })

    it('resets saving state on failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Failed'))
      const { saving, saveNow } = useAutoSave({ onSave })

      await saveNow('test')
      expect(saving.value).toBe(false)
    })

    it('returns false on failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Failed'))
      const { saveNow } = useAutoSave({ onSave })

      const result = await saveNow('test')
      expect(result).toBe(false)
    })
  })

  describe('retry', () => {
    it('clears error and executes save', async () => {
      const onSave = vi.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce()
      const { error, saveNow, retry } = useAutoSave({ onSave })

      await saveNow('test')
      expect(error.value).toBe('First fail')

      await retry('test')
      expect(error.value).toBe(null)
    })

    it('calls onSave with provided value', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { retry } = useAutoSave({ onSave })

      await retry('retry value')
      expect(onSave).toHaveBeenCalledWith('retry value')
    })
  })

  describe('clearError', () => {
    it('clears error state', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Error'))
      const { error, saveNow, clearError } = useAutoSave({ onSave })

      await saveNow('test')
      expect(error.value).toBe('Error')

      clearError()
      expect(error.value).toBe(null)
    })
  })
})

describe('useInlineAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('starts in view mode', () => {
      const { isEditing } = useInlineAutoSave()
      expect(isEditing.value).toBe(false)
    })

    it('initializes with provided value', () => {
      const { editValue, originalValue } = useInlineAutoSave({ initialValue: 'test' })
      expect(editValue.value).toBe('test')
      expect(originalValue.value).toBe('test')
    })
  })

  describe('startEdit', () => {
    it('enters edit mode', () => {
      const { isEditing, startEdit } = useInlineAutoSave()
      startEdit()
      expect(isEditing.value).toBe(true)
    })

    it('copies original value to edit value', () => {
      const { editValue, startEdit, setValue } = useInlineAutoSave({ initialValue: 'initial' })
      setValue('updated')
      editValue.value = 'modified'
      startEdit()
      expect(editValue.value).toBe('updated')
    })
  })

  describe('cancel', () => {
    it('exits edit mode and restores value', () => {
      const { isEditing, editValue, startEdit, cancel } = useInlineAutoSave({ initialValue: 'original' })
      startEdit()
      editValue.value = 'changed'
      cancel()
      expect(isEditing.value).toBe(false)
      expect(editValue.value).toBe('original')
    })
  })

  describe('commit', () => {
    it('skips save when unchanged', async () => {
      const onSave = vi.fn()
      const { isEditing, startEdit, commit } = useInlineAutoSave({ initialValue: 'test', onSave })
      startEdit()
      const result = await commit()
      expect(result).toBe(true)
      expect(isEditing.value).toBe(false)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('validates before saving', async () => {
      const onSave = vi.fn()
      const { error, editValue, startEdit, commit } = useInlineAutoSave({
        initialValue: 'old',
        onSave,
        validate: (v) => v.length > 5 ? true : '至少6个字符'
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(error.value).toBe('至少6个字符')
      expect(onSave).not.toHaveBeenCalled()
    })

    it('calls onSave and shows toast on success', async () => {
      const onSave = vi.fn().mockResolvedValue()
      const { editValue, startEdit, commit } = useInlineAutoSave({
        initialValue: 'old',
        onSave,
        showToast: true
      })
      startEdit()
      editValue.value = 'new value'
      await commit()
      expect(onSave).toHaveBeenCalledWith('new value')
      expect(toast.success).toHaveBeenCalledWith('已保存', { duration: 2000 })
    })

    it('sets error and shows toast on failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('保存失败'))
      const { error, editValue, startEdit, commit } = useInlineAutoSave({
        initialValue: 'old',
        onSave,
        showToast: true
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(error.value).toBe('保存失败')
      expect(toast.error).toHaveBeenCalledWith('保存失败')
    })
  })

  describe('setValue', () => {
    it('updates original and edit value when not editing', () => {
      const { originalValue, editValue, setValue } = useInlineAutoSave({ initialValue: 'old' })
      setValue('new')
      expect(originalValue.value).toBe('new')
      expect(editValue.value).toBe('new')
    })

    it('only updates original value when editing', () => {
      const { originalValue, editValue, startEdit, setValue } = useInlineAutoSave({ initialValue: 'old' })
      startEdit()
      editValue.value = 'user input'
      setValue('external update')
      expect(originalValue.value).toBe('external update')
      expect(editValue.value).toBe('user input')
    })
  })

  describe('retry', () => {
    it('clears error and retries commit', async () => {
      const onSave = vi.fn()
        .mockRejectedValueOnce(new Error('First fail'))
        .mockResolvedValueOnce()
      const { error, editValue, startEdit, commit, retry } = useInlineAutoSave({
        initialValue: 'old',
        onSave
      })

      startEdit()
      editValue.value = 'new'
      await commit()
      expect(error.value).toBe('First fail')

      retry()
      await vi.runAllTimersAsync()
      // Error should be cleared when retry starts
    })
  })
})
