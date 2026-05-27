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
  /**
   * Path of the most recently completed report. Each run writes to a
   * fresh timestamped path; this field tracks the latest. Absent on
   * `idle` (never run) and during the first-ever running tick.
   */
  reportPath?: string
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
 * Fetch one specific audit report markdown. Caller supplies the path
 * (typically `state.reportPath` from a `getAuditState` response).
 * Returns '' on 404 so the UI can show "file gone" gracefully instead
 * of crashing — a teacher might have closed an audit tab whose file
 * was later deleted.
 */
export async function getAuditReport(
  projectId: string,
  reportPath: string,
): Promise<string> {
  const url = `/api/projects/${encodeURIComponent(projectId)}/files?path=${encodeURIComponent(reportPath)}`
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
  })
  if (res.status === 404) return ''
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${body || res.statusText}`)
  }
  const data = (await res.json()) as { content: string; fileType: string }
  return data.content ?? ''
}
