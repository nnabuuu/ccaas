import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AttentionFilters from '../AttentionFilters.vue'
import { CATEGORIES } from '../../../stores/domain/attentionFeedStore'

describe('AttentionFilters', () => {
  const defaultCounts = {
    pending: 3,
    updated: 2,
    reminder: 1,
    activity: 5
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders all category tabs', () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.ALL, counts: defaultCounts }
      })

      const tabs = wrapper.findAll('.attention-filters__tab')
      expect(tabs).toHaveLength(5) // all, pending, updated, reminder, activity
    })

    it('renders category labels', () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.ALL, counts: defaultCounts }
      })

      const tabTexts = wrapper.findAll('.attention-filters__tab').map(t => t.text())
      expect(tabTexts.some(t => t.includes('全部'))).toBe(true)
      expect(tabTexts.some(t => t.includes('待处理'))).toBe(true)
      expect(tabTexts.some(t => t.includes('已更新'))).toBe(true)
      expect(tabTexts.some(t => t.includes('提醒'))).toBe(true)
      expect(tabTexts.some(t => t.includes('动态'))).toBe(true)
    })

    it('shows active class on selected category', () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.PENDING, counts: defaultCounts }
      })

      const tabs = wrapper.findAll('.attention-filters__tab')
      const pendingTab = tabs.find(t => t.text().includes('待处理'))
      expect(pendingTab.classes()).toContain('active')
    })
  })

  describe('counts', () => {
    it('shows total count for ALL category', () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.ALL, counts: defaultCounts }
      })

      const allTab = wrapper.findAll('.attention-filters__tab')[0]
      expect(allTab.text()).toContain('11') // 3+2+1+5
    })

    it('shows individual count for specific category', () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.ALL, counts: defaultCounts }
      })

      const tabs = wrapper.findAll('.attention-filters__tab')
      const pendingTab = tabs.find(t => t.text().includes('待处理'))
      expect(pendingTab.text()).toContain('3')
    })

    it('hides badge when count is 0', () => {
      const wrapper = mount(AttentionFilters, {
        props: {
          modelValue: CATEGORIES.ALL,
          counts: { pending: 0, updated: 0, reminder: 0, activity: 0 }
        }
      })

      expect(wrapper.findAll('.attention-filters__badge')).toHaveLength(0)
    })

    it('shows 99+ for counts over 99', () => {
      const wrapper = mount(AttentionFilters, {
        props: {
          modelValue: CATEGORIES.ALL,
          counts: { pending: 100, updated: 0, reminder: 0, activity: 0 }
        }
      })

      expect(wrapper.text()).toContain('99+')
    })
  })

  describe('mark all read button', () => {
    it('shows mark-all button when there are unread items', () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.ALL, counts: defaultCounts }
      })

      expect(wrapper.find('.attention-filters__mark-all').exists()).toBe(true)
      expect(wrapper.find('.attention-filters__mark-all').text()).toBe('全部已读')
    })

    it('hides mark-all button when no unread items', () => {
      const wrapper = mount(AttentionFilters, {
        props: {
          modelValue: CATEGORIES.ALL,
          counts: { pending: 0, updated: 0, reminder: 0, activity: 0 }
        }
      })

      expect(wrapper.find('.attention-filters__mark-all').exists()).toBe(false)
    })

    it('hides mark-all button when selected category has no unread', () => {
      const wrapper = mount(AttentionFilters, {
        props: {
          modelValue: CATEGORIES.PENDING,
          counts: { pending: 0, updated: 5, reminder: 0, activity: 0 }
        }
      })

      expect(wrapper.find('.attention-filters__mark-all').exists()).toBe(false)
    })
  })

  describe('events', () => {
    it('emits update:modelValue when tab is clicked', async () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.ALL, counts: defaultCounts }
      })

      const tabs = wrapper.findAll('.attention-filters__tab')
      const pendingTab = tabs.find(t => t.text().includes('待处理'))
      await pendingTab.trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual([CATEGORIES.PENDING])
    })

    it('emits mark-all-read with null for ALL category', async () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.ALL, counts: defaultCounts }
      })

      await wrapper.find('.attention-filters__mark-all').trigger('click')

      expect(wrapper.emitted('mark-all-read')).toBeTruthy()
      expect(wrapper.emitted('mark-all-read')[0]).toEqual([null])
    })

    it('emits mark-all-read with category for specific category', async () => {
      const wrapper = mount(AttentionFilters, {
        props: { modelValue: CATEGORIES.PENDING, counts: defaultCounts }
      })

      await wrapper.find('.attention-filters__mark-all').trigger('click')

      expect(wrapper.emitted('mark-all-read')).toBeTruthy()
      expect(wrapper.emitted('mark-all-read')[0]).toEqual([CATEGORIES.PENDING])
    })
  })
})
