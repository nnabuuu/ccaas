/**
 * Research Topic Store
 * Maps to ResearchTopicController - manages research topics
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
import { researchTopicApi } from '@/api'
import type { ResearchTopic, PageQuery } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

interface ResearchTopicCreateRequest {
  title: string
  description?: string
  category?: string
  projectId?: number
}

interface ResearchTopicUpdateRequest extends Partial<ResearchTopicCreateRequest> {
  id: number
}

export const useResearchTopicStore = defineStore('researchTopic', () => {
  // State
  const items = ref<ResearchTopic[]>([])
  const currentItem = ref<ResearchTopic | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch research topic list
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: PageQuery = {}): Promise<ResearchTopic[]> {
    loading.value = true
    error.value = null
    try {
      const response = await researchTopicApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[researchTopicStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load research topics'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single research topic by ID
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchById(id: number): Promise<ResearchTopic> {
    loading.value = true
    error.value = null
    try {
      const response = await researchTopicApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[researchTopicStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load research topic'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Create new research topic
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function create(data: ResearchTopicCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await researchTopicApi.create(data)
      await fetchList()
    } catch (err) {
      console.error('[researchTopicStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create research topic'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing research topic
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function update(data: ResearchTopicUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await researchTopicApi.update(data)
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as ResearchTopic
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as ResearchTopic
      }
    } catch (err) {
      console.error('[researchTopicStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update research topic'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete research topic(s)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await researchTopicApi.delete(ids)
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id))
      if (currentItem.value && idsArray.includes(currentItem.value.id)) {
        currentItem.value = null
      }
    } catch (err) {
      console.error('[researchTopicStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete research topic'
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
