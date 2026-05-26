import { Module } from '@nestjs/common';

import { TeachingRequirementsController } from './teaching-requirements.controller';
import { TeachingRequirementsService } from './teaching-requirements.service';

/**
 * TeachingRequirementsModule — L1 library subsystem.
 *
 * L2 (per-user interpretation) wiring follows in a later commit and
 * is added to this same module so the composite GET /:id endpoint
 * stays in one place.
 *
 * Exported for ccaas materializer integration: the cross-process call
 * `ccaas → live-lesson GET /api/teaching-requirements?subject=X` is the
 * only consumer ccaas needs from this module.
 */
@Module({
  controllers: [TeachingRequirementsController],
  providers: [TeachingRequirementsService],
  exports: [TeachingRequirementsService],
})
export class TeachingRequirementsModule {}
