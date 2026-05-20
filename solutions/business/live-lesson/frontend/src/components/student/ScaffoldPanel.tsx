import { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { renderMd } from './renderMd'
import { useT, type Locale } from '../../i18n'
import './scaffold-panel.css'

export interface ScaffoldHint {
  level: number
  hintZh: string
  hintImage?: string
  canRetry: boolean
}

interface Props {
  hints: ScaffoldHint[]
  enableMath?: boolean
  onSwitchToText?: () => void
  collapsed?: boolean
  onToggle?: () => void
  locale?: Locale
}

export default function ScaffoldPanel({ hints, enableMath, onSwitchToText, collapsed, onToggle, locale }: Props) {
  const t = useT(locale)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)

  // Auto-scroll to bottom when new hint added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [hints.length])

  const closeZoom = useCallback(() => setZoomedImg(null), [])

  // Esc: close zoom overlay first, otherwise collapse panel
  useEffect(() => {
    if (collapsed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (zoomedImg) { closeZoom(); return }
      onToggle?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [collapsed, zoomedImg, closeZoom, onToggle])

  // Lock body scroll while zoom overlay is open
  useEffect(() => {
    if (!zoomedImg) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [zoomedImg])

  if (collapsed) {
    return (
      <div className="stu-text-rail" onClick={onToggle}>
        <div className="stu-text-rail-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div className="stu-text-rail-label">{t('scaffold.rail')}</div>
        {hints.length > 0 && (
          <div className="stu-text-rail-badge">{hints.length}</div>
        )}
      </div>
    )
  }

  const lastHint = hints[hints.length - 1]
  const isSolution = lastHint && !lastHint.canRetry
  const badgeText = hints.length === 0
    ? t('scaffold.waiting')
    : isSolution ? t('scaffold.fullSolution') : t('scaffold.hintRange', { n: hints.length })

  return (
    <div className="stu-text-overlay scaffold-panel" data-translate-ctx="scaffold-panel">
      {/* Header */}
      <div className="scaffold-panel-hd">
        <div className="scaffold-panel-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <span className="scaffold-panel-title">{t('scaffold.title')}</span>
        <span className="scaffold-panel-badge">{badgeText}</span>
        {onSwitchToText && (
          <button
            className="scaffold-panel-close"
            onClick={onSwitchToText}
            title={t('scaffold.viewText')}
          >
            {t('scaffold.textLabel')}
          </button>
        )}
        <button className="scaffold-panel-close" onClick={onToggle} title={t('scaffold.collapse')}>×</button>
      </div>

      {/* Scroll area */}
      <div className="scaffold-panel-scroll" ref={scrollRef}>
        {hints.map((hint, i) => {
          const isLast = i === hints.length - 1
          const isSolutionCard = isLast && !hint.canRetry && hints.length > 1
          const cardCls = isSolutionCard
            ? 'scaffold-hint-card scaffold-hint-card--solution scaffold-hint-enter'
            : 'scaffold-hint-card scaffold-hint-enter'
          return (
            <div key={i} className={cardCls} style={{ animationDelay: `${i * 80}ms` }}>
              <div className="scaffold-hint-hd">
                <div className="scaffold-step-badge">{hint.level + 1}</div>
                <span className="scaffold-hint-title">
                  {isSolutionCard ? t('scaffold.fullSolution') : t('scaffold.stepN', { n: hint.level + 1 })}
                </span>
              </div>
              <div className="scaffold-hint-body">
                {renderMd(hint.hintZh, { math: enableMath })}
              </div>
              {hint.hintImage && (
                <img src={hint.hintImage} alt={t('scaffold.hintAlt', { n: hint.level + 1 })}
                  className="scaffold-hint-img"
                  onClick={() => hint.hintImage && setZoomedImg(hint.hintImage)} />
              )}
            </div>
          )
        })}
        {hints.length === 0 && (
          <div className="scaffold-empty">{t('scaffold.noHints')}</div>
        )}
      </div>
      {zoomedImg && createPortal(
        <div className="scaffold-zoom-overlay" role="dialog" aria-modal="true" aria-label={t('scaffold.zoomLabel')} onClick={closeZoom}>
          <img src={zoomedImg} className="scaffold-zoom-img" alt={t('scaffold.zoomAlt')}
            onClick={e => e.stopPropagation()} />
        </div>,
        document.body
      )}
    </div>
  )
}
