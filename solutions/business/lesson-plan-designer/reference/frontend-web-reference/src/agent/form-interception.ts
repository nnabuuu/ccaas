/**
 * Form Interception Module
 *
 * Intercepts form submissions to capture success/error outcomes
 * and report them back to the agent.
 */

// Validation error structure
export interface ValidationError {
  field: string
  message: string
  code?: string
}

// Form submit result
export interface FormSubmitResult {
  success: boolean
  data?: unknown
  error?: string
  validationErrors?: ValidationError[]
  redirectUrl?: string
}

// Event emitter callback type
export type FormEventCallback = (result: FormSubmitResult) => void

// Store for event listeners
const formEventListeners: FormEventCallback[] = []

/**
 * Subscribe to form submission events
 */
export function onFormSubmit(callback: FormEventCallback): () => void {
  formEventListeners.push(callback)
  // Return unsubscribe function
  return () => {
    const index = formEventListeners.indexOf(callback)
    if (index > -1) {
      formEventListeners.splice(index, 1)
    }
  }
}

/**
 * Emit form submission result to all listeners
 */
function emitFormResult(result: FormSubmitResult): void {
  for (const listener of formEventListeners) {
    try {
      listener(result)
    } catch (error) {
      console.error('[FormInterception] Error in listener:', error)
    }
  }
}

/**
 * Extract validation errors from API error response
 */
export function extractValidationErrors(error: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (!error || typeof error !== 'object') {
    return errors
  }

  // Handle axios error format
  const axiosError = error as {
    response?: {
      data?: {
        msg?: string
        message?: string
        errors?: Array<{ field: string; message: string; code?: string }>
        data?: {
          errors?: Array<{ field: string; message: string; code?: string }>
        }
      }
    }
  }

  const responseData = axiosError.response?.data

  if (!responseData) {
    return errors
  }

  // Check for errors array in response
  const errorsArray = responseData.errors || responseData.data?.errors

  if (Array.isArray(errorsArray)) {
    for (const err of errorsArray) {
      if (err.field && err.message) {
        errors.push({
          field: err.field,
          message: err.message,
          code: err.code,
        })
      }
    }
    return errors
  }

  // Fallback: create single error from message
  const message = responseData.msg || responseData.message
  if (message) {
    errors.push({
      field: '_general',
      message: String(message),
    })
  }

  return errors
}

/**
 * Create an intercepted submit function
 *
 * Wraps an async submit function to capture its result
 */
export function createInterceptedSubmit<T>(
  originalSubmit: () => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void
    onError?: (error: unknown) => void
  }
): () => Promise<T> {
  return async () => {
    try {
      const result = await originalSubmit()

      // Emit success
      emitFormResult({
        success: true,
        data: result,
      })

      options?.onSuccess?.(result)
      return result
    } catch (error) {
      // Extract validation errors
      const validationErrors = extractValidationErrors(error)

      // Get error message
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }

      // Emit error
      emitFormResult({
        success: false,
        error: errorMessage,
        validationErrors,
      })

      options?.onError?.(error)
      throw error
    }
  }
}

/**
 * Intercept Element-UI form submission
 *
 * Usage in component:
 * ```typescript
 * import { interceptFormSubmission } from '@/agent/form-interception'
 *
 * const formRef = ref()
 *
 * onMounted(() => {
 *   interceptFormSubmission(formRef.value, async () => {
 *     await api.create(form)
 *     router.push(`/detail/${id}`)
 *   })
 * })
 * ```
 */
export function interceptFormSubmission(
  formRef: { validate: (callback: (valid: boolean) => void) => void } | null,
  submitFn: () => Promise<unknown>
): void {
  if (!formRef) {
    console.warn('[FormInterception] Form ref is null')
    return
  }

  // Store original validate function
  const originalValidate = formRef.validate.bind(formRef)

  // Create intercepted version
  formRef.validate = (callback: (valid: boolean) => void) => {
    originalValidate(async (valid: boolean) => {
      if (valid) {
        // Form is valid, proceed with submission
        try {
          await submitFn()
          callback(true)
        } catch (error) {
          // Error already emitted by createInterceptedSubmit
          callback(false)
        }
      } else {
        // Form validation failed
        emitFormResult({
          success: false,
          error: 'Form validation failed',
          validationErrors: [
            {
              field: '_validation',
              message: 'Please check form fields',
            },
          ],
        })
        callback(false)
      }
    })
  }
}

/**
 * Create a submission tracker that detects navigation after submit
 */
export function createSubmissionTracker(): {
  markSubmitting: () => void
  checkNavigation: (newPath: string) => void
} {
  let isSubmitting = false
  let submitTime = 0

  return {
    markSubmitting: () => {
      isSubmitting = true
      submitTime = Date.now()
    },
    checkNavigation: (newPath: string) => {
      // Only correlate if navigation happens within 5 seconds of submission
      if (isSubmitting && Date.now() - submitTime < 5000) {
        emitFormResult({
          success: true,
          redirectUrl: newPath,
        })
        isSubmitting = false
      }
    },
  }
}

