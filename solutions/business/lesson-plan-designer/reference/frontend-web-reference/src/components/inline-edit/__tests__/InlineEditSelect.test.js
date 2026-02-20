import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import InlineEditSelect from '../InlineEditSelect.vue'

// Mock toast module
vi.mock('../../../utils/toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const defaultOptions = [
  { value: 'opt1', label: 'Option 1' },
  { value: 'opt2', label: 'Option 2' },
  { value: 'opt3', label: 'Option 3' }
]

describe('InlineEditSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('renders in view mode by default', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      expect(wrapper.find('.inline-edit-select__view').exists()).toBe(true)
      expect(wrapper.find('.inline-edit-select__select').exists()).toBe(false)
    })

    it('displays the label of selected option', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt2', options: defaultOptions }
      })

      expect(wrapper.find('.inline-edit-select__value').text()).toBe('Option 2')
    })

    it('shows placeholder when no value selected', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: '', options: defaultOptions, placeholder: '选择一项' }
      })

      expect(wrapper.find('.inline-edit-select__placeholder').text()).toBe('选择一项')
      expect(wrapper.classes()).toContain('inline-edit-select--empty')
    })

    it('applies readonly class', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions, readonly: true }
      })

      expect(wrapper.classes()).toContain('inline-edit-select--readonly')
    })

    it('hides chevron when readonly', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions, readonly: true }
      })

      expect(wrapper.find('.inline-edit-select__chevron').exists()).toBe(false)
    })
  })

  describe('opening dropdown', () => {
    it('opens select on click', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')

      expect(wrapper.find('.inline-edit-select__select').exists()).toBe(true)
      expect(wrapper.find('.inline-edit-select__view').exists()).toBe(false)
    })

    it('does not open when readonly', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions, readonly: true }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')

      expect(wrapper.find('.inline-edit-select__view').exists()).toBe(true)
      expect(wrapper.find('.inline-edit-select__select').exists()).toBe(false)
    })

    it('focuses select when opened', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions },
        attachTo: document.body
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')
      await nextTick()

      const select = wrapper.find('select')
      expect(document.activeElement).toBe(select.element)

      wrapper.unmount()
    })

    it('opens on Enter key', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('keydown', { key: 'Enter' })

      expect(wrapper.find('.inline-edit-select__select').exists()).toBe(true)
    })

    it('opens on Space key', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('keydown', { key: ' ' })

      expect(wrapper.find('.inline-edit-select__select').exists()).toBe(true)
    })
  })

  describe('select element', () => {
    it('renders all options', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')

      const options = wrapper.findAll('option')
      expect(options.length).toBe(3)
      expect(options[0].text()).toBe('Option 1')
      expect(options[1].text()).toBe('Option 2')
      expect(options[2].text()).toBe('Option 3')
    })

    it('shows placeholder option when empty', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: '', options: defaultOptions, placeholder: '请选择' }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')

      const options = wrapper.findAll('option')
      expect(options.length).toBe(4) // placeholder + 3 options
      expect(options[0].text()).toBe('请选择')
      expect(options[0].attributes('disabled')).toBeDefined()
    })

    it('has current value selected', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt2', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')

      expect(wrapper.find('select').element.value).toBe('opt2')
    })
  })

  describe('selecting', () => {
    it('emits update:modelValue on selection', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')
      await wrapper.find('select').setValue('opt2')
      await flushPromises()

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')[0]).toEqual(['opt2'])
    })

    it('emits save on selection', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')
      await wrapper.find('select').setValue('opt2')
      await flushPromises()

      expect(wrapper.emitted('save')).toBeTruthy()
      expect(wrapper.emitted('save')[0]).toEqual(['opt2'])
    })

    it('closes dropdown after selection', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')
      await wrapper.find('select').setValue('opt2')
      await flushPromises()

      expect(wrapper.find('.inline-edit-select__view').exists()).toBe(true)
      expect(wrapper.find('.inline-edit-select__select').exists()).toBe(false)
    })

    it('does not emit when selecting same value', async () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')
      // setValue to the same value (the component should detect unchanged)
      await wrapper.find('select').setValue('opt1')
      await flushPromises()

      expect(wrapper.emitted('save')).toBeFalsy()
    })
  })

  describe('closing', () => {
    it('closes on blur after delay', async () => {
      vi.useFakeTimers()
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      await wrapper.find('.inline-edit-select__view').trigger('click')
      await wrapper.find('select').trigger('blur')

      // Should still be open immediately
      expect(wrapper.find('.inline-edit-select__select').exists()).toBe(true)

      // After delay
      vi.advanceTimersByTime(200)
      await nextTick()

      expect(wrapper.find('.inline-edit-select__view').exists()).toBe(true)
      vi.useRealTimers()
    })
  })

  describe('accessibility', () => {
    it('has role button on view element', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      expect(wrapper.find('.inline-edit-select__view').attributes('role')).toBe('button')
    })

    it('has aria-label with selected label', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      expect(wrapper.find('.inline-edit-select__view').attributes('aria-label')).toContain('Option 1')
    })

    it('has aria-label with placeholder when empty', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: '', options: defaultOptions, placeholder: '选择选项' }
      })

      expect(wrapper.find('.inline-edit-select__view').attributes('aria-label')).toBe('选择选项')
    })

    it('is focusable when not readonly', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions }
      })

      expect(wrapper.find('.inline-edit-select__view').attributes('tabindex')).toBe('0')
    })

    it('is not focusable when readonly', () => {
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 'opt1', options: defaultOptions, readonly: true }
      })

      expect(wrapper.find('.inline-edit-select__view').attributes('tabindex')).toBe('-1')
    })
  })

  describe('numeric values', () => {
    it('handles numeric option values', async () => {
      const numericOptions = [
        { value: 1, label: 'First' },
        { value: 2, label: 'Second' },
        { value: 3, label: 'Third' }
      ]
      const wrapper = mount(InlineEditSelect, {
        props: { modelValue: 2, options: numericOptions }
      })

      expect(wrapper.find('.inline-edit-select__value').text()).toBe('Second')
    })
  })
})
