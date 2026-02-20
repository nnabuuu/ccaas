/**
 * Internship School Store
 * Maps to InternshipSchoolController - manages internship school assignments
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
import { internshipSchoolApi } from '@/api'
import type { InternshipSchool, InternshipSchoolQuery, InternshipSchoolCreateRequest, InternshipSchoolUpdateRequest } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

export const useInternshipSchoolStore = defineStore('internshipSchool', () => {
  // State
  const items = ref<InternshipSchool[]>([])
  const currentItem = ref<InternshipSchool | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch internship school list
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: InternshipSchoolQuery = {}): Promise<InternshipSchool[]> {
    loading.value = true
    error.value = null
    try {
      const response = await internshipSchoolApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[internshipSchoolStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load internship schools'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single internship school by ID
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchById(id: number): Promise<InternshipSchool> {
    loading.value = true
    error.value = null
    try {
      const response = await internshipSchoolApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[internshipSchoolStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load internship school'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create new internship school assignment
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function create(data: InternshipSchoolCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await internshipSchoolApi.create(data)
      await fetchList()
    } catch (err) {
      console.error('[internshipSchoolStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create internship school'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing internship school
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function update(data: InternshipSchoolUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await internshipSchoolApi.update(data)
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as InternshipSchool
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as InternshipSchool
      }
    } catch (err) {
      console.error('[internshipSchoolStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update internship school'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete internship school(s)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await internshipSchoolApi.delete(ids)
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id))
      if (currentItem.value && idsArray.includes(currentItem.value.id)) {
        currentItem.value = null
      }
    } catch (err) {
      console.error('[internshipSchoolStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete internship school'
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
