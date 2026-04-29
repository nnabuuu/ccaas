import { useRef, useEffect } from 'react'
import katex from 'katex'
import type { Paragraph, Segment } from '../../types/reading'
import { renderMd } from './renderMd'
import AudioButton from './AudioButton'

export interface TextOverlay {
  tokens: Record<number, Array<{ t: string; kind?: string }>>
  activeParagraphs: number[]
  tokenStates: Record<string, 'idle' | 'picked' | 'good' | 'bad' | 'missed'>
  onTokenClick?: (paraNum: number, tokenIdx: number) => void
}

interface Props {
  title: string
  paragraphs: Paragraph[]
  focusIds: string[]
  lessonId?: string
  showRoles?: boolean
  overlay?: TextOverlay | null
  collapsed?: boolean
  onToggle?: () => void
  enableMath?: boolean
}

export default function TextPanel({ title, paragraphs, focusIds, lessonId, showRoles, overlay, collapsed, onToggle, enableMath }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevFocus = useRef('')

  const focusSet = new Set(focusIds)
  const activeSet = overlay ? new Set(overlay.activeParagraphs) : null

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

  // Auto-scroll to first active overlay paragraph when activeParagraphs change
  const prevActive = useRef('')
  useEffect(() => {
    if (!overlay) return
    const k = overlay.activeParagraphs.join(',')
    if (k !== prevActive.current && overlay.activeParagraphs.length > 0 && scrollRef.current) {
      prevActive.current = k
      setTimeout(() => {
        const el = scrollRef.current?.querySelector(`[data-para="p${overlay.activeParagraphs[0]}"]`)
        if (el && scrollRef.current) {
          scrollRef.current.scrollTop = (el as HTMLElement).offsetTop - scrollRef.current.offsetTop - 10
        }
      }, 200)
    }
  }, [overlay?.activeParagraphs])

  const focusLabel = focusIds.length > 0
    ? `Focus ¶${focusIds.map(id => id.replace('p', '')).join(',')}`
    : ''

  if (collapsed) {
    return (
      <div className="stu-text-rail" onClick={onToggle}>
        <div className="stu-text-rail-icon">T</div>
        <div className="stu-text-rail-label">课文</div>
        {focusIds.length > 0 && (
          <div className="stu-text-rail-badge">{focusIds.length}</div>
        )}
      </div>
    )
  }

  return (
    <div className="stu-text-area stu-text-overlay">
      <div className="stu-text-inner">
        <div className="stu-text-hd">
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)', flex: 1 }}>Text · {title}</span>
          {focusLabel && <span className="stu-text-hd-badge">{focusLabel}</span>}
          {showRoles && !overlay && (
            <div style={{ fontSize: 12, color: 'var(--t3)', display: 'flex', gap: 10, marginTop: 2 }}>
              <span><span style={{ color: 'var(--t1)', fontWeight: 600 }}>●</span> Key sentence</span>
              <span><span style={{ color: 'var(--t2)' }}>○</span> Supporting detail</span>
              <span><span className="sig" style={{ fontSize: 12 }}>■</span> Signal word</span>
            </div>
          )}
          <button className="stu-text-close" onClick={onToggle} title="收起 (Esc)">×</button>
        </div>
        <div className="stu-text-scroll" ref={scrollRef}>
          {paragraphs.map((p) => {
            const num = p.id.replace('p', '')
            const paraNum = parseInt(num)
            const tokens = overlay?.tokens[paraNum]
            const isActive = activeSet?.has(paraNum) ?? false

            // Determine opacity: overlay active overrides normal focus
            let inFocus: boolean
            if (overlay) {
              inFocus = activeSet ? (activeSet.size === 0 || isActive) : true
            } else {
              inFocus = focusSet.size === 0 || focusSet.has(p.id)
            }

            return (
              <div
                key={p.id}
                data-para={p.id}
                className="stu-tp"
                style={{ opacity: inFocus ? 1 : 0.2 }}
              >
                <span className="stu-tp-n">¶{num}</span>
                {lessonId && <AudioButton src={`/api/lessons/${lessonId}/audio/p${num}.mp3`} />}
                {tokens ? (
                  <span className="stu-tp-detail">
                    {tokens.map((tk, i) => {
                      const key = `${paraNum}:${i}`
                      const state = overlay!.tokenStates[key]
                      const clickable = isActive && tk.kind && overlay!.onTokenClick
                      const cls = state ? `se-tk se-tk-${state}` : (tk.kind ? 'se-tk se-tk-idle' : '')
                      return (
                        <span
                          key={i}
                          className={cls || undefined}
                          onClick={clickable ? () => overlay!.onTokenClick!(paraNum, i) : undefined}
                        >{tk.t}</span>
                      )
                    })}
                  </span>
                ) : (showRoles && p.role === 'key') ? (
                  <span className="stu-tp-key">{renderSignals(p.text, p.signals)}</span>
                ) : p.content ? (
                  <span className="stu-tp-detail">{renderSegments(p.content, !!enableMath)}</span>
                ) : (
                  <span className="stu-tp-detail">{renderMd(p.text, { math: enableMath })}</span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function renderSegments(content: Segment[], math: boolean) {
  return content.map((seg, i) => {
    if (typeof seg === 'string') {
      return <span key={i}>{renderMd(seg, { math })}</span>
    }
    switch (seg.type) {
      case 'math':
        try {
          const html = katex.renderToString(seg.value, { displayMode: true, throwOnError: false })
          return <div key={i} className="seg-math" dangerouslySetInnerHTML={{ __html: html }} />
        } catch {
          return <div key={i} className="seg-math">{seg.value}</div>
        }
      case 'heading':
        return <div key={i} className="seg-heading">{seg.value}</div>
      case 'image':
        return <img key={i} src={seg.src} alt={seg.alt ?? ''} width={seg.width} style={{ maxWidth: '100%' }} />
      case 'figure': {
        let captionHtml: string | undefined
        if (seg.math) {
          try { captionHtml = katex.renderToString(seg.math, { displayMode: false, throwOnError: false }) } catch { /* noop */ }
        }
        return (
          <figure key={i} className="seg-figure">
            <img src={seg.src} alt={seg.alt ?? ''} width={seg.width} style={{ maxWidth: '100%' }} />
            {(seg.caption || captionHtml) && (
              <figcaption>
                {seg.caption}{' '}
                {captionHtml && <span dangerouslySetInnerHTML={{ __html: captionHtml }} />}
              </figcaption>
            )}
          </figure>
        )
      }
      default: {
        const _exhaustive: never = seg
        return null
      }
    }
  })
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
