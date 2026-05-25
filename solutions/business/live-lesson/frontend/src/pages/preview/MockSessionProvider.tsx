/**
 * MockSessionProvider — supplies a SessionCtx that satisfies the exercise
 * components when running in /preview mode (no real classroom session).
 *
 * Real components read `config` (e.g. `config.enableMath` for quiz/matrix
 * math rendering) and sometimes `submit`. We provide both as no-op-friendly
 * mocks. Real submission is intercepted by usePreviewExercise — this provider
 * just keeps the components from crashing on `useContext(SessionCtx)`.
 */
import type { ReactNode } from 'react'
import { SessionCtx } from '../../components/student/TaskPanel'

const MOCK_CTX = {
  sessionCode: 'PREVIEW',
  studentId: 'preview-student',
  config: { enableMath: true },
  boardData: null,
  restoredSubmissions: {},
  discussMeta: null,
  submit: async () => ({ ok: true, allCorrect: true, items: [] }),
}

export function MockSessionProvider({ children }: { children: ReactNode }) {
  return <SessionCtx.Provider value={MOCK_CTX as any}>{children}</SessionCtx.Provider>
}
