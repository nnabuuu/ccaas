/**
 * Workspace-tab scroll-to-anchor signal.
 *
 * Companion to the chat bridge: when a user clicks `[Step 1](nav://execution/step-1|s-abc)`
 * inside an audit report, ChatBridge.switchToWorkspace fires both a tab
 * change and this signal. Each workspace tab (ExecutionTab, PlanTab)
 * watches the signal via props and scrolls its DOM target into view.
 *
 * Why a {anchor, nonce} pair instead of just a string: clicking the
 * same nav link twice should re-trigger the scroll (e.g. teacher
 * scrolled away after the first click and wants to re-find the step).
 * A bare string prop wouldn't re-render the watching effect when the
 * value is unchanged; the monotonic `nonce` forces a fresh dep change.
 */
export interface ScrollSignal {
  /** Raw anchor string from the nav:// URL — examples:
   *  - "step-1"            (idx only, legacy / simple form)
   *  - "step-1|s-abc-id"   (idx + stepId, recommended dual form)
   *  - "r-1.2.3"           (plan reqId, used by PlanTab)
   *  null when no scroll is pending. */
  anchor: string | null
  /** Monotonic counter — bumped on every dispatch, even if anchor is
   *  unchanged, so React effects keyed off `[anchor, nonce]` re-fire. */
  nonce: number
}

export const EMPTY_SIGNAL: ScrollSignal = { anchor: null, nonce: 0 }

/**
 * Parsed execution-tab step anchor. Both fields can independently be
 * null because the LLM may emit either the simple form (`step-1`) or
 * the dual form (`step-1|s-abc`). The frontend's selection priority
 * is `id` first (stable across reorder), `idx` second.
 */
export interface StepAnchor {
  /** 1-based step position from `step-N` portion of the anchor.
   *  null if the anchor lacked a parseable `step-N` prefix. */
  idx: number | null
  /** Stable `step.id` from the `|<stepId>` portion of the anchor.
   *  null if the anchor lacked a pipe-suffix. */
  id: string | null
}

/**
 * Parse an execution-tab step anchor into idx + id components.
 *
 * Accepted forms (with examples — anchor strings; the `nav://execution/`
 * prefix has already been stripped by `parseNavWorkspace`):
 *   - `step-1`           → `{ idx: 1, id: null }`
 *   - `step-1|s-abc-id`  → `{ idx: 1, id: 's-abc-id' }`
 *
 * Rejected (returns `null`):
 *   - empty / null / undefined
 *   - `r-1.2.3`     (no `step-` prefix — belongs to PlanTab)
 *   - `step-`       (no digits)
 *   - `step-abc`    (non-numeric idx)
 *   - `step-1foo`   (trailing chars before pipe)
 *   - `|s-abc`      (pipe-only without preceding `step-N`)
 *
 * Returns null for any unrecognized shape — the scroll effect then
 * silently no-ops rather than throwing, since the audit report is
 * untrusted LLM output and may emit garbage anchors occasionally.
 */
export function parseStepAnchor(
  anchor: string | null | undefined,
): StepAnchor | null {
  if (!anchor) return null
  // The id capture is non-greedy w.r.t. an empty match: `|` with
  // nothing after parses as `id: null`, not `id: ''`, because we
  // collapse empty strings to null below.
  const m = anchor.match(/^step-(\d+)(?:\|(.*))?$/)
  if (!m) return null
  const idx = Number.parseInt(m[1], 10)
  if (!Number.isInteger(idx) || idx < 1) return null
  const rawId = m[2]
  const id = rawId && rawId.length > 0 ? rawId : null
  return { idx, id }
}
