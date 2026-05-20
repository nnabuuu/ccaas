import { useState, useContext, useCallback, useRef } from 'react'
import { useT, LocaleScope, type Locale } from '../../../i18n'
import { SessionCtx } from '../TaskPanel'
import type { RichContentQuizPart } from '../task-data'
import type { ScaffoldHint } from '../ScaffoldPanel'
import { useReviewRestore } from '../../../hooks/useReviewRestore'
import type { ReviewData } from '../../../hooks/useReviewRestore'
import type { SubmitResult } from '../../../hooks/useClassroom'
import { cacheSubmission } from '../../../hooks/useClassroom'
import { reportAttempt } from './gradeItemSet'
import { RenderMath } from '../../../utils/render-math'
import { HandwritingCanvas } from '../image-capture/HandwritingCanvas'
import type { HandwritingCanvasHandle } from '../image-capture/HandwritingCanvas'
import { compressDataUri } from '../../../utils/compress-image'
import RcqGuide from './RcqGuide'
import { readGuideSeen, markGuideSeen } from './guide-helpers'
import { resolveAdvance } from './rcq-advance'
import './rcq.css'

type PartPhase = 'work' | 'wrong' | 'retry' | 'wrong2' | 'done'

interface Props {
  parts: RichContentQuizPart[]
  subType?: string
  prompt?: string
  promptImages?: Array<{ url: string; alt?: string }>
  maxImages?: number
  stepIdx?: number
  taskId?: number
  onScaffoldPush?: (hint: ScaffoldHint) => void
  onDone: () => void
  reviewData?: ReviewData
  locale?: Locale
}

export function parseRcqReview(review: ReviewData, parts: RichContentQuizPart[]) {
  const serverParts = (review.data.parts ?? {}) as Record<string, Record<string, unknown>>
  const phases: Record<string, PartPhase> = {}
  const outcomes: Record<string, 'correct' | 'passed'> = {}
  const images: Record<string, string[]> = {}
  const solutions: Record<string, string> = {}

  for (const part of parts) {
    const sp = serverParts[part.id]
    if (!sp?.completed) continue
    phases[part.id] = 'done'
    const history = (sp.attemptsHistory ?? []) as Array<Record<string, unknown>>
    const lastAttempt = history[history.length - 1]
    outcomes[part.id] = lastAttempt?.method === 'pass' ? 'passed' : 'correct'
    if (sp.sampleSolution) solutions[part.id] = sp.sampleSolution as string
    const partImgs = (sp.images ?? []) as string[]
    if (partImgs.length > 0) {
      images[part.id] = partImgs
    } else {
      for (let i = history.length - 1; i >= 0; i--) {
        const hImgs = (history[i].images ?? []) as string[]
        if (hImgs.length > 0) { images[part.id] = hImgs; break }
      }
    }
  }
  const allDone = parts.length > 0 && parts.every(p => phases[p.id] === 'done')
  return { state: { phases, outcomes, images, solutions }, allDone }
}

export function RichContentQuizExercise({
  parts, subType, prompt, promptImages, maxImages = 1,
  stepIdx, taskId, onScaffoldPush, onDone, reviewData, locale,
}: Props) {
  const t = useT(locale)
  const ctx = useContext(SessionCtx)
  const canvasRef = useRef<HandwritingCanvasHandle>(null)
  const busyRef = useRef(false)

  const restored = useReviewRestore(
    reviewData,
    (r) => parseRcqReview(r, parts),
    onDone,
  )

  const [currentPartIdx, setCurrentPartIdx] = useState(() => {
    if (!restored) return 0
    const firstIncomplete = parts.findIndex(p => restored.phases[p.id] !== 'done')
    return firstIncomplete >= 0 ? firstIncomplete : 0
  })
  const [partSolutions, setPartSolutions] = useState<Record<string, string>>(() => restored?.solutions ?? {})
  const [partImages, setPartImages] = useState<Record<string, string[]>>(() => restored?.images ?? {})
  const [partPhase, setPartPhase] = useState<Record<string, PartPhase>>(() => restored?.phases ?? {})
  const [submitting, setSubmitting] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [lastFeedback, setLastFeedback] = useState('')
  const [partOutcome, setPartOutcome] = useState<Record<string, 'correct' | 'passed'>>(() => restored?.outcomes ?? {})
  const [guideOpen, setGuideOpen] = useState(false)
  const guideSeen = useRef(readGuideSeen('guide-seen-rcq'))

  const currentPart = parts[currentPartIdx]
  const currentPartId = currentPart?.id
  const images = currentPartId ? (partImages[currentPartId] || []) : []
  const phase: PartPhase = currentPartId ? (partPhase[currentPartId] || 'work') : 'work'
  const allPartsDone = parts.length > 0 && parts.every(p => partPhase[p.id] === 'done')

  const handlePagesChange = useCallback((dataUris: string[]) => {
    if (!currentPartId) return
    setPartImages(prev => ({ ...prev, [currentPartId]: dataUris }))
  }, [currentPartId])

  const handleContentStatusChange = useCallback((has: boolean) => {
    setHasContent(has)
  }, [])

  const advanceToNext = (updatedPhases: Record<string, PartPhase>, result: SubmitResult) => {
    const action = resolveAdvance(
      parts.map(p => p.id),
      updatedPhases,
      result.nextPartId,
    )
    if (action.type === 'advance') {
      setCurrentPartIdx(action.idx)
      setHasContent(false)
    } else if (action.type === 'done') {
      onDone()
    }
  }

  const handleSubmit = async () => {
    if (!currentPartId || busyRef.current) return
    if (stepIdx === undefined || !ctx.submit) return

    const rawImages = canvasRef.current?.exportPages() || images
    if (rawImages.length === 0) return

    busyRef.current = true
    setSubmitting(true)
    try {
      const compressed = await Promise.all(rawImages.map(uri => compressDataUri(uri)))
      const submitData = {
        images: compressed,
        partId: currentPartId,
        method: subType || 'rich-content-quiz',
      }
      const result: SubmitResult = await ctx.submit(stepIdx, submitData)

      if (ctx.sessionCode) {
        cacheSubmission(ctx.sessionCode, stepIdx, submitData, result.score ?? null)
      }

      reportAttempt(taskId ?? 0, 0, 1, submitData, null, result.ok !== false)

      if (!result.ok) return

      if (result.scaffold) {
        onScaffoldPush?.(result.scaffold)
        const feedback = (result.score as Record<string, unknown>)?.llmFeedback as string | undefined
        setLastFeedback(feedback || t('rcq.defaultFeedback'))
        if (result.scaffold.canRetry) {
          setPartPhase(prev => ({ ...prev, [currentPartId]: 'wrong' }))
        } else {
          setPartPhase(prev => ({ ...prev, [currentPartId]: 'wrong2' }))
        }
      } else {
        const updated = { ...partPhase, [currentPartId]: 'done' as const }
        setPartPhase(updated)
        setPartOutcome(prev => ({ ...prev, [currentPartId]: 'correct' }))
        if (result.sampleSolution) {
          setPartSolutions(prev => ({ ...prev, [currentPartId]: result.sampleSolution! }))
        }
        advanceToNext(updated, result)
      }
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    if (!currentPartId) return
    setPartPhase(prev => ({ ...prev, [currentPartId]: 'retry' }))
    setPartImages(prev => ({ ...prev, [currentPartId]: [] }))
    setPartOutcome(prev => { const next = { ...prev }; delete next[currentPartId]; return next })
    setHasContent(false)
  }

  const handlePass = async () => {
    if (!currentPartId || busyRef.current) return
    if (stepIdx === undefined || !ctx.submit) return

    busyRef.current = true
    setSubmitting(true)
    try {
      const submitData = { partId: currentPartId, _pass: true, images: [], method: 'pass' }
      const result: SubmitResult = await ctx.submit(stepIdx, submitData)

      if (!result.ok) return

      const updated = { ...partPhase, [currentPartId]: 'done' as const }
      setPartPhase(updated)
      setPartOutcome(prev => ({ ...prev, [currentPartId]: 'passed' }))
      if (result.sampleSolution) {
        setPartSolutions(prev => ({ ...prev, [currentPartId]: result.sampleSolution! }))
      }
      advanceToNext(updated, result)
    } finally {
      busyRef.current = false
      setSubmitting(false)
    }
  }

  if (parts.length === 0) {
    return <LocaleScope locale={locale}><div style={{ fontSize: 13, color: 'var(--t3)' }}>{t('rcq.noParts')}</div></LocaleScope>
  }

  if (allPartsDone) {
    return (
      <LocaleScope locale={locale}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {prompt && (
          <div style={{ fontSize: 14, lineHeight: 1.6 }}><RenderMath text={prompt} /></div>
        )}
        {promptImages && promptImages.length > 0 && (
          <div className="rcq-prompt-images">
            {promptImages.map((img, i) => (
              <img key={i} src={img.url} alt={img.alt || ''} />
            ))}
          </div>
        )}
        {parts.map((part, i) => {
          const outcome = partOutcome[part.id] || 'passed'
          const imgs = partImages[part.id] || []
          const badgeCls = outcome === 'correct'
            ? 'rcq-review-badge rcq-review-badge--correct'
            : 'rcq-review-badge rcq-review-badge--passed'
          const badgeLabel = outcome === 'correct' ? t('rcq.correct') : t('rcq.passed')
          return (
            <div key={part.id} className="rcq-review-card">
              <div className="rcq-review-header">
                <span className="rcq-review-num">{t('rcq.partNum', { n: i + 1 })}</span>
                <span className={badgeCls}>{badgeLabel}</span>
              </div>
              {part.prompt && (
                <div className="rcq-problem-text"><RenderMath text={part.prompt} /></div>
              )}
              {part.expression && (
                <div className="rcq-problem-expr"><RenderMath text={part.expression} /></div>
              )}
              {partSolutions[part.id] && (
                <div className="rcq-solution">
                  <div className="rcq-solution-label">{t('rcq.solutionLabel')}</div>
                  <div className="rcq-solution-body"><RenderMath text={partSolutions[part.id]} /></div>
                </div>
              )}
              {imgs.length > 0 && (
                <div className="rcq-review-images">
                  {imgs.map((src, j) => <img key={j} src={src} alt={t('rcq.submittedAlt', { n: i + 1 })} />)}
                </div>
              )}
            </div>
          )
        })}
        <div className="rcq-passed-card">{t('rcq.allDone')}</div>
      </div>
      </LocaleScope>
    )
  }

  const showCanvas = phase === 'work' || phase === 'retry'
  const badgeClass = phase === 'retry' ? 'rcq-badge--retry'
    : phase === 'done' ? 'rcq-badge--done' : ''
  const badgeText = phase === 'retry' ? t('rcq.retry')
    : phase === 'done' ? t('rcq.done') : t('rcq.independent')

  return (
    <LocaleScope locale={locale}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1 }} />
        <button
          className={`se-guide-btn${!guideSeen.current && !guideOpen ? ' pulse' : ''}`}
          aria-label={t('rcq.guideLabel')}
          onClick={() => {
            setGuideOpen(true)
            markGuideSeen('guide-seen-rcq')
            guideSeen.current = true
          }}
        >?</button>
      </div>
      <RcqGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Top-level prompt */}
      {prompt && (
        <div style={{ fontSize: 14, lineHeight: 1.6 }}><RenderMath text={prompt} /></div>
      )}
      {promptImages && promptImages.length > 0 && (
        <div className="rcq-prompt-images">
          {promptImages.map((img, i) => (
            <img key={i} src={img.url} alt={img.alt || ''} />
          ))}
        </div>
      )}

      {/* Part indicator dots */}
      {parts.length > 1 && (
        <div className="rcq-part-dots">
          {parts.map((p, i) => {
            const st = partPhase[p.id] || 'work'
            const isCurrent = i === currentPartIdx
            const cls = st === 'done' ? 'rcq-part-dot rcq-part-dot--done'
              : isCurrent ? 'rcq-part-dot rcq-part-dot--current'
              : 'rcq-part-dot'
            return (
              <div key={p.id} className={cls}>
                {st === 'done' ? '✓' : i + 1}
              </div>
            )
          })}
          <span className="rcq-part-dots-label">
            {t('rcq.partLabel', { n: currentPartIdx + 1, m: parts.length })}
          </span>
        </div>
      )}

      {/* Current part — problem card */}
      {currentPart?.prompt && (
        <div className="rcq-problem-card">
          <div className="rcq-problem-header">
            <span className="rcq-problem-num">{t('rcq.partNum', { n: currentPartIdx + 1 })}</span>
            <span className={`rcq-problem-badge ${badgeClass}`}>{badgeText}</span>
          </div>
          <div className="rcq-problem-text">
            <RenderMath text={currentPart.prompt} />
          </div>
          {currentPart.expression && (
            <div className="rcq-problem-expr">
              <RenderMath text={currentPart.expression} />
            </div>
          )}
        </div>
      )}

      {/* Checking status card */}
      {submitting && (
        <div className="rcq-checking-card">
          <div className="rcq-checking-dot" />
          {t('rcq.aiChecking')}
        </div>
      )}

      {/* Wrong result card (red) — canRetry, first scaffold */}
      {phase === 'wrong' && !submitting && (
        <div className="rcq-result-card rcq-result-wrong">
          <div className="rcq-result-icon">✗</div>
          <div>
            <div className="rcq-result-title">{t('rcq.wrongTitle')}</div>
            <div className="rcq-result-desc">{lastFeedback}</div>
            <div className="rcq-result-hint">{t('rcq.wrongHint')}</div>
          </div>
        </div>
      )}

      {/* Wrong2 result card (amber) — last scaffold, show pass */}
      {phase === 'wrong2' && !submitting && (
        <div className="rcq-result-card rcq-result-final">
          <div className="rcq-result-icon">→</div>
          <div>
            <div className="rcq-result-title">{t('rcq.finalTitle')}</div>
            <div className="rcq-result-desc">
              {t('rcq.finalDesc')}
            </div>
          </div>
        </div>
      )}

      {/* Handwriting canvas + photo unified input */}
      {showCanvas && !submitting && (
        <HandwritingCanvas
          key={currentPartId}
          ref={canvasRef}
          maxPages={Math.max(maxImages, 5)}
          onPagesChange={handlePagesChange}
          onContentStatusChange={handleContentStatusChange}
        />
      )}

      {/* Retry button */}
      {phase === 'wrong' && !submitting && (
        <button className="rcq-retry-btn" onClick={handleRetry}>
          {t('rcq.retryBtn')}
        </button>
      )}

      {/* Pass button */}
      {phase === 'wrong2' && !submitting && (
        <button className="rcq-next-btn" onClick={handlePass}>
          {t('rcq.passBtn')}
        </button>
      )}

      {/* Submit button */}
      {hasContent && showCanvas && !submitting && (
        <button className="rcq-submit-btn" onClick={handleSubmit}>
          {phase === 'retry' ? t('rcq.resubmit') : t('rcq.submit')}
        </button>
      )}
    </div>
    </LocaleScope>
  )
}
