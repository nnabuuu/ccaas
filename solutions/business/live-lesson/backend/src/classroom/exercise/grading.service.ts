import { Injectable, Logger, Optional } from '@nestjs/common';
import { AnswerKeySchema } from '../../schemas';
import type { AnswerKey, GradeResult } from '../../schemas';
import type { Grader } from './graders/grader.interface';
import { QuizGrader } from './graders/quiz.grader';
import { MatchGrader } from './graders/match.grader';
import { MatrixGrader } from './graders/matrix.grader';
import { StanceGrader } from './graders/stance.grader';
import { OrderGrader } from './graders/order.grader';
import { SelectEvidenceGrader } from './graders/select-evidence.grader';
import { MapGrader } from './graders/map.grader';
import { ImageUploadGrader } from './graders/image-upload.grader';
import { FillBlankGrader } from './graders/fill-blank.grader';
import { GuidedDiscoveryGrader } from './graders/guided-discovery.grader';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { ExerciseTypeRegistry } from './exercise-type-registry';

/**
 * Dispatches grading to the appropriate handler.
 *
 * After Stage 6 plugin migration:
 *   1. Prefer ExerciseTypeRegistry (all 11 types registered) — production path
 *   2. Fall back to the legacy `graders` dict — kept solely so the existing
 *      TestingModule-based unit specs continue to pass without rewiring.
 *
 * The fallback is dead code in production (registry is always wired by
 * ClassroomModule). A follow-up Stage 6.5 will rewrite the 7 affected spec
 * files to inject the registry, after which the dict can be deleted.
 */
@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);
  private readonly graders: Record<string, Grader>;

  constructor(
    private readonly aiPromptBuilder: AiPromptBuilder,
    @Optional() private readonly registry: ExerciseTypeRegistry | null = null,
  ) {
    this.graders = {
      quiz: new QuizGrader(),
      match: new MatchGrader(),
      matrix: new MatrixGrader(aiPromptBuilder),
      stance: new StanceGrader(),
      order: new OrderGrader(),
      'select-evidence': new SelectEvidenceGrader(),
      map: new MapGrader(aiPromptBuilder),
      'image-upload': new ImageUploadGrader(aiPromptBuilder),
      'rich-content-quiz': new ImageUploadGrader(aiPromptBuilder),
      'fill-blank': new FillBlankGrader(aiPromptBuilder),
      'guided-discovery': new GuidedDiscoveryGrader(aiPromptBuilder),
    };
  }

  async grade(rawKey: unknown, data: Record<string, unknown>): Promise<GradeResult | null> {
    if (!rawKey) return null;

    // Step 1: try plugin registry first (production path)
    const type = (rawKey as { type?: string })?.type;
    if (this.registry && type && this.registry.has(type)) {
      const pluginResult = await this.registry.grade(rawKey, data);
      if (pluginResult !== null) return pluginResult;
    }

    // Step 2: fall back to legacy grader dict (kept only for TestingModule specs)
    const parsed = AnswerKeySchema.safeParse(rawKey);
    if (!parsed.success) return null;
    const key: AnswerKey = parsed.data;
    const grader = this.graders[key.type];
    if (!grader) return null;
    return grader.grade(key, data);
  }
}
