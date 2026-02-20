/**
 * Course Analysis Store
 * Maps to CourseAnalysisController - manages course analysis/teaching material analysis
 *
 * Mutation Patterns:
 * - fetchList: pessimistic (wait for server)
 * - fetchById: pessimistic (wait for server)
 * - create: hybrid (pending state, then update)
 * - update: hybrid (pending state, then update)
 * - remove: pessimistic (wait for server confirmation)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { courseAnalysisApi } from '@/api'
import type { CourseAnalysis } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

interface CourseAnalysisQuery {
  scheduleId?: number
  pageNum?: number
  pageSize?: number
}

interface CourseAnalysisCreateRequest {
  scheduleId: number
  analysisContent?: string
  strengths?: string
  weaknesses?: string
  improvements?: string
}

interface CourseAnalysisUpdateRequest extends Partial<CourseAnalysisCreateRequest> {
  id: number
}

export const useCourseAnalysisStore = defineStore('courseAnalysis', () => {
  // State
  const items = ref<CourseAnalysis[]>([])
  const currentItem = ref<CourseAnalysis | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch course analysis list
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: CourseAnalysisQuery = {}): Promise<CourseAnalysis[]> {
    loading.value = true
    error.value = null
    try {
      const response = await courseAnalysisApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[courseAnalysisStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load course analyses'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single course analysis by ID
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchById(id: number): Promise<CourseAnalysis> {
    loading.value = true
    error.value = null
    try {
      const response = await courseAnalysisApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[courseAnalysisStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load course analysis'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create new course analysis
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function create(data: CourseAnalysisCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await courseAnalysisApi.create(data)
      await fetchList()
    } catch (err) {
      console.error('[courseAnalysisStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create course analysis'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing course analysis
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function update(data: CourseAnalysisUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await courseAnalysisApi.update(data)
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as CourseAnalysis
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as CourseAnalysis
      }
    } catch (err) {
      console.error('[courseAnalysisStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update course analysis'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update a single field (inline edit)
   * @pattern optimistic - Updates local state immediately, syncs to server
   */
  async function updateField(field: keyof CourseAnalysis, value: unknown): Promise<void> {
    if (!currentItem.value?.id) {
      throw new Error('No current item to update')
    }

    const oldValue = currentItem.value[field]
    // Optimistic update
    ;(currentItem.value as Record<string, unknown>)[field] = value

    try {
      await courseAnalysisApi.update({
        id: currentItem.value.id,
        [field]: value
      })
    } catch (err) {
      // Rollback on failure
      ;(currentItem.value as Record<string, unknown>)[field] = oldValue
      console.error('[courseAnalysisStore] updateField failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update field'
      throw err
    }
  }

  /**
   * Delete course analysis(es)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await courseAnalysisApi.delete(ids)
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id))
      if (currentItem.value && idsArray.includes(currentItem.value.id)) {
        currentItem.value = null
      }
    } catch (err) {
      console.error('[courseAnalysisStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete course analysis'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Reset store state
   */
  function reset(): void {
    items.value = []
    currentItem.value = null
    loading.value = false
    error.value = null
  }

  return {
    items,
    currentItem,
    loading,
    error,
    isEmpty,
    fetchList,
    fetchById,
    create,
    update,
    updateField,
    remove,
    reset
  }
})
