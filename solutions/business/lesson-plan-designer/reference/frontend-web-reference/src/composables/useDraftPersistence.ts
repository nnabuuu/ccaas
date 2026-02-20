/**
 * Draft Persistence Composable
 *
 * Provides localStorage-based draft persistence for lesson plan content.
 * AI-generated drafts are saved automatically and can be recovered
 * after page refresh or browser close.
 *
 * Storage key format: `lessonPlan_draft_{id}`
 * Storage value: JSON object with section drafts and metadata
 *
 * @example
 * ```ts
 * const { saveDraft, loadDraft, clearDraft, hasDraft } = useDraftPersistence(lessonPlanId)
 *
 * // Auto-save when content changes
 * watch(sectionDrafts, (drafts) => saveDraft(drafts), { deep: true })
 *
 * // Load draft on mount
 * const existingDraft = loadDraft()
 * if (existingDraft) {
 *   // Offer to restore
 * }
 * ```
 */

import { ref, watch, computed, type Ref } from 'vue'

/**
 * Draft data structure stored in localStorage
 */
export interface DraftData {
  /** Section name to content mapping */
  sections: Record<string, unknown>
  /** Timestamp when the draft was last saved */
  savedAt: number
  /** Lesson plan ID this draft belongs to */
  lessonPlanId: number
  /** Version for future compatibility */
  version: 1
}

/**
 * Options for draft persistence
 */
export interface DraftPersistenceOptions {
  /** Auto-save debounce delay in milliseconds (default: 1000) */
  debounceMs?: number
  /** Maximum age of drafts to keep in milliseconds (default: 7 days) */
  maxAgeMs?: number
}

const STORAGE_KEY_PREFIX = 'lessonPlan_draft_'
const DEFAULT_DEBOUNCE_MS = 1000
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Get storage key for a lesson plan
 */
function getStorageKey(lessonPlanId: number): string {
  return `${STORAGE_KEY_PREFIX}${lessonPlanId}`
}

/**
 * Create draft persistence composable
 * @param lessonPlanId - Reactive ref or computed that returns the lesson plan ID
 * @param options - Configuration options
 */
export function useDraftPersistence(
  lessonPlanId: Ref<number | undefined>,
  options: DraftPersistenceOptions = {}
) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
  } = options

  // Track if there's an unsaved draft
  const hasDraft = ref(false)

  // Track draft timestamp
  const draftSavedAt = ref<number | null>(null)

  // Debounce timer
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Save draft to localStorage
   */
  function saveDraft(sections: Record<string, unknown>): boolean {
    const id = lessonPlanId.value
    if (!id) {
      console.warn('[DraftPersistence] Cannot save draft: no lesson plan ID')
      return false
    }

    // Skip if no meaningful content
    if (Object.keys(sections).length === 0) {
      return false
    }

    try {
      const draft: DraftData = {
        sections,
        savedAt: Date.now(),
        lessonPlanId: id,
        version: 1,
      }

      localStorage.setItem(getStorageKey(id), JSON.stringify(draft))
      hasDraft.value = true
      draftSavedAt.value = draft.savedAt
      console.log(`[DraftPersistence] Saved draft for lesson plan ${id}`)
      return true
    } catch (err) {
      console.error('[DraftPersistence] Failed to save draft:', err)
      return false
    }
  }

  /**
   * Save draft with debouncing
   */
  function saveDraftDebounced(sections: Record<string, unknown>): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveDraft(sections)
      saveTimer = null
    }, debounceMs)
  }

  /**
   * Load draft from localStorage
   */
  function loadDraft(): DraftData | null {
    const id = lessonPlanId.value
    if (!id) {
      return null
    }

    try {
      const stored = localStorage.getItem(getStorageKey(id))
      if (!stored) {
        hasDraft.value = false
        draftSavedAt.value = null
        return null
      }

      const draft: DraftData = JSON.parse(stored)

      // Check if draft is too old
      if (Date.now() - draft.savedAt > maxAgeMs) {
        console.log(`[DraftPersistence] Draft too old, removing`)
        clearDraft()
        return null
      }

      // Verify it's for the right lesson plan
      if (draft.lessonPlanId !== id) {
        console.warn(`[DraftPersistence] Draft ID mismatch, ignoring`)
        return null
      }

      hasDraft.value = true
      draftSavedAt.value = draft.savedAt
      return draft
    } catch (err) {
      console.error('[DraftPersistence] Failed to load draft:', err)
      return null
    }
  }

  /**
   * Clear draft from localStorage
   */
  function clearDraft(): void {
    const id = lessonPlanId.value
    if (!id) return

    try {
      localStorage.removeItem(getStorageKey(id))
      hasDraft.value = false
      draftSavedAt.value = null
      console.log(`[DraftPersistence] Cleared draft for lesson plan ${id}`)
    } catch (err) {
      console.error('[DraftPersistence] Failed to clear draft:', err)
    }
  }

  /**
   * Check if draft exists without loading full data
   */
  function checkDraftExists(): boolean {
    const id = lessonPlanId.value
    if (!id) return false

    try {
      const stored = localStorage.getItem(getStorageKey(id))
      if (!stored) return false

      const draft: DraftData = JSON.parse(stored)

      // Check if expired
      if (Date.now() - draft.savedAt > maxAgeMs) {
        clearDraft()
        return false
      }

      hasDraft.value = true
      draftSavedAt.value = draft.savedAt
      return true
    } catch {
      return false
    }
  }

  /**
   * Get human-readable time since draft was saved
   */
  function getTimeSinceLastSave(): string {
    if (!draftSavedAt.value) return ''

    const diffMs = Date.now() - draftSavedAt.value
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    return `${diffDays}天前`
  }

  /**
   * Clean up old drafts from localStorage
   */
  function cleanupOldDrafts(): void {
    try {
      const keysToRemove: string[] = []

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          const stored = localStorage.getItem(key)
          if (stored) {
            try {
              const draft: DraftData = JSON.parse(stored)
              if (Date.now() - draft.savedAt > maxAgeMs) {
                keysToRemove.push(key)
              }
            } catch {
              // Invalid JSON, remove it
              keysToRemove.push(key)
            }
          }
        }
      }

      keysToRemove.forEach(key => localStorage.removeItem(key))
      if (keysToRemove.length > 0) {
        console.log(`[DraftPersistence] Cleaned up ${keysToRemove.length} old drafts`)
      }
    } catch (err) {
      console.error('[DraftPersistence] Failed to cleanup old drafts:', err)
    }
  }

  // Watch for lesson plan ID changes
  watch(lessonPlanId, () => {
    checkDraftExists()
  }, { immediate: true })

  return {
    hasDraft,
    draftSavedAt,
    saveDraft,
    saveDraftDebounced,
    loadDraft,
    clearDraft,
    checkDraftExists,
    getTimeSinceLastSave,
    cleanupOldDrafts,
  }
}
