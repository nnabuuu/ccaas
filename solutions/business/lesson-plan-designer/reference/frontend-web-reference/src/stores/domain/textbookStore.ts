/**
 * Textbook Store
 * Maps to TextbookController - manages textbook reference data
 *
 * Mutation Patterns:
 * - fetchList: pessimistic (wait for server)
 * - fetchById: pessimistic (wait for server)
 *
 * Note: Textbooks are typically read-only reference data.
 * CRUD operations may be admin-only.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { textbookApi } from '@/api'
import type { Textbook, TextbookQuery } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

export const useTextbookStore = defineStore('textbook', () => {
  // State
  const items = ref<Textbook[]>([])
  const currentItem = ref<Textbook | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch textbook list
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: TextbookQuery = {}): Promise<Textbook[]> {
    loading.value = true
    error.value = null
    try {
      const response = await textbookApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[textbookStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load textbooks'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single textbook by ID
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchById(id: number): Promise<Textbook> {
    loading.value = true
    error.value = null
    try {
      const response = await textbookApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[textbookStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load textbook'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Find textbook by criteria (local search)
   */
  function findByCriteria(criteria: { subject?: string; grade?: number; publisher?: string } = {}): Textbook[] {
    return items.value.filter(item => {
      if (criteria.subject && item.subject !== criteria.subject) return false
      if (criteria.grade && item.gradeLevel !== criteria.grade) return false
      if (criteria.publisher && item.publisher !== criteria.publisher) return false
      return true
    })
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
    findByCriteria,
    reset
  }
})
