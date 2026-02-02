/**
 * useLessonPlanSync Composable
 *
 * Provides reactive state management for lesson plan synchronization
 * with AI-generated content via output_update events.
 *
 * Features:
 * - Track pending AI updates per field
 * - Apply/discard individual or all updates
 * - Undo recently applied changes
 * - Track which fields have been AI-modified
 */

import { ref, computed, reactive } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import type {
  LessonPlan,
  LessonPlanSyncField,
  LESSON_PLAN_SYNC_FIELDS,
} from '@ccaas/common'

// Valid sync fields (matching @ccaas/common)
const VALID_SYNC_FIELDS: readonly string[] = [
  'title',
  'subject',
  'gradeLevel',
  'duration',
  'objectives',
  'standards',
  'materials',
  'activities',
  'assessment',
  'differentiation',
]

// Protected fields that cannot be modified
const PROTECTED_FIELDS = ['id', 'tenantId', 'createdAt', 'updatedAt', 'status']

/**
 * Options for useLessonPlanSync
 */
export interface UseLessonPlanSyncOptions {
  /** Initial lesson plan data */
  initialPlan: LessonPlan
  /** Callback when an update is applied */
  onApply?: (field: LessonPlanSyncField, value: unknown) => Promise<void>
  /** Callback when a pending update is received */
  onPendingUpdate?: (field: LessonPlanSyncField, value: unknown) => void
  /** Undo timeout in milliseconds (default: 30000) */
  undoTimeout?: number
}

/**
 * Undo history entry
 */
interface UndoEntry {
  field: LessonPlanSyncField
  previousValue: unknown
  timestamp: number
}

/**
 * Return type for useLessonPlanSync
 */
export interface UseLessonPlanSyncReturn {
  /** Current lesson plan state */
  lessonPlan: Ref<LessonPlan>
  /** Pending updates from AI (not yet applied) */
  pendingUpdates: Ref<Partial<Record<LessonPlanSyncField, unknown>>>
  /** Whether there are any pending updates */
  hasPendingUpdates: ComputedRef<boolean>
  /** Set of fields that have been modified by AI */
  modifiedFields: Ref<Set<LessonPlanSyncField>>
  /** Handle an output_update event from AI */
  handleOutputUpdate: (field: LessonPlanSyncField, value: unknown) => void
  /** Apply a single pending update */
  applyUpdate: (field: LessonPlanSyncField) => Promise<void>
  /** Apply all pending updates */
  applyAllUpdates: () => Promise<void>
  /** Discard a single pending update */
  discardUpdate: (field: LessonPlanSyncField) => void
  /** Discard all pending updates */
  discardAllUpdates: () => void
  /** Undo a recently applied update */
  undoUpdate: (field: LessonPlanSyncField) => void
  /** Check if undo is available for a field */
  canUndo: ComputedRef<(field: LessonPlanSyncField) => boolean>
  /** Reset lesson plan to a new state */
  resetLessonPlan: (newPlan: LessonPlan) => void
  /** Get pending update for a specific field */
  getPendingUpdateForField: (field: LessonPlanSyncField) => unknown | undefined
  /** Check if a field has been modified */
  isFieldModified: (field: LessonPlanSyncField) => boolean
}

/**
 * Lesson plan sync composable
 *
 * @example
 * ```ts
 * const { lessonPlan, handleOutputUpdate, applyUpdate, pendingUpdates } = useLessonPlanSync({
 *   initialPlan: myLessonPlan,
 *   onApply: async (field, value) => {
 *     await api.updateLessonPlanField(lessonPlan.value.id, field, value)
 *   }
 * })
 *
 * // When AI sends output_update
 * socket.on('output_update', (event) => {
 *   handleOutputUpdate(event.field, event.value)
 * })
 *
 * // When user clicks "Sync to Form" button
 * await applyUpdate('objectives')
 * ```
 */
export function useLessonPlanSync(options: UseLessonPlanSyncOptions): UseLessonPlanSyncReturn {
  const {
    initialPlan,
    onApply,
    onPendingUpdate,
    undoTimeout = 30000,
  } = options

  // Core state
  const lessonPlan = ref<LessonPlan>({ ...initialPlan })
  const pendingUpdates = ref<Partial<Record<LessonPlanSyncField, unknown>>>({})
  const modifiedFields = ref<Set<LessonPlanSyncField>>(new Set())

  // Undo history
  const undoHistory = ref<UndoEntry[]>([])

  // Computed values
  const hasPendingUpdates = computed(() => Object.keys(pendingUpdates.value).length > 0)

  const canUndo = computed(() => {
    return (field: LessonPlanSyncField): boolean => {
      const entry = undoHistory.value.find((e) => e.field === field)
      if (!entry) return false
      return Date.now() - entry.timestamp < undoTimeout
    }
  })

  /**
   * Validate if a field can be synced
   */
  function isValidSyncField(field: string): field is LessonPlanSyncField {
    return VALID_SYNC_FIELDS.includes(field) && !PROTECTED_FIELDS.includes(field)
  }

  /**
   * Handle an output_update event from AI
   */
  function handleOutputUpdate(field: LessonPlanSyncField, value: unknown): void {
    if (!isValidSyncField(field)) {
      console.warn(`[useLessonPlanSync] Invalid or protected field: ${field}`)
      return
    }

    pendingUpdates.value = {
      ...pendingUpdates.value,
      [field]: value,
    }

    onPendingUpdate?.(field, value)
  }

  /**
   * Apply a single pending update
   */
  async function applyUpdate(field: LessonPlanSyncField): Promise<void> {
    const value = pendingUpdates.value[field]
    if (value === undefined) return

    // Store previous value for undo
    const previousValue = (lessonPlan.value as Record<string, unknown>)[field]
    undoHistory.value = [
      ...undoHistory.value.filter((e) => e.field !== field),
      { field, previousValue, timestamp: Date.now() },
    ]

    // Apply the update
    ;(lessonPlan.value as Record<string, unknown>)[field] = value

    // Mark as modified
    modifiedFields.value = new Set([...modifiedFields.value, field])

    // Remove from pending
    const { [field]: _, ...rest } = pendingUpdates.value
    pendingUpdates.value = rest

    // Callback
    await onApply?.(field, value)
  }

  /**
   * Apply all pending updates
   */
  async function applyAllUpdates(): Promise<void> {
    const fields = Object.keys(pendingUpdates.value) as LessonPlanSyncField[]
    for (const field of fields) {
      await applyUpdate(field)
    }
  }

  /**
   * Discard a single pending update
   */
  function discardUpdate(field: LessonPlanSyncField): void {
    const { [field]: _, ...rest } = pendingUpdates.value
    pendingUpdates.value = rest
  }

  /**
   * Discard all pending updates
   */
  function discardAllUpdates(): void {
    pendingUpdates.value = {}
  }

  /**
   * Undo a recently applied update
   */
  function undoUpdate(field: LessonPlanSyncField): void {
    const entry = undoHistory.value.find((e) => e.field === field)
    if (!entry) return
    if (Date.now() - entry.timestamp >= undoTimeout) return

    // Restore previous value
    ;(lessonPlan.value as Record<string, unknown>)[field] = entry.previousValue

    // Remove from modified fields
    const newModified = new Set(modifiedFields.value)
    newModified.delete(field)
    modifiedFields.value = newModified

    // Remove from undo history
    undoHistory.value = undoHistory.value.filter((e) => e.field !== field)
  }

  /**
   * Reset lesson plan to a new state
   */
  function resetLessonPlan(newPlan: LessonPlan): void {
    lessonPlan.value = { ...newPlan }
    pendingUpdates.value = {}
    modifiedFields.value = new Set()
    undoHistory.value = []
  }

  /**
   * Get pending update for a specific field
   */
  function getPendingUpdateForField(field: LessonPlanSyncField): unknown | undefined {
    return pendingUpdates.value[field]
  }

  /**
   * Check if a field has been modified
   */
  function isFieldModified(field: LessonPlanSyncField): boolean {
    return modifiedFields.value.has(field)
  }

  return {
    lessonPlan,
    pendingUpdates,
    hasPendingUpdates,
    modifiedFields,
    handleOutputUpdate,
    applyUpdate,
    applyAllUpdates,
    discardUpdate,
    discardAllUpdates,
    undoUpdate,
    canUndo,
    resetLessonPlan,
    getPendingUpdateForField,
    isFieldModified,
  }
}

export default useLessonPlanSync
