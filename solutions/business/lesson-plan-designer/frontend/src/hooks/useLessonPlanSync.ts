import { useState, useCallback, useRef } from 'react'
import { useOutputSync } from '@ccaas/react-sdk'
import type { SyncField, OutputUpdate, UndoEntry, LessonPlan } from '../types'

const UNDO_TIMEOUT_MS = 30000 // 30 seconds

/**
 * Parse JSON string if the value looks like JSON
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
 * Normalize the value for a specific field to ensure correct type.
 * Simplified: gradeLevel/durationMinutes → Number(), extraProperties → object, rest → String()
 */
function normalizeFieldValue(field: SyncField, value: unknown): unknown {
  value = parseJsonIfString(value)

  if (field === 'gradeLevel' || field === 'durationMinutes') {
    return Number(value) || (field === 'gradeLevel' ? 1 : 45)
  }

  if (field === 'curriculumRequirements') {
    if (Array.isArray(value)) return value
    return []
  }

  if (field === 'extraProperties') {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value
    }
    return {}
  }

  if (field === 'attachments') {
    if (Array.isArray(value)) {
      // Validate each attachment has required fields
      return value.filter(a =>
        a && typeof a === 'object' &&
        a.fileId && a.fileName && a.downloadUrl
      )
    }
    return []
  }

  if (field === 'status') {
    const validStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
    const str = String(value || 'DRAFT')
    return validStatuses.includes(str) ? str : 'DRAFT'
  }

  // All other fields are strings
  return value == null ? null : String(value)
}

export interface UseLessonPlanSyncReturn {
  pendingUpdates: Map<SyncField, OutputUpdate>
  modifiedFields: Set<SyncField>
  undoStack: UndoEntry[]

  addPendingUpdate: (update: OutputUpdate) => void
  removePendingUpdate: (field: SyncField) => void
  syncToForm: (
    field: SyncField,
    lessonPlan: LessonPlan,
    setLessonPlan: (plan: LessonPlan) => void
  ) => void
  undoSync: (
    field: SyncField,
    lessonPlan: LessonPlan,
    setLessonPlan: (plan: LessonPlan) => void
  ) => void
  canUndo: (field: SyncField) => boolean
  clearUndoStack: () => void
  resetSyncState: () => void
}

export function useLessonPlanSync(): UseLessonPlanSyncReturn {
  // Delegate pendingUpdates Map management to the SDK's generic hook
  const {
    pendingUpdates,
    handleOutputUpdate,
    discardUpdate,
    reset: resetPending,
  } = useOutputSync({ mode: 'manual' })

  // modifiedFields and undoStack are managed locally since syncToForm uses a
  // non-standard setter (crud.setLessonPlan) incompatible with useOutputSync.syncToForm
  const [modifiedFields, setModifiedFields] = useState<Set<SyncField>>(new Set())
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const undoTimeouts = useRef<Map<SyncField, NodeJS.Timeout>>(new Map())

  const addPendingUpdate = useCallback((update: OutputUpdate) => {
    handleOutputUpdate(update)
  }, [handleOutputUpdate])

  const removePendingUpdate = useCallback((field: SyncField) => {
    discardUpdate(field)
  }, [discardUpdate])

  // Sync a field from AI output to the form
  const syncToForm = useCallback((
    field: SyncField,
    lessonPlan: LessonPlan,
    setLessonPlan: (plan: LessonPlan) => void
  ) => {
    const update = pendingUpdates.get(field)
    if (!update) return

    // Normalize the value to ensure correct type
    const normalizedValue = normalizeFieldValue(field, update.value)

    // Store previous value for undo
    const previousValue = lessonPlan[field as keyof LessonPlan]
    const undoEntry: UndoEntry = {
      field,
      previousValue,
      timestamp: Date.now(),
    }

    // Update lesson plan with normalized value
    setLessonPlan({
      ...lessonPlan,
      [field]: normalizedValue,
    })

    // Mark field as modified
    setModifiedFields(prev => {
      const next = new Set(prev)
      next.add(field)
      return next
    })

    // Add to undo stack
    setUndoStack(prev => [...prev.filter(e => e.field !== field), undoEntry])

    // Mark as synced with timestamp (don't remove, allow re-sync)
    handleOutputUpdate({ ...update, synced: true, syncedAt: new Date() })

    // Set timeout to remove from undo stack
    const existingTimeout = undoTimeouts.current.get(field)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    const timeout = setTimeout(() => {
      setUndoStack(prev => prev.filter(e => e.field !== field))
      undoTimeouts.current.delete(field)
    }, UNDO_TIMEOUT_MS)

    undoTimeouts.current.set(field, timeout)
  }, [pendingUpdates, handleOutputUpdate])

  // Undo a sync operation
  const undoSync = useCallback((
    field: SyncField,
    lessonPlan: LessonPlan,
    setLessonPlan: (plan: LessonPlan) => void
  ) => {
    const entry = undoStack.find(e => e.field === field)
    if (!entry) return

    // Restore previous value
    setLessonPlan({
      ...lessonPlan,
      [field]: entry.previousValue,
    })

    // Remove from modified fields
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

  // Check if a field can be undone
  const canUndo = useCallback((field: SyncField): boolean => {
    const entry = undoStack.find(e => e.field === field)
    if (!entry) return false

    const elapsed = Date.now() - entry.timestamp
    return elapsed < UNDO_TIMEOUT_MS
  }, [undoStack])

  // Clear all undo entries
  const clearUndoStack = useCallback(() => {
    for (const timeout of undoTimeouts.current.values()) {
      clearTimeout(timeout)
    }
    undoTimeouts.current.clear()
    setUndoStack([])
  }, [])

  // Reset all sync state
  const resetSyncState = useCallback(() => {
    resetPending()
    setModifiedFields(new Set())
    clearUndoStack()
  }, [resetPending, clearUndoStack])

  return {
    pendingUpdates: pendingUpdates as unknown as Map<SyncField, OutputUpdate>,
    modifiedFields,
    undoStack,
    addPendingUpdate,
    removePendingUpdate,
    syncToForm,
    undoSync,
    canUndo,
    clearUndoStack,
    resetSyncState,
  }
}

export default useLessonPlanSync
