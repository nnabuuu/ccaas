/* ═══ Shared grading logic for Quiz & Match exercises ═══ */

export function reportAttempt(taskId: number, questionIdx: number, attempt: number, selected: any, correct: any, isCorrect: boolean) {
  try { window.parent.postMessage({ type: 'student_attempt', taskId, questionIdx, attempt, selected, correct, isCorrect, ts: Date.now() }, window.location.origin) } catch { /* noop */ }
}

export function formatSubmitData(
  type: string,
  ans: Record<string, any>,
  meta?: { attemptCounts?: Record<number, number> },
): Record<string, any> {
  let result: Record<string, any>
  switch (type) {
    case 'quiz': {
      const answers: any[] = []
      for (const k of Object.keys(ans)) answers[+k] = ans[k]
      result = { answers }
      break
    }
    case 'match': {
      const pairs: any[] = []
      for (const k of Object.keys(ans)) pairs[+k] = ans[k]
      result = { pairs }
      break
    }
    case 'order':
      result = { order: ans.order || [] }
      break
    case 'stance':
      result = { position: ans.stance, evidence: ans.evidence || [] }
      break
    case 'matrix':
      result = { rows: ans.rows || [] }
      break
    default:
      result = ans
  }
  if (meta?.attemptCounts) result.attemptCounts = meta.attemptCounts
  return result
}

export interface GradeResult {
  correctQs: Set<number>
  wrongQs: Set<number>
  attempts: Record<number, any[]>
  allDone: boolean
}

export function gradeItemSet(
  items: Array<{ correct: number }>,
  ans: Record<string, any>,
  prev: { correctQs: Set<number>; attempts: Record<number, any[]> },
  taskId: number,
): GradeResult {
  const correctQs = new Set(prev.correctQs)
  const wrongQs = new Set<number>()
  const attempts = { ...prev.attempts }

  items.forEach((item, idx) => {
    if (correctQs.has(idx)) return
    const sel = ans[idx]; if (sel === undefined) return
    const isOk = sel === item.correct
    if (!attempts[idx]) attempts[idx] = []
    attempts[idx].push({ selected: sel, correct: item.correct, isCorrect: isOk, ts: Date.now() })
    reportAttempt(taskId, idx, attempts[idx].length, sel, item.correct, isOk)
    if (isOk) correctQs.add(idx); else wrongQs.add(idx)
  })

  return { correctQs, wrongQs, attempts, allDone: wrongQs.size === 0 && correctQs.size === items.length }
}
