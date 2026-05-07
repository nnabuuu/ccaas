import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  depth: number // 0 = class, 1 = student
  children: ReactNode
}

type AnimState = 'closed' | 'entering' | 'open' | 'leaving'

export default function OverlayShell({ open, onClose, depth, children }: Props) {
  const [animState, setAnimState] = useState<AnimState>('closed')
  const prevOpen = useRef(false)

  useEffect(() => {
    let raf1: number, raf2: number
    if (open) {
      setAnimState('entering')
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setAnimState('open'))
      })
    } else if (prevOpen.current) {
      setAnimState('leaving')
      const t = setTimeout(() => setAnimState('closed'), 320)
      prevOpen.current = false
      return () => clearTimeout(t)
    }
    prevOpen.current = open
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [open])

  if (animState === 'closed') return null
  const isVisible = animState === 'open'
  const leftOffset = depth === 0 ? 48 : 108

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid={`overlay-backdrop-${depth}`}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100 + depth * 10,
          background: `rgba(28,28,26,${depth === 0 ? '.18' : '.12'})`,
          opacity: isVisible ? 1 : 0,
          transition: 'opacity .3s ease',
          cursor: 'pointer',
        }}
      />
      {/* Panel */}
      <div
        data-testid={`overlay-panel-${depth}`}
        style={{
          position: 'fixed', top: 0, bottom: 0, right: 0,
          left: leftOffset,
          zIndex: 101 + depth * 10,
          background: 'var(--bg)',
          borderLeft: '1px solid rgba(28,28,26,.06)',
          boxShadow: '-12px 0 40px rgba(28,28,26,.10)',
          display: 'flex', flexDirection: 'column',
          transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform .32s cubic-bezier(.4,.0,.2,1)',
          borderRadius: '14px 0 0 14px',
          overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </>
  )
}
