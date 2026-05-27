import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ProjectModule } from '../../project/project.module';
import { TeachingRequirementsModule } from '../../teaching-requirements/teaching-requirements.module';
import { AiPromptBuilder } from '../ai/ai-prompt-builder';
import { AuditController } from './audit.controller';
import { AuditPromptBuilder } from './audit-prompt-builder';
import { AuditService } from './audit.service';

/**
 * AI audit module. Wires the service + prompt builder + controller.
 *
 * No `forwardRef(() => ProjectModule)` because the lint → audit
 * refactor severed the circular dependency: ProjectService no longer
 * imports AuditService (auto-trigger was removed). AuditService still
 * imports ProjectService for file reads, but the relationship is now
 * a clean one-way edge.
 *
 * AiPromptBuilder is also provided by ClassroomModule. Declaring it
 * here gives the audit path its own instance — same as the lint impl
 * did before this refactor. ConfigService comes from the global
 * ConfigModule.forRoot in AppModule.
 */
@Module({
  imports: [ConfigModule, ProjectModule, TeachingRequirementsModule],
  providers: [AuditService, AuditPromptBuilder, AiPromptBuilder],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
