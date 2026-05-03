import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import { ChatMessage } from '../entities/chat-message.entity';
import { ObservationEvent } from '../entities/observation-event.entity';
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
import { StudentSubmissionService } from './student-submission.service';
import { ClassroomController } from './classroom.controller';
import { AiPromptBuilder } from './ai-prompt-builder';
import { MetricsAggregator } from './metrics-aggregator';

// ── Exercise component ──
import { ExerciseService } from './exercise/exercise.service';
import { ExerciseController } from './exercise/exercise.controller';
import { GradingService } from './exercise/grading.service';

// ── Socratic Discuss component ──
import { DiscussService } from './socratic-discuss/discuss.service';
import { DiscussController } from './socratic-discuss/discuss.controller';

// ── AI Ask component ──
import { AiAskService } from './ai-ask/ai-ask.service';
import { AiAskController } from './ai-ask/ai-ask.controller';

// ── Personal Touch component ──
import { PersonalizationService } from './personal-touch/personalization.service';
import { PersonalTouchController } from './personal-touch/personal-touch.controller';

// ── Observation component ──
import { ObservationService } from './observation/observation.service';
import { GlmLlmGateway } from './observation/adapters/glm-llm-gateway';
import { ClassroomNotifySink } from './observation/adapters/classroom-notify-sink';
import { JoinHandler } from './observation/handlers/join-handler';
import { ExerciseHandler } from './observation/handlers/exercise-handler';
import { StepCompleteHandler } from './observation/handlers/step-complete-handler';
import { ChatTurnHandler } from './observation/handlers/chat-turn-handler';
import { StatusChangeHandler } from './observation/handlers/status-change-handler';

@Module({
  imports: [
    DiscoveryModule,
    TypeOrmModule.forFeature([Student, Submission, ClassroomSession, AiQuestion, ChatMessage, ObservationEvent, ObservationRecord, ObserverEventRecord]),
  ],
  controllers: [
    ClassroomController,
    ExerciseController,
    DiscussController,
    AiAskController,
    PersonalTouchController,
  ],
  providers: [
    // Infra
    ClassroomService, StudentSubmissionService, AiPromptBuilder, MetricsAggregator,
    // Exercise
    ExerciseService, GradingService,
    // Socratic Discuss
    DiscussService,
    // AI Ask
    AiAskService,
    // Personal Touch
    PersonalizationService,
    // Observation
    ObservationService, GlmLlmGateway, ClassroomNotifySink,
    JoinHandler, ExerciseHandler, StepCompleteHandler, ChatTurnHandler, StatusChangeHandler,
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
        GlmLlmGateway,
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
