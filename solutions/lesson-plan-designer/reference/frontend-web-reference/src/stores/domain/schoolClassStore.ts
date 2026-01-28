/**
 * School Class Store
 * Maps to SchoolClassController - manages class data within schools
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
import { schoolClassApi } from '@/api'
import type { SchoolClass } from '@/types'

interface SchoolClassCreateRequest {
  className?: string
  gradeId?: number
  schoolId?: number
  [key: string]: unknown
}

interface SchoolClassUpdateRequest extends SchoolClassCreateRequest {
  id: number
}

interface SchoolClassQuery {
  className?: string
  gradeId?: number
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

export const useSchoolClassStore = defineStore('schoolClass', () => {
  // State
  const items = ref<SchoolClass[]>([])
  const currentItem = ref<SchoolClass | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch class list
   * @pattern pessimistic - Waits for server response before updating state
   * @param params - Query parameters
   */
  async function fetchList(params: SchoolClassQuery = {}): Promise<SchoolClass[]> {
    loading.value = true
    error.value = null
    try {
      const response = await schoolClassApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[schoolClassStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load classes'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single class by ID
   * @pattern pessimistic - Waits for server response before updating state
   * @param id - Class ID
   */
  async function fetchById(id: number): Promise<SchoolClass> {
    loading.value = true
    error.value = null
    try {
      const response = await schoolClassApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[schoolClassStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load class'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create new class
   * @pattern hybrid - Shows pending indicator, updates on success
   * @param data - Class data
   */
  async function create(data: SchoolClassCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await schoolClassApi.create(data)
      await fetchList()
    } catch (err) {
      console.error('[schoolClassStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create class'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing class
   * @pattern hybrid - Shows pending indicator, updates on success
   * @param data - Class data with ID
   */
  async function update(data: SchoolClassUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await schoolClassApi.update(data)
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as SchoolClass
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as SchoolClass
      }
    } catch (err) {
      console.error('[schoolClassStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update class'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete class(es)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   * @param ids - ID(s) to delete
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await schoolClassApi.delete(ids)
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id!))
      if (currentItem.value && idsArray.includes(currentItem.value.id!)) {
        currentItem.value = null
      }
    } catch (err) {
      console.error('[schoolClassStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete class'
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
    remove,
    reset
  }
})
