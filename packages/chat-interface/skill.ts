// src/types/skill.ts
// Skill 管理 — 元数据、生命周期、权限

import type { Subject, GradeSemester, SchoolStage } from "./curriculum";

// ===== Skill 身份 =====

export type SkillId = `skill:${string}`;
export type SkillScope = "district" | "school" | "personal";

export type SkillStatus =
  | "draft" | "testing" | "in_review" | "rejected"
  | "published" | "deprecated" | "archived";

export interface SkillVersion {
  major: number;
  minor: number;
  patch: number;
  publishedAt?: string;
  changelog?: string;
}

// ===== 分类 =====

export type SkillCategory =
  | "lesson_planning" | "exam_generation" | "learning_analytics"
  | "teaching_research" | "student_assessment" | "ai_literacy"
  | "classroom_tools" | "admin_tools" | "custom";

// ===== MCP 依赖 =====

export interface McpDependency {
  toolName: string;
  required: boolean;
  purpose: string;
}

// ===== 参数化 =====

export interface SkillParam {
  key: string;
  label: string;
  description: string;
  type: "string" | "number" | "boolean" | "enum" | "json" | "text";
  defaultValue: unknown;
  options?: Array<{ value: string; label: string }>;
  range?: { min: number; max: number; step?: number };
  /** 谁可以修改 */
  editableBy: SkillScope;
  group?: string;
}

// ===== 审核 =====

export interface ReviewRecord {
  reviewer: ActorRef;
  action: "approve" | "reject" | "request_changes";
  comment?: string;
  timestamp: string;
  version: SkillVersion;
}

// ===== 使用统计 =====

export interface SkillUsageStats {
  totalInvocations: number;
  monthlyActiveUsers: number;
  averageRating: number;
  ratingCount: number;
  dailyTrend: Array<{ date: string; count: number }>;
  bySchool?: Array<{ schoolId: string; schoolName: string; count: number }>;
}

// ===== 角色 =====

export interface ActorRef {
  id: string;
  name: string;
  role: "district_admin" | "school_admin" | "teacher";
  schoolId?: string;
}

// ===== Skill 元数据 =====

export interface SkillMetadata {
  id: SkillId;
  name: string;
  description: string;
  readme?: string;
  category: SkillCategory;
  version: SkillVersion;
  status: SkillStatus;
  scope: SkillScope;

  subjects: Subject[];
  stages: SchoolStage[];
  grades: GradeSemester[];

  mcpDependencies: McpDependency[];
  skillDependencies?: SkillId[];

  /** Widget catalog 中本 Skill 使用的组件类型 */
  widgetTypes: string[];

  /** Fork 继承链 */
  upstream?: {
    skillId: SkillId;
    version: SkillVersion;
    latestUpstreamVersion?: SkillVersion;
  };

  params: SkillParam[];
  paramValues: Record<string, unknown>;

  createdBy: ActorRef;
  createdAt: string;
  updatedAt: string;
  reviewHistory: ReviewRecord[];
  usage?: SkillUsageStats;
}

// ===== 权限 =====

export type SkillPermission =
  | "create_template" | "review_district" | "fork"
  | "configure_params" | "enable_disable" | "review_school"
  | "use" | "create_personal" | "submit_review"
  | "rate" | "view_analytics";

export const ROLE_PERMISSIONS: Record<ActorRef["role"], SkillPermission[]> = {
  district_admin: ["create_template", "review_district", "view_analytics"],
  school_admin: ["fork", "configure_params", "enable_disable", "review_school", "rate", "view_analytics"],
  teacher: ["use", "create_personal", "submit_review", "rate"],
};

// ===== 管理面板 API =====

export interface SkillListQuery {
  actor: ActorRef;
  status?: SkillStatus[];
  category?: SkillCategory;
  subject?: Subject;
  scope?: SkillScope;
  keyword?: string;
  sortBy?: "usage" | "rating" | "updated" | "name";
  limit?: number;
  offset?: number;
}

export interface ForkSkillRequest {
  sourceSkillId: SkillId;
  targetSchoolId: string;
  initialOverrides?: Record<string, unknown>;
}

export interface UpdateParamsRequest {
  skillId: SkillId;
  updates: Record<string, unknown>;
  actor: ActorRef;
}

export interface SubmitReviewRequest {
  skillId: SkillId;
  targetScope: "school" | "district";
  note?: string;
}
