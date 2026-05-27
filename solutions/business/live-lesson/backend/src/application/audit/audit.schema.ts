/**
 * AI audit subsystem — generates a Notion-like markdown audit report
 * cross-checking plan/lesson-plan.md against execution/manifest.json.
 *
 * The report itself is markdown (LLM output, callout directives + cross
 * references inline) persisted to `project_files` at a per-run
 * timestamped path (`audit/<ISO>.md` via `auditReportPath`). History
 * accumulates so the frontend can open multiple past reports as
 * dynamic tabs. THIS module only tracks the **run state**
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
   * Path of the *most recent* report file. Each run writes a fresh
   * timestamped path (kept on disk as history) — this field is just
   * the latest pointer. Frontend uses it to open a tab on completion;
   * older runs are still readable via the standard
   * `/files?path=audit/<...>.md` endpoint, and the file browser sees
   * every historical report.
   *
   * Absent on idle (never run). Absent on the first running tick;
   * subsequent runs preserve the previous latest pointer so the UI
   * can still show "last completed report" while a new one is in
   * flight.
   */
  reportPath?: string;
}

/**
 * Generate a unique, sortable report path for one audit run.
 *
 * Format: `audit/<ISO-timestamp>.md`. The `:` and `.` characters in
 * ISO 8601 timestamps (e.g. `2026-05-27T08:28:34.123Z`) are unsafe in
 * some filesystems and URLs, so we replace both with `-`:
 *   audit/2026-05-27T08-28-34-123Z.md
 *
 * Lexical sort = chronological sort, so a directory listing of
 * `audit/*.md` is naturally history-ordered without extra metadata.
 */
export function auditReportPath(date: Date = new Date()): string {
  const safe = date.toISOString().replace(/[:.]/g, '-');
  return `audit/${safe}.md`;
}

/** Initial state returned when the cache has no entry for a project. */
export function idleState(projectId: string): AuditRunState {
  return {
    projectId,
    status: 'idle',
  };
}
