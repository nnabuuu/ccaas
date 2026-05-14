import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import type { TaskExercise } from '../task-data'
import type { TextOverlay } from '../TextPanel'
import SelectEvidenceGuide from './SelectEvidenceGuide'
import { readGuideSeen, markGuideSeen } from './guide-helpers'

interface SectionState {
  stage: 'pick' | 'evidence' | 'graded'
  funcChoice: string | null
  funcWrong: boolean
  picked: Set<string>
  showHint: boolean
}

interface Props {
  exercise: TaskExercise
  onOverlayChange: (overlay: TextOverlay | null) => void
  onSubmit: (data: Record<string, any>) => void
  onDone: () => void
  reviewData?: Record<string, any>
}

function md(t: string | undefined) {
  if (!t) return null
  const parts: (string | JSX.Element)[] = []
  let rest = t
  let key = 0
  while (rest.includes('**')) {
    const a = rest.indexOf('**')
    const b = rest.indexOf('**', a + 2)
    if (b === -1) break
    if (a > 0) parts.push(rest.slice(0, a))
    parts.push(<strong key={'b' + key++}>{rest.slice(a + 2, b)}</strong>)
    rest = rest.slice(b + 2)
  }
  if (rest) parts.push(rest)
  return <>{parts}</>
}

export function SelectEvidenceExercise({ exercise, onOverlayChange, onSubmit, onDone, reviewData }: Props) {
  const sections = exercise.sections!
  const funcOptions = exercise.functionOptions!
  const paragraphTokens = exercise.paragraphTokens!

  const funcAttemptsRef = useRef<Record<string, number>>({})
  const firstGradeRef = useRef<Record<string, { function: string; picked: string[]; funcAttempts: number }>>({})

  const [secStates, setSecStates] = useState<Record<string, SectionState>>(() => {
    const init: Record<string, SectionState> = {}
    sections.forEach(s => {
      const rd = reviewData?.sections?.[s.id]
      if (reviewData) {
        init[s.id] = { stage: 'graded', funcChoice: rd?.function ?? null, funcWrong: false, picked: new Set(rd?.picked || []), showHint: false }
      } else {
        init[s.id] = { stage: 'pick', funcChoice: null, funcWrong: false, picked: new Set(), showHint: false }
      }
    })
    return init
  })
  const [currentId, setCurrentId] = useState(sections[0].id)
  const [correctFlash, setCorrectFlash] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const guideSeen = useRef(readGuideSeen('guide-seen-se'))
  const [shakeKey, setShakeKey] = useState(0)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const current = sections.find(s => s.id === currentId)!
  const state = secStates[currentId]

  const updateState = useCallback((id: string, partial: Partial<SectionState>) => {
    setSecStates(prev => ({ ...prev, [id]: { ...prev[id], ...partial } }))
  }, [])

  // const allGraded = sections.every(s => secStates[s.id].stage === 'graded')
  const currentIdRef = useRef(currentId)
  useEffect(() => { currentIdRef.current = currentId }, [currentId])

  // Build overlay for TextPanel
  useEffect(() => {
    const tokens: Record<number, Array<{ t: string; kind?: string }>> = {}
    for (const [pNum, tks] of Object.entries(paragraphTokens)) {
      tokens[parseInt(pNum)] = tks
    }

    const tokenStates: Record<string, 'idle' | 'picked' | 'good' | 'bad' | 'missed'> = {}

    // Set states for the current section's paragraphs
    current.range.forEach(pn => {
      const tks = paragraphTokens[String(pn)]
      if (!tks) return
      tks.forEach((tk, i) => {
        const key = `${pn}:${i}`
        if (!tk.kind) return
        const isPicked = state.picked.has(key)
        if (state.stage === 'graded') {
          if (isPicked && tk.kind === 'evidence') tokenStates[key] = 'good'
          else if (isPicked && tk.kind !== 'evidence') tokenStates[key] = 'bad'
          else if (!isPicked && tk.kind === 'evidence') tokenStates[key] = 'missed'
          else tokenStates[key] = 'idle'
        } else if (state.stage === 'evidence') {
          tokenStates[key] = isPicked ? 'picked' : 'idle'
        } else {
          tokenStates[key] = 'idle'
        }
      })
    })

    // Also set states for already-graded sections (show green for found evidence)
    sections.forEach(s => {
      if (s.id === currentId) return
      const ss = secStates[s.id]
      if (ss.stage !== 'graded') return
      s.range.forEach(pn => {
        const tks = paragraphTokens[String(pn)]
        if (!tks) return
        tks.forEach((tk, i) => {
          if (!tk.kind) return
          const key = `${pn}:${i}`
          const isPicked = ss.picked.has(key)
          if (isPicked && tk.kind === 'evidence') tokenStates[key] = 'good'
        })
      })
    })

    const overlay: TextOverlay = {
      tokens,
      activeParagraphs: state.stage === 'pick' ? [] : current.range,
      tokenStates,
      onTokenClick: (state.stage === 'evidence' && !reviewData) ? (paraNum, tokenIdx) => {
        const tks = paragraphTokens[String(paraNum)]
        if (!tks || !current.range.includes(paraNum)) return
        const tk = tks[tokenIdx]
        if (!tk?.kind) return
        const key = `${paraNum}:${tokenIdx}`
        const cid = currentIdRef.current
        setSecStates(prev => {
          const s = prev[cid]
          const ns = new Set(s.picked)
          if (ns.has(key)) ns.delete(key); else ns.add(key)
          return { ...prev, [cid]: { ...s, picked: ns } }
        })
      } : undefined,
    }
    onOverlayChange(overlay)
  }, [currentId, state.stage, state.picked, secStates, sections, current, paragraphTokens, onOverlayChange])

  // Cleanup overlay + flash timer on unmount
  useEffect(() => () => {
    onOverlayChange(null)
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
  }, [onOverlayChange])

  const grade = () => {
    if (reviewData) return
    const nextStates = {
      ...secStates,
      [currentId]: { ...secStates[currentId], stage: 'graded' as const },
    }
    setSecStates(nextStates)

    const completed: Record<string, { function: string; picked: string[] }> = {}
    const firstAttemptSections: Record<string, { function: string; picked: string[]; funcAttempts: number }> = {}
    sections.forEach(s => {
      const ss = nextStates[s.id]
      if (ss.stage === 'graded') {
        completed[s.id] = { function: ss.funcChoice!, picked: Array.from(ss.picked) }
        if (!firstGradeRef.current[s.id]) {
          firstGradeRef.current[s.id] = {
            function: ss.funcChoice!,
            picked: Array.from(ss.picked),
            funcAttempts: funcAttemptsRef.current[s.id] || 1,
          }
        }
      }
    })
    for (const [id, fa] of Object.entries(firstGradeRef.current)) {
      firstAttemptSections[id] = fa
    }
    onSubmit({ sections: completed, firstAttemptSections })

    if (sections.every(s => nextStates[s.id].stage === 'graded')) {
      onDone()
    }
  }
  const retry = () => { if (!reviewData) updateState(currentId, { stage: 'evidence', picked: new Set(), showHint: false }) }

  // Feedback computation
  const feedback = useMemo(() => {
    if (state.stage !== 'graded') return null
    let hit = 0
    let totalEv = 0
    const wrongPicks: Array<{ phrase: string; why: string; p: number }> = []
    const missed: Array<{ phrase: string; why: string; p: number }> = []

    current.range.forEach(pn => {
      const tks = paragraphTokens[String(pn)]
      if (!tks) return
      tks.forEach((tk, i) => {
        const key = `${pn}:${i}`
        const isPicked = state.picked.has(key)
        if (tk.kind === 'evidence') {
          totalEv++
          if (isPicked) hit++
          else missed.push({ phrase: tk.t, why: tk.why || '', p: pn })
        } else if (isPicked && (tk.kind === 'distractor' || tk.kind === 'pick')) {
          wrongPicks.push({ phrase: tk.t, why: tk.why || 'Not a structural signal.', p: pn })
        }
      })
    })
    const minHits = Math.min(current.minHits ?? totalEv, totalEv)
    const passed = hit >= minHits
    const perfect = hit === totalEv && wrongPicks.length === 0
    return { wrongPicks, missed, hit, totalEv, perfect, passed }
  }, [state, current, paragraphTokens])

  // Why items list for graded view
  const whyItems = useMemo(() => {
    if (state.stage !== 'graded') return []
    const out: Array<{ good: boolean; picked: boolean; text: string; why: string }> = []
    current.range.forEach(pn => {
      const tks = paragraphTokens[String(pn)]
      if (!tks) return
      tks.forEach((tk, i) => {
        const key = `${pn}:${i}`
        const isPicked = state.picked.has(key)
        if (tk.kind === 'evidence') {
          out.push({ good: true, picked: isPicked, text: `"${tk.t}"`, why: tk.why || '' })
        } else if (isPicked && (tk.kind === 'distractor' || tk.kind === 'pick')) {
          out.push({ good: false, picked: true, text: `"${tk.t}"`, why: tk.why || 'Not a structural signal.' })
        }
      })
    })
    return out
  }, [state, current, paragraphTokens])

  return (
    <div className="se-root">
      {/* Section strip */}
      <div className="se-strip">
        {sections.map(s => {
          const ss = secStates[s.id]
          const done = ss.stage === 'graded'
          const isCurrent = s.id === currentId
          return (
            <button
              key={s.id}
              className={`se-strip-btn${isCurrent ? ' active' : ''}${done ? ' done' : ''}`}
              onClick={() => setCurrentId(s.id)}
            >
              <span>{s.label}{done && ' \u2713'}</span>
              <span className="se-strip-func">{done ? s.correctFunction : '\u2014'}</span>
            </button>
          )
        })}
      </div>

      {/* Section header */}
      <div className="se-card">
        <span className="se-range">Section &middot; {current.label}</span>
        <div className="se-title">What is this section's function?</div>
        <div className="se-help" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <span style={{ flex: 1 }}>First pick the function. Then <strong>locate the why</strong> by clicking the <strong>signal phrases</strong> in the text on the right.</span>
          <button
            className={`se-guide-btn${sections.every(s => secStates[s.id].stage === 'pick' && !secStates[s.id].funcChoice) && !guideOpen && !guideSeen.current ? ' pulse' : ''}`}
            aria-label="Select evidence guide"
            onClick={() => {
              setGuideOpen(true)
              markGuideSeen('guide-seen-se')
              guideSeen.current = true
            }}
          >?</button>
        </div>
      </div>

      {/* Step 1: Pick function */}
      <div className="se-step-label">
        <span className={`se-step-num${state.stage !== 'pick' ? ' done' : ''}`}>1</span>
        <span>Pick the function</span>
      </div>
      <div className="se-func-row">
        {funcOptions.map(f => {
          const sel = state.funcChoice === f
          const locked = state.stage !== 'pick'
          const isLockedRight = locked && f === current.correctFunction
          const isWrongPick = state.funcWrong && sel && f !== current.correctFunction
          let cls = 'se-func-btn'
          if (isLockedRight) cls += ' locked'
          else if (locked) cls += ' dim'
          else if (isWrongPick) cls += ' wrong shake'
          else if (sel && correctFlash === currentId) cls += ' correct-flash'
          else if (sel) cls += ' selected'
          return (
            <button
              key={isWrongPick ? `${f}-${shakeKey}` : f}
              className={cls}
              disabled={locked}
              onClick={() => {
                if (locked || reviewData || correctFlash) return
                funcAttemptsRef.current[currentId] = (funcAttemptsRef.current[currentId] || 0) + 1
                const targetId = currentId
                if (f === current.correctFunction) {
                  updateState(targetId, { funcChoice: f, funcWrong: false })
                  setCorrectFlash(targetId)
                  flashTimerRef.current = setTimeout(() => {
                    setCorrectFlash(null)
                    updateState(targetId, { stage: 'evidence', funcWrong: false })
                    flashTimerRef.current = null
                  }, 400)
                } else {
                  updateState(currentId, { funcChoice: f, funcWrong: true })
                  setShakeKey(k => k + 1)
                }
              }}
            >{f}</button>
          )
        })}
      </div>

      {state.stage === 'pick' && state.funcWrong && (
        <div className="se-wrong-hint">Not quite — look at the signal words in the text.</div>
      )}

      {/* Step 2: Locate evidence */}
      {state.stage !== 'pick' && (
        <div key={currentId + '-s2'} className="se-step2-enter">
          <div className="se-step-label" style={{ marginTop: 24 }}>
            <span className={`se-step-num${state.stage === 'graded' ? ' done' : ''}`}>2</span>
            <span>Locate the why</span>
          </div>

          {state.stage === 'evidence' && (
            <>
              <div className="se-ev-callout">
                <span className="se-ev-arrow">&rarr;</span>
                <div className="se-ev-text">
                  In the text on the right, click the <strong>phrases</strong> (underlined with dots) that prove this is <strong style={{ color: 'var(--teal)' }}>{current.correctFunction}</strong>.
                  <div className="se-ev-count">
                    {state.picked.size === 0
                      ? "Only structural signal phrases are clickable — connector words aren't."
                      : `${state.picked.size} phrase${state.picked.size > 1 ? 's' : ''} highlighted.`}
                  </div>
                </div>
              </div>

              <button className="se-hint-toggle" onClick={() => updateState(currentId, { showHint: !state.showHint })}>
                {state.showHint ? '\u25be' : '\u25b8'} {state.showHint ? 'Hide hint' : 'Stuck? Show hint'}
              </button>
              {state.showHint && current.hint && (
                <div className="se-hint-box">
                  {current.hint}
                  {current.hintZh && <div style={{ color: 'var(--t3)', fontStyle: 'italic', marginTop: 4 }}>{current.hintZh}</div>}
                </div>
              )}

              <div className="se-action-row" style={{ marginTop: 14 }}>
                <span className="se-tally">
                  {state.picked.size === 0 ? 'Click at least one phrase.' : 'Ready when you are.'}
                </span>
                <button className={`se-btn${state.picked.size === 0 ? ' off' : ''}`} disabled={state.picked.size === 0} onClick={grade}>
                  Check evidence
                </button>
              </div>
            </>
          )}

          {state.stage === 'graded' && feedback && (
            <>
              {/* AI feedback */}
              <div className="se-ai-box">
                <div className="se-ai-head">
                  <span className="se-ai-dot" />
                  <div className="se-ai-opener">
                    {feedback.perfect
                      ? md(current.aiCorrect)
                      : feedback.passed
                        ? md(current.aiPartial) || <>You found <strong>{feedback.hit} of {feedback.totalEv}</strong> signals — enough to move on.</>
                        : feedback.wrongPicks.length > 0
                          ? <>You found <strong>{feedback.hit} of {feedback.totalEv}</strong> signals — but a few of your picks aren't signals. Let me explain:</>
                          : <>You found <strong>{feedback.hit} of {feedback.totalEv}</strong> signals. {feedback.missed.length > 0 ? 'A few are still missing — check the dashed-underline phrases.' : ''}</>}
                  </div>
                </div>

                {!feedback.perfect && feedback.wrongPicks.map((w, i) => (
                  <div key={i} className="se-ai-note">
                    <span className="se-ai-quote">"{w.phrase}"</span>{' '}
                    <span style={{ color: 'var(--t3)' }}>({'\u00b6'}{w.p})</span> — {w.why}
                  </div>
                ))}

                {!feedback.perfect && feedback.wrongPicks.length === 0 && feedback.missed.length > 0 && (
                  <div className="se-ai-note" style={{ borderLeftColor: 'rgba(45,102,18,.3)' }}>
                    Look for: <span className="se-ai-quote">"{feedback.missed[0].phrase}"</span> in {'\u00b6'}{feedback.missed[0].p} — {feedback.missed[0].why}
                  </div>
                )}
              </div>

              {/* Why list */}
              <div className="se-why-list">
                <div className="se-why-header">All signals in this section</div>
                {whyItems.map((it, i) => (
                  <div key={i} className={`se-why-item${i === whyItems.length - 1 ? ' last' : ''}`}>
                    <span className={`se-why-dot ${it.good ? 'good' : 'bad'}`}>
                      {it.good ? (it.picked ? '\u2713' : '+') : '\u2717'}
                    </span>
                    <div>
                      <span style={{ fontWeight: 600, color: it.good ? 'var(--t1)' : 'var(--t3)' }}>{it.text}</span>
                      <span style={{ color: 'var(--t2)' }}> — {it.why}</span>
                      {!it.picked && it.good && <span style={{ color: 'var(--t3)', marginLeft: 6, fontStyle: 'italic' }}>(missed)</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="se-action-row" style={{ marginTop: 12 }}>
                <span className={`se-tally${feedback.passed ? ' ok' : ''}`}>
                  {feedback.perfect
                    ? `Perfect — ${feedback.hit}/${feedback.totalEv} signals.`
                    : feedback.passed
                      ? `${feedback.hit}/${feedback.totalEv} signals — enough to move on.`
                      : `${feedback.hit}/${feedback.totalEv} signals \u00b7 ${feedback.wrongPicks.length} non-signals picked.`}
                </span>
                {!feedback.passed && !reviewData && (
                  <button className="se-btn-ghost" onClick={retry}>Try again</button>
                )}
                {feedback.passed && !feedback.perfect && !reviewData && (
                  <button className="se-btn-ghost" onClick={retry}>Try for full marks</button>
                )}
                {feedback.passed && (() => {
                  const nextSec = sections.find(s => secStates[s.id].stage !== 'graded')
                  return nextSec
                    ? <button className="se-btn" onClick={() => setCurrentId(nextSec.id)}>Next section &rarr;</button>
                    : <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: 12 }}>All {sections.length} done {'\u2713'}</span>
                })()}
              </div>
            </>
          )}
        </div>
      )}
      <SelectEvidenceGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  )
}
