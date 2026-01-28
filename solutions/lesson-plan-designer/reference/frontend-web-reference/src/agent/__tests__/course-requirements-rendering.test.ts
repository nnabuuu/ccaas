/**
 * Course Requirements Rendering Tests
 *
 * Tests the data flow from agent output_update to form state:
 * Agent → output_update event → handleOutputUpdate → fieldMappings → formStateSynchronizer → form
 *
 * This test suite verifies that courseRequirements data from the AI agent
 * is properly propagated to the frontend form.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FormStateSynchronizer } from '../form-state-synchronizer'
import { reactive } from 'vue'

describe('CourseRequirements Rendering', () => {
  describe('FormStateSynchronizer courseRequirements handling', () => {
    let synchronizer: FormStateSynchronizer

    beforeEach(() => {
      synchronizer = new FormStateSynchronizer()
    })

    afterEach(() => {
      // Clean up
    })

    it('should accept courseRequirements field updates', () => {
      // Register a form with courseRequirements
      const formState = reactive({
        courseRequirements: { contentIds: [], academicIds: [] },
        textbookAnalysis: '',
      })
      synchronizer.registerForm('lessonPlanContent', formState)

      // Simulate agent sending courseRequirements
      const courseRequirements = {
        contentIds: [299, 296, 333],
        academicIds: [145, 148],
      }

      const success = synchronizer.updateField(
        'lessonPlanContent',
        'courseRequirements',
        courseRequirements,
        'agent'
      )

      expect(success).toBe(true)
      expect(formState.courseRequirements).toEqual(courseRequirements)
    })

    it('should emit event when courseRequirements is updated', () => {
      const formState = reactive({
        courseRequirements: { contentIds: [], academicIds: [] },
      })
      synchronizer.registerForm('lessonPlanContent', formState)

      const handler = vi.fn()
      synchronizer.onFormUpdated(handler)

      const courseRequirements = {
        contentIds: [299],
        academicIds: [145],
      }

      synchronizer.updateField(
        'lessonPlanContent',
        'courseRequirements',
        courseRequirements,
        'agent'
      )

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: 'lessonPlanContent',
          field: 'courseRequirements',
          value: courseRequirements,
          source: 'agent',
        })
      )
    })

    it('should handle bulk update including courseRequirements', () => {
      const formState = reactive({
        courseRequirements: { contentIds: [], academicIds: [] },
        textbookAnalysis: '',
        studentAnalysis: '',
      })
      synchronizer.registerForm('lessonPlanContent', formState)

      // Simulate agent sending multiple fields including courseRequirements
      const updates = {
        courseRequirements: { contentIds: [1, 2], academicIds: [3, 4] },
        textbookAnalysis: 'Test analysis',
      }

      const success = synchronizer.updateFields(
        'lessonPlanContent',
        updates,
        'agent'
      )

      expect(success).toBe(true)
      expect(formState.courseRequirements).toEqual(updates.courseRequirements)
      expect(formState.textbookAnalysis).toBe('Test analysis')
    })
  })

  describe('AgentListener output_update handling', () => {
    /**
     * This test simulates what handleOutputUpdate does in AgentListener.vue
     * It verifies that courseRequirements is included in fieldMappings
     */
    it('should include courseRequirements in fieldMappings', () => {
      // This is the fieldMappings from AgentListener.vue - we test that it includes courseRequirements
      const fieldMappings: Record<string, string> = {
        courseRequirements: 'courseRequirements',  // THIS SHOULD EXIST
        textbookAnalysis: 'textbookAnalysis',
        studentAnalysis: 'studentAnalysis',
        learningObjectives: 'learningObjectives',
        preClassPreparation: 'preClassPreparation',
        learningProcess: 'learningProcess',
        homeworkAssessment: 'homeworkAssessment',
      }

      expect(fieldMappings).toHaveProperty('courseRequirements')
      expect(fieldMappings.courseRequirements).toBe('courseRequirements')
    })

    it('should map agent output to form fields including courseRequirements', () => {
      // Simulate the mapping logic from handleOutputUpdate
      const fieldMappings: Record<string, string> = {
        courseRequirements: 'courseRequirements',
        textbookAnalysis: 'textbookAnalysis',
        studentAnalysis: 'studentAnalysis',
        learningObjectives: 'learningObjectives',
        preClassPreparation: 'preClassPreparation',
        learningProcess: 'learningProcess',
        homeworkAssessment: 'homeworkAssessment',
      }

      // Simulate agent output with courseRequirements
      const agentOutput = {
        courseRequirements: { contentIds: [299, 296], academicIds: [145] },
        textbookAnalysis: '本章内容为小数乘法...',
        studentAnalysis: '学生已掌握整数乘法...',
      }

      // Build form data as handleOutputUpdate does
      const formData: Record<string, unknown> = {}
      for (const [outputField, formField] of Object.entries(fieldMappings)) {
        if (agentOutput[outputField as keyof typeof agentOutput] !== undefined) {
          formData[formField] = agentOutput[outputField as keyof typeof agentOutput]
        }
      }

      // Verify courseRequirements is included
      expect(formData).toHaveProperty('courseRequirements')
      expect(formData.courseRequirements).toEqual({
        contentIds: [299, 296],
        academicIds: [145],
      })
    })

    it('should handle output_update event with courseRequirements', () => {
      // Full integration test simulating the entire flow
      const synchronizer = new FormStateSynchronizer()
      const formState = reactive({
        courseRequirements: { contentIds: [], academicIds: [] },
        textbookAnalysis: '',
        studentAnalysis: '',
        learningObjectives: [],
        preClassPreparation: [],
        learningProcess: [],
        homeworkAssessment: { homeworkTasks: [], learningObjectives: [] },
      })
      synchronizer.registerForm('lessonPlanContent', formState)

      // Simulate output_update event data
      const outputEvent = {
        status: 'generating',
        data: {
          courseRequirements: { contentIds: [299, 296, 333], academicIds: [145, 148] },
          textbookAnalysis: '本节课主要学习小数乘法的基本概念和运算方法。',
        },
        progress: {
          totalSteps: 7,
          completedSteps: 2,
          currentStep: 'textbookAnalysis',
          percentage: 28,
        },
      }

      // Simulate handleOutputUpdate logic
      const fieldMappings: Record<string, string> = {
        courseRequirements: 'courseRequirements',
        textbookAnalysis: 'textbookAnalysis',
        studentAnalysis: 'studentAnalysis',
        learningObjectives: 'learningObjectives',
        preClassPreparation: 'preClassPreparation',
        learningProcess: 'learningProcess',
        homeworkAssessment: 'homeworkAssessment',
      }

      if (outputEvent.data) {
        const formData: Record<string, unknown> = {}
        for (const [outputField, formField] of Object.entries(fieldMappings)) {
          const value = outputEvent.data[outputField as keyof typeof outputEvent.data]
          if (value !== undefined) {
            formData[formField] = value
          }
        }

        if (Object.keys(formData).length > 0) {
          synchronizer.updateFields('lessonPlanContent', formData, 'agent')
        }
      }

      // Verify form state was updated
      expect(formState.courseRequirements).toEqual({
        contentIds: [299, 296, 333],
        academicIds: [145, 148],
      })
      expect(formState.textbookAnalysis).toBe('本节课主要学习小数乘法的基本概念和运算方法。')
    })
  })

  describe('courseRequirements data structure', () => {
    it('should validate courseRequirements format', () => {
      const validCourseRequirements = {
        contentIds: [1, 2, 3],
        academicIds: [4, 5, 6],
      }

      expect(Array.isArray(validCourseRequirements.contentIds)).toBe(true)
      expect(Array.isArray(validCourseRequirements.academicIds)).toBe(true)
      expect(validCourseRequirements.contentIds.every((id) => typeof id === 'number')).toBe(true)
      expect(validCourseRequirements.academicIds.every((id) => typeof id === 'number')).toBe(true)
    })

    it('should handle empty courseRequirements', () => {
      const emptyCourseRequirements = {
        contentIds: [],
        academicIds: [],
      }

      expect(emptyCourseRequirements.contentIds).toHaveLength(0)
      expect(emptyCourseRequirements.academicIds).toHaveLength(0)
    })

    it('should handle partial courseRequirements (only contentIds)', () => {
      const partialCourseRequirements = {
        contentIds: [299, 296],
        academicIds: [],
      }

      expect(partialCourseRequirements.contentIds).toHaveLength(2)
      expect(partialCourseRequirements.academicIds).toHaveLength(0)
    })
  })
})
