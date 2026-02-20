import { ref, readonly, watch, type Ref, type DeepReadonly } from 'vue'

/**
 * Options for useInlineEdit composable
 */
interface InlineEditOptions<T = unknown> {
  /** Initial value for the field */
  initialValue?: T
  /** Async function to call when saving */
  onSave?: (value: T) => Promise<void>
  /** Validation function, returns true if valid or error message string */
  validate?: (value: T) => boolean | string
  /** Transform value before saving */
  transform?: (value: T) => T
}

/**
 * Return type for useInlineEdit composable
 */
interface InlineEditReturn<T = unknown> {
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
 * Composable for managing inline edit state
 *
 * @param options - Configuration options
 * @returns Inline edit state and methods
 */
export function useInlineEdit<T = string>(options: InlineEditOptions<T> = {}): InlineEditReturn<T> {
  const {
    initialValue = '' as unknown as T,
    onSave = async () => {},
    validate = () => true,
    transform = (v: T) => v
  } = options

  // State
  const isEditing = ref(false)
  const editValue = ref<T>(initialValue) as Ref<T>
  const originalValue = ref<T>(initialValue) as Ref<T>
  const saving = ref(false)
  const error = ref<string | null>(null)

  /**
   * Start editing mode
   */
  function startEdit(): void {
    isEditing.value = true
    editValue.value = originalValue.value
    error.value = null
  }

  /**
   * Cancel editing and restore original value
   */
  function cancel(): void {
    isEditing.value = false
    editValue.value = originalValue.value
    error.value = null
  }

  /**
   * Commit the edit and save
   * @returns True if save was successful
   */
  async function commit(): Promise<boolean> {
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
      const transformed = transform(editValue.value)
      await onSave(transformed)
      originalValue.value = editValue.value
      isEditing.value = false
      return true
    } catch (err) {
      error.value = (err as Error).message || '保存失败'
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Retry the last failed save
   */
  function retry(): void {
    error.value = null
    commit()
  }

  /**
   * Set value from external source (e.g., prop update)
   * @param value - New value
   */
  function setValue(value: T): void {
    originalValue.value = value
    if (!isEditing.value) {
      editValue.value = value
    }
  }

  /**
   * Clear any error state
   */
  function clearError(): void {
    error.value = null
  }

  return {
    // State (readonly where appropriate)
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

/**
 * Options for useInlineEditWithModel composable
 */
interface InlineEditWithModelOptions<T = unknown> {
  /** Reactive ref from props */
  modelValue?: Ref<T>
  /** Async function to call when saving */
  onSave?: (value: T) => Promise<void>
  /** Validation function */
  validate?: (value: T) => boolean | string
  /** Transform value before saving */
  transform?: (value: T) => T
}

/**
 * Composable for inline edit with model value sync
 * Handles v-model binding and auto-sync with external value changes
 *
 * @param options - Configuration options
 * @returns Inline edit state and methods
 */
export function useInlineEditWithModel<T = string>(options: InlineEditWithModelOptions<T> = {}): InlineEditReturn<T> {
  const {
    modelValue,
    onSave = async () => {},
    validate = () => true,
    transform = (v: T) => v
  } = options

  const editor = useInlineEdit<T>({
    initialValue: modelValue?.value ?? ('' as unknown as T),
    onSave,
    validate,
    transform
  })

  // Watch for external model value changes
  if (modelValue) {
    watch(modelValue, (newValue) => {
      editor.setValue(newValue)
    })
  }

  return editor
}
