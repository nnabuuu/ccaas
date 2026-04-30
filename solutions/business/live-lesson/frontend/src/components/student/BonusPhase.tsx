import { useState, useEffect, useContext, useCallback } from 'react'
import { SessionCtx } from './TaskPanel'
import { MatchExercise } from './exercises/MatchExercise'
import { MatrixExercise } from './exercises/MatrixExercise'
import type { CheckResult } from '../../hooks/useClassroom'

interface BonusArticle {
  title: string
  paragraphs: Array<{ id: string; text: string; role: string }>
}

interface BonusExerciseSpec {
  type: string
  pairs?: Array<{ idx: number; left: string; options: string[] }>
  rows?: Array<{ place: string; practice?: string; reason?: string; isDemo: boolean }>
  [key: string]: unknown
}

interface BonusExerciseData {
  exercise: BonusExerciseSpec
  article: BonusArticle | null
  label: string
  strategy: string
}

export function BonusPhase({ onComplete }: { onComplete: () => void }) {
  const ctx = useContext(SessionCtx)
  const [bonusStep, setBonusStep] = useState(1)
  const [exerciseData, setExerciseData] = useState<BonusExerciseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [ans, setAns] = useState<Record<string, any>>({})
  const [correctQs, setCorrectQs] = useState<Set<number>>(new Set())
  const [wrongQs, setWrongQs] = useState<Set<number>>(new Set())
  const [attempts, setAttempts] = useState<Record<number, any[]>>({})
  const [allDone, setAllDone] = useState(false)
  const [complete, setComplete] = useState(false)

  const fetchExercise = useCallback((step: number) => {
    if (!ctx.sessionCode) return
    setLoading(true)
    setAns({})
    setCorrectQs(new Set())
    setWrongQs(new Set())
    setAttempts({})
    setAllDone(false)
    fetch(`/api/classroom/${ctx.sessionCode}/bonus/${step}/exercise`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setExerciseData(d) })
      .finally(() => setLoading(false))
  }, [ctx.sessionCode])

  useEffect(() => { fetchExercise(bonusStep) }, [bonusStep, fetchExercise])

  const handleCheck = async () => {
    if (!ctx.sessionCode || !ctx.studentId || !exerciseData) return

    const submitData = exerciseData.exercise.type === 'match'
      ? { answers: Object.entries(ans).map(([idx, val]) => ({ idx: Number(idx), selected: val })) }
      : { rows: ans.rows || [] }

    let result: CheckResult
    try {
      const res = await fetch(`/api/classroom/${ctx.sessionCode}/bonus/${bonusStep}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: ctx.studentId, data: submitData }),
      })
      if (!res.ok) return
      result = await res.json()
    } catch {
      return
    }

    if (result.allCorrect) {
      setAllDone(true)
      if (bonusStep === 2) {
        setComplete(true)
      }
    } else if (exerciseData.exercise.type === 'match') {
      const newCorrect = new Set(correctQs)
      const newWrong = new Set<number>()
      const newAttempts = { ...attempts }
      result.items.forEach(item => {
        const idx = typeof item.idx === 'number' ? item.idx : parseInt(String(item.idx), 10)
        if (!newAttempts[idx]) newAttempts[idx] = []
        newAttempts[idx].push({ selected: ans[idx], isCorrect: item.correct, ts: Date.now() })
        if (item.correct) newCorrect.add(idx); else newWrong.add(idx)
      })
      setCorrectQs(newCorrect)
      setWrongQs(newWrong)
      setAttempts(newAttempts)
      if (newWrong.size > 0) {
        const cleared = { ...ans }
        newWrong.forEach(qi => { delete cleared[qi] })
        setAns(cleared)
      }
    }
  }

  const handleNext = () => {
    if (bonusStep === 1) {
      setBonusStep(2)
    } else {
      onComplete()
    }
  }

  if (loading) {
    return (
      <div className="stu-task-inner" style={{ paddingTop: 32 }}>
        <div style={{ height: 200, borderRadius: 12, background: 'var(--bg2)', animation: 'pulse 1.2s ease-in-out infinite' }} />
      </div>
    )
  }

  if (!exerciseData) {
    return (
      <div className="stu-task-inner" style={{ paddingTop: 32 }}>
        <p style={{ color: 'var(--t3)' }}>Could not load bonus exercise.</p>
        <button className="stu-btn pri" onClick={onComplete}>Skip to Summary →</button>
      </div>
    )
  }

  if (complete) {
    return (
      <div className="stu-task-inner" style={{ paddingTop: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--t1)' }}>Bonus Complete!</div>
        <p style={{ color: 'var(--t2)', marginBottom: 20 }}>You've successfully applied your reading strategies to a new article.</p>
        <button className="stu-btn pri" onClick={onComplete}>Finish →</button>
      </div>
    )
  }

  const ex = exerciseData.exercise

  return (
    <div className="stu-task-inner" style={{ paddingTop: 24 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>
        Bonus Step {bonusStep} · {exerciseData.strategy}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.3px', marginBottom: 16, color: 'var(--t1)' }}>
        {exerciseData.label}
      </div>

      {/* Article display */}
      {exerciseData.article && (
        <div style={{ marginBottom: 20, padding: '14px 16px', background: 'var(--bg2)', borderRadius: 12, maxHeight: 240, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--t1)' }}>
            📖 {exerciseData.article.title}
          </div>
          {exerciseData.article.paragraphs.map((p, i) => (
            <p key={p.id} style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--t2)', marginBottom: i < exerciseData.article!.paragraphs.length - 1 ? 10 : 0 }}>
              <span style={{ color: 'var(--t3)', fontSize: 11 }}>¶{i + 1} </span>{p.text}
            </p>
          ))}
        </div>
      )}

      {/* Exercise */}
      <div style={{ marginBottom: 16 }}>
        <div className="stu-section-label"><span>Practice</span><div className="stu-section-line" /></div>
        {ex.type === 'match' && (
          <MatchExercise
            pairs={ex.pairs}
            ans={ans}
            setAns={setAns}
            correctQs={correctQs}
            wrongQs={wrongQs}
            attempts={attempts}
            allDone={allDone}
          />
        )}
        {ex.type === 'matrix' && (
          <MatrixExercise
            rows={ex.rows}
            ans={ans}
            setAns={setAns}
            allDone={allDone}
          />
        )}
      </div>

      {!allDone && (
        <button className="stu-btn pri" onClick={handleCheck} disabled={
          ex.type === 'match' ? (ex.pairs || []).some((_: any, i: number) => !correctQs.has(i) && ans[i] === undefined) : false
        }>
          Check →
        </button>
      )}
      {allDone && (
        <button className="stu-btn pri" onClick={handleNext}>
          {bonusStep === 1 ? 'Next Step →' : 'Finish →'}
        </button>
      )}
    </div>
  )
}
