import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { renderMd } from './renderMd'
import { useT, type Locale } from '../../i18n'
import FormulaAnimation, { type FormulaAnimationProps } from './scaffold/FormulaAnimation'
import SolutionDisplay, { type SolutionDisplayProps } from './scaffold/SolutionDisplay'
import ProcedureSteps, { type ProcedureStepsProps } from './scaffold/ProcedureSteps'
import './scaffold-panel.css'
import './scaffold/scaffold-widgets.css'

export interface ScaffoldStep {
  title: string
  hintZh?: string
  widget?: string
  props?: Record<string, unknown>
}

export interface ScaffoldHint {
  level: number
  hintZh: string
  hintImage?: string
  canRetry: boolean
  steps?: ScaffoldStep[]
}

interface Props {
  hints: ScaffoldHint[]
  enableMath?: boolean
  onSwitchToText?: () => void
  collapsed?: boolean
  onToggle?: () => void
  locale?: Locale
}

/** Render a widget by type, with runtime prop validation */
export function WidgetRenderer({ widget, props, enableMath }: { widget: string; props?: Record<string, unknown>; enableMath?: boolean }) {
  const p = props ?? {}
  switch (widget) {
    case 'formula-animation': {
      if (typeof p.formula !== 'string' || !Array.isArray(p.pairs)) {
        return <div style={{ color: 'var(--t3)', fontSize: 12 }}>Invalid formula-animation props</div>
      }
      return (
        <FormulaAnimation
          formula={p.formula}
          pairs={p.pairs as FormulaAnimationProps['pairs']}
          substitution={typeof p.substitution === 'string' ? p.substitution : undefined}
        />
      )
    }
    case 'solution-display': {
      if (!Array.isArray(p.lines)) {
        return <div style={{ color: 'var(--t3)', fontSize: 12 }}>Invalid solution-display props</div>
      }
      return <SolutionDisplay lines={p.lines as SolutionDisplayProps['lines']} />
    }
    case 'procedure-steps': {
      if (!Array.isArray(p.steps) || p.steps.length === 0) {
        return <div style={{ color: 'var(--t3)', fontSize: 12 }}>Invalid procedure-steps props</div>
      }
      return <ProcedureSteps steps={p.steps as ProcedureStepsProps['steps']} enableMath={enableMath} />
    }
    default:
      return <div style={{ color: 'var(--t3)', fontSize: 12 }}>Unknown widget: {widget}</div>
  }
}

/** Flatten hints into renderable cards. Each hint produces 1+ cards.
 *  Exported for testing only. */
export interface CardEntry {
  stepNum: number
  title: string
  isSolution: boolean
  content: ScaffoldStep | null   // null = legacy card (render from hint directly)
  hint: ScaffoldHint
}

export function flattenCards(hints: ScaffoldHint[]): CardEntry[] {
  const cards: CardEntry[] = []
  let stepCounter = 0
  for (let i = 0; i < hints.length; i++) {
    const hint = hints[i]
    const isLastHint = i === hints.length - 1

    if (hint.steps && hint.steps.length > 0) {
      // Widget-aware: render each step as a separate card
      for (let s = 0; s < hint.steps.length; s++) {
        stepCounter++
        const isLastStep = isLastHint && !hint.canRetry && s === hint.steps.length - 1
        cards.push({
          stepNum: stepCounter,
          title: hint.steps[s].title,
          isSolution: isLastStep && hints.length > 1,
          content: hint.steps[s],
          hint,
        })
      }
    } else {
      // Legacy: one card per hint
      stepCounter++
      const isSolution = isLastHint && !hint.canRetry && hints.length > 1
      cards.push({
        stepNum: stepCounter,
        title: '',
        isSolution,
        content: null,
        hint,
      })
    }
  }
  return cards
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

  const cards = useMemo(() => flattenCards(hints), [hints])
  const lastHint = hints[hints.length - 1]
  const isSolution = lastHint && !lastHint.canRetry
  const totalSteps = cards.length
  const badgeText = hints.length === 0
    ? t('scaffold.waiting')
    : isSolution ? t('scaffold.fullSolution') : t('scaffold.hintRange', { n: totalSteps })

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
        {cards.map((card, idx) => {
          const cardCls = card.isSolution
            ? 'scaffold-hint-card scaffold-hint-card--solution scaffold-hint-enter'
            : 'scaffold-hint-card scaffold-hint-enter'

          // Widget step card
          if (card.content) {
            const step = card.content
            return (
              <div key={idx} className={cardCls} style={{ animationDelay: `${idx * 80}ms` }}>
                <div className="scaffold-hint-hd">
                  <div className="scaffold-step-badge">{card.stepNum}</div>
                  <span className="scaffold-hint-title">{card.title}</span>
                </div>
                <div className="scaffold-hint-body">
                  {step.widget
                    ? <WidgetRenderer widget={step.widget} props={step.props} enableMath={enableMath} />
                    : step.hintZh
                      ? renderMd(step.hintZh, { math: enableMath })
                      : null}
                </div>
              </div>
            )
          }

          // Legacy card (no steps)
          const { hint } = card
          return (
            <div key={idx} className={cardCls} style={{ animationDelay: `${idx * 80}ms` }}>
              <div className="scaffold-hint-hd">
                <div className="scaffold-step-badge">{card.stepNum}</div>
                <span className="scaffold-hint-title">
                  {card.isSolution ? t('scaffold.fullSolution') : t('scaffold.stepN', { n: card.stepNum })}
                </span>
              </div>
              <div className="scaffold-hint-body">
                {renderMd(hint.hintZh, { math: enableMath })}
              </div>
              {hint.hintImage && (
                <img src={hint.hintImage} alt={t('scaffold.hintAlt', { n: card.stepNum })}
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
