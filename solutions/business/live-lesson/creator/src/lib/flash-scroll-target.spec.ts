import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flashScrollTarget } from './flash-scroll-target'

describe('flashScrollTarget', () => {
  let scrollCalls: Array<ScrollIntoViewOptions | boolean | undefined>

  // jsdom doesn't implement Element.scrollIntoView OR window.matchMedia,
  // so we assign stubs directly rather than spy on a missing property.
  // Restored in afterEach.
  beforeEach(() => {
    vi.useFakeTimers()
    scrollCalls = []
    ;(Element.prototype as unknown as { scrollIntoView: (opts?: unknown) => void }).scrollIntoView = function (
      opts?: unknown,
    ) {
      scrollCalls.push(opts as ScrollIntoViewOptions | boolean | undefined)
    }
    ;(window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView
    delete (window as unknown as { matchMedia?: unknown }).matchMedia
  })

  it('no-ops when element is null', () => {
    expect(() => flashScrollTarget(null)).not.toThrow()
    expect(scrollCalls).toHaveLength(0)
  })

  it('calls scrollIntoView with block:start + smooth behavior (no reduce-motion)', () => {
    const el = document.createElement('div')
    flashScrollTarget(el)
    expect(scrollCalls).toEqual([{ block: 'start', behavior: 'smooth' }])
  })

  it('falls back to behavior:auto when prefers-reduced-motion is set', () => {
    ;(window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (query: string) =>
      ({
        matches: true, // user prefers reduce-motion
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList
    const el = document.createElement('div')
    flashScrollTarget(el)
    expect(scrollCalls).toEqual([{ block: 'start', behavior: 'auto' }])
  })

  it('adds the scroll-target-flash class immediately + removes it after 1600ms', () => {
    const el = document.createElement('div')
    flashScrollTarget(el)
    expect(el.classList.contains('scroll-target-flash')).toBe(true)

    vi.advanceTimersByTime(1_599)
    expect(el.classList.contains('scroll-target-flash')).toBe(true)

    vi.advanceTimersByTime(2)
    expect(el.classList.contains('scroll-target-flash')).toBe(false)
  })

  it('does not throw if the element has detached from the DOM before the class-remove timer fires', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    flashScrollTarget(el)
    document.body.removeChild(el)
    expect(() => vi.advanceTimersByTime(2_000)).not.toThrow()
  })
})
