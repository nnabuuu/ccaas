import { Injectable, Logger } from '@nestjs/common';
import type { GradeResult } from '../../schemas';
import { ExerciseTypeRegistry } from './exercise-type-registry';

/**
 * Dispatches grading to the registered exercise-type plugin.
 *
 * Stage 6: legacy `graders` dict removed. All grading flows through
 * ExerciseTypeRegistry. Plugins that need AI grading inject AiPromptBuilder
 * themselves via NestJS DI.
 */
@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(private readonly registry: ExerciseTypeRegistry) {}

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
