// ── Event ──

export interface ObserverEvent {
  id: string;
  type: string;
  sessionId: string;
  entityId: string;
  solutionId: string;
  timestamp: number;
  payload: Record<string, unknown>;
  metadata?: EventMetadata;
}

export interface EventMetadata {
  source?: string;
  correlationId?: string;
  depth?: number;
}

// ── Observation (handler conclusion) ──

export interface Observation {
  id: string;
  sessionId: string;
  entityId: string;
  solutionId: string;
  type: string;
  data: Record<string, unknown>;
  triggerEventId: string;
  createdAt: number;
  updatedAt: number;
}

// ── Handler Operations ──

export type ObservationOp =
  | {
      op: 'append';
      observation: Omit<
        Observation,
        'id' | 'sessionId' | 'solutionId' | 'createdAt' | 'updatedAt'
      >;
    }
  | {
      op: 'update';
      observationId: string;
      patch: Partial<Pick<Observation, 'type' | 'data'>>;
    };

// ── Handler Result ──

export interface HandlerResult {
  observations: ObservationOp[];
  emit?: Omit<ObserverEvent, 'id' | 'timestamp' | 'metadata'>[];
}

// ── Handler Context (injected by engine) ──

export interface HandlerContext {
  getObservations(entityId: string): Promise<Observation[]>;
  getAllObservations(sessionId: string): Promise<Observation[]>;
  getSessionMeta(): Record<string, unknown>;
  llm: LlmGateway;
  notify(channel: string, payload: unknown): void;
  logger: MinimalLogger;
}

// ── Handler Signature ──

export type EventHandler = (
  event: ObserverEvent,
  ctx: HandlerContext,
) => Promise<HandlerResult>;

// ── LLM Gateway ──

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionOptions {
  responseFormat?: 'text' | 'json';
  temperature?: number;
  maxTokens?: number;
}

export interface LlmGateway {
  chat(
    messages: LlmChatMessage[],
    options?: LlmCompletionOptions,
  ): Promise<string>;
}

// ── Store Interfaces ──

export interface ObservationStore {
  append(obs: Observation): Promise<void>;
  update(
    obsId: string,
    patch: Partial<Pick<Observation, 'type' | 'data'>>,
  ): Promise<void>;
  getByEntity(sessionId: string, entityId: string): Promise<Observation[]>;
  getBySession(sessionId: string): Promise<Observation[]>;
}

export interface EventStore {
  save(event: ObserverEvent): Promise<void>;
  getBySession(
    sessionId: string,
    opts?: { limit?: number; after?: number },
  ): Promise<ObserverEvent[]>;
}

// ── Notify Sink (bridge to SSE/WebSocket) ──

export interface NotifySink {
  push(channel: string, payload: unknown): void;
}

// ── Minimal Logger ──

export interface MinimalLogger {
  log(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// ── Engine Options ──

export interface EngineOptions {
  maxCascadeDepth?: number;
}

// ── Handler Registration Entry ──

export interface HandlerRegistration {
  eventType: string;
  handler: EventHandler;
  name?: string;
}
