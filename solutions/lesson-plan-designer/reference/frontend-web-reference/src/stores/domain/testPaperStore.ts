/**
 * Test Paper Store
 * Maps to TestPaperController - manages test paper data
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
import { testPaperApi } from '@/api'
import type { TestPaper, TestPaperQuery, TestPaperCreateRequest, TestPaperUpdateRequest } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

export const useTestPaperStore = defineStore('testPaper', () => {
  // State
  const items = ref<TestPaper[]>([])
  const currentItem = ref<TestPaper | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch test paper list
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: TestPaperQuery = {}): Promise<TestPaper[]> {
    loading.value = true
    error.value = null
    try {
      const response = await testPaperApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[testPaperStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load test papers'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single test paper by ID
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchById(id: number): Promise<TestPaper> {
    loading.value = true
    error.value = null
    try {
      const response = await testPaperApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[testPaperStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load test paper'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create new test paper
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function create(data: TestPaperCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await testPaperApi.create(data)
      await fetchList()
    } catch (err) {
      console.error('[testPaperStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create test paper'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing test paper
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function update(data: TestPaperUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await testPaperApi.update(data)
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as TestPaper
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as TestPaper
      }
    } catch (err) {
      console.error('[testPaperStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update test paper'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete test paper(s)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await testPaperApi.delete(ids)
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id))
      if (currentItem.value && idsArray.includes(currentItem.value.id)) {
        currentItem.value = null
      }
    } catch (err) {
      console.error('[testPaperStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete test paper'
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
