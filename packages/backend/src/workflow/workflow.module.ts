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
import { OpenAiLlmGateway } from './llm/openai-llm-gateway';
import { LLM_GATEWAY } from './llm/llm-gateway';
import { IndicatorRegistryService } from './llm/indicator-registry.service';

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
  ],
  providers: [
    WorkflowRegistry,
    WorkflowMetricsService,
    WorkflowEngineService,
    ObservationRepository,
    ObserverEventRepository,
    // Generic LLM gateway + indicator registry (consumed by
    // solution-specific handlers that live in
    // `@kedge-agentic/<solution>-platform-handlers` packages —
    // phase 5.5).
    OpenAiLlmGateway,
    { provide: LLM_GATEWAY, useExisting: OpenAiLlmGateway },
    IndicatorRegistryService,
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
