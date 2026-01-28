/**
 * Element Discovery Module
 *
 * Automatically discovers form elements from semantic HTML structure
 * without requiring manual annotations or schema files.
 */

import { getWidgetDefinition, type WidgetState } from './widget-registry'

// Element types that can be discovered
export type ElementType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'number'
  | 'date'
  | 'datetime'
  | 'time'
  | 'file'
  | 'dialog-trigger'
  | 'unknown'

// Option for select elements
export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

// Discovered agent element
export interface AgentElement {
  id: string
  label: string
  type: ElementType
  value: unknown
  options?: SelectOption[]
  required: boolean
  visible: boolean
  disabled: boolean
  placeholder?: string
  // Widget-specific properties
  widgetType?: string
  widgetState?: WidgetState
  interactionHint?: {
    type: 'modal' | 'dropdown' | 'inline'
    triggerSelector?: string
    modalSelector?: string
    selectionEvent?: string
  }
}

// Discovery options
export interface DiscoveryOptions {
  formSelector?: string
  includeHidden?: boolean
}

/**
 * Infer element type from DOM element
 */
export function inferElementType(formItem: Element): ElementType {
  // Check for widget data attribute first
  const widgetEl = formItem.querySelector('[data-widget]')
  if (widgetEl) {
    return 'dialog-trigger'
  }

  // Check for input elements
  const input = formItem.querySelector('input')
  if (input) {
    const inputType = input.type?.toLowerCase() || 'text'
    switch (inputType) {
      case 'text':
      case 'email':
      case 'url':
      case 'tel':
      case 'search':
        return 'text'
      case 'number':
        return 'number'
      case 'checkbox':
        return 'checkbox'
      case 'radio':
        return 'radio'
      case 'date':
        return 'date'
      case 'datetime-local':
        return 'datetime'
      case 'time':
        return 'time'
      case 'file':
        return 'file'
      default:
        return 'text'
    }
  }

  // Check for select
  const select = formItem.querySelector('select')
  if (select) {
    return 'select'
  }

  // Check for Element-UI select (has el-select class)
  const elSelect = formItem.querySelector('.el-select')
  if (elSelect) {
    return 'select'
  }

  // Check for textarea
  const textarea = formItem.querySelector('textarea')
  if (textarea) {
    return 'textarea'
  }

  // Check for button that might trigger a modal
  const button = formItem.querySelector('button, .el-button')
  if (button) {
    return 'dialog-trigger'
  }

  return 'unknown'
}

/**
 * Extract current value from form element
 */
export function extractCurrentValue(formItem: Element): unknown {
  // Check for widget first
  const widgetEl = formItem.querySelector('[data-widget]')
  if (widgetEl) {
    const widgetType = widgetEl.getAttribute('data-widget')
    if (widgetType) {
      const definition = getWidgetDefinition(widgetType)
      if (definition) {
        const state = definition.getState(widgetEl)
        return state.selectedId || state.value || null
      }
    }
    // Fallback: check data attributes
    return (
      widgetEl.getAttribute('data-selected-id') ||
      widgetEl.getAttribute('data-value') ||
      null
    )
  }

  // Input element
  const input = formItem.querySelector('input') as HTMLInputElement | null
  if (input) {
    if (input.type === 'checkbox') {
      return input.checked
    }
    if (input.type === 'radio') {
      const radioGroup = formItem.querySelectorAll(
        `input[name="${input.name}"]`
      ) as NodeListOf<HTMLInputElement>
      for (const radio of radioGroup) {
        if (radio.checked) return radio.value
      }
      return null
    }
    if (input.type === 'number') {
      return input.value ? Number(input.value) : null
    }
    return input.value || null
  }

  // Native select
  const select = formItem.querySelector('select') as HTMLSelectElement | null
  if (select) {
    return select.value || null
  }

  // Element-UI select - check for hidden input or data binding
  const elSelect = formItem.querySelector('.el-select')
  if (elSelect) {
    // Try to find the actual input inside el-select
    const elInput = elSelect.querySelector('.el-input__inner') as HTMLInputElement | null
    if (elInput) {
      // The displayed value might differ from actual value
      // Check for a hidden input that stores the actual value
      const hiddenInput = elSelect.querySelector('input[type="hidden"]') as HTMLInputElement | null
      if (hiddenInput) {
        return hiddenInput.value || null
      }
      return elInput.value || null
    }
  }

  // Textarea
  const textarea = formItem.querySelector('textarea') as HTMLTextAreaElement | null
  if (textarea) {
    return textarea.value || null
  }

  return null
}

/**
 * Extract options from select element
 */
export function extractOptions(formItem: Element): SelectOption[] | undefined {
  const options: SelectOption[] = []

  // Native select
  const select = formItem.querySelector('select') as HTMLSelectElement | null
  if (select) {
    for (const option of select.options) {
      if (option.value) {
        options.push({
          value: option.value,
          label: option.textContent?.trim() || option.value,
          disabled: option.disabled,
        })
      }
    }
    return options.length > 0 ? options : undefined
  }

  // Element-UI select - options are in dropdown which may not be visible
  // We can check for el-select-dropdown__item elements if dropdown is open
  // Or check for options data attribute
  const elSelect = formItem.querySelector('.el-select')
  if (elSelect) {
    const optionsAttr = elSelect.getAttribute('data-options')
    if (optionsAttr) {
      try {
        return JSON.parse(optionsAttr)
      } catch {
        // Ignore parse errors
      }
    }
    // Try to find dropdown items if visible
    const dropdownItems = document.querySelectorAll('.el-select-dropdown__item')
    for (const item of dropdownItems) {
      const value = item.getAttribute('data-value')
      const label = item.textContent?.trim()
      if (value && label) {
        options.push({ value, label })
      }
    }
    return options.length > 0 ? options : undefined
  }

  return undefined
}

/**
 * Check if element is visible
 */
function isVisible(element: Element): boolean {
  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false
  }

  // Check if inside a collapsed section
  let parent = element.parentElement
  while (parent) {
    const parentStyle = window.getComputedStyle(parent)
    if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden') {
      return false
    }
    parent = parent.parentElement
  }

  return true
}

/**
 * Generate a unique ID for elements without prop
 */
function generateId(formItem: Element, index: number): string {
  // Try to find any identifying attribute
  const labelEl = formItem.querySelector('.el-form-item__label')
  if (labelEl) {
    const label = labelEl.textContent?.trim()
    if (label) {
      return `field_${label.replace(/\s+/g, '_').toLowerCase()}`
    }
  }
  return `field_${index}`
}

/**
 * Extract field ID from a form item
 * Checks multiple sources: data-field-id, prop attribute, label text
 */
function extractFieldId(formItem: Element, index: number): string {
  // Priority 1: data-field-id attribute on the form item itself
  const fieldIdAttr = formItem.getAttribute('data-field-id')
  if (fieldIdAttr) return fieldIdAttr

  // Priority 2: prop attribute on a child element (Element-UI pattern)
  const propEl = formItem.querySelector('[prop]')
  if (propEl?.getAttribute('prop')) return propEl.getAttribute('prop')!

  // Priority 3: data-field-id on an input/select inside
  const inputWithId = formItem.querySelector('[data-field-id]')
  if (inputWithId?.getAttribute('data-field-id')) {
    return inputWithId.getAttribute('data-field-id')!
  }

  // Priority 4: Generate from label text
  return generateId(formItem, index)
}

/**
 * Extract label from a form item
 * Supports both Element-UI and custom form patterns
 */
function extractLabel(formItem: Element): string {
  // Element-UI pattern
  const elLabel = formItem.querySelector('.el-form-item__label')
  if (elLabel) return elLabel.textContent?.trim() || ''

  // Custom pattern: .form-label
  const customLabel = formItem.querySelector('.form-label')
  if (customLabel) return customLabel.textContent?.trim() || ''

  // Generic label element
  const genericLabel = formItem.querySelector('label')
  if (genericLabel) return genericLabel.textContent?.trim() || ''

  return ''
}

/**
 * Check if a form item is required
 */
function isRequired(formItem: Element): boolean {
  // Element-UI pattern
  if (formItem.classList.contains('is-required')) return true

  // Check for .required span in label
  const requiredSpan = formItem.querySelector('.required')
  if (requiredSpan) return true

  // Check for required attribute on input
  const input = formItem.querySelector('[required]')
  if (input) return true

  return false
}

/**
 * Discover all form elements on the page
 */
export function discoverFormElements(options: DiscoveryOptions = {}): AgentElement[] {
  const { formSelector, includeHidden = false } = options

  // Find form items - support both Element-UI and custom patterns
  let formItems: Element[] = []

  if (formSelector) {
    const form = document.querySelector(formSelector)
    if (!form) return []
    // Try Element-UI first, then custom
    const elItems = form.querySelectorAll('.el-form-item')
    const customItems = form.querySelectorAll('.form-group[data-field-id]')
    formItems = [...Array.from(elItems), ...Array.from(customItems)]
  } else {
    // Global search - combine both patterns
    const elItems = document.querySelectorAll('.el-form-item')
    const customItems = document.querySelectorAll('.form-group[data-field-id]')
    formItems = [...Array.from(elItems), ...Array.from(customItems)]
  }

  const elements: AgentElement[] = []
  const seenIds = new Set<string>()
  let index = 0

  for (const formItem of formItems) {
    // Check for agent-ignore
    if (formItem.hasAttribute('data-agent-ignore')) {
      continue
    }

    // Check visibility
    const visible = isVisible(formItem)
    if (!visible && !includeHidden) {
      continue
    }

    // Extract field ID
    const id = extractFieldId(formItem, index++)

    // Skip duplicates
    if (seenIds.has(id)) continue
    seenIds.add(id)

    // Extract label
    const label = extractLabel(formItem)

    // Infer type
    const type = inferElementType(formItem)

    // Extract value
    const value = extractCurrentValue(formItem)

    // Extract options for select
    const selectOptions = type === 'select' ? extractOptions(formItem) : undefined

    // Check required
    const required = isRequired(formItem)

    // Check disabled
    const inputEl = formItem.querySelector('input, select, textarea, button')
    const disabled = inputEl?.hasAttribute('disabled') || false

    // Extract placeholder
    const placeholderEl = formItem.querySelector('[placeholder]')
    const placeholder = placeholderEl?.getAttribute('placeholder') || undefined

    // Build element descriptor
    const element: AgentElement = {
      id,
      label,
      type,
      value,
      options: selectOptions,
      required,
      visible,
      disabled,
      placeholder,
    }

    // Check for widget
    const widgetEl = formItem.querySelector('[data-widget]')
    if (widgetEl) {
      const widgetType = widgetEl.getAttribute('data-widget')
      if (widgetType) {
        element.widgetType = widgetType
        const definition = getWidgetDefinition(widgetType)
        if (definition) {
          element.widgetState = definition.getState(widgetEl)
          element.interactionHint = definition.getInteractionHint()
        }
      }
    }

    elements.push(element)
  }

  return elements
}

/**
 * Find a specific element by ID
 */
export function findElementById(id: string): AgentElement | null {
  const elements = discoverFormElements({ includeHidden: true })
  return elements.find((el) => el.id === id) || null
}

/**
 * Get the DOM element for a field by ID
 */
export function getDOMElementByFieldId(fieldId: string): Element | null {
  // Priority 1: data-field-id attribute on form-group
  const byFieldId = document.querySelector(`.form-group[data-field-id="${fieldId}"]`)
  if (byFieldId) {
    return byFieldId
  }

  // Priority 2: prop attribute (Element-UI pattern)
  const byProp = document.querySelector(`[prop="${fieldId}"]`)
  if (byProp) {
    // Return the form item container
    return byProp.closest('.el-form-item')
  }

  // Priority 3: data-field-id on input inside el-form-item
  const byInputFieldId = document.querySelector(`.el-form-item [data-field-id="${fieldId}"]`)
  if (byInputFieldId) {
    return byInputFieldId.closest('.el-form-item')
  }

  // Fallback: search through form items
  const formItems = document.querySelectorAll('.el-form-item')
  for (const formItem of formItems) {
    const propEl = formItem.querySelector('[prop]')
    if (propEl?.getAttribute('prop') === fieldId) {
      return formItem
    }
  }

  return null
}
