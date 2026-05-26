import { randomUUID } from 'node:crypto';
import type {
  ObserverEvent,
  EventHandler,
  HandlerContext,
  HandlerResult,
  ObservationStore,
  EventStore,
  NotifySink,
  LlmGateway,
  MinimalLogger,
  EngineOptions,
  Observation,
  EventMetadata,
} from './interfaces.js';

const DEFAULT_MAX_CASCADE_DEPTH = 5;

const NOOP_LOGGER: MinimalLogger = {
  log() {},
  warn() {},
  error() {},
};

const NOOP_NOTIFY_SINK: NotifySink = {
  push() {},
};

const NOOP_LLM: LlmGateway = {
  async chat() {
    return '';
  },
};

export class ObserverEngine {
  private handlers = new Map<string, EventHandler[]>();
  private sessionMeta = new Map<string, Record<string, unknown>>();
  private maxCascadeDepth: number;

  constructor(
    private readonly observationStore: ObservationStore,
    private readonly eventStore: EventStore | null,
    private readonly llmGateway: LlmGateway = NOOP_LLM,
    private readonly notifySink: NotifySink = NOOP_NOTIFY_SINK,
    private readonly logger: MinimalLogger = NOOP_LOGGER,
    options?: EngineOptions,
  ) {
    this.maxCascadeDepth = options?.maxCascadeDepth ?? DEFAULT_MAX_CASCADE_DEPTH;
  }

  register(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  setSessionMeta(sessionId: string, meta: Record<string, unknown>): void {
    this.sessionMeta.set(sessionId, meta);
  }

  clearSessionMeta(sessionId: string): void {
    this.sessionMeta.delete(sessionId);
  }

  async dispatch(
    event: Omit<ObserverEvent, 'id' | 'timestamp' | 'metadata'>,
    metadata?: Partial<EventMetadata>,
  ): Promise<void> {
    const fullEvent: ObserverEvent = {
      ...event,
      id: randomUUID(),
      timestamp: Date.now(),
      metadata: {
        source: metadata?.source ?? 'system',
        correlationId: metadata?.correlationId ?? randomUUID(),
        depth: metadata?.depth ?? 0,
      },
    };

    await this.processEvent(fullEvent);
  }

  private async processEvent(event: ObserverEvent): Promise<void> {
    const depth = event.metadata?.depth ?? 0;
    if (depth > this.maxCascadeDepth) {
      this.logger.warn(
        `[ObserverEngine] Cascade depth ${depth} exceeds max ${this.maxCascadeDepth}, dropping event type="${event.type}"`,
      );
      return;
    }

    // Persist event (audit trail)
    if (this.eventStore) {
      await this.eventStore.save(event);
    }

    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.length === 0) {
      return;
    }

    const ctx = this.buildContext(event);
    const cascadeEvents: ObserverEvent[] = [];

    // Execute handlers sequentially for deterministic order
    for (const handler of handlers) {
      try {
        const result = await handler(event, ctx);
        await this.applyObservations(event, result);
        if (result.emit) {
          for (const emitted of result.emit) {
            cascadeEvents.push({
              ...emitted,
              id: randomUUID(),
              timestamp: Date.now(),
              metadata: {
                source: 'system',
                correlationId: event.metadata?.correlationId,
                depth: depth + 1,
              },
            });
          }
        }
      } catch (err) {
        this.logger.error(
          `[ObserverEngine] Handler error for event type="${event.type}":`,
          err,
        );
      }
    }

    // Process cascade events
    for (const cascadeEvent of cascadeEvents) {
      await this.processEvent(cascadeEvent);
    }
  }

  private buildContext(event: ObserverEvent): HandlerContext {
    return {
      getObservations: (entityId: string) =>
        this.observationStore.getByEntity(event.sessionId, entityId),
      getAllObservations: (sessionId: string) =>
        this.observationStore.getBySession(sessionId),
      getSessionMeta: () =>
        this.sessionMeta.get(event.sessionId) ?? {},
      llm: this.llmGateway,
      notify: (channel: string, payload: unknown) =>
        this.notifySink.push(channel, payload),
      logger: this.logger,
    };
  }

  private async applyObservations(
    event: ObserverEvent,
    result: HandlerResult,
  ): Promise<void> {
    for (const op of result.observations) {
      if (op.op === 'append') {
        const obs: Observation = {
          id: randomUUID(),
          sessionId: event.sessionId,
          solutionId: event.solutionId,
          ...op.observation,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await this.observationStore.append(obs);
      } else if (op.op === 'update') {
        await this.observationStore.update(op.observationId, op.patch);
      }
    }
  }
}
