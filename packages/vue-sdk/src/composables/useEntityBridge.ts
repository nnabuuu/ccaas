/**
 * useEntityBridge Composable
 *
 * Bridges AI-generated content to any entity store.
 * Auto-subscribes to useAgentChat for zero-config usage.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useEntityBridge } from '@ccaas/vue-sdk'
 *
 * const draft = reactive({
 *   textbookAnalysis: '',
 *   studentAnalysis: '',
 *   learningObjectives: '',
 * })
 *
 * const bridge = useEntityBridge({
 *   sections: ['textbookAnalysis', 'studentAnalysis', 'learningObjectives'],
 *   fieldMapping: {
 *     textbook_analysis: 'textbookAnalysis',
 *     student_analysis: 'studentAnalysis',
 *     learning_objectives: 'learningObjectives',
 *   },
 *   updateSection: (id, content) => {
 *     draft[id] = content
 *   },
 *   saveToBackend: async () => {
 *     await lessonPlanApi.update(id, draft)
 *   }
 * })
 *
 * // That's it! output_update events are automatically routed
 *
 * // Save when user clicks save button
 * async function handleSave() {
 *   await bridge.saveAll()
 * }
 * </script>
 * ```
 */

import { ref, computed, onMounted, onUnmounted, readonly } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useAgentChat, type UseAgentChatReturn } from './useAgentChat'
import type {
  EntityBridgeConfig,
  SectionState,
  SectionStatus,
  EntityOutputUpdateEvent,
} from '../types/entity-bridge'

// Re-export for convenience
export type { UseEntityBridgeReturn } from '../types/entity-bridge'

// Import for use in this file
import type { UseEntityBridgeReturn } from '../types/entity-bridge'

/**
 * Entity bridge composable
 *
 * Provides entity-agnostic bridging between AI output and entity stores.
 * Automatically subscribes to output_update events from useAgentChat.
 */
export function useEntityBridge(config: EntityBridgeConfig): UseEntityBridgeReturn {
  const {
    chat: customChat,
    sections,
    fieldMapping,
    updateSection,
    saveToBackend,
    onStart,
    onComplete,
    onError,
    debug = false,
  } = config

  // Use provided chat or create new one
  const chat: UseAgentChatReturn = customChat ?? useAgentChat()

  // State
  const aiEditingMode = ref(false)
  const currentSection = ref<string | null>(null)
  const sectionStates = ref<Record<string, SectionState>>({})
  const isDirty = ref(false)
  const isSaving = ref(false)

  // Initialize section states
  function initializeSectionStates(): void {
    const states: Record<string, SectionState> = {}
    for (const section of sections) {
      states[section] = { status: 'idle' }
    }
    sectionStates.value = states
  }

  // Computed progress
  const progress = computed(() => {
    const states = Object.values(sectionStates.value)
    if (states.length === 0) return 0

    const completed = states.filter((s) => s.status === 'completed').length
    return Math.round((completed / states.length) * 100)
  })

  // Reverse field mapping (frontend -> backend)
  const reverseFieldMapping: Record<string, string> = {}
  for (const [backend, frontend] of Object.entries(fieldMapping)) {
    reverseFieldMapping[frontend] = backend
  }

  /**
   * Log debug message
   */
  function log(...args: unknown[]): void {
    if (debug) {
      console.log('[useEntityBridge]', ...args)
    }
  }

  /**
   * Update section status
   */
  function updateSectionStatus(sectionId: string, status: SectionStatus, error?: string): void {
    sectionStates.value = {
      ...sectionStates.value,
      [sectionId]: {
        status,
        error,
        lastUpdatedAt: new Date(),
      },
    }
  }

  /**
   * Handle output_update event
   */
  function handleOutputUpdate(event: EntityOutputUpdateEvent): void {
    const { field, content, data, isFinal } = event

    // Map backend field to frontend section
    const sectionId = fieldMapping[field]

    if (!sectionId) {
      log(`Unknown field "${field}", ignoring. Available mappings:`, Object.keys(fieldMapping))
      return
    }

    // Verify section is in our config
    if (!sections.includes(sectionId)) {
      log(`Section "${sectionId}" not in sections config, ignoring`)
      return
    }

    log(`Handling output_update for field "${field}" -> section "${sectionId}"`)

    // Start AI editing if not already
    if (!aiEditingMode.value) {
      startAIEditing()
    }

    // Update section state
    currentSection.value = sectionId
    updateSectionStatus(sectionId, 'streaming')

    // Get content (prefer data over content)
    const sectionContent = data ?? content

    // Call update callback
    try {
      updateSection(sectionId, sectionContent)
      isDirty.value = true

      // Mark as completed if final
      if (isFinal) {
        updateSectionStatus(sectionId, 'completed')
        log(`Section "${sectionId}" completed`)

        // Check if all sections are complete
        const allCompleted = sections.every(
          (s) => sectionStates.value[s]?.status === 'completed'
        )
        if (allCompleted) {
          log('All sections completed')
          onComplete?.()
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      updateSectionStatus(sectionId, 'error', error.message)
      onError?.(error)
    }
  }

  /**
   * Start AI editing mode
   */
  function startAIEditing(): void {
    log('Starting AI editing mode')
    aiEditingMode.value = true
    currentSection.value = null
    isDirty.value = false

    // Reset section states to pending
    const states: Record<string, SectionState> = {}
    for (const section of sections) {
      states[section] = { status: 'pending' }
    }
    sectionStates.value = states

    onStart?.()
  }

  /**
   * Stop AI editing mode
   */
  function stopAIEditing(): void {
    log('Stopping AI editing mode')
    aiEditingMode.value = false
    currentSection.value = null
    // Keep isDirty so user knows there are unsaved changes
  }

  /**
   * Save all changes to backend
   */
  async function saveAll(): Promise<void> {
    if (!isDirty.value) {
      log('No changes to save')
      return
    }

    log('Saving all changes')
    isSaving.value = true

    try {
      await saveToBackend()
      isDirty.value = false
      stopAIEditing()
      log('Save successful')
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      onError?.(error)
      throw error
    } finally {
      isSaving.value = false
    }
  }

  /**
   * Discard all changes and exit AI editing mode
   */
  function discardAll(): void {
    log('Discarding all changes')
    aiEditingMode.value = false
    currentSection.value = null
    isDirty.value = false
    initializeSectionStates()
  }

  /**
   * Check if a section is currently being edited
   */
  function isSectionEditing(sectionId: string): boolean {
    return currentSection.value === sectionId
  }

  /**
   * Check if a section has been completed
   */
  function isSectionCompleted(sectionId: string): boolean {
    return sectionStates.value[sectionId]?.status === 'completed'
  }

  /**
   * Reset all state
   */
  function reset(): void {
    aiEditingMode.value = false
    currentSection.value = null
    isDirty.value = false
    isSaving.value = false
    initializeSectionStates()
  }

  // Auto-subscribe to output_update on mount
  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    initializeSectionStates()

    // Subscribe to output_update events
    unsubscribe = chat.on('output_update', handleOutputUpdate)
    log('Subscribed to output_update events')

    // Also subscribe to complete event
    chat.on('complete', () => {
      if (aiEditingMode.value) {
        stopAIEditing()
      }
    })
  })

  onUnmounted(() => {
    // Unsubscribe from events
    if (unsubscribe) {
      unsubscribe()
      log('Unsubscribed from output_update events')
    }
  })

  return {
    // Expose chat for advanced usage
    chat,

    // State
    aiEditingMode: readonly(aiEditingMode),
    currentSection: readonly(currentSection),
    sectionStates: readonly(sectionStates),
    progress,
    isDirty: readonly(isDirty),
    isSaving: readonly(isSaving),

    // Methods
    startAIEditing,
    stopAIEditing,
    handleOutputUpdate,
    saveAll,
    discardAll,
    isSectionEditing,
    isSectionCompleted,
    reset,
  }
}

export default useEntityBridge
