import type { ReactNode, ComponentProps } from 'react'
import { SessionCtx } from '../../components/student/TaskPanel'
import type { SubmitResult } from '../../hooks/useClassroom'
import { taskDemoApi } from './useTaskDemoApi'

type SessionCtxValue = ComponentProps<typeof SessionCtx.Provider>['value']

/**
 * Wraps SessionCtx for /task-demo so plugins that route through
 * `ctx.submit(step, data)` (notably select-evidence — selfManagedSubmit=true)
 * hit /api/task-demo/:code/submit instead of the classroom backend.
 *
 * KNOWN GAP — rich-content-quiz scaffold flow is NOT supported. Production
 * `/submit` response carries `scaffold`, `partId`, `nextPartId`,
 * `sampleSolution` which drive RichContentQuizExercise's multi-part
 * walkthrough. /api/task-demo/:code/submit returns only `{attempt, score,
 * allCorrect, items}` — so the scaffold branch silently no-ops and every
 * submission jumps to "correct". Tracked in docs/task-demo.md backlog.
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
      const result = await taskDemoApi.submit(code, studentId, data)
      onSubmitResult?.({ allCorrect: result.allCorrect, score: result.score as Record<string, unknown> | null, items: result.items })
      // SubmitResult has more optional fields (scaffold / partId / etc.)
      // we never produce for task-demo — leave them undefined.
      const ret: SubmitResult = { ok: true, score: result.score as Record<string, unknown> | null }
      return ret
    },
  }
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}
