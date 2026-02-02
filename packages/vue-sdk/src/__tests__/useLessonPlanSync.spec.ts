/**
 * Tests for useLessonPlanSync composable
 *
 * Tests reactive state management for lesson plan synchronization
 * with AI-generated content via output_update events.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick, reactive } from 'vue'
import { useLessonPlanSync } from '../composables/useLessonPlanSync'
import type { LessonPlan, LessonPlanSyncField } from '@ccaas/common'

describe('useLessonPlanSync', () => {
  const createMockLessonPlan = (): LessonPlan => ({
    id: 'lp-1',
    tenantId: 'tenant-1',
    title: '分数的认识',
    subject: '数学',
    gradeLevel: '三年级',
    duration: '40分钟',
    objectives: [],
    standards: [],
    materials: [],
    activities: [],
    assessment: { formative: [], summative: [] },
    differentiation: { struggling: [], onLevel: [], advanced: [] },
    status: 'draft',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should initialize with provided lesson plan', () => {
      const initialPlan = createMockLessonPlan()
      const { lessonPlan } = useLessonPlanSync({ initialPlan })

      expect(lessonPlan.value.title).toBe('分数的认识')
      expect(lessonPlan.value.subject).toBe('数学')
    })

    it('should have no pending updates initially', () => {
      const { pendingUpdates, hasPendingUpdates } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      expect(pendingUpdates.value).toEqual({})
      expect(hasPendingUpdates.value).toBe(false)
    })

    it('should have no modified fields initially', () => {
      const { modifiedFields } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      expect(modifiedFields.value).toEqual(new Set())
    })
  })

  describe('handleOutputUpdate', () => {
    it('should add update to pending updates', () => {
      const { handleOutputUpdate, pendingUpdates, hasPendingUpdates } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      handleOutputUpdate('title', 'AI生成的标题')

      expect(pendingUpdates.value.title).toBe('AI生成的标题')
      expect(hasPendingUpdates.value).toBe(true)
    })

    it('should handle nested object updates', () => {
      const { handleOutputUpdate, pendingUpdates } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      const newObjectives = [
        { id: 'obj-1', description: '目标1', bloomLevel: 'understand' },
      ]
      handleOutputUpdate('objectives', newObjectives)

      expect(pendingUpdates.value.objectives).toEqual(newObjectives)
    })

    it('should emit onPendingUpdate callback', () => {
      const onPendingUpdate = vi.fn()
      const { handleOutputUpdate } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
        onPendingUpdate,
      })

      handleOutputUpdate('title', 'AI生成的标题')

      expect(onPendingUpdate).toHaveBeenCalledWith('title', 'AI生成的标题')
    })
  })

  describe('applyUpdate', () => {
    it('should apply single field update to lesson plan', async () => {
      const onApply = vi.fn().mockResolvedValue(undefined)
      const { handleOutputUpdate, applyUpdate, lessonPlan, pendingUpdates } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
        onApply,
      })

      handleOutputUpdate('title', 'AI生成的标题')
      await applyUpdate('title')

      expect(lessonPlan.value.title).toBe('AI生成的标题')
      expect(pendingUpdates.value.title).toBeUndefined()
      expect(onApply).toHaveBeenCalledWith('title', 'AI生成的标题')
    })

    it('should mark field as modified after applying', async () => {
      const { handleOutputUpdate, applyUpdate, modifiedFields } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      handleOutputUpdate('title', 'AI生成的标题')
      await applyUpdate('title')

      expect(modifiedFields.value.has('title')).toBe(true)
    })

    it('should allow undo within timeout period', async () => {
      const { handleOutputUpdate, applyUpdate, undoUpdate, lessonPlan, canUndo } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
        undoTimeout: 30000,
      })

      const originalTitle = lessonPlan.value.title
      handleOutputUpdate('title', 'AI生成的标题')
      await applyUpdate('title')

      expect(canUndo.value('title')).toBe(true)

      undoUpdate('title')

      expect(lessonPlan.value.title).toBe(originalTitle)
    })

    it('should not allow undo after timeout expires', async () => {
      const { handleOutputUpdate, applyUpdate, canUndo } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
        undoTimeout: 30000,
      })

      handleOutputUpdate('title', 'AI生成的标题')
      await applyUpdate('title')

      expect(canUndo.value('title')).toBe(true)

      // Fast-forward past the undo timeout
      vi.advanceTimersByTime(31000)

      expect(canUndo.value('title')).toBe(false)
    })
  })

  describe('applyAllUpdates', () => {
    it('should apply all pending updates', async () => {
      const onApply = vi.fn().mockResolvedValue(undefined)
      const { handleOutputUpdate, applyAllUpdates, lessonPlan, hasPendingUpdates } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
        onApply,
      })

      handleOutputUpdate('title', 'AI标题')
      handleOutputUpdate('subject', 'AI学科')

      await applyAllUpdates()

      expect(lessonPlan.value.title).toBe('AI标题')
      expect(lessonPlan.value.subject).toBe('AI学科')
      expect(hasPendingUpdates.value).toBe(false)
      expect(onApply).toHaveBeenCalledTimes(2)
    })
  })

  describe('discardUpdate', () => {
    it('should remove pending update without applying', () => {
      const { handleOutputUpdate, discardUpdate, pendingUpdates, lessonPlan } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      const originalTitle = lessonPlan.value.title
      handleOutputUpdate('title', 'AI生成的标题')
      discardUpdate('title')

      expect(pendingUpdates.value.title).toBeUndefined()
      expect(lessonPlan.value.title).toBe(originalTitle)
    })
  })

  describe('discardAllUpdates', () => {
    it('should remove all pending updates', () => {
      const { handleOutputUpdate, discardAllUpdates, hasPendingUpdates } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      handleOutputUpdate('title', 'AI标题')
      handleOutputUpdate('subject', 'AI学科')

      discardAllUpdates()

      expect(hasPendingUpdates.value).toBe(false)
    })
  })

  describe('resetLessonPlan', () => {
    it('should reset to new lesson plan', () => {
      const { lessonPlan, resetLessonPlan, modifiedFields } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      const newPlan = createMockLessonPlan()
      newPlan.title = '新课程'

      resetLessonPlan(newPlan)

      expect(lessonPlan.value.title).toBe('新课程')
      expect(modifiedFields.value.size).toBe(0)
    })
  })

  describe('field validation', () => {
    it('should reject invalid field names', () => {
      const { handleOutputUpdate, pendingUpdates } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      // Should not add invalid fields
      handleOutputUpdate('invalidField' as LessonPlanSyncField, 'value')

      expect(pendingUpdates.value).not.toHaveProperty('invalidField')
    })

    it('should reject protected fields like id and tenantId', () => {
      const { handleOutputUpdate, lessonPlan } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      const originalId = lessonPlan.value.id
      handleOutputUpdate('id' as LessonPlanSyncField, 'new-id')

      expect(lessonPlan.value.id).toBe(originalId)
    })
  })

  describe('getPendingUpdateForField', () => {
    it('should return pending update for specific field', () => {
      const { handleOutputUpdate, getPendingUpdateForField } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      handleOutputUpdate('title', 'AI生成的标题')

      expect(getPendingUpdateForField('title')).toBe('AI生成的标题')
      expect(getPendingUpdateForField('subject')).toBeUndefined()
    })
  })

  describe('isFieldModified', () => {
    it('should return true for modified fields', async () => {
      const { handleOutputUpdate, applyUpdate, isFieldModified } = useLessonPlanSync({
        initialPlan: createMockLessonPlan(),
      })

      handleOutputUpdate('title', 'AI生成的标题')
      await applyUpdate('title')

      expect(isFieldModified('title')).toBe(true)
      expect(isFieldModified('subject')).toBe(false)
    })
  })
})
