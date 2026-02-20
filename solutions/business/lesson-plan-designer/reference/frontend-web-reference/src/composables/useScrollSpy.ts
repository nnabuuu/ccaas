import { ref, onMounted, onUnmounted, nextTick, type Ref } from 'vue'

/**
 * Options for useScrollSpy composable
 */
interface ScrollSpyOptions {
  /** Margin around the root (default: '-120px 0px -70% 0px') */
  rootMargin?: string
  /** Visibility threshold (default: 0) */
  threshold?: number
}

/**
 * Return type for useScrollSpy composable
 */
interface ScrollSpyReturn {
  activeSection: Ref<string>
  setActiveSection: (id: string) => void
}

/**
 * Scroll spy composable using Intersection Observer
 * Tracks which section is currently visible in the viewport
 *
 * @param sectionIds - Array of section element IDs to observe
 * @param options - Configuration options
 * @returns activeSection ref and setActiveSection function
 */
export function useScrollSpy(sectionIds: string[], options: ScrollSpyOptions = {}): ScrollSpyReturn {
  const activeSection = ref<string>(sectionIds[0] || '')
  let observer: IntersectionObserver | null = null
  const visibleSections = new Map<string, boolean>()

  // Account for sticky header (~120px) at top
  const rootMargin = options.rootMargin || '-120px 0px -70% 0px'
  const threshold = options.threshold || 0

  const initObserver = (): void => {
    if (observer) {
      observer.disconnect()
    }

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          visibleSections.set(entry.target.id, entry.isIntersecting)
        })

        // Find the first visible section in order
        for (const id of sectionIds) {
          if (visibleSections.get(id)) {
            activeSection.value = id
            return
          }
        }
      },
      { rootMargin, threshold }
    )

    // Observe all sections
    let observedCount = 0
    sectionIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element && observer) {
        observer.observe(element)
        observedCount++
      }
    })

    // If no elements found, retry after a short delay
    if (observedCount === 0) {
      setTimeout(initObserver, 100)
    }
  }

  // Allow manual setting of active section (for click navigation)
  const setActiveSection = (id: string): void => {
    activeSection.value = id
  }

  onMounted(() => {
    // Use nextTick to ensure DOM is ready
    nextTick(() => {
      initObserver()
    })
  })

  onUnmounted(() => {
    if (observer) {
      observer.disconnect()
    }
  })

  return { activeSection, setActiveSection }
}
