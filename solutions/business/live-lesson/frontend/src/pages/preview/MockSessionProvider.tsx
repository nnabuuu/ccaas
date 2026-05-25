/**
 * MockSessionProvider — supplies a SessionCtx that satisfies the exercise
 * components when running in /exercise-demo mode (no real classroom session).
 *
 * Typed against the real SessionCtx value shape so a drift in TaskPanel.tsx
 * surfaces here at compile time instead of crashing at runtime in customer
 * demos.
 */
import type { ReactNode, ComponentProps } from 'react'
import { SessionCtx } from '../../components/student/TaskPanel'

type SessionCtxValue = ComponentProps<typeof SessionCtx.Provider>['value']

const MOCK_CTX: SessionCtxValue = {
  sessionCode: 'PREVIEW',
  studentId: 'preview-student',
  config: { enableMath: true },
  boardData: null,
  restoredSubmissions: {},
  discussMeta: null,
  // Components that call ctx.submit (e.g. DiscussPhase) get a resolved
  // SubmitResult so their `.items.map(...)` paths don't throw.
  submit: async () => ({ ok: true, allCorrect: true, items: [] }),
}

export function MockSessionProvider({ children }: { children: ReactNode }) {
  return <SessionCtx.Provider value={MOCK_CTX}>{children}</SessionCtx.Provider>
}
