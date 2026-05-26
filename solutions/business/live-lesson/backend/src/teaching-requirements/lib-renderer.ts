/**
 * Renders the `_lib/*.md` files that get materialized into the agent's
 * workspace at session start (per `docs/lesson-plan-format-design.md`
 * §4.1 path B — the bash-free access path for L1 + L2).
 *
 * Pure functions: take the library + user's interpretations, return
 * markdown strings. The orchestration of "fetch + write to workspace"
 * happens upstream (ccaas-side materializer or, in MVP, an HTTP
 * endpoint that returns the rendered text).
 *
 * Format choices follow the design's stated example. The output is
 * grep-friendly: each item starts with `### <reqId> — <code>` so an
 * agent doing `Grep "<id>" _lib/teaching-requirements.md` lands on
 * the heading reliably.
 */

import type {
  TeachingRequirementsLibrary,
  InterpretationOverlay,
} from './types';

export interface InterpretationRow {
  reqId: string;
  notes: string;
  updatedAt: string;
  /** Optional canonical text from L1 for context — added by the
   * caller after joining against the library. */
  text?: string;
}

const HEADER_REQ = `<!--
教学要求库 (canonical, read-only). 引用语法: [文本](req://r-X.Y.Z "课标 X.Y · 分类")
查找用 Grep, 例如: Grep -i "推断" _lib/teaching-requirements.md
本文件由 ccaas materializer 物化生成. 平台升级时随之刷新; 编辑无效.
-->`;

const HEADER_INTERP = `<!--
你的解读 (per-user overlay). 编辑解读请回到 Plan Tab 的 chip popover.
查找用 Grep, 例如: Grep -A 6 "r-1.2.3" _lib/my-interpretations.md
本文件由 ccaas materializer 物化生成。是当前 session 用户的快照, 不会跨用户泄露.
-->`;

/**
 * Render a single library (one subject) to a markdown document.
 * Multiple libraries can be concatenated by the caller; in practice
 * we materialize ONE library per session (matching the project's
 * subject).
 */
export function renderLibrary(lib: TeachingRequirementsLibrary): string {
  const lines: string[] = [
    HEADER_REQ,
    '',
    `# 教学要求库 · ${lib.subjectLabel} · v${lib.version}`,
    '',
  ];

  for (const cat of lib.categories) {
    lines.push(`## ${escapeHeading(cat.label)} (${cat.id})`, '');
    for (const item of cat.items) {
      // Use em-dash separator so `awk` / regex can split the heading
      // reliably (no other em-dash in the body text by convention).
      // Strip newlines from text — agents grep on the heading + next
      // line, so a multiline `text` would break the grep contract.
      lines.push(`### ${item.id} — ${escapeHeading(item.code)}`);
      lines.push(item.text.replace(/\n/g, ' '));
      lines.push('');
    }
  }

  return lines.join('\n') + '\n';
}

/**
 * Render this user's interpretations. Rows should be joined against
 * L1 before calling (so `text` is filled in for context). Orphaned
 * interpretations (where L1 has dropped the id) get an explicit
 * "已失效" marker so the agent doesn't try to use them as guidance.
 */
export function renderInterpretations(rows: InterpretationRow[]): string {
  const lines: string[] = [HEADER_INTERP, '', '# 我的解读', ''];

  if (rows.length === 0) {
    lines.push('(尚未记录任何解读. 在 Plan Tab 里点开任何 chip 的 popover 可以添加.)');
    lines.push('');
    return lines.join('\n');
  }

  for (const row of rows) {
    const heading = row.text
      ? `## ${row.reqId} — ${escapeHeading(row.text)}`
      : `## ${row.reqId} — (库 item 已失效)`;
    lines.push(heading, '');
    lines.push(row.notes.trimEnd());
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Convenience: materialize both files at once given the inputs the
 * ccaas-side hook collects. Used by the `_materialize` HTTP endpoint
 * and by unit tests.
 */
export interface MaterializeInput {
  library: TeachingRequirementsLibrary | null;
  interpretations: InterpretationRow[];
}

export interface MaterializeOutput {
  /** Content for `_lib/teaching-requirements.md` (null if no library for the subject). */
  libraryMd: string | null;
  /** Content for `_lib/my-interpretations.md`. */
  interpretationsMd: string;
}

export function materializeLibFiles(input: MaterializeInput): MaterializeOutput {
  return {
    libraryMd: input.library ? renderLibrary(input.library) : null,
    interpretationsMd: renderInterpretations(input.interpretations),
  };
}

/** Re-export for caller convenience. */
export type { InterpretationOverlay };

/**
 * Strip newlines from heading text. Agents depend on the grep
 * contract `### r-X.Y.Z\n<text on one line>` — a multi-line text
 * would break that. Defensive against L1 / L2 data that contains
 * accidental newlines.
 */
function escapeHeading(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
