/**
 * useAIEditing Composable
 *
 * Provides AI editing mode management for stores.
 * Tracks which sections are being edited by AI, completed, and pending.
 */

import { ref, computed } from 'vue'
import type { Ref, ComputedRef } from 'vue'

/**
 * Options for useAIEditing
 */
export interface UseAIEditingOptions<T extends string> {
  /** All section IDs that can be AI-edited */
  allSections: readonly T[]
  /** Callback when a section is updated by AI */
  onSectionUpdate?: (sectionId: T, content: unknown) => void
  /** Callback when AI editing completes */
  onComplete?: () => void
  /** Callback when AI editing is cancelled */
  onCancel?: () => void
}

/**
 * Return type for useAIEditing
 */
export interface UseAIEditingReturn<T extends string> {
  /** Whether AI editing mode is active */
  aiEditingMode: Readonly<Ref<boolean>>
  /** Currently active section being edited by AI */
  aiCurrentSection: Readonly<Ref<T | null>>
  /** Set of sections that have been completed by AI */
  aiCompletedSections: Readonly<Ref<Set<T>>>
  /** Set of sections planned for AI generation */
  aiPendingSections: Readonly<Ref<Set<T>>>
  /** Progress percentage (0-100) */
  progress: ComputedRef<number>
  /** Start AI editing for specified sections */
  startAIEditing: (sections?: T[]) => void
  /** Update a section from AI output */
  updateFromAI: (sectionId: T, content: unknown) => void
  /** Mark a section as completed */
  completeAISection: (sectionId: T) => void
  /** Finish AI editing mode */
  finishAIEditing: () => void
  /** Cancel AI editing and discard changes */
  cancelAIEditing: () => void
  /** Check if a section is currently being AI edited */
  isAIEditing: (sectionId: T) => boolean
  /** Check if a section has been completed by AI */
  isAICompleted: (sectionId: T) => boolean
  /** Check if a section is pending AI generation */
  isAIPending: (sectionId: T) => boolean
  /** Reset all AI editing state */
  resetAIState: () => void
}

/**
 * AI editing composable
 *
 * @example
 * ```ts
 * const sectionIds = ['intro', 'body', 'conclusion'] as const
 * type SectionId = typeof sectionIds[number]
 *
 * const {
 *   aiEditingMode,
 *   aiCurrentSection,
 *   startAIEditing,
 *   updateFromAI,
 *   finishAIEditing
 * } = useAIEditing({
 *   allSections: sectionIds,
 *   onSectionUpdate: (id, content) => {
 *     form[id] = content
 *   }
 * })
 * ```
 */
export function useAIEditing<T extends string>(
  options: UseAIEditingOptions<T>
): UseAIEditingReturn<T> {
  const {
    allSections,
    onSectionUpdate,
    onComplete,
    onCancel,
  } = options

  // State
  const aiEditingMode = ref(false)
  const aiCurrentSection = ref<T | null>(null) as Ref<T | null>
  const aiCompletedSections = ref<Set<T>>(new Set()) as Ref<Set<T>>
  const aiPendingSections = ref<Set<T>>(new Set()) as Ref<Set<T>>

  // Computed progress
  const progress = computed(() => {
    const completed = aiCompletedSections.value.size
    const pending = aiPendingSections.value.size
    const total = completed + pending
    if (total === 0) return 0
    return Math.round((completed / total) * 100)
  })

  /**
   * Start AI editing for specified sections
   */
  function startAIEditing(sections?: T[]): void {
    console.log('[useAIEditing] Starting AI editing mode for sections:', sections || 'all')
    aiEditingMode.value = true
    aiCompletedSections.value = new Set()

    // Determine which sections to edit
    const sectionIds = sections && sections.length > 0
      ? sections
      : [...allSections]

    aiPendingSections.value = new Set(sectionIds)

    // Set the first section as current
    aiCurrentSection.value = sectionIds[0] ?? null
  }

  /**
   * Update a section from AI output
   */
  function updateFromAI(sectionId: T, content: unknown): void {
    if (!aiEditingMode.value) {
      startAIEditing([sectionId])
    }

    aiCurrentSection.value = sectionId
    console.log(`[useAIEditing] Updating section from AI: ${sectionId}`)

    // Call the update callback
    if (onSectionUpdate) {
      onSectionUpdate(sectionId, content)
    }
  }

  /**
   * Mark a section as completed by AI
   */
  function completeAISection(sectionId: T): void {
    // Add to completed
    aiCompletedSections.value = new Set([...aiCompletedSections.value, sectionId])

    // Remove from pending
    const newPending = new Set(aiPendingSections.value)
    newPending.delete(sectionId)
    aiPendingSections.value = newPending

    console.log(`[useAIEditing] AI completed section: ${sectionId}`)

    // Advance to next pending section
    if (aiCurrentSection.value === sectionId) {
      const remaining = [...aiPendingSections.value].filter(
        (s) => !aiCompletedSections.value.has(s)
      )
      aiCurrentSection.value = remaining[0] ?? null
    }

    // Check if all sections are complete
    if (aiPendingSections.value.size === 0 && onComplete) {
      onComplete()
    }
  }

  /**
   * Finish AI editing mode
   */
  function finishAIEditing(): void {
    console.log('[useAIEditing] Finishing AI editing mode')
    aiEditingMode.value = false
    aiCurrentSection.value = null
    // Keep aiCompletedSections for display until user saves or discards
  }

  /**
   * Cancel AI editing and discard changes
   */
  function cancelAIEditing(): void {
    console.log('[useAIEditing] Cancelling AI editing mode')
    aiEditingMode.value = false
    aiCurrentSection.value = null
    aiCompletedSections.value = new Set()
    aiPendingSections.value = new Set()

    if (onCancel) {
      onCancel()
    }
  }

  /**
   * Check if a section is currently being AI edited
   */
  function isAIEditing(sectionId: T): boolean {
    return aiEditingMode.value && aiCurrentSection.value === sectionId
  }

  /**
   * Check if a section has been completed by AI
   */
  function isAICompleted(sectionId: T): boolean {
    return aiCompletedSections.value.has(sectionId)
  }

  /**
   * Check if a section is pending AI generation
   */
  function isAIPending(sectionId: T): boolean {
    return aiPendingSections.value.has(sectionId) && !aiCompletedSections.value.has(sectionId)
  }

  /**
   * Reset all AI editing state
   */
  function resetAIState(): void {
    aiEditingMode.value = false
    aiCurrentSection.value = null
    aiCompletedSections.value = new Set()
    aiPendingSections.value = new Set()
  }

  return {
    aiEditingMode: computed(() => aiEditingMode.value),
    aiCurrentSection: computed(() => aiCurrentSection.value),
    aiCompletedSections: computed(() => aiCompletedSections.value),
    aiPendingSections: computed(() => aiPendingSections.value),
    progress,
    startAIEditing,
    updateFromAI,
    completeAISection,
    finishAIEditing,
    cancelAIEditing,
    isAIEditing,
    isAICompleted,
    isAIPending,
    resetAIState,
  }
}

export default useAIEditing
