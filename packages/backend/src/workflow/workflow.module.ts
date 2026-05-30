/**
 * `WorkflowModule` — wires the platform's Palantir-Carbon-style
 * trigger engine into NestJS.
 *
 * Provides:
 *   - `WorkflowEngineService` — the dispatcher
 *   - `WorkflowRegistry` — trigger index
 *   - `WorkflowMetricsService` — counters
 *   - `ObservationRepository` + `ObserverEventRepository` — persistence
 *   - `POST /api/v1/workflow/sessions/:sessionId/events` ingest endpoint
 *
 * Imports `OntologyModule` for `ManifestAccessorService` (the engine's
 * `onStateChange` hook + per-session `getAccessorFor`). The Phase 3
 * `ToolCallerProxy` audit pipeline is reached transitively through
 * the accessor's `invokeAction`.
 *
 * Discovery: Nest's `DiscoveryService` + `MetadataScanner` scan every
 * `@Injectable()` provider for `@WorkflowTrigger(def)` metadata at
 * `onApplicationBootstrap` (after every solution registrar's
 * `onModuleInit`, before the ontology seal stage). Solutions register
 * their triggers either programmatically (matches
 * `LiveLessonOntologyService`'s pattern) or via the decorator.
 *
 * Dead-code from the runtime perspective until M2's `JoinTrigger` lands.
 */

import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OntologyModule } from '../ontology/ontology.module';
import { ToolCallerModule } from '../tool-caller/tool-caller.module';
import { ObservationRecord, ObserverEventRecord } from './entities';
import { ObservationRepository } from './persistence/observation-repository';
import { ObserverEventRepository } from './persistence/observer-event-repository';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowMetricsService } from './workflow-metrics.service';
import { WorkflowRegistry } from './workflow-registry';
import { EventIngestController } from './event-ingest/event-ingest.controller';
import { LifecycleObservationService } from './handlers/lifecycle/lifecycle-observation.service';
import { ExerciseObservationService } from './handlers/exercise/exercise-observation.service';
import { ProgressObservationService } from './handlers/progress/progress-observation.service';
import { ObservationDashboardProjector } from './handlers/dashboard/observation-dashboard.projector';
import { ObservationDashboardController } from './handlers/dashboard/observation-dashboard.controller';

@Module({
  imports: [
    OntologyModule,
    ToolCallerModule,
    DiscoveryModule,
    TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
  ],
  controllers: [EventIngestController, ObservationDashboardController],
  providers: [
    WorkflowRegistry,
    WorkflowMetricsService,
    WorkflowEngineService,
    ObservationRepository,
    ObserverEventRepository,
    // Phase 5 M2: first trigger + action registrar.
    LifecycleObservationService,
    // Phase 5 M3: simple-handler triggers + actions.
    ExerciseObservationService,
    ProgressObservationService,
    // Phase 5 M3: Path B projector — exposed via ObservationDashboardController.
    ObservationDashboardProjector,
  ],
  exports: [
    WorkflowEngineService,
    WorkflowRegistry,
    WorkflowMetricsService,
    ObservationRepository,
    ObserverEventRepository,
  ],
})
export class WorkflowModule {}
