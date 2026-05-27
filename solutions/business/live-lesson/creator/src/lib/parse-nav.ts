import type { WorkspaceTabKey } from './dynamic-tabs'

/**
 * Parse a `nav://<workspace>/<anchor>` URL into its workspace key +
 * optional anchor. Returns null for malformed URLs or unknown
 * workspace targets — the caller should treat null as "render as
 * inert text" rather than throwing.
 *
 * Supported shapes:
 *   nav://execution            → { key: 'execution' }
 *   nav://execution/s-abc-id   → { key: 'execution', anchor: 's-abc-id' }
 *   nav://plan/r-1.2.3         → { key: 'plan', anchor: 'r-1.2.3' }
 *   nav://skills               → { key: 'skills' }
 *
 * Anchor parsing is intentionally lax: anything between the second
 * `/` and the first `?` / `#` is captured verbatim and handed to the
 * tab as-is (the tab decides whether the anchor resolves to a DOM
 * element). This keeps URL → DOM mapping in one place per workspace
 * and avoids spreading parse logic across N consumers.
 *
 * Whitelist: only `plan` / `execution` / `skills` are recognized as
 * workspace keys (matching `WorkspaceTabKey`). Any other target —
 * `nav://settings`, `nav://other`, etc. — returns null so a typo or
 * a future-added-but-not-implemented workspace doesn't silently
 * misroute clicks.
 */
export function parseNavWorkspace(url: string): {
  key: WorkspaceTabKey
  anchor?: string
} | null {
  const m = url.match(/^nav:\/\/([^/?#]+)(?:\/([^?#]*))?/)
  if (!m) return null
  const target = m[1]
  if (target === 'plan' || target === 'execution' || target === 'skills') {
    return { key: target, anchor: m[2] || undefined }
  }
  return null
}
