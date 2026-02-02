import { useState, useCallback, useRef } from 'react'
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
 * Generic output sync hook supporting manual and auto sync modes.
 *
 * - **manual mode**: Updates are queued in `pendingUpdates`; user must call `syncToForm`.
 *   (Used by lesson-plan-designer)
 * - **auto mode**: Updates are applied immediately via `handleOutputUpdate`.
 *   (Used by problem-explainer)
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

  const [pendingUpdates, setPendingUpdates] = useState<Map<string, OutputUpdate>>(new Map())
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set())
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const undoTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Internal: apply an update to data via setter
  const applyUpdate = useCallback((
    field: string,
    value: unknown,
    currentData: T,
    setData: React.Dispatch<React.SetStateAction<T>>,
  ) => {
    // Normalize value
    let normalized = parseJsonIfString(value)
    if (normalizeField) {
      normalized = normalizeField(field, normalized)
    }

    // Save undo entry
    const previousValue = currentData[field]
    const undoEntry: UndoEntry = {
      field,
      previousValue,
      timestamp: Date.now(),
    }

    setUndoStack(prev => [...prev.filter(e => e.field !== field), undoEntry])

    // Apply value
    setData(prev => ({ ...prev, [field]: normalized }))

    // Mark as modified
    setModifiedFields(prev => {
      const next = new Set(prev)
      next.add(field)
      return next
    })

    // Set undo timeout
    const existingTimeout = undoTimeouts.current.get(field)
    if (existingTimeout) clearTimeout(existingTimeout)

    const timeout = setTimeout(() => {
      setUndoStack(prev => prev.filter(e => e.field !== field))
      undoTimeouts.current.delete(field)
    }, undoTimeout)

    undoTimeouts.current.set(field, timeout)
  }, [normalizeField, undoTimeout])

  // Handle incoming output update
  const handleOutputUpdate = useCallback((update: OutputUpdate) => {
    if (mode === 'manual') {
      // Queue for manual sync
      setPendingUpdates(prev => {
        const next = new Map(prev)
        next.set(update.field, update)
        return next
      })
    }
    // 'auto' mode: caller should provide currentData + setData externally.
    // This hook stores the update; the solution code calls syncToForm or handles it directly.
    // For auto mode, we also queue it so the solution can access it via handleOutputUpdate callback.
    if (mode === 'auto') {
      setPendingUpdates(prev => {
        const next = new Map(prev)
        next.set(update.field, update)
        return next
      })
    }
  }, [mode])

  // Sync a single field to form data
  const syncToForm = useCallback((
    field: string,
    currentData: T,
    setData: React.Dispatch<React.SetStateAction<T>>,
  ) => {
    const update = pendingUpdates.get(field)
    if (!update) return

    applyUpdate(field, update.value, currentData, setData)

    // Mark as synced (keep in map for UI reference)
    setPendingUpdates(prev => {
      const next = new Map(prev)
      const existing = next.get(field)
      if (existing) {
        next.set(field, { ...existing, synced: true, syncedAt: new Date() })
      }
      return next
    })
  }, [pendingUpdates, applyUpdate])

  // Sync all pending updates
  const syncAllToForm = useCallback((
    currentData: T,
    setData: React.Dispatch<React.SetStateAction<T>>,
  ) => {
    for (const field of pendingUpdates.keys()) {
      const update = pendingUpdates.get(field)
      if (update && !update.synced) {
        applyUpdate(field, update.value, currentData, setData)
      }
    }

    // Mark all as synced
    setPendingUpdates(prev => {
      const next = new Map(prev)
      for (const [key, val] of next) {
        next.set(key, { ...val, synced: true, syncedAt: new Date() })
      }
      return next
    })
  }, [pendingUpdates, applyUpdate])

  // Discard a pending update
  const discardUpdate = useCallback((field: string) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }, [])

  // Undo a synced field
  const undoSync = useCallback((
    field: string,
    currentData: T,
    setData: React.Dispatch<React.SetStateAction<T>>,
  ) => {
    const entry = undoStack.find(e => e.field === field)
    if (!entry) return

    // Restore previous value
    setData(prev => ({ ...prev, [field]: entry.previousValue }))

    // Remove from modified
    setModifiedFields(prev => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })

    // Remove from undo stack
    setUndoStack(prev => prev.filter(e => e.field !== field))

    // Clear timeout
    const timeout = undoTimeouts.current.get(field)
    if (timeout) {
      clearTimeout(timeout)
      undoTimeouts.current.delete(field)
    }
  }, [undoStack])

  // Check if undo is available
  const canUndo = useCallback((field: string): boolean => {
    const entry = undoStack.find(e => e.field === field)
    if (!entry) return false
    return Date.now() - entry.timestamp < undoTimeout
  }, [undoStack, undoTimeout])

  // Reset all state
  const reset = useCallback(() => {
    setPendingUpdates(new Map())
    setModifiedFields(new Set())
    setUndoStack([])
    for (const timeout of undoTimeouts.current.values()) {
      clearTimeout(timeout)
    }
    undoTimeouts.current.clear()
  }, [])

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
