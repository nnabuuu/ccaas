/**
 * Tests for FormStateSynchronizer service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { reactive } from 'vue'
import {
  FormStateSynchronizer,
  createFormStateSynchronizer,
} from '../services/FormStateSynchronizer'

describe('FormStateSynchronizer', () => {
  let synchronizer: FormStateSynchronizer

  beforeEach(() => {
    synchronizer = createFormStateSynchronizer()
  })

  describe('registerForm', () => {
    it('should register a form', () => {
      const formState = reactive({ title: '', content: '' })
      synchronizer.registerForm('test-form', formState)

      expect(synchronizer.hasForm('test-form')).toBe(true)
    })

    it('should allow getting registered form state', () => {
      const formState = reactive({ title: 'Test', content: 'Content' })
      synchronizer.registerForm('test-form', formState)

      const state = synchronizer.getFormState('test-form')
      expect(state).toEqual({ title: 'Test', content: 'Content' })
    })
  })

  describe('unregisterForm', () => {
    it('should unregister a form', () => {
      const formState = reactive({ title: '' })
      synchronizer.registerForm('test-form', formState)
      synchronizer.unregisterForm('test-form')

      expect(synchronizer.hasForm('test-form')).toBe(false)
    })

    it('should return null for unregistered form state', () => {
      const state = synchronizer.getFormState('non-existent')
      expect(state).toBeNull()
    })
  })

  describe('updateField', () => {
    it('should update a single field', () => {
      const formState = reactive({ title: '', content: '' })
      synchronizer.registerForm('test-form', formState)

      const result = synchronizer.updateField('test-form', 'title', 'New Title', 'agent')

      expect(result).toBe(true)
      expect(formState.title).toBe('New Title')
    })

    it('should return false for non-existent form', () => {
      const result = synchronizer.updateField('non-existent', 'title', 'Value', 'agent')
      expect(result).toBe(false)
    })

    it('should emit update event', () => {
      const formState = reactive({ title: '' })
      synchronizer.registerForm('test-form', formState)

      const handler = vi.fn()
      synchronizer.onFormUpdated(handler)

      synchronizer.updateField('test-form', 'title', 'New Title', 'agent')

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'test-form',
          field: 'title',
          value: 'New Title',
          oldValue: '',
          source: 'agent',
        })
      )
    })

    it('should include timestamp in event', () => {
      const formState = reactive({ title: '' })
      synchronizer.registerForm('test-form', formState)

      const handler = vi.fn()
      synchronizer.onFormUpdated(handler)

      const before = Date.now()
      synchronizer.updateField('test-form', 'title', 'New Title', 'manual')
      const after = Date.now()

      const event = handler.mock.calls[0][0]
      expect(event.timestamp).toBeGreaterThanOrEqual(before)
      expect(event.timestamp).toBeLessThanOrEqual(after)
    })
  })

  describe('updateFields', () => {
    it('should update multiple fields', () => {
      const formState = reactive({ title: '', content: '', author: '' })
      synchronizer.registerForm('test-form', formState)

      const result = synchronizer.updateFields(
        'test-form',
        { title: 'New Title', content: 'New Content' },
        'agent'
      )

      expect(result).toBe(true)
      expect(formState.title).toBe('New Title')
      expect(formState.content).toBe('New Content')
      expect(formState.author).toBe('')
    })

    it('should return false for non-existent form', () => {
      const result = synchronizer.updateFields('non-existent', { title: 'Value' }, 'agent')
      expect(result).toBe(false)
    })

    it('should emit event for each field', () => {
      const formState = reactive({ title: '', content: '' })
      synchronizer.registerForm('test-form', formState)

      const handler = vi.fn()
      synchronizer.onFormUpdated(handler)

      synchronizer.updateFields(
        'test-form',
        { title: 'Title', content: 'Content' },
        'agent'
      )

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('onFormUpdated', () => {
    it('should return unsubscribe function', () => {
      const formState = reactive({ title: '' })
      synchronizer.registerForm('test-form', formState)

      const handler = vi.fn()
      const unsubscribe = synchronizer.onFormUpdated(handler)

      synchronizer.updateField('test-form', 'title', 'First', 'agent')
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      synchronizer.updateField('test-form', 'title', 'Second', 'agent')
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    it('should handle errors in handlers gracefully', () => {
      const formState = reactive({ title: '' })
      synchronizer.registerForm('test-form', formState)

      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })
      const successHandler = vi.fn()

      synchronizer.onFormUpdated(errorHandler)
      synchronizer.onFormUpdated(successHandler)

      // Should not throw, and should call both handlers
      expect(() => {
        synchronizer.updateField('test-form', 'title', 'Value', 'agent')
      }).not.toThrow()

      expect(errorHandler).toHaveBeenCalled()
      expect(successHandler).toHaveBeenCalled()
    })
  })

  describe('onFormUpdatedFor', () => {
    it('should only call handler for specific form', () => {
      const form1 = reactive({ title: '' })
      const form2 = reactive({ title: '' })
      synchronizer.registerForm('form-1', form1)
      synchronizer.registerForm('form-2', form2)

      const handler = vi.fn()
      synchronizer.onFormUpdatedFor('form-1', handler)

      synchronizer.updateField('form-1', 'title', 'Value 1', 'agent')
      synchronizer.updateField('form-2', 'title', 'Value 2', 'agent')

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ formId: 'form-1' })
      )
    })
  })

  describe('getFormStateCopy', () => {
    it('should return shallow copy of form state', () => {
      const formState = reactive({ title: 'Test', nested: { value: 1 } })
      synchronizer.registerForm('test-form', formState)

      const copy = synchronizer.getFormStateCopy('test-form')

      expect(copy).toEqual({ title: 'Test', nested: { value: 1 } })
      expect(copy).not.toBe(formState)
    })

    it('should return null for non-existent form', () => {
      const copy = synchronizer.getFormStateCopy('non-existent')
      expect(copy).toBeNull()
    })
  })

  describe('debug', () => {
    it('should return list of registered forms with fields', () => {
      synchronizer.registerForm('form-1', reactive({ a: '', b: '' }))
      synchronizer.registerForm('form-2', reactive({ x: '', y: '', z: '' }))

      const debug = synchronizer.debug()

      expect(debug).toHaveLength(2)
      expect(debug).toContainEqual({ formId: 'form-1', fields: ['a', 'b'] })
      expect(debug).toContainEqual({ formId: 'form-2', fields: ['x', 'y', 'z'] })
    })
  })

  describe('clear', () => {
    it('should clear all forms and handlers', () => {
      const formState = reactive({ title: '' })
      synchronizer.registerForm('test-form', formState)

      const handler = vi.fn()
      synchronizer.onFormUpdated(handler)

      synchronizer.clear()

      expect(synchronizer.hasForm('test-form')).toBe(false)
      expect(synchronizer.debug()).toHaveLength(0)
    })
  })
})
