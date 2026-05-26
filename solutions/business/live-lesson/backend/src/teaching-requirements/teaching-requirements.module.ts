import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RequirementInterpretation } from './requirement-interpretation.entity';
import { RequirementInterpretationService } from './requirement-interpretation.service';
import { TeachingRequirementsController } from './teaching-requirements.controller';
import { TeachingRequirementsService } from './teaching-requirements.service';

/**
 * TeachingRequirementsModule — L1 library subsystem + L2 per-user
 * interpretation overlay.
 *
 * Exports both services so the materializer module (or any future
 * consumer) can ask for them without re-importing the whole module.
 * Cross-process consumers (ccaas materializer) use the REST API, not
 * direct injection.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RequirementInterpretation])],
  controllers: [TeachingRequirementsController],
  providers: [TeachingRequirementsService, RequirementInterpretationService],
  exports: [TeachingRequirementsService, RequirementInterpretationService],
})
export class TeachingRequirementsModule {}
