/**
 * Comment Store
 * Maps to CommentController - manages comments on various entities
 *
 * Mutation Patterns:
 * - fetchList: pessimistic (wait for server)
 * - fetchByTarget: pessimistic (wait for server)
 * - create: hybrid (pending state, then update)
 * - remove: pessimistic (wait for server confirmation)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { commentApi } from '@/api'
import type { Comment, CommentQuery, CommentCreateRequest } from '@/types'

interface ApiError {
  response?: {
    data?: {
      msg?: string
    }
  }
  message?: string
}

export const useCommentStore = defineStore('comment', () => {
  // State
  const items = ref<Comment[]>([])
  const commentsByTarget = ref<Record<string, Comment[]>>({}) // Cache comments by targetType:targetId
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const isEmpty = computed(() => items.value.length === 0)

  /**
   * Generate cache key for target
   */
  function getCacheKey(targetType: string, targetId: number): string {
    return `${targetType}:${targetId}`
  }

  /**
   * Fetch all comments
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchList(params: CommentQuery = {}): Promise<Comment[]> {
    loading.value = true
    error.value = null
    try {
      const response = await commentApi.getList(params)
      items.value = response.rows || []
      return items.value
    } catch (err) {
      console.error('[commentStore] fetchList failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load comments'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch comments for a specific target entity
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchByTarget(targetType: string, targetId: number): Promise<Comment[]> {
    loading.value = true
    error.value = null
    try {
      const response = await commentApi.getByTargetId(targetType, targetId)
      const comments = response.data || []
      const key = getCacheKey(targetType, targetId)
      commentsByTarget.value[key] = comments
      return comments
    } catch (err) {
      console.error('[commentStore] fetchByTarget failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to load comments'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get cached comments for a target
   */
  function getCommentsByTarget(targetType: string, targetId: number): Comment[] {
    const key = getCacheKey(targetType, targetId)
    return commentsByTarget.value[key] || []
  }

  /**
   * Create new comment
   * @pattern hybrid - Shows pending indicator, updates on success
   */
  async function create(data: CommentCreateRequest): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await commentApi.create(data)
      // Refresh comments for target
      if (data.targetType && data.targetId) {
        await fetchByTarget(data.targetType, data.targetId)
      }
    } catch (err) {
      console.error('[commentStore] create failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to create comment'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete comment
   * @pattern pessimistic - Waits for server confirmation before removing from state
   */
  async function remove(id: number, targetType?: string, targetId?: number): Promise<void> {
    loading.value = true
    error.value = null
    try {
      await commentApi.delete(id)
      // Remove from items list
      items.value = items.value.filter(item => item.id !== id)
      // Remove from target cache if exists
      if (targetType && targetId) {
        const key = getCacheKey(targetType, targetId)
        if (commentsByTarget.value[key]) {
          commentsByTarget.value[key] = commentsByTarget.value[key].filter(
            c => c.id !== id
          )
        }
      }
    } catch (err) {
      console.error('[commentStore] remove failed:', err)
      error.value = (err as ApiError).response?.data?.msg || 'Failed to delete comment'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear cache for a specific target
   */
  function clearTargetCache(targetType: string, targetId: number): void {
    const key = getCacheKey(targetType, targetId)
    delete commentsByTarget.value[key]
  }

  /**
   * Reset store state
   */
  function reset(): void {
    items.value = []
    commentsByTarget.value = {}
    loading.value = false
    error.value = null
  }

  return {
    items,
    commentsByTarget,
    loading,
    error,
    isEmpty,
    fetchList,
    fetchByTarget,
    getCommentsByTarget,
    create,
    remove,
    clearTargetCache,
    reset
  }
})
