import type { GdStep, GdObservationStep, GdFormulaBlanksStep, GdDerivationBlankStep, GdTextBlanksStep } from '../task-data'
import { RenderMath } from '../../../utils/render-math'
import { useReviewRestore, type ReviewData } from '../../../hooks/useReviewRestore'

interface Props {
  steps: GdStep[]
  title?: string
  summary?: { formula?: string; name?: string; description?: string }
  ans: Record<string, any>
  setAns: (updater: (prev: Record<string, any>) => Record<string, any>) => void
  stepResults?: Record<string, boolean>
  allDone: boolean
  reviewData?: ReviewData
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

function ObservationChoiceStep({ step, answers, onChange, disabled }: {
  step: GdObservationStep; answers: Record<string, any>; onChange: (id: string, val: number) => void; disabled: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {step.table && (
        <table style={{ borderCollapse: 'collapse', fontSize: 14, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid var(--border)', padding: '6px 12px', background: 'var(--surface)', textAlign: 'left' }}>算式</th>
              <th style={{ border: '1px solid var(--border)', padding: '6px 12px', background: 'var(--surface)', textAlign: 'left' }}>结果</th>
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
      {step.choices.map(choice => (
        <div key={choice.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14 }}><RenderMath text={choice.prompt} /></span>
          {choice.options.map((opt, oi) => {
            const selected = answers[choice.id] === oi
            return (
              <button
                key={oi}
                onClick={() => !disabled && onChange(choice.id, oi)}
                disabled={disabled}
                style={{
                  padding: '4px 14px', borderRadius: 6, fontSize: 13, cursor: disabled ? 'default' : 'pointer',
                  border: selected ? '2px solid var(--pri)' : '1px solid var(--border)',
                  background: selected ? 'var(--pri-light, #e0e7ff)' : 'var(--surface)',
                  fontWeight: selected ? 600 : 400,
                  color: selected ? 'var(--pri)' : 'var(--t1)',
                  opacity: disabled && !selected ? 0.5 : 1,
                }}
              >
                <RenderMath text={opt} />
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function FormulaBlanksStep({ step, answers, onChange, disabled }: {
  step: GdFormulaBlanksStep; answers: Record<string, any>; onChange: (id: string, val: string) => void; disabled: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {step.prompt && <div style={{ fontSize: 14, color: 'var(--t2)' }}><RenderMath text={step.prompt} /></div>}
      {step.blanks.map(blank => (
        <div key={blank.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}><RenderMath text={blank.label} /></span>
          <input
            type="text"
            value={answers[blank.id] || ''}
            onChange={e => onChange(blank.id, e.target.value)}
            disabled={disabled}
            placeholder={blank.placeholder || '___'}
            style={{
              display: 'inline-block', width: Math.max(80, (answers[blank.id] || '').length * 14 + 32),
              padding: '4px 10px', border: '2px solid var(--border)', borderRadius: 6,
              fontSize: 14, textAlign: 'center', outline: 'none', background: 'transparent',
            }}
          />
        </div>
      ))}
    </div>
  )
}

function DerivationBlankStep({ step, answers, onChange, disabled }: {
  step: GdDerivationBlankStep; answers: Record<string, any>; onChange: (id: string, val: string) => void; disabled: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {step.lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, lineHeight: 2 }}>
          <RenderMath text={line.text} />
          {line.blank && (
            <input
              type="text"
              value={answers[line.blank.id] || ''}
              onChange={e => onChange(line.blank!.id, e.target.value)}
              disabled={disabled}
              placeholder={line.blank.placeholder || '___'}
              style={{
                display: 'inline-block', width: Math.max(80, (answers[line.blank.id] || '').length * 14 + 32),
                padding: '4px 10px', border: '2px solid var(--border)', borderRadius: 6,
                fontSize: 14, textAlign: 'center', outline: 'none', background: 'transparent',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function TextBlanksStep({ step, answers, onChange, disabled }: {
  step: GdTextBlanksStep; answers: Record<string, any>; onChange: (id: string, val: string) => void; disabled: boolean
}) {
  const parts = step.template.split(/(\{\{[^}]+\}\})/)
  return (
    <div style={{ fontSize: 14, lineHeight: 2.2 }}>
      {parts.map((part, i) => {
        const match = part.match(/^\{\{([^}]+)\}\}$/)
        if (match) {
          const blankId = match[1]
          const value = answers[blankId] || ''
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

export function GuidedDiscoveryExercise({ steps, title, summary, ans, setAns, stepResults, allDone, reviewData }: Props) {
  const restored = useReviewRestore(reviewData, parseGdReview)
  const effectiveAns = restored?.ans ?? ans
  const effectiveStepResults = restored?.stepResults ?? stepResults
  const effectiveAllDone = restored ? true : allDone

  const stepsData = effectiveAns.steps || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {title && <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>{title}</div>}

      {steps.map((step, si) => {
        const answers = stepsData[step.id]?.answers || {}
        const result = effectiveStepResults?.[step.id]
        const resultColor = result === true ? '#22c55e' : result === false ? '#ef4444' : undefined

        return (
          <div key={step.id} style={{
            padding: '12px 16px', borderRadius: 10,
            border: resultColor ? `2px solid ${resultColor}` : '1px solid var(--border)',
            background: result === true ? '#f0fdf4' : result === false ? '#fef2f2' : 'var(--surface)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 24, height: 24, borderRadius: '50%', fontSize: 13, fontWeight: 600,
                background: resultColor || 'var(--pri)', color: '#fff',
              }}>
                {result === true ? '\u2713' : result === false ? '\u2717' : si + 1}
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{step.title}</span>
            </div>

            {step.type === 'observation_choice' && (
              <ObservationChoiceStep
                step={step}
                answers={answers}
                onChange={(id, val) => updateStepAnswer(setAns, step.id, id, val)}
                disabled={effectiveAllDone}
              />
            )}
            {step.type === 'formula_blanks' && (
              <FormulaBlanksStep
                step={step}
                answers={answers}
                onChange={(id, val) => updateStepAnswer(setAns, step.id, id, val)}
                disabled={effectiveAllDone}
              />
            )}
            {step.type === 'derivation_blank' && (
              <DerivationBlankStep
                step={step}
                answers={answers}
                onChange={(id, val) => updateStepAnswer(setAns, step.id, id, val)}
                disabled={effectiveAllDone}
              />
            )}
            {step.type === 'text_blanks' && (
              <TextBlanksStep
                step={step}
                answers={answers}
                onChange={(id, val) => updateStepAnswer(setAns, step.id, id, val)}
                disabled={effectiveAllDone}
              />
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
            {summary.name || '总结'}
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
  )
}
