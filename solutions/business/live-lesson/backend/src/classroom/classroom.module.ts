import { Module, Logger, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { Student } from '../entities/student.entity';
import { Submission } from '../entities/submission.entity';
import { ClassroomSession } from '../entities/classroom-session.entity';
import { AiQuestion } from '../entities/ai-question.entity';
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
import { ClassroomService } from './classroom.service';
import { ClassroomController } from './classroom.controller';
import { ObservationService } from './observation.service';
import { GradingService } from './grading.service';
import { AiPromptBuilder } from './ai-prompt-builder';
import { MetricsAggregator } from './metrics-aggregator';
import { GlmLlmGateway } from './adapters/glm-llm-gateway';
import { ClassroomNotifySink } from './adapters/classroom-notify-sink';
import { JoinHandler } from './handlers/join-handler';
import { ExerciseHandler } from './handlers/exercise-handler';
import { StepCompleteHandler } from './handlers/step-complete-handler';
import { ChatTurnHandler } from './handlers/chat-turn-handler';
import { StatusChangeHandler } from './handlers/status-change-handler';

@Module({
  imports: [
    DiscoveryModule,
    TypeOrmModule.forFeature([Student, Submission, ClassroomSession, AiQuestion, ObservationEvent, ObservationRecord, ObserverEventRecord]),
  ],
  controllers: [ClassroomController],
  providers: [
    ClassroomService, ObservationService, GradingService, AiPromptBuilder, MetricsAggregator,
    GlmLlmGateway, ClassroomNotifySink,
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
