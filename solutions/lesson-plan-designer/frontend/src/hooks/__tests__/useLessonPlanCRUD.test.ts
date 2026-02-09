import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLessonPlanCRUD } from '../useLessonPlanCRUD'
import { api } from '../../utils/api'
import type { LessonPlan, CreateLessonPlanInput } from '../../types'

// Mock API
vi.mock('../../utils/api', () => ({
  api: {
    getLessonPlan: vi.fn(),
    updateLessonPlan: vi.fn(),
    createLessonPlan: vi.fn(),
    deleteLessonPlan: vi.fn(),
  },
}))

describe('useLessonPlanCRUD', () => {
  const mockLessonPlan: LessonPlan = {
    id: 'test-plan-1',
    title: 'Test Plan',
    subject: 'math',
    gradeLevel: 3,
    durationMinutes: 45,
    objectives: 'Test objectives',
    content: 'Test content',
    teachingMethods: 'Test methods',
    materialsNeeded: 'Test materials',
    assessmentMethods: 'Test assessment',
    lessonPlanCode: 'TEST-001',
    publisher: '人教版',
    volume: '上册',
    chapterId: 1,
    chapterTitle: 'Chapter 1',
    curriculumRequirements: [],
    studentAnalysis: 'Test analysis',
    extraProperties: {},
    status: 'DRAFT',
    attachments: [],
    createBy: 'test-user',
    createTime: new Date().toISOString(),
    updateBy: 'test-user',
    updateTime: new Date().toISOString(),
    deleted: 0,
    remark: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('should start with null lesson plan and not loading', () => {
      const { result } = renderHook(() => useLessonPlanCRUD())

      expect(result.current.lessonPlan).toBe(null)
      expect(result.current.loading).toBe(false)
    })
  })

  describe('loadPlan', () => {
    it('should load lesson plan successfully', async () => {
      vi.mocked(api.getLessonPlan).mockResolvedValue(mockLessonPlan)

      const { result } = renderHook(() => useLessonPlanCRUD())

      await act(async () => {
        await result.current.loadPlan('test-plan-1')
      })

      expect(result.current.lessonPlan).toEqual(mockLessonPlan)
      expect(result.current.loading).toBe(false)
      expect(api.getLessonPlan).toHaveBeenCalledWith('test-plan-1')
    })

    it('should handle load error', async () => {
      const mockError = new Error('Load failed')
      vi.mocked(api.getLessonPlan).mockRejectedValue(mockError)

      const onError = vi.fn()
      const { result } = renderHook(() => useLessonPlanCRUD({ onError }))

      await act(async () => {
        await result.current.loadPlan('test-plan-1')
      })

      expect(result.current.lessonPlan).toBe(null)
      expect(result.current.loading).toBe(false)
      expect(onError).toHaveBeenCalledWith('加载教案失败: Load failed')
    })
  })

  describe('savePlan', () => {
    it('should save lesson plan successfully', async () => {
      const updatedPlan = { ...mockLessonPlan, title: 'Updated Title' }
      vi.mocked(api.updateLessonPlan).mockResolvedValue(updatedPlan)

      const { result } = renderHook(() => useLessonPlanCRUD())

      // Set initial plan
      act(() => {
        result.current.setLessonPlan(mockLessonPlan)
      })

      await act(async () => {
        await result.current.savePlan()
      })

      expect(result.current.lessonPlan).toEqual(updatedPlan)
      expect(result.current.loading).toBe(false)
      expect(api.updateLessonPlan).toHaveBeenCalledWith('test-plan-1', mockLessonPlan)
    })

    it('should not save if no lesson plan', async () => {
      const { result } = renderHook(() => useLessonPlanCRUD())

      await act(async () => {
        await result.current.savePlan()
      })

      expect(api.updateLessonPlan).not.toHaveBeenCalled()
    })

    it('should handle save error', async () => {
      const mockError = new Error('Save failed')
      vi.mocked(api.updateLessonPlan).mockRejectedValue(mockError)

      const onError = vi.fn()
      const { result } = renderHook(() => useLessonPlanCRUD({ onError }))

      act(() => {
        result.current.setLessonPlan(mockLessonPlan)
      })

      await act(async () => {
        try {
          await result.current.savePlan()
        } catch (err) {
          // Expected to throw
        }
      })

      expect(onError).toHaveBeenCalledWith('保存教案失败: Save failed')
    })
  })

  describe('createPlan', () => {
    it('should create lesson plan successfully', async () => {
      const input: CreateLessonPlanInput = {
        title: 'New Plan',
        subject: 'math',
        gradeLevel: 3,
        durationMinutes: 45,
      }
      vi.mocked(api.createLessonPlan).mockResolvedValue(mockLessonPlan)

      const { result } = renderHook(() => useLessonPlanCRUD())

      let createdPlan: LessonPlan | undefined
      await act(async () => {
        createdPlan = await result.current.createPlan(input)
      })

      expect(createdPlan).toEqual(mockLessonPlan)
      expect(result.current.lessonPlan).toEqual(mockLessonPlan)
      expect(api.createLessonPlan).toHaveBeenCalledWith(input)
    })

    it('should handle create error', async () => {
      const mockError = new Error('Create failed')
      vi.mocked(api.createLessonPlan).mockRejectedValue(mockError)

      const onError = vi.fn()
      const { result } = renderHook(() => useLessonPlanCRUD({ onError }))

      const input: CreateLessonPlanInput = {
        title: 'New Plan',
        subject: 'math',
        gradeLevel: 3,
        durationMinutes: 45,
      }

      await act(async () => {
        try {
          await result.current.createPlan(input)
        } catch (err) {
          // Expected to throw
        }
      })

      expect(onError).toHaveBeenCalledWith('创建教案失败: Create failed')
    })
  })

  describe('deletePlan', () => {
    it('should delete lesson plan successfully', async () => {
      vi.mocked(api.deleteLessonPlan).mockResolvedValue(undefined)

      const { result } = renderHook(() => useLessonPlanCRUD())

      act(() => {
        result.current.setLessonPlan(mockLessonPlan)
      })

      await act(async () => {
        await result.current.deletePlan('test-plan-1')
      })

      expect(result.current.lessonPlan).toBe(null)
      expect(api.deleteLessonPlan).toHaveBeenCalledWith('test-plan-1')
    })

    it('should handle delete error', async () => {
      const mockError = new Error('Delete failed')
      vi.mocked(api.deleteLessonPlan).mockRejectedValue(mockError)

      const onError = vi.fn()
      const { result } = renderHook(() => useLessonPlanCRUD({ onError }))

      await act(async () => {
        await result.current.deletePlan('test-plan-1')
      })

      expect(onError).toHaveBeenCalledWith('删除教案失败: Delete failed')
    })
  })

  describe('updateField', () => {
    it('should update single field', () => {
      const { result } = renderHook(() => useLessonPlanCRUD())

      act(() => {
        result.current.setLessonPlan(mockLessonPlan)
      })

      act(() => {
        result.current.updateField('title', 'Updated Title')
      })

      expect(result.current.lessonPlan?.title).toBe('Updated Title')
    })

    it('should not update if no lesson plan', () => {
      const { result } = renderHook(() => useLessonPlanCRUD())

      act(() => {
        result.current.updateField('title', 'Updated Title')
      })

      expect(result.current.lessonPlan).toBe(null)
    })
  })
})
