/**
 * Tiny wrapper around the 6 /api/task-demo routes. Each method posts/gets
 * through vite's /api proxy (→ live-lesson backend :3007). Errors are
 * surfaced as thrown Error with the backend message when available.
 */

export interface CreateResult {
  code: string
  sessionId: string
  lessonId: string
  step: number
}

export interface ClaimResult {
  studentId: string
  name: string
}

export interface ExerciseSpec extends Record<string, unknown> {
  type: string
  step: number
  lessonId: string
  /** Full sanitized manifest. Pick what to render: article / boardData /
   *  readingSteps[step].studentView, etc. */
  manifest: Record<string, any>
}

export interface SubmitResult {
  attempt: number
  score: Record<string, unknown> | null
  allCorrect: boolean
  items: Array<Record<string, unknown>>
  submittedAt: string
  // ── rich-content-quiz parts flow (omitted for single-shot types) ──
  partId?: string
  scaffold?: {
    level: number
    hintZh: string
    hintImage?: string
    canRetry: boolean
    steps?: Array<{
      title: string
      hintZh?: string
      widget?: string
      props?: Record<string, unknown>
    }>
  } | null
  nextPartId?: string | null
  sampleSolution?: string | null
}

export interface Respondent {
  studentId: string
  name: string
  attemptCount: number
  latestScore: Record<string, unknown> | null
  latestSubmittedAt: string | null
}

export interface ReplayEntry {
  attempt: number
  data: Record<string, unknown>
  score: Record<string, unknown> | null
  checkItems: Array<Record<string, unknown>>
  submittedAt: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/task-demo${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.message) msg = Array.isArray(body.message) ? body.message.join(', ') : String(body.message)
    } catch {
      // body wasn't JSON — keep the status-line message
    }
    throw new Error(msg)
  }
  return res.json()
}

export const taskDemoApi = {
  create(lessonId: string, step: number) {
    return call<CreateResult>('/create', {
      method: 'POST',
      body: JSON.stringify({ lessonId, step }),
    })
  },
  claim(code: string, user: string) {
    return call<ClaimResult>(`/${encodeURIComponent(code)}/claim`, {
      method: 'POST',
      body: JSON.stringify({ user }),
    })
  },
  exercise(code: string) {
    return call<ExerciseSpec>(`/${encodeURIComponent(code)}/exercise`)
  },
  submit(code: string, studentId: string, data: Record<string, unknown>) {
    return call<SubmitResult>(`/${encodeURIComponent(code)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ studentId, data }),
    })
  },
  respondents(code: string) {
    return call<Respondent[]>(`/${encodeURIComponent(code)}/respondents`)
  },
  replay(code: string, studentId: string) {
    return call<ReplayEntry[]>(
      `/${encodeURIComponent(code)}/replay/${encodeURIComponent(studentId)}`,
    )
  },
}

/** localStorage key per (code, normalized-user). */
export function studentIdCacheKey(code: string, user: string): string {
  return `task-demo:${code}:${user.trim().toLowerCase()}`
}
