/**
 * Widget Registry Module
 *
 * Registry for complex widgets that require special handling
 * (modal pickers, tree selectors, etc.)
 */

// Widget state returned by getState
export interface WidgetState {
  selectedId?: string | number | null
  selectedLabel?: string | null
  value?: unknown
  [key: string]: unknown
}

// Interaction hint for agent
export interface InteractionHint {
  type: 'modal' | 'dropdown' | 'inline'
  triggerSelector?: string
  modalSelector?: string
  selectionEvent?: string
}

// Widget definition interface
export interface WidgetDefinition {
  /** Identify if an element matches this widget type */
  identify: (el: Element) => boolean
  /** Get current state of the widget */
  getState: (el: Element) => WidgetState
  /** Get interaction hints for the agent */
  getInteractionHint: () => InteractionHint
}

// Registry storage
const widgetRegistry = new Map<string, WidgetDefinition>()

/**
 * Register a widget definition
 */
export function registerWidget(name: string, definition: WidgetDefinition): void {
  widgetRegistry.set(name, definition)
}

/**
 * Get a widget definition by name
 */
export function getWidgetDefinition(name: string): WidgetDefinition | undefined {
  return widgetRegistry.get(name)
}

/**
 * Find widget type for an element
 */
export function identifyWidget(el: Element): string | null {
  // First check data-widget attribute
  const widgetAttr = el.getAttribute('data-widget')
  if (widgetAttr && widgetRegistry.has(widgetAttr)) {
    return widgetAttr
  }

  // Then try to identify by matching
  for (const [name, definition] of widgetRegistry) {
    if (definition.identify(el)) {
      return name
    }
  }

  return null
}

/**
 * Get all registered widget names
 */
export function getRegisteredWidgets(): string[] {
  return Array.from(widgetRegistry.keys())
}

// =============================================================================
// Built-in Widget Definitions
// =============================================================================

/**
 * Chapter Picker Widget
 *
 * A modal-based tree picker for selecting textbook chapters
 */
registerWidget('chapter-picker', {
  identify: (el: Element): boolean => {
    // Check for explicit data-widget attribute
    if (el.getAttribute('data-widget') === 'chapter-picker') {
      return true
    }
    // Check for common trigger patterns
    if (el.querySelector('.textbook-chapter-trigger')) {
      return true
    }
    if (el.classList.contains('chapter-picker-trigger')) {
      return true
    }
    return false
  },

  getState: (el: Element): WidgetState => {
    // Try data attributes first
    const selectedId =
      el.getAttribute('data-selected-chapter-id') ||
      el.getAttribute('data-selected-id') ||
      el.getAttribute('data-value')

    const selectedLabel =
      el.getAttribute('data-selected-label') ||
      el.querySelector('.selected-chapter-label')?.textContent?.trim() ||
      el.querySelector('.selected-label')?.textContent?.trim()

    return {
      selectedId: selectedId ? (isNaN(Number(selectedId)) ? selectedId : Number(selectedId)) : null,
      selectedLabel: selectedLabel || null,
    }
  },

  getInteractionHint: (): InteractionHint => ({
    type: 'modal',
    triggerSelector: '.textbook-chapter-trigger, .chapter-picker-trigger, [data-widget="chapter-picker"] button',
    modalSelector: '.chapter-picker-modal, .textbook-chapter-modal, .el-dialog',
    selectionEvent: 'chapter:selected',
  }),
})

/**
 * Curriculum Standard Picker Widget
 *
 * A tree picker for selecting curriculum standards
 */
registerWidget('curriculum-picker', {
  identify: (el: Element): boolean => {
    if (el.getAttribute('data-widget') === 'curriculum-picker') {
      return true
    }
    if (el.querySelector('.curriculum-standard-trigger')) {
      return true
    }
    return false
  },

  getState: (el: Element): WidgetState => {
    const selectedIds = el.getAttribute('data-selected-ids')
    const selectedLabels = el.getAttribute('data-selected-labels')

    return {
      selectedIds: selectedIds ? JSON.parse(selectedIds) : [],
      selectedLabels: selectedLabels ? JSON.parse(selectedLabels) : [],
      value: selectedIds ? JSON.parse(selectedIds) : [],
    }
  },

  getInteractionHint: (): InteractionHint => ({
    type: 'modal',
    triggerSelector: '.curriculum-standard-trigger, [data-widget="curriculum-picker"] button',
    modalSelector: '.curriculum-picker-modal, .el-dialog',
    selectionEvent: 'curriculum:selected',
  }),
})

/**
 * Date Picker Widget
 *
 * Element-UI date picker
 */
registerWidget('date-picker', {
  identify: (el: Element): boolean => {
    if (el.getAttribute('data-widget') === 'date-picker') {
      return true
    }
    if (el.querySelector('.el-date-editor')) {
      return true
    }
    return false
  },

  getState: (el: Element): WidgetState => {
    const input = el.querySelector('.el-input__inner') as HTMLInputElement | null
    return {
      value: input?.value || null,
      selectedLabel: input?.value || null,
    }
  },

  getInteractionHint: (): InteractionHint => ({
    type: 'dropdown',
    triggerSelector: '.el-date-editor .el-input__inner',
    selectionEvent: 'change',
  }),
})

/**
 * File Upload Widget
 */
registerWidget('file-upload', {
  identify: (el: Element): boolean => {
    if (el.getAttribute('data-widget') === 'file-upload') {
      return true
    }
    if (el.querySelector('.el-upload')) {
      return true
    }
    return false
  },

  getState: (el: Element): WidgetState => {
    const fileList = el.querySelectorAll('.el-upload-list__item')
    const files = Array.from(fileList).map((item) => ({
      name: item.querySelector('.el-upload-list__item-name')?.textContent?.trim(),
    }))

    return {
      files,
      hasFiles: files.length > 0,
      value: files,
    }
  },

  getInteractionHint: (): InteractionHint => ({
    type: 'inline',
    triggerSelector: '.el-upload__input',
    selectionEvent: 'change',
  }),
})

