/**
 * Utilities
 *
 * Common utility functions for the CCAAS Vue SDK.
 * Includes field mapping between backend output_update fields and frontend form fields,
 * and safe Zod validation wrappers.
 */

import { OutputUpdateEventSchema } from '@ccaas/shared'

export const CCAAS_VERSION = '1.0.0'

// ============================================================================
// Field Mappings
// ============================================================================

/**
 * Mapping from backend output_update field names to frontend form field names.
 * Keys are the field names used in write_output / output_update events,
 * values are the corresponding frontend form field names.
 */
export const FIELD_MAPPINGS: Record<string, string> = {
  courseRequirements: 'courseRequirements',
  textbookAnalysis: 'textbookAnalysis',
  studentAnalysis: 'studentAnalysis',
  learningObjectives: 'learningObjectives',
  preClassPreparation: 'preClassPreparation',
  learningProcess: 'learningProcess',
  homeworkAssessment: 'homeworkAssessment',
}

/**
 * Reverse mapping: frontend form field names → backend output field names.
 */
export const REVERSE_FIELD_MAPPINGS: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_MAPPINGS).map(([k, v]) => [v, k])
)

/**
 * All known lesson plan field names (union of backend and frontend names).
 */
export const ALL_LESSON_PLAN_FIELDS: string[] = [
  ...new Set([...Object.keys(FIELD_MAPPINGS), ...Object.values(FIELD_MAPPINGS)]),
]

/**
 * Convert a backend output field name to the frontend form field name.
 */
export function toFrontendField(backendField: string): string {
  return FIELD_MAPPINGS[backendField] ?? backendField
}

/**
 * Convert a frontend form field name to the backend output field name.
 */
export function toBackendField(frontendField: string): string {
  return REVERSE_FIELD_MAPPINGS[frontendField] ?? frontendField
}

/**
 * Map an object's keys from backend field names to frontend field names.
 */
export function mapFieldsToFrontend(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    result[toFrontendField(key)] = value
  }
  return result
}

/**
 * Map an object's keys from frontend field names to backend field names.
 */
export function mapFieldsToBackend(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    result[toBackendField(key)] = value
  }
  return result
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Safely validate a raw event against the OutputUpdateEvent schema.
 * Returns a Zod SafeParseReturnType (never throws).
 */
export function safeValidateOutputUpdateEvent(event: unknown) {
  return OutputUpdateEventSchema.safeParse(event)
}
