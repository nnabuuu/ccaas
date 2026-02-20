/**
 * Lesson Plan Field Schemas
 *
 * Zod schemas for validating write_output tool input data.
 * All content fields are plain strings. Only extraProperties is a record.
 *
 * @module schemas
 */

import { z } from 'zod';

// ============================================================================
// Field Schemas
// ============================================================================

export const TitleSchema = z.string().min(1, '标题不能为空');
export const SubjectSchema = z.string().min(1, '学科不能为空');
export const GradeLevelSchema = z.number().int().min(1).max(12);
export const DurationMinutesSchema = z.number().int().min(1).max(600);
export const LessonPlanCodeSchema = z.string();
export const ObjectivesSchema = z.string();
export const ContentSchema = z.string();
export const TeachingMethodsSchema = z.string();
export const MaterialsNeededSchema = z.string();
export const AssessmentMethodsSchema = z.string();
export const CurriculumStandardSchema = z.object({
  id: z.number(),
  standardCode: z.string(),
  title: z.string(),
  stage: z.string(),
  standardType: z.string(),
  contentDomain: z.string(),
});
export const CurriculumRequirementsSchema = z.array(CurriculumStandardSchema);
export const StudentAnalysisSchema = z.string();
export const ExtraPropertiesSchema = z.record(z.string(), z.string());
export const StatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);

// Attachment schema
export const LessonPlanAttachmentSchema = z.object({
  id: z.string().uuid(),
  fileId: z.string().uuid(),
  fileName: z.string(),
  fileType: z.enum(['script', 'audio', 'ppt', 'pdf', 'other']),
  mimeType: z.string(),
  size: z.number(),
  downloadUrl: z.string(),
  uploadedAt: z.string(),
  description: z.string().optional(),
});
export const AttachmentsSchema = z.array(LessonPlanAttachmentSchema);

// ============================================================================
// Field mapping
// ============================================================================

export const FieldSchemas = {
  title: TitleSchema,
  subject: SubjectSchema,
  gradeLevel: GradeLevelSchema,
  durationMinutes: DurationMinutesSchema,
  lessonPlanCode: LessonPlanCodeSchema,
  objectives: ObjectivesSchema,
  content: ContentSchema,
  teachingMethods: TeachingMethodsSchema,
  materialsNeeded: MaterialsNeededSchema,
  assessmentMethods: AssessmentMethodsSchema,
  curriculumRequirements: CurriculumRequirementsSchema,
  studentAnalysis: StudentAnalysisSchema,
  extraProperties: ExtraPropertiesSchema,
  status: StatusSchema,
  attachments: AttachmentsSchema,
} as const;

export type SyncField = keyof typeof FieldSchemas;

// ============================================================================
// Validation functions
// ============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data: T | null;
  errors: string[];
  warnings: string[];
  fixed: boolean;
}

/**
 * Validate and fix a field value
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
    const fixed = JSON.stringify(value) !== JSON.stringify(result.data);
    return {
      success: true,
      data: result.data,
      errors: [],
      warnings: fixed ? [`字段 ${field} 的数据已自动修复`] : [],
      fixed,
    };
  }

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
 * Try to parse JSON string
 */
export function parseJsonSafely(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Parse failed, return original
      }
    }
  }
  return value;
}

/**
 * Full validation and fix pipeline:
 * 1. Try parsing JSON string
 * 2. Validate with Zod schema
 */
export function validateAndFixField<T extends SyncField>(
  field: T,
  value: unknown
): ValidationResult<z.infer<typeof FieldSchemas[T]>> {
  const parsed = parseJsonSafely(value);
  return validateAndFix(field, parsed);
}
