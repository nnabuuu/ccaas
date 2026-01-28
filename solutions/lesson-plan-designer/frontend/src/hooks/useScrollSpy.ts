import { useState, useEffect, useCallback, useRef } from 'react'

interface UseScrollSpyReturn {
  activeSection: string
  setActiveSection: (sectionId: string) => void
  scrollToSection: (sectionId: string) => void
}

/**
 * Hook to track which section is currently visible in the viewport
 * using IntersectionObserver for scroll spy functionality.
 *
 * @param sectionIds - Array of section element IDs to observe
 * @param options - Optional IntersectionObserver options
 * @returns Object with activeSection, setActiveSection, and scrollToSection
 */
export function useScrollSpy(
  sectionIds: string[],
  options?: IntersectionObserverInit
): UseScrollSpyReturn {
  const [activeSection, setActiveSection] = useState<string>(sectionIds[0] || '')
  const visibleSectionsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (sectionIds.length === 0) return

    const observerOptions: IntersectionObserverInit = {
      root: options?.root ?? null,
      rootMargin: options?.rootMargin ?? '-10% 0px -80% 0px', // Top 10-20% of viewport triggers
      threshold: options?.threshold ?? [0, 0.25, 0.5, 0.75, 1],
    }

    const handleIntersection: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        const sectionId = entry.target.id
        if (entry.isIntersecting) {
          visibleSectionsRef.current.set(sectionId, entry.intersectionRatio)
        } else {
          visibleSectionsRef.current.delete(sectionId)
        }
      })

      // Find the section with the highest intersection ratio
      let maxRatio = 0
      let topSection = ''

      visibleSectionsRef.current.forEach((ratio, sectionId) => {
        if (ratio > maxRatio) {
          maxRatio = ratio
          topSection = sectionId
        }
      })

      if (topSection) {
        setActiveSection(topSection)
      }
    }

    const observer = new IntersectionObserver(handleIntersection, observerOptions)

    // Observe all section elements
    sectionIds.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      observer.disconnect()
    }
  }, [sectionIds, options?.root, options?.rootMargin, options?.threshold])

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(sectionId)
    }
  }, [])

  return {
    activeSection,
    setActiveSection,
    scrollToSection,
  }
}
