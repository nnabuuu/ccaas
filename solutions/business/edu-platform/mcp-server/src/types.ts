export const LESSON_SYNC_FIELDS = [
  'lesson_overview',
  'teaching_objectives',
  'key_points',
  'teaching_process',
  'assessment',
  'homework',
] as const;

export const SYNC_FIELDS = [...LESSON_SYNC_FIELDS] as const;
export type SyncField = typeof SYNC_FIELDS[number];

export interface WriteOutputInput {
  field: string;
  value: unknown;
  preview: string;
}

export interface WriteOutputResult {
  data: {
    field?: string;
    value?: unknown;
    preview?: string;
    error?: string;
  };
  status: 'success' | 'error';
}
