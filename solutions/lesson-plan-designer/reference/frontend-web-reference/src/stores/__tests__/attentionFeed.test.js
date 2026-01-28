import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAttentionFeedStore, CATEGORIES } from '../domain/attentionFeedStore'

// Mock the API
vi.mock('../../api', () => ({
  attentionFeedApi: {
    getMyFeed: vi.fn(),
    getCategoryCounts: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn()
  }
}))

import { attentionFeedApi } from '../../api'

describe('attentionFeedStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('has correct initial values', () => {
      const store = useAttentionFeedStore()

      expect(store.items).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.selectedCategory).toBe(CATEGORIES.ALL)
      expect(store.categoryCounts).toEqual({
        pending: 0,
        updated: 0,
        reminder: 0,
        activity: 0
      })
    })
  })

  describe('filteredItems', () => {
    it('returns all items when category is ALL', () => {
      const store = useAttentionFeedStore()
      store.items = [
        { id: '1', category: 'pending' },
        { id: '2', category: 'activity' }
      ]
      store.selectedCategory = CATEGORIES.ALL

      expect(store.filteredItems).toHaveLength(2)
    })

    it('filters items by selected category', () => {
      const store = useAttentionFeedStore()
      store.items = [
        { id: '1', category: 'pending' },
        { id: '2', category: 'activity' },
        { id: '3', category: 'pending' }
      ]
      store.selectedCategory = CATEGORIES.PENDING

      expect(store.filteredItems).toHaveLength(2)
      expect(store.filteredItems.every(i => i.category === 'pending')).toBe(true)
    })
  })

  describe('isEmpty', () => {
    it('returns true when no items', () => {
      const store = useAttentionFeedStore()
      expect(store.isEmpty).toBe(true)
    })

    it('returns false when items exist', () => {
      const store = useAttentionFeedStore()
      store.items = [{ id: '1', category: 'pending' }]
      expect(store.isEmpty).toBe(false)
    })

    it('returns true when filtered items is empty', () => {
      const store = useAttentionFeedStore()
      store.items = [{ id: '1', category: 'pending' }]
      store.selectedCategory = CATEGORIES.ACTIVITY
      expect(store.isEmpty).toBe(true)
    })
  })

  describe('totalUnreadCount', () => {
    it('sums all category counts', () => {
      const store = useAttentionFeedStore()
      store.categoryCounts = {
        pending: 3,
        updated: 2,
        reminder: 1,
        activity: 4
      }

      expect(store.totalUnreadCount).toBe(10)
    })
  })

  describe('fetchFeed', () => {
    it('fetches and sets items', async () => {
      const mockItems = [
        { id: '1', category: 'pending', title: 'Test' }
      ]
      attentionFeedApi.getMyFeed.mockResolvedValue({ data: mockItems })

      const store = useAttentionFeedStore()
      await store.fetchFeed()

      expect(store.items).toEqual(mockItems)
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('sets loading state during fetch', async () => {
      attentionFeedApi.getMyFeed.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: [] }), 100))
      )

      const store = useAttentionFeedStore()
      const promise = store.fetchFeed()

      expect(store.loading).toBe(true)
      await promise
      expect(store.loading).toBe(false)
    })

    it('handles fetch error', async () => {
      attentionFeedApi.getMyFeed.mockRejectedValue(new Error('Network error'))

      const store = useAttentionFeedStore()

      await expect(store.fetchFeed()).rejects.toThrow()
      expect(store.error).toBe('加载失败，请稍后重试')
      expect(store.loading).toBe(false)
    })

    it('passes limit parameter', async () => {
      attentionFeedApi.getMyFeed.mockResolvedValue({ data: [] })

      const store = useAttentionFeedStore()
      await store.fetchFeed(50)

      expect(attentionFeedApi.getMyFeed).toHaveBeenCalledWith({ limit: 50 })
    })
  })

  describe('fetchCounts', () => {
    it('fetches and sets category counts', async () => {
      const mockCounts = { pending: 5, updated: 3, reminder: 1, activity: 2 }
      attentionFeedApi.getCategoryCounts.mockResolvedValue({ data: mockCounts })

      const store = useAttentionFeedStore()
      await store.fetchCounts()

      expect(store.categoryCounts).toEqual(mockCounts)
    })

    it('does not throw on error (silent fail)', async () => {
      attentionFeedApi.getCategoryCounts.mockRejectedValue(new Error('Error'))

      const store = useAttentionFeedStore()
      await expect(store.fetchCounts()).resolves.not.toThrow()
    })
  })

  describe('markAsRead', () => {
    it('marks item as read and decrements count', async () => {
      attentionFeedApi.markAsRead.mockResolvedValue({})

      const store = useAttentionFeedStore()
      store.items = [
        { id: 'item:1', category: 'pending', isRead: false }
      ]
      store.categoryCounts = { pending: 3, updated: 0, reminder: 0, activity: 0 }

      await store.markAsRead('item:1')

      expect(store.items[0].isRead).toBe(true)
      expect(store.categoryCounts.pending).toBe(2)
    })

    it('does not decrement if already read', async () => {
      attentionFeedApi.markAsRead.mockResolvedValue({})

      const store = useAttentionFeedStore()
      store.items = [
        { id: 'item:1', category: 'pending', isRead: true }
      ]
      store.categoryCounts = { pending: 3, updated: 0, reminder: 0, activity: 0 }

      await store.markAsRead('item:1')

      expect(store.categoryCounts.pending).toBe(3)
    })

    it('throws on API error', async () => {
      attentionFeedApi.markAsRead.mockRejectedValue(new Error('Error'))

      const store = useAttentionFeedStore()
      await expect(store.markAsRead('item:1')).rejects.toThrow()
    })
  })

  describe('markAllAsRead', () => {
    it('marks all items as read when no category specified', async () => {
      attentionFeedApi.markAllAsRead.mockResolvedValue({})

      const store = useAttentionFeedStore()
      store.items = [
        { id: '1', category: 'pending', isRead: false },
        { id: '2', category: 'activity', isRead: false }
      ]
      store.categoryCounts = { pending: 1, updated: 0, reminder: 0, activity: 1 }

      await store.markAllAsRead()

      expect(store.items.every(i => i.isRead)).toBe(true)
      expect(store.categoryCounts).toEqual({ pending: 0, updated: 0, reminder: 0, activity: 0 })
    })

    it('marks only category items as read when category specified', async () => {
      attentionFeedApi.markAllAsRead.mockResolvedValue({})

      const store = useAttentionFeedStore()
      store.items = [
        { id: '1', category: 'pending', isRead: false },
        { id: '2', category: 'activity', isRead: false }
      ]
      store.categoryCounts = { pending: 1, updated: 0, reminder: 0, activity: 1 }

      await store.markAllAsRead('pending')

      expect(store.items[0].isRead).toBe(true)
      expect(store.items[1].isRead).toBe(false)
      expect(store.categoryCounts.pending).toBe(0)
      expect(store.categoryCounts.activity).toBe(1)
    })
  })

  describe('setSelectedCategory', () => {
    it('updates selected category', () => {
      const store = useAttentionFeedStore()
      store.setSelectedCategory(CATEGORIES.PENDING)

      expect(store.selectedCategory).toBe(CATEGORIES.PENDING)
    })
  })

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const store = useAttentionFeedStore()
      store.items = [{ id: '1' }]
      store.loading = true
      store.error = 'Some error'
      store.categoryCounts = { pending: 5, updated: 3, reminder: 1, activity: 2 }
      store.selectedCategory = CATEGORIES.PENDING

      store.reset()

      expect(store.items).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.selectedCategory).toBe(CATEGORIES.ALL)
      expect(store.categoryCounts).toEqual({
        pending: 0,
        updated: 0,
        reminder: 0,
        activity: 0
      })
    })
  })
})
