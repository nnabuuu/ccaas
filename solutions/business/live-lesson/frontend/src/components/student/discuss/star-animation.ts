/**
 * Star collection animation utilities — imperative DOM operations.
 * Ported from design/highlight-star-animation.html.
 */

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const delay = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(signal.reason); return }
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(id); reject(signal.reason) }, { once: true })
  })

/* ── Trail particle (cosmetic) ── */
function spawnTrailParticle(x: number, y: number) {
  if (prefersReducedMotion()) return
  const p = document.createElement('span')
  p.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;
    width:3px;height:3px;border-radius:50%;
    background:var(--amber);opacity:0.7;
    pointer-events:none;z-index:999;
    transition:all 0.4s ease-out;
    transform:translate(-50%,-50%);
  `
  document.body.appendChild(p)
  requestAnimationFrame(() => {
    p.style.opacity = '0'
    p.style.transform = `translate(${-8 + Math.random() * 16}px, ${4 + Math.random() * 12}px) scale(0)`
  })
  p.addEventListener('transitionend', () => p.remove(), { once: true })
  setTimeout(() => p.remove(), 600) // safety fallback
}

/* ── Flying star arc animation (rAF, 500 ms) ── */
export function flyStarAnimated(sx: number, sy: number, ex: number, ey: number, signal?: AbortSignal): Promise<void> {
  if (prefersReducedMotion()) return Promise.resolve()
  return new Promise(resolve => {
    const star = document.createElement('span')
    star.className = 'sd-flying-star'
    star.textContent = '✦'
    star.style.left = sx + 'px'
    star.style.top = sy + 'px'
    star.style.transform = 'translate(-50%, -50%) scale(1.3)'
    star.style.opacity = '1'
    document.body.appendChild(star)

    const duration = 500
    const startTime = performance.now()
    const dx = ex - sx
    const dy = ey - sy

    function animate(now: number) {
      if (signal?.aborted) { star.remove(); resolve(); return }

      const elapsed = now - startTime
      const t = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const arcY = -50 * Math.sin(t * Math.PI)

      star.style.left = (sx + dx * ease) + 'px'
      star.style.top = (sy + dy * ease + arcY) + 'px'
      star.style.transform = `translate(-50%, -50%) scale(${1.3 - 0.7 * t})`

      if (t > 0.1 && t < 0.85 && Math.random() > 0.5) {
        spawnTrailParticle(sx + dx * ease, sy + dy * ease + arcY)
      }

      if (t < 1) {
        requestAnimationFrame(animate)
      } else {
        star.remove()
        resolve()
      }
    }
    requestAnimationFrame(animate)
  })
}

/* ── Count bump (90 ms in, text swaps mid-animation) ── */
export function animateCountIncrement(el: HTMLElement, newValue: number) {
  el.classList.remove('bump')
  void el.offsetWidth // force reflow
  el.classList.add('bump')
  setTimeout(() => { el.textContent = String(newValue) }, 90)
  setTimeout(() => el.classList.remove('bump'), 400)
}

/* ── "+N" floating indicator (auto-removes after 650 ms) ── */
export function showPlusIndicator(slot: HTMLElement, amount: number) {
  slot.querySelector('.sd-plus-indicator')?.remove()
  const ind = document.createElement('span')
  ind.className = 'sd-plus-indicator'
  ind.textContent = `+${amount}`
  slot.appendChild(ind)
  setTimeout(() => ind.remove(), 650)
}

/* ── Full star-collection orchestration ── */
export async function runStarAnimation(
  slotEl: HTMLDivElement | null,
  countEl: HTMLSpanElement | null,
  notifEl: HTMLSpanElement | null,
  newTotal: number,
  hitCount: number,
  signal?: AbortSignal,
) {
  if (!slotEl || !countEl || !notifEl) return

  try {
    await delay(900, signal) // let user read the notification
  } catch { return } // aborted

  const isFirst = !slotEl.classList.contains('visible')
  if (isFirst) {
    slotEl.classList.add('visible')
    countEl.textContent = '0'
  }

  try {
    await delay(isFirst ? 250 : 50, signal)
  } catch { return }

  if (signal?.aborted) return

  // Fly star from notification center to star slot
  const nr = notifEl.getBoundingClientRect()
  const sr = slotEl.getBoundingClientRect()
  await flyStarAnimated(
    nr.left + nr.width / 2, nr.top + nr.height / 2,
    sr.left + sr.width / 2, sr.top + sr.height / 2,
    signal,
  )

  if (signal?.aborted) return

  // Collect: bump count + plus indicator + pulse
  animateCountIncrement(countEl, newTotal)
  showPlusIndicator(slotEl, hitCount)
  slotEl.classList.remove('collect')
  void slotEl.offsetWidth
  slotEl.classList.add('collect')
  setTimeout(() => slotEl.classList.remove('collect'), 450)
}
