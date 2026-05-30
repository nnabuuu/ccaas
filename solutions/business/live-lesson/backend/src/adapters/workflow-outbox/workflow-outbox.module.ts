/**
 * `WorkflowOutboxModule` — bundles the live-lesson side of the M2
 * cross-process loop:
 *   - `OntologyEventOutbox` entity registration
 *   - `WorkflowOutboxRepository` thin typeorm wrapper
 *   - `WorkflowDispatchService` — application-layer enqueue API
 *   - `WorkflowOutboxDrainService` — boot-time worker that pushes
 *
 * `WorkflowDispatchService` is exported so other application services
 * (ClassroomService, StudentSubmissionService, DiscussService) can
 * inject it for dual-write alongside the legacy `engine.dispatch(...)`.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OntologyEventOutbox } from '../persistence/entities/ontology-event-outbox.entity';
import { WorkflowDispatchService } from './workflow-dispatch.service';
import { WorkflowIndicatorPushService } from './workflow-indicator-push.service';
import { WorkflowOutboxDrainService } from './workflow-outbox-drain.service';
import { WorkflowOutboxRepository } from './workflow-outbox.repository';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([OntologyEventOutbox]),
  ],
  providers: [
    WorkflowOutboxRepository,
    WorkflowDispatchService,
    WorkflowIndicatorPushService,
    WorkflowOutboxDrainService,
  ],
  exports: [WorkflowDispatchService, WorkflowIndicatorPushService],
})
export class WorkflowOutboxModule {}
