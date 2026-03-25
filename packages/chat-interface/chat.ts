// src/types/chat.ts
// Chat 消息、Session、SkillResponse

import type { Subject, GradeSemester } from "./curriculum";
import type { SkillId } from "./skill";

// ===== Session =====

export interface SessionContext {
  userId: string;
  role: "district_admin" | "school_admin" | "teacher" | "student";
  schoolId?: string;
  schoolName?: string;
  classId?: string;
  className?: string;
  subject?: Subject;
  gradeSemester?: GradeSemester;
  /** 学期阶段 — 影响快捷建议和默认行为 */
  semesterPhase: "early" | "mid" | "late" | "exam";
  currentWeek: number;
}

// ===== 消息类型 =====

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  timestamp: string;
  content: ContentBlock[];
  /** 当前激活的 Skill */
  activeSkill?: SkillId;
  /** 后续操作建议 */
  nextActions?: NextAction[];
}

export type ContentBlock =
  | TextBlock
  | WidgetBlock
  | FileBlock
  | McpResultBlock;

export interface TextBlock {
  type: "text";
  content: string; // Markdown
}

export interface WidgetBlock {
  type: "widget";
  /** json-render spec — 传给 Renderer 的完整 JSON */
  spec: JsonRenderSpec;
}

export interface FileBlock {
  type: "file";
  fileName: string;
  fileType: string; // mime type
  downloadUrl: string;
  description?: string;
}

export interface McpResultBlock {
  type: "mcp_result";
  toolName: string;
  result: unknown;
  /** 是否对用户可见 (有些 MCP 结果只是中间数据) */
  visible: boolean;
}

// ===== json-render spec =====

export interface JsonRenderSpec {
  root: string;
  elements: Record<string, JsonRenderElement>;
  /** Jijian 扩展: MCP 数据源声明 */
  mcp_sources?: McpSourceDeclaration[];
}

export interface JsonRenderElement {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
}

export interface McpSourceDeclaration {
  /** 在 spec 中的引用 key */
  ref: string;
  /** MCP 工具名 */
  tool: string;
  /** 参数, 可包含 $state 引用 */
  params: Record<string, unknown>;
}

// ===== Skill Response =====

export interface SkillResponse {
  content: ContentBlock[];
  nextActions?: NextAction[];
  /** Harness 层使用的元数据 */
  metadata?: {
    activeSkill: SkillId;
    /** token 消耗 */
    tokenUsage?: { input: number; output: number };
    /** MCP 调用记录 */
    mcpCalls?: Array<{ tool: string; durationMs: number }>;
  };
}

export interface NextAction {
  label: string;
  prompt: string;
  skillHint?: SkillId;
}

// ===== submitToEngine =====

export interface EngineSubmission {
  /** 来自哪个 widget 的提交 */
  sourceWidgetType: string;
  /** 目标 Skill */
  targetSkill: SkillId;
  /** 收集到的结构化参数 */
  params: Record<string, unknown>;
  /** 当前 session context (自动注入) */
  session: SessionContext;
}

// ===== 快捷建议 =====

export interface QuickSuggestion {
  label: string;
  prompt: string;
  /** 分类: 日常/教学/管理 */
  category: "daily" | "teaching" | "admin";
  /** 优先级分数 (越高越靠前) */
  score: number;
}
