/**
 * Shared grading helpers for quiz / match plugins.
 *
 * `formatSubmitData` (the legacy per-type switch) used to live here; it has
 * been replaced by per-plugin `plugin.formatSubmitData` implementations in
 * `plugins/built-in.tsx`. PracticePhase now dispatches through the registry,
 * so no caller of the old dispatcher remains.
 */

export function reportAttempt(taskId: number, questionIdx: number, attempt: number, selected: any, correct: any, isCorrect: boolean) {
  try { window.parent.postMessage({ type: 'student_attempt', taskId, questionIdx, attempt, selected, correct, isCorrect, ts: Date.now() }, window.location.origin) } catch { /* noop */ }
}

export interface GradeResult {
  correctQs: Set<number>
  wrongQs: Set<number>
  attempts: Record<number, any[]>
  allDone: boolean
}

/**
 * Per-item check used by quiz + match plugins' `localGrade`. Compares each
 * indexed answer against `item.correct`, accumulates attempts, and reports
 * each attempt via `reportAttempt` (for teacher-observe telemetry).
 */
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
