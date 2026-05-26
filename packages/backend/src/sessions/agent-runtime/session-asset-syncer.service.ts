/**
 * SessionAssetSyncer — the orchestrator that ties the pull-based
 * bidirectional sync together at agent turn boundaries.
 *
 * Trigger: `session.turn.complete` event (emitted by CliProcessService
 * right after a turn cleanly exits with status='complete'). On each
 * fire:
 *   1. Look up the bound `projectId` for this session via
 *      `session_metadata['projectId']`. No binding → no-op.
 *   2. Read the DB-side canonical state via the solution-provided
 *      `ProjectArtifactSource.loadArtifacts(projectId)`.
 *   3. Read the agent-side delta via the WorkspaceProvider's
 *      `diff()` (agentfs-only; LocalProvider has no per-session
 *      delta concept — for local sessions we treat fs-side as empty).
 *   4. Run `SyncEngine.plan()` to resolve conflicts.
 *   5. Apply the plan: write changed files into the agent's mount,
 *      persist agent-side writes back via `source.saveArtifact`,
 *      delete on either side as appropriate. AGENT WINS on dual
 *      writes; emits a `conflict_discarded` ChangeEvent so the GUI
 *      can surface the discarded DB version.
 *   6. Commit the post-sync snapshot to `SnapshotStore`.
 *   7. Publish per-path ChangeEvents on `ChangeStream` for live GUI
 *      consumers.
 *
 * Concurrency: `session.turn.complete` is per-session and CLI
 * exit-driven, so at most one sync runs per session at a time. Across
 * sessions: per-projectId in-memory mutex prevents two sessions on
 * the same project from racing each other.
 *
 * **Single-replica assumption**: the projectId mutex is process-local
 * (`Map<string, Promise<void>>`). ccaas is single-replica by design
 * — SQLite + agentfs FUSE mounts preclude horizontal scaling — so a
 * cross-process lock isn't needed today. If ccaas ever sheds those
 * constraints, this mutex must move to Postgres advisory locks /
 * redlock; otherwise two replicas syncing the same project will
 * interleave `snapshots.clear()` + per-entry `put()` and corrupt the
 * snapshot store. Tracked as Phase 3+.
 *
 * Failure mode: any thrown error is logged + the session's snapshot
 * is left unchanged so the next turn's sync sees the same delta.
 * Hard guarantee: no partial commits — actions apply in order, and
 * a mid-flight throw leaves the workspace + DB in a recoverable
 * state (re-running the sync converges).
 */

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import type {
  ArtifactSnapshot,
  BinaryArtifactSource,
  BinaryContentHasher,
  BinaryFsDelta,
  BinarySyncAction,
  ChangeEvent,
  ChangeStream,
  ContentHasher,
  FsDelta,
  ProjectArtifactSource,
  SnapshotEntry,
  SnapshotStore,
  SyncAction,
} from '@kedge-agentic/agent-runtime';
import { SyncEngine } from '@kedge-agentic/agent-runtime';

import { SessionService } from '../session.service';
import { SessionMetadataService } from '../services/session-metadata.service';
import { SolutionsService } from '../../solutions/solutions.service';
import type { FsDiffEntry } from '../workspace/types';

import {
  CHANGE_STREAM,
  PROJECT_ARTIFACT_SOURCE_REGISTRY,
  PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY,
  SNAPSHOT_STORE,
} from './tokens';
import { ProjectArtifactSourceRegistry } from './project-artifact-source-registry';
import { ProjectBinaryArtifactSourceRegistry } from './project-binary-artifact-source-registry';

/** Workspace-relative directory holding live text artifact projections. */
export const ARTIFACTS_DIR = 'artifacts';
/**
 * Phase 2b-4: workspace-relative directory holding live BINARY artifact
 * projections (images, audio, PDFs). Sibling of `artifacts/`. Keeping
 * the two namespaces split means the agent's `Read` / `cat` tool can't
 * accidentally stream a JPEG into context — the path simply isn't
 * under the text dir it walks.
 */
export const ARTIFACTS_BINARY_DIR = 'artifacts-binary';

const sha256Hasher: ContentHasher = (s: string) =>
  createHash('sha256').update(s).digest('hex');

const sha256BinaryHasher: BinaryContentHasher = (b: Buffer | Uint8Array) =>
  createHash('sha256').update(b).digest('hex');

export interface SessionTurnCompleteEvent {
  sessionId: string;
  solutionId?: string;
  status: 'complete' | 'error' | 'cancelled';
  exitCode: number | null;
}

/**
 * Payload of the `session.bound` event emitted by
 * `SessionService.attachWorkspaceSource` (and its β-2 alias
 * `bindToProject`).
 *
 * Both `projectId` and `workspaceSource.sourceIdentity` carry the
 * same value during the β compat window. Existing listeners
 * (`SessionAssetSyncer.onSessionBound`) read `projectId`; β-3
 * listeners that need the URL or schema-hash read `workspaceSource`.
 * Once β-2 + β-3 are fully landed and α has renamed `tenant` →
 * `solution`, `projectId` is removed from this payload.
 */
export interface SessionBoundEvent {
  sessionId: string;
  solutionId: string;
  /** @deprecated since β-2 — use `workspaceSource.sourceIdentity`. */
  projectId: string;
  /**
   * Added in β-2. Carries the full descriptor (identity + optional
   * URL + optional schema hash) so β-3's syncer rewrite can read
   * `sourceUrl` directly off the event without reaching back into
   * session_metadata.
   */
  workspaceSource: {
    sourceIdentity: string;
    sourceUrl?: string;
    sourceSchemaHash?: string;
  };
}

/**
 * Coalesce window for dedup: if a sync for the same project was
 * registered within this many milliseconds, a subsequent sync just
 * awaits it and returns instead of registering its own doSync after.
 *
 * Tuned for the G4 case: `MessageWorker.processMessage` calls
 * `attachWorkspaceSource` → `@OnEvent('session.bound')` listener
 * kicks off sync (registers lock A) → worker then calls
 * `assetSyncer.sync()`
 * (would register lock B chained after A). Both observe the same
 * pre-edit state, so B's doSync is wasted work. 100ms easily covers
 * the microsecond gap between the two triggers AND is small enough
 * that legitimately-chained calls (`/invalidate` after a real
 * `turn-complete`, which are seconds apart) DO chain normally.
 */
export const COALESCE_WINDOW_MS = 100;

@Injectable()
export class SessionAssetSyncer {
  private readonly logger = new Logger(SessionAssetSyncer.name);
  /**
   * Per-projectId mutex so two sessions on the same project don't race.
   * Value carries the in-flight Promise + the wall-clock time the lock
   * was registered, so a follow-up call within `COALESCE_WINDOW_MS`
   * can short-circuit instead of queueing yet another doSync.
   */
  private readonly projectLocks = new Map<string, { promise: Promise<void>; registeredAt: number }>();

  /** Cache of `solutionId → slug` lookups; slugs are stable per tenant. */
  private readonly tenantSlugCache = new Map<string, string | null>();

  constructor(
    @Inject(PROJECT_ARTIFACT_SOURCE_REGISTRY)
    private readonly sourceRegistry: ProjectArtifactSourceRegistry,
    @Inject(PROJECT_BINARY_ARTIFACT_SOURCE_REGISTRY)
    private readonly binarySourceRegistry: ProjectBinaryArtifactSourceRegistry,
    @Inject(SNAPSHOT_STORE) private readonly snapshots: SnapshotStore,
    @Inject(CHANGE_STREAM) private readonly changes: ChangeStream,
    private readonly sessions: SessionService,
    private readonly metadata: SessionMetadataService,
    private readonly tenants: SolutionsService,
  ) {}

  @OnEvent('session.turn.complete')
  async onTurnComplete(payload: SessionTurnCompleteEvent): Promise<void> {
    if (payload.status !== 'complete') return;
    try {
      await this.sync(payload.sessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `sync failed for session=${payload.sessionId}: ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  /**
   * Bootstrap hook — fires when a session first attaches to a
   * workspace source (via `SessionService.attachWorkspaceSource`,
   * or its deprecated alias `bindToProject`). Runs the same `sync()`
   * flow as turn-end; since the previous snapshot is empty, every
   * DB-side artifact is treated as a `write_fs` action, producing
   * the initial materialized state under `<workspace>/artifacts/`
   * before the agent's first turn ever reads it.
   */
  @OnEvent('session.bound')
  async onSessionBound(payload: SessionBoundEvent): Promise<void> {
    try {
      await this.sync(payload.sessionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `bootstrap sync failed for session=${payload.sessionId} project=${payload.projectId}: ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  /** Public entry point — also called by the invalidate endpoint (day 6). */
  async sync(sessionId: string): Promise<void> {
    const session = this.sessions.getSession(sessionId);
    if (!session) {
      this.logger.debug(`sync: no live session ${sessionId}, skipping`);
      return;
    }

    const projectId = await this.lookupProjectId(sessionId, session.solutionId);
    if (!projectId) {
      this.logger.debug(`sync: session ${sessionId} has no projectId binding, skipping`);
      return;
    }

    // Resolve the tenant-specific source: solutionId → slug (via SolutionsService,
    // cached locally since slugs are stable) → registry.getForTenantSlug.
    // Null means this tenant has no configured artifact source AND there's
    // no default fallback — treat the same as "no binding": no-op.
    const slug = await this.resolveSlug(session.solutionId);
    const source = await this.sourceRegistry.getForTenantSlug(slug);
    if (!source) {
      this.logger.debug(
        `sync: session ${sessionId} tenant=${session.solutionId} has no artifact source configured, skipping`,
      );
      return;
    }

    // Serialize syncs per projectId: each new request chains onto the
    // previous one so two sessions on the same project don't race the
    // SyncEngine.plan inputs or the SnapshotStore writes.
    const prior = this.projectLocks.get(projectId);

    // Coalesce dual-trigger calls (G4): if the prior lock was registered
    // very recently — small enough that it must be the same triggering
    // event (e.g. bind fires the @OnEvent listener which registers the
    // prior, and we're the worker's own explicit sync called immediately
    // after) — just await the in-flight one and skip our own pass.
    // Both syncs would observe the same upstream state, so the second
    // doSync is guaranteed-no-op work. See COALESCE_WINDOW_MS comment.
    if (prior && Date.now() - prior.registeredAt < COALESCE_WINDOW_MS) {
      try {
        await prior.promise;
      } catch {
        // Prior's error is orthogonal to this caller's intent (which is
        // "be in sync after this returns"). The in-flight sync at least
        // attempted that; swallowing matches the .catch() the chained
        // path uses below for the same reason.
      }
      return;
    }

    const run = (async () => {
      await prior?.promise.catch(() => undefined);
      await this.doSync(sessionId, projectId, session.workspaceDir, source);
    })();
    const settled: Promise<void> = run.then(
      () => undefined,
      () => undefined,
    );
    const entry = { promise: settled, registeredAt: Date.now() };
    this.projectLocks.set(projectId, entry);
    try {
      await run;
    } finally {
      // GC the lock if no later sync has chained onto ours. Reference
      // equality means we only delete the entry we wrote; if another
      // call has already replaced it, that one owns the slot.
      if (this.projectLocks.get(projectId) === entry) {
        this.projectLocks.delete(projectId);
      }
    }
  }

  private async doSync(
    sessionId: string,
    projectId: string,
    workspaceDir: string,
    source: ProjectArtifactSource,
  ): Promise<void> {
    const artifactsDir = path.join(workspaceDir, ARTIFACTS_DIR);
    const artifactsBinaryDir = path.join(workspaceDir, ARTIFACTS_BINARY_DIR);
    await fs.mkdir(artifactsDir, { recursive: true });

    // Phase 2b-4: binary source is independently optional. Resolve up-
    // front so the binary half can be skipped cleanly if the tenant has
    // no `binaryArtifactUrl` configured. Resolving here (vs inside the
    // binary helper) avoids creating `artifacts-binary/` for tenants
    // that aren't using binaries.
    const slug = await this.resolveSlug(
      this.sessions.getSession(sessionId)?.solutionId,
    );
    const binarySource = await this.binarySourceRegistry.getForTenantSlug(slug);
    if (binarySource) {
      await fs.mkdir(artifactsBinaryDir, { recursive: true });
    }

    const previousSnapshot = await this.snapshots.list(sessionId);
    // Split snapshot entries by mount-point so each half-plan only sees
    // its own paths (text and binary both write to one shared store but
    // the engine's "deleted from DB" detection would mis-fire if it saw
    // the other mount's entries as orphans).
    const textPrevSnapshot = previousSnapshot.filter(
      (e) => !e.path.startsWith(`${ARTIFACTS_BINARY_DIR}/`),
    );
    const binaryPrevSnapshot = previousSnapshot
      .filter((e) => e.path.startsWith(`${ARTIFACTS_BINARY_DIR}/`))
      .map((e) => ({ ...e, path: e.path.slice(ARTIFACTS_BINARY_DIR.length + 1) }));

    const [dbNow, fsDelta] = await Promise.all([
      source.loadArtifacts(projectId),
      this.buildFsDelta(sessionId, artifactsDir, textPrevSnapshot),
    ]);

    const plan = new SyncEngine().plan({
      sessionId,
      dbNow,
      fsDelta,
      previousSnapshot: textPrevSnapshot,
      now: new Date().toISOString(),
      hasher: sha256Hasher,
      // When the solution can't delete, the engine plans `write_fs`
      // (restore from DB) instead of `delete_db` so the agent's
      // delete is reverted on next read rather than silently dropped.
      allowDelete: typeof source.deleteArtifact === 'function',
    });

    // Phase 2b-4: parallel binary plan. Only computed when the tenant
    // has a `binaryArtifactUrl` configured. The plan uses the binary
    // engine; actions, events, and snapshot entries are kept separate
    // from the text half until commit time.
    let binaryPlan: {
      actions: ReadonlyArray<BinarySyncAction>;
      nextSnapshot: ReadonlyArray<SnapshotEntry>;
    } = { actions: [], nextSnapshot: [] };
    let binaryFsDelta: BinaryFsDelta = { modified: [], deleted: [] };
    if (binarySource) {
      const binaryListing = await binarySource.listBinaryArtifacts(projectId);
      // The engine requires contentHash on every listing entry. Fetch +
      // hash on demand for any listing entry the solution didn't pre-
      // hash (rare — solutions are encouraged to send precomputed
      // hashes to avoid this extra round-trip).
      const hashedListing = await Promise.all(
        binaryListing.map(async (l) => {
          if (l.contentHash) return l;
          const fetched = await binarySource.loadBinaryArtifact(projectId, l.path);
          return { ...l, contentHash: sha256BinaryHasher(fetched.content) };
        }),
      );
      binaryFsDelta = await this.buildBinaryFsDelta(sessionId, artifactsBinaryDir);
      binaryPlan = new SyncEngine().planBinary({
        sessionId,
        dbNow: hashedListing,
        fsDelta: binaryFsDelta,
        previousSnapshot: binaryPrevSnapshot,
        now: new Date().toISOString(),
        hasher: sha256BinaryHasher,
        allowDelete: typeof binarySource.deleteBinaryArtifact === 'function',
      });
    }

    if (plan.actions.length === 0 && binaryPlan.actions.length === 0) {
      this.logger.debug(`sync: session=${sessionId} project=${projectId} no-op`);
      return;
    }

    this.logger.log(
      `sync: session=${sessionId} project=${projectId} applying ` +
      `${plan.actions.length} text + ${binaryPlan.actions.length} binary action(s)`,
    );

    // Track path rewrites that solutions return from saveArtifact
    // (sentPath → canonicalPath). Used below to rewrite both
    // nextSnapshot entries and ChangeEvents so the snapshot store
    // and SSE consumers see the actual persisted key. Phase 1 review M1.
    const pathRewrites = new Map<string, string>();
    for (const action of plan.actions) {
      const rewrite = await this.applyAction(action, projectId, artifactsDir, source);
      if (rewrite && rewrite.sentPath !== rewrite.canonicalPath) {
        this.logger.warn(
          `sync: solution rewrote path ${rewrite.sentPath} → ${rewrite.canonicalPath}; ` +
            `using canonical for snapshot (avoid by not normalizing paths server-side, ` +
            `see ProjectArtifactSource.saveArtifact JSDoc)`,
        );
        pathRewrites.set(rewrite.sentPath, rewrite.canonicalPath);
      }
    }

    const binaryPathRewrites = new Map<string, string>();
    for (const action of binaryPlan.actions) {
      const rewrite = await this.applyBinaryAction(
        action,
        projectId,
        artifactsBinaryDir,
        binarySource!,
      );
      if (rewrite && rewrite.sentPath !== rewrite.canonicalPath) {
        this.logger.warn(
          `sync (binary): solution rewrote path ${rewrite.sentPath} → ${rewrite.canonicalPath}`,
        );
        binaryPathRewrites.set(rewrite.sentPath, rewrite.canonicalPath);
      }
    }

    // Replace the snapshot wholesale ONCE for both halves. Text entries
    // keep their paths verbatim; binary entries get the binary-mount
    // prefix re-applied so the shared store can distinguish them on
    // the next sync's snapshot-split step above.
    await this.snapshots.clear(sessionId);
    for (const entry of plan.nextSnapshot) {
      const canonical = pathRewrites.get(entry.path);
      await this.snapshots.put(
        canonical ? { ...entry, path: canonical } : entry,
      );
    }
    for (const entry of binaryPlan.nextSnapshot) {
      const canonical = binaryPathRewrites.get(entry.path);
      const finalPath = `${ARTIFACTS_BINARY_DIR}/${canonical ?? entry.path}`;
      await this.snapshots.put({ ...entry, path: finalPath });
    }

    // Publish change events for the GUI — rewritten to canonical path
    // so SSE consumers reload-from-DB against the right key. Binary
    // events carry the binary-mount-relative path (no prefix) so GUI
    // consumers can route to the binary fetch endpoint.
    for (const action of plan.actions) {
      this.changes.publish(this.actionToEvent(projectId, action, pathRewrites));
    }
    for (const action of binaryPlan.actions) {
      this.changes.publish(
        this.binaryActionToEvent(projectId, action, binaryPathRewrites),
      );
    }
  }

  /**
   * Apply a single sync action. Returns a `{sentPath, canonicalPath}`
   * rewrite when the solution's `saveArtifact` reports that it
   * normalized the path server-side (Phase 1 review M1) — caller uses
   * this to keep the snapshot store in sync with the persisted key.
   * Returns undefined when no rewrite happened.
   */
  private async applyAction(
    action: SyncAction,
    projectId: string,
    artifactsDir: string,
    source: ProjectArtifactSource,
  ): Promise<{ sentPath: string; canonicalPath: string } | undefined> {
    const filePath = (rel: string) => path.join(artifactsDir, rel);
    switch (action.kind) {
      case 'write_fs':
        await this.writeFs(filePath(action.path), action.content);
        return undefined;
      case 'delete_fs':
        await fs.rm(filePath(action.path), { force: true });
        return undefined;
      case 'save_db': {
        const result = await source.saveArtifact(projectId, {
          path: action.path,
          content: action.content,
          type: action.type,
        });
        if (result?.canonicalPath) {
          return { sentPath: action.path, canonicalPath: result.canonicalPath };
        }
        return undefined;
      }
      case 'delete_db':
        // SyncEngine only plans this when allowDelete=true, so source
        // is guaranteed to have deleteArtifact. The guard is belt-and-
        // -braces against future refactors.
        if (source.deleteArtifact) {
          await source.deleteArtifact(projectId, action.path);
        }
        return undefined;
      case 'conflict_agent_wins': {
        // Persist agent's version to DB; fs already has it.
        const result = await source.saveArtifact(projectId, {
          path: action.path,
          content: action.agentContent,
          type: action.agentType,
        });
        // The conflict event is published separately by actionToEvent;
        // here we only do the persistence work.
        if (result?.canonicalPath) {
          return { sentPath: action.path, canonicalPath: result.canonicalPath };
        }
        return undefined;
      }
      default: {
        // Exhaustiveness check — adding a new SyncAction kind without
        // handling it here will surface as a typecheck error.
        const _exhaust: never = action;
        void _exhaust;
        return undefined;
      }
    }
  }

  /**
   * Writes through the mount path. Per Spike 0 (packages/backend/scripts/
   * spike-agentfs-write.ts), host fs.writeFile against the agentfs mount
   * propagates to live readers safely during the idle window between
   * turns — which is exactly when this handler runs.
   *
   * Creates parent dirs as needed (for nested paths like
   * "plans/q2/roadmap.md").
   */
  private async writeFs(absPath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content);
  }

  /**
   * Binary counterpart to `writeFs` — writes raw bytes (no string
   * encoding). Caller is responsible for sourcing the bytes (from the
   * agent-side fs read for save_db_binary, or from
   * `BinaryArtifactSource.loadBinaryArtifact` for
   * `write_fs_binary_from_listing`).
   */
  private async writeFsBinary(
    absPath: string,
    content: Buffer | Uint8Array,
  ): Promise<void> {
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content);
  }

  /**
   * Phase 2b-4: apply a single binary sync action. Mirrors `applyAction`
   * but for byte content. The action shapes deliberately split fetch +
   * write for the DB→fs cases (`write_fs_binary_from_listing` carries
   * the hash, not bytes) so we only pay the network round-trip for
   * paths that actually need it.
   */
  private async applyBinaryAction(
    action: BinarySyncAction,
    projectId: string,
    artifactsBinaryDir: string,
    source: BinaryArtifactSource,
  ): Promise<{ sentPath: string; canonicalPath: string } | undefined> {
    const filePath = (rel: string) => path.join(artifactsBinaryDir, rel);
    switch (action.kind) {
      case 'write_fs_binary_from_listing': {
        // Fetch the bytes from the solution; size cap is enforced by
        // the source adapter itself (RestBinaryArtifactSource).
        const snap = await source.loadBinaryArtifact(projectId, action.path);
        await this.writeFsBinary(filePath(action.path), snap.content);
        return undefined;
      }
      case 'delete_fs_binary':
        await fs.rm(filePath(action.path), { force: true });
        return undefined;
      case 'save_db_binary': {
        const result = await source.saveBinaryArtifact(projectId, {
          path: action.path,
          content: action.content,
          type: action.type,
          sizeBytes: action.sizeBytes,
        });
        if (result?.canonicalPath) {
          return { sentPath: action.path, canonicalPath: result.canonicalPath };
        }
        return undefined;
      }
      case 'delete_db_binary':
        if (source.deleteBinaryArtifact) {
          await source.deleteBinaryArtifact(projectId, action.path);
        }
        return undefined;
      case 'conflict_agent_wins_binary': {
        const result = await source.saveBinaryArtifact(projectId, {
          path: action.path,
          content: action.agentContent,
          type: action.agentType,
          sizeBytes: action.agentSizeBytes,
        });
        if (result?.canonicalPath) {
          return { sentPath: action.path, canonicalPath: result.canonicalPath };
        }
        return undefined;
      }
      default: {
        const _exhaust: never = action;
        void _exhaust;
        return undefined;
      }
    }
  }

  private actionToEvent(
    projectId: string,
    action: SyncAction,
    pathRewrites?: ReadonlyMap<string, string>,
  ): ChangeEvent {
    const at = new Date().toISOString();
    // Use canonical path in the event so SSE consumers reload-from-DB
    // hit the right key. Only save_db / conflict_agent_wins can have a
    // rewrite; the fs-side actions never go through saveArtifact.
    const canonicalPath = (sent: string) => pathRewrites?.get(sent) ?? sent;
    switch (action.kind) {
      case 'write_fs':
        return { projectId, path: action.path, source: 'gui', kind: 'updated', at };
      case 'delete_fs':
        return { projectId, path: action.path, source: 'gui', kind: 'deleted', at };
      case 'save_db':
        return { projectId, path: canonicalPath(action.path), source: 'agent', kind: 'updated', at };
      case 'delete_db':
        return { projectId, path: action.path, source: 'agent', kind: 'deleted', at };
      case 'conflict_agent_wins':
        return {
          projectId,
          path: canonicalPath(action.path),
          source: 'agent',
          kind: 'updated',
          at,
          actor: 'conflict-agent-wins',
        };
      default: {
        const _exhaust: never = action;
        void _exhaust;
        throw new Error(`unreachable: unhandled action kind`);
      }
    }
  }

  /**
   * Phase 2b-4: project binary actions into ChangeEvents on the shared
   * stream. Path is binary-mount-relative (no `artifacts-binary/` prefix)
   * so consumers can route to the binary fetch endpoint without parsing
   * the prefix. Distinguished from text events by `actor: 'binary'`
   * — keeps the existing `ChangeEvent` shape unchanged.
   */
  private binaryActionToEvent(
    projectId: string,
    action: BinarySyncAction,
    pathRewrites?: ReadonlyMap<string, string>,
  ): ChangeEvent {
    const at = new Date().toISOString();
    const canonicalPath = (sent: string) => pathRewrites?.get(sent) ?? sent;
    switch (action.kind) {
      case 'write_fs_binary_from_listing':
        return {
          projectId,
          path: action.path,
          source: 'gui',
          kind: 'updated',
          at,
          actor: 'binary',
        };
      case 'delete_fs_binary':
        return {
          projectId,
          path: action.path,
          source: 'gui',
          kind: 'deleted',
          at,
          actor: 'binary',
        };
      case 'save_db_binary':
        return {
          projectId,
          path: canonicalPath(action.path),
          source: 'agent',
          kind: 'updated',
          at,
          actor: 'binary',
        };
      case 'delete_db_binary':
        return {
          projectId,
          path: action.path,
          source: 'agent',
          kind: 'deleted',
          at,
          actor: 'binary',
        };
      case 'conflict_agent_wins_binary':
        return {
          projectId,
          path: canonicalPath(action.path),
          source: 'agent',
          kind: 'updated',
          at,
          actor: 'binary-conflict-agent-wins',
        };
      default: {
        const _exhaust: never = action;
        void _exhaust;
        throw new Error(`unreachable: unhandled binary action kind`);
      }
    }
  }

  /**
   * Resolve `solutionId → slug` via SolutionsService, cached locally.
   * Slugs are stable per tenant in practice (renaming would break
   * sessionId references), so cache invalidation is a non-goal.
   *
   * Phase 2 enhancement: if the tenants REST API ever exposes mid-run
   * slug rename, expose a `flushTenantCache(solutionId)` and have the
   * tenant update path call it. Until then, long-lived backend processes
   * that see a slug rename require a restart for the routing to refresh.
   * Tracked in docs/AGENT_RUNTIME_DESIGN.md § Open design questions.
   */
  private async resolveSlug(solutionId: string | undefined): Promise<string | null> {
    if (!solutionId) return null;
    if (this.tenantSlugCache.has(solutionId)) {
      return this.tenantSlugCache.get(solutionId) ?? null;
    }
    const tenant = await this.tenants.findOne(solutionId);
    const slug = tenant?.slug ?? null;
    this.tenantSlugCache.set(solutionId, slug);
    return slug;
  }

  /**
   * Resolve the bound projectId for a session via session_metadata.
   * Returns null if no binding exists yet (treated as "not project-scoped").
   */
  private async lookupProjectId(
    sessionId: string,
    solutionId: string | undefined,
  ): Promise<string | null> {
    if (!solutionId) return null;
    try {
      const row = await this.metadata.get(sessionId, solutionId, 'projectId');
      // SessionMetadataService.toRow already JSON.parses value — receive `unknown`.
      const value = row.value;
      return typeof value === 'string' && value.length > 0 ? value : null;
    } catch (err) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  /**
   * Build an `FsDelta` from the WorkspaceProvider's diff() output,
   * filtered to the `artifacts/` directory. Reads file contents from
   * the mount for `modified`/`added` entries (the diff endpoint
   * reports paths only).
   *
   * When the provider doesn't support diff() (LocalProvider in
   * particular), falls back to a manual walk of `artifactsDir`,
   * hashing each file and comparing to the previous snapshot. This
   * keeps the agent→DB sync direction working under
   * `WORKSPACE_PROVIDER=local` — without the fallback, every sync
   * would be a no-op because no diff source exists.
   */
  private async buildFsDelta(
    sessionId: string,
    artifactsDir: string,
    previousSnapshot: ReadonlyArray<SnapshotEntry>,
  ): Promise<FsDelta> {
    const session = this.sessions.getSession(sessionId);
    if (session?.workspaceHandle?.diff) {
      return this.buildFsDeltaFromDiff(session.workspaceHandle.diff, artifactsDir);
    }
    // Local provider has no native diff — walk + hash against snapshot.
    return this.buildFsDeltaFromWalk(artifactsDir, previousSnapshot);
  }

  /** Native-diff path (agentfs). The provider tells us exactly what changed. */
  private async buildFsDeltaFromDiff(
    diff: () => Promise<FsDiffEntry[]>,
    artifactsDir: string,
  ): Promise<FsDelta> {
    const allEntries: FsDiffEntry[] = await diff();
    const modified: Array<{ path: string; content: string; type: string }> = [];
    const deleted: string[] = [];

    // Compute the workspace-relative prefix for artifacts/, e.g.
    // "artifacts/" — we want only paths under it.
    const prefix = ARTIFACTS_DIR.endsWith('/') ? ARTIFACTS_DIR : `${ARTIFACTS_DIR}/`;

    for (const entry of allEntries) {
      if (entry.type !== 'file') continue;
      // agentfs reports paths with leading '/'. Normalize.
      const rel = entry.path.startsWith('/') ? entry.path.slice(1) : entry.path;
      if (!rel.startsWith(prefix)) continue;
      const artifactPath = rel.slice(prefix.length);
      if (artifactPath.length === 0) continue;

      if (entry.op === 'removed') {
        deleted.push(artifactPath);
        continue;
      }

      // 'added' or 'modified': read the file content from the mount.
      const absPath = path.join(artifactsDir, artifactPath);
      try {
        const content = await fs.readFile(absPath, 'utf8');
        modified.push({
          path: artifactPath,
          content,
          type: this.guessType(artifactPath),
        });
      } catch (err) {
        this.logger.warn(
          `failed to read agent-modified file ${absPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { modified, deleted };
  }

  /**
   * Walk-based diff for LocalProvider (or any provider without diff()).
   * Recursively walks `artifactsDir`, hashes every file, and emits
   * FsDelta entries by comparing against the previous snapshot:
   *
   *   - file on disk, not in snapshot                   → 'added'
   *   - file on disk, snapshot hash mismatches          → 'modified'
   *   - file in snapshot, not on disk                   → 'removed'
   *   - file on disk, snapshot hash matches             → unchanged
   *
   * Paths in the returned delta are relative to `artifactsDir` (no
   * `artifacts/` prefix), matching the native-diff path and the
   * snapshot's own key convention.
   */
  private async buildFsDeltaFromWalk(
    artifactsDir: string,
    previousSnapshot: ReadonlyArray<SnapshotEntry>,
  ): Promise<FsDelta> {
    const snapshotByPath = new Map<string, SnapshotEntry>();
    for (const entry of previousSnapshot) {
      snapshotByPath.set(entry.path, entry);
    }

    const modified: Array<{ path: string; content: string; type: string }> = [];
    const seenOnDisk = new Set<string>();

    // Recursive walk under artifactsDir. Missing dir = nothing to diff
    // (bootstrap hasn't run yet, or the session was just created).
    const walk = async (absDir: string): Promise<void> => {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(absDir, { withFileTypes: true });
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT' || code === 'ENOTDIR') return;
        throw err;
      }
      for (const ent of entries) {
        const absPath = path.join(absDir, ent.name);
        if (ent.isDirectory()) {
          await walk(absPath);
          continue;
        }
        if (!ent.isFile()) continue;
        const artifactPath = path.relative(artifactsDir, absPath);
        seenOnDisk.add(artifactPath);
        let content: string;
        try {
          content = await fs.readFile(absPath, 'utf8');
        } catch (err) {
          this.logger.warn(
            `walk: failed to read ${absPath}: ${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }
        const hash = sha256Hasher(content);
        const prior = snapshotByPath.get(artifactPath);
        if (!prior || prior.contentHash !== hash) {
          modified.push({
            path: artifactPath,
            content,
            type: this.guessType(artifactPath),
          });
        }
      }
    };
    await walk(artifactsDir);

    // Anything in snapshot but not on disk = agent deleted it.
    const deleted: string[] = [];
    for (const snap of previousSnapshot) {
      if (!seenOnDisk.has(snap.path)) {
        deleted.push(snap.path);
      }
    }

    return { modified, deleted };
  }

  /** Naive extension-to-type mapping; solutions can override via their source's saveArtifact. */
  private guessType(artifactPath: string): string {
    const ext = path.extname(artifactPath).slice(1).toLowerCase();
    if (ext === 'md' || ext === 'markdown') return 'md';
    if (ext === 'json') return 'json';
    if (ext === 'yaml' || ext === 'yml') return 'yaml';
    if (ext === 'txt') return 'txt';
    return ext || 'txt';
  }

  /**
   * Phase 2b-4: binary counterpart to `buildFsDelta`. Filters the
   * agent's fs diff to the `artifacts-binary/` prefix and reads file
   * contents as raw Buffers (no encoding). Returns an empty delta when
   * the provider doesn't support diff() — sync becomes one-way DB→fs
   * for binaries on LocalProvider too.
   */
  private async buildBinaryFsDelta(
    sessionId: string,
    artifactsBinaryDir: string,
  ): Promise<BinaryFsDelta> {
    const session = this.sessions.getSession(sessionId);
    if (!session?.workspaceHandle?.diff) {
      return { modified: [], deleted: [] };
    }

    const allEntries: FsDiffEntry[] = await session.workspaceHandle.diff();
    const modified: Array<{
      path: string;
      content: Buffer;
      type: string;
      sizeBytes: number;
    }> = [];
    const deleted: string[] = [];

    const prefix = ARTIFACTS_BINARY_DIR.endsWith('/')
      ? ARTIFACTS_BINARY_DIR
      : `${ARTIFACTS_BINARY_DIR}/`;

    for (const entry of allEntries) {
      if (entry.type !== 'file') continue;
      const rel = entry.path.startsWith('/') ? entry.path.slice(1) : entry.path;
      if (!rel.startsWith(prefix)) continue;
      const artifactPath = rel.slice(prefix.length);
      if (artifactPath.length === 0) continue;

      if (entry.op === 'removed') {
        deleted.push(artifactPath);
        continue;
      }

      const absPath = path.join(artifactsBinaryDir, artifactPath);
      try {
        const content = await fs.readFile(absPath); // no encoding → Buffer
        modified.push({
          path: artifactPath,
          content,
          type: this.guessBinaryType(artifactPath),
          sizeBytes: content.length,
        });
      } catch (err) {
        this.logger.warn(
          `failed to read agent-modified binary ${absPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { modified, deleted };
  }

  /** Best-effort extension → binary type mapping. Solutions can override
   *  via `saveBinaryArtifact` (the persisted type is whatever the
   *  solution chooses to store). */
  private guessBinaryType(artifactPath: string): string {
    const ext = path.extname(artifactPath).slice(1).toLowerCase();
    return ext || 'application/octet-stream';
  }
}
