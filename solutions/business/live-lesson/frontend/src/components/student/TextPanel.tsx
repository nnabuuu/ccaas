import { useRef, useEffect } from 'react'
import type { Paragraph } from '../../types/reading'

interface Props {
  title: string
  paragraphs: Paragraph[]
  focusIds: string[]
}

export default function TextPanel({ title, paragraphs, focusIds }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevFocus = useRef('')

  const focusSet = new Set(focusIds)

  // Auto-scroll to first focused paragraph when focus changes
  useEffect(() => {
    const k = focusIds.join(',')
    if (k !== prevFocus.current && focusIds.length > 0 && scrollRef.current) {
      prevFocus.current = k
      setTimeout(() => {
        const el = scrollRef.current?.querySelector(`[data-para="${focusIds[0]}"]`)
        if (el && scrollRef.current) {
          scrollRef.current.scrollTop = (el as HTMLElement).offsetTop - scrollRef.current.offsetTop - 10
        }
      }, 200)
    }
  }, [focusIds])

  const focusLabel = focusIds.length > 0
    ? `Focus ¶${focusIds.map(id => id.replace('p', '')).join(',')}`
    : ''

  return (
    <div className="stu-text-area">
      <div className="stu-text-inner">
        <div className="stu-text-hd">
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', flex: 1 }}>Text · {title}</span>
          {focusLabel && <span className="stu-text-hd-badge">{focusLabel}</span>}
        </div>
        <div className="stu-text-scroll" ref={scrollRef}>
          {paragraphs.map((p) => {
            const num = p.id.replace('p', '')
            const inFocus = focusSet.size === 0 || focusSet.has(p.id)
            return (
              <p
                key={p.id}
                data-para={p.id}
                className="stu-tp"
                style={{ opacity: inFocus ? 1 : 0.2 }}
              >
                <span className="stu-tp-n">¶{num}</span>{' '}
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
