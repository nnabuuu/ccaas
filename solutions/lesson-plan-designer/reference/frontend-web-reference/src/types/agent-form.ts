/**
 * Agent Form Bridge Types
 *
 * Provides type definitions for AI agent to interact with Vue forms
 * using provide/inject pattern instead of DOM manipulation.
 */

/**
 * Result of applying form data
 */
export interface ApplyResult {
  success: boolean
  errors?: FieldError[]
  appliedFields?: string[]
  formState?: Record<string, unknown>
}

/**
 * Field validation error with hint for AI to fix
 */
export interface FieldError {
  field: string
  message: string
  expected?: string // Hint for AI to fix
}

/**
 * Result of form submission
 */
export interface SubmitResult {
  success: boolean
  result?: unknown
  error?: string
}

/**
 * Field definition for schema discovery
 */
export interface FormFieldShape {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array'
  required?: boolean
  options?: Array<{ value: unknown; label: string }>
  description?: string
}

/**
 * Form data shape for validation hints
 */
export interface FormDataShape {
  fields: FormFieldShape[]
}

/**
 * Handlers that a form view registers with AgentListener
 */
export interface AgentFormHandlers {
  /**
   * Apply data to form fields. Validates and sets values.
   * @returns { success: true } or { success: false, errors: FieldError[] }
   */
  applyFormData: (data: Record<string, unknown>) => Promise<ApplyResult>

  /**
   * Get current form state including all field values.
   */
  getFormState: () => Record<string, unknown>

  /**
   * Submit the form programmatically.
   * @returns { success: true, result: any } or { success: false, error: string }
   */
  submit: () => Promise<SubmitResult>

  /**
   * Get the data shape/schema for validation hints.
   * Returns field names, types, and constraints.
   */
  getDataShape?: () => FormDataShape

  /**
   * Whether this form is read-only (detail view).
   * AI can read but cannot modify.
   */
  readonly?: boolean
}

/**
 * Form registration function type (provided by AgentListener)
 */
export type RegisterAgentForm = (
  formId: string,
  handlers: AgentFormHandlers,
  onUnmount?: () => void
) => void

/**
 * Form info included in read_page_schema response
 */
export interface AgentFormInfo {
  formId: string
  readonly: boolean
  actions: string[]
  dataShape?: FormDataShape
  currentState: Record<string, unknown>
}

/**
 * Queued command waiting for form registration
 */
export interface PendingFormCommand {
  commandId: string
  formId: string
  data: Record<string, unknown>
  timestamp: number
}
