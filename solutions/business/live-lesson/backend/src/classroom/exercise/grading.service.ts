import { Injectable, Logger } from '@nestjs/common';
import type { GradeResult } from '../../schemas';
import { AiPromptBuilder } from '../ai-prompt-builder';
import { ExerciseTypeRegistry } from './exercise-type-registry';

/**
 * Dispatches grading to the registered exercise-type plugin.
 *
 * Stage 6 (post-migration): the legacy `graders` dict has been removed. All
 * grading now flows through ExerciseTypeRegistry, which is mandatory.
 *
 * AiPromptBuilder is still injected for backward-compatible DI signature
 * (some callers construct GradingService directly) but is no longer used —
 * plugins receive their own AiPromptBuilder via NestJS DI.
 */
@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private readonly aiPromptBuilder: AiPromptBuilder,
    private readonly registry: ExerciseTypeRegistry,
  ) {}

  async grade(rawKey: unknown, data: Record<string, unknown>): Promise<GradeResult | null> {
    if (!rawKey) return null;
    const type = (rawKey as { type?: string })?.type;
    if (!type) return null;
    if (!this.registry.has(type)) {
      this.logger.warn(`No plugin registered for exercise type "${type}"`);
      return null;
    }
    return this.registry.grade(rawKey, data);
  }
}
