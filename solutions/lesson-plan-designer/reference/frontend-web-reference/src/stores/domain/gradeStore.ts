/**
 * Grade Store
 * Maps to GradeController - manages grade/year level data
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
import { gradeApi } from '@/api'
import type { Grade } from '@/types'

interface GradeCreateRequest {
  gradeName?: string
  gradeLevel?: number
  schoolId?: number
  [key: string]: unknown
}

interface GradeUpdateRequest extends GradeCreateRequest {
  id: number
}

interface GradeQuery {
  gradeName?: string
  gradeLevel?: number
  schoolId?: number
  pageNum?: number
  pageSize?: number
  [key: string]: unknown
}

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

export const useGradeStore = defineStore('grade', () => {
  // State
  const items = ref<Grade[]>([])
  const currentItem = ref<Grade | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch grade list
   * @pattern pessimistic - Waits for server response before updating state
   * @param params - Query parameters
   */
  async function fetchList(params: GradeQuery = {}): Promise<Grade[]> {
    loading.value = true
    error.value = null
    try {
      const response = await gradeApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[gradeStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load grades'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single grade by ID
   * @pattern pessimistic - Waits for server response before updating state
   * @param id - Grade ID
   */
  async function fetchById(id: number): Promise<Grade> {
    loading.value = true
    error.value = null
    try {
      const response = await gradeApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[gradeStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load grade'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create new grade
   * @pattern hybrid - Shows pending indicator, updates on success
   * @param data - Grade data
   */
  async function create(data: GradeCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await gradeApi.create(data)
      // Refresh list after creation
      await fetchList()
    } catch (err) {
      console.error('[gradeStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create grade'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing grade
   * @pattern hybrid - Shows pending indicator, updates on success
   * @param data - Grade data with ID
   */
  async function update(data: GradeUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await gradeApi.update(data)
      // Update local state
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as Grade
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as Grade
      }
    } catch (err) {
      console.error('[gradeStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update grade'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete grade(s)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   * @param ids - ID(s) to delete
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await gradeApi.delete(ids)
      // Remove from local state
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id!))
      if (currentItem.value && idsArray.includes(currentItem.value.id!)) {
        currentItem.value = null
      }
    } catch (err) {
      console.error('[gradeStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete grade'
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
    // State
    items,
    currentItem,
    loading,
    error,
    // Computed
    isEmpty,
    // Actions
    fetchList,
    fetchById,
    create,
    update,
    remove,
    reset
  }
})
