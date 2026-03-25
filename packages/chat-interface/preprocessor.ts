// src/harness/preprocessor.ts
// Harness 预处理: Session 注入 + Skill 匹配 + 历史摘要

import type { SessionContext } from "../types/chat";
import type { SkillMetadata, SkillId } from "../types/skill";
import { getWidgetSystemPrompt } from "../widget-catalog/catalog";

// ===== System Prompt 组装 =====

export interface SystemPromptParts {
  base: string;
  skillPrompt: string | null;
  widgetCatalog: string;
  sessionContext: string;
  historySummary: string;
}

export function assembleSystemPrompt(parts: SystemPromptParts): string {
  const sections = [
    parts.base,
    parts.skillPrompt ? `\n## Active Skill\n${parts.skillPrompt}` : "",
    `\n## Available Widget Components\n${parts.widgetCatalog}`,
    `\n## Session Context\n${parts.sessionContext}`,
    parts.historySummary ? `\n## Conversation History\n${parts.historySummary}` : "",
  ];
  return sections.filter(Boolean).join("\n");
}

// ===== Session → Prompt 片段 =====

export function sessionToPrompt(session: SessionContext): string {
  const lines = [
    `Role: ${session.role}`,
    session.schoolName ? `School: ${session.schoolName} (${session.schoolId})` : null,
    session.className ? `Class: ${session.className} (${session.classId})` : null,
    session.subject ? `Subject: ${session.subject}` : null,
    session.gradeSemester ? `Grade: ${session.gradeSemester}` : null,
    `Semester phase: ${session.semesterPhase}, Week ${session.currentWeek}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// ===== Skill 候选匹配 =====

export interface SkillMatchResult {
  skillId: SkillId;
  confidence: number;
  matchedTrigger: string;
}

/**
 * 基于用户输入的关键词扫描, 匹配候选 Skill。
 *
 * 匹配策略:
 * 1. 精确匹配 Skill 的 trigger 关键词
 * 2. 上下文延续: 如果上一轮已激活某 Skill, 本轮倾向继续
 * 3. 多 Skill 竞争时取 confidence 最高的
 *
 * 注意: 这是一个轻量的预过滤, 不走 LLM。
 * 最终的 Skill 激活决策由 LLM 在 completion 中做出。
 */
export function matchSkillCandidates(
  userInput: string,
  availableSkills: SkillMetadata[],
  previousSkillId?: SkillId,
): SkillMatchResult[] {
  // 这里是骨架实现, 实际需要:
  // 1. 从 SKILL.md frontmatter 提取 triggers
  // 2. 支持中文分词匹配
  // 3. 上下文延续加权

  const triggerMap: Record<string, { skillId: SkillId; triggers: string[] }> = {};

  for (const skill of availableSkills) {
    // triggers 应从 SKILL.md 的 frontmatter 中提取
    // 这里用 name + category 作为简单匹配
    triggerMap[skill.id] = {
      skillId: skill.id,
      triggers: [skill.name, ...skill.description.split(/[,，。.]/)]
        .map(t => t.trim().toLowerCase())
        .filter(Boolean),
    };
  }

  const input = userInput.toLowerCase();
  const results: SkillMatchResult[] = [];

  for (const { skillId, triggers } of Object.values(triggerMap)) {
    for (const trigger of triggers) {
      if (input.includes(trigger) && trigger.length > 1) {
        results.push({
          skillId,
          confidence: trigger.length / input.length,
          matchedTrigger: trigger,
        });
      }
    }
  }

  // 上下文延续加分
  if (previousSkillId) {
    const existing = results.find(r => r.skillId === previousSkillId);
    if (existing) {
      existing.confidence += 0.3;
    } else {
      results.push({
        skillId: previousSkillId,
        confidence: 0.2,
        matchedTrigger: "[context_continuation]",
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

// ===== 历史摘要 =====

/**
 * 将最近 N 轮对话压缩为摘要, 注入 system_prompt。
 * 压缩策略:
 * - 最近 2 轮: 完整保留
 * - 更早的轮次: 只保留 user 输入 + assistant 的第一句
 * - 超过 token 预算时从最早的轮次开始丢弃
 */
export function compressHistory(
  messages: Array<{ role: string; content: string }>,
  maxTokenBudget: number = 500,
): string {
  if (messages.length === 0) return "";

  const recent = messages.slice(-4); // 最近2轮 (user + assistant 各一条)
  const older = messages.slice(0, -4);

  const recentText = recent
    .map(m => `[${m.role}]: ${m.content}`)
    .join("\n");

  const olderSummary = older
    .filter(m => m.role === "user")
    .map(m => `- User asked: ${m.content.slice(0, 80)}`)
    .join("\n");

  const full = olderSummary
    ? `Earlier topics:\n${olderSummary}\n\nRecent:\n${recentText}`
    : recentText;

  // 粗略 token 估算 (中文约 1.5 token/字, 英文约 0.75 token/word)
  const estimatedTokens = full.length * 0.5;
  if (estimatedTokens > maxTokenBudget) {
    return recentText; // 超预算时只保留最近的
  }

  return full;
}

// ===== 完整预处理流程 =====

export interface PreprocessResult {
  systemPrompt: string;
  matchedSkills: SkillMatchResult[];
}

export function preprocess(
  userInput: string,
  session: SessionContext,
  availableSkills: SkillMetadata[],
  activeSkillPrompt: string | null,
  previousSkillId: SkillId | undefined,
  conversationHistory: Array<{ role: string; content: string }>,
  basePrompt: string,
): PreprocessResult {
  const matchedSkills = matchSkillCandidates(
    userInput, availableSkills, previousSkillId,
  );

  const systemPrompt = assembleSystemPrompt({
    base: basePrompt,
    skillPrompt: activeSkillPrompt,
    widgetCatalog: getWidgetSystemPrompt(),
    sessionContext: sessionToPrompt(session),
    historySummary: compressHistory(conversationHistory),
  });

  return { systemPrompt, matchedSkills };
}
