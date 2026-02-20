import { ref, readonly, type Ref, type DeepReadonly } from 'vue'
import toast from '../utils/toast'

/**
 * Options for useAutoSave composable
 */
interface AutoSaveOptions<T = unknown> {
  /** Async function to call when saving */
  onSave?: (value: T) => Promise<void>
  /** Debounce delay in milliseconds (default: 300) */
  debounceMs?: number
  /** Show toast notifications (default: true) */
  showToast?: boolean
  /** Success toast message (default: '已保存') */
  successMessage?: string
  /** Error toast message (default: '保存失败') */
  errorMessage?: string
}

/**
 * Return type for useAutoSave composable
 */
interface AutoSaveReturn<T = unknown> {
  saving: DeepReadonly<Ref<boolean>>
  error: DeepReadonly<Ref<string | null>>
  lastSaved: DeepReadonly<Ref<Date | null>>
  save: (value: T) => void
  saveNow: (value?: T) => Promise<boolean>
  cancel: () => void
  retry: (value: T) => Promise<boolean>
  clearError: () => void
  hasPending: () => boolean
}

/**
 * Composable for auto-save with debounce
 *
 * @param options - Configuration options
 * @returns Auto-save state and methods
 */
export function useAutoSave<T = unknown>(options: AutoSaveOptions<T> = {}): AutoSaveReturn<T> {
  const {
    onSave = async () => {},
    debounceMs = 300,
    showToast = true,
    successMessage = '已保存',
    errorMessage = '保存失败'
  } = options

  // State
  const saving = ref(false)
  const error = ref<string | null>(null)
  const lastSaved = ref<Date | null>(null)
  const pendingValue = ref<T | null>(null) as Ref<T | null>

  // Debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Internal save function
   * @param value - Value to save
   */
  async function executeSave(value: T): Promise<boolean> {
    saving.value = true
    error.value = null

    try {
      await onSave(value)
      lastSaved.value = new Date()
      pendingValue.value = null
      if (showToast) {
        toast.success(successMessage, 2000)
      }
      return true
    } catch (err) {
      error.value = (err as Error).message || errorMessage
      if (showToast) {
        toast.error(error.value)
      }
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Save with debounce
   * @param value - Value to save
   */
  function save(value: T): void {
    pendingValue.value = value

    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    // Set new timer
    debounceTimer = setTimeout(() => {
      executeSave(value)
      debounceTimer = null
    }, debounceMs)
  }

  /**
   * Save immediately (cancels debounce)
   * @param value - Value to save (uses pending value if not provided)
   */
  async function saveNow(value?: T): Promise<boolean> {
    // Clear debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    const valueToSave = value !== undefined ? value : pendingValue.value
    if (valueToSave !== null) {
      return executeSave(valueToSave)
    }
    return true
  }

  /**
   * Cancel pending save
   */
  function cancel(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    pendingValue.value = null
  }

  /**
   * Retry the last failed save
   * @param value - Value to retry saving
   */
  function retry(value: T): Promise<boolean> {
    error.value = null
    return executeSave(value)
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null
  }

  /**
   * Check if there's a pending save
   */
  function hasPending(): boolean {
    return debounceTimer !== null || pendingValue.value !== null
  }

  return {
    // State
    saving: readonly(saving),
    error: readonly(error),
    lastSaved: readonly(lastSaved),

    // Methods
    save,
    saveNow,
    cancel,
    retry,
    clearError,
    hasPending
  }
}

/**
 * Options for useInlineAutoSave composable
 */
interface InlineAutoSaveOptions<T = unknown> {
  /** Initial value */
  initialValue?: T
  /** Async save function */
  onSave?: (value: T) => Promise<void>
  /** Validation function - returns true if valid, error message string if invalid */
  validate?: (value: T) => boolean | string
  /** Debounce delay (default: 300) */
  debounceMs?: number
  /** Show toast notifications (default: true) */
  showToast?: boolean
}

/**
 * Return type for useInlineAutoSave composable
 */
interface InlineAutoSaveReturn<T = unknown> {
  isEditing: DeepReadonly<Ref<boolean>>
  editValue: Ref<T>
  originalValue: DeepReadonly<Ref<T>>
  saving: DeepReadonly<Ref<boolean>>
  error: DeepReadonly<Ref<string | null>>
  startEdit: () => void
  cancel: () => void
  commit: () => Promise<boolean>
  retry: () => void
  setValue: (value: T) => void
  clearError: () => void
}

/**
 * Combined inline edit + auto-save composable
 * Provides a complete solution for Tier 1 inline editing
 *
 * @param options - Configuration options
 * @returns Combined inline edit state and methods
 */
export function useInlineAutoSave<T = string>(options: InlineAutoSaveOptions<T> = {}): InlineAutoSaveReturn<T> {
  const {
    initialValue = '' as unknown as T,
    onSave = async () => {},
    validate = () => true,
    debounceMs = 300,
    showToast = true
  } = options

  // State
  const isEditing = ref(false)
  const editValue = ref<T>(initialValue) as Ref<T>
  const originalValue = ref<T>(initialValue) as Ref<T>
  const saving = ref(false)
  const error = ref<string | null>(null)

  // Debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Start editing
   */
  function startEdit(): void {
    isEditing.value = true
    editValue.value = originalValue.value
    error.value = null
  }

  /**
   * Cancel editing
   */
  function cancel(): void {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    isEditing.value = false
    editValue.value = originalValue.value
    error.value = null
  }

  /**
   * Commit and save (called on blur)
   */
  async function commit(): Promise<boolean> {
    // Clear any pending debounce
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }

    // Skip if value hasn't changed
    if (editValue.value === originalValue.value) {
      isEditing.value = false
      return true
    }

    // Validate
    const validationResult = validate(editValue.value)
    if (validationResult !== true) {
      error.value = typeof validationResult === 'string' ? validationResult : '输入无效'
      return false
    }

    saving.value = true
    error.value = null

    try {
      await onSave(editValue.value)
      originalValue.value = editValue.value
      isEditing.value = false
      if (showToast) {
        toast.success('已保存', 2000)
      }
      return true
    } catch (err) {
      error.value = (err as Error).message || '保存失败'
      if (showToast) {
        toast.error(error.value)
      }
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Retry failed save
   */
  function retry(): void {
    error.value = null
    commit()
  }

  /**
   * Set value from external source
   */
  function setValue(value: T): void {
    originalValue.value = value
    if (!isEditing.value) {
      editValue.value = value
    }
  }

  /**
   * Clear error
   */
  function clearError(): void {
    error.value = null
  }

  return {
    // State
    isEditing: readonly(isEditing),
    editValue,
    originalValue: readonly(originalValue),
    saving: readonly(saving),
    error: readonly(error),

    // Methods
    startEdit,
    cancel,
    commit,
    retry,
    setValue,
    clearError
  }
}
