/**
 * LessonRecord — the shape domain code reads from a lesson row.
 *
 * The TypeORM `Lesson` entity in `adapters/persistence/entities/lesson.entity.ts`
 * `implements LessonRecord` — so the TS compiler enforces that the persistence
 * row schema can't drift from what domain expects without an explicit alias.
 */
export interface LessonRecord {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string;
  description: string;
  emoji: string;
  lessonType: string;
  teachingNotes: string;
  manifestJson: string;
  createdAt: string;
  updatedAt: string;
}
