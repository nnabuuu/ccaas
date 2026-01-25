/**
 * Tests for useAIEditing composable
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAIEditing } from '../composables/useAIEditing'

describe('useAIEditing', () => {
  const allSections = ['intro', 'body', 'conclusion'] as const
  type SectionId = (typeof allSections)[number]

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const { aiEditingMode, aiCurrentSection, aiCompletedSections, aiPendingSections } =
        useAIEditing<SectionId>({ allSections })

      expect(aiEditingMode.value).toBe(false)
      expect(aiCurrentSection.value).toBeNull()
      expect(aiCompletedSections.value.size).toBe(0)
      expect(aiPendingSections.value.size).toBe(0)
    })

    it('should calculate progress as 0 initially', () => {
      const { progress } = useAIEditing<SectionId>({ allSections })

      expect(progress.value).toBe(0)
    })
  })

  describe('startAIEditing', () => {
    it('should enable editing mode and set all sections as pending', () => {
      const { aiEditingMode, aiPendingSections, startAIEditing } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()

      expect(aiEditingMode.value).toBe(true)
      expect(aiPendingSections.value.size).toBe(3)
      expect(aiPendingSections.value.has('intro')).toBe(true)
      expect(aiPendingSections.value.has('body')).toBe(true)
      expect(aiPendingSections.value.has('conclusion')).toBe(true)
    })

    it('should set first section as current', () => {
      const { aiCurrentSection, startAIEditing } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()

      expect(aiCurrentSection.value).toBe('intro')
    })

    it('should accept specific sections to edit', () => {
      const { aiPendingSections, startAIEditing } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing(['body', 'conclusion'])

      expect(aiPendingSections.value.size).toBe(2)
      expect(aiPendingSections.value.has('intro')).toBe(false)
      expect(aiPendingSections.value.has('body')).toBe(true)
      expect(aiPendingSections.value.has('conclusion')).toBe(true)
    })
  })

  describe('updateFromAI', () => {
    it('should call onSectionUpdate callback', () => {
      const onSectionUpdate = vi.fn()
      const { startAIEditing, updateFromAI } =
        useAIEditing<SectionId>({ allSections, onSectionUpdate })

      startAIEditing()
      updateFromAI('intro', 'Introduction content')

      expect(onSectionUpdate).toHaveBeenCalledWith('intro', 'Introduction content')
    })

    it('should set section as current when updating', () => {
      const { aiCurrentSection, startAIEditing, updateFromAI } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      updateFromAI('body', 'Body content')

      expect(aiCurrentSection.value).toBe('body')
    })
  })

  describe('completeAISection', () => {
    it('should move section from pending to completed', () => {
      const { aiCompletedSections, aiPendingSections, startAIEditing, completeAISection } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      completeAISection('intro')

      expect(aiCompletedSections.value.has('intro')).toBe(true)
      expect(aiPendingSections.value.has('intro')).toBe(false)
    })

    it('should advance to next pending section', () => {
      const { aiCurrentSection, startAIEditing, completeAISection } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      completeAISection('intro')

      expect(aiCurrentSection.value).toBe('body')
    })

    it('should update progress correctly', () => {
      const { progress, startAIEditing, completeAISection } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      expect(progress.value).toBe(0)

      completeAISection('intro')
      expect(progress.value).toBeCloseTo(33.33, 0)

      completeAISection('body')
      expect(progress.value).toBeCloseTo(66.67, 0)

      completeAISection('conclusion')
      expect(progress.value).toBe(100)
    })

    it('should call onComplete when all sections are completed', () => {
      const onComplete = vi.fn()
      const { startAIEditing, completeAISection } =
        useAIEditing<SectionId>({ allSections, onComplete })

      startAIEditing()
      completeAISection('intro')
      expect(onComplete).not.toHaveBeenCalled()

      completeAISection('body')
      expect(onComplete).not.toHaveBeenCalled()

      completeAISection('conclusion')
      expect(onComplete).toHaveBeenCalledTimes(1)
    })
  })

  describe('finishAIEditing', () => {
    it('should disable editing mode', () => {
      const { aiEditingMode, startAIEditing, finishAIEditing } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      finishAIEditing()

      expect(aiEditingMode.value).toBe(false)
    })

    it('should NOT call onComplete callback (onComplete is called when all sections complete)', () => {
      const onComplete = vi.fn()
      const { startAIEditing, finishAIEditing } =
        useAIEditing<SectionId>({ allSections, onComplete })

      startAIEditing()
      finishAIEditing()

      // onComplete is only called when all sections complete via completeAISection
      expect(onComplete).not.toHaveBeenCalled()
    })

    it('should clear current section', () => {
      const { aiCurrentSection, startAIEditing, finishAIEditing } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      finishAIEditing()

      expect(aiCurrentSection.value).toBeNull()
    })
  })

  describe('cancelAIEditing', () => {
    it('should disable editing mode', () => {
      const { aiEditingMode, startAIEditing, cancelAIEditing } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      cancelAIEditing()

      expect(aiEditingMode.value).toBe(false)
    })

    it('should call onCancel callback', () => {
      const onCancel = vi.fn()
      const { startAIEditing, cancelAIEditing } =
        useAIEditing<SectionId>({ allSections, onCancel })

      startAIEditing()
      cancelAIEditing()

      expect(onCancel).toHaveBeenCalled()
    })

    it('should clear all state', () => {
      const { aiCurrentSection, aiCompletedSections, aiPendingSections, startAIEditing, completeAISection, cancelAIEditing } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      completeAISection('intro')
      cancelAIEditing()

      expect(aiCurrentSection.value).toBeNull()
      expect(aiCompletedSections.value.size).toBe(0)
      expect(aiPendingSections.value.size).toBe(0)
    })
  })

  describe('helper methods', () => {
    it('isAIEditing should return true for current section', () => {
      const { startAIEditing, isAIEditing } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()

      expect(isAIEditing('intro')).toBe(true)
      expect(isAIEditing('body')).toBe(false)
    })

    it('isAICompleted should return true for completed sections', () => {
      const { startAIEditing, completeAISection, isAICompleted } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      completeAISection('intro')

      expect(isAICompleted('intro')).toBe(true)
      expect(isAICompleted('body')).toBe(false)
    })

    it('isAIPending should return true for pending sections', () => {
      const { startAIEditing, completeAISection, isAIPending } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()

      expect(isAIPending('intro')).toBe(true)
      expect(isAIPending('body')).toBe(true)

      completeAISection('intro')

      expect(isAIPending('intro')).toBe(false)
      expect(isAIPending('body')).toBe(true)
    })
  })

  describe('resetAIState', () => {
    it('should reset all state to initial values', () => {
      const { aiEditingMode, aiCurrentSection, aiCompletedSections, aiPendingSections, startAIEditing, completeAISection, resetAIState } =
        useAIEditing<SectionId>({ allSections })

      startAIEditing()
      completeAISection('intro')
      completeAISection('body')

      resetAIState()

      expect(aiEditingMode.value).toBe(false)
      expect(aiCurrentSection.value).toBeNull()
      expect(aiCompletedSections.value.size).toBe(0)
      expect(aiPendingSections.value.size).toBe(0)
    })
  })
})
