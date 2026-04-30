import { useState, useContext } from 'react'
import { linkParas } from './utils/linkParas'
import { SessionCtx } from './TaskPanel'
import type { Task, TaskExercise, ServerHintMap } from './task-data'
import type { TextOverlay } from './TextPanel'
import { gradeItemSet, reportAttempt, formatSubmitData } from './exercises/gradeItemSet'
import { checkAnswer, type CheckResult } from '../../hooks/useClassroom'
import { QuizExercise } from './exercises/QuizExercise'
import { MatchExercise } from './exercises/MatchExercise'
import { MatrixExercise } from './exercises/MatrixExercise'
import { StanceExercise } from './exercises/StanceExercise'
import { OrderExercise } from './exercises/OrderExercise'
import { SelectEvidenceExercise } from './exercises/SelectEvidenceExercise'
import { MapExercise } from './exercises/MapExercise'

export function PracticePhase({ task, onDone, stepIdx, onOverlayChange }: {
  task: Task; onDone: () => void; stepIdx?: number; onOverlayChange?: (overlay: TextOverlay | null) => void
}) {
  const ctx = useContext(SessionCtx)
  const ex = task.exercise
  const [ans, setAns] = useState<Record<string, any>>({})
  const [attempts, setAttempts] = useState<Record<number, any[]>>({})
  const [wrongQs, setWrongQs] = useState<Set<number>>(new Set())
  const [correctQs, setCorrectQs] = useState<Set<number>>(new Set())
  const [allDone, setAllDone] = useState(false)
  const [softDone, setSoftDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverHints, setServerHints] = useState<ServerHintMap>({})
  const [mapFeedback, setMapFeedback] = useState<string | null>(null)

  const canSub = () => {
    if (ex.type === 'quiz') return !ex.questions!.some((_, qi) => !correctQs.has(qi) && ans[qi] === undefined)
    if (ex.type === 'match') return !ex.pairs!.some((_, pi) => !correctQs.has(pi) && ans[pi] === undefined)
    if (ex.type === 'matrix') return true
    if (ex.type === 'stance') return ans.stance !== undefined && (ans.evidence || []).length >= 1
    if (ex.type === 'order') return (ans.order || []).length === ex.items!.length
    if (ex.type === 'select-evidence') return false // handled internally
    if (ex.type === 'map') {
      const items = ex.mapItems || []
      const pl = ans.placements || {}
      const rs = ans.reasons || {}
      const min = ex.minReasonLength || 8
      return items.every(it => pl[it.id] && (rs[it.id] || '').trim().length >= min)
    }
    return true
  }

  const useServerCheck = !!(ex as TaskExercise & { _serverCheck?: boolean })._serverCheck && ctx.sessionCode && ctx.studentId

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    try { await doSubmit() } finally { setSubmitting(false) }
  }

  const doSubmit = async () => {
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

    const submitData = formatSubmitData(ex.type, ans, { attemptCounts })

    // Try server-side check API when available (no local answers needed)
    if (useServerCheck && stepIdx !== undefined) {
      const checkResult = await checkAnswer(
        ctx.sessionCode!, stepIdx, ctx.studentId!, submitData,
      )
      if (checkResult) {
        // Persist: always for soft-graded types (map/matrix/stance), on allCorrect for others
        const softGraded = ex.type === 'map' || ex.type === 'matrix' || ex.type === 'stance'
        if ((checkResult.allCorrect || softGraded) && ctx.submit) {
          ctx.submit(stepIdx, submitData)
        }
        handleCheckResult(checkResult)
        return
      }
      // Fall through to local grading on API failure
    }

    // Persist submission for local grading path
    if (stepIdx !== undefined && ctx.submit) {
      ctx.submit(stepIdx, submitData)
    }

    // Local grading fallback
    if (ex.type === 'quiz' || ex.type === 'match') {
      const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
      const result = gradeItemSet(items as { correct: number }[], ans, { correctQs, attempts }, task.id)
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

  /** Handle server-side check result — update local state based on per-item feedback */
  const handleCheckResult = (result: CheckResult) => {
    if (result.allCorrect) {
      if (ex.type === 'quiz' || ex.type === 'match') {
        const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
        setCorrectQs(new Set(items.map((_, i) => i)))
      }
      setAllDone(true); onDone()
      return
    }

    if (ex.type === 'quiz' || ex.type === 'match') {
      const newCorrectQs = new Set(correctQs)
      const newWrongQs = new Set<number>()
      const newAttempts = { ...attempts }

      const newHints = { ...serverHints }
      result.items.forEach(item => {
        const idx = typeof item.idx === 'number' ? item.idx : parseInt(String(item.idx), 10)
        if (!newAttempts[idx]) newAttempts[idx] = []
        newAttempts[idx].push({ selected: ans[idx], isCorrect: item.correct, ts: Date.now() })
        reportAttempt(task.id, idx, newAttempts[idx].length, ans[idx], null, item.correct)
        if (item.correct) newCorrectQs.add(idx)
        else {
          newWrongQs.add(idx)
          if (item.hint || item.hintZh || item.walkthrough || item.walkthroughZh) {
            newHints[idx] = { hint: item.hint, hintZh: item.hintZh, walkthrough: item.walkthrough, walkthroughZh: item.walkthroughZh }
          }
        }
      })
      setServerHints(newHints)

      setAttempts(newAttempts); setCorrectQs(newCorrectQs); setWrongQs(newWrongQs)
      if (newWrongQs.size > 0) {
        const cleared = { ...ans }; newWrongQs.forEach(qi => { delete cleared[qi] }); setAns(cleared)
      }
      const items = ex.type === 'quiz' ? ex.questions! : ex.pairs!
      if (newWrongQs.size === 0 && newCorrectQs.size === items.length) {
        setAllDone(true); onDone()
      }
    } else if (ex.type === 'order') {
      const newAttempts = { ...attempts }
      if (!newAttempts[0]) newAttempts[0] = []
      newAttempts[0].push({ selected: ans.order, isCorrect: false, ts: Date.now() })
      reportAttempt(task.id, 0, newAttempts[0].length, ans.order, null, false)
      setAttempts(newAttempts)
      // Mark wrong positions from items (use item.idx, not array index)
      const wrong = new Set<number>()
      result.items.forEach(item => {
        const pos = typeof item.idx === 'number' ? item.idx : parseInt(String(item.idx), 10)
        if (!item.correct) wrong.add(pos)
      })
      setWrongQs(wrong); setAns({})
    } else if (ex.type === 'matrix') {
      const newHints = { ...serverHints }
      result.items.forEach(item => {
        const idx = typeof item.idx === 'number' ? item.idx : parseInt(String(item.idx), 10)
        if (!item.correct && (item.hint || item.hintZh)) {
          newHints[idx] = { hint: item.hint, hintZh: item.hintZh }
        }
      })
      setServerHints(newHints)
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, result.allCorrect)
      onDone()
    } else if (ex.type === 'map') {
      const llmItem = result.items.find(it => it.idx === '_llm')
      if (llmItem?.hint) setMapFeedback(llmItem.hint)
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, result.allCorrect)
      onDone()
    } else {
      // stance — soft done
      setSoftDone(true); setAllDone(true)
      reportAttempt(task.id, 0, 1, ans, null, result.allCorrect)
      onDone()
    }
  }

  const attemptCount = (qi: number) => (attempts[qi] || []).length

  return (
    <div id="phase-practice">
      <div className="stu-section-label"><span>Practice</span><div className="stu-section-line" /></div>
      <div style={{ fontSize: 13, color: 'var(--t2)', marginBottom: 12 }}>{linkParas(ex.label)}</div>

      {ex.type === 'quiz' && <QuizExercise questions={ex.questions!} ans={ans} setAns={setAns} correctQs={correctQs} wrongQs={wrongQs} attemptCount={attemptCount} serverHints={serverHints} />}
      {ex.type === 'match' && <MatchExercise pairs={ex.pairs!} ans={ans} setAns={setAns} correctQs={correctQs} wrongQs={wrongQs} attemptCount={attemptCount} serverHints={serverHints} />}
      {ex.type === 'matrix' && <MatrixExercise rows={ex.rows!} serverHints={serverHints} />}
      {ex.type === 'stance' && <StanceExercise stanceQ={ex.stanceQ!} stanceQZh={ex.stanceQZh} stanceOpts={ex.stanceOpts!} evidence={ex.evidence!} ans={ans} setAns={setAns} softDone={softDone} />}
      {ex.type === 'order' && <OrderExercise items={ex.items!} ans={ans} setAns={setAns} done={allDone} wrongPositions={wrongQs} attemptCount={(attempts[0] || []).length} />}
      {ex.type === 'map' && ex.axes && ex.mapItems && (
        <MapExercise
          prompt={ex.prompt || ''}
          axes={ex.axes}
          mapItems={ex.mapItems}
          minReasonLength={ex.minReasonLength || 8}
          ans={ans}
          setAns={setAns}
          allDone={allDone}
          feedback={mapFeedback}
        />
      )}
      {ex.type === 'select-evidence' && ex.sections && ex.functionOptions && ex.paragraphTokens && (
        <SelectEvidenceExercise
          exercise={ex}
          onOverlayChange={onOverlayChange || (() => {})}
          onSubmit={(data) => {
            if (stepIdx !== undefined && ctx.submit) {
              ctx.submit(stepIdx, formatSubmitData('select-evidence', data))
            }
          }}
          onDone={() => { setAllDone(true); onDone() }}
        />
      )}

      {/* Submit/Done */}
      <div style={{ marginTop: 16 }}>
        {allDone ? (
          <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>✓</span>Practice complete!
          </div>
        ) : (
          <button
            className="stu-btn pri"
            style={(!canSub() || submitting) ? { opacity: 0.35, cursor: 'default' } : undefined}
            onClick={(canSub() && !submitting) ? handleSubmit : undefined}
          >
            {submitting ? 'Checking...' : Object.keys(attempts).length > 0 ? 'Try Again' : 'Submit'}
          </button>
        )}
      </div>
    </div>
  )
}
