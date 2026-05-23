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
  type ImageUploadAnswerKey,
  type RichContentQuizAnswerKey,
  type RichContentPart,
  type FillBlankAnswerKey,
  type GuidedDiscoveryAnswerKey,
  type GuidedDiscoveryStep,
  type ValidationResult,
} from './answer-key.schema';

// Grade result
export { GradeResultSchema, type GradeResult } from './grade-result.schema';

// Exercise spec (student-safe)
export { ExerciseSpecSchema, type ExerciseSpec } from './exercise-spec.schema';

// Task map
export type { TaskMap } from './task-map.schema';

// Board data
export {
  BoardDataSchema, BoardBlockSchema, BoardStepSchema,
  type BoardData, type BoardBlock, type BoardStep,
} from './board-data.schema';

// Manifest
export {
  ManifestSchema, ReadingStepSchema,
  PersonalTouchSchema, BonusArticleSchema, BonusStepSchema,
  type Manifest, type ReadingStep, type PersonalTouch, type BonusArticle, type BonusStep,
} from './manifest.schema';

// Manifest helpers (sanitize moved to ExerciseTypeRegistry — see
// classroom/exercise/exercise-type-registry.ts for the canonical dispatch)
export { seededShuffle } from './manifest.utils';

// Observation (unified observability)
export {
  ObserveDimensionSchema, ObserveIssueRuleSchema, ObserveSurfaceSchema,
  ObservationDefSchema, ObserveDefinitionSchema,
  type ObserveDimension, type ObserveIssueRule, type ObserveSurface,
  type ObservationDef, type ObserveDefinition,
} from './observation.schema';

export { resolveObserve, buildRegistry, resolveGlobalObservations, type ResolvedObserve } from './observation-resolver';

// Classroom response types
export * from './classroom';
