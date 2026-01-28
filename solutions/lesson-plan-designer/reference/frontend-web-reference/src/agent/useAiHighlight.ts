/**
 * useAiHighlight - Composable for AI update highlighting
 *
 * When AI updates a form field via formStateSynchronizer, this composable
 * provides a reactive `isHighlighted` ref that becomes true for 3 seconds.
 *
 * Usage:
 * ```ts
 * const { isHighlighted } = useAiHighlight('textbookAnalysis')
 * // In template: :class="{ 'ai-updated': isHighlighted }"
 * ```
 */
import { ref, onUnmounted } from 'vue'
import { formStateSynchronizer, type FormUpdateEvent } from './form-state-synchronizer'

const HIGHLIGHT_DURATION_MS = 3000

export function useAiHighlight(fieldName: string) {
  const isHighlighted = ref(false)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const handleUpdate = (event: FormUpdateEvent) => {
    // Only highlight when:
    // 1. The field matches
    // 2. The update comes from AI (source === 'agent' or 'a2ui')
    // 3. The value actually changed
    if (
      event.field === fieldName &&
      (event.source === 'agent' || event.source === 'a2ui') &&
      event.oldValue !== event.value
    ) {
      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      // Start highlight
      isHighlighted.value = true
      console.log(`[useAiHighlight] Highlighting field: ${fieldName}`)

      // Auto-fade after duration
      timeoutId = setTimeout(() => {
        isHighlighted.value = false
        timeoutId = null
      }, HIGHLIGHT_DURATION_MS)
    }
  }

  // Subscribe to form updates
  const unsubscribe = formStateSynchronizer.onFormUpdated(handleUpdate)

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe()
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })

  return {
    isHighlighted,
  }
}
