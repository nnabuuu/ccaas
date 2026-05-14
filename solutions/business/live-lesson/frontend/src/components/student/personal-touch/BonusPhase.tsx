import { useState, useEffect, useContext, useCallback } from 'react'
import { SessionCtx } from '../TaskPanel'
import { MatchExercise } from '../exercise/MatchExercise'
import { MatrixExercise } from '../exercise/MatrixExercise'
import type { CheckResult, CachedSubmission } from '../../../hooks/useClassroom'
import { getSubmission } from '../../../hooks/useClassroom'

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

export function BonusPhase({ onComplete, reviewMode }: { onComplete: () => void; reviewMode?: boolean }) {
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
  const [checking, setChecking] = useState(false)
  const [savedSubs, setSavedSubs] = useState<Record<number, CachedSubmission>>({})

  // reviewMode: load previously submitted data for step 101 & 102
  useEffect(() => {
    if (!reviewMode || !ctx.sessionCode || !ctx.studentId) return
    let cancelled = false
    Promise.all([
      getSubmission(ctx.sessionCode, ctx.studentId, 101),
      getSubmission(ctx.sessionCode, ctx.studentId, 102),
    ]).then(([s1, s2]) => {
      if (cancelled) return
      const subs: Record<number, CachedSubmission> = {}
      if (s1) subs[1] = s1
      if (s2) subs[2] = s2
      setSavedSubs(subs)
    })
    return () => { cancelled = true }
  }, [reviewMode, ctx.sessionCode, ctx.studentId])

  // reviewMode: restore ans/correctQs from savedSubs when exerciseData loads
  useEffect(() => {
    if (!reviewMode) return
    const sub = savedSubs[bonusStep]
    if (!sub?.data || !exerciseData) return

    if (exerciseData.exercise.type === 'match') {
      const restored: Record<string, any> = {}
      const answers = (sub.data.answers as any[]) || []
      answers.forEach((a: any) => { restored[a.idx] = a.selected })
      setAns(restored)
      setCorrectQs(new Set((exerciseData.exercise.pairs || []).map((_: any, i: number) => i)))
    } else if (exerciseData.exercise.type === 'matrix') {
      const rowsArray = (sub.data.rows as Array<{ what?: string; why?: string }>) || []
      const restored: Record<number, any> = {}
      rowsArray.forEach((r, i) => { restored[i] = r })
      setAns(restored)
    }
    setAllDone(true)
  }, [reviewMode, savedSubs, bonusStep, exerciseData])

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
    if (!ctx.sessionCode || !ctx.studentId || !exerciseData || checking) return
    setChecking(true)

    const submitData = exerciseData.exercise.type === 'match'
      ? { answers: Object.entries(ans).map(([idx, val]) => ({ idx: Number(idx), selected: val })) }
      : { rows: (exerciseData.exercise.rows || []).map((_, i) => ans[i] || {}) }

    let result: CheckResult
    try {
      const res = await fetch(`/api/classroom/${ctx.sessionCode}/bonus/${bonusStep}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: ctx.studentId, data: submitData }),
      })
      if (!res.ok) { setChecking(false); return }
      result = await res.json()
    } catch {
      setChecking(false)
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
    setChecking(false)
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

  if (complete && !reviewMode) {
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
      <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8 }}>
        {reviewMode ? '📖 查看已提交的 Bonus 答案（只读）' : '💡 这是额外挑战，做不完也没关系 —— 随时可以结束。'}
      </div>
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
            pairs={ex.pairs! as any}
            ans={ans}
            setAns={reviewMode ? () => {} : setAns}
            correctQs={correctQs}
            wrongQs={wrongQs}
            attemptCount={(pi: number) => (attempts as any)?.[pi] ?? 0}
          />
        )}
        {ex.type === 'matrix' && (
          <MatrixExercise
            rows={ex.rows! as any}
            ans={ans as any}
            onAnsChange={reviewMode ? undefined : (ri, field, value) => {
              setAns(prev => ({
                ...prev,
                [ri]: { ...(prev[ri] || {}), [field]: value },
              }))
            }}
            disabled={reviewMode}
          />
        )}
      </div>

      {reviewMode ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {bonusStep === 1 && savedSubs[2] && (
            <button className="stu-btn pri" onClick={() => setBonusStep(2)}>Step 2 →</button>
          )}
          {bonusStep === 2 && (
            <button className="stu-btn ghost" onClick={() => setBonusStep(1)}>← Step 1</button>
          )}
          <button className="stu-btn ghost" onClick={onComplete}>← 返回总结</button>
        </div>
      ) : (
        <>
          {!allDone && (
            <button className="stu-btn pri" onClick={handleCheck} disabled={
              checking || (ex.type === 'match' ? (ex.pairs || []).some((_: any, i: number) => !correctQs.has(i) && ans[i] === undefined) : false)
            }>
              {checking ? 'Checking…' : 'Check →'}
            </button>
          )}
          {allDone && (
            <button className="stu-btn pri" onClick={handleNext}>
              {bonusStep === 1 ? 'Next Step →' : 'Finish →'}
            </button>
          )}
          {!allDone && (
            <button className="stu-btn ghost" style={{ marginTop: 12 }} onClick={onComplete} disabled={checking}>结束课程 →</button>
          )}
        </>
      )}
    </div>
  )
}
