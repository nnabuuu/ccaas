/**
 * A2UI (Agent-to-UI) Types
 *
 * Structured UI components rendered by the agent for user interaction.
 * These types mirror the backend definitions in agentic-backend/src/agent/types.ts
 */

/**
 * Form binding configuration for A2UI components
 * When present, user selection updates form fields directly instead of sending to agent
 */
export interface A2UIFormBinding {
  formId: string           // Form identifier (e.g., "lesson-plan-create")
  fieldName: string        // Primary field to update with selection ID
  labelField?: string      // Optional field to update with selection label
  dataFields?: Record<string, string>  // Map option.data keys to form field names
  applyMode: 'immediate' | 'on-confirm'  // When to apply
}

/**
 * Option for pick list or button group
 */
export interface A2UIOption {
  id: string | number
  label: string
  description?: string
  meta?: string  // Additional context (e.g., "五年级下册 · 人教版")
  icon?: string
  data?: Record<string, unknown>  // Arbitrary data to pass back on selection
}

/**
 * Pick list component - for selecting from multiple options
 */
export interface A2UIPickList {
  type: 'pick_list'
  componentId: string
  title: string
  description?: string
  options: A2UIOption[]
  multiple?: boolean  // Allow multiple selection
  searchable?: boolean  // Show search input
  formBinding?: A2UIFormBinding  // If present, selection updates form directly
}

/**
 * Button group component - for quick action selection
 */
export interface A2UIButtonGroup {
  type: 'button_group'
  componentId: string
  title?: string
  buttons: A2UIOption[]
  layout?: 'horizontal' | 'vertical'
}

/**
 * Confirm dialog component - for yes/no decisions
 */
export interface A2UIConfirm {
  type: 'confirm'
  componentId: string
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  data?: Record<string, unknown>
}

/**
 * Progress indicator component - for multi-step workflows
 */
export interface A2UIProgress {
  type: 'progress'
  componentId: string
  title: string
  steps: Array<{
    label: string
    status: 'pending' | 'active' | 'completed' | 'error'
  }>
  currentStep: number
}

/**
 * Union type for all A2UI components
 */
export type A2UIComponent =
  | A2UIPickList
  | A2UIButtonGroup
  | A2UIConfirm
  | A2UIProgress

/**
 * User interaction response for A2UI components
 */
export interface A2UIInteraction {
  componentId: string
  action: 'select' | 'confirm' | 'cancel' | 'search'
  value: string | number | (string | number)[]  // Selected option ID(s)
  data?: Record<string, unknown>  // Echoed back data from option
}

/**
 * User action event sent to agent after form-bound A2UI selection
 */
export interface A2UIUserAction {
  type: 'user_action'
  action: 'field_updated'
  context: {
    formId: string
    field: string
    value: string | number
    label: string
    source: 'manual' | 'a2ui' | 'agent'
    formState: Record<string, unknown>
  }
}
