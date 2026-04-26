import { useState, useContext } from 'react'
import { linkParas } from './utils/linkParas'
import { SessionCtx } from './TaskPanel'
import type { Task } from './task-data'
import { gradeItemSet, reportAttempt, formatSubmitData } from './exercises/gradeItemSet'
import { QuizExercise } from './exercises/QuizExercise'
import { MatchExercise } from './exercises/MatchExercise'
import { MatrixExercise } from './exercises/MatrixExercise'
import { StanceExercise } from './exercises/StanceExercise'
import { OrderExercise } from './exercises/OrderExercise'

export function PracticePhase({ task, onDone, stepIdx }: { task: Task; onDone: () => void; stepIdx?: number }) {
  const ctx = useContext(SessionCtx)
  const ex = task.exercise
  const [ans, setAns] = useState<Record<string, any>>({})
  const [attempts, setAttempts] = useState<Record<number, any[]>>({})
  const [wrongQs, setWrongQs] = useState<Set<number>>(new Set())
  const [correctQs, setCorrectQs] = useState<Set<number>>(new Set())
  const [allDone, setAllDone] = useState(false)
  const [softDone, setSoftDone] = useState(false)

  const canSub = () => {
    if (ex.type === 'quiz') return !ex.questions!.some((_, qi) => !correctQs.has(qi) && ans[qi] === undefined)
    if (ex.type === 'match') return !ex.pairs!.some((_, pi) => !correctQs.has(pi) && ans[pi] === undefined)
    if (ex.type === 'matrix') return true
    if (ex.type === 'stance') return ans.stance !== undefined && (ans.evidence || []).length >= 1
    if (ex.type === 'order') return (ans.order || []).length === ex.items!.length
    return true
  }

  const handleSubmit = () => {
    let attemptCounts: Record<number, number> | undefined
    if (ex.type === 'quiz' || ex.type === 'match') {
      const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
      attemptCounts = {}
      items.forEach((_, idx) => {
        if (correctQs.has(idx)) {
          attemptCounts![idx] = (attempts[idx] || []).length
        } else if (ans[idx] !== undefined) {
          attemptCounts![idx] = (attempts[idx] || []).length + 1
        }
      })
    }

    if (stepIdx !== undefined && ctx.submit) {
      ctx.submit(stepIdx, formatSubmitData(ex.type, ans, { attemptCounts }))
    }

    if (ex.type === 'quiz' || ex.type === 'match') {
      const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
      const result = gradeItemSet(items, ans, { correctQs, attempts }, task.id)
      setAttempts(result.attempts); setCorrectQs(result.correctQs); setWrongQs(result.wrongQs)
      if (result.wrongQs.size > 0) {
        const cleared = { ...ans }; result.wrongQs.forEach(qi => { delete cleared[qi] }); setAns(cleared)
      }
      if (result.allDone) { setAllDone(true); onDone() }
    } else if (ex.type === 'order') {
      const order = ans.order || []
      const isOk = order.every((idx: number, pos: number) => ex.correctOrder![pos] === idx)
      const newAttempts = { ...attempts }
      if (!newAttempts[0]) newAttempts[0] = []
      newAttempts[0].push({ selected: [...order], correct: ex.correctOrder, isCorrect: isOk, ts: Date.now() })
      reportAttempt(task.id, 0, newAttempts[0].length, order, ex.correctOrder, isOk)
      setAttempts(newAttempts)
      if (isOk) {
        setAllDone(true); onDone()
      } else {
        const wrong = new Set<number>()
        order.forEach((idx: number, pos: number) => { if (ex.correctOrder![pos] !== idx) wrong.add(pos) })
        setWrongQs(wrong); setAns({})
      }
    } else {
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, true)
      onDone()
    }
  }

  const attemptCount = (qi: number) => (attempts[qi] || []).length

  return (
    <div id="phase-practice">
      <div className="stu-section-label"><span>Practice</span><div className="stu-section-line" /></div>
      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>{linkParas(ex.label)}</div>

      {ex.type === 'quiz' && <QuizExercise questions={ex.questions!} ans={ans} setAns={setAns} correctQs={correctQs} wrongQs={wrongQs} attemptCount={attemptCount} />}
      {ex.type === 'match' && <MatchExercise pairs={ex.pairs!} ans={ans} setAns={setAns} correctQs={correctQs} wrongQs={wrongQs} attemptCount={attemptCount} />}
      {ex.type === 'matrix' && <MatrixExercise rows={ex.rows!} />}
      {ex.type === 'stance' && <StanceExercise stanceQ={ex.stanceQ!} stanceQZh={ex.stanceQZh} stanceOpts={ex.stanceOpts!} evidence={ex.evidence!} ans={ans} setAns={setAns} softDone={softDone} />}
      {ex.type === 'order' && <OrderExercise items={ex.items!} ans={ans} setAns={setAns} done={allDone} wrongPositions={wrongQs} attemptCount={(attempts[0] || []).length} />}

      {/* Submit/Done */}
      <div style={{ marginTop: 16 }}>
        {allDone ? (
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>✓</span>Practice complete!
          </div>
        ) : (
          <button
            className="stu-btn pri"
            style={!canSub() ? { opacity: 0.35, cursor: 'default' } : undefined}
            onClick={canSub() ? handleSubmit : undefined}
          >
            {Object.keys(attempts).length > 0 ? 'Try Again' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  )
}
