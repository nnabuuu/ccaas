import type { ReactNode, ComponentProps } from 'react'
import { SessionCtx } from '../../components/student/TaskPanel'
import { taskDemoApi } from './useTaskDemoApi'

type SessionCtxValue = ComponentProps<typeof SessionCtx.Provider>['value']

/**
 * Wraps SessionCtx for /task-demo so plugins that route through
 * `ctx.submit(step, data)` (notably select-evidence — selfManagedSubmit=true)
 * hit /api/task-demo/:code/submit instead of the classroom backend.
 *
 * The MockSessionProvider used by /exercise-demo returns a canned submit
 * response; that's fine for bundle previews but wrong here — task-demo's
 * whole point is server persistence. This provider replaces only the
 * `submit` function and keeps the rest of the mock shape.
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
      onSubmitResult?.({ allCorrect: result.allCorrect, score: result.score as any, items: result.items })
      // Cast to SubmitResult — the production submit response has more
      // fields (scaffold, partId, …) which we don't surface for task-demo.
      return { ok: true, score: result.score } as any
    },
  }
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}
