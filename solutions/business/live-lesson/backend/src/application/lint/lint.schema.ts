/**
 * Domain types for the AI lint cross-check (plan/lesson-plan.md vs
 * execution/manifest.json). The LLM returns issues against four
 * dimensions; the cache + frontend display this shape verbatim.
 *
 * See lesson-plan-format-design.md §4.3 for the design rationale + the
 * "Not in scope" item this feature finally implements.
 */

export type LintSeverity = 'error' | 'warning' | 'info';

/**
 * Each category targets one of the four consistency dimensions the
 * design calls out. Adding a 5th would require updating the LLM
 * prompt + the frontend's category-icon map; keep the enum small.
 */
export type LintCategory =
  | 'req-coverage' // plan declares req:// — does execution actually deliver it?
  | 'goal-alignment' // can execution's readingSteps achieve plan's 教学目标?
  | 'step-grounding' // does each execution step trace back to a plan req or goal?
  | 'subject-grade-fit'; // are answerKey types + difficulty appropriate for subject+grade?

export interface LintIssueLocation {
  /** Which file the issue points to. */
  file: 'plan' | 'manifest';
  /** Plan-side: the req:// id that's involved (e.g. "r-1.2.3"). */
  refId?: string;
  /** Manifest-side: zero-based index into readingSteps[]. */
  stepIdx?: number;
}

export interface LintIssue {
  severity: LintSeverity;
  category: LintCategory;
  /** Short, user-facing message. LLM-generated. */
  message: string;
  /** Optional anchor. Frontend renders as a deep-link badge. */
  location?: LintIssueLocation;
  /** Optional remediation hint from the LLM. */
  suggestion?: string;
}

/**
 * Lifecycle states the frontend polls on:
 *   idle   — never run for this project
 *   pending — a run is in flight (or queued via debounce)
 *   fresh  — cache reflects current content hash
 *   stale  — content changed since cache; a fresh run is enqueued
 *   error  — last run failed (LLM / parse / etc.); `errorMessage` populated
 */
export type LintStatus = 'idle' | 'pending' | 'fresh' | 'stale' | 'error';

export interface LintResult {
  projectId: string;
  status: LintStatus;
  /**
   * Short hash of `<plan>\0<manifest>` content at the time of the run.
   * Used both as the cache key (skip re-runs when hash matches) and as
   * the staleness signal on reads (current hash != cached hash → stale).
   */
  contentHash: string;
  issues: LintIssue[];
  /** ISO timestamp of when the cache entry was written. */
  generatedAt: string;
  /** When status === 'error', a human-readable failure summary. */
  errorMessage?: string;
}

/** Initial "never-run" result returned by getOrInit. */
export function idleResult(projectId: string): LintResult {
  return {
    projectId,
    status: 'idle',
    contentHash: '',
    issues: [],
    generatedAt: new Date(0).toISOString(),
  };
}
