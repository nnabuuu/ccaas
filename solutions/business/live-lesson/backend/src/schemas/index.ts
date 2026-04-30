// Answer key schemas + types
export {
  AnswerKeySchema,
  validateAnswerKey,
  type AnswerKey,
  type QuizAnswerKey,
  type MatchAnswerKey,
  type MatrixAnswerKey,
  type StanceAnswerKey,
  type OrderAnswerKey,
  type SelectEvidenceAnswerKey,
  type MapAnswerKey,
  type ValidationResult,
} from './answer-key.schema';

// Grade result
export { GradeResultSchema, type GradeResult } from './grade-result.schema';

// Exercise spec (student-safe)
export { ExerciseSpecSchema, type ExerciseSpec } from './exercise-spec.schema';

// Task map
export type { TaskMap } from './task-map.schema';

// Manifest
export {
  ManifestSchema, ReadingStepSchema,
  PersonalTouchSchema, BonusArticleSchema, BonusStepSchema,
  type Manifest, type ReadingStep, type PersonalTouch, type BonusArticle, type BonusStep,
} from './manifest.schema';

// Sanitize utilities
export { sanitizeAnswerKey, sanitizeManifest } from './manifest.utils';
