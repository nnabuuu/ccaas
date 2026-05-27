/**
 * Browser-side client for the AI audit endpoints. Mirror of the
 * shape exposed by backend's `application/audit/audit.schema.ts` — when
 * adding a new severity / status, both sides must update together.
 *
 * Three operations:
 *   getAuditState  — cheap poll; returns the per-project run state
 *   runAudit       — POST 202; kicks off a background LLM run, returns
 *                    the just-set 'running' state
 *   getAuditReport — reads the persisted `audit/audit-report.md` via
 *                    the standard files endpoint; returns the markdown
 *                    string. Returns empty string on 404 (no report
 *                    yet) so the UI can render an empty state instead
 *                    of treating it as an error.
 */

export type AuditSeverity = 'pass' | 'warn' | 'guess' | 'error'
export type AuditRunStatus = 'idle' | 'running' | 'done' | 'error'

export interface AuditRunState {
  projectId: string
  status: AuditRunStatus
  /** ISO timestamp of the last successful run, absent if never succeeded. */
  lastGeneratedAt?: string
  /** Populated only when status === 'error'. */
  errorMessage?: string
  /** Canonical path of the report inside the project (`audit/audit-report.md`). */
  reportPath: string
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
  // 204 No Content (delete endpoints) — not used here but matches the
  // creator's other API helpers for consistency.
  if (res.status === 204) return undefined as T
  return res.json()
}

export async function getAuditState(projectId: string): Promise<AuditRunState> {
  return request<AuditRunState>(
    `/api/projects/${encodeURIComponent(projectId)}/audit`,
  )
}

export async function runAudit(projectId: string): Promise<AuditRunState> {
  return request<AuditRunState>(
    `/api/projects/${encodeURIComponent(projectId)}/audit/run`,
    { method: 'POST' },
  )
}

/**
 * Fetch the persisted audit report markdown. Returns '' when the file
 * doesn't exist yet (status='idle' or status='running' first-time run)
 * so callers can render the empty state without try/catch boilerplate.
 *
 * Errors other than 404 are still surfaced — they likely mean network
 * trouble or a broken endpoint, both of which the UI should warn about.
 */
export async function getAuditReport(projectId: string): Promise<string> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/files?path=${encodeURIComponent('audit/audit-report.md')}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status === 404) return ''
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${body || res.statusText}`)
  }
  // The files endpoint returns `{ content, fileType }`.
  const data = (await res.json()) as { content: string; fileType: string }
  return data.content ?? ''
}
