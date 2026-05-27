/**
 * Browser-side client for the AI lint endpoints. Mirror of the shape
 * defined in backend/src/application/lint/lint.schema.ts — keep the two
 * in sync when adding new categories / severities.
 */

export type LintSeverity = 'error' | 'warning' | 'info'

export type LintCategory =
  | 'req-coverage'
  | 'goal-alignment'
  | 'step-grounding'
  | 'subject-grade-fit'

export interface LintIssueLocation {
  file: 'plan' | 'manifest'
  refId?: string
  stepIdx?: number
}

export interface LintIssue {
  severity: LintSeverity
  category: LintCategory
  message: string
  location?: LintIssueLocation
  suggestion?: string
}

export type LintStatus = 'idle' | 'pending' | 'fresh' | 'stale' | 'error'

export interface LintResult {
  projectId: string
  status: LintStatus
  contentHash: string
  issues: LintIssue[]
  generatedAt: string
  errorMessage?: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${body || res.statusText}`)
  }
  return res.json()
}

/**
 * Read the current lint state. Cheap; safe to call repeatedly (used for
 * polling). When status === 'pending' or 'stale', poll again after a
 * short delay until status reaches 'fresh' or 'error'.
 */
export async function getLintResult(projectId: string): Promise<LintResult> {
  return request<LintResult>(
    `/api/projects/${encodeURIComponent(projectId)}/lint`,
  )
}

/**
 * Force a fresh lint run (manual override — the "重新运行" button).
 * Blocks on the server until the LLM call resolves. Use for explicit
 * user-triggered re-runs; the auto-trigger on file save handles the
 * common case.
 */
export async function runLint(projectId: string): Promise<LintResult> {
  return request<LintResult>(
    `/api/projects/${encodeURIComponent(projectId)}/lint/run`,
    { method: 'POST' },
  )
}
