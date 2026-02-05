/**
 * Lesson Plan Sync Field Types
 * These fields can be synced from Claude to the lesson plan form
 */

export const SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'durationMinutes',
  'lessonPlanCode',
  'objectives',
  'content',
  'teachingMethods',
  'materialsNeeded',
  'assessmentMethods',
  'curriculumRequirements',
  'studentAnalysis',
  'extraProperties',
  'status',
  'attachments',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

/**
 * LessonPlanAttachment type
 */
export interface LessonPlanAttachment {
  id: string;
  fileId: string;
  fileName: string;
  fileType: 'script' | 'audio' | 'ppt' | 'pdf' | 'other';
  mimeType: string;
  size: number;
  downloadUrl: string;
  uploadedAt: string;
  description?: string;
}

/**
 * write_output tool input
 */
export interface WriteOutputInput {
  field: SyncField;
  value: unknown;
  preview: string;
}

/**
 * write_output tool result format
 * This matches what CCAAS EventMapper expects
 */
export interface WriteOutputResult {
  data: {
    field?: SyncField;
    value?: unknown;
    preview?: string;
    error?: string;
    originalValue?: unknown;
  };
  status: 'success' | 'error';
}
