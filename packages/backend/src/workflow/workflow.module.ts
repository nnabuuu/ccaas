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
import { IndicatorIngestController } from './indicator-ingest/indicator-ingest.controller';
import { SessionLifecycleController } from './session-lifecycle/session-lifecycle.controller';
import { LifecycleObservationService } from './handlers/lifecycle/lifecycle-observation.service';
import { ExerciseObservationService } from './handlers/exercise/exercise-observation.service';
import { ProgressObservationService } from './handlers/progress/progress-observation.service';
import { DashboardService } from './handlers/dashboard/dashboard.service';
import { DashboardController } from './handlers/dashboard/dashboard.controller';
import { OpenAiLlmGateway } from './llm/openai-llm-gateway';
import { LLM_GATEWAY } from './llm/llm-gateway';
import { IndicatorRegistryService } from './llm/indicator-registry.service';
import { ChatTurnService } from './handlers/chat-turn/chat-turn.service';
import { StatusChangeService } from './handlers/status-change/status-change.service';

@Module({
  imports: [
    OntologyModule,
    ToolCallerModule,
    DiscoveryModule,
    TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
  ],
  controllers: [
    EventIngestController,
    IndicatorIngestController,
    SessionLifecycleController,
    DashboardController,
  ],
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
    // Phase 5 M5.2: ontology-native dashboard service + controller.
    // (Legacy `ObservationDashboardProjector` + its controller deleted
    // in M5.2a — live-lesson now derives the legacy shape from the
    // new payload via `DashboardPayloadAdapter`.)
    DashboardService,
    // Phase 5 M4: LLM gateway + indicator registry + LLM handlers.
    OpenAiLlmGateway,
    { provide: LLM_GATEWAY, useExisting: OpenAiLlmGateway },
    IndicatorRegistryService,
    ChatTurnService,
    StatusChangeService,
  ],
  exports: [
    WorkflowEngineService,
    WorkflowRegistry,
    WorkflowMetricsService,
    ObservationRepository,
    ObserverEventRepository,
    LLM_GATEWAY,
    IndicatorRegistryService,
  ],
})
export class WorkflowModule {}
