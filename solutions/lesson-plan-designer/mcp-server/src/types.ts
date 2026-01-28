/**
 * Lesson Plan Sync Field Types
 * These fields can be synced from Claude to the lesson plan form
 */

export const SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'duration',
  'objectives',
  'standards',
  'materials',
  'activities',
  'assessment',
  'differentiation'
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

/**
 * Bloom's Taxonomy levels for learning objectives
 */
export type BloomLevel =
  | 'remember'
  | 'understand'
  | 'apply'
  | 'analyze'
  | 'evaluate'
  | 'create';

/**
 * Learning objective structure
 */
export interface LearningObjective {
  id: string;
  description: string;
  bloomLevel: BloomLevel;
  assessmentCriteria?: string;
}

/**
 * Activity types
 */
export type ActivityType =
  | 'introduction'
  | 'direct-instruction'
  | 'guided-practice'
  | 'independent-practice'
  | 'group'
  | 'assessment'
  | 'closure';

/**
 * Teaching activity structure
 */
export interface Activity {
  id: string;
  title: string;
  description: string;
  duration: number;
  type: ActivityType;
  instructions: string[];
  materials?: string[];
  teacherNotes?: string;
}

/**
 * Assessment structure
 */
export interface Assessment {
  formative: string[];
  summative: string[];
  rubric?: string;
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
    originalValue?: unknown; // 校验失败时的原始值（用于调试）
  };
  status: 'success' | 'error';
}
