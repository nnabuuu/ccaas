/**
 * useFormBridge Composable
 *
 * Provides a composable for registering forms with the agent.
 * Auto-registers on mount and unregisters on unmount.
 */

import { ref, onMounted, onUnmounted, inject, computed } from 'vue'
import type { Ref } from 'vue'
import { RegisterAgentFormKey, UnregisterAgentFormKey } from '../symbols'
import type {
  AgentFormHandlers,
  ApplyResult,
  SubmitResult,
  FormDataShape,
} from '../types/form-bridge'

/**
 * Options for useFormBridge
 */
export interface UseFormBridgeOptions {
  /** Unique form identifier */
  formId: string
  /** Whether this form is read-only */
  readonly?: boolean
  /** Function to get current form state */
  getFormState: () => Record<string, unknown>
  /** Function to apply data to form */
  applyFormData: (data: Record<string, unknown>) => Promise<ApplyResult>
  /** Optional function to submit form */
  submit?: () => Promise<SubmitResult>
  /** Optional function to get form schema */
  getDataShape?: () => FormDataShape
}

/**
 * Return type for useFormBridge
 */
export interface UseFormBridgeReturn {
  /** Whether this form is currently active/registered */
  isActive: Readonly<Ref<boolean>>
  /** The form ID */
  formId: string
  /** Manually register the form (if not auto-registering) */
  register: () => void
  /** Manually unregister the form */
  unregister: () => void
}

/**
 * Form bridge composable
 *
 * @example
 * ```ts
 * const form = reactive({ title: '', content: '' })
 *
 * const { isActive } = useFormBridge({
 *   formId: 'my-form',
 *   getFormState: () => ({ ...form }),
 *   applyFormData: async (data) => {
 *     Object.assign(form, data)
 *     return { success: true, appliedFields: Object.keys(data) }
 *   }
 * })
 * ```
 */
export function useFormBridge(options: UseFormBridgeOptions): UseFormBridgeReturn {
  const {
    formId,
    readonly = false,
    getFormState,
    applyFormData,
    submit,
    getDataShape,
  } = options

  const isActive = ref(false)

  // Inject registration functions from AgentListener
  const registerAgentForm = inject(RegisterAgentFormKey, null)
  const unregisterAgentForm = inject(UnregisterAgentFormKey, null)

  // Create handlers object
  const handlers: AgentFormHandlers = {
    getFormState,
    applyFormData,
    submit,
    getDataShape,
    readonly,
  }

  /**
   * Register the form with the agent
   */
  function register(): void {
    if (!registerAgentForm) {
      console.warn(
        `[useFormBridge] registerAgentForm not provided. ` +
        `Make sure AgentListener is mounted as a parent component.`
      )
      return
    }

    registerAgentForm(formId, handlers, () => {
      isActive.value = false
    })
    isActive.value = true
    console.log(`[useFormBridge] Registered form: ${formId}`)
  }

  /**
   * Unregister the form from the agent
   */
  function unregister(): void {
    if (unregisterAgentForm) {
      unregisterAgentForm(formId)
    }
    isActive.value = false
    console.log(`[useFormBridge] Unregistered form: ${formId}`)
  }

  // Auto-register on mount
  onMounted(() => {
    register()
  })

  // Auto-unregister on unmount
  onUnmounted(() => {
    unregister()
  })

  return {
    isActive: computed(() => isActive.value),
    formId,
    register,
    unregister,
  }
}

export default useFormBridge
