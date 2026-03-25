// src/harness/submit-engine.ts
// submitToEngine — Widget 提交 → 下一轮 completion
//
// 关键区别于 sendPrompt:
// - sendPrompt: 自然语言文本 → LLM 重新解析
// - submitToEngine: 结构化 JSON → 直接注入 tool_result

import type { SessionContext, EngineSubmission } from "../types/chat";
import type { SkillId } from "../types/skill";

/**
 * 将 Widget 收集的结构化参数包装成 tool_result,
 * 注入下一轮 completion 的 messages 中。
 *
 * LLM 收到的不是自然语言, 而是:
 * {role: "tool", content: JSON.stringify(submission.params)}
 *
 * 这意味着:
 * 1. LLM 不需要重新解析用户意图 (已经在 Widget 里完成了)
 * 2. Token 消耗大幅降低 (结构化 JSON vs 自然语言描述)
 * 3. 参数类型安全 (已经过 Widget 的 Zod schema 验证)
 */
export function buildToolResultMessage(
  submission: EngineSubmission,
): ToolResultMessage {
  return {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: `widget_submit_${Date.now()}`,
        content: JSON.stringify({
          source: submission.sourceWidgetType,
          target_skill: submission.targetSkill,
          params: submission.params,
          session: {
            schoolId: submission.session.schoolId,
            classId: submission.session.classId,
            subject: submission.session.subject,
            gradeSemester: submission.session.gradeSemester,
          },
        }),
      },
    ],
  };
}

interface ToolResultMessage {
  role: "user";
  content: Array<{
    type: "tool_result";
    tool_use_id: string;
    content: string;
  }>;
}

/**
 * 完整的 submitToEngine 流程:
 *
 * 1. Widget 调用 onSubmit(params)
 * 2. buildToolResultMessage 包装成 tool_result
 * 3. 追加到 conversation history
 * 4. 触发新一轮 completion
 * 5. Harness 后处理渲染响应
 */
export interface SubmitToEngineOptions {
  submission: EngineSubmission;
  /** 触发下一轮 completion 的回调 */
  triggerCompletion: (messages: unknown[]) => Promise<void>;
  /** 当前对话历史 */
  conversationHistory: unknown[];
}

export async function submitToEngine(
  options: SubmitToEngineOptions,
): Promise<void> {
  const toolResult = buildToolResultMessage(options.submission);

  // 追加到对话历史
  const updatedHistory = [
    ...options.conversationHistory,
    toolResult,
  ];

  // 触发下一轮 completion
  await options.triggerCompletion(updatedHistory);
}
