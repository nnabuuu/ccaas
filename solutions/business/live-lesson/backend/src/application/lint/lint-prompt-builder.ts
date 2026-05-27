import { Injectable } from '@nestjs/common';

/**
 * Pure prompt assembly for the AI lint cross-check. Extracted from
 * LintService so it's testable without spinning up the full module
 * graph + can be iterated on by prompt-tuning sessions without
 * touching state-mutation code.
 *
 * Inputs are already-loaded strings (we don't reach into ProjectService
 * here). Caller is responsible for read + content hashing.
 */

export interface RefencedLibItem {
  /** The req:// id, e.g. "r-1.2.3". */
  id: string;
  /** Canonical L1 text (current revision). */
  text: string;
  /** Which subject library this id came from. */
  subject: string;
  /** Category label like "语言能力" — gives the LLM extra context. */
  categoryLabel: string;
}

export interface LintPromptInputs {
  /** Full plan/lesson-plan.md content (after canonicalization). */
  plan: string;
  /** Pretty-printed execution/manifest.json content. */
  manifest: string;
  /** L1 items referenced by any req:// link in `plan`. */
  libItems: RefencedLibItem[];
}

export interface LintPrompt {
  systemPrompt: string;
  userMessage: string;
}

// Conservative caps so a giant manifest doesn't blow the LLM's context
// window. 32 KB / 16 KB are comfortably above realistic content size
// (plan ~3 KB typical, manifest ~10 KB with all 11 step types). Truncation
// adds a marker line so the LLM knows it didn't see everything.
const PLAN_MAX_BYTES = 16_000;
const MANIFEST_MAX_BYTES = 32_000;

const SYSTEM_PROMPT = `你是一位资深教研员。审查教案 (plan/lesson-plan.md) 跟执行手册 (execution/manifest.json) 之间的一致性, 找出问题。

教案声明: 教学目标 / 教学要求 (req:// 链接) / 模块概要。
执行手册定义: readingSteps (每步含 answerKey 题型, aiHints, discuss 配置)。

四个检查维度:
1. req-coverage: 每个 plan 里的 req://, execution 里是否有 step 覆盖? 还是只是声明没实现?
2. goal-alignment: plan 的"教学目标" 是否能通过 execution 的 step 组合达成?
3. step-grounding: execution 每个 step 反向是否追溯到 plan 里某个 req 或 goal? 还是 plan 没提的 step?
4. subject-grade-fit: 题型 / 难度跟 manifest.subject + manifest.gradeLevel 是否相符?

返回严格 JSON, 无 markdown 包裹:
{"issues": [{ "severity": "error"|"warning"|"info", "category": "req-coverage"|"goal-alignment"|"step-grounding"|"subject-grade-fit", "message": "...", "location": { "file": "plan"|"manifest", "refId": "...", "stepIdx": 0 }, "suggestion": "..." }]}

无问题: {"issues": []}。
不要解释、不要 prose, 只返回 JSON。

Severity 选择标准:
- error: 关键违背 (plan req 完全没在 execution 出现 / 某 step 完全脱离 plan 主线)
- warning: 软违背 (req 被部分覆盖但深度不够 / 难度跟 grade 偏差)
- info: 优化建议 (可以考虑加一步 / 题型可以更多样)

location 字段填法:
- plan 侧问题填 { "file": "plan", "refId": "r-X.Y.Z" } (有具体 req 时)
- manifest 侧问题填 { "file": "manifest", "stepIdx": N } (有具体 step 时)
- 跨文件 / 整体问题可以省略 location

message + suggestion 用简体中文, 言简意赅, 教师本人读得懂。
suggestion 可选; 没有具体改法时省略。`;

@Injectable()
export class LintPromptBuilder {
  /**
   * Build the prompt pair for one lint run. Pure function (no I/O), so
   * unit tests can assert against the exact string output without
   * mocking anything.
   *
   * Plan / manifest are truncated independently if they exceed the
   * per-section byte cap (rare). Truncation appends a marker line so
   * the LLM knows it didn't see the full file — and so a future bug
   * where the truncation activates surfaces in the lint output instead
   * of silently producing weird results.
   */
  build(inputs: LintPromptInputs): LintPrompt {
    const planSection = truncate(inputs.plan, PLAN_MAX_BYTES);
    const manifestSection = truncate(inputs.manifest, MANIFEST_MAX_BYTES);
    const libSection = inputs.libItems.length
      ? inputs.libItems
          .map(
            (it) =>
              `- ${it.id}: ${oneLine(it.text)} (subject: ${it.subject} · category: ${it.categoryLabel})`,
          )
          .join('\n')
      : '(plan 未引用任何教学要求)';

    const userMessage = [
      '[PLAN markdown]',
      planSection,
      '',
      '[EXECUTION manifest JSON]',
      manifestSection,
      '',
      '[REFERENCED 教学要求 items]',
      libSection,
    ].join('\n');

    return { systemPrompt: SYSTEM_PROMPT, userMessage };
  }
}

/**
 * Byte-aware truncation. UTF-8 multi-byte chars: cut at a safe
 * boundary to avoid splitting a codepoint, then append a marker so
 * the LLM (and a future debugger reading the prompt) knows the input
 * was clipped.
 */
function truncate(input: string, maxBytes: number): string {
  const buf = Buffer.from(input, 'utf8');
  if (buf.length <= maxBytes) return input;
  // Walk back from the cap until we land on a valid UTF-8 boundary.
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString('utf8') + '\n\n... [TRUNCATED]';
}

/** Strip newlines so the bullet item stays one line for grep / scan. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
