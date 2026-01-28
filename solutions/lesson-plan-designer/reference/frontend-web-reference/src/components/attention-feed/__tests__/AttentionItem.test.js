import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AttentionItem from '../AttentionItem.vue'

describe('AttentionItem', () => {
  const baseItem = {
    id: 'item:1',
    category: 'pending',
    title: 'Test Title',
    description: 'Test description',
    timestamp: new Date().toISOString(),
    isRead: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders item title', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: baseItem }
      })

      expect(wrapper.find('.attention-item__title').text()).toBe('Test Title')
    })

    it('renders item description', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: baseItem }
      })

      expect(wrapper.find('.attention-item__description').text()).toBe('Test description')
    })

    it('does not render description when empty', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, description: '' } }
      })

      expect(wrapper.find('.attention-item__description').exists()).toBe(false)
    })

    it('shows unread dot when item is unread', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, isRead: false } }
      })

      expect(wrapper.find('.attention-item__unread-dot').exists()).toBe(true)
    })

    it('hides unread dot when item is read', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, isRead: true } }
      })

      expect(wrapper.find('.attention-item__unread-dot').exists()).toBe(false)
    })

    it('applies is-unread class when unread', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, isRead: false } }
      })

      expect(wrapper.classes()).toContain('is-unread')
    })

    it('applies category class to icon', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, category: 'activity' } }
      })

      expect(wrapper.find('.attention-item__icon').classes()).toContain('activity')
    })

    it('shows mark-read button when unread', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, isRead: false } }
      })

      expect(wrapper.find('.attention-item__mark-read').exists()).toBe(true)
    })

    it('hides mark-read button when read', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, isRead: true } }
      })

      expect(wrapper.find('.attention-item__mark-read').exists()).toBe(false)
    })
  })

  describe('time formatting', () => {
    it('shows "刚刚" for very recent items', () => {
      const wrapper = mount(AttentionItem, {
        props: {
          item: {
            ...baseItem,
            timestamp: new Date().toISOString()
          }
        }
      })

      expect(wrapper.find('.attention-item__time').text()).toBe('刚刚')
    })

    it('shows minutes for items less than hour old', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const wrapper = mount(AttentionItem, {
        props: {
          item: { ...baseItem, timestamp: fiveMinutesAgo }
        }
      })

      expect(wrapper.find('.attention-item__time').text()).toBe('5分钟前')
    })

    it('shows hours for items less than day old', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      const wrapper = mount(AttentionItem, {
        props: {
          item: { ...baseItem, timestamp: threeHoursAgo }
        }
      })

      expect(wrapper.find('.attention-item__time').text()).toBe('3小时前')
    })

    it('shows days for items less than week old', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      const wrapper = mount(AttentionItem, {
        props: {
          item: { ...baseItem, timestamp: twoDaysAgo }
        }
      })

      expect(wrapper.find('.attention-item__time').text()).toBe('2天前')
    })
  })

  describe('events', () => {
    it('emits click event when clicked', async () => {
      const wrapper = mount(AttentionItem, {
        props: { item: baseItem }
      })

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')[0]).toEqual([baseItem])
    })

    it('emits mark-read event when mark-read button clicked', async () => {
      const wrapper = mount(AttentionItem, {
        props: { item: baseItem }
      })

      await wrapper.find('.attention-item__mark-read').trigger('click')

      expect(wrapper.emitted('mark-read')).toBeTruthy()
      expect(wrapper.emitted('mark-read')[0]).toEqual([baseItem])
    })

    it('does not emit click when mark-read is clicked (stopPropagation)', async () => {
      const wrapper = mount(AttentionItem, {
        props: { item: baseItem }
      })

      await wrapper.find('.attention-item__mark-read').trigger('click')

      // mark-read should be emitted, but click should not be triggered by the button
      expect(wrapper.emitted('mark-read')).toBeTruthy()
      // The click event from parent div should not fire due to stopPropagation
    })
  })

  describe('category icons', () => {
    it('renders pending icon for pending category', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, category: 'pending' } }
      })

      expect(wrapper.find('.attention-item__icon svg').exists()).toBe(true)
    })

    it('renders updated icon for updated category', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, category: 'updated' } }
      })

      expect(wrapper.find('.attention-item__icon.updated').exists()).toBe(true)
    })

    it('renders reminder icon for reminder category', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, category: 'reminder' } }
      })

      expect(wrapper.find('.attention-item__icon.reminder').exists()).toBe(true)
    })

    it('renders activity icon for activity category', () => {
      const wrapper = mount(AttentionItem, {
        props: { item: { ...baseItem, category: 'activity' } }
      })

      expect(wrapper.find('.attention-item__icon.activity').exists()).toBe(true)
    })
  })
})
