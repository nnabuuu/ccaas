import { useState, useEffect, useRef } from 'react'

interface Props {
  hint?: string
  hintZh?: string
  translate?: string
}

export default function HelpButton({ hint, hintZh, translate }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const hasHint = !!hint
  const hasTr = !!translate

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  if (!hasHint && !hasTr) return null

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button className="stu-help-btn" onClick={e => { e.stopPropagation(); setOpen(!open) }}>?</button>
      {open && (
        <div className="stu-help-drop">
          {hasTr && (
            <div style={{ marginBottom: hasHint ? 8 : 0 }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 3 }}>中文翻译</div>
              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{translate}</div>
            </div>
          )}
          {hasHint && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', marginBottom: 3 }}>Hint</div>
              <div style={{ fontSize: 12, color: 'var(--amber)', lineHeight: 1.5 }}>
                {hint}
                {hintZh && <span style={{ color: 'var(--t3)', marginLeft: 4 }}>{hintZh}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function HintBanner({ hint, hintZh }: { hint?: string; hintZh?: string }) {
  if (!hint) return null
  return (
    <div className="stu-hint-banner" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{ flexShrink: 0, fontSize: 14 }}>💡</span>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>Need help?</div>
        <div>{hint}</div>
        {hintZh && <div style={{ color: 'var(--t3)', marginTop: 2 }}>{hintZh}</div>}
      </div>
    </div>
  )
}
