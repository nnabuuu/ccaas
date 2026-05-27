/**
 * Workspace-tab scroll-to-anchor signal.
 *
 * Companion to the chat bridge: when a user clicks
 * `[Step 1](nav://execution/s-abc-id)` inside an audit report,
 * ChatBridge.switchToWorkspace fires both a tab change and this
 * signal. Each workspace tab (ExecutionTab, PlanTab) watches the
 * signal via props and scrolls its DOM target into view.
 *
 * Anchor semantics: the raw string after `nav://<workspace>/` —
 *   - execution: a step.id (matches `data-step-id`)
 *   - plan:      a req id (matches `data-req-id`)
 * No parsing / dual forms / positional fallback. If the id doesn't
 * resolve to a DOM node (e.g. the step was deleted), the scroll
 * silently no-ops; we never fall back to a positional guess because
 * scrolling to the wrong content is worse than not scrolling.
 *
 * Why a {anchor, nonce} pair instead of just a string: clicking the
 * same nav link twice should re-trigger the scroll (e.g. teacher
 * scrolled away after the first click and wants to re-find the
 * step). A bare string prop wouldn't re-render the watching effect
 * when the value is unchanged; the monotonic `nonce` forces a fresh
 * dep change.
 */
export interface ScrollSignal {
  /** Raw anchor string from the nav:// URL (the id portion).
   *  null when no scroll is pending. */
  anchor: string | null
  /** Monotonic counter — bumped on every dispatch, even if anchor is
   *  unchanged, so React effects keyed off `[anchor, nonce]` re-fire. */
  nonce: number
}

export const EMPTY_SIGNAL: ScrollSignal = { anchor: null, nonce: 0 }
