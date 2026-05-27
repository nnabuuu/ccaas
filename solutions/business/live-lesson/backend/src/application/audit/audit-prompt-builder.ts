import { Injectable } from '@nestjs/common';

/**
 * Pure prompt assembly for the AI audit. The output is a markdown
 * document (NOT JSON) — the LLM is expected to write a Notion-like
 * report with 4 fixed chapters + admonition-style callouts for
 * actionable findings.
 *
 * Extracted from AuditService so prompt tuning sessions don't have to
 * navigate state-mutation code, and so the prompt is unit-testable
 * without spinning up the full Nest module graph.
 */

export interface ReferencedLibItem {
  /** The req:// id, e.g. "r-1.2.3". */
  id: string;
  /** Canonical L1 text (current revision). */
  text: string;
  /** Which subject library this id came from. */
  subject: string;
  /** Category label like "语言能力" — gives the LLM extra context. */
  categoryLabel: string;
}

export interface AuditPromptInputs {
  projectTitle: string;
  /** Full plan/lesson-plan.md content (after canonicalization). */
  plan: string;
  /** Pretty-printed execution/manifest.json content. */
  manifest: string;
  /** L1 items referenced by any req:// link in `plan`. */
  libItems: ReferencedLibItem[];
}

export interface AuditPrompt {
  systemPrompt: string;
  userMessage: string;
}

// Conservative caps so a giant manifest doesn't blow the LLM's context.
// Plan ~3KB / manifest ~10KB are typical; the cap is comfortable
// headroom. Truncation appends a marker so the LLM (and a debugger
// reading the prompt) knows it didn't see everything.
const PLAN_MAX_BYTES = 16_000;
const MANIFEST_MAX_BYTES = 32_000;

const SYSTEM_PROMPT = `你是一位资深教研员, 审查教师的教案 (plan/lesson-plan.md) 跟执行手册 (execution/manifest.json), 输出一份 Notion-like markdown 报告。

报告结构必须严格按以下骨架, 章节标题逐字不变:

# 概述

(2 段自然语言。第一段: 项目名 / 维度 / 数量 (教学要求条数、Step 数等)。第二段: 整体判断 + 需关注的发现数。)

## 一、结构与时间

(教案阶段 ↔ 执行 Step 对齐, 时间分配是否合理。用 :::pass 或 :::warn callout 表达发现。)

## 二、教学要求覆盖

(plan 里每条 req:// 在 execution 里是否被覆盖? 用 markdown 列表展示, 每条要求一行:
  - r-X.Y.Z 推断生词含义 — ✓ 被 step #N 覆盖
  - r-X.Y.W 识别篇章结构 — ⚠ 部分覆盖

部分覆盖或缺失的, 后面用 :::warn callout 详述。)

## 三、AI 不确定性

(execution 里有 "TODO" / 占位文本 / 含糊措辞的步骤; LLM 自己读出的 step 难以判断的部分。 按严重度排, :::guess 在最上 (依据不足), :::warn 次之。)

## 四、配置健康度

(Schema 完整度 / 时间预算 / gradeLevel 跟题型适配等的快速检查清单, 用 markdown checkbox 列表:
  - [x] manifest schema 通过 Zod 校验
  - [ ] gradeLevel 字段为空)

Callout 用 markdown directive (admonition) 语法, 4 种 severity:

:::pass[标题]
检查通过的简短描述。可以没有正文, 标题就够。
:::

:::warn[标题]
需关注的描述, 自然语言。可以引用模块 [Step 1](nav://execution/step-1) 或要求 [r-1.2.3](nav://plan/req/r-1.2.3)。
内嵌动作按钮: [让 AI 修复](action://fix?target=step-1&issue=missing-coverage) [跳转查看](nav://execution/step-1)
:::

:::guess[标题]
AI 猜测, 依据不足的描述。 适合 "我觉得这一步是想..." 的情境。
:::

:::error[标题]
配置错误 / Schema 不通过 / 严重违背的描述。
:::

输出约束:
- 只返回 markdown 文档, 不要 JSON 包装、不要解释、不要前言后语。
- 文档以 \`# 概述\` 开头。
- 报告语言简体中文, 教师本人能读懂。
- nav://, action://, req:// 链接的具体路径让 LLM 自己根据上下文填合理值, 前端会忽略点不通的链接。`;

@Injectable()
export class AuditPromptBuilder {
  /**
   * Build the system + user prompt pair for one audit run. Pure
   * function (no I/O), so unit tests can assert against the exact
   * string output without mocking anything.
   *
   * Plan / manifest are truncated independently if either exceeds the
   * per-section byte cap. Truncation appends a marker so the LLM
   * notices, and so a future debugger can see when the cap is hit.
   */
  build(inputs: AuditPromptInputs): AuditPrompt {
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
      `[项目名] ${inputs.projectTitle || '(未命名)'}`,
      '',
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

/** UTF-8 aware truncation. Cut on a codepoint boundary so the LLM
 * doesn't receive a corrupted byte sequence; append a visible marker. */
function truncate(input: string, maxBytes: number): string {
  const buf = Buffer.from(input, 'utf8');
  if (buf.length <= maxBytes) return input;
  let end = maxBytes;
  while (end > 0 && (buf[end] & 0xc0) === 0x80) end--;
  return buf.subarray(0, end).toString('utf8') + '\n\n... [TRUNCATED]';
}

/** Strip newlines so each lib bullet stays one line (grep contract). */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}
