<script setup lang="ts">
/**
 * NavigationConsumer
 * Root-level component that watches the navigation event queue
 * and processes events sequentially with configurable delays
 *
 * SMART COMPONENT JUSTIFICATION:
 * - Needs uiStore access for reactive navigation event queue watching
 * - Must be mounted at app root level, cannot receive events via props
 * - Coordinates navigation across all pages (used in App.vue)
 *
 * Store dependencies: uiStore (navigation events)
 */
import { watch, ref } from 'vue'
import { useNavigationStore } from '../../stores/core/uiStore'
import { useNavigationRegistry } from '../../composables/useNavigationRegistry'

const navigationStore = useNavigationStore()
const registry = useNavigationRegistry()

const isProcessing = ref(false)

// Watch for new events in the queue
watch(
  () => navigationStore.eventQueue.length,
  async () => {
    if (isProcessing.value) return
    await processQueue()
  }
)

/**
 * Process events from the queue sequentially
 */
async function processQueue() {
  if (isProcessing.value) return

  isProcessing.value = true

  try {
    while (navigationStore.hasEvents) {
      const event = navigationStore.consumeNext()
      if (!event) break

      // Execute the navigation
      await registry.executeNavigation(event)

      // Check if there are more pending events
      const hasPending = navigationStore.eventQueue.some(e => e.status === 'pending')
      if (hasPending) {
        // Wait for the configured delay before processing next
        await new Promise(resolve =>
          setTimeout(resolve, event.options.delay ?? navigationStore.config.defaultDelay)
        )
      }
    }
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <!-- This is a headless component, no visible UI -->
</template>
