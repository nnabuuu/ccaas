import { useState, useEffect, useCallback, useRef } from 'react'
import { renderMd } from '../renderMd'

export interface ProcedureStepsProps {
  steps: Array<{ label: string }>
  enableMath?: boolean
}

const BADGE_COLORS = ['#2563eb', '#16a34a', '#d97706'] // blue, green, amber

/**
 * Animated step-by-step procedure display.
 * Steps fade-in + slide-up one by one (600ms interval, 300ms initial delay).
 * Replay button resets the animation.
 */
export default function ProcedureSteps({ steps, enableMath }: ProcedureStepsProps) {
  const [visCount, setVisCount] = useState(0)
  const cleanupRef = useRef<(() => void) | null>(null)

  const play = useCallback(() => {
    cleanupRef.current?.()
    setVisCount(0)
    let i = 0
    let cancelled = false
    let pending: ReturnType<typeof setTimeout> | null = null
    const tick = () => {
      if (cancelled) return
      i++
      setVisCount(i)
      if (i < steps.length) pending = setTimeout(tick, 600)
    }
    pending = setTimeout(tick, 300)
    cleanupRef.current = () => { cancelled = true; if (pending) clearTimeout(pending) }
  }, [steps.length])

  useEffect(() => {
    play()
    return () => cleanupRef.current?.()
  }, [play])

  return (
    <div className="sw-proc">
      {steps.map((step, i) => (
        <div key={i} className={'sw-proc-step' + (i < visCount ? ' vis' : '')}>
          <span
            className="sw-proc-badge"
            style={{ background: BADGE_COLORS[i % BADGE_COLORS.length] }}
          >
            {i + 1}
          </span>
          <div className="sw-proc-label">{renderMd(step.label, { math: enableMath })}</div>
        </div>
      ))}
      <button className="sw-formula-play" onClick={play} type="button">
        <span>&#9654;</span> <span>重播</span>
      </button>
    </div>
  )
}
