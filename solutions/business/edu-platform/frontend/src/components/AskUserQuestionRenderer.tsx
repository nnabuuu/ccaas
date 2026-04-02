import { useState, useCallback, useRef } from 'react'
import { useChatCore, getWizardConfig, findWizardByHeaders, WizardRenderer } from '@kedge-agentic/chat-interface'
import type { ToolRenderer } from '@kedge-agentic/chat-interface'

/* ─── Types ─── */
interface QuestionOption {
  label: string
  description?: string
  recommended?: boolean
  value?: string
  previewContent?: string
}

interface Question {
  question: string
  header?: string
  hint?: string
  options: QuestionOption[]
  multiSelect?: boolean
  preview?: boolean
}

interface AskInput {
  questions: Question[]
}

/* ─── Recommended detection: handles both opt.recommended and "(推荐)" in label ─── */
const REC_RE = /\s*[（(]推荐[）)]/
function isRecommendedOpt(opt: QuestionOption): boolean {
  return opt.recommended === true || REC_RE.test(opt.label)
}
const REC_RE_G = /\s*[（(]推荐[）)]/g
function cleanLabel(label: string): string {
  return label.replace(REC_RE_G, '').trim()
}

/* ─── Validation ─── */
function isValidInput(input: unknown): input is AskInput {
  if (!input || typeof input !== 'object') return false
  const obj = input as Record<string, unknown>
  if (!Array.isArray(obj.questions) || obj.questions.length === 0) return false
  return obj.questions.every(
    (q: unknown) =>
      q && typeof q === 'object' &&
      typeof (q as Record<string, unknown>).question === 'string' &&
      Array.isArray((q as Record<string, unknown>).options),
  )
}

/* ─── Robust toolInput parsing (handles JSON string from API history) ─── */
function parseToolInputRobust(raw: unknown): AskInput | null {
  if (isValidInput(raw)) return raw as AskInput
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (isValidInput(parsed)) return parsed as AskInput
    } catch { /* not JSON */ }
  }
  return null
}

/* ─── Collect all known option values for a question ─── */
function getKnownValues(q: Question): Set<string> {
  const vals = new Set<string>()
  for (const opt of q.options) {
    vals.add(opt.value || cleanLabel(opt.label))
    vals.add(cleanLabel(opt.label))
  }
  return vals
}

/* ─── Validate that answers map has at least one value matching known options ─── */
function isPlausibleAnswers(answers: Record<string, string>, questions: Question[]): boolean {
  for (const q of questions) {
    const val = answers[q.question]
    if (!val) continue
    const known = getKnownValues(q)
    // Direct match or comma-separated parts matching (for multiSelect)
    if (known.has(val)) return true
    const parts = val.split(/[,，]\s*/)
    if (parts.some(p => known.has(p.trim()))) return true
  }
  return false
}

/* ─── Robust toolOutput parsing — handles multiple backend formats ─── */
function parseToolOutputAsAnswers(
  raw: unknown,
  questions: Question[],
): Record<string, string> | null {
  if (!raw) return null
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) } catch {
      // Only accept plain string if it contains · separator (summary format)
      if (!raw.includes('·')) return null
      return parseSummaryString(raw, questions)
    }
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  // Case 1: { answers: { "question text": "answer value" } }
  if (obj.answers && typeof obj.answers === 'object' && Object.keys(obj.answers).length > 0) {
    const ans = obj.answers as Record<string, string>
    // Validate: at least one answer key matches a question text
    if (questions.some(q => typeof ans[q.question] === 'string')) {
      return ans
    }
  }
  // Case 2: { text: "val1 · val2" } or { result: "..." }
  const textVal = (obj.text ?? obj.result ?? obj.content) as string | undefined
  if (typeof textVal === 'string' && textVal.includes('·')) {
    const result = parseSummaryString(textVal, questions)
    if (result && isPlausibleAnswers(result, questions)) return result
  }
  // Case 3: object keys match question texts (direct answers map)
  const matchingKeys = Object.keys(obj).filter(k =>
    questions.some(q => q.question === k) && typeof obj[k] === 'string',
  )
  if (matchingKeys.length > 0) {
    const result: Record<string, string> = {}
    for (const k of matchingKeys) result[k] = obj[k] as string
    return result
  }
  return null
}

function parseSummaryString(summary: string, questions: Question[]): Record<string, string> | null {
  const parts = summary.split(/\s*·\s*/)
  if (parts.length === 0 || !parts[0]) return null
  const answers: Record<string, string> = {}
  questions.forEach((q, i) => {
    if (parts[i]) answers[q.question] = parts[i].trim()
  })
  return Object.keys(answers).length > 0 ? answers : null
}

/* ─── Selection state per question ─── */
interface SelectionState {
  selectedIndices: Set<number>
  otherSelected: boolean
  otherText: string
}

function initSelections(questions: Question[]): SelectionState[] {
  return questions.map((q) => {
    const recIdx = q.options.findIndex((o) => isRecommendedOpt(o))
    return {
      selectedIndices: recIdx >= 0 ? new Set([recIdx]) : new Set<number>(),
      otherSelected: false,
      otherText: '',
    }
  })
}

function isAnswered(sel: SelectionState): boolean {
  return sel.selectedIndices.size > 0 || (sel.otherSelected && sel.otherText.length > 0)
}

function getDisplayValue(q: Question, sel: SelectionState): string {
  if (sel.otherSelected && sel.otherText) return sel.otherText
  if (sel.otherSelected) return '自定义'
  const labels = Array.from(sel.selectedIndices).map((i) => {
    const opt = q.options[i]
    return opt?.value || cleanLabel(opt?.label || '')
  })
  return labels.join(', ')
}

/* ─── Main Renderer ─── */
export const askUserQuestionRenderer: ToolRenderer = (block) => {
  // Robust toolInput parsing (handles JSON string from API history)
  const parsedInput = parseToolInputRobust(block.toolInput)
  if (!parsedInput) {
    if (block.phase !== 'end') return <span style={{ display: 'none' }} />
    return null
  }

  const { questions } = parsedInput

  // Phase: end — show submitted view if we have answers
  if (block.phase === 'end') {
    const answers = parseToolOutputAsAnswers(block.toolOutput, questions)
    if (answers) {
      return <SubmittedView questions={questions} answers={answers} />
    }
    // Fallback: show interactive view even on end (e.g. error case)
    return <InteractiveView questions={questions} />
  }

  // Phase: start — control_request flow: CLI is paused, waiting for user input
  // toolId is the requestId for control_response
  if (block.phase === 'start') {
    return <ControlRequestView questions={questions} requestId={block.toolId} />
  }

  // Phase: progress — hide
  return <span style={{ display: 'none' }} />
}

/* ─── Control Request View (connected to ChatCore, submits via control-response API) ─── */
function ControlRequestView({ questions, requestId }: { questions: Question[]; requestId: string }) {
  const { serverUrl, sessionId, sessionContext, apiKey } = useChatCore()

  // Check for wizard config — try direct slug match, then trigger header fallback
  const headerHint = questions[0]?.header || ''
  const allHeaders = questions.map(q => q.header || '').filter(Boolean)
  const wizardConfig = getWizardConfig(headerHint) || findWizardByHeaders(allHeaders)

  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const submitControlResponse = useCallback(async (answers: Record<string, string>) => {
    if (!sessionId || !requestId) return
    setSubmitState('loading')
    setSubmitError(null)
    try {
      const base = serverUrl || ''
      const res = await fetch(`${base}/api/v1/sessions/${sessionId}/control-response`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({ requestId, answers }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setSubmitState('success')
    } catch (err) {
      setSubmitState('error')
      setSubmitError(err instanceof Error ? err.message : '提交失败')
    }
  }, [serverUrl, sessionId, requestId])

  // Wizard mode: render WizardRenderer if config is registered
  if (wizardConfig) {
    return (
      <WizardRenderer
        config={wizardConfig}
        onSubmit={submitControlResponse}
        sessionContext={sessionContext}
        apiBaseUrl={serverUrl || ''}
      />
    )
  }

  // Default mode: render standard AskUserQuestion UI
  const handleDefaultSubmit = useCallback(async (action: { label: string; prompt: string }) => {
    const answers: Record<string, string> = {}
    const parts = action.prompt.split(' · ')
    questions.forEach((q, i) => {
      if (parts[i]) answers[q.question] = parts[i].trim()
    })
    await submitControlResponse(answers)
  }, [questions, submitControlResponse])

  if (submitState === 'success') {
    return (
      <div style={{ ...S.container }}>
        <div style={{ ...S.footer, background: 'var(--success-bg)' }}>
          <div style={{ fontSize: 11, color: 'var(--success-t)', fontWeight: 500, width: '100%', textAlign: 'center' }}>
            ✓ 已提交，等待 AI 继续...
          </div>
        </div>
      </div>
    )
  }

  if (submitState === 'error') {
    return (
      <div style={{ ...S.container }}>
        <div style={{ padding: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--error-t)', marginBottom: 8 }}>
            提交失败: {submitError}
          </div>
          <button
            onClick={() => setSubmitState('idle')}
            style={{ ...S.submitBtn, fontSize: 11, padding: '5px 14px' }}
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  return <InteractiveViewInner questions={questions} onSubmitAction={handleDefaultSubmit} />
}

/* ─── Submitted (read-only) View — renders ALL question panels ─── */
function SubmittedView({ questions, answers }: { questions: Question[]; answers: Record<string, string> }) {
  const summaryParts: string[] = []
  questions.forEach((q) => {
    const val = answers[q.question]
    if (val) summaryParts.push(val)
  })

  const hasPreview = questions.some((q) => q.preview === true)

  // Determine if an option is the selected answer (handles cleaned labels)
  function isOptionSelected(q: Question, opt: QuestionOption, answer: string): boolean {
    const optVal = opt.value || cleanLabel(opt.label)
    if (!q.multiSelect) return answer === optVal
    return answer.split(/[,，]\s*/).includes(optVal)
  }

  // Determine if the answer is a custom "Other" value (doesn't match any option)
  function isOtherAnswer(q: Question, answer: string): boolean {
    if (!answer) return false
    if (!q.multiSelect) {
      return !q.options.some((opt) => (opt.value || cleanLabel(opt.label)) === answer)
    }
    const parts = answer.split(/[,，]\s*/)
    return parts.some((p) => !q.options.some((opt) => (opt.value || cleanLabel(opt.label)) === p))
  }

  return (
    <div style={S.container}>
      {/* Chips — non-interactive in submitted state */}
      <div style={{ ...S.chipsBar, pointerEvents: 'none' as const }}>
        {questions.map((q, i) => {
          const val = answers[q.question] || ''
          return (
            <div
              key={i}
              style={{
                ...S.chip,
                ...(i === 0 ? { ...S.chipActive, color: 'var(--success-t)' } : {}),
                ...(i !== 0 ? { color: 'var(--t3)' } : {}),
              }}
            >
              <span style={{ ...S.chipDot, background: val ? 'var(--success-t)' : 'var(--t3)' }} />
              <span>{q.header || `Q${i + 1}`}</span>
              {val && <span style={S.chipVal}>{val}</span>}
            </div>
          )
        })}
      </div>

      {/* Body — grid stack with ALL panels for fixed height */}
      <div style={{ ...S.body, ...(hasPreview ? { gridTemplateColumns: '1fr 1fr' } : {}) }}>
        {questions.map((q, qi) => {
          const isVis = qi === 0
          const answer = answers[q.question] || ''
          const otherVal = isOtherAnswer(q, answer)
          return (
            <div
              key={qi}
              style={{
                ...S.panel,
                opacity: isVis ? 1 : 0,
                pointerEvents: 'none' as const,
              }}
            >
              <div style={S.questionText}>{q.question}</div>
              {q.hint && <div style={S.hintText}>{q.hint}</div>}
              <div style={S.optsList}>
                {q.options.map((opt, oi) => {
                  const isSelected = isOptionSelected(q, opt, answer)
                  return (
                    <div
                      key={oi}
                      style={{
                        ...S.opt,
                        ...(isSelected ? S.optSubmittedSelected : { opacity: 0.3 }),
                        cursor: 'default',
                        pointerEvents: 'none' as const,
                      }}
                    >
                      <div style={{
                        ...S.indicator,
                        ...(q.multiSelect ? S.indicatorCheckbox : {}),
                        ...(isSelected ? S.indicatorSubmittedSelected : {}),
                      }}>
                        {isSelected && (
                          q.multiSelect ? <CheckmarkIcon /> : <div style={S.indicatorInner} />
                        )}
                      </div>
                      <div style={S.optBody}>
                        <div style={S.optLabel}>
                          {cleanLabel(opt.label)}
                          {isRecommendedOpt(opt) && <span style={S.recBadge}>推荐</span>}
                        </div>
                        {opt.description && <div style={S.optDesc}>{opt.description}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Other area */}
              <div style={{
                ...S.otherWrap,
                ...(otherVal ? S.otherSubmittedSelected : { opacity: 0.3 }),
                cursor: 'default',
                pointerEvents: 'none' as const,
                marginTop: 6,
              }}>
                <div style={{
                  ...S.indicator,
                  ...(q.multiSelect ? S.indicatorCheckbox : {}),
                  ...(otherVal ? S.indicatorSubmittedSelected : {}),
                }}>
                  {otherVal && (
                    q.multiSelect ? <CheckmarkIcon /> : <div style={S.indicatorInner} />
                  )}
                </div>
                <div style={S.otherBody}>
                  <div style={S.otherLabel}>或者自定义</div>
                  <input
                    style={{ ...S.otherInput, pointerEvents: 'none' as const, opacity: 0.7 }}
                    readOnly
                    value={otherVal ? answer : ''}
                    placeholder="..."
                  />
                </div>
              </div>
            </div>
          )
        })}

        {/* Preview pane (submitted) */}
        {hasPreview && (
          <div style={S.previewPane}>
            <div style={S.previewLabel}>结构预览</div>
            <pre style={S.previewContent}>
              {(() => {
                const q = questions[0]
                if (!q?.preview) return ''
                const answer = answers[q.question] || ''
                const matched = q.options.find((o) => (o.value || o.label) === answer)
                return matched?.previewContent || ''
              })()}
            </pre>
          </div>
        )}
      </div>

      {/* Footer submitted */}
      <div style={{ ...S.footer, background: 'var(--success-bg)' }}>
        <div style={{ fontSize: 11, color: 'var(--success-t)', fontWeight: 500 }}>
          ✓ {summaryParts.join(' · ')}
        </div>
      </div>
    </div>
  )
}

/* ─── Interactive View (connected to ChatCore) ─── */
function InteractiveView({ questions }: { questions: Question[] }) {
  const { handleAction } = useChatCore()
  return <InteractiveViewInner questions={questions} onSubmitAction={handleAction} />
}

/* ─── Interactive View Inner (pure UI, no context dependency) ─── */
function InteractiveViewInner({
  questions,
  onSubmitAction,
}: {
  questions: Question[]
  onSubmitAction: (action: { label: string; prompt: string }) => void
}) {
  const [activeTab, setActiveTab] = useState(0)
  const [selections, setSelections] = useState<SelectionState[]>(() => initSelections(questions))
  const [submitted, setSubmitted] = useState(false)
  const otherInputRefs = useRef<(HTMLInputElement | null)[]>([])

  const answeredCount = selections.filter(isAnswered).length
  const allAnswered = answeredCount === questions.length

  const updateSelection = useCallback((qIdx: number, updater: (prev: SelectionState) => SelectionState) => {
    setSelections((prev) => {
      const next = [...prev]
      next[qIdx] = updater(prev[qIdx])
      return next
    })
  }, [])

  const handleOptClick = useCallback((qIdx: number, optIdx: number) => {
    if (submitted) return
    const q = questions[qIdx]
    updateSelection(qIdx, (prev) => {
      const next = { ...prev }
      if (q.multiSelect) {
        const s = new Set(prev.selectedIndices)
        if (s.has(optIdx)) s.delete(optIdx)
        else s.add(optIdx)
        next.selectedIndices = s
      } else {
        next.selectedIndices = new Set([optIdx])
        next.otherSelected = false
        next.otherText = ''
      }
      return next
    })

    // Auto-advance for single-select
    if (!q.multiSelect) {
      setTimeout(() => {
        setSelections((current) => {
          for (let i = 0; i < questions.length; i++) {
            if (!isAnswered(current[i])) {
              setActiveTab(i)
              return current
            }
          }
          return current
        })
      }, 200)
    }
  }, [submitted, questions, updateSelection])

  const handleOtherClick = useCallback((qIdx: number) => {
    if (submitted) return
    const q = questions[qIdx]
    updateSelection(qIdx, (prev) => {
      const next = { ...prev }
      if (q.multiSelect) {
        next.otherSelected = !prev.otherSelected
      } else {
        next.selectedIndices = new Set()
        next.otherSelected = true
      }
      return next
    })
    setTimeout(() => otherInputRefs.current[qIdx]?.focus(), 0)
  }, [submitted, questions, updateSelection])

  const handleOtherInput = useCallback((qIdx: number, text: string) => {
    if (submitted) return
    const q = questions[qIdx]
    updateSelection(qIdx, (prev) => {
      const next = { ...prev, otherText: text }
      if (text.length > 0 && !prev.otherSelected) {
        if (!q.multiSelect) next.selectedIndices = new Set()
        next.otherSelected = true
      }
      if (text.length === 0 && !q.multiSelect) {
        next.otherSelected = false
      }
      return next
    })
  }, [submitted, questions, updateSelection])

  const handleSubmit = useCallback(() => {
    if (!allAnswered || submitted) return
    setSubmitted(true)
    const parts: string[] = []
    questions.forEach((q, i) => {
      parts.push(getDisplayValue(q, selections[i]))
    })
    const summary = parts.join(' · ')
    onSubmitAction({ label: summary, prompt: summary })
  }, [allAnswered, submitted, questions, selections, onSubmitAction])

  // Stable preview: true if ANY question has preview
  const hasPreview = questions.some((q) => q.preview === true)
  const currentQ = questions[activeTab]

  // Preview content for current selection
  const getPreviewContent = useCallback(() => {
    if (!currentQ?.preview) return ''
    const sel = selections[activeTab]
    if (!sel) return ''
    if (sel.otherSelected && sel.otherText) {
      return `根据你的描述：\n\n"${sel.otherText}"\n\nAI 将据此生成。`
    }
    if (sel.selectedIndices.size > 0) {
      const idx = Array.from(sel.selectedIndices)[0]
      const opt = currentQ?.options[idx]
      return opt?.previewContent || ''
    }
    return ''
  }, [activeTab, selections, currentQ])

  const summaryParts: string[] = []
  if (submitted) {
    questions.forEach((q, i) => {
      summaryParts.push(getDisplayValue(q, selections[i]))
    })
  }

  return (
    <div style={S.container}>
      {/* Chips bar */}
      <div style={S.chipsBar}>
        {questions.map((q, i) => {
          const answered = isAnswered(selections[i])
          const isActive = activeTab === i
          const val = answered ? getDisplayValue(q, selections[i]) : ''
          return (
            <div
              key={i}
              className={`auq-chip${submitted ? ' auq-chip--submitted' : ''}`}
              onClick={() => { if (!submitted) setActiveTab(i) }}
              style={{
                ...S.chip,
                ...(isActive ? S.chipActive : {}),
                ...(submitted ? { pointerEvents: 'none' as const, color: 'var(--t3)' } : {}),
                ...(submitted && isActive ? { color: 'var(--success-t)' } : {}),
              }}
            >
              <span style={{
                ...S.chipDot,
                ...(answered ? { background: 'var(--success-t)' } : {}),
              }} />
              <span>{q.header || `Q${i + 1}`}</span>
              {answered && val && <span style={S.chipVal}>{val}</span>}
            </div>
          )
        })}
      </div>

      {/* Body — grid stack for fixed height */}
      <div style={{
        ...S.body,
        ...(hasPreview ? { gridTemplateColumns: '1fr 1fr' } : {}),
      }}>
        {questions.map((q, qi) => {
          const sel = selections[qi]
          const isVis = activeTab === qi
          return (
            <div
              key={qi}
              style={{
                ...S.panel,
                opacity: isVis ? 1 : 0,
                pointerEvents: isVis ? 'auto' as const : 'none' as const,
              }}
            >
              <div style={S.questionText}>{q.question}</div>
              {q.hint && <div style={S.hintText}>{q.hint}</div>}

              <div style={S.optsList}>
                {q.options.map((opt, oi) => {
                  const isSelected = sel.selectedIndices.has(oi)
                  return (
                    <div
                      key={oi}
                      className={`auq-opt${isSelected ? ' auq-opt--selected' : ''}${submitted ? ' auq-opt--submitted' : ''}`}
                      onClick={() => handleOptClick(qi, oi)}
                      style={{
                        ...S.opt,
                        ...(isSelected && !submitted ? S.optSelected : {}),
                        ...(isSelected && submitted ? S.optSubmittedSelected : {}),
                        ...(!isSelected && submitted ? { opacity: 0.3, cursor: 'default', pointerEvents: 'none' as const } : {}),
                        ...(submitted ? { cursor: 'default', pointerEvents: 'none' as const } : {}),
                      }}
                    >
                      <div style={{
                        ...S.indicator,
                        ...(q.multiSelect ? S.indicatorCheckbox : {}),
                        ...(isSelected && !submitted ? S.indicatorSelected : {}),
                        ...(isSelected && submitted ? S.indicatorSubmittedSelected : {}),
                      }}>
                        {isSelected && (
                          q.multiSelect
                            ? <CheckmarkIcon />
                            : <div style={S.indicatorInner} />
                        )}
                      </div>
                      <div style={S.optBody}>
                        <div style={S.optLabel}>
                          {cleanLabel(opt.label)}
                          {isRecommendedOpt(opt) && <span style={S.recBadge}>推荐</span>}
                        </div>
                        {opt.description && <div style={S.optDesc}>{opt.description}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Other area */}
              <div
                className={`auq-other${sel.otherSelected ? ' auq-other--selected' : ''}${submitted ? ' auq-opt--submitted' : ''}`}
                onClick={() => handleOtherClick(qi)}
                style={{
                  ...S.otherWrap,
                  ...(sel.otherSelected && !submitted ? S.otherSelected : {}),
                  ...(sel.otherSelected && submitted ? S.otherSubmittedSelected : {}),
                  ...(!sel.otherSelected && submitted ? { opacity: 0.3, cursor: 'default', pointerEvents: 'none' as const } : {}),
                  ...(submitted ? { cursor: 'default', pointerEvents: 'none' as const } : {}),
                  marginTop: 6,
                }}
              >
                <div style={{
                  ...S.indicator,
                  ...(q.multiSelect ? S.indicatorCheckbox : {}),
                  ...(sel.otherSelected && !submitted ? S.indicatorSelected : {}),
                  ...(sel.otherSelected && submitted ? S.indicatorSubmittedSelected : {}),
                }}>
                  {sel.otherSelected && (
                    q.multiSelect
                      ? <CheckmarkIcon />
                      : <div style={S.indicatorInner} />
                  )}
                </div>
                <div style={S.otherBody}>
                  <div style={S.otherLabel}>或者自定义</div>
                  <input
                    ref={(el) => { otherInputRefs.current[qi] = el }}
                    className="auq-other-input"
                    style={{
                      ...S.otherInput,
                      ...(submitted ? { pointerEvents: 'none' as const, opacity: 0.7 } : {}),
                    }}
                    placeholder="输入自定义内容..."
                    value={sel.otherText}
                    onChange={(e) => handleOtherInput(qi, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    readOnly={submitted}
                  />
                </div>
              </div>
            </div>
          )
        })}

        {/* Preview pane — only renders content when current question has preview */}
        {hasPreview && (
          <div style={S.previewPane}>
            <div style={S.previewLabel}>结构预览</div>
            <pre style={S.previewContent}>{getPreviewContent()}</pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        ...S.footer,
        ...(submitted ? { background: 'var(--success-bg)' } : {}),
      }}>
        {!submitted && (
          <>
            <div style={S.progressText}>
              <span style={S.progressDone}>{answeredCount}</span> / {questions.length} 已回答
            </div>
            <button
              className="auq-btn"
              style={{
                ...S.submitBtn,
                ...(allAnswered ? {} : S.submitBtnDisabled),
              }}
              disabled={!allAnswered}
              onClick={handleSubmit}
            >
              确认选择
            </button>
          </>
        )}
        {submitted && (
          <div style={{ fontSize: 11, color: 'var(--success-t)', fontWeight: 500 }}>
            ✓ {summaryParts.join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Checkmark SVG for checkbox ─── */
function CheckmarkIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{ display: 'block' }}>
      <path d="M1 4L3.5 6.5L9 1" stroke="var(--bg1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ─── Test Harness (standalone, no ChatCore dependency) ─── */
const TEST_QUESTIONS_STANDARD: Question[] = [
  {
    question: '希望生成哪种题型？',
    header: '题型',
    multiSelect: false,
    options: [
      { label: '混合出题', description: '选择题 + 填空题 + 解答题，题型多样，区分度好', recommended: true, value: '混合出题' },
      { label: '选择题', description: '全部单选，适合快速作答和批改', value: '选择题' },
      { label: '填空题', description: '考查计算和推理能力', value: '填空题' },
      { label: '解答题', description: '考查完整证明过程', value: '解答题' },
    ],
  },
  {
    question: '难度设置偏好？',
    header: '难度',
    multiSelect: false,
    options: [
      { label: '分层', description: '基础 + 中等 + 较难，有梯度', recommended: true, value: '分层' },
      { label: '基础', description: '基本概念和直接应用', value: '基础' },
      { label: '中等', description: '需要分析和推理', value: '中等' },
      { label: '较难', description: '综合运用，较强逻辑推理', value: '较难' },
    ],
  },
  {
    question: '出多少题？',
    header: '题量',
    multiSelect: false,
    options: [
      { label: '5 题', description: '课堂小测，约 15 分钟', recommended: true, value: '5 题' },
      { label: '10 题', description: '单元练习，约 30 分钟', value: '10 题' },
      { label: '20 题', description: '正式测试，约 45 分钟', value: '20 题' },
    ],
  },
]

const TEST_QUESTIONS_MULTISELECT: Question[] = [
  {
    question: '报告周期？',
    header: '周期',
    multiSelect: false,
    options: [
      { label: '本周', description: '第 14 周数据', recommended: true, value: '本周' },
      { label: '近两周', description: '第 13~14 周对比', value: '近两周' },
      { label: '本月', description: '整月汇总', value: '本月' },
    ],
  },
  {
    question: '包含哪些分析维度？',
    header: '维度',
    hint: '可多选',
    multiSelect: true,
    options: [
      { label: '知识点掌握度', description: '按知识点统计正确率分布', value: '知识点掌握度' },
      { label: '完成率趋势', description: '作业完成率变化曲线', value: '完成率趋势' },
      { label: '个人排名变化', description: '学生成绩排名波动', value: '个人排名变化' },
      { label: '错题 Top 10', description: '全班错误率最高的题目', value: '错题 Top 10' },
    ],
  },
]

const TEST_QUESTIONS_PREVIEW: Question[] = [
  {
    question: '选择教案结构',
    header: '教案结构',
    multiSelect: false,
    preview: true,
    options: [
      {
        label: '标准新授课', description: '完整教学流程', recommended: true, value: '标准新授课',
        previewContent: '## 标准新授课模板\n\n├─ 教学目标\n│  └─ 知识、能力、情感\n├─ 重点与难点\n├─ 教学过程 [时间线]\n│  ├─ 复习导入 (5 min)\n│  ├─ 新知讲授 (15 min)\n│  ├─ 例题精讲 (10 min)\n│  ├─ 课堂练习 (10 min)\n│  └─ 小结作业 (5 min)\n├─ 课堂练习 [表格]\n├─ 板书设计\n└─ 课后反思',
      },
      {
        label: '复习课', description: '知识梳理 + 练习', value: '复习课',
        previewContent: '## 复习课模板\n\n├─ 复习目标\n├─ 知识网络图\n│  └─ 本单元知识点关系\n├─ 易错题精讲\n│  ├─ 典型错误分析\n│  └─ 归因与纠正\n├─ 当堂检测 [表格]\n│  └─ 基础 + 提升\n└─ 查漏补缺建议',
      },
      {
        label: '练习课', description: '精讲精练为主', value: '练习课',
        previewContent: '## 练习课模板\n\n├─ 练习目标\n├─ 分层练习 [时间线]\n│  ├─ 基础巩固 (10 min)\n│  ├─ 能力提升 (15 min)\n│  └─ 拓展挑战 (10 min)\n├─ 典型错题讲评\n└─ 课后分层作业',
      },
    ],
  },
]

export function AuqTestHarness() {
  const [submittedValues, setSubmittedValues] = useState<Record<string, string>>({})
  const mockSubmit = useCallback((action: { label: string; prompt: string }) => {
    setSubmittedValues((prev) => ({ ...prev, [action.label]: action.prompt }))
  }, [])

  return (
    <div style={{ padding: 24, background: 'var(--bg3)', minHeight: '100vh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 680 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t2)', marginBottom: 8 }}>AskUserQuestion Widget — Test Harness</div>

        {/* Example 1: Standard 3 questions */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: 0.3, marginBottom: 10 }}>
            标准模式: 三个问题，推荐项默认选中，单选自动跳下一题
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--rl)', padding: 16, border: '0.5px solid var(--b1)' }}>
            <div style={{ fontSize: 14, color: 'var(--t1)', marginBottom: 8 }}>好的，确认几个偏好：</div>
            <InteractiveViewInner questions={TEST_QUESTIONS_STANDARD} onSubmitAction={mockSubmit} />
          </div>
        </div>

        {/* Example 2: Multi-select */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: 0.3, marginBottom: 10 }}>
            多选: checkbox + Other 打字自动勾选
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--rl)', padding: 16, border: '0.5px solid var(--b1)' }}>
            <div style={{ fontSize: 14, color: 'var(--t1)', marginBottom: 8 }}>生成周报前确认：</div>
            <InteractiveViewInner questions={TEST_QUESTIONS_MULTISELECT} onSubmitAction={mockSubmit} />
          </div>
        </div>

        {/* Example 3: Preview split */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t3)', textTransform: 'uppercase' as const, letterSpacing: 0.3, marginBottom: 10 }}>
            Preview 模式: 左选项 + 右预览，固定高度
          </div>
          <div style={{ background: 'var(--bg2)', borderRadius: 'var(--rl)', padding: 16, border: '0.5px solid var(--b1)' }}>
            <div style={{ fontSize: 14, color: 'var(--t1)', marginBottom: 8 }}>选择教案结构：</div>
            <InteractiveViewInner questions={TEST_QUESTIONS_PREVIEW} onSubmitAction={mockSubmit} />
          </div>
        </div>

        {/* Submitted log */}
        {Object.keys(submittedValues).length > 0 && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--success-bg)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--success-t)' }}>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>提交记录:</div>
            {Object.entries(submittedValues).map(([k], i) => (
              <div key={i}>✓ {k}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Style constants (matching HTML prototype exactly) ─── */
const S = {
  container: {
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--rl)',
    background: 'var(--bg1)',
    margin: '10px 0',
    overflow: 'hidden' as const,
  },

  /* Chips bar */
  chipsBar: {
    display: 'flex',
    gap: 4,
    padding: '10px 14px',
    borderBottom: '0.5px solid var(--b1)',
    background: 'var(--bg2)',
    flexWrap: 'wrap' as const,
  },
  chip: {
    padding: '5px 12px',
    fontSize: 12,
    color: 'var(--t3)',
    cursor: 'pointer',
    borderRadius: 20,
    border: '0.5px solid transparent',
    transition: 'all 0.15s',
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    whiteSpace: 'nowrap' as const,
    fontFamily: 'inherit',
    background: 'transparent',
  },
  chipActive: {
    color: 'var(--t1)',
    background: 'var(--bg1)',
    borderColor: 'var(--b1)',
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    background: 'var(--t3)',
    transition: 'background 0.15s',
  },
  chipVal: {
    fontSize: 10,
    color: 'var(--t3)',
    maxWidth: 80,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    whiteSpace: 'nowrap' as const,
  },

  /* Body / panels */
  body: {
    display: 'grid',
    gridTemplateColumns: '1fr',
  },
  panel: {
    gridRow: 1,
    gridColumn: 1,
    padding: 14,
    transition: 'opacity 0.15s',
  },

  /* Question text */
  questionText: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--t1)',
    marginBottom: 4,
  },
  hintText: {
    fontSize: 11,
    color: 'var(--t3)',
    marginBottom: 10,
  },

  /* Options list */
  optsList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
    marginTop: 10,
  },

  /* Option card */
  opt: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    border: '0.5px solid var(--b1)',
    borderRadius: 'var(--r)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    background: 'var(--bg1)',
  },
  optSelected: {
    borderColor: 'var(--info-t)',
    background: 'var(--info-bg)',
  },
  optSubmittedSelected: {
    borderColor: 'var(--success-t)',
    background: 'var(--success-bg)',
  },

  /* Indicator */
  indicator: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: '1.5px solid var(--t3)',
    flexShrink: 0,
    marginTop: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
  },
  indicatorCheckbox: {
    borderRadius: 4,
  },
  indicatorSelected: {
    borderColor: 'var(--info-t)',
    background: 'var(--info-t)',
  },
  indicatorSubmittedSelected: {
    borderColor: 'var(--success-t)',
    background: 'var(--success-t)',
  },
  indicatorInner: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--bg1)',
  },

  /* Option body */
  optBody: {
    flex: 1,
    minWidth: 0,
  },
  optLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--t1)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  optDesc: {
    fontSize: 11,
    color: 'var(--t2)',
    lineHeight: '1.5',
    marginTop: 2,
  },

  /* Recommended badge */
  recBadge: {
    fontSize: 10,
    padding: '2px 6px',
    borderRadius: 6,
    background: 'var(--success-bg)',
    color: 'var(--success-t)',
    fontWeight: 500,
  },

  /* Other area */
  otherWrap: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 12px',
    border: '0.5px dashed var(--b1)',
    borderRadius: 'var(--r)',
    transition: 'all 0.15s',
    background: 'var(--bg1)',
    cursor: 'pointer',
  },
  otherSelected: {
    borderColor: 'var(--info-t)',
    borderStyle: 'solid',
    background: 'var(--info-bg)',
  },
  otherSubmittedSelected: {
    borderColor: 'var(--success-t)',
    borderStyle: 'solid',
    background: 'var(--success-bg)',
  },
  otherBody: {
    flex: 1,
    minWidth: 0,
  },
  otherLabel: {
    fontSize: 11,
    color: 'var(--t3)',
    marginBottom: 4,
  },
  otherInput: {
    width: '100%',
    padding: '7px 10px',
    border: '0.5px solid var(--b1)',
    borderRadius: 6,
    fontSize: 12,
    background: 'var(--bg1)',
    color: 'var(--t1)',
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s',
    boxSizing: 'border-box' as const,
  },

  /* Preview */
  previewPane: {
    gridColumn: 2,
    gridRow: 1,
    borderLeft: '0.5px solid var(--b1)',
    background: 'var(--bg2)',
    padding: 14,
    overflow: 'auto' as const,
  },
  previewLabel: {
    fontFamily: '-apple-system, "SF Pro Text", sans-serif',
    fontSize: 10,
    color: 'var(--t3)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
    marginBottom: 8,
    fontWeight: 500,
  },
  previewContent: {
    fontFamily: '"SF Mono", Menlo, monospace',
    fontSize: 11,
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap' as const,
    color: 'var(--t1)',
    margin: 0,
    background: 'transparent',
    border: 'none',
    padding: 0,
  },

  /* Footer */
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderTop: '0.5px solid var(--b1)',
  },
  progressText: {
    fontSize: 11,
    color: 'var(--t3)',
  },
  progressDone: {
    color: 'var(--success-t)',
    fontWeight: 500,
  },
  submitBtn: {
    fontSize: 12,
    padding: '7px 18px',
    borderRadius: 'var(--r)',
    cursor: 'pointer',
    border: 'none',
    background: 'var(--t1)',
    color: 'var(--bg1)',
    fontFamily: 'inherit',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  submitBtnDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
} as const
