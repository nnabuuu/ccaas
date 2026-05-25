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
  ChangeEvent,
  ChangeStream,
  ContentHasher,
  FsDelta,
  ProjectArtifactSource,
  SnapshotStore,
  SyncAction,
} from '@kedge-agentic/agent-runtime';
import { SyncEngine } from '@kedge-agentic/agent-runtime';

import { SessionService } from '../session.service';
import { SessionMetadataService } from '../services/session-metadata.service';
import type { FsDiffEntry } from '../workspace/types';

import {
  CHANGE_STREAM,
  PROJECT_ARTIFACT_SOURCE,
  SNAPSHOT_STORE,
} from './tokens';

/** Workspace-relative directory holding live artifact projections. */
export const ARTIFACTS_DIR = 'artifacts';

const sha256Hasher: ContentHasher = (s: string) =>
  createHash('sha256').update(s).digest('hex');

export interface SessionTurnCompleteEvent {
  sessionId: string;
  tenantId?: string;
  status: 'complete' | 'error' | 'cancelled';
  exitCode: number | null;
}

export interface SessionBoundEvent {
  sessionId: string;
  tenantId: string;
  projectId: string;
}

@Injectable()
export class SessionAssetSyncer {
  private readonly logger = new Logger(SessionAssetSyncer.name);
  /** Per-projectId mutex so two sessions on the same project don't race. */
  private readonly projectLocks = new Map<string, Promise<void>>();

  constructor(
    @Inject(PROJECT_ARTIFACT_SOURCE) private readonly source: ProjectArtifactSource,
    @Inject(SNAPSHOT_STORE) private readonly snapshots: SnapshotStore,
    @Inject(CHANGE_STREAM) private readonly changes: ChangeStream,
    private readonly sessions: SessionService,
    private readonly metadata: SessionMetadataService,
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
   * Bootstrap hook — fires when a session first binds to a projectId
   * (via `SessionService.bindToProject`). Runs the same `sync()` flow
   * as turn-end; since the previous snapshot is empty, every DB-side
   * artifact is treated as a `write_fs` action, producing the initial
   * materialized state under `<workspace>/artifacts/` before the
   * agent's first turn ever reads it.
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

    const projectId = await this.lookupProjectId(sessionId, session.tenantId);
    if (!projectId) {
      this.logger.debug(`sync: session ${sessionId} has no projectId binding, skipping`);
      return;
    }

    // Serialize syncs per projectId: each new request chains onto the
    // previous one so two sessions on the same project don't race the
    // SyncEngine.plan inputs or the SnapshotStore writes.
    const prior = this.projectLocks.get(projectId);
    const run = (async () => {
      await prior?.catch(() => undefined);
      await this.doSync(sessionId, projectId, session.workspaceDir);
    })();
    const settled: Promise<void> = run.then(
      () => undefined,
      () => undefined,
    );
    this.projectLocks.set(projectId, settled);
    try {
      await run;
    } finally {
      // GC the lock if no later sync has chained onto ours. Reference
      // equality means we only delete the entry we wrote; if another
      // call has already replaced it, that one owns the slot.
      if (this.projectLocks.get(projectId) === settled) {
        this.projectLocks.delete(projectId);
      }
    }
  }

  private async doSync(
    sessionId: string,
    projectId: string,
    workspaceDir: string,
  ): Promise<void> {
    const artifactsDir = path.join(workspaceDir, ARTIFACTS_DIR);
    await fs.mkdir(artifactsDir, { recursive: true });

    const [dbNow, previousSnapshot, fsDelta] = await Promise.all([
      this.source.loadArtifacts(projectId),
      this.snapshots.list(sessionId),
      this.buildFsDelta(sessionId, artifactsDir),
    ]);

    const plan = new SyncEngine().plan({
      sessionId,
      dbNow,
      fsDelta,
      previousSnapshot,
      now: new Date().toISOString(),
      hasher: sha256Hasher,
      // When the solution can't delete, the engine plans `write_fs`
      // (restore from DB) instead of `delete_db` so the agent's
      // delete is reverted on next read rather than silently dropped.
      allowDelete: typeof this.source.deleteArtifact === 'function',
    });

    if (plan.actions.length === 0) {
      this.logger.debug(`sync: session=${sessionId} project=${projectId} no-op`);
      return;
    }

    this.logger.log(
      `sync: session=${sessionId} project=${projectId} applying ${plan.actions.length} action(s)`,
    );

    for (const action of plan.actions) {
      await this.applyAction(action, projectId, artifactsDir);
    }

    // Replace the snapshot wholesale — actions are over, the new
    // snapshot is the source of truth for the next sync.
    await this.snapshots.clear(sessionId);
    for (const entry of plan.nextSnapshot) {
      await this.snapshots.put(entry);
    }

    // Publish change events for the GUI.
    for (const action of plan.actions) {
      this.changes.publish(this.actionToEvent(projectId, action));
    }
  }

  private async applyAction(
    action: SyncAction,
    projectId: string,
    artifactsDir: string,
  ): Promise<void> {
    const filePath = (rel: string) => path.join(artifactsDir, rel);
    switch (action.kind) {
      case 'write_fs':
        await this.writeFs(filePath(action.path), action.content);
        break;
      case 'delete_fs':
        await fs.rm(filePath(action.path), { force: true });
        break;
      case 'save_db':
        await this.source.saveArtifact(projectId, {
          path: action.path,
          content: action.content,
          type: action.type,
        });
        break;
      case 'delete_db':
        // SyncEngine only plans this when allowDelete=true, so source
        // is guaranteed to have deleteArtifact. The guard is belt-and-
        // -braces against future refactors.
        if (this.source.deleteArtifact) {
          await this.source.deleteArtifact(projectId, action.path);
        }
        break;
      case 'conflict_agent_wins':
        // Persist agent's version to DB; fs already has it.
        await this.source.saveArtifact(projectId, {
          path: action.path,
          content: action.agentContent,
          type: action.agentType,
        });
        // The conflict event is published separately by actionToEvent;
        // here we only do the persistence work.
        break;
      default: {
        // Exhaustiveness check — adding a new SyncAction kind without
        // handling it here will surface as a typecheck error.
        const _exhaust: never = action;
        void _exhaust;
        break;
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

  private actionToEvent(projectId: string, action: SyncAction): ChangeEvent {
    const at = new Date().toISOString();
    switch (action.kind) {
      case 'write_fs':
        return { projectId, path: action.path, source: 'gui', kind: 'updated', at };
      case 'delete_fs':
        return { projectId, path: action.path, source: 'gui', kind: 'deleted', at };
      case 'save_db':
        return { projectId, path: action.path, source: 'agent', kind: 'updated', at };
      case 'delete_db':
        return { projectId, path: action.path, source: 'agent', kind: 'deleted', at };
      case 'conflict_agent_wins':
        return {
          projectId,
          path: action.path,
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
   * Resolve the bound projectId for a session via session_metadata.
   * Returns null if no binding exists yet (treated as "not project-scoped").
   */
  private async lookupProjectId(
    sessionId: string,
    tenantId: string | undefined,
  ): Promise<string | null> {
    if (!tenantId) return null;
    try {
      const row = await this.metadata.get(sessionId, tenantId, 'projectId');
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
   * Returns an empty delta when the provider doesn't support diff()
   * (LocalProvider) — sync becomes one-way DB→fs in that case, which
   * is degraded but useful.
   */
  private async buildFsDelta(
    sessionId: string,
    artifactsDir: string,
  ): Promise<FsDelta> {
    const session = this.sessions.getSession(sessionId);
    if (!session?.workspaceHandle?.diff) {
      return { modified: [], deleted: [] };
    }

    const allEntries: FsDiffEntry[] = await session.workspaceHandle.diff();
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

  /** Naive extension-to-type mapping; solutions can override via their source's saveArtifact. */
  private guessType(artifactPath: string): string {
    const ext = path.extname(artifactPath).slice(1).toLowerCase();
    if (ext === 'md' || ext === 'markdown') return 'md';
    if (ext === 'json') return 'json';
    if (ext === 'yaml' || ext === 'yml') return 'yaml';
    if (ext === 'txt') return 'txt';
    return ext || 'txt';
  }
}
