import type { LessonRecord } from '../types/lesson';

export const LESSON_REPO_PORT = Symbol('LessonRepoPort');

export interface LessonSeedFields {
  id: string;
  lessonType: string;
  description: string;
}

export interface LessonListItem {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  description: string;
  emoji: string;
  lessonType: string;
}

export interface LessonInsert {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  description: string;
  emoji: string;
  lessonType: string;
  teachingNotes: string;
  manifestJson: string;
}

export interface LessonRepoPort {
  findById(id: string): Promise<LessonRecord | null>;
  findByIds(ids: string[]): Promise<LessonRecord[]>;
  /** Seed-time snapshot of (id, lessonType, description) for backfill decisions. */
  findAllSeedFields(): Promise<LessonSeedFields[]>;
  /** Public lesson list — no manifestJson, no teachingNotes. */
  findAllForList(): Promise<LessonListItem[]>;
  insert(rec: LessonInsert): Promise<void>;
  save(record: LessonRecord): Promise<LessonRecord>;
  update(id: string, patch: Partial<LessonRecord>): Promise<void>;
}
