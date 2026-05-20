import { useState, useCallback, useRef, useEffect } from 'react'
import type { GdStep, GdObservationStep, GdFormulaBlanksStep, GdDerivationBlankStep, GdTextBlanksStep } from '../task-data'
import { RenderMath } from '../../../utils/render-math'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'
import { useT, LocaleScope, type Locale, type TFn } from '../../../i18n'
import { HandwritingCanvas } from '../image-capture/HandwritingCanvas'
import { evaluateChoice, applyChoiceSelection, type ChoiceStatus } from './gd-choice-helpers'
import '../image-capture/handwriting.css'

interface Props {
  steps: GdStep[]
  title?: string
  summary?: { formula?: string; name?: string; description?: string }
  ans: Record<string, any>
  setAns: (updater: (prev: Record<string, any>) => Record<string, any>) => void
  stepResults?: Record<string, boolean>
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

type InputMethod = 'keyboard' | 'handwrite' | 'photo'

/* SVG icons for input method toggle — matches HandwritingCanvas style */
const MethodIcons: Record<InputMethod, JSX.Element> = {
  keyboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="8" y1="16" x2="16" y2="16"/></svg>,
  handwrite: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  photo: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
}

const blankInputStyle = (valueLen: number): React.CSSProperties => ({
  display: 'inline-block', width: Math.max(80, valueLen * 14 + 32),
  padding: '4px 10px', border: '2px solid var(--border)', borderRadius: 6,
  fontSize: 14, textAlign: 'center', outline: 'none', background: 'transparent',
})

function GdInputField({ inputMethods, value, onChange, disabled, placeholder, locale }: {
  inputMethods?: string[]; value: string; onChange: (val: string) => void; disabled: boolean; placeholder?: string; locale?: Locale
}) {
  const t = useT(locale)
  const methods = (inputMethods && inputMethods.length > 1) ? inputMethods as InputMethod[] : null
  const [activeMethod, setActiveMethod] = useState<InputMethod>('keyboard')
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const handlePagesChange = useCallback((dataUris: string[]) => {
    if (dataUris.length > 0) onChangeRef.current(dataUris[0])
  }, [])

  if (!methods) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder || '___'}
        style={blankInputStyle(value.length)}
      />
    )
  }

  const methodLabel: Record<InputMethod, string> = {
    keyboard: t('gd.keyboard'),
    handwrite: t('canvas.handwrite'),
    photo: t('canvas.photoUpload'),
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {methods.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setActiveMethod(m)}
            disabled={disabled}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 6, fontSize: 12, cursor: disabled ? 'default' : 'pointer',
              border: activeMethod === m ? '1.5px solid var(--pri)' : '1px solid var(--border)',
              background: activeMethod === m ? 'var(--pri-light, #e0e7ff)' : 'var(--surface)',
              color: activeMethod === m ? 'var(--pri)' : 'var(--t2)',
              fontWeight: activeMethod === m ? 600 : 400,
              fontFamily: 'inherit', transition: 'all .15s',
            }}
          >
            {MethodIcons[m]} {methodLabel[m]}
          </button>
        ))}
      </div>
      {activeMethod === 'keyboard' && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder || '___'}
          style={blankInputStyle(value.length)}
        />
      )}
      {(activeMethod === 'handwrite' || activeMethod === 'photo') && (
        <HandwritingCanvas maxPages={1} onPagesChange={handlePagesChange} disabled={disabled} locale={locale} />
      )}
    </div>
  )
}

// ── ObservationChoiceStep with instant client-side feedback ──

function ObservationChoiceStep({ step, answers, disabled, choiceStatuses, onChoiceSelect }: {
  step: GdObservationStep
  answers: Record<string, any>
  disabled: boolean
  choiceStatuses: Record<string, ChoiceStatus>
  onChoiceSelect: (choiceId: string, optionIdx: number) => void
}) {
  const t = useT()
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
      {step.choices.map(choice => {
        const status = choiceStatuses[choice.id]
        const isLocked = status === 'correct'
        return (
          <div key={choice.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14 }}><RenderMath text={choice.prompt} /></span>
            {choice.options.map((opt, oi) => {
              const selected = answers[choice.id] === oi
              // Determine button styling based on feedback status
              let border = '1px solid var(--border)'
              let bg = 'var(--surface)'
              let color = 'var(--t1)'
              let fontWeight = 400

              if (selected && status === 'correct') {
                border = '2px solid #22c55e'
                bg = '#f0fdf4'
                color = '#16a34a'
                fontWeight = 600
              } else if (selected && status === 'wrong') {
                border = '2px solid #ef4444'
                bg = '#fef2f2'
                color = '#ef4444'
                fontWeight = 600
              } else if (selected) {
                border = '2px solid var(--pri)'
                bg = 'var(--pri-light, #e0e7ff)'
                color = 'var(--pri)'
                fontWeight = 600
              }

              return (
                <button
                  key={oi}
                  onClick={() => {
                    if (disabled || isLocked) return
                    onChoiceSelect(choice.id, oi)
                  }}
                  disabled={disabled || isLocked}
                  style={{
                    padding: '4px 14px', borderRadius: 6, fontSize: 13,
                    cursor: (disabled || isLocked) ? 'default' : 'pointer',
                    border, background: bg, fontWeight, color,
                    opacity: disabled && !selected ? 0.5 : 1,
                    transition: 'all .2s',
                  }}
                >
                  <RenderMath text={opt} />
                </button>
              )
            })}
            {status === 'correct' && <span style={{ color: '#22c55e', fontSize: 16 }}>{'\u2713'}</span>}
          </div>
        )
      })}
    </div>
  )
}

function FormulaBlanksStep({ step, answers, onChange, disabled, locale }: {
  step: GdFormulaBlanksStep; answers: Record<string, any>; onChange: (id: string, val: string) => void; disabled: boolean; locale?: Locale
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {step.prompt && <div style={{ fontSize: 14, color: 'var(--t2)' }}><RenderMath text={step.prompt} /></div>}
      {step.blanks.map(blank => (
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
      ))}
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
}

export function parseGdReview(review: ReviewData) {
  const { data, checkItems } = review
  const stepResults: Record<string, boolean> = {}
  checkItems?.forEach(it => { stepResults[it.idx as string] = it.correct })
  return { state: { ans: { steps: data.steps || {} } as GdReviewState['ans'], stepResults }, allDone: true }
}

// ── Step feedback + transition bar ──

function StepFeedbackBar({ isCompleted, isCorrect, isLast, onAdvance, t }: {
  isCompleted: boolean; isCorrect: boolean; isLast: boolean
  onAdvance?: () => void; t: TFn
}) {
  if (!isCompleted) return null
  return (
    <div style={{
      marginTop: 10, padding: '8px 12px', borderRadius: 8,
      background: isCorrect ? '#f0fdf4' : '#fef2f2',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: isCorrect ? '#16a34a' : '#ef4444' }}>
        {isCorrect ? t('gd.stepCorrect') : t('gd.stepWrong')}
      </span>
      {isCorrect && onAdvance && (
        <button
          className="stu-btn pri"
          style={{ fontSize: 13, padding: '4px 16px' }}
          onClick={onAdvance}
        >
          {isLast ? t('gd.viewSummary') : t('gd.continueNext')}
        </button>
      )}
    </div>
  )
}

export function GuidedDiscoveryExercise({
  steps, title, summary, ans, setAns, stepResults, allDone, reviewData, locale,
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
        {title && <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>{title}</div>}

        {steps.slice(0, visibleCount).map((step, si) => {
          const answers = stepsData[step.id]?.answers || {}
          const result = effectiveStepResults?.[step.id]
          const isStepCompleted = !!(completedSteps?.has(step.id)) || (result !== undefined)
          const isStepCorrect = result === true || (!!(completedSteps?.has(step.id)) && result === undefined)
          const isLast = si === steps.length - 1
          const resultColor = result === true ? '#22c55e' : result === false ? '#ef4444' : undefined
          const isAnimating = animatingIdx === si

          // In progressive mode, only the current (last visible) step is interactive
          const isCurrentStep = isProgressive ? si === currentStepIdx : true
          const stepDisabled = effectiveAllDone || (!isCurrentStep && isProgressive)

          return (
            <div key={step.id} style={{
              padding: '12px 16px', borderRadius: 10,
              border: resultColor ? `2px solid ${resultColor}`
                : (isStepCompleted && !resultColor) ? '2px solid #22c55e'
                : '1px solid var(--border)',
              background: result === true ? '#f0fdf4'
                : result === false ? '#fef2f2'
                : (isStepCompleted && result === undefined) ? '#f0fdf4'
                : 'var(--surface)',
              animation: isAnimating ? 'gdCardIn .35s ease-out' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%', fontSize: 13, fontWeight: 600,
                  background: (result === true || (isStepCompleted && result === undefined)) ? '#22c55e'
                    : result === false ? '#ef4444'
                    : 'var(--pri)',
                  color: '#fff',
                }}>
                  {(result === true || (isStepCompleted && result === undefined)) ? '\u2713' : result === false ? '\u2717' : si + 1}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{step.title}</span>
              </div>

              {step.type === 'observation_choice' && (
                <>
                  <ObservationChoiceStep
                    step={step}
                    answers={answers}
                    disabled={stepDisabled}
                    choiceStatuses={choiceStatuses[step.id] || {}}
                    onChoiceSelect={(choiceId, optIdx) => handleChoiceSelect(step.id, step, choiceId, optIdx)}
                  />
                  {isProgressive && (
                    <StepFeedbackBar
                      isCompleted={isStepCompleted}
                      isCorrect={isStepCorrect}
                      isLast={isLast}
                      onAdvance={isStepCorrect && !effectiveAllDone ? onAdvance : undefined}
                      t={t}
                    />
                  )}
                </>
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
            padding: '14px 18px', borderRadius: 10, border: '2px solid #22c55e',
            background: '#f0fdf4',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#16a34a', marginBottom: 6 }}>
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
      `}</style>
    </LocaleScope>
  )
}
