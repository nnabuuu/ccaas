import { useState, useEffect, useCallback, useRef } from 'react'

export interface TourStep {
  selector: string
  title: string
  body: string
  arrow: 'left' | 'right' | 'top'
  padding?: number
  onEnter?: () => void
}

interface Props {
  steps: TourStep[]
  storageKey?: string
  autoAdvanceMs?: number
  onComplete?: () => void
}

function storageGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function storageSet(key: string, val: string) {
  try { localStorage.setItem(key, val) } catch { /* noop */ }
}

function measureUnion(selector: string): DOMRect | null {
  const els = document.querySelectorAll(selector)
  if (!els.length) return null
  let top = Infinity, left = Infinity, bottom = -Infinity, right = -Infinity
  els.forEach(el => {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return
    top = Math.min(top, r.top)
    left = Math.min(left, r.left)
    bottom = Math.max(bottom, r.bottom)
    right = Math.max(right, r.right)
  })
  if (top === Infinity) return null
  return new DOMRect(left, top, right - left, bottom - top)
}

export default function SpotlightTour({ steps, storageKey = 'spotlight-tour-seen', autoAdvanceMs = 3000, onComplete }: Props) {
  const [step, setStep] = useState(-1) // -1 = not started
  const [cutout, setCutout] = useState<DOMRect | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completedRef = useRef(false)

  // ── Callbacks first (before any useEffect that references them) ──

  const finish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    storageSet(storageKey, '1')
    setStep(-1)
    setCutout(null)
    onComplete?.()
  }, [storageKey, onComplete])

  const advance = useCallback(() => {
    if (step >= steps.length - 1) {
      finish()
    } else {
      setStep(step + 1)
    }
  }, [step, steps.length, finish])

  const measure = useCallback(() => {
    if (step < 0 || step >= steps.length) return
    const s = steps[step]
    const pad = s.padding ?? 6
    const rect = measureUnion(s.selector)
    if (!rect) return
    setCutout(new DOMRect(rect.x - pad, rect.y - pad, rect.width + pad * 2, rect.height + pad * 2))
  }, [step, steps])

  // ── Effects ──

  // Check localStorage on mount, start after delay
  useEffect(() => {
    if (storageGet(storageKey) === '1') return
    const t = setTimeout(() => setStep(0), 500)
    return () => clearTimeout(t)
  }, [storageKey])

  // Measure cutout when step changes
  useEffect(() => {
    if (step < 0 || step >= steps.length) return
    steps[step].onEnter?.()
    // Wait for DOM to settle after onEnter
    let timer: ReturnType<typeof setTimeout>
    const raf = requestAnimationFrame(() => {
      timer = setTimeout(measure, 50)
    })
    return () => { cancelAnimationFrame(raf); clearTimeout(timer) }
  }, [step, steps, measure])

  // Re-measure on resize
  useEffect(() => {
    if (step < 0) return
    let timer: ReturnType<typeof setTimeout>
    const handler = () => { clearTimeout(timer); timer = setTimeout(measure, 150) }
    window.addEventListener('resize', handler)
    return () => { window.removeEventListener('resize', handler); clearTimeout(timer) }
  }, [step, measure])

  // Auto-advance timer
  useEffect(() => {
    if (step < 0 || !cutout) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => advance(), autoAdvanceMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [step, cutout, autoAdvanceMs, advance])

  // Keyboard: Escape to dismiss, block T key (textbook toggle) during tour
  useEffect(() => {
    if (step < 0) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); finish() }
      else if (e.key === 't' || e.key === 'T') { e.stopPropagation() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [step, finish])

  // ── Render ──

  if (step < 0 || !cutout) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const s = steps[step]

  // SVG path: outer rect (clockwise) + inner cutout (counter-clockwise for evenodd)
  const cx = cutout.x, cy = cutout.y, cw = cutout.width, ch = cutout.height
  const d = `M0,0 H${vw} V${vh} H0 Z M${cx},${cy} v${ch} h${cw} v${-ch} Z`

  // Tooltip position
  const gap = 12
  const tooltipStyle: React.CSSProperties = { position: 'fixed' }
  let arrowClass = ''

  if (s.arrow === 'right') {
    tooltipStyle.left = cutout.right + gap
    tooltipStyle.top = cy + ch / 2
    tooltipStyle.transform = 'translateY(-50%)'
    arrowClass = 'stu-tour-arrow-right'
  } else if (s.arrow === 'left') {
    tooltipStyle.right = vw - cx + gap
    tooltipStyle.top = cy + ch / 2
    tooltipStyle.transform = 'translateY(-50%)'
    arrowClass = 'stu-tour-arrow-left'
  } else {
    tooltipStyle.bottom = vh - cy + gap
    tooltipStyle.left = cx + cw / 2
    tooltipStyle.transform = 'translateX(-50%)'
    arrowClass = 'stu-tour-arrow-top'
  }

  return (
    <div className="stu-tour-overlay" onClick={advance}>
      <svg className="stu-tour-svg" viewBox={`0 0 ${vw} ${vh}`}>
        <path className="stu-tour-mask" d={d} fillRule="evenodd" />
      </svg>
      <div className={`stu-tour-tooltip ${arrowClass}`} style={tooltipStyle} onClick={e => e.stopPropagation()}>
        <div className="stu-tour-title">{s.title}</div>
        <div className="stu-tour-body">{s.body}</div>
        <div className="stu-tour-footer">
          <div className="stu-tour-dots">
            {steps.map((_, i) => (
              <div key={i} className={`stu-tour-dot${i === step ? ' active' : ''}`} />
            ))}
          </div>
          <button className="stu-tour-skip" onClick={finish}>跳过</button>
        </div>
      </div>
    </div>
  )
}
