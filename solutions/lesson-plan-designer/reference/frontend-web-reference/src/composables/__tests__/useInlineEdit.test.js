import { describe, it, expect, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useInlineEdit, useInlineEditWithModel } from '../useInlineEdit'

describe('useInlineEdit', () => {
  describe('initial state', () => {
    it('starts in view mode', () => {
      const { isEditing } = useInlineEdit()
      expect(isEditing.value).toBe(false)
    })

    it('initializes with provided initial value', () => {
      const { editValue, originalValue } = useInlineEdit({ initialValue: 'test' })
      expect(editValue.value).toBe('test')
      expect(originalValue.value).toBe('test')
    })

    it('initializes with empty string by default', () => {
      const { editValue } = useInlineEdit()
      expect(editValue.value).toBe('')
    })

    it('starts without error', () => {
      const { error } = useInlineEdit()
      expect(error.value).toBe(null)
    })

    it('starts not saving', () => {
      const { saving } = useInlineEdit()
      expect(saving.value).toBe(false)
    })
  })

  describe('startEdit', () => {
    it('enters edit mode', () => {
      const { isEditing, startEdit } = useInlineEdit()
      startEdit()
      expect(isEditing.value).toBe(true)
    })

    it('copies original value to edit value', () => {
      const { editValue, startEdit, setValue } = useInlineEdit({ initialValue: 'initial' })
      setValue('updated')
      editValue.value = 'modified'
      startEdit()
      expect(editValue.value).toBe('updated')
    })

    it('clears any existing error', () => {
      const editor = useInlineEdit({
        initialValue: 'test',
        validate: () => 'Error message'
      })
      editor.startEdit()
      editor.editValue.value = 'changed'
      editor.commit()
      expect(editor.error.value).toBe('Error message')
      editor.startEdit()
      expect(editor.error.value).toBe(null)
    })
  })

  describe('cancel', () => {
    it('exits edit mode', () => {
      const { isEditing, startEdit, cancel } = useInlineEdit()
      startEdit()
      cancel()
      expect(isEditing.value).toBe(false)
    })

    it('restores original value', () => {
      const { editValue, startEdit, cancel } = useInlineEdit({ initialValue: 'original' })
      startEdit()
      editValue.value = 'modified'
      cancel()
      expect(editValue.value).toBe('original')
    })

    it('clears error state', () => {
      const editor = useInlineEdit({
        initialValue: 'test',
        validate: () => 'Error'
      })
      editor.startEdit()
      editor.editValue.value = 'changed'
      editor.commit()
      expect(editor.error.value).toBe('Error')
      editor.cancel()
      expect(editor.error.value).toBe(null)
    })
  })

  describe('commit', () => {
    it('skips save when value unchanged', async () => {
      const onSave = vi.fn()
      const { startEdit, commit } = useInlineEdit({ initialValue: 'test', onSave })
      startEdit()
      const result = await commit()
      expect(result).toBe(true)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('exits edit mode when value unchanged', async () => {
      const { isEditing, startEdit, commit } = useInlineEdit({ initialValue: 'test' })
      startEdit()
      await commit()
      expect(isEditing.value).toBe(false)
    })

    it('calls onSave with new value', async () => {
      const onSave = vi.fn()
      const { editValue, startEdit, commit } = useInlineEdit({ initialValue: 'old', onSave })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(onSave).toHaveBeenCalledWith('new')
    })

    it('applies transform before saving', async () => {
      const onSave = vi.fn()
      const { editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        onSave,
        transform: (v) => v.toUpperCase()
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(onSave).toHaveBeenCalledWith('NEW')
    })

    it('updates original value on success', async () => {
      const { editValue, originalValue, startEdit, commit } = useInlineEdit({ initialValue: 'old' })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(originalValue.value).toBe('new')
    })

    it('exits edit mode on success', async () => {
      const { isEditing, editValue, startEdit, commit } = useInlineEdit({ initialValue: 'old' })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(isEditing.value).toBe(false)
    })

    it('sets saving state during save', async () => {
      let resolveSave
      const onSave = () => new Promise(resolve => { resolveSave = resolve })
      const { saving, editValue, startEdit, commit } = useInlineEdit({ initialValue: 'old', onSave })

      startEdit()
      editValue.value = 'new'
      const commitPromise = commit()

      expect(saving.value).toBe(true)
      resolveSave()
      await commitPromise
      expect(saving.value).toBe(false)
    })

    it('returns false on validation failure', async () => {
      const { editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        validate: () => false
      })
      startEdit()
      editValue.value = 'new'
      const result = await commit()
      expect(result).toBe(false)
    })

    it('sets error on validation failure', async () => {
      const { error, editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        validate: () => '必填项'
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(error.value).toBe('必填项')
    })

    it('uses default error message for non-string validation result', async () => {
      const { error, editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        validate: () => false
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(error.value).toBe('输入无效')
    })

    it('stays in edit mode on validation failure', async () => {
      const { isEditing, editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        validate: () => false
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(isEditing.value).toBe(true)
    })

    it('sets error on save failure', async () => {
      const { error, editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        onSave: () => Promise.reject(new Error('Network error'))
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(error.value).toBe('Network error')
    })

    it('uses default error message on save failure without message', async () => {
      const { error, editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        onSave: () => Promise.reject(new Error())
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(error.value).toBe('保存失败')
    })

    it('returns false on save failure', async () => {
      const { editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        onSave: () => Promise.reject(new Error('Failed'))
      })
      startEdit()
      editValue.value = 'new'
      const result = await commit()
      expect(result).toBe(false)
    })

    it('resets saving state on failure', async () => {
      const { saving, editValue, startEdit, commit } = useInlineEdit({
        initialValue: 'old',
        onSave: () => Promise.reject(new Error('Failed'))
      })
      startEdit()
      editValue.value = 'new'
      await commit()
      expect(saving.value).toBe(false)
    })
  })

  describe('retry', () => {
    it('clears error and calls commit', async () => {
      const onSave = vi.fn().mockRejectedValueOnce(new Error('First fail')).mockResolvedValueOnce()
      const editor = useInlineEdit({ initialValue: 'old', onSave })

      editor.startEdit()
      editor.editValue.value = 'new'
      await editor.commit()
      expect(editor.error.value).toBe('First fail')

      editor.retry()
      await nextTick()
      expect(editor.error.value).toBe(null)
    })
  })

  describe('setValue', () => {
    it('updates original value', () => {
      const { originalValue, setValue } = useInlineEdit({ initialValue: 'old' })
      setValue('new')
      expect(originalValue.value).toBe('new')
    })

    it('updates edit value when not editing', () => {
      const { editValue, setValue } = useInlineEdit({ initialValue: 'old' })
      setValue('new')
      expect(editValue.value).toBe('new')
    })

    it('does not update edit value when editing', () => {
      const { editValue, startEdit, setValue } = useInlineEdit({ initialValue: 'old' })
      startEdit()
      editValue.value = 'user input'
      setValue('external update')
      expect(editValue.value).toBe('user input')
    })
  })

  describe('clearError', () => {
    it('clears error state', async () => {
      const editor = useInlineEdit({
        initialValue: 'old',
        validate: () => 'Error'
      })
      editor.startEdit()
      editor.editValue.value = 'new'
      await editor.commit()
      expect(editor.error.value).toBe('Error')
      editor.clearError()
      expect(editor.error.value).toBe(null)
    })
  })
})

describe('useInlineEditWithModel', () => {
  it('initializes with model value', () => {
    const modelValue = ref('test')
    const { editValue } = useInlineEditWithModel({ modelValue })
    expect(editValue.value).toBe('test')
  })

  it('updates value when model changes', async () => {
    const modelValue = ref('initial')
    const { editValue } = useInlineEditWithModel({ modelValue })

    modelValue.value = 'updated'
    await nextTick()
    expect(editValue.value).toBe('updated')
  })

  it('does not update edit value during editing when model changes', async () => {
    const modelValue = ref('initial')
    const { editValue, startEdit } = useInlineEditWithModel({ modelValue })

    startEdit()
    editValue.value = 'user input'
    modelValue.value = 'external update'
    await nextTick()
    expect(editValue.value).toBe('user input')
  })

  it('handles null modelValue', () => {
    const { editValue } = useInlineEditWithModel({ modelValue: null })
    expect(editValue.value).toBe('')
  })

  it('passes through onSave, validate, transform options', async () => {
    const modelValue = ref('test')
    const onSave = vi.fn()
    const validate = vi.fn().mockReturnValue(true)
    const transform = vi.fn((v) => v.toUpperCase())

    const { editValue, startEdit, commit } = useInlineEditWithModel({
      modelValue,
      onSave,
      validate,
      transform
    })

    startEdit()
    editValue.value = 'new'
    await commit()

    expect(validate).toHaveBeenCalledWith('new')
    expect(transform).toHaveBeenCalledWith('new')
    expect(onSave).toHaveBeenCalledWith('NEW')
  })
})
