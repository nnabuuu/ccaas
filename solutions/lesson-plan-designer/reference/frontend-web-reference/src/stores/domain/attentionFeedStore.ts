/**
 * Attention Feed Store
 *
 * Manages the attention feed state for the home page.
 * Aggregates notifications, comments, and updates into a unified feed.
 * Maps to AttentionFeedController endpoints.
 *
 * State:
 * - items: Array of attention items
 * - loading: Loading state
 * - error: Error message
 * - categoryCounts: Unread counts per category
 * - selectedCategory: Currently selected filter
 *
 * Mutation Patterns:
 * - fetchFeed: pessimistic (waits for server)
 * - fetchCounts: pessimistic (waits for server)
 * - markAsRead: optimistic (updates local, then syncs)
 * - markAllAsRead: optimistic (updates local, then syncs)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { attentionFeedApi } from '../../api'
import type { AttentionItem } from '@/types'

// Category definitions
export const CATEGORIES = {
  ALL: 'all',
  PENDING: 'pending',
  UPDATED: 'updated',
  REMINDER: 'reminder',
  ACTIVITY: 'activity'
} as const

export type CategoryKey = keyof typeof CATEGORIES
export type CategoryValue = typeof CATEGORIES[CategoryKey]

export const CATEGORY_LABELS: Record<CategoryValue, string> = {
  [CATEGORIES.ALL]: '全部',
  [CATEGORIES.PENDING]: '待处理',
  [CATEGORIES.UPDATED]: '已更新',
  [CATEGORIES.REMINDER]: '提醒',
  [CATEGORIES.ACTIVITY]: '动态'
}

interface CategoryCounts {
  pending: number
  updated: number
  reminder: number
  activity: number
  [key: string]: number
}

export const useAttentionFeedStore = defineStore('attentionFeed', () => {
  // State
  const items = ref<AttentionItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const categoryCounts = ref<CategoryCounts>({
    pending: 0,
    updated: 0,
    reminder: 0,
    activity: 0
  })
  const selectedCategory = ref<CategoryValue>(CATEGORIES.ALL)

  // Getters
  const filteredItems = computed(() => {
    if (selectedCategory.value === CATEGORIES.ALL) {
      return items.value
    }
    return items.value.filter(item => item.category === selectedCategory.value)
  })

  const isEmpty = computed(() => filteredItems.value.length === 0)

  const totalUnreadCount = computed(() => {
    return categoryCounts.value.pending +
           categoryCounts.value.updated +
           categoryCounts.value.reminder +
           categoryCounts.value.activity
  })

  // Actions

  /**
   * Fetch attention feed items
   * @pattern pessimistic - Waits for server response before updating state
   */
  async function fetchFeed(limit = 20): Promise<void> {
    loading.value = true
    error.value = null

    try {
      const response = await attentionFeedApi.getMyFeed({ limit })
      items.value = response.data || []
    } catch (err) {
      console.error('[AttentionFeedStore] Failed to fetch feed:', err)
      error.value = '加载失败，请稍后重试'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch category counts for badges
   * @pattern pessimistic - Waits for server response
   */
  async function fetchCounts(): Promise<void> {
    try {
      const response = await attentionFeedApi.getCategoryCounts()
      categoryCounts.value = response.data || {
        pending: 0,
        updated: 0,
        reminder: 0,
        activity: 0
      }
    } catch (err) {
      console.error('[AttentionFeedStore] Failed to fetch counts:', err)
      // Don't throw - counts are secondary
    }
  }

  /**
   * Mark a single item as read
   * @pattern optimistic - Updates local state immediately, syncs to server
   */
  async function markAsRead(itemId: number): Promise<void> {
    // Optimistic update
    const item = items.value.find(i => i.id === itemId)
    const wasUnread = item && !item.isRead

    if (item && !item.isRead) {
      item.isRead = true
      const category = item.category
      if (category in categoryCounts.value && categoryCounts.value[category] > 0) {
        categoryCounts.value[category]--
      }
    }

    try {
      await attentionFeedApi.markAsRead(itemId)
    } catch (err) {
      // Rollback on failure
      if (wasUnread && item) {
        item.isRead = false
        const category = item.category
        if (category in categoryCounts.value) {
          categoryCounts.value[category]++
        }
      }
      console.error('[AttentionFeedStore] Failed to mark as read:', err)
      throw err
    }
  }

  /**
   * Mark all items as read, optionally filtered by category
   * @pattern optimistic - Updates local state immediately, syncs to server
   */
  async function markAllAsRead(category?: string): Promise<void> {
    // Store previous state for rollback
    const previousItems = items.value.map(i => ({ ...i }))
    const previousCounts = { ...categoryCounts.value }

    // Optimistic update
    const targetItems = category
      ? items.value.filter(i => i.category === category)
      : items.value

    targetItems.forEach(item => {
      item.isRead = true
    })

    if (category && category in categoryCounts.value) {
      categoryCounts.value[category] = 0
    } else if (!category) {
      Object.keys(categoryCounts.value).forEach(key => {
        categoryCounts.value[key] = 0
      })
    }

    try {
      await attentionFeedApi.markAllAsRead(category)
    } catch (err) {
      // Rollback on failure
      items.value = previousItems as AttentionItem[]
      categoryCounts.value = previousCounts
      console.error('[AttentionFeedStore] Failed to mark all as read:', err)
      throw err
    }
  }

  /**
   * Set selected category filter
   * @pattern optimistic
   */
  function setSelectedCategory(category: CategoryValue): void {
    selectedCategory.value = category
  }

  /**
   * Reset store state
   */
  function reset(): void {
    items.value = []
    loading.value = false
    error.value = null
    categoryCounts.value = {
      pending: 0,
      updated: 0,
      reminder: 0,
      activity: 0
    }
    selectedCategory.value = CATEGORIES.ALL
  }

  return {
    // State
    items,
    loading,
    error,
    categoryCounts,
    selectedCategory,
    // Getters
    filteredItems,
    isEmpty,
    totalUnreadCount,
    // Actions
    fetchFeed,
    fetchCounts,
    markAsRead,
    markAllAsRead,
    setSelectedCategory,
    reset
  }
})
