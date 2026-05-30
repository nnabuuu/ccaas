/**
 * `ManifestAccessorService` — NestJS-bound implementation of the
 * ontology package's `ManifestAccessor` interface.
 *
 * Responsibilities:
 *   - `getState` / `setState`: read/write through SessionMetadataService,
 *     keyed `manifest.<manifestName>.<fieldApiName>` so multiple
 *     manifests on one session don't collide. State is cached in memory
 *     at accessor-creation time (the ontology interface defines
 *     `getState` as sync), and writes go through SessionMetadataService
 *     synchronously-on-the-cache + async-on-the-DB.
 *   - `getSlot`: returns the slot binding from the snapshot passed at
 *     creation time. Phase 3A defers full slot resolution via
 *     EntityContextProvider to a follow-up — the snapshot pattern keeps
 *     the sync interface honest while still letting Solutions populate
 *     it from EntityRegistry at accessor-creation time.
 *   - `listActions`: filtered by role visibility + ActionDef.allowedRoles.
 *   - `invokeAction`: dispatches through ToolCallerProxyService (which
 *     means the action's audit + boundary check run through the same
 *     pipeline as the agent-facing tool path).
 *   - `subscribe`: registers against the in-process per-session
 *     stream router. Phase 3B's event-stream-bridge calls
 *     `publish(sessionId, streamApiName, event)` to fan out
 *     observer-engine events.
 *
 * The accessor is *short-lived* by design: re-create per request,
 * not cached globally. The state snapshot is intentionally read once;
 * a stale snapshot is preferable to a race against concurrent writes
 * (the ontology spec says reads are point-in-time).
 *
 * @see docs/ontology/kedge-ontology-design.md §5.1, §10.3
 */

import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  checkBoundary,
  type ActionDescriptor,
  type ActionErrorCode,
  type ActionPrecondition,
  type ActionResult,
  type BoundaryRole,
  type ManifestAccessor,
  type ManifestDef,
  OntologyRegistry,
} from '@kedge-agentic/ontology';
import { SessionMetadataService } from '../sessions/services/session-metadata.service';
import { ToolCallerProxyService } from '../tool-caller/tool-caller-proxy.service';
import type { ExecutionContext } from '../tool-caller/types';
import { ONTOLOGY_REGISTRY } from './ontology-registry.provider';

export interface ManifestAccessorInput {
  readonly sessionId: string;
  readonly solutionId: string;
  readonly manifestName: string;
  readonly role: BoundaryRole;
  /**
   * Pre-resolved slot bindings. Sync `getSlot` reads from here.
   * Callers responsible for hydrating from EntityContextProvider when
   * needed; Phase 3A keeps this caller-provided to stay honest about
   * the sync surface.
   */
  readonly slotBindings?: Readonly<Record<string, unknown>>;
  /**
   * Optional ExecutionContext seed for invokeAction dispatch. Phase 3
   * propagates session + tenant + role; identity (actingUserId) is the
   * platform's job and the accessor doesn't fabricate it.
   */
  readonly actingUserId?: string;
}

type StreamHandler = (event: unknown) => void;

const STATE_KEY_PREFIX = 'manifest';

function stateKey(manifestName: string, fieldApiName: string): string {
  return `${STATE_KEY_PREFIX}.${manifestName}.${fieldApiName}`;
}

function mapToolErrorCode(
  toolCode:
    | 'validation_failed'
    | 'permission_denied'
    | 'tool_not_found'
    | 'handler_error',
  unmetPreconditions: readonly ActionPrecondition[] | undefined,
): ActionErrorCode {
  switch (toolCode) {
    case 'validation_failed':
      return 'validation_failed';
    case 'permission_denied':
      return unmetPreconditions && unmetPreconditions.length > 0
        ? 'precondition_unmet'
        : 'boundary_denied';
    case 'handler_error':
      return 'execution_error';
    case 'tool_not_found':
      return 'internal_error';
  }
}

@Injectable()
export class ManifestAccessorService {
  private readonly logger = new Logger(ManifestAccessorService.name);

  /** Map<sessionId, Map<streamApiName, Set<handler>>>. */
  private readonly streams = new Map<
    string,
    Map<string, Set<StreamHandler>>
  >();

  constructor(
    @Inject(ONTOLOGY_REGISTRY) private readonly registry: OntologyRegistry,
    private readonly metadata: SessionMetadataService,
    @Optional() private readonly proxy?: ToolCallerProxyService,
  ) {}

  /**
   * Build a `ManifestAccessor` bound to the (sessionId, manifest, role)
   * triple. Pre-loads state from SessionMetadataService so the sync
   * `getState` interface is honest.
   */
  async getAccessorFor(input: ManifestAccessorInput): Promise<ManifestAccessor> {
    const manifest = this.registry.getManifest(input.manifestName);
    if (!manifest) {
      throw new Error(
        `ManifestAccessorService: manifest "${input.manifestName}" is not registered`,
      );
    }
    const stateCache = await this.loadStateCache(manifest, input);
    return new BoundManifestAccessor({
      manifest,
      role: input.role,
      sessionId: input.sessionId,
      solutionId: input.solutionId,
      actingUserId: input.actingUserId,
      slotBindings: input.slotBindings ?? {},
      stateCache,
      metadata: this.metadata,
      proxy: this.proxy,
      subscribe: (streamApiName, handler) =>
        this.subscribeInternal(input.sessionId, streamApiName, handler),
    });
  }

  /**
   * Fan an event out to every subscriber on (sessionId, streamApiName).
   * Phase 3B's event-stream-bridge calls this from an observer-engine
   * listener. Per-handler errors are swallowed + logged so one buggy
   * handler can't take down the rest of the fanout.
   */
  publish(sessionId: string, streamApiName: string, event: unknown): void {
    const session = this.streams.get(sessionId);
    if (!session) return;
    const handlers = session.get(streamApiName);
    if (!handlers) return;
    for (const h of handlers) {
      try {
        h(event);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `subscriber handler threw on stream "${streamApiName}" for session ` +
          `${sessionId}: ${msg}`,
        );
      }
    }
  }

  /**
   * Release all subscriptions for a session. Call from SessionService
   * teardown so a long-running backend doesn't accumulate dead Map
   * entries.
   */
  clearSession(sessionId: string): void {
    this.streams.delete(sessionId);
  }

  private subscribeInternal(
    sessionId: string,
    streamApiName: string,
    handler: StreamHandler,
  ): () => void {
    let session = this.streams.get(sessionId);
    if (!session) {
      session = new Map();
      this.streams.set(sessionId, session);
    }
    let handlers = session.get(streamApiName);
    if (!handlers) {
      handlers = new Set();
      session.set(streamApiName, handlers);
    }
    handlers.add(handler);
    // Cleanup pins references to the Map + Set this handler was added
    // to. Re-checking identity on teardown (`this.streams.get(...) === s`)
    // guards against a recreate-while-cleaning interleaving — see
    // code-review M4.
    const sCaptured = session;
    const hsCaptured = handlers;
    return () => {
      hsCaptured.delete(handler);
      if (
        hsCaptured.size === 0 &&
        sCaptured.get(streamApiName) === hsCaptured
      ) {
        sCaptured.delete(streamApiName);
      }
      if (
        sCaptured.size === 0 &&
        this.streams.get(sessionId) === sCaptured
      ) {
        this.streams.delete(sessionId);
      }
    };
  }

  private async loadStateCache(
    manifest: ManifestDef,
    input: ManifestAccessorInput,
  ): Promise<Map<string, unknown>> {
    const cache = new Map<string, unknown>();
    for (const field of manifest.state) {
      const key = stateKey(manifest.name, field.apiName);
      try {
        const row = await this.metadata.get(input.sessionId, input.solutionId, key);
        cache.set(field.apiName, row.value);
      } catch (err) {
        // Only NotFound (no row yet) is a "seed initial" signal — every
        // other error (DB down, permission denied, serialization error)
        // means we'd silently reset persisted state to `initial` on the
        // next setState. Bubble those up so the caller sees the real
        // failure instead of getting a stealthily-clean fresh accessor.
        if (err instanceof NotFoundException) {
          cache.set(field.apiName, field.initial);
        } else {
          throw err;
        }
      }
    }
    return cache;
  }
}

interface BoundDeps {
  readonly manifest: ManifestDef;
  readonly role: BoundaryRole;
  readonly sessionId: string;
  readonly solutionId: string;
  readonly actingUserId?: string;
  readonly slotBindings: Readonly<Record<string, unknown>>;
  readonly stateCache: Map<string, unknown>;
  readonly metadata: SessionMetadataService;
  readonly proxy?: ToolCallerProxyService;
  readonly subscribe: (
    streamApiName: string,
    handler: StreamHandler,
  ) => () => void;
}

/**
 * Concrete `ManifestAccessor`. Not exported — callers should go through
 * `ManifestAccessorService.getAccessorFor`.
 */
class BoundManifestAccessor implements ManifestAccessor {
  private readonly logger = new Logger(BoundManifestAccessor.name);

  constructor(private readonly deps: BoundDeps) {}

  get manifest(): ManifestDef {
    return this.deps.manifest;
  }
  get role(): BoundaryRole {
    return this.deps.role;
  }

  getState<T = unknown>(apiName: string): T {
    const decision = checkBoundary({
      manifest: this.deps.manifest,
      role: this.deps.role,
      op: { kind: 'read', path: apiName },
    });
    if (!decision.allowed) {
      throw new Error(
        `getState denied for role '${this.deps.role}' on path '${apiName}': ${decision.reason}`,
      );
    }
    return this.deps.stateCache.get(apiName) as T;
  }

  setState<T = unknown>(apiName: string, value: T): void {
    const decision = checkBoundary({
      manifest: this.deps.manifest,
      role: this.deps.role,
      op: { kind: 'write', path: apiName },
    });
    if (!decision.allowed) {
      throw new Error(
        `setState denied for role '${this.deps.role}' on path '${apiName}': ${decision.reason}`,
      );
    }
    this.deps.stateCache.set(apiName, value);
    const key = stateKey(this.deps.manifest.name, apiName);
    // Fire-and-forget persistence. Failure is logged but not surfaced
    // to the caller because the sync interface has no error channel.
    void this.deps.metadata
      .put(this.deps.sessionId, this.deps.solutionId, key, value)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `setState persistence failed for ${this.deps.sessionId}/${key}: ${msg}`,
        );
      });
  }

  getSlot<T = unknown>(apiName: string): T | readonly T[] | null {
    // Slot path read-gate: spec §5.1 says slot reads require AccessBoundary.readable.
    const decision = checkBoundary({
      manifest: this.deps.manifest,
      role: this.deps.role,
      op: { kind: 'read', path: apiName },
    });
    if (!decision.allowed) {
      throw new Error(
        `getSlot denied for role '${this.deps.role}' on '${apiName}': ${decision.reason}`,
      );
    }
    const slot = this.deps.manifest.slots.find((s) => s.apiName === apiName);
    if (!slot) {
      throw new Error(
        `getSlot: slot '${apiName}' not declared on manifest '${this.deps.manifest.name}'`,
      );
    }
    if (this.deps.slotBindings[apiName] === undefined) {
      return slot.collection ? [] : null;
    }
    return this.deps.slotBindings[apiName] as T | readonly T[];
  }

  listActions(): readonly ActionDescriptor[] {
    // Phase 3A: list every action with paramsSchema + per-call allowed
    // pre-computed by checking the boundary. ActionDefs live on
    // ObjectTypeDefs (not on the Manifest directly in Phase 1); the
    // Manifest doesn't yet enumerate "actions visible at this surface",
    // so this returns an empty list until Phase 4's Manifest.actions
    // enumeration. Returning [] keeps the contract honest without
    // pretending to enumerate something we can't yet.
    return [];
  }

  async invokeAction(
    apiName: string,
    params: Record<string, unknown>,
  ): Promise<ActionResult> {
    if (!this.deps.proxy) {
      return {
        ok: false,
        errorCode: 'internal_error',
        message:
          'ManifestAccessor.invokeAction: no ToolCallerProxyService bound',
      };
    }
    const ctx: ExecutionContext = {
      solutionId: this.deps.solutionId,
      sessionId: this.deps.sessionId,
      actingUserId: this.deps.actingUserId,
      actingRole: this.deps.role,
    };
    const result = await this.deps.proxy.invoke(
      { tool: apiName, args: params },
      ctx,
    );
    if (result.ok) {
      return { ok: true };
    }
    return {
      ok: false,
      errorCode: mapToolErrorCode(result.code, result.unmetPreconditions),
      message: result.reason,
      unmetPreconditions: result.unmetPreconditions,
    };
  }

  subscribe(
    streamApiName: string,
    handler: (event: unknown) => void,
  ): () => void {
    const decision = checkBoundary({
      manifest: this.deps.manifest,
      role: this.deps.role,
      op: { kind: 'subscribe', streamApiName },
    });
    if (!decision.allowed) {
      throw new Error(
        `subscribe denied for role '${this.deps.role}' on stream '${streamApiName}': ${decision.reason}`,
      );
    }
    return this.deps.subscribe(streamApiName, handler);
  }
}
