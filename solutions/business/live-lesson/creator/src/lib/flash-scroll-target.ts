/**
 * Scroll an element into view + apply a brief amber flash so the
 * teacher's eye lands on the right spot after a nav:// jump.
 *
 * Shared between ExecutionTab and PlanTab — the scroll behavior is
 * the same; only the selector differs. The flash CSS lives in
 * `src/index.css` (`.scroll-target-flash` + matching keyframes).
 *
 * Caller responsibility: find the element (e.g. via querySelector).
 * If null is passed, this function no-ops — the caller's retry logic
 * still gets to decide whether to try again later when the data
 * loads.
 */
export function flashScrollTarget(el: Element | null): void {
  if (!el) return
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  el.scrollIntoView({
    block: 'start',
    behavior: reduceMotion ? 'auto' : 'smooth',
  })

  // Add the flash class even under reduce-motion — the CSS media query
  // suppresses the animation but the class is harmless. Skipping the
  // class entirely is also fine; we apply it so the teacher *could*
  // still get a static highlight if they later flip the setting.
  el.classList.add('scroll-target-flash')
  // Class-removal timer (1600ms) is intentionally 100ms longer than
  // the CSS keyframe duration (1.5s) in `src/index.css` so the class
  // outlives the animation frame and removal isn't visible as a
  // re-color. Keep these two numbers in sync when tuning.
  // Fire-and-forget: if the element unmounts while the timer is
  // pending, classList.remove on a detached node is a no-op — no
  // cleanup needed.
  setTimeout(() => {
    el.classList.remove('scroll-target-flash')
  }, 1600)
}
