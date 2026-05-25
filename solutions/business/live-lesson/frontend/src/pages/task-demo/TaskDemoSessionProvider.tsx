import type { ReactNode, ComponentProps } from 'react'
import { SessionCtx } from '../../components/student/TaskPanel'
import type { SubmitResult } from '../../hooks/useClassroom'
import { taskDemoApi } from './useTaskDemoApi'

type SessionCtxValue = ComponentProps<typeof SessionCtx.Provider>['value']

/**
 * Wraps SessionCtx for /task-demo so plugins that route through
 * `ctx.submit(step, data)` hit /api/task-demo/:code/submit instead of the
 * classroom backend. Two consumers today:
 *
 *   - select-evidence (selfManagedSubmit=true) — calls ctx.submit per
 *     "Check evidence" click.
 *   - rich-content-quiz — calls ctx.submit per part submission and reads
 *     back `scaffold` / `partId` / `nextPartId` / `sampleSolution` to drive
 *     its multi-part walkthrough. The backend submitPart fills these
 *     fields when `data.partId` is set; we pass them through here.
 */
export function TaskDemoSessionProvider({
  code,
  studentId,
  onSubmitResult,
  children,
}: {
  code: string
  studentId: string
  onSubmitResult?: (result: { allCorrect: boolean; score: { total: number } | null; items: unknown[] }) => void
  children: ReactNode
}) {
  const value: SessionCtxValue = {
    sessionCode: code,
    studentId,
    config: { enableMath: true },
    boardData: null,
    restoredSubmissions: {},
    discussMeta: null,
    submit: async (_step, data) => {
      // Catch network / 4xx / 5xx so callers like RichContentQuizExercise
      // (which has only try/finally for the submitting flag) get a
      // failed-but-not-rejected result they can branch on via `ok`.
      try {
        const result = await taskDemoApi.submit(code, studentId, data)
        onSubmitResult?.({ allCorrect: result.allCorrect, score: result.score as Record<string, unknown> | null, items: result.items })
        // Forward scaffold/partId/nextPartId/sampleSolution so plugins like
        // rich-content-quiz can drive their state machine. Backend submitPart
        // populates them when data.partId is set; non-part submits leave
        // them undefined.
        const ret: SubmitResult = {
          ok: true,
          score: result.score as Record<string, unknown> | null,
          ...(result.partId !== undefined && { partId: result.partId }),
          ...(result.scaffold !== undefined && { scaffold: result.scaffold }),
          ...(result.nextPartId !== undefined && { nextPartId: result.nextPartId }),
          ...(result.sampleSolution !== undefined && { sampleSolution: result.sampleSolution }),
        }
        return ret
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[task-demo] ctx.submit failed:', err)
        const failed: SubmitResult = { ok: false, score: null }
        return failed
      }
    },
  }
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}
