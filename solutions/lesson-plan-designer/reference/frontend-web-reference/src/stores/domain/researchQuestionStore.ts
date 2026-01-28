/**
 * Research Question Store
 * Maps to ResearchQuestionController - manages research questions within topics
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
import { researchQuestionApi } from '@/api'
import type { ResearchQuestion, PageQuery } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

interface ResearchQuestionQuery extends PageQuery {
  topicId?: number
}

interface ResearchQuestionCreateRequest {
  topicId: number
  content: string
  sequence?: number
}

interface ResearchQuestionUpdateRequest extends Partial<ResearchQuestionCreateRequest> {
  id: number
}

export const useResearchQuestionStore = defineStore('researchQuestion', () => {
  // State
  const items = ref<ResearchQuestion[]>([])
  const currentItem = ref<ResearchQuestion | null>(null)
  const questionsByTopic = ref<Record<number, ResearchQuestion[]>>({}) // Cache questions by topic ID
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Fetch research question list
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: ResearchQuestionQuery = {}): Promise<ResearchQuestion[]> {
    loading.value = true
    error.value = null
    try {
      const response = await researchQuestionApi.getList(params)
      items.value = response.rows || []
      // Cache by topic if topicId provided
      if (params.topicId) {
        questionsByTopic.value[params.topicId] = items.value
      }
      return items.value
    } catch (err) {
      console.error('[researchQuestionStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load research questions'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch single research question by ID
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchById(id: number): Promise<ResearchQuestion> {
    loading.value = true
    error.value = null
    try {
      const response = await researchQuestionApi.getById(id)
      currentItem.value = response.data
      return currentItem.value
    } catch (err) {
      console.error('[researchQuestionStore] fetchById failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load research question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get cached questions by topic ID
   */
  function getQuestionsByTopic(topicId: number): ResearchQuestion[] {
    return questionsByTopic.value[topicId] || []
  }

  /**
   * Create new research question
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function create(data: ResearchQuestionCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await researchQuestionApi.create(data)
      // Refresh list (optionally by topic)
      if (data.topicId) {
        await fetchList({ topicId: data.topicId })
      } else {
        await fetchList()
      }
    } catch (err) {
      console.error('[researchQuestionStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create research question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update existing research question
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function update(data: ResearchQuestionUpdateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await researchQuestionApi.update(data)
      if (currentItem.value?.id === data.id) {
        currentItem.value = { ...currentItem.value, ...data } as ResearchQuestion
      }
      const index = items.value.findIndex(item => item.id === data.id)
      if (index !== -1) {
        items.value[index] = { ...items.value[index], ...data } as ResearchQuestion
      }
      // Update topic cache if applicable
      if (data.topicId && questionsByTopic.value[data.topicId]) {
        const topicIndex = questionsByTopic.value[data.topicId].findIndex(
          q => q.id === data.id
        )
        if (topicIndex !== -1) {
          questionsByTopic.value[data.topicId][topicIndex] = {
            ...questionsByTopic.value[data.topicId][topicIndex],
            ...data
          } as ResearchQuestion
        }
      }
    } catch (err) {
      console.error('[researchQuestionStore] update failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to update research question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete research question(s)
   * @pattern pessimistic - Waits for server confirmation before removing from state
   */
  async function remove(ids: number | number[]): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await researchQuestionApi.delete(ids)
      const idsArray = Array.isArray(ids) ? ids : [ids]
      items.value = items.value.filter(item => !idsArray.includes(item.id))
      if (currentItem.value && idsArray.includes(currentItem.value.id)) {
        currentItem.value = null
      }
      // Clean up topic caches
      for (const topicId of Object.keys(questionsByTopic.value)) {
        const numTopicId = Number(topicId)
        questionsByTopic.value[numTopicId] = questionsByTopic.value[numTopicId].filter(
          q => !idsArray.includes(q.id)
        )
      }
    } catch (err) {
      console.error('[researchQuestionStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete research question'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear topic cache
   */
  function clearTopicCache(topicId: number): void {
    delete questionsByTopic.value[topicId]
  }

  /**
   * Reset store state
   */
  function reset(): void {
    items.value = []
    currentItem.value = null
    questionsByTopic.value = {}
    loading.value = false
    error.value = null
  }

  return {
    items,
    currentItem,
    questionsByTopic,
    loading,
    error,
    isEmpty,
    fetchList,
    fetchById,
    getQuestionsByTopic,
    create,
    update,
    remove,
    clearTopicCache,
    reset
  }
})
