/**
 * FormStateSynchronizer - Bridges Vue reactivity with external form updates
 *
 * Problem: When A2UI or agent updates form data via socket command,
 * Vue's reactivity might not trigger because the update comes from outside the component.
 *
 * Solution: A centralized synchronizer that:
 * 1. Holds references to registered reactive form states
 * 2. Provides a single entry point for all form updates
 * 3. Emits events for cross-component notification
 *
 * Usage:
 * ```ts
 * // In Vue component
 * const formState = reactive({ subject: '', chapterId: null })
 * onMounted(() => formStateSynchronizer.registerForm('my-form', formState))
 * onUnmounted(() => formStateSynchronizer.unregisterForm('my-form'))
 *
 * // From A2UI or agent
 * formStateSynchronizer.updateFields('my-form', { chapterId: 245 }, 'a2ui')
 * ```
 */

type FormState = Record<string, unknown>

type UpdateSource = 'manual' | 'a2ui' | 'agent'

/**
 * Section names that can be updated via AI generation
 */
export type LessonPlanSectionName =
  | 'courseRequirements'
  | 'textbookAnalysis'
  | 'learningObjectives'
  | 'studentAnalysis'
  | 'preClassPreparation'
  | 'learningProcess'
  | 'homeworkAssessment'

/**
 * Check if a section name is valid for AI generation
 */
export function isValidLessonPlanSection(name: string): name is LessonPlanSectionName {
  return [
    'courseRequirements',
    'textbookAnalysis',
    'learningObjectives',
    'studentAnalysis',
    'preClassPreparation',
    'learningProcess',
    'homeworkAssessment',
  ].includes(name)
}

export interface FormUpdateEvent {
  formId: string
  field: string
  value: unknown
  oldValue?: unknown  // Previous value before update (for diff highlighting)
  source: UpdateSource
  timestamp: number
}

type EventHandler<T> = (event: T) => void

class FormStateSynchronizer {
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
    source: UpdateSource
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

    console.log(`[FormStateSynchronizer] Updated ${formId}.${field} = ${JSON.stringify(value)} (source: ${source})`)
    return true
  }

  /**
   * Bulk update multiple fields.
   */
  updateFields(
    formId: string,
    updates: Record<string, unknown>,
    source: UpdateSource
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

    console.log(`[FormStateSynchronizer] Updated ${formId} with ${Object.keys(updates).length} fields (source: ${source})`)
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
  onFormUpdatedFor(formId: string, handler: EventHandler<FormUpdateEvent>): () => void {
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
   * Update a lesson plan content section.
   * This is a convenience method for AI-generated content updates.
   *
   * The lesson plan form should be registered with ID 'lessonPlanContent'
   * and have section names as fields (e.g., 'textbookAnalysis', 'learningObjectives')
   *
   * @param sectionName - The section to update
   * @param content - The generated content
   * @param source - Update source (default: 'agent')
   * @returns Whether the update was successful
   */
  updateLessonPlanSection(
    sectionName: LessonPlanSectionName,
    content: unknown,
    source: UpdateSource = 'agent'
  ): boolean {
    const formId = 'lessonPlanContent'

    if (!this.forms.has(formId)) {
      console.warn(`[FormStateSynchronizer] Lesson plan content form not registered`)
      return false
    }

    return this.updateField(formId, sectionName, content, source)
  }

  /**
   * Update multiple lesson plan sections at once.
   * Used when generating all sections in batch.
   *
   * @param sections - Map of section name to content
   * @param source - Update source (default: 'agent')
   * @returns Whether all updates were successful
   */
  updateLessonPlanSections(
    sections: Partial<Record<LessonPlanSectionName, unknown>>,
    source: UpdateSource = 'agent'
  ): boolean {
    const formId = 'lessonPlanContent'

    if (!this.forms.has(formId)) {
      console.warn(`[FormStateSynchronizer] Lesson plan content form not registered`)
      return false
    }

    let allSuccess = true
    for (const [sectionName, content] of Object.entries(sections)) {
      if (isValidLessonPlanSection(sectionName)) {
        const success = this.updateField(formId, sectionName, content, source)
        if (!success) allSuccess = false
      }
    }

    return allSuccess
  }
}

// Singleton instance
export const formStateSynchronizer = new FormStateSynchronizer()

// Export class for testing
export { FormStateSynchronizer }
