/**
 * Pure state model for the project editor's tab system. The editor has
 * two tab classes:
 *
 *   1. Workspace tabs: fixed, persistent (教案 / 执行 / Skills). Never
 *      closed. Selecting a workspace tab clears the active dynamic tab.
 *
 *   2. Dynamic tabs: opened on demand (audit reports, file viewers).
 *      Multiple can be open at once; each has a unique id + close
 *      button. Selecting a dynamic tab clears the active workspace tab.
 *
 * The two selections are mutually exclusive — one and only one tab is
 * "active" at a time. `activeWorkspace` and `activeDynamic` are both
 * stored but at most one is non-null at any moment.
 *
 * Pure functions only (no React, no I/O) so the reducer is unit-testable
 * and the same shape can be threaded through context / store / props.
 */

export type WorkspaceTabKey = 'plan' | 'execution' | 'skills'

export type DynamicTab =
  | {
      id: string
      kind: 'audit-report'
      /** Path inside the project — e.g. "audit/2026-05-27T08-28-34-123Z.md". */
      reportPath: string
      /** Display label (e.g. "审计 10:32"). */
      title: string
      openedAt: number
    }
  | {
      id: string
      kind: 'file-viewer'
      /** Path inside the project — e.g. "execution/manifest.json". */
      filePath: string
      title: string
      openedAt: number
    }

export interface TabsState {
  /** Selected workspace tab. null when a dynamic tab is active. */
  activeWorkspace: WorkspaceTabKey | null
  /** Id of selected dynamic tab. null when a workspace tab is active. */
  activeDynamic: string | null
  /** Ordered list of open dynamic tabs (left-to-right in the bar). */
  dynamic: DynamicTab[]
}

/**
 * Initial state — `execution` workspace tab active, no dynamic tabs.
 * Matches the pre-v7-rich default (where 'execution' was the landing
 * tab). Easy to change to 'plan' if the design ever flips.
 */
export function initialState(): TabsState {
  return {
    activeWorkspace: 'execution',
    activeDynamic: null,
    dynamic: [],
  }
}

/** Set the active workspace tab. Clears any active dynamic tab. */
export function selectWorkspace(
  state: TabsState,
  key: WorkspaceTabKey,
): TabsState {
  return { ...state, activeWorkspace: key, activeDynamic: null }
}

/** Set the active dynamic tab (must already be in `state.dynamic`).
 * Clears the active workspace tab. No-op if id doesn't exist. */
export function selectDynamic(state: TabsState, id: string): TabsState {
  if (!state.dynamic.some((t) => t.id === id)) return state
  return { ...state, activeWorkspace: null, activeDynamic: id }
}

/**
 * Open a new dynamic tab and make it active. Allows duplicates by id
 * theoretically, but callers should generate unique ids via
 * `dynamicTabId()` so each open creates a fresh tab.
 *
 * If a tab with the same id already exists (shouldn't happen with
 * uuid ids), the existing one is reused rather than duplicated.
 */
export function openDynamic(state: TabsState, tab: DynamicTab): TabsState {
  const exists = state.dynamic.some((t) => t.id === tab.id)
  const dynamic = exists ? state.dynamic : [...state.dynamic, tab]
  return {
    ...state,
    activeWorkspace: null,
    activeDynamic: tab.id,
    dynamic,
  }
}

/**
 * Close a dynamic tab. If it was active, pick a successor:
 *   1. The tab immediately to the LEFT of the closed one (matches
 *      browser-tab UX; if you close tab #3, focus jumps to tab #2).
 *   2. When closing the leftmost active tab, jump to the new leftmost.
 *   3. When no dynamic tabs remain, fall back to the 'execution'
 *      workspace (we don't track "last workspace before going dynamic"
 *      yet, so this is the default starting point).
 *
 * Non-active closes don't change selection — only the list shrinks.
 */
export function closeDynamic(state: TabsState, id: string): TabsState {
  const idx = state.dynamic.findIndex((t) => t.id === id)
  if (idx < 0) return state
  const dynamic = state.dynamic.filter((t) => t.id !== id)
  // If the closed tab wasn't active, just remove it; selection stays.
  if (state.activeDynamic !== id) {
    return { ...state, dynamic }
  }
  // Closed tab was active. Pick a successor.
  if (dynamic.length === 0) {
    // No dynamic tabs left → fall back to workspace 'execution'
    // (matches initial-state default; the user clearly wanted a tab,
    // so don't leave them tab-less).
    return { ...state, dynamic, activeDynamic: null, activeWorkspace: 'execution' }
  }
  // Prefer the dynamic tab to the LEFT of the closed one (matches
  // browser-tab UX); fall back to the new rightmost when closing the
  // leftmost.
  const fallback = dynamic[Math.max(0, idx - 1)]
  return {
    ...state,
    dynamic,
    activeDynamic: fallback.id,
    activeWorkspace: null,
  }
}

/**
 * Generate a unique id for a new dynamic tab. Prefer crypto.randomUUID
 * when available (modern browsers); fall back to timestamp + counter
 * for old engines / SSR.
 */
let counter = 0
export function dynamicTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  counter += 1
  return `dt-${Date.now().toString(36)}-${counter}`
}
