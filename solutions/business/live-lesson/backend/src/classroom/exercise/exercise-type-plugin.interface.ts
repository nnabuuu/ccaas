/**
 * Exercise Type Plugin Interface
 *
 * One plugin class = one exercise type's complete backend logic.
 * Replaces the current pattern of scattered sanitizer/grader/check-items
 * registrations across multiple files.
 *
 * See: solutions/business/live-lesson/docs/exercise-plugin-architecture.zh-CN.md
 */
import type { z } from 'zod';
import type { GradeResult } from '../../schemas';
import type { ExerciseSpec } from '../../schemas/exercise-spec.schema';

/** Context passed to plugin.sanitize() */
export interface SanitizeContext {
  /** Raw answer key (parsed JSON, may not yet be schema-validated) */
  answerKey: Record<string, unknown>;
  /** Display label for the exercise (from manifest readingStep.exerciseLabel) */
  exerciseLabel?: string;
  /** For 'map' type with random practice — IDs of items the student must place */
  practiceItemIds?: string[];
}

/** Context passed to plugin.grade() */
export interface GradeContext {
  /** Validated answer key (after answerKeySchema.parse) */
  key: Record<string, unknown>;
  /** Student submission data */
  data: Record<string, unknown>;
}

/** Context passed to plugin.buildCheckItems() */
export interface CheckItemContext {
  /** Validated answer key */
  key: Record<string, unknown>;
  /** Student submission data */
  data: Record<string, unknown>;
  /** Result from plugin.grade() */
  gradeResult: GradeResult;
}

/**
 * Unified interface for an exercise type's backend logic.
 *
 * Required: `type`, `answerKeySchema`, `grade`.
 * Optional (during migration): `sanitize`, `buildCheckItems` — when not provided,
 * registry callers should fall back to legacy code paths.
 */
export interface ExerciseTypePlugin {
  /** Unique type identifier, e.g. 'quiz', 'match', 'long-division' */
  readonly type: string;

  /** Zod schema for validating this type's answerKey (must include `type: z.literal(...)`) */
  readonly answerKeySchema: z.ZodType<unknown>;

  /**
   * Grade the student submission against the answer key.
   * AI-graded types may return a Promise.
   */
  grade(ctx: GradeContext): GradeResult | Promise<GradeResult>;

  /**
   * Strip answer data from answerKey to produce a student-safe ExerciseSpec.
   * Optional during migration — when not implemented, the legacy `sanitizeAnswerKey()`
   * function in `schemas/manifest.utils.ts` is used.
   */
  sanitize?(ctx: SanitizeContext): ExerciseSpec | null;

  /**
   * Build per-item check feedback (idx, correct, hint, walkthrough, ...).
   * Optional during migration — when not implemented, the legacy `buildCheckItems()`
   * function in `exercise/build-check-items.ts` is used.
   */
  buildCheckItems?(ctx: CheckItemContext): Array<Record<string, unknown>>;
}
