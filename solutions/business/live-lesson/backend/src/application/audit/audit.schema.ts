/**
 * AI audit subsystem — generates a Notion-like markdown audit report
 * cross-checking plan/lesson-plan.md against execution/manifest.json.
 *
 * The report itself is markdown (LLM output, callout directives + cross
 * references inline) persisted to `project_files` at
 * `audit/audit-report.md`. THIS module only tracks the **run state**
 * (idle / running / done / error) per project so the UI button can
 * show progress; the report content lives on disk like any other
 * project file.
 *
 * See lesson-plan-format-design.md §4.3 + the creator-v7-rich design
 * doc (solutions/.../design/surfaces/creator-v7-rich-design-doc.md)
 * for the rationale.
 */

/**
 * Severity classes used inside the markdown report's callout directives.
 * Wider than the previous lint's error/warning/info because the audit
 * report distinguishes "checks that passed" from "ai guesses" — both
 * useful UI signals, neither captured by warning vs info alone.
 *
 * Backend doesn't enforce these at parse time (we just save the LLM's
 * markdown verbatim); the frontend's renderer recognizes the matching
 * `:::pass / :::warn / :::guess / :::error` directives.
 */
export type AuditSeverity = 'pass' | 'warn' | 'guess' | 'error';

/**
 * Run-state lifecycle:
 *   idle   — never run, or invalidated.
 *   running — a run is in flight (LLM call + write). Frontend polls.
 *   done   — last run completed; report file at `reportPath` is fresh.
 *   error  — last run failed; `errorMessage` populated, report file
 *            may or may not exist (previous successful run still on disk).
 */
export type AuditRunStatus = 'idle' | 'running' | 'done' | 'error';

export interface AuditRunState {
  projectId: string;
  status: AuditRunStatus;
  /** ISO timestamp of last successful run. Absent if never succeeded. */
  lastGeneratedAt?: string;
  /** Populated only when status === 'error'. */
  errorMessage?: string;
  /**
   * Constant path inside the project — the report file lives here.
   * Exposed so the frontend doesn't hard-code the string + so the
   * backend can change the location later without breaking clients.
   */
  reportPath: string;
}

/** Canonical path of the persisted audit report inside a project. */
export const AUDIT_REPORT_PATH = 'audit/audit-report.md';

/** Initial state returned when the cache has no entry for a project. */
export function idleState(projectId: string): AuditRunState {
  return {
    projectId,
    status: 'idle',
    reportPath: AUDIT_REPORT_PATH,
  };
}
