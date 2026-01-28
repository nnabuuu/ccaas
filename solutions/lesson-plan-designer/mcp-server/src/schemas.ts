/**
 * Lesson Plan Field Schemas
 *
 * 这些 Zod schema 用于校验和修复 write_output 工具的输入数据。
 * 每个 schema 都提供了默认值，确保即使 AI 返回的数据不完整，
 * 也能生成有效的输出。
 *
 * @module schemas
 */

import { z } from 'zod';

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 生成唯一 ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// 基础字段 Schema
// ============================================================================

/**
 * 标题 Schema
 */
export const TitleSchema = z.string().min(1, '标题不能为空');

/**
 * 学科 Schema
 */
export const SubjectSchema = z.string().min(1, '学科不能为空');

/**
 * 年级 Schema
 */
export const GradeLevelSchema = z.string().min(1, '年级不能为空');

/**
 * 课时 Schema
 */
export const DurationSchema = z.string().min(1, '课时不能为空');

// ============================================================================
// 教学目标 Schema
// ============================================================================

/**
 * Bloom 认知层级
 */
export const BloomLevelSchema = z.enum([
  'remember',    // 记忆
  'understand',  // 理解
  'apply',       // 应用
  'analyze',     // 分析
  'evaluate',    // 评价
  'create',      // 创造
]).default('understand');

/**
 * 单个教学目标
 *
 * @example
 * {
 *   id: "obj-1",
 *   description: "学生能够理解分数的基本概念",
 *   bloomLevel: "understand",
 *   assessmentCriteria: "能用自己的话解释分数的含义"
 * }
 */
export const LearningObjectiveSchema = z.object({
  id: z.string().default(() => generateId('obj')),
  description: z.string().min(1, '目标描述不能为空'),
  bloomLevel: BloomLevelSchema,
  assessmentCriteria: z.string().optional(),
}).transform((obj) => ({
  ...obj,
  id: obj.id || generateId('obj'),
}));

/**
 * 教学目标数组
 */
export const ObjectivesSchema = z.array(LearningObjectiveSchema).default([]);

// ============================================================================
// 课程标准 Schema
// ============================================================================

/**
 * 单个课程标准
 *
 * @example
 * {
 *   id: "std-1",
 *   code: "数学-2-0123",
 *   description: "理解分数的意义"
 * }
 */
export const StandardSchema = z.object({
  id: z.string().default(() => generateId('std')),
  code: z.string().default(''),
  description: z.string().min(1, '标准描述不能为空'),
}).transform((obj) => ({
  ...obj,
  id: obj.id || generateId('std'),
}));

/**
 * 课程标准数组
 */
export const StandardsSchema = z.array(StandardSchema).default([]);

// ============================================================================
// 教学材料 Schema
// ============================================================================

/**
 * 材料类型
 */
export const MaterialTypeSchema = z.enum([
  'textbook',      // 教材
  'handout',       // 讲义
  'digital',       // 数字资源
  'manipulative',  // 教具
  'other',         // 其他
]).default('other');

/**
 * 单个教学材料
 *
 * @example
 * {
 *   id: "mat-1",
 *   name: "人教版数学三年级上册",
 *   type: "textbook",
 *   notes: "第3单元"
 * }
 */
export const MaterialSchema = z.object({
  id: z.string().default(() => generateId('mat')),
  name: z.string().min(1, '材料名称不能为空'),
  type: MaterialTypeSchema,
  url: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
}).transform((obj) => ({
  ...obj,
  id: obj.id || generateId('mat'),
}));

/**
 * 教学材料数组
 */
export const MaterialsSchema = z.array(MaterialSchema).default([]);

// ============================================================================
// 教学活动 Schema
// ============================================================================

/**
 * 活动类型
 */
export const ActivityTypeSchema = z.enum([
  'introduction',          // 导入
  'direct-instruction',    // 讲授
  'guided-practice',       // 引导练习
  'independent-practice',  // 独立练习
  'group',                 // 小组活动
  'assessment',            // 评估
  'closure',               // 总结
]).default('direct-instruction');

/**
 * 单个教学活动
 *
 * @example
 * {
 *   id: "act-1",
 *   title: "情境导入",
 *   description: "通过生活情境引入分数概念",
 *   duration: 5,
 *   type: "introduction",
 *   instructions: ["展示图片", "提问学生"],
 *   materials: ["PPT课件"],
 *   teacherNotes: "注意观察学生反应"
 * }
 */
export const ActivitySchema = z.object({
  id: z.string().default(() => generateId('act')),
  title: z.string().min(1, '活动标题不能为空'),
  description: z.string().default(''),
  duration: z.number().min(1).max(120).default(10),
  type: ActivityTypeSchema,
  instructions: z.array(z.string()).default([]),
  materials: z.array(z.string()).optional(),
  teacherNotes: z.string().optional(),
}).transform((obj) => ({
  ...obj,
  id: obj.id || generateId('act'),
  // 确保 instructions 是数组
  instructions: Array.isArray(obj.instructions) ? obj.instructions : [],
}));

/**
 * 教学活动数组
 */
export const ActivitiesSchema = z.array(ActivitySchema).default([]);

// ============================================================================
// 评估方案 Schema
// ============================================================================

/**
 * 评估方案
 *
 * @example
 * {
 *   formative: ["课堂观察", "提问检查"],
 *   summative: ["单元测试", "作业评价"],
 *   rubric: "90-100分：优秀..."
 * }
 */
export const AssessmentSchema = z.object({
  formative: z.array(z.string()).default([]),
  summative: z.array(z.string()).default([]),
  rubric: z.string().optional(),
}).default({
  formative: [],
  summative: [],
});

// ============================================================================
// 差异化教学 Schema
// ============================================================================

/**
 * 差异化教学策略
 *
 * @example
 * {
 *   struggling: ["提供额外支持", "使用图示辅助"],
 *   onLevel: ["完成标准任务"],
 *   advanced: ["拓展练习", "担任小老师"],
 *   ell: ["双语词汇表"],
 *   accommodations: ["延长时间"]
 * }
 */
export const DifferentiationSchema = z.object({
  struggling: z.array(z.string()).default([]),
  onLevel: z.array(z.string()).default([]),
  advanced: z.array(z.string()).default([]),
  ell: z.array(z.string()).optional(),
  accommodations: z.array(z.string()).optional(),
}).default({
  struggling: [],
  onLevel: [],
  advanced: [],
});

// ============================================================================
// 字段映射
// ============================================================================

/**
 * 字段名到 Schema 的映射
 */
export const FieldSchemas = {
  title: TitleSchema,
  subject: SubjectSchema,
  gradeLevel: GradeLevelSchema,
  duration: DurationSchema,
  objectives: ObjectivesSchema,
  standards: StandardsSchema,
  materials: MaterialsSchema,
  activities: ActivitiesSchema,
  assessment: AssessmentSchema,
  differentiation: DifferentiationSchema,
} as const;

export type SyncField = keyof typeof FieldSchemas;

// ============================================================================
// 校验和修复函数
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  warnings: string[];
  fixed: boolean;
}

/**
 * 校验并修复字段值
 *
 * @param field - 字段名
 * @param value - 原始值
 * @returns 校验结果，包含修复后的数据
 *
 * @example
 * const result = validateAndFix('objectives', [
 *   { description: "目标1" }  // 缺少 id 和 bloomLevel
 * ]);
 * // result.data = [{ id: "obj-xxx", description: "目标1", bloomLevel: "understand" }]
 * // result.fixed = true
 */
export function validateAndFix<T extends SyncField>(
  field: T,
  value: unknown
): ValidationResult<z.infer<typeof FieldSchemas[T]>> {
  const schema = FieldSchemas[field];

  if (!schema) {
    return {
      success: false,
      data: null,
      errors: [`未知字段: ${field}`],
      warnings: [],
      fixed: false,
    };
  }

  const result = schema.safeParse(value);

  if (result.success) {
    // 检查是否进行了修复（通过比较输入和输出）
    const fixed = JSON.stringify(value) !== JSON.stringify(result.data);

    return {
      success: true,
      data: result.data,
      errors: [],
      warnings: fixed ? [`字段 ${field} 的数据已自动修复`] : [],
      fixed,
    };
  }

  // 解析失败，尝试提取有用信息
  const errors = result.error.errors.map(
    (e) => `${e.path.join('.')}: ${e.message}`
  );

  return {
    success: false,
    data: null,
    errors,
    warnings: [],
    fixed: false,
  };
}

/**
 * 尝试解析 JSON 字符串
 */
export function parseJsonSafely(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // 解析失败，返回原值
      }
    }
  }
  return value;
}

/**
 * 完整的校验和修复流程
 *
 * 1. 尝试解析 JSON 字符串
 * 2. 使用 Zod schema 校验
 * 3. 应用默认值和修复
 */
export function validateAndFixField<T extends SyncField>(
  field: T,
  value: unknown
): ValidationResult<z.infer<typeof FieldSchemas[T]>> {
  // 步骤 1: 尝试解析 JSON
  const parsed = parseJsonSafely(value);

  // 步骤 2: 校验和修复
  return validateAndFix(field, parsed);
}
