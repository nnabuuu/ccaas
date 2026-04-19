import { useRef, useCallback } from 'react'
import type { Paragraph } from '../../types/reading'

interface Props {
  title: string
  paragraphs: Paragraph[]
  focusIds: string[]
  onClose: () => void
}

export default function TextPanel({ title, paragraphs, focusIds, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const jumpTo = useCallback((paraId: string) => {
    const el = scrollRef.current?.querySelector(`[data-para="${paraId}"]`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 1800)
  }, [])

  const focusSet = new Set(focusIds)
  const focusLabel = focusIds.length > 0
    ? `聚焦 ¶${focusIds.map(id => id.replace('p', '')).join(',')}`
    : ''

  return (
    <div className="stu-text-area">
      <div className="stu-text-inner">
        <div className="stu-text-hd">
          <div className="stu-text-hd-icon">📖</div>
          <div className="stu-text-hd-title">课文 · {title}</div>
          {focusLabel && <div className="stu-text-hd-badge">{focusLabel}</div>}
          <button className="stu-text-hd-close" onClick={onClose}>✕</button>
        </div>
        <div className="stu-text-scroll" ref={scrollRef}>
          {paragraphs.map((p) => {
            const num = p.id.replace('p', '')
            const inFocus = focusSet.size === 0 || focusSet.has(p.id)
            return (
              <p
                key={p.id}
                data-para={p.id}
                className={`stu-tp${!inFocus ? ' dim' : ''}`}
              >
                <span className="stu-tp-n">¶{num}</span>
                {p.role === 'key' ? (
                  <span className="stu-tp-key">{renderSignals(p.text, p.signals)}</span>
                ) : (
                  <span className="stu-tp-detail">{p.text}</span>
                )}
              </p>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function renderSignals(text: string, signals?: string[]) {
  if (!signals || signals.length === 0) return text
  const parts: (string | JSX.Element)[] = []
  let remaining = text
  let keyIdx = 0
  for (const sig of signals) {
    const idx = remaining.indexOf(sig)
    if (idx === -1) continue
    if (idx > 0) parts.push(remaining.slice(0, idx))
    parts.push(<span key={keyIdx++} className="sig">{sig}</span>)
    remaining = remaining.slice(idx + sig.length)
  }
  if (remaining) parts.push(remaining)
  return <>{parts}</>
}

// Expose jumpTo for parent to call
export type TextPanelHandle = { jumpTo: (paraId: string) => void }
