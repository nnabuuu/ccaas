import { useState, useCallback, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { SyncField, OutputUpdate, UndoEntry, LessonPlan, LearningObjective, Activity, Standard, Material, Assessment, Differentiation } from '../types'

const UNDO_TIMEOUT_MS = 30000 // 30 seconds

// Fields that should always be arrays
const ARRAY_FIELDS: SyncField[] = ['objectives', 'standards', 'materials', 'activities']

/**
 * Normalize a learning objective from AI output
 */
function normalizeObjective(obj: Record<string, unknown>): LearningObjective {
  return {
    id: (obj.id as string) || uuidv4(),
    description: (obj.description as string) || (obj.text as string) || (obj.content as string) || '',
    bloomLevel: normalizeBloomLevel(obj.bloomLevel || obj.level || obj.bloom_level),
    assessmentCriteria: (obj.assessmentCriteria as string) || (obj.assessment_criteria as string) || (obj.criteria as string) || undefined,
  }
}

/**
 * Normalize bloom level value
 */
function normalizeBloomLevel(level: unknown): LearningObjective['bloomLevel'] {
  const validLevels = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create']
  const normalized = String(level || 'understand').toLowerCase()
  return validLevels.includes(normalized) ? normalized as LearningObjective['bloomLevel'] : 'understand'
}

/**
 * Normalize an activity from AI output
 */
function normalizeActivity(obj: Record<string, unknown>): Activity {
  let instructions: string[] = []
  if (Array.isArray(obj.instructions)) {
    instructions = obj.instructions.map(i => String(i))
  } else if (typeof obj.instructions === 'string') {
    instructions = [obj.instructions]
  } else if (Array.isArray(obj.steps)) {
    instructions = obj.steps.map(i => String(i))
  }

  return {
    id: (obj.id as string) || uuidv4(),
    title: (obj.title as string) || (obj.name as string) || '',
    description: (obj.description as string) || (obj.content as string) || '',
    duration: Number(obj.duration) || Number(obj.time) || 10,
    type: normalizeActivityType(obj.type || obj.activity_type),
    instructions,
    materials: Array.isArray(obj.materials) ? obj.materials.map(m => String(m)) : undefined,
    teacherNotes: (obj.teacherNotes as string) || (obj.teacher_notes as string) || (obj.notes as string) || undefined,
  }
}

/**
 * Normalize activity type value
 */
function normalizeActivityType(type: unknown): Activity['type'] {
  const validTypes = ['introduction', 'direct-instruction', 'guided-practice', 'independent-practice', 'group', 'assessment', 'closure']
  const normalized = String(type || 'direct-instruction').toLowerCase()
  return validTypes.includes(normalized) ? normalized as Activity['type'] : 'direct-instruction'
}

/**
 * Normalize a standard from AI output
 */
function normalizeStandard(obj: Record<string, unknown>): Standard {
  return {
    id: (obj.id as string) || uuidv4(),
    code: (obj.code as string) || (obj.standardCode as string) || '',
    description: (obj.description as string) || (obj.title as string) || (obj.text as string) || '',
  }
}

/**
 * Normalize a material from AI output
 */
function normalizeMaterial(obj: Record<string, unknown>): Material {
  const validTypes = ['textbook', 'handout', 'digital', 'manipulative', 'other']
  const typeStr = String(obj.type || 'other').toLowerCase()
  const type = validTypes.includes(typeStr) ? typeStr as Material['type'] : 'other'

  return {
    id: (obj.id as string) || uuidv4(),
    name: (obj.name as string) || (obj.title as string) || '',
    type,
    url: (obj.url as string) || undefined,
    notes: (obj.notes as string) || (obj.description as string) || undefined,
  }
}

/**
 * Normalize assessment from AI output
 */
function normalizeAssessment(obj: Record<string, unknown>): Assessment {
  const toStringArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.map(v => String(v))
    if (typeof val === 'string') return [val]
    return []
  }

  return {
    formative: toStringArray(obj.formative),
    summative: toStringArray(obj.summative),
    rubric: (obj.rubric as string) || undefined,
  }
}

/**
 * Normalize differentiation from AI output
 */
function normalizeDifferentiation(obj: Record<string, unknown>): Differentiation {
  const toStringArray = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.map(v => String(v))
    if (typeof val === 'string') return [val]
    return []
  }

  return {
    struggling: toStringArray(obj.struggling || obj.below_level || obj.belowLevel),
    onLevel: toStringArray(obj.onLevel || obj.on_level || obj.standard),
    advanced: toStringArray(obj.advanced || obj.above_level || obj.aboveLevel || obj.gifted),
    ell: toStringArray(obj.ell || obj.ELL || obj.englishLearners) || undefined,
    accommodations: toStringArray(obj.accommodations || obj.special_needs) || undefined,
  }
}

/**
 * Extract array from various wrapper formats
 */
function extractArray(value: unknown, fieldName: string): unknown[] {
  if (Array.isArray(value)) return value

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>
    // Try common wrapper properties
    const wrapperProps = ['items', 'data', 'values', 'list', fieldName]
    for (const prop of wrapperProps) {
      if (Array.isArray(obj[prop])) return obj[prop] as unknown[]
    }
    // Single object - wrap in array
    return [value]
  }

  return []
}

/**
 * Parse JSON string if the value is a string that looks like JSON
 */
function parseJsonIfString(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // Check if it looks like JSON (starts with [ or {)
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(trimmed)
      } catch {
        console.warn('Failed to parse JSON string:', trimmed.slice(0, 100))
        return value
      }
    }
  }
  return value
}

/**
 * Normalize the value for a specific field to ensure correct type
 */
function normalizeFieldValue(field: SyncField, value: unknown): unknown {
  // First, parse JSON string if necessary
  value = parseJsonIfString(value)
  console.log(`Normalizing field ${field}:`, value)

  // Handle objectives
  if (field === 'objectives') {
    const arr = extractArray(value, 'objectives')
    return arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        return normalizeObjective(item as Record<string, unknown>)
      }
      return normalizeObjective({ description: String(item) })
    })
  }

  // Handle activities
  if (field === 'activities') {
    console.log('📋 activities value before extractArray:', value, 'isArray:', Array.isArray(value))
    const arr = extractArray(value, 'activities')
    console.log('📋 activities after extractArray:', arr, 'length:', arr.length)
    const result = arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        return normalizeActivity(item as Record<string, unknown>)
      }
      return normalizeActivity({ title: String(item) })
    })
    console.log('📋 activities normalized result:', result)
    return result
  }

  // Handle standards
  if (field === 'standards') {
    const arr = extractArray(value, 'standards')
    return arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        return normalizeStandard(item as Record<string, unknown>)
      }
      return normalizeStandard({ description: String(item) })
    })
  }

  // Handle materials
  if (field === 'materials') {
    const arr = extractArray(value, 'materials')
    return arr.map(item => {
      if (typeof item === 'object' && item !== null) {
        return normalizeMaterial(item as Record<string, unknown>)
      }
      return normalizeMaterial({ name: String(item) })
    })
  }

  // For assessment, ensure it's a proper object
  if (field === 'assessment') {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return normalizeAssessment(value as Record<string, unknown>)
    }
    console.warn(`Field ${field} expected object but got:`, value)
    return { formative: [], summative: [] }
  }

  // For differentiation, ensure it's a proper object
  if (field === 'differentiation') {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return normalizeDifferentiation(value as Record<string, unknown>)
    }
    console.warn(`Field ${field} expected object but got:`, value)
    return { struggling: [], onLevel: [], advanced: [] }
  }

  return value
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
  const [pendingUpdates, setPendingUpdates] = useState<Map<SyncField, OutputUpdate>>(new Map())
  const [modifiedFields, setModifiedFields] = useState<Set<SyncField>>(new Set())
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])

  // Use ref to track undo timeouts
  const undoTimeouts = useRef<Map<SyncField, NodeJS.Timeout>>(new Map())

  // Add a pending update from AI
  const addPendingUpdate = useCallback((update: OutputUpdate) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.set(update.field, update)
      return next
    })
  }, [])

  // Remove a pending update (when user discards it)
  const removePendingUpdate = useCallback((field: SyncField) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }, [])

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
    setPendingUpdates(prev => {
      const next = new Map(prev)
      const existing = next.get(field)
      if (existing) {
        next.set(field, { ...existing, synced: true, syncedAt: new Date() })
      }
      return next
    })

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
  }, [pendingUpdates, removePendingUpdate])

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
    // Clear all timeouts
    for (const timeout of undoTimeouts.current.values()) {
      clearTimeout(timeout)
    }
    undoTimeouts.current.clear()
    setUndoStack([])
  }, [])

  // Reset all sync state
  const resetSyncState = useCallback(() => {
    setPendingUpdates(new Map())
    setModifiedFields(new Set())
    clearUndoStack()
  }, [clearUndoStack])

  return {
    pendingUpdates,
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
