import { useState, useEffect, useRef, useContext } from 'react'
import { renderMd } from './renderMd'
import { SessionCtx } from './TaskPanel'

interface Props {
  hint?: string
  hintZh?: string
  translate?: string
}

export default function HelpButton({ hint, hintZh, translate }: Props) {
  const { config } = useContext(SessionCtx)
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

  const mathOpts = { math: config.enableMath }

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
                {renderMd(hint!, mathOpts)}
                {hintZh && <span style={{ color: 'var(--t3)', marginLeft: 4 }}>{renderMd(hintZh, mathOpts)}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function HintBanner({ hint, hintZh, walkthrough, walkthroughZh }: {
  hint?: string; hintZh?: string
  walkthrough?: string; walkthroughZh?: string
}) {
  const { config } = useContext(SessionCtx)
  if (!hint && !walkthrough) return null
  const mathOpts = { math: config.enableMath }
  return (
    <div className="stu-hint-banner" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{ flexShrink: 0, fontSize: 14 }}>💡</span>
      <div>
        {hint && <>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Need help?</div>
          <div>{renderMd(hint, mathOpts)}</div>
          {hintZh && <div style={{ color: 'var(--t3)', marginTop: 2 }}>{renderMd(hintZh, mathOpts)}</div>}
        </>}
        {walkthrough && <>
          <div style={{ fontWeight: 600, marginTop: hint ? 8 : 0, marginBottom: 2, color: 'var(--blue)' }}>
            Step-by-step
          </div>
          <div>{renderMd(walkthrough, mathOpts)}</div>
          {walkthroughZh && <div style={{ color: 'var(--t3)', marginTop: 2 }}>{renderMd(walkthroughZh, mathOpts)}</div>}
        </>}
      </div>
    </div>
  )
}
