import { useState, useCallback } from 'react'
import { api } from '../utils/api'
import type { LessonPlan, CreateLessonPlanInput } from '../types'

export interface UseLessonPlanCRUDOptions {
  onError?: (error: string) => void
}

export interface UseLessonPlanCRUDReturn {
  lessonPlan: LessonPlan | null
  loading: boolean
  loadPlan: (id: string) => Promise<void>
  savePlan: () => Promise<void>
  createPlan: (input: CreateLessonPlanInput) => Promise<LessonPlan>
  deletePlan: (id: string) => Promise<void>
  updateField: <K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => void
  setLessonPlan: (plan: LessonPlan | null) => void
}

/**
 * Hook for LessonPlan CRUD operations
 * Manages loading, saving, creating, deleting lesson plans
 */
export function useLessonPlanCRUD(
  options: UseLessonPlanCRUDOptions = {}
): UseLessonPlanCRUDReturn {
  const { onError } = options
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null)
  const [loading, setLoading] = useState(false)

  const loadPlan = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const plan = await api.getLessonPlan(id)
      setLessonPlan(plan)
    } catch (err) {
      const message = `加载教案失败: ${err instanceof Error ? err.message : String(err)}`
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  const savePlan = useCallback(async () => {
    if (!lessonPlan) return
    setLoading(true)
    try {
      const updated = await api.updateLessonPlan(lessonPlan.id, lessonPlan)
      setLessonPlan(updated)
    } catch (err) {
      const message = `保存教案失败: ${err instanceof Error ? err.message : String(err)}`
      onError?.(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [lessonPlan, onError])

  const createPlan = useCallback(async (input: CreateLessonPlanInput) => {
    setLoading(true)
    try {
      const newPlan = await api.createLessonPlan(input)
      setLessonPlan(newPlan)
      return newPlan
    } catch (err) {
      const message = `创建教案失败: ${err instanceof Error ? err.message : String(err)}`
      onError?.(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [onError])

  const deletePlan = useCallback(async (id: string) => {
    setLoading(true)
    try {
      await api.deleteLessonPlan(id)
      setLessonPlan(null)
    } catch (err) {
      const message = `删除教案失败: ${err instanceof Error ? err.message : String(err)}`
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }, [onError])

  const updateField = useCallback(<K extends keyof LessonPlan>(field: K, value: LessonPlan[K]) => {
    setLessonPlan(prev => prev ? { ...prev, [field]: value } : null)
  }, [])

  return {
    lessonPlan,
    loading,
    loadPlan,
    savePlan,
    createPlan,
    deletePlan,
    updateField,
    setLessonPlan,
  }
}
