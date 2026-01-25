/**
 * FormStateSynchronizer Service
 *
 * Bridges Vue reactivity with external form updates.
 * Provides a centralized way to update form state from any source.
 *
 * @example
 * ```ts
 * // In Vue component
 * const formState = reactive({ subject: '', chapterId: null })
 * onMounted(() => formStateSynchronizer.registerForm('my-form', formState))
 * onUnmounted(() => formStateSynchronizer.unregisterForm('my-form'))
 *
 * // From agent or A2UI
 * formStateSynchronizer.updateFields('my-form', { chapterId: 245 }, 'agent')
 * ```
 */

import type { FormUpdateEvent, FormUpdateSource } from '../types/form-bridge'

type FormState = Record<string, unknown>
type EventHandler<T> = (event: T) => void

/**
 * Form State Synchronizer class
 */
export class FormStateSynchronizer {
  private forms = new Map<string, FormState>()
  private handlers = new Map<string, Set<EventHandler<FormUpdateEvent>>>()

  /**
   * Register a form's reactive state for synchronization.
   * Called by Vue component on mount.
   */
  registerForm(formId: string, reactiveState: FormState): void {
    this.forms.set(formId, reactiveState)
    console.log(`[FormStateSynchronizer] Registered form: ${formId}`)
  }

  /**
   * Unregister form on component unmount.
   */
  unregisterForm(formId: string): void {
    this.forms.delete(formId)
    console.log(`[FormStateSynchronizer] Unregistered form: ${formId}`)
  }

  /**
   * Check if a form is registered.
   */
  hasForm(formId: string): boolean {
    return this.forms.has(formId)
  }

  /**
   * Update a single form field from any source.
   */
  updateField(
    formId: string,
    field: string,
    value: unknown,
    source: FormUpdateSource
  ): boolean {
    const form = this.forms.get(formId)
    if (!form) {
      console.warn(`[FormStateSynchronizer] Form ${formId} not registered`)
      return false
    }

    // Capture old value before update (for diff highlighting)
    const oldValue = form[field]

    // Update the reactive state - Vue will detect this
    form[field] = value

    // Emit event for cross-component notification
    this.emit({
      formId,
      field,
      value,
      oldValue,
      source,
      timestamp: Date.now(),
    })

    console.log(
      `[FormStateSynchronizer] Updated ${formId}.${field} = ${JSON.stringify(value)} (source: ${source})`
    )
    return true
  }

  /**
   * Bulk update multiple fields.
   */
  updateFields(
    formId: string,
    updates: Record<string, unknown>,
    source: FormUpdateSource
  ): boolean {
    const form = this.forms.get(formId)
    if (!form) {
      console.warn(`[FormStateSynchronizer] Form ${formId} not registered`)
      return false
    }

    for (const [field, value] of Object.entries(updates)) {
      const oldValue = form[field]
      form[field] = value
      this.emit({
        formId,
        field,
        value,
        oldValue,
        source,
        timestamp: Date.now(),
      })
    }

    console.log(
      `[FormStateSynchronizer] Updated ${formId} with ${Object.keys(updates).length} fields (source: ${source})`
    )
    return true
  }

  /**
   * Get current form state (for sending to agent).
   */
  getFormState(formId: string): FormState | null {
    return this.forms.get(formId) ?? null
  }

  /**
   * Get a shallow copy of form state (safe for serialization).
   */
  getFormStateCopy(formId: string): FormState | null {
    const form = this.forms.get(formId)
    return form ? { ...form } : null
  }

  /**
   * Subscribe to form updates.
   * Returns unsubscribe function.
   */
  onFormUpdated(handler: EventHandler<FormUpdateEvent>): () => void {
    const key = 'form:updated'
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set())
    }
    this.handlers.get(key)!.add(handler)

    return () => {
      this.handlers.get(key)?.delete(handler)
    }
  }

  /**
   * Subscribe to updates for a specific form only.
   */
  onFormUpdatedFor(
    formId: string,
    handler: EventHandler<FormUpdateEvent>
  ): () => void {
    return this.onFormUpdated((event) => {
      if (event.formId === formId) {
        handler(event)
      }
    })
  }

  private emit(event: FormUpdateEvent): void {
    const handlers = this.handlers.get('form:updated')
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event)
        } catch (err) {
          console.error('[FormStateSynchronizer] Handler error:', err)
        }
      }
    }
  }

  /**
   * Debug: list all registered forms
   */
  debug(): { formId: string; fields: string[] }[] {
    return Array.from(this.forms.entries()).map(([formId, state]) => ({
      formId,
      fields: Object.keys(state),
    }))
  }

  /**
   * Clear all registered forms (for testing)
   */
  clear(): void {
    this.forms.clear()
    this.handlers.clear()
  }
}

// Singleton instance
let instance: FormStateSynchronizer | null = null

/**
 * Get the singleton FormStateSynchronizer instance
 */
export function getFormStateSynchronizer(): FormStateSynchronizer {
  if (!instance) {
    instance = new FormStateSynchronizer()
  }
  return instance
}

/**
 * Create a new FormStateSynchronizer instance (for testing)
 */
export function createFormStateSynchronizer(): FormStateSynchronizer {
  return new FormStateSynchronizer()
}

// Default export
export default FormStateSynchronizer
