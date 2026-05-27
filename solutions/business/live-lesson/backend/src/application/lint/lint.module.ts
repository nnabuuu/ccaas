import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ProjectModule } from '../../project/project.module';
import { TeachingRequirementsModule } from '../../teaching-requirements/teaching-requirements.module';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { LintController } from './lint.controller';
import { LintPromptBuilder } from './lint-prompt-builder';
import { LintService } from './lint.service';

/**
 * AI lint cross-check (plan vs execution manifest). Wires the service +
 * its prompt builder + controller.
 *
 * `forwardRef(() => ProjectModule)`: ProjectService also depends on
 * LintService (writeFile / upsertArtifact fire-and-forget enqueue), so
 * Nest needs the forward reference to break the cycle at module-init
 * time.
 *
 * AiPromptBuilder is also provided by ClassroomModule. Declaring it
 * here gives the lint path its own instance, which is fine because the
 * builder's only state (`globalTracer`) is unused by lint — every call
 * goes through `callLlm` without setting a tracer. ConfigService comes
 * from the global ConfigModule.forRoot in AppModule.
 */
@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ProjectModule),
    TeachingRequirementsModule,
  ],
  providers: [LintService, LintPromptBuilder, AiPromptBuilder],
  controllers: [LintController],
  exports: [LintService],
})
export class LintModule {}
