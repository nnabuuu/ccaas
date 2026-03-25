// src/harness/postprocessor.ts
// Harness 后处理: LLM 响应 → 消息块路由 + Widget 水合

import type {
  ContentBlock, TextBlock, WidgetBlock, FileBlock,
  ChatMessage, JsonRenderSpec, SessionContext, SkillResponse,
} from "../types/chat";
import type { SkillId } from "../types/skill";
import { hydrateMcpData, type McpBridge } from "../widget-catalog/mcp-bridge";

// ===== LLM 原始输出解析 =====

/**
 * Anthropic API 返回的 content blocks 格式
 */
interface LlmContentBlock {
  type: "text" | "tool_use";
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * 将 LLM 原始输出转换为 Jijian 的 ContentBlock 列表。
 *
 * 路由规则:
 * - text block → TextBlock (Markdown)
 * - tool_use name=render_widget → WidgetBlock (json-render spec)
 * - tool_use name=generate_file → FileBlock
 * - tool_use name=其他 → 作为 MCP 调用执行
 */
export function parseLlmResponse(
  blocks: LlmContentBlock[],
): { content: ContentBlock[]; pendingMcpCalls: PendingMcpCall[] } {
  const content: ContentBlock[] = [];
  const pendingMcpCalls: PendingMcpCall[] = [];

  for (const block of blocks) {
    if (block.type === "text" && block.text) {
      content.push({
        type: "text",
        content: block.text,
      } satisfies TextBlock);
    }

    if (block.type === "tool_use" && block.name && block.input) {
      switch (block.name) {
        case "render_widget": {
          const spec = block.input as unknown as JsonRenderSpec;
          content.push({
            type: "widget",
            spec,
          } satisfies WidgetBlock);
          break;
        }

        case "generate_file": {
          content.push({
            type: "file",
            fileName: (block.input.fileName as string) ?? "output",
            fileType: (block.input.fileType as string) ?? "application/octet-stream",
            downloadUrl: (block.input.downloadUrl as string) ?? "",
            description: block.input.description as string | undefined,
          } satisfies FileBlock);
          break;
        }

        default: {
          // 其他 tool_use 视为 MCP 调用
          pendingMcpCalls.push({
            toolName: block.name,
            params: block.input,
          });
        }
      }
    }
  }

  return { content, pendingMcpCalls };
}

interface PendingMcpCall {
  toolName: string;
  params: Record<string, unknown>;
}

// ===== Widget MCP 数据水合 =====

/**
 * 遍历所有 WidgetBlock, 水合其中的 MCP 数据源。
 */
export async function hydrateWidgets(
  content: ContentBlock[],
  bridge: McpBridge,
  session: SessionContext,
  stateSnapshot: Record<string, unknown> = {},
): Promise<ContentBlock[]> {
  const hydrated: ContentBlock[] = [];

  for (const block of content) {
    if (block.type === "widget") {
      const hydratedSpec = await hydrateMcpData(
        block.spec,
        bridge,
        stateSnapshot,
        session,
      );
      hydrated.push({ type: "widget", spec: hydratedSpec });
    } else {
      hydrated.push(block);
    }
  }

  return hydrated;
}

// ===== Next Actions 提取 =====

/**
 * 从 LLM 输出中提取 next_actions。
 * LLM 可以通过 tool_use name=suggest_actions 声明后续操作。
 */
export function extractNextActions(
  blocks: LlmContentBlock[],
): SkillResponse["nextActions"] {
  for (const block of blocks) {
    if (block.type === "tool_use" && block.name === "suggest_actions" && block.input) {
      const actions = block.input.actions as Array<{
        label: string;
        prompt: string;
        skill_hint?: string;
      }>;
      return actions?.map(a => ({
        label: a.label,
        prompt: a.prompt,
        skillHint: a.skill_hint as SkillId | undefined,
      }));
    }
  }
  return undefined;
}

// ===== 完整后处理流程 =====

export async function postprocess(
  llmBlocks: LlmContentBlock[],
  bridge: McpBridge,
  session: SessionContext,
  activeSkill: SkillId | undefined,
): Promise<ChatMessage> {
  // 1. 解析 LLM 输出
  const { content, pendingMcpCalls } = parseLlmResponse(llmBlocks);

  // 2. 执行待处理的 MCP 调用 (非 widget 的, 如数据查询)
  for (const call of pendingMcpCalls) {
    try {
      const result = await bridge.callMcp(call.toolName, call.params);
      content.push({
        type: "mcp_result",
        toolName: call.toolName,
        result,
        visible: false, // 默认不可见, 作为下一轮 context
      });
    } catch (error) {
      // MCP 调用失败不阻塞渲染, 记录错误
      console.error(`MCP call failed: ${call.toolName}`, error);
    }
  }

  // 3. 水合 Widget 中的 MCP 数据
  const hydratedContent = await hydrateWidgets(content, bridge, session);

  // 4. 提取 next_actions
  const nextActions = extractNextActions(llmBlocks);

  return {
    id: crypto.randomUUID(),
    role: "assistant",
    timestamp: new Date().toISOString(),
    content: hydratedContent,
    activeSkill,
    nextActions,
  };
}
