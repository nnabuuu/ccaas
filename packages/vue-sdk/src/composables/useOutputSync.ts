import { ref } from 'vue'
import type { Ref } from 'vue'
import type { UseOutputSyncOptions, UseOutputSyncReturn, OutputUpdate, UndoEntry } from '../types'

const DEFAULT_UNDO_TIMEOUT_MS = 30000

/**
 * Parse JSON string if the value is a string that looks like JSON.
 */
function parseJsonIfString(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return value
      }
    }
  }
  return value
}

/**
 * Generic output sync composable supporting manual and auto sync modes.
 *
 * - **manual mode**: Updates are queued in `pendingUpdates`; user must call `syncToForm`.
 *   (Used by lesson-plan-designer)
 * - **auto mode**: Updates are applied immediately via `handleOutputUpdate`.
 *   (Used by problem-explainer)
 *
 * **Key difference from React version**: Vue version accepts `Ref<T>` as formData,
 * directly modifying `.value` instead of using React's `setData` dispatcher.
 *
 * Domain-specific field normalization is injected via `normalizeField` option.
 */
export function useOutputSync<T extends Record<string, unknown>>(
  options: UseOutputSyncOptions,
): UseOutputSyncReturn<T> {
  const {
    mode,
    normalizeField,
    undoTimeout = DEFAULT_UNDO_TIMEOUT_MS,
  } = options

  const pendingUpdates = ref<Map<string, OutputUpdate>>(new Map()) as Ref<Map<string, OutputUpdate>>
  const modifiedFields = ref<Set<string>>(new Set()) as Ref<Set<string>>
  const undoStack = ref<UndoEntry[]>([])
  const undoTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  // Internal: apply an update to data via Ref
  function applyUpdate(field: string, value: unknown, formData: Ref<T>) {
    // Normalize value
    let normalized = parseJsonIfString(value)
    if (normalizeField) {
      normalized = normalizeField(field, normalized)
    }

    // Save undo entry
    const previousValue = formData.value[field]
    const undoEntry: UndoEntry = {
      field,
      previousValue,
      timestamp: Date.now(),
    }

    undoStack.value = [...undoStack.value.filter(e => e.field !== field), undoEntry]

    // Apply value
    formData.value = { ...formData.value, [field]: normalized }

    // Mark as modified
    const next = new Set(modifiedFields.value)
    next.add(field)
    modifiedFields.value = next

    // Set undo timeout
    const existingTimeout = undoTimeouts.get(field)
    if (existingTimeout) clearTimeout(existingTimeout)

    const timeout = setTimeout(() => {
      undoStack.value = undoStack.value.filter(e => e.field !== field)
      undoTimeouts.delete(field)
    }, undoTimeout)

    undoTimeouts.set(field, timeout)
  }

  // Handle incoming output update
  function handleOutputUpdate(update: OutputUpdate) {
    const next = new Map(pendingUpdates.value)
    next.set(update.field, update)
    pendingUpdates.value = next
  }

  // Sync a single field to form data
  function syncToForm(field: string, formData: Ref<T>) {
    const update = pendingUpdates.value.get(field)
    if (!update) return

    applyUpdate(field, update.value, formData)

    // Mark as synced
    const next = new Map(pendingUpdates.value)
    const existing = next.get(field)
    if (existing) {
      next.set(field, { ...existing, synced: true, syncedAt: new Date() })
    }
    pendingUpdates.value = next
  }

  // Sync all pending updates
  function syncAllToForm(formData: Ref<T>) {
    for (const [field, update] of pendingUpdates.value) {
      if (!update.synced) {
        applyUpdate(field, update.value, formData)
      }
    }

    // Mark all as synced
    const next = new Map(pendingUpdates.value)
    for (const [key, val] of next) {
      next.set(key, { ...val, synced: true, syncedAt: new Date() })
    }
    pendingUpdates.value = next
  }

  // Discard a pending update
  function discardUpdate(field: string) {
    const next = new Map(pendingUpdates.value)
    next.delete(field)
    pendingUpdates.value = next
  }

  // Undo a synced field
  function undoSync(field: string, formData: Ref<T>) {
    const entry = undoStack.value.find(e => e.field === field)
    if (!entry) return

    // Restore previous value
    formData.value = { ...formData.value, [field]: entry.previousValue }

    // Remove from modified
    const nextModified = new Set(modifiedFields.value)
    nextModified.delete(field)
    modifiedFields.value = nextModified

    // Remove from undo stack
    undoStack.value = undoStack.value.filter(e => e.field !== field)

    // Clear timeout
    const timeout = undoTimeouts.get(field)
    if (timeout) {
      clearTimeout(timeout)
      undoTimeouts.delete(field)
    }
  }

  // Check if undo is available
  function canUndo(field: string): boolean {
    const entry = undoStack.value.find(e => e.field === field)
    if (!entry) return false
    return Date.now() - entry.timestamp < undoTimeout
  }

  // Reset all state
  function reset() {
    pendingUpdates.value = new Map()
    modifiedFields.value = new Set()
    undoStack.value = []
    for (const timeout of undoTimeouts.values()) {
      clearTimeout(timeout)
    }
    undoTimeouts.clear()
  }

  return {
    pendingUpdates,
    modifiedFields,
    handleOutputUpdate,
    syncToForm,
    syncAllToForm,
    discardUpdate,
    undoSync,
    canUndo,
    reset,
  }
}
