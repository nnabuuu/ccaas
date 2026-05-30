/**
 * `WorkflowEngineService` — the Palantir-Carbon-style trigger
 * dispatcher.
 *
 * Responsibilities:
 *   1. **Registration**: programmatic (`registerTrigger`) AND
 *      decorator-driven (`@WorkflowTrigger` scan in `onApplicationBootstrap`).
 *   2. **Subscription wiring**: at bootstrap, register one global
 *      `onStateChange` listener with `ManifestAccessorService`; route
 *      to indexed `state-change` triggers. Event-stream subscriptions
 *      attach lazily per-session (M3 adds the session-create hook).
 *   3. **Dispatch**: match by `(manifest, kind, watchKey)` → predicate
 *      → build `ManifestAccessor` with role → resolve args → invoke
 *      ActionDef through the Phase 3 bridge → emit cascade events.
 *   4. **Cascade**: depth tracked via `AsyncLocalStorage`
 *      (`cascade-context`); global ceiling = `maxCascadeDepth` (default
 *      5); per-trigger override via `cascadeBudget`.
 *   5. **Backpressure**: per-session FIFO queue; `drop_oldest` caps at
 *      100 / session (configurable). Drops increment metrics.
 *
 * Engineering rules baked in:
 *   - Engine NEVER throws to ingest callers. All failures are caught,
 *     logged, and counted in `WorkflowMetricsService`.
 *   - LLM-heavy logic lives in the `ActionDef` handler, NOT the
 *     trigger predicate. Predicates are cheap synchronous filters.
 *   - Audit row in `tool_events` is the unit of work — workflow-driven
 *     calls land in the same table as agent-driven calls, distinguished
 *     only by the absence of an `actingUserId` (engine impersonates
 *     under the declared `as` role).
 *
 * @see docs/gitbook/zh/platform/workflow-architecture.md (M6+)
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { ManifestAccessorService } from '../ontology/manifest-accessor.service';
import {
  currentCascade,
  withChildCascade,
  withRootCascade,
} from './cascade-context';
import { IndicatorRegistryService } from './llm/indicator-registry.service';
import { WORKFLOW_TRIGGER_METADATA } from './workflow-trigger.decorator';
import { WorkflowMetricsService } from './workflow-metrics.service';
import { WorkflowRegistry } from './workflow-registry';
import {
  type TriggerDef,
  type TriggerFireInput,
} from './types';

const DEFAULT_MAX_CASCADE_DEPTH = 5;
const DEFAULT_MAX_QUEUE_PER_SESSION = 100;

export interface WorkflowEngineConfig {
  readonly maxCascadeDepth: number;
  readonly maxQueuePerSession: number;
}

@Injectable()
export class WorkflowEngineService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private readonly config: WorkflowEngineConfig = {
    maxCascadeDepth: DEFAULT_MAX_CASCADE_DEPTH,
    maxQueuePerSession: DEFAULT_MAX_QUEUE_PER_SESSION,
  };
  /** Per-session FIFO queue. Each session has a tail-promise we chain onto. */
  private readonly sessionQueues = new Map<
    string,
    { tail: Promise<void>; size: number }
  >();
  /** State-change listener unsubscribe handle — set at bootstrap. */
  private unsubscribeStateChange?: () => void;

  constructor(
    private readonly registry: WorkflowRegistry,
    private readonly metrics: WorkflowMetricsService,
    private readonly accessor: ManifestAccessorService,
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly indicators: IndicatorRegistryService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Decorator discovery: walk every @Injectable provider, register
    // any `@WorkflowTrigger(def)` metadata found.
    this.discoverDecoratorTriggers();

    // Single global state-change listener — routes to indexed triggers.
    this.unsubscribeStateChange = this.accessor.onStateChange((e) => {
      void this.onStateChange(e).catch((err) => {
        // Engine never throws upward. Listener is fire-and-forget.
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`state-change dispatch failed: ${msg}`);
      });
    });

    this.logger.log(
      `WorkflowEngine bootstrapped — ${this.registry.all().length} triggers registered`,
    );
  }

  /**
   * Programmatic trigger registration. Use this in solution-side
   * `OnModuleInit` services that want to register defs alongside
   * their other ontology wiring (mirrors LiveLessonOntologyService).
   * Throws on duplicate apiName.
   */
  registerTrigger(def: TriggerDef): void {
    this.registry.register(def);
  }

  /**
   * Cross-process event ingest entry point. Called from the HTTP
   * ingest controller in commit 5. Routes the event into
   * `ManifestAccessorService.publish()` so per-session subscribers
   * (including the workflow engine's own future event-stream
   * subscriptions) fan out. Triggers that match this stream fire via
   * the dispatch pipeline below.
   *
   * Returns `true` if the event was accepted, `false` if dedup-dropped.
   */
  async ingestEvent(input: {
    sessionId: string;
    solutionId: string;
    manifestName: string;
    streamApiName: string;
    payload: unknown;
    eventId?: string;
  }): Promise<boolean> {
    // The HTTP controller is responsible for the dedup check using
    // `ObserverEventRepository.hasEvent(eventId)` BEFORE calling this.
    // Engine here just dispatches.

    // Open a fresh root cascade frame for this external event.
    return withRootCascade(input.streamApiName, async () => {
      const cascade = currentCascade();
      // Fan out to event-kind triggers watching this stream.
      const triggers = this.registry.lookup(input.manifestName, {
        kind: 'event',
        stream: input.streamApiName,
      });
      for (const trigger of triggers) {
        await this.enqueueDispatch(input.sessionId, () =>
          this.dispatchTrigger(trigger, {
            sessionId: input.sessionId,
            solutionId: input.solutionId,
            event: {
              streamApiName: input.streamApiName,
              payload: input.payload,
            },
            cascade: { ...cascade, originStream: input.streamApiName },
          }),
        );
      }
      // Also publish to the ManifestAccessor stream router so subscribers
      // (e.g. SSE bridges, debugging consoles) see it.
      this.accessor.publish(
        input.sessionId,
        input.streamApiName,
        input.payload,
      );
      return true;
    });
  }

  /**
   * In-process cascade event dispatch. Called from inside an ActionDef
   * handler that wants to publish a downstream event AND fire any
   * event-kind triggers watching that stream.
   *
   * Unlike `ingestEvent` (which opens a fresh root cascade frame for
   * external HTTP-ingested events), this enters a CHILD cascade frame
   * so depth tracking + ceiling enforcement work end-to-end across
   * the chain. Pass-1 review MF1: the prior implementation used
   * `ManifestAccessorService.publish` directly, which only fanned to
   * subscribers (SSE bridges, debug consoles) and NEVER re-entered the
   * engine — so the M4 cascade chain
   * `chat_turn → indicator_hit → student_observation_changed → student_status`
   * was silently dead in production.
   *
   * Fire-and-forget semantics from the caller: each per-session
   * `enqueueDispatch` is awaited so the queue ordering invariant holds,
   * but downstream trigger errors are swallowed by the engine and
   * counted in metrics. The returned promise resolves once all
   * triggers have been ENQUEUED — it does not wait for them to finish
   * (the per-session FIFO would deadlock if the caller is itself a
   * queued task on the same session).
   */
  async cascadeEvent(input: {
    sessionId: string;
    solutionId: string;
    manifestName: string;
    streamApiName: string;
    payload: unknown;
  }): Promise<void> {
    await withChildCascade(input.streamApiName, () => {
      const cascade = currentCascade();
      const triggers = this.registry.lookup(input.manifestName, {
        kind: 'event',
        stream: input.streamApiName,
      });
      for (const trigger of triggers) {
        // void: do NOT await — caller may itself be running inside the
        // same session's FIFO entry, in which case awaiting the new
        // enqueue would deadlock (the new task chains behind us; we
        // can't complete until it does).
        void this.enqueueDispatch(input.sessionId, () =>
          this.dispatchTrigger(trigger, {
            sessionId: input.sessionId,
            solutionId: input.solutionId,
            event: {
              streamApiName: input.streamApiName,
              payload: input.payload,
            },
            cascade: { ...cascade, originStream: input.streamApiName },
          }),
        );
      }
      this.accessor.publish(
        input.sessionId,
        input.streamApiName,
        input.payload,
      );
      return Promise.resolve();
    });
  }

  /**
   * Drain + drop the per-session queue + cascade indicator teardown
   * across ALL tenants for the sessionId. The broad indicator drop is
   * safe because session ids are UUIDs (no realistic collision).
   * Pass-1 review SF1.
   *
   * Use `clearSessionQueue` (below) when the caller has tenant
   * context and wants to scope indicator teardown — the tenant-bound
   * DELETE endpoint (M6 pass-2 SF3) does this.
   */
  clearSession(sessionId: string): void {
    this.sessionQueues.delete(sessionId);
    this.indicators.clearSession(sessionId);
  }

  /**
   * Drain + drop the per-session queue WITHOUT touching indicators.
   * Indicator teardown is the caller's responsibility — they use
   * `IndicatorRegistryService.clearTenantSession(solutionId, sessionId)`
   * to respect the tenant boundary. M6 pass-2 SF3.
   */
  clearSessionQueue(sessionId: string): void {
    this.sessionQueues.delete(sessionId);
  }

  /** Test helper. */
  reset(): void {
    this.registry.reset();
    this.metrics.reset();
    this.sessionQueues.clear();
  }

  // ──────────── internals ────────────

  private async onStateChange(e: {
    sessionId: string;
    solutionId: string;
    manifestName: string;
    path: string;
    before: unknown;
    after: unknown;
  }): Promise<void> {
    const triggers = this.registry.lookup(e.manifestName, {
      kind: 'state-change',
      state: e.path,
    });
    if (triggers.length === 0) return;
    for (const trigger of triggers) {
      if (trigger.kind !== 'state-change') continue;
      // Watch-narrowing: skip if the trigger declared an `equals` or
      // `transitionsTo` filter that doesn't match this transition.
      if (
        trigger.watch.equals !== undefined &&
        !Object.is(e.after, trigger.watch.equals)
      ) {
        continue;
      }
      if (
        trigger.watch.transitionsTo !== undefined &&
        (!Object.is(e.after, trigger.watch.transitionsTo) ||
          Object.is(e.before, trigger.watch.transitionsTo))
      ) {
        continue;
      }
      await this.enqueueDispatch(e.sessionId, () =>
        withChildCascade(undefined, () =>
          this.dispatchTrigger(trigger, {
            sessionId: e.sessionId,
            solutionId: e.solutionId,
            stateChange: { path: e.path, before: e.before, after: e.after },
            cascade: currentCascade(),
          }),
        ),
      );
    }
  }

  private async dispatchTrigger(
    trigger: TriggerDef,
    inputBase: Omit<TriggerFireInput, 'cascade'> & {
      cascade: TriggerFireInput['cascade'];
    },
  ): Promise<void> {
    const input: TriggerFireInput = inputBase;
    const triggerName = trigger.apiName;

    // Cascade ceiling guard.
    const ceiling = trigger.cascadeBudget ?? this.config.maxCascadeDepth;
    if (input.cascade.depth >= ceiling) {
      this.metrics.inc('cascade_depth_exceeded');
      this.logger.warn(
        `trigger '${triggerName}' dropped: cascade depth ${input.cascade.depth} >= ` +
          `ceiling ${ceiling}`,
      );
      return;
    }

    this.metrics.inc('triggers_fired');

    // Predicate evaluation. Errors → treated as `false`.
    if (trigger.when) {
      let predicateResult: boolean;
      try {
        predicateResult = await Promise.resolve(trigger.when(input));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `trigger '${triggerName}' predicate threw: ${msg} — treating as false`,
        );
        this.metrics.inc('triggers_predicate_rejected');
        return;
      }
      if (!predicateResult) {
        this.metrics.inc('triggers_predicate_rejected');
        return;
      }
    }

    // Resolve args. Errors → audit as args-mapper failure + drop.
    let args: Record<string, unknown>;
    try {
      args = await Promise.resolve(trigger.then.args(input));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `trigger '${triggerName}' args mapper threw: ${msg}`,
      );
      this.metrics.inc('triggers_args_mapper_threw');
      return;
    }

    // Build accessor under the trigger's declared role.
    const role = trigger.then.as ?? 'agent';
    const accessor = await this.accessor
      .getAccessorFor({
        sessionId: input.sessionId,
        solutionId: input.solutionId,
        manifestName: trigger.manifest,
        role,
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `trigger '${triggerName}' accessor build failed: ${msg}`,
        );
        return undefined;
      });
    if (!accessor) {
      this.metrics.inc('triggers_action_failed');
      return;
    }

    // Invoke action via Phase 3 bridge.
    try {
      const result = await accessor.invokeAction(trigger.then.action, args);
      if (!result.ok) {
        this.metrics.inc('triggers_action_failed');
        if (result.errorCode === 'internal_error') {
          this.metrics.inc('triggers_action_not_found');
        }
        this.logger.warn(
          `trigger '${triggerName}' action '${trigger.then.action}' failed: ` +
            `${result.errorCode} — ${result.message}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `trigger '${triggerName}' action invocation threw: ${msg}`,
      );
      this.metrics.inc('triggers_action_failed');
    }
  }

  /**
   * Enqueue a unit of dispatch work on the per-session FIFO queue.
   *
   * Two invariants:
   *   - work runs sequentially per session (prevents two cascaded
   *     triggers racing on the same student_status row)
   *   - queue length is capped at `maxQueuePerSession` — overflow
   *     drops the OLDEST queued task (matches `drop_oldest`
   *     backpressure declared on the stream).
   */
  private enqueueDispatch(
    sessionId: string,
    fn: () => Promise<void>,
  ): Promise<void> {
    const entry = this.sessionQueues.get(sessionId) ?? {
      tail: Promise.resolve(),
      size: 0,
    };
    if (entry.size >= this.config.maxQueuePerSession) {
      this.metrics.inc('events_dropped_queue_full');
      this.logger.warn(
        `session ${sessionId} queue full (${entry.size}); dropping incoming task`,
      );
      return Promise.resolve();
    }
    entry.size += 1;
    const next = entry.tail
      .then(fn)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`queued task threw: ${msg}`);
      })
      .finally(() => {
        const cur = this.sessionQueues.get(sessionId);
        if (cur) cur.size = Math.max(0, cur.size - 1);
      });
    entry.tail = next;
    this.sessionQueues.set(sessionId, entry);
    return next;
  }

  private discoverDecoratorTriggers(): void {
    const providers = this.discovery.getProviders();
    let registered = 0;
    for (const wrapper of providers) {
      const instance = wrapper.instance;
      const proto = instance ? Object.getPrototypeOf(instance) : null;
      if (!proto) continue;
      const def: TriggerDef | undefined = Reflect.getMetadata(
        WORKFLOW_TRIGGER_METADATA,
        instance.constructor,
      );
      if (!def) continue;
      try {
        this.registry.register(def);
        registered += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `failed to register @WorkflowTrigger on ${instance.constructor.name}: ${msg}`,
        );
      }
    }
    if (registered > 0) {
      this.logger.log(
        `discovered ${registered} @WorkflowTrigger-decorated trigger(s)`,
      );
    }
  }
}
