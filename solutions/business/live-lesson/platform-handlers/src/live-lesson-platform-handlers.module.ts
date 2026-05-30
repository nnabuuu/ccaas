/**
 * `LiveLessonPlatformHandlersModule` — phase 5.5.
 *
 * In-process bundle of live-lesson-specific platform extensions:
 *   - ontology registrar (`LiveLessonOntologyService`) — wires
 *     `LessonSessionManifest` + object types + custom actions into
 *     the platform's `OntologyRegistry` at `onModuleInit`.
 *   - workflow handlers — register triggers + ActionDef toolkits
 *     against the platform's generic `WorkflowEngineService` +
 *     `SolutionToolkitRegistry` at `onApplicationBootstrap`.
 *   - dashboard endpoints — `GET /api/v1/workflow/sessions/:id/
 *     {observation-dashboard,dashboard}` for the live-lesson teacher
 *     UI.
 *
 * Loaded into the ccaas backend at boot via `PLATFORM_HANDLER_PACKAGES`
 * env var. `@kedge-agentic/backend` has zero compile-time knowledge
 * of this package — `packages/backend/src/main.ts` dynamically
 * `await import()`s the package by name and passes the module into
 * `AppModule.register({ extraModules: [...] })`.
 *
 * Platform modules (`WorkflowModule`, `OntologyModule`, `ToolCallerModule`,
 * `SolutionsModule`) are imported as **runtime peer dependencies**
 * — see `package.json:peerDependencies` for the full list. The DI
 * tree is wired in `register()` so the dynamic import in
 * `main.ts` can hand back a fully-configured `DynamicModule`.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OntologyModule } from '@kedge-agentic/backend/ontology/ontology.module';
import { WorkflowModule } from '@kedge-agentic/backend/workflow/workflow.module';
import { ToolCallerModule } from '@kedge-agentic/backend/tool-caller/tool-caller.module';
import { SolutionsModule } from '@kedge-agentic/backend/solutions/solutions.module';
import {
  ObservationRecord,
  ObserverEventRecord,
} from '@kedge-agentic/backend/workflow/entities';
import { LiveLessonOntologyService } from './ontology/live-lesson-ontology.service';
import { LifecycleObservationService } from './workflow-handlers/lifecycle/lifecycle-observation.service';
import { ExerciseObservationService } from './workflow-handlers/exercise/exercise-observation.service';
import { ProgressObservationService } from './workflow-handlers/progress/progress-observation.service';
import { ChatTurnService } from './workflow-handlers/chat-turn/chat-turn.service';
import { StatusChangeService } from './workflow-handlers/status-change/status-change.service';
import { ObservationDashboardProjector } from './workflow-handlers/dashboard/observation-dashboard.projector';
import { ObservationDashboardController } from './workflow-handlers/dashboard/observation-dashboard.controller';
import { DashboardService } from './workflow-handlers/dashboard/dashboard.service';
import { DashboardController } from './workflow-handlers/dashboard/dashboard.controller';

@Module({
  imports: [
    OntologyModule,
    WorkflowModule,
    ToolCallerModule,
    SolutionsModule,
    TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
  ],
  controllers: [
    ObservationDashboardController,
    DashboardController,
  ],
  providers: [
    LiveLessonOntologyService,
    LifecycleObservationService,
    ExerciseObservationService,
    ProgressObservationService,
    ChatTurnService,
    StatusChangeService,
    ObservationDashboardProjector,
    DashboardService,
  ],
})
export class LiveLessonPlatformHandlersModule {}
