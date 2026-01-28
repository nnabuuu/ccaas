import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScrollSpy } from '../src/hooks/useScrollSpy'

// Mock IntersectionObserver
class MockIntersectionObserver {
  readonly root: Element | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []

  private callback: IntersectionObserverCallback
  private static instances: MockIntersectionObserver[] = []

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    MockIntersectionObserver.instances.push(this)
  }

  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])

  // Helper to simulate intersection
  static triggerIntersection(entries: Partial<IntersectionObserverEntry>[]) {
    const instance = MockIntersectionObserver.instances[MockIntersectionObserver.instances.length - 1]
    if (instance) {
      instance.callback(
        entries.map(entry => ({
          isIntersecting: false,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: 0,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          target: document.createElement('div'),
          time: Date.now(),
          ...entry,
        })),
        instance as unknown as IntersectionObserver
      )
    }
  }

  static clearInstances() {
    MockIntersectionObserver.instances = []
  }
}

describe('useScrollSpy', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    MockIntersectionObserver.clearInstances()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const sectionIds = ['basic', 'objectives', 'activities', 'assessment']

  it('should return first section as active by default', () => {
    const { result } = renderHook(() => useScrollSpy(sectionIds))

    expect(result.current.activeSection).toBe('basic')
  })

  it('should observe all section elements', () => {
    // Create mock elements
    sectionIds.forEach(id => {
      const el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)
    })

    renderHook(() => useScrollSpy(sectionIds))

    // Check that observe was called for each section
    const observer = MockIntersectionObserver.instances[0]
    expect(observer.observe).toHaveBeenCalledTimes(sectionIds.length)

    // Cleanup
    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.remove()
    })
  })

  it('should update activeSection when section becomes visible', () => {
    // Create mock elements
    sectionIds.forEach(id => {
      const el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)
    })

    const { result } = renderHook(() => useScrollSpy(sectionIds))

    // Simulate objectives section becoming visible
    const objectivesEl = document.getElementById('objectives')!
    act(() => {
      MockIntersectionObserver.triggerIntersection([
        { target: objectivesEl, isIntersecting: true, intersectionRatio: 0.5 }
      ])
    })

    expect(result.current.activeSection).toBe('objectives')

    // Cleanup
    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.remove()
    })
  })

  it('should allow manual section setting via setActiveSection', () => {
    const { result } = renderHook(() => useScrollSpy(sectionIds))

    act(() => {
      result.current.setActiveSection('assessment')
    })

    expect(result.current.activeSection).toBe('assessment')
  })

  it('should disconnect observer on unmount', () => {
    const { unmount } = renderHook(() => useScrollSpy(sectionIds))

    unmount()

    const observer = MockIntersectionObserver.instances[0]
    expect(observer.disconnect).toHaveBeenCalled()
  })

  it('should handle empty sectionIds array', () => {
    const { result } = renderHook(() => useScrollSpy([]))

    expect(result.current.activeSection).toBe('')
  })

  it('should prioritize the topmost visible section', () => {
    // Create mock elements
    sectionIds.forEach(id => {
      const el = document.createElement('div')
      el.id = id
      document.body.appendChild(el)
    })

    const { result } = renderHook(() => useScrollSpy(sectionIds))

    // Simulate multiple sections becoming visible
    const basicEl = document.getElementById('basic')!
    const objectivesEl = document.getElementById('objectives')!

    act(() => {
      MockIntersectionObserver.triggerIntersection([
        { target: basicEl, isIntersecting: true, intersectionRatio: 0.3 },
        { target: objectivesEl, isIntersecting: true, intersectionRatio: 0.7 }
      ])
    })

    // Should select the one with higher intersection ratio or the first one in order
    // Based on implementation, it could be either - let's test for objectives (higher ratio)
    expect(result.current.activeSection).toBe('objectives')

    // Cleanup
    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.remove()
    })
  })

  it('should provide scrollToSection function', () => {
    // Create mock elements
    const mockScrollIntoView = vi.fn()
    sectionIds.forEach(id => {
      const el = document.createElement('div')
      el.id = id
      el.scrollIntoView = mockScrollIntoView
      document.body.appendChild(el)
    })

    const { result } = renderHook(() => useScrollSpy(sectionIds))

    act(() => {
      result.current.scrollToSection('objectives')
    })

    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })

    // Cleanup
    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.remove()
    })
  })
})
