import type { AuditSeverity } from '../../api/audit'

/**
 * Pure helpers for pre-processing the audit report markdown before
 * rendering. Lives in a `.ts` file (no JSX) so it can be unit-tested
 * without pulling React + DOM into the test runtime.
 *
 * Two responsibilities:
 *   1. Strip the AI-generated banner HTML comment the backend prepends
 *      to every persisted report (anti-injection metadata, not for the
 *      teacher's UI).
 *   2. Split the document into alternating markdown chunks and
 *      callout blocks (`:::pass/warn/guess/error[标题] ... :::`),
 *      since remark-parse doesn't natively understand the directive
 *      syntax + we want to render callouts via a React component.
 */

export type Segment =
  | { kind: 'md'; body: string }
  | { kind: 'callout'; severity: AuditSeverity; title?: string; body: string }

/**
 * Strip a leading HTML comment + trailing newline. The backend always
 * writes the audit report with the banner as the first line; once
 * removed, the first content line should be the `# 概述` heading.
 * Mid-document HTML comments are left for the renderer to handle (it
 * surfaces them as muted text — they're unexpected so worth showing).
 */
export function stripBannerComment(md: string): string {
  return md.replace(/^\s*<!--[\s\S]*?-->\s*\n?/, '')
}

// Matches `:::pass[标题]` or `:::warn` (title optional) on its own line.
const CALLOUT_OPEN_RE =
  /^[ \t]*:::(pass|warn|guess|error)(?:\[([^\]\n]*)\])?[ \t]*$/

const KNOWN_SEVERITIES: ReadonlySet<AuditSeverity> = new Set([
  'pass',
  'warn',
  'guess',
  'error',
])

/**
 * Walk the markdown line by line, splitting into alternating markdown
 * chunks and callout blocks. Unclosed callouts (LLM forgot the closing
 * `:::`) get terminated at EOF so trailing content isn't dropped.
 *
 * Unknown severity prefixes (`:::warning` typo, `:::info` etc.) fall
 * through as plain markdown — defensive against LLM mistyping a
 * directive name.
 */
export function splitIntoSegments(md: string): Segment[] {
  // Normalize line endings first. LLM transports or Windows-emitted
  // text can include CRLF; without this, `\r` would dangle at the end
  // of each line and the directive open/close regex (anchored with $)
  // would never match — every callout would silently fall through as
  // plain markdown.
  const lines = md.replace(/\r\n?/g, '\n').split('\n')
  const segments: Segment[] = []
  let mdBuf: string[] = []
  let i = 0

  const flushMd = () => {
    if (mdBuf.length === 0) return
    const body = mdBuf.join('\n').trim()
    if (body) segments.push({ kind: 'md', body })
    mdBuf = []
  }

  while (i < lines.length) {
    const line = lines[i]
    const openMatch = line.match(CALLOUT_OPEN_RE)
    if (openMatch && KNOWN_SEVERITIES.has(openMatch[1] as AuditSeverity)) {
      flushMd()
      const severity = openMatch[1] as AuditSeverity
      const title = openMatch[2]?.trim() || undefined
      i++
      const bodyLines: string[] = []
      while (i < lines.length && !/^[ \t]*:::[ \t]*$/.test(lines[i])) {
        bodyLines.push(lines[i])
        i++
      }
      // Skip the closing `:::` line if present (i++ advances past it).
      if (i < lines.length) i++
      segments.push({
        kind: 'callout',
        severity,
        title,
        body: bodyLines.join('\n').trim(),
      })
      continue
    }
    mdBuf.push(line)
    i++
  }
  flushMd()
  return segments
}
