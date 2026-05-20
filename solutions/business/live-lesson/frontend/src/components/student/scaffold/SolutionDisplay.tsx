import { useState, useEffect } from 'react'

export interface SolutionLine {
  prefix: string
  text: string
  isFinal?: boolean
}

export interface SolutionDisplayProps {
  lines: SolutionLine[]
}

/**
 * Progressive line-by-line solution reveal with animation.
 * Final answer line gets green highlight.
 *
 * Ported from design/practice-app-v3.jsx SolutionDisplay.
 */
export default function SolutionDisplay({ lines }: SolutionDisplayProps) {
  const [visLines, setVisLines] = useState(0)

  useEffect(() => {
    setVisLines(0)
    let i = 0
    let cancelled = false
    const count = lines.length
    const tick = () => {
      if (cancelled) return
      i++
      setVisLines(i)
      if (i < count) setTimeout(tick, 500)
    }
    const t = setTimeout(tick, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [lines])

  return (
    <div className="sw-solution">
      {lines.map((l, i) => (
        <div
          key={i}
          className={
            'sw-sol-line' +
            (i < visLines ? ' vis' : '') +
            (l.isFinal ? ' sw-sol-final' : '')
          }
        >
          <span className="sw-sol-prefix">{l.prefix}</span>
          {l.isFinal
            ? <span className="sw-sol-answer">{l.text}</span>
            : l.text}
        </div>
      ))}
    </div>
  )
}
