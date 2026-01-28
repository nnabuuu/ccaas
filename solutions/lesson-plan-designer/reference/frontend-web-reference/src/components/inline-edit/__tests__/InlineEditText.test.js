import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import InlineEditText from '../InlineEditText.vue'

// Mock toast module
vi.mock('../../../utils/toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('InlineEditText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders in view mode by default', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test value' }
      })

      expect(wrapper.find('.inline-edit-text__view').exists()).toBe(true)
      expect(wrapper.find('.inline-edit-text__edit').exists()).toBe(false)
      expect(wrapper.find('.inline-edit-text__value').text()).toBe('Test value')
    })

    it('shows placeholder when value is empty', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: '', placeholder: '请输入标题' }
      })

      expect(wrapper.find('.inline-edit-text__placeholder').text()).toBe('请输入标题')
      expect(wrapper.classes()).toContain('inline-edit-text--empty')
    })

    it('applies variant class', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Title', variant: 'title' }
      })

      expect(wrapper.classes()).toContain('inline-edit-text--title')
    })

    it('applies readonly class', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Value', readonly: true }
      })

      expect(wrapper.classes()).toContain('inline-edit-text--readonly')
    })

    it('hides edit icon when readonly', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Value', readonly: true }
      })

      expect(wrapper.find('.inline-edit-text__icon').exists()).toBe(false)
    })

    it('sets tabindex to -1 when readonly', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Value', readonly: true }
      })

      expect(wrapper.find('.inline-edit-text__view').attributes('tabindex')).toBe('-1')
    })
  })

  describe('entering edit mode', () => {
    it('enters edit mode on click', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')

      expect(wrapper.find('.inline-edit-text__edit').exists()).toBe(true)
      expect(wrapper.find('.inline-edit-text__view').exists()).toBe(false)
    })

    it('does not enter edit mode when readonly', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test', readonly: true }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')

      expect(wrapper.find('.inline-edit-text__view').exists()).toBe(true)
      expect(wrapper.find('.inline-edit-text__edit').exists()).toBe(false)
    })

    it('focuses input on edit', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test' },
        attachTo: document.body
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await nextTick()

      const input = wrapper.find('input')
      expect(document.activeElement).toBe(input.element)

      wrapper.unmount()
    })

    it('enters edit mode on Enter key', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('keydown', { key: 'Enter' })

      expect(wrapper.find('.inline-edit-text__edit').exists()).toBe(true)
    })

    it('enters edit mode on Space key', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('keydown', { key: ' ' })

      expect(wrapper.find('.inline-edit-text__edit').exists()).toBe(true)
    })
  })

  describe('editing', () => {
    it('populates input with current value', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Current Value' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')

      expect(wrapper.find('input').element.value).toBe('Current Value')
    })

    it('allows editing the value', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Old' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').setValue('New Value')

      expect(wrapper.find('input').element.value).toBe('New Value')
    })

    it('applies maxLength attribute', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test', maxLength: 50 }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')

      expect(wrapper.find('input').attributes('maxlength')).toBe('50')
    })
  })

  describe('saving', () => {
    it('emits save on blur with changed value', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Old' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').setValue('New')
      await wrapper.find('input').trigger('blur')
      await flushPromises()

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual(['New'])
    })

    it('emits update:modelValue on save', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Old' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').setValue('New')
      await wrapper.find('input').trigger('blur')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['New'])
    })

    it('saves on Enter key', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Old' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').setValue('New')
      await wrapper.find('input').trigger('keydown', { key: 'Enter' })
      await flushPromises()

      expect(wrapper.emitted('save')).toBeTruthy()
    })

    it('does not emit save when value unchanged', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Same' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').trigger('blur')
      await flushPromises()

      expect(wrapper.emitted('save')).toBeFalsy()
    })

    it('returns to view mode after save', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Old' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').setValue('New')
      await wrapper.find('input').trigger('blur')
      await flushPromises()

      expect(wrapper.find('.inline-edit-text__view').exists()).toBe(true)
      expect(wrapper.find('.inline-edit-text__edit').exists()).toBe(false)
    })
  })

  describe('canceling', () => {
    it('cancels on Escape key', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Original' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').setValue('Modified')
      await wrapper.find('input').trigger('keydown', { key: 'Escape' })

      expect(wrapper.find('.inline-edit-text__view').exists()).toBe(true)
      expect(wrapper.emitted('save')).toBeFalsy()
    })

    it('restores original value on cancel', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Original' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').setValue('Modified')
      await wrapper.find('input').trigger('keydown', { key: 'Escape' })

      // Re-enter edit mode to check the value
      await wrapper.find('.inline-edit-text__view').trigger('click')
      expect(wrapper.find('input').element.value).toBe('Original')
    })
  })

  describe('external value updates', () => {
    it('updates display when modelValue prop changes', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Initial' }
      })

      await wrapper.setProps({ modelValue: 'Updated' })

      expect(wrapper.find('.inline-edit-text__value').text()).toBe('Updated')
    })

    it('preserves edit value when prop changes during edit', async () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Initial' }
      })

      await wrapper.find('.inline-edit-text__view').trigger('click')
      await wrapper.find('input').setValue('User Input')
      await wrapper.setProps({ modelValue: 'External Update' })

      expect(wrapper.find('input').element.value).toBe('User Input')
    })
  })

  describe('accessibility', () => {
    it('has role button on view element', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test' }
      })

      expect(wrapper.find('.inline-edit-text__view').attributes('role')).toBe('button')
    })

    it('has aria-label with value', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test Value' }
      })

      expect(wrapper.find('.inline-edit-text__view').attributes('aria-label')).toContain('Test Value')
    })

    it('has aria-label with placeholder when empty', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: '', placeholder: '输入标题' }
      })

      expect(wrapper.find('.inline-edit-text__view').attributes('aria-label')).toBe('输入标题')
    })

    it('is focusable when not readonly', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Test' }
      })

      expect(wrapper.find('.inline-edit-text__view').attributes('tabindex')).toBe('0')
    })
  })

  describe('variants', () => {
    it('applies title variant styles', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Title', variant: 'title' }
      })

      expect(wrapper.classes()).toContain('inline-edit-text--title')
    })

    it('applies subtitle variant styles', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Subtitle', variant: 'subtitle' }
      })

      expect(wrapper.classes()).toContain('inline-edit-text--subtitle')
    })

    it('applies default variant styles', () => {
      const wrapper = mount(InlineEditText, {
        props: { modelValue: 'Default', variant: 'default' }
      })

      expect(wrapper.classes()).toContain('inline-edit-text--default')
    })
  })
})
