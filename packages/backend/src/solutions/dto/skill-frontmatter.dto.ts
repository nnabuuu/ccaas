/**
 * SKILL.md Frontmatter Schema
 *
 * Zod schemas and TypeScript types for SKILL.md YAML frontmatter validation.
 * Used by the skill metadata parser to extract structured metadata from
 * SKILL.md files in solution skill directories.
 *
 * Example frontmatter:
 * ```yaml
 * ---
 * name: three-column-analysis
 * slug: three-column-analysis
 * description: 三栏布局题目分析
 * scope: tenant
 * triggers:
 *   - type: keyword
 *     value: "请帮我分析这道题目"
 *     priority: 11
 * allowedTools:
 *   - parse_quiz_content
 * ---
 * ```
 */

import { z } from 'zod';

// ============================================================================
// Trigger Schema
// ============================================================================

export const SkillTriggerTypeSchema = z.enum([
  'keyword',
  'pattern',
  'intent',
  'context',
]);

export const SkillTriggerSchema = z.object({
  type: SkillTriggerTypeSchema,
  value: z.string().min(1, 'Trigger value must not be empty'),
  priority: z
    .number()
    .int('Priority must be an integer')
    .min(1, 'Priority must be at least 1')
    .max(100, 'Priority must be at most 100')
    .default(5),
  description: z.string().optional(),
});

// ============================================================================
// Scope Schema
// ============================================================================

export const SkillScopeSchema = z.enum(['tenant', 'global']);

// ============================================================================
// Skill Frontmatter Schema
// ============================================================================

export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  slug: z
    .string()
    .min(1, 'Skill slug is required')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase alphanumeric with hyphens (e.g., "my-skill-name")',
    ),
  description: z.string().min(1, 'Skill description is required'),
  scope: SkillScopeSchema.default('tenant'),
  triggers: z.array(SkillTriggerSchema).optional().default([]),
  allowedTools: z.array(z.string().min(1)).optional().default([]),
});

// ============================================================================
// Partial Schema (for merge/override scenarios)
// ============================================================================

export const SkillFrontmatterPartialSchema = SkillFrontmatterSchema.partial();

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validate raw YAML-parsed frontmatter data against the schema.
 * Returns a discriminated result with either parsed data or error details.
 */
export function validateSkillFrontmatter(data: unknown): SkillFrontmatterResult {
  const result = SkillFrontmatterSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  };
}

// ============================================================================
// Inferred Types
// ============================================================================

export type SkillTriggerType = z.infer<typeof SkillTriggerTypeSchema>;
export type SkillTrigger = z.infer<typeof SkillTriggerSchema>;
export type SkillScope = z.infer<typeof SkillScopeSchema>;
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;
export type SkillFrontmatterPartial = z.infer<typeof SkillFrontmatterPartialSchema>;

export type SkillFrontmatterValidationError = {
  path: string;
  message: string;
  code: string;
};

export type SkillFrontmatterResult =
  | { success: true; data: SkillFrontmatter }
  | { success: false; errors: SkillFrontmatterValidationError[] };
