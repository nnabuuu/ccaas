import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ClassroomSnapshot } from '../entities/classroom-snapshot.entity';
import { Lesson } from '../entities/lesson.entity';
import { DiscussHighlight } from '../entities/discuss-highlight.entity';
import { DiscussTargetHit } from '../entities/discuss-target-hit.entity';
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
import { ClassroomService } from './classroom.service';
import { ClassroomBroadcastService } from './classroom-broadcast.service';
import { ClassroomStateService } from './classroom-state.service';
import { StudentSubmissionService } from './student-submission.service';
import { ClassroomController } from './classroom.controller';
import { AiPromptBuilder } from './ai-prompt-builder';
import { MetricsAggregator } from './metrics-aggregator';
import { ManifestCacheService } from './manifest-cache.service';
import { ObserveRegistry } from './observe/observe-registry';
import { McObserveHandler } from './observe/handlers/mc.handler';
import { EvidenceObserveHandler } from './observe/handlers/evidence.handler';
import { MapObserveHandler } from './observe/handlers/map.handler';
import { MatrixObserveHandler } from './observe/handlers/matrix.handler';
import { DiscussObserveHandler } from './observe/handlers/discuss.handler';
import { ImageUploadObserveHandler } from './observe/handlers/image-upload.handler';
import { GuidedDiscoveryObserveHandler } from './observe/handlers/guided-discovery.handler';

// ── Exercise component ──
import { ExerciseService } from './exercise/exercise.service';
import { ExerciseController } from './exercise/exercise.controller';
import { GradingService } from './exercise/grading.service';
import { ExerciseTypeRegistry } from './exercise/exercise-type-registry';
import { QuizPlugin } from './exercise/plugins/quiz.plugin';
import { MatchPlugin } from './exercise/plugins/match.plugin';
import { OrderPlugin } from './exercise/plugins/order.plugin';
import { StancePlugin } from './exercise/plugins/stance.plugin';
import { FillBlankPlugin } from './exercise/plugins/fill-blank.plugin';
import { MatrixPlugin } from './exercise/plugins/matrix.plugin';
import { MapPlugin } from './exercise/plugins/map.plugin';
import { ImageUploadPlugin } from './exercise/plugins/image-upload.plugin';
import { SelectEvidencePlugin } from './exercise/plugins/select-evidence.plugin';
import { RichContentQuizPlugin } from './exercise/plugins/rich-content-quiz.plugin';
import { GuidedDiscoveryPlugin } from './exercise/plugins/guided-discovery.plugin';

// ── State Cache ──
import { StateCacheService } from './state-cache.service';

// ── Coaching ──
import { CoachingService } from './coaching.service';

// ── Depth Ranking ──
import { DepthRankingService } from './depth-ranking.service';

// ── Socratic Discuss component ──
import { DiscussService } from './socratic-discuss/discuss.service';
import { DiscussController } from './socratic-discuss/discuss.controller';
import { ClusterClassifier } from './socratic-discuss/cluster-classifier';
import { ClusterAggregator } from './socratic-discuss/cluster-aggregator';

// ── AI Ask component ──
import { AiAskService } from './ai-ask/ai-ask.service';
import { AiAskController } from './ai-ask/ai-ask.controller';

// ── Translate component ──
import { TranslateService } from './translate/translate.service';
import { TranslateController } from './translate/translate.controller';

// ── Personal Touch component ──
import { PersonalizationService } from './personal-touch/personalization.service';
import { PersonalTouchController } from './personal-touch/personal-touch.controller';

// ── Observation component ──
import { ObservationQueryService } from './observation/observation-query.service';
import { OpenAiLlmGateway } from './observation/adapters/openai-llm-gateway';
import { ClassroomNotifySink } from './observation/adapters/classroom-notify-sink';
import { JoinHandler } from './observation/handlers/join-handler';
import { ExerciseHandler } from './observation/handlers/exercise-handler';
import { StepCompleteHandler } from './observation/handlers/step-complete-handler';
import { ChatTurnHandler } from './observation/handlers/chat-turn-handler';
import { StatusChangeHandler } from './observation/handlers/status-change-handler';
import { SystemEventHandler } from './observation/handlers/system-event-handler';

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
    // Observe handlers + registry
    ObserveRegistry, McObserveHandler, EvidenceObserveHandler, MapObserveHandler, MatrixObserveHandler, DiscussObserveHandler, ImageUploadObserveHandler, GuidedDiscoveryObserveHandler,
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
