import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Student } from '../adapters/persistence/entities/student.entity';
import { Submission } from '../adapters/persistence/entities/submission.entity';
import { ClassroomSession } from '../adapters/persistence/entities/classroom-session.entity';
import { AiQuestion } from '../adapters/persistence/entities/ai-question.entity';
import { ChatMessage } from '../adapters/persistence/entities/chat-message.entity';
import { ClassroomSnapshot } from '../adapters/persistence/entities/classroom-snapshot.entity';
import { Lesson } from '../adapters/persistence/entities/lesson.entity';
import { DiscussHighlight } from '../adapters/persistence/entities/discuss-highlight.entity';
import { DiscussTargetHit } from '../adapters/persistence/entities/discuss-target-hit.entity';
import { ObservationRecord, ObserverEventRecord } from '@kedge-agentic/observer-engine';
import {
  ObserverEngine,
  TypeormObservationStore,
  TypeormEventStore,
  OBSERVER_ENGINE,
  OBSERVER_HANDLER_METADATA,
} from '@kedge-agentic/observer-engine';
import type { ObserverEvent, HandlerContext, HandlerResult, LlmGateway, NotifySink } from '@kedge-agentic/observer-engine';

// ── Infra ──
import { ClassroomService } from '../application/classroom/classroom.service';
import { ClassroomBroadcastService } from '../adapters/transport/classroom-broadcast.service';
import { ClassroomStateService } from '../application/classroom/classroom-state.service';
import { StudentSubmissionService } from '../application/classroom/student-submission.service';
import { ClassroomController } from '../adapters/http/classroom.controller';
import { AiPromptBuilder } from '../application/ai/ai-prompt-builder';
import { LLM_PORT } from '../domain/ports/llm.port';
import { MetricsAggregator } from '../domain/classroom/metrics-aggregator';
import { ManifestCacheService } from '../application/classroom/manifest-cache.service';
import { ObserveRegistry } from '../application/observation/observe-registry';
import { QuizObserveHandler } from '../domain/exercise-types/quiz/quiz.observe';
import { SelectEvidenceObserveHandler } from '../domain/exercise-types/select-evidence/select-evidence.observe';
import { MapObserveHandler } from '../domain/exercise-types/map/map.observe';
import { MatrixObserveHandler } from '../domain/exercise-types/matrix/matrix.observe';
import { DiscussObserveHandler } from '../application/observation/discuss.observe';
import { ImageUploadObserveHandler } from '../domain/exercise-types/image-upload/image-upload.observe';
import { GuidedDiscoveryObserveHandler } from '../domain/exercise-types/guided-discovery/guided-discovery.observe';

// ── Exercise component ──
import { ExerciseService } from '../application/exercise/exercise.service';
import { ExerciseController } from '../adapters/http/exercise.controller';
import { GradingService } from '../application/exercise/grading.service';
import { ExerciseTypeRegistry } from '../application/exercise/exercise-type-registry';
import { QuizPlugin } from '../domain/exercise-types/quiz/quiz.plugin';
import { MatchPlugin } from '../domain/exercise-types/match/match.plugin';
import { OrderPlugin } from '../domain/exercise-types/order/order.plugin';
import { StancePlugin } from '../domain/exercise-types/stance/stance.plugin';
import { FillBlankPlugin } from '../domain/exercise-types/fill-blank/fill-blank.plugin';
import { MatrixPlugin } from '../domain/exercise-types/matrix/matrix.plugin';
import { MapPlugin } from '../domain/exercise-types/map/map.plugin';
import { ImageUploadPlugin } from '../domain/exercise-types/image-upload/image-upload.plugin';
import { SelectEvidencePlugin } from '../domain/exercise-types/select-evidence/select-evidence.plugin';
import { RichContentQuizPlugin } from '../domain/exercise-types/rich-content-quiz/rich-content-quiz.plugin';
import { GuidedDiscoveryPlugin } from '../domain/exercise-types/guided-discovery/guided-discovery.plugin';

// ── State Cache ──
import { StateCacheService } from '../adapters/transport/state-cache.service';

// ── Coaching ──
import { CoachingService } from '../application/observation/coaching.service';

// ── Depth Ranking ──
import { DepthRankingService } from '../application/observation/depth-ranking.service';

// ── Socratic Discuss component ──
import { DiscussService } from '../application/ai/discuss.service';
import { DiscussController } from '../adapters/http/discuss.controller';
import { ClusterClassifier } from '../domain/classroom/cluster-classifier';
import { ClusterAggregator } from '../domain/discussion/cluster-aggregator';

// ── AI Ask component ──
import { AiAskService } from '../application/ai/ai-ask.service';
import { AiAskController } from '../adapters/http/ai-ask.controller';

// ── Translate component ──
import { TranslateService } from '../application/ai/translate.service';
import { TranslateController } from '../adapters/http/translate.controller';

// ── Personal Touch component ──
import { PersonalizationService } from '../application/ai/personalization.service';
import { PersonalTouchController } from '../adapters/http/personal-touch.controller';

// ── Observation component ──
import { ObservationQueryService } from '../application/observation/observation-query.service';
import { OpenAiLlmGateway } from '../adapters/observer-engine/openai-llm-gateway';
import { ClassroomNotifySink } from '../adapters/observer-engine/classroom-notify-sink';
import { JoinHandler } from '../adapters/observer-engine/handlers/join-handler';
import { ExerciseHandler } from '../adapters/observer-engine/handlers/exercise-handler';
import { StepCompleteHandler } from '../adapters/observer-engine/handlers/step-complete-handler';
import { ChatTurnHandler } from '../adapters/observer-engine/handlers/chat-turn-handler';
import { StatusChangeHandler } from '../adapters/observer-engine/handlers/status-change-handler';
import { SystemEventHandler } from '../adapters/observer-engine/handlers/system-event-handler';

@Module({
  imports: [
    CacheModule.register({ ttl: 10_000 }),
    DiscoveryModule,
    TypeOrmModule.forFeature([Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ClassroomSnapshot, Lesson, DiscussHighlight, DiscussTargetHit, ObservationRecord, ObserverEventRecord]),
  ],
  controllers: [
    ClassroomController,
    ExerciseController,
    DiscussController,
    AiAskController,
    TranslateController,
    PersonalTouchController,
  ],
  providers: [
    // Infra
    ClassroomService, ClassroomBroadcastService, ClassroomStateService, StudentSubmissionService, AiPromptBuilder, MetricsAggregator, CoachingService, DepthRankingService, ManifestCacheService, StateCacheService,
    // Domain port bindings — keep these grouped so the LLM_PORT consumer in
    // domain/exercise-types/<type>/<type>.plugin.ts resolves to AiPromptBuilder
    // without domain ever importing from application directly.
    { provide: LLM_PORT, useExisting: AiPromptBuilder },
    // Observe handlers + registry
    ObserveRegistry, QuizObserveHandler, SelectEvidenceObserveHandler, MapObserveHandler, MatrixObserveHandler, DiscussObserveHandler, ImageUploadObserveHandler, GuidedDiscoveryObserveHandler,
    // Exercise
    ExerciseService, GradingService,
    // Exercise type plugins — all 11 types migrated (Stage 1-5)
    ExerciseTypeRegistry, QuizPlugin, MatchPlugin, OrderPlugin, StancePlugin, FillBlankPlugin,
    MatrixPlugin, MapPlugin, ImageUploadPlugin, SelectEvidencePlugin,
    RichContentQuizPlugin, GuidedDiscoveryPlugin,
    // Socratic Discuss
    DiscussService, ClusterClassifier, ClusterAggregator,
    // AI Ask
    AiAskService,
    // Translate
    TranslateService,
    // Personal Touch
    PersonalizationService,
    // Observation
    ObservationQueryService, OpenAiLlmGateway, ClassroomNotifySink,
    JoinHandler, ExerciseHandler, StepCompleteHandler, ChatTurnHandler, StatusChangeHandler, SystemEventHandler,
    {
      provide: OBSERVER_ENGINE,
      useFactory: (
        observationRepo: any,
        eventRepo: any,
        llmGateway: LlmGateway,
        notifySink: NotifySink,
      ) => {
        const observationStore = new TypeormObservationStore(observationRepo);
        const eventStore = new TypeormEventStore(eventRepo);
        const logger = new Logger('ObserverEngine');
        return new ObserverEngine(
          observationStore,
          eventStore,
          llmGateway,
          notifySink,
          {
            log: (msg, ...args) => logger.log(msg, ...args),
            warn: (msg, ...args) => logger.warn(msg, ...args),
            error: (msg, ...args) => logger.error(msg, ...args),
          },
          { maxCascadeDepth: 3 },
        );
      },
      inject: [
        getRepositoryToken(ObservationRecord),
        getRepositoryToken(ObserverEventRecord),
        OpenAiLlmGateway,
        ClassroomNotifySink,
      ],
    },
  ],
  exports: [ExerciseTypeRegistry],
})
export class ClassroomModule implements OnModuleInit {
  private readonly logger = new Logger(ClassroomModule.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    // Manually inject engine from the module container
    const wrappers = this.discoveryService.getProviders();
    let engine: ObserverEngine | undefined;
    for (const w of wrappers) {
      if (w.token === OBSERVER_ENGINE && w.instance) {
        engine = w.instance as ObserverEngine;
        break;
      }
    }
    if (!engine) { this.logger.warn('ObserverEngine not found, handler discovery skipped'); return; }

    let registered = 0;
    for (const wrapper of wrappers) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;
      const prototype = Object.getPrototypeOf(instance);
      const methodNames = this.metadataScanner.getAllMethodNames(prototype);
      for (const methodName of methodNames) {
        const meta = this.reflector.get<{ eventType: string } | undefined>(
          OBSERVER_HANDLER_METADATA,
          prototype[methodName],
        );
        if (!meta) continue;
        const boundHandler = (event: ObserverEvent, ctx: HandlerContext): Promise<HandlerResult> =>
          (instance as any)[methodName](event, ctx);
        engine.register(meta.eventType, boundHandler);
        registered++;
        this.logger.log(`Registered handler ${instance.constructor.name}.${methodName} for "${meta.eventType}"`);
      }
    }
    this.logger.log(`Total handlers registered: ${registered}`);
  }
}
