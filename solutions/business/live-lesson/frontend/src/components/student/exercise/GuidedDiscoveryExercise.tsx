import { useState, useCallback, useRef, useEffect, Fragment } from 'react'
import type { GdStep, GdObservationStep, GdChoiceItem, GdFormulaBlanksStep, GdDerivationBlankStep, GdTextBlanksStep } from '../task-data'
import { RenderMath } from '../../../utils/render-math'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'
import { useT, LocaleScope, type Locale, type TFn } from '../../../i18n'
import { HandwritingCanvas } from '../image-capture/HandwritingCanvas'
import { evaluateChoice, applyChoiceSelection, type ChoiceStatus } from './gd-choice-helpers'
import type { GdProgress } from './gd-types'
import '../image-capture/handwriting.css'

interface Props {
  steps: GdStep[]
  title?: string
  summary?: { formula?: string; name?: string; description?: string }
  ans: Record<string, any>
  setAns: (updater: (prev: Record<string, any>) => Record<string, any>) => void
  stepResults?: Record<string, boolean>
  stepFeedbacks?: Record<string, string>
  allDone: boolean
  reviewData?: ReviewData
  locale?: Locale
  /** Progressive reveal: index of the furthest visible step */
  currentStepIdx?: number
  /** Set of completed step IDs */
  completedSteps?: Set<string>
  /** Called when observation_choice step is completed client-side */
  onStepComplete?: (stepId: string) => void
  /** Called when a non-observation step needs server check */
  onStepSubmit?: (stepId: string) => void
  /** Called to advance to the next step */
  onAdvance?: () => void
  /** Whether a server check is in progress */
  submitting?: boolean
}

function updateStepAnswer(setAns: Props['setAns'], stepId: string, fieldId: string, value: any) {
  setAns(prev => ({
    ...prev,
    steps: {
      ...prev.steps,
      [stepId]: {
        ...prev.steps?.[stepId],
        answers: { ...prev.steps?.[stepId]?.answers, [fieldId]: value },
      },
    },
  }))
}

/* SVG icons for feedback bar + confirm button */
const CheckSvg = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
)
const XSvg = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
)

type InputMethod = 'keyboard' | 'handwrite' | 'photo'

/* SVG icons for input method toggle — matches HandwritingCanvas style */
const MethodIcons: Record<InputMethod, JSX.Element> = {
  keyboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>,
  handwrite: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  photo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
}

/* Chevron-up SVG for collapse button */
const ChevronUpSvg = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
)

const MAX_PHOTO_BYTES = 5 * 1024 * 1024

function GdInputField({ inputMethods, value, onChange, disabled, placeholder, label, locale }: {
  inputMethods?: string[]; value: string; onChange: (val: string) => void; disabled: boolean; placeholder?: string; label?: string; locale?: Locale
}) {
  const t = useT(locale)
  const methods = (inputMethods && inputMethods.length > 0) ? inputMethods as InputMethod[] : ['keyboard'] as InputMethod[]
  const [expanded, setExpanded] = useState(false)
  const [activeMethod, setActiveMethod] = useState<InputMethod>(methods[0])
  const [localText, setLocalText] = useState(value || '')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const fileRef = useRef<HTMLInputElement>(null)

  // Sync localText when value prop changes externally
  useEffect(() => { setLocalText(value || '') }, [value])

  const handlePagesChange = useCallback((dataUris: string[]) => {
    if (dataUris.length > 0) onChangeRef.current(dataUris[0])
  }, [])

  const handlePhoto = useCallback((files: FileList) => {
    const f = Array.from(files).find(file => file.type.startsWith('image/'))
    if (!f || f.size > MAX_PHOTO_BYTES) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      onChangeRef.current(result)
    }
    reader.readAsDataURL(f)
  }, [])

  const confirmInput = useCallback(() => {
    if (activeMethod === 'keyboard') {
      onChangeRef.current(localText)
    }
    // handwrite/photo already push data via their own handlers; confirm just collapses
    setExpanded(false)
  }, [activeMethod, localText])

  const isImage = value?.startsWith('data:image/')
  const hasContent = activeMethod === 'keyboard' ? localText.trim().length > 0 : isImage

  const handleCollapse = useCallback(() => {
    if (activeMethod === 'keyboard') onChangeRef.current(localText)
    setExpanded(false)
  }, [activeMethod, localText])

  // Collapsed preview
  const renderPreview = () => {
    if (isImage) {
      return <img src={value} alt="" style={{ maxHeight: 36, maxWidth: 140, borderRadius: 4, display: 'block', objectFit: 'contain' }} />
    }
    if (value && !isImage) {
      return <span className="math-input-text-preview">{value}</span>
    }
    return <span className="math-input-ph">{label || placeholder || t('gd.tapToAnswer')}</span>
  }

  const contentCls = (value && value.trim()) ? ' has-content' : ' empty'

  if (disabled) {
    return (
      <span className={'math-input-collapsed' + contentCls} style={{ cursor: 'default' }}>
        {renderPreview()}
      </span>
    )
  }

  const methodLabel: Record<InputMethod, string> = {
    keyboard: t('gd.keyboard'),
    handwrite: t('canvas.handwrite'),
    photo: t('canvas.photoUpload'),
  }

  const showTabs = methods.length > 1

  return (
    <span className="math-input-root">
      <span
        className={'math-input-collapsed' + (expanded ? ' active' : '') + contentCls}
        onClick={() => expanded ? handleCollapse() : setExpanded(true)}
      >
        {renderPreview()}
        {(value && value.trim()) && !expanded && <span className="math-input-edit-hint">{t('gd.tapToEdit')}</span>}
      </span>

      {expanded && (
        <div className="math-input-panel">
          {/* Tab bar */}
          <div className="math-input-tabs">
            {showTabs && methods.map(m => (
              <button
                key={m}
                type="button"
                className={'math-input-tab' + (activeMethod === m ? ' active' : '')}
                onClick={() => {
                  if (activeMethod === 'keyboard') onChangeRef.current(localText)
                  setActiveMethod(m)
                }}
              >
                {MethodIcons[m]} {methodLabel[m]}
              </button>
            ))}
            {!showTabs && <span className="math-input-tab active">{MethodIcons[activeMethod]} {methodLabel[activeMethod]}</span>}
            <button type="button" className="math-input-close" onClick={handleCollapse}>
              <ChevronUpSvg /> {t('gd.collapse')}
            </button>
          </div>

          {activeMethod === 'keyboard' && (
            <div className="math-input-kb">
              <input
                className="math-input-field"
                value={localText}
                onChange={e => setLocalText(e.target.value)}
                placeholder={placeholder || '___'}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && localText.trim()) confirmInput() }}
              />
              <div className="math-input-kb-hint">{t('gd.kbHint')}</div>
            </div>
          )}

          {activeMethod === 'handwrite' && (
            <HandwritingCanvas maxPages={1} onPagesChange={handlePagesChange} disabled={disabled} locale={locale} />
          )}

          {activeMethod === 'photo' && (
            <div className="math-input-photo">
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files) handlePhoto(e.target.files); e.target.value = '' }} />
              {isImage ? (
                <div className="math-input-photo-preview">
                  <img src={value} alt="" />
                  <button type="button" className="math-input-photo-change" onClick={() => fileRef.current?.click()}>
                    {MethodIcons.photo} {t('gd.photoReselect')}
                  </button>
                </div>
              ) : (
                <div className="math-input-photo-drop" onClick={() => fileRef.current?.click()}>
                  {MethodIcons.photo}
                  <span>{t('gd.photoDropHint')}</span>
                </div>
              )}
            </div>
          )}

          {/* Confirm button */}
          {hasContent && (
            <div className="math-input-confirm-row">
              <button type="button" className="math-input-confirm" onClick={confirmInput}>
                <CheckSvg /> {t('gd.confirmInput')}
              </button>
            </div>
          )}
        </div>
      )}
    </span>
  )
}

// ── ObservationChoiceStep with instant client-side feedback ──

/** Render choice option buttons for a single choice item */
function ChoiceButtons({ choice, answers, disabled, status, onChoiceSelect }: {
  choice: GdChoiceItem; answers: Record<string, any>; disabled: boolean
  status: ChoiceStatus; onChoiceSelect: (choiceId: string, optionIdx: number) => void
}) {
  const isLocked = status === 'correct'
  const hasAnswered = answers[choice.id] !== undefined
  return (
    <>
      {choice.options.map((opt, oi) => {
        const selected = answers[choice.id] === oi
        let border = '1.5px solid var(--teal)'
        let bg = 'var(--surface)'
        let color = 'var(--teal)'
        const fontWeight: number = 600
        let opacity = 1
        let anim: string | undefined = (!hasAnswered && !disabled) ? 'btnBreathe 2s ease-in-out infinite' : undefined
        let clickable = !disabled && !isLocked

        if (selected && status === 'correct') {
          border = '1.5px solid var(--green)'; bg = 'var(--green-bg)'; color = 'var(--green)'
          anim = undefined; clickable = false
        } else if (selected && status === 'wrong') {
          border = '1.5px solid var(--red)'; bg = 'var(--red-bg)'; color = 'var(--red)'
          opacity = 0.5; anim = undefined; clickable = false
        } else if (isLocked) {
          anim = undefined; clickable = false
        }

        return (
          <button
            key={oi}
            onClick={() => { if (clickable) onChoiceSelect(choice.id, oi) }}
            disabled={!clickable}
            style={{
              padding: '4px 14px', borderRadius: 6, fontSize: 13,
              cursor: clickable ? 'pointer' : 'default',
              border, background: bg, fontWeight, color, opacity,
              animation: anim,
              transition: anim ? 'opacity .2s, color .2s' : 'all .2s',
            }}
          >
            <RenderMath text={opt} />
          </button>
        )
      })}
    </>
  )
}

function ObservationChoiceStep({ step, answers, disabled, choiceStatuses, onChoiceSelect, conclusion, onAdvance, isLast, t }: {
  step: GdObservationStep
  answers: Record<string, any>
  disabled: boolean
  choiceStatuses: Record<string, ChoiceStatus>
  onChoiceSelect: (choiceId: string, optionIdx: number) => void
  conclusion?: string
  onAdvance?: () => void
  isLast?: boolean
  t: TFn
}) {

  // Build lookup and detect inline-embedded choices ({{choiceId}} in other prompts)
  const choiceMap = new Map(step.choices.map(c => [c.id, c]))
  const inlineIds = new Set<string>()
  for (const c of step.choices) {
    if (c.prompt) {
      for (const m of c.prompt.matchAll(/\{\{(\w+)\}\}/g)) {
        if (m[1] !== c.id) inlineIds.add(m[1])
      }
    }
  }

  // Render a prompt that may contain {{choiceId}} placeholders
  function renderTemplatePrompt(prompt: string, selfChoice: GdChoiceItem) {
    const parts = prompt.split(/(\{\{\w+\}\})/)
    return parts.map((part, i) => {
      const m = part.match(/^\{\{(\w+)\}\}$/)
      if (m) {
        const refId = m[1]
        const refChoice = refId === selfChoice.id ? selfChoice : choiceMap.get(refId)
        if (refChoice) {
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle', margin: '0 2px' }}>
              <ChoiceButtons choice={refChoice} answers={answers} disabled={disabled} status={choiceStatuses[refChoice.id]} onChoiceSelect={onChoiceSelect} />
            </span>
          )
        }
      }
      return <RenderMath key={i} text={part} />
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {step.table && (
        <table style={{ borderCollapse: 'collapse', fontSize: 14, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid var(--border)', padding: '6px 12px', background: 'var(--surface)', textAlign: 'left' }}>{t('gd.expression')}</th>
              <th style={{ border: '1px solid var(--border)', padding: '6px 12px', background: 'var(--surface)', textAlign: 'left' }}>{t('gd.result')}</th>
            </tr>
          </thead>
          <tbody>
            {step.table.map((row, i) => (
              <tr key={i}>
                <td style={{ border: '1px solid var(--border)', padding: '6px 12px' }}><RenderMath text={row.expression} /></td>
                <td style={{ border: '1px solid var(--border)', padding: '6px 12px' }}><RenderMath text={row.result} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {step.choices.filter(c => !inlineIds.has(c.id)).map(choice => {
        const status = choiceStatuses[choice.id]
        const hasAnswered = answers[choice.id] !== undefined
        const isCorrect = status === 'correct'
        const hasTemplate = choice.prompt?.includes('{{')

        if (hasTemplate) {
          // Inline template: render sentence with embedded choice buttons
          return (
            <div key={choice.id} style={{ fontSize: 14, lineHeight: 2.4 }}>
              {renderTemplatePrompt(choice.prompt!, choice)}
            </div>
          )
        }

        // Regular block: prompt above, buttons below
        return (
          <div key={choice.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {choice.prompt && <div style={{ fontSize: 14 }}><RenderMath text={choice.prompt} /></div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <ChoiceButtons choice={choice} answers={answers} disabled={disabled} status={status} onChoiceSelect={onChoiceSelect} />
              {!hasAnswered && !disabled && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: 'var(--teal-bg)', color: 'var(--teal)', fontWeight: 600,
                }}>{t('gd.pickOne')}</span>
              )}
              {hasAnswered && !isCorrect && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: 'var(--amber-bg, #fef3c7)', color: 'var(--amber, #92400e)', fontWeight: 600,
                }}>{t('gd.retryPick')}</span>
              )}
            </div>
          </div>
        )
      })}

      {/* Local allCorrect — no dependency on external completedSteps */}
      {step.choices.length > 0 && step.choices.every(c => choiceStatuses[c.id] === 'correct') && (
        <>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            marginTop: 12, padding: '12px 14px', borderRadius: 10,
            background: 'var(--green-bg)',
            border: '1px solid rgba(45,102,18,.12)',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0,
              background: 'var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckSvg />
            </span>
            <span style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
              {(() => {
                if (!conclusion) return <strong style={{ color: 'var(--green)' }}>{t('gd.stepCorrect')}</strong>
                const idx = conclusion.search(/[！!]/)
                if (idx === -1) return <strong style={{ color: 'var(--green)' }}>{conclusion}</strong>
                const bold = conclusion.slice(0, idx + 1)
                const rest = conclusion.slice(idx + 1).replace(/^\s*/, '')
                return (<><strong style={{ color: 'var(--green)' }}>{bold}</strong>{rest && ` ${rest}`}</>)
              })()}
            </span>
          </div>
          {onAdvance && (
            <button onClick={onAdvance} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              width: '100%', padding: 12, borderRadius: 8, border: 'none',
              background: 'var(--teal)', color: '#fff',
              fontSize: 13, fontWeight: 600, marginTop: 8, cursor: 'pointer',
            }}>
              {isLast ? t('gd.viewSummary') : t('gd.continueNext')}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function FormulaBlanksStep({ step, answers, onChange, disabled, locale }: {
  step: GdFormulaBlanksStep; answers: Record<string, any>; onChange: (id: string, val: string) => void; disabled: boolean; locale?: Locale
}) {
  const isInline = step.layout === 'inline'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {step.prompt && (
        <div style={{ fontSize: 14, color: 'var(--t2)', textAlign: isInline ? 'center' : undefined }}>
          <RenderMath text={step.prompt} />
        </div>
      )}
      {isInline ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap', padding: '16px 0' }}>
          {step.blanks.map((blank, i) => (
            <Fragment key={blank.id}>
              {i > 0 && step.separator && (
                <span style={{ fontSize: 24, color: 'var(--t3)' }}>{step.separator}</span>
              )}
              <GdInputField
                label={blank.label}
                placeholder={blank.placeholder}
                inputMethods={blank.inputMethods || step.inputMethods}
                value={answers[blank.id] || ''}
                onChange={val => onChange(blank.id, val)}
                disabled={disabled}
                locale={locale}
              />
            </Fragment>
          ))}
        </div>
      ) : (
        step.blanks.map(blank => (
          <div key={blank.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ fontSize: 14, lineHeight: '32px' }}><RenderMath text={blank.label} /></span>
            <GdInputField
              inputMethods={blank.inputMethods || step.inputMethods}
              value={answers[blank.id] || ''}
              onChange={val => onChange(blank.id, val)}
              disabled={disabled}
              placeholder={blank.placeholder}
              locale={locale}
            />
          </div>
        ))
      )}
    </div>
  )
}

function DerivationBlankStep({ step, answers, onChange, disabled, locale }: {
  step: GdDerivationBlankStep; answers: Record<string, any>; onChange: (id: string, val: string) => void; disabled: boolean; locale?: Locale
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {step.lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 14, lineHeight: 2 }}>
          <RenderMath text={line.text} />
          {line.blank && (
            <GdInputField
              inputMethods={line.blank.inputMethods || step.inputMethods}
              value={answers[line.blank.id] || ''}
              onChange={val => onChange(line.blank!.id, val)}
              disabled={disabled}
              placeholder={line.blank.placeholder}
              locale={locale}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function TextBlanksStep({ step, answers, onChange, disabled, locale }: {
  step: GdTextBlanksStep; answers: Record<string, any>; onChange: (id: string, val: string) => void; disabled: boolean; locale?: Locale
}) {
  const blankMethods = step.textBlanks?.reduce<Record<string, string[]>>((acc, b) => {
    if (b.inputMethods) acc[b.id] = b.inputMethods
    return acc
  }, {}) || {}
  const hasNonKeyboard = Object.values(blankMethods).some(m => m.length > 1) || (step.inputMethods && step.inputMethods.length > 1)

  const parts = step.template.split(/(\{\{[^}]+\}\})/)
  return (
    <div style={{ fontSize: 14, lineHeight: 2.2 }}>
      {parts.map((part, i) => {
        const match = part.match(/^\{\{([^}]+)\}\}$/)
        if (match) {
          const blankId = match[1]
          const value = answers[blankId] || ''
          const methods = blankMethods[blankId] || step.inputMethods

          if (hasNonKeyboard && methods && methods.length > 1) {
            return (
              <span key={i} style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 4px' }}>
                <GdInputField
                  inputMethods={methods}
                  value={value}
                  onChange={val => onChange(blankId, val)}
                  disabled={disabled}
                  locale={locale}
                />
              </span>
            )
          }
          return (
            <input
              key={i}
              type="text"
              value={value}
              onChange={e => onChange(blankId, e.target.value)}
              disabled={disabled}
              placeholder="___"
              style={{
                display: 'inline-block', width: Math.max(60, value.length * 16 + 24),
                padding: '2px 8px', margin: '0 4px', border: '2px solid var(--border)', borderRadius: 6,
                fontSize: 14, textAlign: 'center', outline: 'none', background: 'transparent',
                verticalAlign: 'middle',
              }}
            />
          )
        }
        return <RenderMath key={i} text={part} />
      })}
    </div>
  )
}

interface GdReviewState {
  ans: { steps: Record<string, { answers: Record<string, unknown> }> }
  stepResults: Record<string, boolean>
  gdProgress?: GdProgress
}

export function parseGdReview(review: ReviewData) {
  const { data, checkItems } = review
  const stepResults: Record<string, boolean> = {}
  checkItems?.forEach(it => { stepResults[it.idx as string] = it.correct })
  const progress = (data as Record<string, unknown>)._gdProgress as GdReviewState['gdProgress'] | undefined
  return {
    state: {
      ans: { steps: (data as Record<string, any>).steps || {} } as GdReviewState['ans'],
      stepResults,
      gdProgress: progress,
    },
    allDone: !progress,
  }
}

// ── Step feedback + transition bar ──

function StepFeedbackBar({ isCompleted, isCorrect, isLast, onAdvance, conclusion, feedback, t }: {
  isCompleted: boolean; isCorrect: boolean; isLast: boolean
  onAdvance?: () => void; conclusion?: string; feedback?: string; t: TFn
}) {
  if (!isCompleted) return null
  return (
    <>
      {/* AI feedback card */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        marginTop: 12, padding: '12px 14px', borderRadius: 10,
        background: isCorrect ? 'var(--green-bg)' : 'var(--red-bg)',
        border: `1px solid ${isCorrect ? 'rgba(45,102,18,.12)' : 'rgba(148,41,41,.12)'}`,
      }}>
        {/* Icon box */}
        <span style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: isCorrect ? 'var(--green)' : 'var(--red)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isCorrect ? <CheckSvg /> : <XSvg />}
        </span>
        {/* Body */}
        <span style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
          <strong style={{ color: isCorrect ? 'var(--green)' : 'var(--red)' }}>
            {isCorrect ? t('gd.stepCorrect') : t('gd.stepWrong')}
          </strong>
          {isCorrect && conclusion && ` ${conclusion}`}
          {!isCorrect && feedback && <><br />{feedback}</>}
        </span>
      </div>
      {/* Full-width teal "继续" button — outside feedback card */}
      {isCorrect && onAdvance && (
        <button onClick={onAdvance} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%', padding: 12, borderRadius: 8, border: 'none',
          background: 'var(--teal)', color: '#fff',
          fontSize: 13, fontWeight: 600, marginTop: 8, cursor: 'pointer',
        }}>
          {isLast ? t('gd.viewSummary') : t('gd.continueNext')}
        </button>
      )}
    </>
  )
}

export function GuidedDiscoveryExercise({
  steps, title, summary, ans, setAns, stepResults, stepFeedbacks, allDone, reviewData, locale,
  currentStepIdx, completedSteps, onStepComplete, onStepSubmit, onAdvance, submitting,
}: Props) {
  const t = useT(locale)
  const restored = useReviewRestore(reviewData, parseGdReview)
  const effectiveAns = restored?.ans ?? ans
  const effectiveStepResults = restored?.stepResults ?? stepResults
  const effectiveAllDone = restored ? true : allDone
  const isReview = !!restored

  // In review mode or legacy mode (no currentStepIdx), show all steps
  const isProgressive = currentStepIdx !== undefined && !isReview
  const visibleCount = isProgressive ? currentStepIdx + 1 : steps.length

  const stepsData = effectiveAns.steps || {}

  // Per-choice feedback status for observation_choice steps (client-side)
  const [choiceStatuses, setChoiceStatuses] = useState<Record<string, Record<string, ChoiceStatus>>>({})

  // Auto-derive choiceStatuses for pre-completed observation_choice steps (restore from cache)
  useEffect(() => {
    if (!completedSteps || completedSteps.size === 0) return
    setChoiceStatuses(prev => {
      let next = prev
      for (const step of steps) {
        if (step.type !== 'observation_choice' || !completedSteps.has(step.id)) continue
        if (next[step.id]) continue
        const answers = stepsData[step.id]?.answers || {}
        const statuses: Record<string, ChoiceStatus> = {}
        for (const choice of step.choices) {
          if (answers[choice.id] !== undefined) {
            statuses[choice.id] = evaluateChoice(choice.correct, answers[choice.id])
          }
        }
        if (Object.keys(statuses).length > 0) {
          if (next === prev) next = { ...prev }
          next[step.id] = statuses
        }
      }
      return next
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- mount-only restore

  // Track which step cards are "new" for entrance animation
  const prevVisibleRef = useRef(0)
  const [animatingIdx, setAnimatingIdx] = useState<number | null>(null)
  useEffect(() => {
    if (visibleCount > prevVisibleRef.current && prevVisibleRef.current > 0) {
      setAnimatingIdx(visibleCount - 1)
      const timer = setTimeout(() => setAnimatingIdx(null), 400)
      prevVisibleRef.current = visibleCount
      return () => clearTimeout(timer)
    }
    prevVisibleRef.current = visibleCount
  }, [visibleCount])

  const handleChoiceSelect = useCallback((stepId: string, step: GdObservationStep, choiceId: string, optionIdx: number) => {
    updateStepAnswer(setAns, stepId, choiceId, optionIdx)

    if (evaluateChoice(step.choices.find(c => c.id === choiceId)?.correct, optionIdx) === null) return

    setChoiceStatuses(prev => {
      const { updated, allCorrect } = applyChoiceSelection(
        prev[stepId] || {},
        step.choices,
        choiceId,
        optionIdx,
      )
      if (allCorrect) {
        queueMicrotask(() => onStepComplete?.(stepId))
      }
      return { ...prev, [stepId]: updated }
    })
  }, [setAns, onStepComplete])

  return (
    <LocaleScope locale={locale}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="gd-sticky-header">
          {title && <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>{title}</div>}

          {/* Step progress bar */}
          {isProgressive && steps.length > 1 && (
            <div className="gd-step-progress">
              {steps.map((s, i) => {
                const done = !!(completedSteps?.has(s.id)) || effectiveStepResults?.[s.id] !== undefined
                const active = i === currentStepIdx && !effectiveAllDone
                return (
                  <Fragment key={s.id}>
                    {i > 0 && <div className={'gd-step-connector' + (done || (currentStepIdx !== undefined && i <= currentStepIdx && (completedSteps?.has(steps[i - 1].id) || effectiveStepResults?.[steps[i - 1].id] !== undefined)) ? ' filled' : '')} />}
                    <div className="gd-step-item">
                      <div className={'gd-step-dot' + (active ? ' active' : '') + (done ? ' done' : '')}>
                        {done ? '\u2713' : i + 1}
                      </div>
                      <span className={'gd-step-label' + (active ? ' active' : '') + (done ? ' done' : '')}>{s.title || `${i + 1}`}</span>
                    </div>
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>

        {steps.slice(0, visibleCount).map((step, si) => {
          const answers = stepsData[step.id]?.answers || {}
          const result = effectiveStepResults?.[step.id]
          const isStepCompleted = !!(completedSteps?.has(step.id)) || (result !== undefined)
          const isLast = si === steps.length - 1
          const isAnimating = animatingIdx === si

          // In progressive mode, only the current (last visible) step is interactive
          const isCurrentStep = isProgressive ? si === currentStepIdx : true
          const stepDisabled = effectiveAllDone || (!isCurrentStep && isProgressive)

          return (
            <div key={step.id} style={{
              padding: '12px 16px', borderRadius: 10,
              border: result === false ? '1.5px solid var(--red)'
                : '1px solid var(--border)',
              background: result === false ? 'var(--red-bg)' : 'var(--surface)',
              animation: isAnimating ? 'gdCardIn .35s ease-out' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 22, height: 22, borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: (result === true || (isStepCompleted && result === undefined)) ? 'var(--green)'
                    : result === false ? 'var(--red)'
                    : 'var(--teal)',
                  color: '#fff',
                }}>
                  {(result === true || (isStepCompleted && result === undefined)) ? '\u2713' : result === false ? '\u2717' : si + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}><RenderMath text={step.title || ''} /></span>
              </div>

              {step.type === 'observation_choice' && (
                <ObservationChoiceStep
                  step={step}
                  answers={answers}
                  disabled={stepDisabled}
                  choiceStatuses={choiceStatuses[step.id] || {}}
                  onChoiceSelect={(choiceId, optIdx) => handleChoiceSelect(step.id, step, choiceId, optIdx)}
                  conclusion={step.conclusion}
                  onAdvance={isProgressive && !effectiveAllDone ? onAdvance : undefined}
                  isLast={isLast}
                  t={t}
                />
              )}
              {step.type === 'formula_blanks' && (
                <>
                  <FormulaBlanksStep
                    step={step}
                    answers={answers}
                    onChange={(id, val) => updateStepAnswer(setAns, step.id, id, val)}
                    disabled={stepDisabled || (isStepCompleted && result === true)}
                    locale={locale}
                  />
                  {isProgressive && !isStepCompleted && isCurrentStep && (
                    <button
                      className="stu-btn pri"
                      style={{ marginTop: 10, fontSize: 13, padding: '6px 20px' }}
                      onClick={() => onStepSubmit?.(step.id)}
                      disabled={submitting}
                    >
                      {submitting ? t('practice.checking') : t('gd.confirm')}
                    </button>
                  )}
                  {isProgressive && (
                    <StepFeedbackBar
                      isCompleted={isStepCompleted}
                      isCorrect={result === true}
                      isLast={isLast}
                      onAdvance={result === true && !effectiveAllDone ? onAdvance : undefined}
                      feedback={stepFeedbacks?.[step.id]}
                      t={t}
                    />
                  )}
                </>
              )}
              {step.type === 'derivation_blank' && (
                <>
                  <DerivationBlankStep
                    step={step}
                    answers={answers}
                    onChange={(id, val) => updateStepAnswer(setAns, step.id, id, val)}
                    disabled={stepDisabled || (isStepCompleted && result === true)}
                    locale={locale}
                  />
                  {isProgressive && !isStepCompleted && isCurrentStep && (
                    <button
                      className="stu-btn pri"
                      style={{ marginTop: 10, fontSize: 13, padding: '6px 20px' }}
                      onClick={() => onStepSubmit?.(step.id)}
                      disabled={submitting}
                    >
                      {submitting ? t('practice.checking') : t('gd.confirm')}
                    </button>
                  )}
                  {isProgressive && (
                    <StepFeedbackBar
                      isCompleted={isStepCompleted}
                      isCorrect={result === true}
                      isLast={isLast}
                      onAdvance={result === true && !effectiveAllDone ? onAdvance : undefined}
                      feedback={stepFeedbacks?.[step.id]}
                      t={t}
                    />
                  )}
                </>
              )}
              {step.type === 'text_blanks' && (
                <>
                  <TextBlanksStep
                    step={step}
                    answers={answers}
                    onChange={(id, val) => updateStepAnswer(setAns, step.id, id, val)}
                    disabled={stepDisabled || (isStepCompleted && result === true)}
                    locale={locale}
                  />
                  {isProgressive && !isStepCompleted && isCurrentStep && (
                    <button
                      className="stu-btn pri"
                      style={{ marginTop: 10, fontSize: 13, padding: '6px 20px' }}
                      onClick={() => onStepSubmit?.(step.id)}
                      disabled={submitting}
                    >
                      {submitting ? t('practice.checking') : t('gd.confirm')}
                    </button>
                  )}
                  {isProgressive && (
                    <StepFeedbackBar
                      isCompleted={isStepCompleted}
                      isCorrect={result === true}
                      isLast={isLast}
                      onAdvance={result === true && !effectiveAllDone ? onAdvance : undefined}
                      feedback={stepFeedbacks?.[step.id]}
                      t={t}
                    />
                  )}
                </>
              )}
            </div>
          )
        })}

        {effectiveAllDone && summary && (
          <div style={{
            padding: '14px 18px', borderRadius: 10, border: '1px solid rgba(13,82,69,.15)',
            background: 'var(--teal-bg)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)', marginBottom: 6 }}>
              {summary.name || t('gd.summary')}
            </div>
            {summary.formula && (
              <div style={{ fontSize: 16, fontWeight: 600, textAlign: 'center', margin: '8px 0' }}>
                <RenderMath text={summary.formula} />
              </div>
            )}
            {summary.description && (
              <div style={{ fontSize: 13, color: 'var(--t2)' }}><RenderMath text={summary.description} /></div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes gdCardIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes btnBreathe {
          0%,100% { background: var(--surface); }
          50% { background: var(--teal-bg); }
        }
        /* ── Sticky header (title + progress bar) ── */
        .gd-sticky-header {
          position: sticky; top: 38px; z-index: 9;
          background: var(--bg); padding: 8px 0 4px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .gd-step-progress {
          display: flex; align-items: center;
          padding: 4px 0;
        }
        .gd-step-item {
          display: flex; flex-direction: column; align-items: center;
          gap: 4px; flex: 0 0 auto; position: relative; z-index: 1;
        }
        .gd-step-dot {
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--surface); border: 2px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; color: var(--t3);
          transition: all .25s;
        }
        .gd-step-dot.active { background: var(--teal-bg); border-color: var(--teal); color: var(--teal); }
        .gd-step-dot.done { background: var(--green); border-color: var(--green); color: #fff; }
        .gd-step-label {
          font-size: 10px; color: var(--t3); font-weight: 500;
          white-space: nowrap; transition: color .2s;
          max-width: 64px; overflow: hidden; text-overflow: ellipsis; text-align: center;
        }
        .gd-step-label.active { color: var(--teal); font-weight: 600; }
        .gd-step-label.done { color: var(--green); }
        .gd-step-connector {
          flex: 1; height: 2px; background: var(--border);
          min-width: 12px; margin: 0 -2px;
          position: relative; top: -9px; transition: background .25s;
        }
        .gd-step-connector.filled { background: var(--green); }

        /* ── MathInput: collapsible input field ── */
        .math-input-root { display: inline-block; vertical-align: top; }
        .math-input-collapsed {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 100px; min-height: 34px; padding: 5px 14px;
          border-radius: 8px; border: 1.5px dashed var(--teal);
          background: var(--surface); font-size: 14px; font-weight: 500;
          color: var(--t1); cursor: pointer; transition: all .15s;
        }
        .math-input-collapsed.empty { border-style: dashed; }
        .math-input-collapsed:not(.empty) { border-style: solid; }
        .math-input-collapsed:hover { background: var(--teal-bg); }
        .math-input-collapsed.active { border-color: var(--teal); border-style: solid; background: var(--teal-bg); }
        .math-input-collapsed.has-content { padding: 4px 8px; min-height: auto; border-style: solid; }
        .math-input-ph { color: var(--teal); font-size: 12px; font-weight: 500; }
        .math-input-text-preview { font-size: 16px; font-weight: 600; color: var(--t1); }
        .math-input-edit-hint { font-size: 9px; color: var(--t3); margin-left: 6px; opacity: 0; transition: opacity .15s; }
        .math-input-collapsed:hover .math-input-edit-hint { opacity: 1; }
        .math-input-panel {
          margin-top: 8px; border: 1px solid var(--border); border-radius: 10px;
          background: var(--surface); overflow: hidden;
          animation: gdCardIn .25s ease;
        }
        .math-input-tabs {
          display: flex; align-items: center; gap: 2px;
          padding: 6px 8px; border-bottom: 1px solid var(--border);
          background: var(--surface2, #f5f5f4);
        }
        .math-input-tab {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 14px; border-radius: 6px; border: none;
          background: transparent; font-size: 11px; font-weight: 500;
          color: var(--t3); cursor: pointer; font-family: inherit; transition: all .12s;
        }
        .math-input-tab svg { stroke: currentColor; }
        .math-input-tab:hover { color: var(--t2); background: var(--surface); }
        .math-input-tab.active { color: var(--teal); background: var(--surface); font-weight: 600; }
        .math-input-close {
          margin-left: auto; display: inline-flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: 5px; border: none;
          background: transparent; font-size: 10px; font-weight: 500;
          color: var(--t3); cursor: pointer; font-family: inherit;
        }
        .math-input-close:hover { color: var(--t1); background: var(--surface); }
        .math-input-kb { padding: 12px; }
        .math-input-field {
          width: 100%; padding: 8px 12px; border: 1px solid var(--border);
          border-radius: 6px; font-size: 14px; font-family: inherit;
          color: var(--t1); background: var(--bg);
        }
        .math-input-field:focus { outline: none; border-color: var(--teal); }
        .math-input-kb-hint { font-size: 10px; color: var(--t3); margin-top: 6px; }
        .math-input-confirm-row { padding: 8px 12px 12px; display: flex; justify-content: flex-end; }
        .math-input-confirm {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 20px; border-radius: 8px; border: none;
          background: var(--teal); color: #fff; font-size: 13px; font-weight: 600;
          font-family: inherit; cursor: pointer; transition: opacity .15s;
        }
        .math-input-confirm:hover { opacity: .85; }
        .math-input-photo { padding: 12px; }
        .math-input-photo-drop {
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
          padding: 24px 16px; border: 1.5px dashed var(--border); border-radius: 8px;
          cursor: pointer; transition: all .15s;
        }
        .math-input-photo-drop:hover { border-color: var(--teal); background: var(--teal-bg); }
        .math-input-photo-drop span { font-size: 12px; color: var(--t3); font-weight: 500; }
        .math-input-photo-drop:hover span { color: var(--teal); }
        .math-input-photo-preview { position: relative; }
        .math-input-photo-preview img {
          max-width: 100%; max-height: 280px; border-radius: 6px;
          border: 1px solid var(--border); display: block; object-fit: contain;
        }
        .math-input-photo-change {
          display: inline-flex; align-items: center; gap: 5px;
          margin-top: 8px; padding: 5px 12px; border-radius: 6px;
          border: 1px solid var(--border); background: var(--surface);
          font-size: 11px; font-weight: 500; color: var(--t2);
          cursor: pointer; font-family: inherit; transition: all .12s;
        }
        .math-input-photo-change:hover { background: var(--surface2, #f5f5f4); color: var(--t1); }
        .math-input-panel .hw-area { border-radius: 0; border: none; animation: none; margin: 0; }
      `}</style>
    </LocaleScope>
  )
}
