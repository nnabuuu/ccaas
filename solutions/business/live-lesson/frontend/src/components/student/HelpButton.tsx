import { useState, useEffect, useRef, useContext, useCallback } from 'react'
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
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const hasHint = !!hint
  const hasTr = !!translate

  const updateDropPos = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const flipUp = rect.bottom + 200 > window.innerHeight
    setDropStyle({
      position: 'fixed',
      ...(flipUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
      right: Math.max(8, window.innerWidth - rect.right),
      zIndex: 40,
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updateDropPos()
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', h)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', h)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, updateDropPos])

  if (!hasHint && !hasTr) return null

  const mathOpts = { math: config.enableMath }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button ref={btnRef} className="stu-help-btn" onClick={e => { e.stopPropagation(); setOpen(!open) }}>?</button>
      {open && (
        <div className="stu-help-drop" style={dropStyle}>
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
