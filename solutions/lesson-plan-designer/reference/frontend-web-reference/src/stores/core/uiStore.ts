/**
 * UI Store
 *
 * Manages cross-cutting UI state including navigation events, loading states,
 * and global UI concerns. Core store for UI coordination.
 *
 * State:
 * - eventQueue: Navigation event queue
 * - currentTarget: Current navigation target
 * - isNavigating: Whether navigation is in progress
 * - config: Navigation configuration
 *
 * Mutation Patterns:
 * - navigate: optimistic (queues event immediately)
 * - consumeNext: optimistic (updates queue state immediately)
 * - completeEvent: optimistic (marks event as done immediately)
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Types
type EventStatus = 'pending' | 'executing' | 'completed' | 'failed'

interface NavigationConfig {
  defaultDelay: number
  highlightDuration: number
  scrollOffset: number
  smoothScroll: boolean
}

interface NavigationOptions {
  type?: string
  smooth?: boolean
  highlight?: boolean
  highlightDuration?: number
  autoEdit?: boolean
  delay?: number
  params?: Record<string, unknown>
}

interface NavigationEvent {
  id: string
  targetId: string
  type: string
  options: {
    smooth: boolean
    highlight: boolean
    highlightDuration: number
    autoEdit: boolean
    delay: number
    params: Record<string, unknown>
  }
  timestamp: number
  status: EventStatus
  failReason?: string
}

export const useUiStore = defineStore('ui', () => {
  // === Navigation State ===
  const eventQueue = ref<NavigationEvent[]>([])
  const currentTarget = ref<string | null>(null)
  const isNavigating = ref(false)
  const config = ref<NavigationConfig>({
    defaultDelay: 400,        // ms between navigations
    highlightDuration: 1500,  // ms for highlight effect
    scrollOffset: 120,        // px offset for sticky header
    smoothScroll: true
  })

  // Counter for generating unique event IDs
  let eventIdCounter = 0

  // === Getters ===
  const hasEvents = computed(() => eventQueue.value.length > 0)
  const pendingCount = computed(() => eventQueue.value.filter(e => e.status === 'pending').length)

  // === Navigation Actions ===

  /**
   * Queue a navigation event
   * @pattern optimistic - Queues event immediately
   * @param targetId - The registry target ID (e.g., 'lessonPlan.learningObjectives')
   * @param options - Navigation options
   * @returns The created navigation event
   */
  function navigate(targetId: string, options: NavigationOptions = {}): NavigationEvent {
    const event: NavigationEvent = {
      id: `nav-${++eventIdCounter}`,
      targetId,
      type: options.type || 'scroll',
      options: {
        smooth: options.smooth ?? config.value.smoothScroll,
        highlight: options.highlight ?? true,
        highlightDuration: options.highlightDuration ?? config.value.highlightDuration,
        autoEdit: options.autoEdit ?? false,
        delay: options.delay ?? config.value.defaultDelay,
        params: options.params || {}
      },
      timestamp: Date.now(),
      status: 'pending'
    }

    eventQueue.value.push(event)
    return event
  }

  /**
   * Consume and return the next pending event from the queue
   * @pattern optimistic - Updates queue state immediately
   * @returns The next event or null if queue is empty
   */
  function consumeNext(): NavigationEvent | null {
    const nextEvent = eventQueue.value.find(e => e.status === 'pending')
    if (nextEvent) {
      nextEvent.status = 'executing'
      currentTarget.value = nextEvent.targetId
      isNavigating.value = true
    }
    return nextEvent || null
  }

  /**
   * Mark an event as completed
   * @pattern optimistic - Marks event as done immediately
   * @param eventId - The event ID to mark complete
   */
  function completeEvent(eventId: string): void {
    const event = eventQueue.value.find(e => e.id === eventId)
    if (event) {
      event.status = 'completed'
    }

    // Check if there are more pending events
    const hasPending = eventQueue.value.some(e => e.status === 'pending')
    if (!hasPending) {
      isNavigating.value = false
      currentTarget.value = null
    }

    // Clean up old completed events (keep last 10)
    const completed = eventQueue.value.filter(e => e.status === 'completed')
    if (completed.length > 10) {
      const toRemove = completed.slice(0, completed.length - 10)
      eventQueue.value = eventQueue.value.filter(e => !toRemove.includes(e))
    }
  }

  /**
   * Mark an event as failed
   * @pattern optimistic - Marks event as failed immediately
   * @param eventId - The event ID to mark failed
   * @param reason - Reason for failure
   */
  function failEvent(eventId: string, reason: string): void {
    const event = eventQueue.value.find(e => e.id === eventId)
    if (event) {
      event.status = 'failed'
      event.failReason = reason
    }

    const hasPending = eventQueue.value.some(e => e.status === 'pending')
    if (!hasPending) {
      isNavigating.value = false
      currentTarget.value = null
    }
  }

  /**
   * Clear all pending events from the queue
   * @pattern optimistic
   */
  function clearQueue(): void {
    // Only clear pending events, let executing ones complete
    eventQueue.value = eventQueue.value.filter(e => e.status !== 'pending')
  }

  /**
   * Update navigation configuration
   * @pattern optimistic
   * @param partial - Partial config to merge
   */
  function setConfig(partial: Partial<NavigationConfig>): void {
    config.value = { ...config.value, ...partial }
  }

  return {
    // Navigation State
    eventQueue,
    currentTarget,
    isNavigating,
    config,
    // Getters
    hasEvents,
    pendingCount,
    // Navigation Actions
    navigate,
    consumeNext,
    completeEvent,
    failEvent,
    clearQueue,
    setConfig
  }
})

// Also export as useNavigationStore for backward compatibility during migration
export const useNavigationStore = useUiStore
