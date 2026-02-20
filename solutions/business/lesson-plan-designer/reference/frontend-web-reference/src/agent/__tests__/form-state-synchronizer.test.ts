/**
 * FormStateSynchronizer Tests
 *
 * Tests the core synchronization behavior:
 * 1. Form registration/unregistration
 * 2. Field updates from different sources
 * 3. Event emission and subscription
 * 4. Vue reactivity compatibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { reactive, watch, nextTick } from 'vue'
import { FormStateSynchronizer } from '../form-state-synchronizer'

describe('FormStateSynchronizer', () => {
  let synchronizer: FormStateSynchronizer

  beforeEach(() => {
    synchronizer = new FormStateSynchronizer()
  })

  describe('Form Registration', () => {
    it('should register a form', () => {
      const state = { field1: 'value1' }
      synchronizer.registerForm('test-form', state)

      expect(synchronizer.hasForm('test-form')).toBe(true)
    })

    it('should unregister a form', () => {
      const state = { field1: 'value1' }
      synchronizer.registerForm('test-form', state)
      synchronizer.unregisterForm('test-form')

      expect(synchronizer.hasForm('test-form')).toBe(false)
    })

    it('should return null for unregistered form state', () => {
      expect(synchronizer.getFormState('nonexistent')).toBeNull()
    })
  })

  describe('Field Updates', () => {
    it('should update a single field', () => {
      const state = { chapterId: null as number | null }
      synchronizer.registerForm('test-form', state)

      const result = synchronizer.updateField('test-form', 'chapterId', 245, 'a2ui')

      expect(result).toBe(true)
      expect(state.chapterId).toBe(245)
    })

    it('should update multiple fields', () => {
      const state = { chapterId: null as number | null, chapterName: null as string | null }
      synchronizer.registerForm('test-form', state)

      const result = synchronizer.updateFields('test-form', {
        chapterId: 245,
        chapterName: '小数乘法'
      }, 'a2ui')

      expect(result).toBe(true)
      expect(state.chapterId).toBe(245)
      expect(state.chapterName).toBe('小数乘法')
    })

    it('should return false for unregistered form', () => {
      const result = synchronizer.updateField('nonexistent', 'field', 'value', 'manual')
      expect(result).toBe(false)
    })

    it('should track update source', () => {
      const state = { field: '' }
      synchronizer.registerForm('test-form', state)

      const events: { source: string }[] = []
      synchronizer.onFormUpdated((event) => events.push({ source: event.source }))

      synchronizer.updateField('test-form', 'field', 'v1', 'manual')
      synchronizer.updateField('test-form', 'field', 'v2', 'a2ui')
      synchronizer.updateField('test-form', 'field', 'v3', 'agent')

      expect(events).toEqual([
        { source: 'manual' },
        { source: 'a2ui' },
        { source: 'agent' },
      ])
    })
  })

  describe('Event Subscription', () => {
    it('should emit events on field update', () => {
      const state = { chapterId: null }
      synchronizer.registerForm('test-form', state)

      const events: { field: string; value: unknown }[] = []
      synchronizer.onFormUpdated((event) => {
        events.push({ field: event.field, value: event.value })
      })

      synchronizer.updateField('test-form', 'chapterId', 245, 'a2ui')

      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({ field: 'chapterId', value: 245 })
    })

    it('should allow unsubscribe', () => {
      const state = { field: '' }
      synchronizer.registerForm('test-form', state)

      const events: unknown[] = []
      const unsubscribe = synchronizer.onFormUpdated((event) => events.push(event))

      synchronizer.updateField('test-form', 'field', 'v1', 'manual')
      unsubscribe()
      synchronizer.updateField('test-form', 'field', 'v2', 'manual')

      expect(events).toHaveLength(1)
    })

    it('should filter events by form ID', () => {
      const state1 = { field: '' }
      const state2 = { field: '' }
      synchronizer.registerForm('form-1', state1)
      synchronizer.registerForm('form-2', state2)

      const events: string[] = []
      synchronizer.onFormUpdatedFor('form-1', () => events.push('form-1'))

      synchronizer.updateField('form-1', 'field', 'v1', 'manual')
      synchronizer.updateField('form-2', 'field', 'v2', 'manual')
      synchronizer.updateField('form-1', 'field', 'v3', 'manual')

      expect(events).toEqual(['form-1', 'form-1'])
    })
  })

  describe('Vue Reactivity Integration', () => {
    it('should trigger Vue reactive updates', async () => {
      const state = reactive({
        chapterId: null as number | null,
        chapterName: null as string | null,
      })
      synchronizer.registerForm('test-form', state)

      // Set up watcher
      const watchedValues: (number | null)[] = []
      watch(
        () => state.chapterId,
        (newVal) => watchedValues.push(newVal),
        { immediate: false }
      )

      // Update via synchronizer
      synchronizer.updateField('test-form', 'chapterId', 245, 'a2ui')
      await nextTick()

      expect(watchedValues).toEqual([245])
      expect(state.chapterId).toBe(245)
    })

    it('should work with bulk updates on reactive state', async () => {
      const state = reactive({
        subject: '数学',
        gradeLevel: 5,
        chapterId: null as number | null,
        chapterName: null as string | null,
      })
      synchronizer.registerForm('lesson-plan-create', state)

      // Update multiple fields
      synchronizer.updateFields('lesson-plan-create', {
        chapterId: 245,
        chapterName: '小数乘法',
      }, 'a2ui')
      await nextTick()

      expect(state.chapterId).toBe(245)
      expect(state.chapterName).toBe('小数乘法')
      expect(state.subject).toBe('数学') // Unchanged
    })
  })

  describe('Three Input Paths Convergence', () => {
    it('should produce identical state from manual, a2ui, and agent sources', async () => {
      // Simulate 3 different forms to test each path
      const manualState = reactive({ chapterId: null, chapterName: null })
      const a2uiState = reactive({ chapterId: null, chapterName: null })
      const agentState = reactive({ chapterId: null, chapterName: null })

      synchronizer.registerForm('manual-form', manualState)
      synchronizer.registerForm('a2ui-form', a2uiState)
      synchronizer.registerForm('agent-form', agentState)

      // Path 1: Manual dialog selection
      synchronizer.updateFields('manual-form', {
        chapterId: 245,
        chapterName: '小数乘法',
      }, 'manual')

      // Path 2: A2UI pick list click
      synchronizer.updateFields('a2ui-form', {
        chapterId: 245,
        chapterName: '小数乘法',
      }, 'a2ui')

      // Path 3: Agent text input + apply_form_data
      synchronizer.updateFields('agent-form', {
        chapterId: 245,
        chapterName: '小数乘法',
      }, 'agent')

      await nextTick()

      // All three should have identical state
      expect(manualState).toEqual({ chapterId: 245, chapterName: '小数乘法' })
      expect(a2uiState).toEqual({ chapterId: 245, chapterName: '小数乘法' })
      expect(agentState).toEqual({ chapterId: 245, chapterName: '小数乘法' })
    })
  })

  describe('Debug Utilities', () => {
    it('should list all registered forms', () => {
      synchronizer.registerForm('form-1', { a: 1, b: 2 })
      synchronizer.registerForm('form-2', { x: 'y' })

      const debug = synchronizer.debug()

      expect(debug).toHaveLength(2)
      expect(debug).toContainEqual({ formId: 'form-1', fields: ['a', 'b'] })
      expect(debug).toContainEqual({ formId: 'form-2', fields: ['x'] })
    })

    it('should return shallow copy of form state', () => {
      const original = { field: 'value', nested: { a: 1 } }
      synchronizer.registerForm('test', original)

      const copy = synchronizer.getFormStateCopy('test')

      expect(copy).toEqual(original)
      expect(copy).not.toBe(original) // Different reference
    })
  })
})
