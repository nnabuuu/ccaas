import {
  DynamicModule,
  Module,
  OnModuleInit,
  Inject,
  Logger,
  type Provider,
  type Type,
} from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ObserverEngine } from '../core/observer-engine.js';
import type {
  LlmGateway,
  NotifySink,
  EngineOptions,
  ObserverEvent,
  HandlerContext,
  HandlerResult,
} from '../core/interfaces.js';
import { TypeormObservationStore } from '../infrastructure/typeorm-observation-store.js';
import { TypeormEventStore } from '../infrastructure/typeorm-event-store.js';
import { ObservationRecord } from '../infrastructure/entities/observation.entity.js';
import { ObserverEventRecord } from '../infrastructure/entities/observer-event.entity.js';
import {
  OBSERVER_ENGINE,
  OBSERVER_HANDLER_METADATA,
  OBSERVER_ENGINE_OPTIONS,
  OBSERVER_LLM_GATEWAY,
  OBSERVER_NOTIFY_SINK,
} from './constants.js';
import type { ObserverHandlerMeta } from './observer-handler.decorator.js';

export interface ObserverEngineModuleOptions {
  llmGateway?: { useExisting: Type };
  notifySink?: { useExisting: Type };
  engineOptions?: EngineOptions;
  /** Extra modules to import (e.g. TypeOrmModule.forFeature([...]) for repo access) */
  imports?: any[];
}

@Module({})
export class ObserverEngineModule implements OnModuleInit {
  private readonly logger = new Logger(ObserverEngineModule.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    @Inject(OBSERVER_ENGINE) private readonly engine: ObserverEngine,
  ) {}

  static forRoot(options: ObserverEngineModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      Reflector,
      // Register concrete gateway/sink classes so they're resolvable in this module scope
      ...(options.llmGateway?.useExisting ? [options.llmGateway.useExisting] : []),
      ...(options.notifySink?.useExisting ? [options.notifySink.useExisting] : []),
      {
        provide: OBSERVER_ENGINE_OPTIONS,
        useValue: options.engineOptions ?? {},
      },
      // Wrap optional deps so inject array positions are always fixed
      {
        provide: OBSERVER_LLM_GATEWAY,
        useFactory: options.llmGateway
          ? (dep: LlmGateway) => dep
          : () => undefined,
        inject: options.llmGateway ? [options.llmGateway.useExisting] : [],
      },
      {
        provide: OBSERVER_NOTIFY_SINK,
        useFactory: options.notifySink
          ? (dep: NotifySink) => dep
          : () => undefined,
        inject: options.notifySink ? [options.notifySink.useExisting] : [],
      },
      {
        provide: OBSERVER_ENGINE,
        useFactory: (
          observationRepo: any,
          eventRepo: any,
          llmGateway: LlmGateway | undefined,
          notifySink: NotifySink | undefined,
          engineOptions: EngineOptions,
        ) => {
          const observationStore = new TypeormObservationStore(observationRepo);
          const eventStore = new TypeormEventStore(eventRepo);
          const logger = new Logger('ObserverEngine');
          return new ObserverEngine(
            observationStore,
            eventStore,
            llmGateway ?? undefined,
            notifySink ?? undefined,
            {
              log: (msg, ...args) => logger.log(msg, ...args),
              warn: (msg, ...args) => logger.warn(msg, ...args),
              error: (msg, ...args) => logger.error(msg, ...args),
            },
            engineOptions,
          );
        },
        inject: [
          'ObservationRecordRepository',
          'ObserverEventRecordRepository',
          OBSERVER_LLM_GATEWAY,
          OBSERVER_NOTIFY_SINK,
          OBSERVER_ENGINE_OPTIONS,
        ],
      },
    ];

    return {
      module: ObserverEngineModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [OBSERVER_ENGINE],
    };
  }

  onModuleInit(): void {
    this.discoverHandlers();
  }

  private discoverHandlers(): void {
    const wrappers = this.discoveryService.getProviders();
    let registered = 0;

    for (const wrapper of wrappers) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') continue;

      const prototype = Object.getPrototypeOf(instance);
      const methodNames = this.metadataScanner.getAllMethodNames(prototype);

      for (const methodName of methodNames) {
        const meta = this.reflector.get<ObserverHandlerMeta | undefined>(
          OBSERVER_HANDLER_METADATA,
          prototype[methodName],
        );
        if (!meta) continue;

        const boundHandler = (
          event: ObserverEvent,
          ctx: HandlerContext,
        ): Promise<HandlerResult> =>
          (instance as any)[methodName](event, ctx);

        this.engine.register(meta.eventType, boundHandler);
        registered++;
        this.logger.log(
          `Registered handler ${instance.constructor.name}.${methodName} for "${meta.eventType}"`,
        );
      }
    }

    this.logger.log(`Total handlers registered: ${registered}`);
  }
}
