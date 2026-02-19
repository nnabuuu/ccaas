/**
 * SKILL.md Frontmatter Schema
 *
 * Zod schemas and TypeScript types for SKILL.md YAML frontmatter validation.
 * Used by the skill metadata parser to extract structured metadata from
 * SKILL.md files in solution skill directories.
 *
 * Standard format (name + description only):
 * ```yaml
 * ---
 * name: three-column-analysis
 * description: 三栏布局题目分析
 * ---
 * ```
 */

import { z } from 'zod';

// ============================================================================
// Skill Frontmatter Schema
// ============================================================================

export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1, 'Skill name is required'),
  description: z.string().min(1, 'Skill description is required'),
});

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

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export type SkillFrontmatterValidationError = {
  path: string;
  message: string;
  code: string;
};

export type SkillFrontmatterResult =
  | { success: true; data: SkillFrontmatter }
  | { success: false; errors: SkillFrontmatterValidationError[] };
