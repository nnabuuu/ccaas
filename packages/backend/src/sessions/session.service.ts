/**
 * Session Service
 *
 * Manages persistent AgentEngine sessions with lifecycle management.
 * Supports: Claude Code, OpenCode, and custom engine implementations.
 * Each session maintains an AgentEngine process that can handle
 * multiple messages while preserving context via --resume.
 */

import {
  Inject,
  Injectable,
  OnModuleDestroy,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Socket } from 'socket.io';
import { EventMapperService } from './event-mapper.service';
import { CliProcessService, ResolvedAttachment } from './services/cli-process.service';
import { WorkspaceService } from './services/workspace.service';
import { BackgroundTaskMonitorService } from './services/background-task-monitor.service';
import { StreamRegistryService } from './services/stream-registry.service';
import { SessionAssetMaterializer } from './services/session-asset-materializer.service';
import { SessionMetadataService } from './services/session-metadata.service';
import { WORKSPACE_PROVIDER, type WorkspaceProvider } from './workspace/types';
import { Session as SessionEntity } from '../admin/entities/session.entity';
import type {
  ManagedSession,
  SessionStats,
  SessionEvent,
  WorkspaceFileInfo,
  WorkspaceTreeResponse,
} from '../common/interfaces';

export type { ResolvedAttachment } from './services/cli-process.service';

/**
 * Session details for REST API responses
 * Week 4: Added for session restart endpoint
 */
export interface SessionDetails {
  sessionId: string;
  userId?: string;
  tenantId?: string;
  status: string;
  needsRestart: boolean;
  syncedSkillCount: number;
  lastActivity: Date;
  createdAt: Date;
}

@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private sessions = new Map<string, ManagedSession>();
  private clientSessions = new Map<string, Set<string>>();
  /**
   * agent-runtime sync layer: sessionId → bound projectId. Populated by
   * `bindToProject`; cleared when the session is removed from `sessions`.
   * Provides O(n) reverse lookup for `findSessionsByProjectId`, which the
   * invalidate REST endpoint and any cross-session sync orchestration use.
   */
  private projectBindings = new Map<string, string>();
  /**
   * Per-sessionId Promise dedup for concurrent getOrCreateSession calls
   * (sanity check A in WORKSPACE_PROVIDER.md). Map.has + Map.set are
   * synchronous, preserving the atomicity that today's
   * "sync mkdir before any await" gave us. Provider create() is now
   * async (subprocess for agentfs) so without this, two concurrent
   * requests would race on agentfs init --force (sanity check B).
   */
  private pendingCreates = new Map<string, Promise<ManagedSession>>();
  /**
   * In-flight `workspaceProvider.close(sessionId)` promises, populated
   * synchronously by `closeSession`. Lets graceful `shutdown()` await
   * unmount completion before the process exits (otherwise the agentfs
   * daemon would survive the backend briefly). For non-shutdown callers
   * (GC, eviction) close still appears fire-and-forget.
   */
  private pendingCloses = new Map<string, Promise<void>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private readonly workspaceDir: string;
  private readonly sessionTtlMs: number;
  private readonly maxSessions: number;
  private readonly cleanupIntervalMs: number;
  private readonly maxProcessingMs: number;
  private readonly cleanupPressureHighThreshold: number;
  private readonly cleanupPressureCriticalThreshold: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventMapperService: EventMapperService,
    private readonly cliProcessService: CliProcessService,
    private readonly workspaceService: WorkspaceService,
    private readonly backgroundTaskMonitorService: BackgroundTaskMonitorService,
    private readonly streamRegistry: StreamRegistryService,
    private readonly sessionAssetMaterializer: SessionAssetMaterializer,
    private readonly sessionMetadataService: SessionMetadataService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(WORKSPACE_PROVIDER)
    private readonly workspaceProvider: WorkspaceProvider,
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
  ) {
    this.workspaceDir = this.configService.get('workspace.dir', '.agent-workspace');
    this.sessionTtlMs = this.configService.get('workspace.sessionTtlMs', 300000);
    this.maxSessions = this.configService.get('workspace.maxSessions', 100);
    this.cleanupIntervalMs = this.configService.get('workspace.cleanupIntervalMs', 300000);
    this.maxProcessingMs = this.configService.get('workspace.maxProcessingMs', 1800000);
    this.cleanupPressureHighThreshold = this.configService.get('workspace.cleanupPressureHighThreshold', 80);
    this.cleanupPressureCriticalThreshold = this.configService.get('workspace.cleanupPressureCriticalThreshold', 90);

    this.startCleanupTimer();

    // Register background task callback
    this.eventMapperService.registerBackgroundTaskCallback((sessionId, tracker) => {
      // Only monitor if outputFile is present
      if (tracker.outputFile) {
        this.backgroundTaskMonitorService.startBackgroundTaskMonitor(
          sessionId,
          {
            subAgentId: tracker.subAgentId,
            outputFile: tracker.outputFile,
            startedAt: tracker.startedAt,
          },
          (sid) => this.getSession(sid),
        );
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  /**
   * Get or create a session for a client
   */
  async getOrCreateSession(
    sessionId: string,
    clientId: string,
    socket: Socket | null,
    userId?: string,
    tenantId?: string,
  ): Promise<ManagedSession> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.socket = socket;
      existing.lastActivity = new Date();
      if (!existing.userId && userId) existing.userId = userId;
      if (!existing.tenantId && tenantId) existing.tenantId = tenantId;
      this.logger.log(`Reusing existing session ${sessionId}`);
      return existing;
    }

    // De-dup concurrent create calls for the same sessionId. Map.has +
    // Map.set are synchronous, preserving the atomicity invariant that
    // today's pre-async-provider code relied on (everything happened
    // synchronously before the first await). See WORKSPACE_PROVIDER.md
    // sanity check A.
    const inFlight = this.pendingCreates.get(sessionId);
    if (inFlight) {
      this.logger.log(`Reusing in-flight create for session ${sessionId}`);
      return inFlight;
    }
    const promise = this._createNewSession(sessionId, clientId, socket, userId, tenantId)
      .finally(() => this.pendingCreates.delete(sessionId));
    this.pendingCreates.set(sessionId, promise);
    return promise;
  }

  private async _createNewSession(
    sessionId: string,
    clientId: string,
    socket: Socket | null,
    userId?: string,
    tenantId?: string,
  ): Promise<ManagedSession> {
    // Proactive pressure cleanup: if utilization ≥ high threshold, run cleanup now
    // (don't wait for the 5-min timer)
    const utilizationPct = (this.sessions.size / this.maxSessions) * 100;
    if (utilizationPct >= this.cleanupPressureHighThreshold) {
      this.logger.warn(
        `Session pool pressure ${utilizationPct.toFixed(0)}% — triggering proactive cleanup`,
      );
      this.cleanupIdleSessions();
    }

    if (this.sessions.size >= this.maxSessions) {
      const cleaned = this.cleanupOldestIdleSession();
      if (!cleaned) {
        throw new Error(`Max sessions limit (${this.maxSessions}) reached`);
      }
    }

    // WorkspaceProvider handles mkdir + .claude/settings.local.json. For
    // AgentfsProvider it also initializes the delta db + FUSE/NFS mount.
    // Both yield the same ${WORKSPACE_DIR}/sessions/{id}/ path so
    // consumers reading `session.workspaceDir` as a string keep working.
    // MCP symlinks are NOT created here — that's the existing
    // `this.createMcpSymlinks(session)` gateway-driven path, invoked
    // once `session.mcpServers` is populated.
    const handle = await this.workspaceProvider.create({ sessionId, tenantId });

    // Seed entities/ + resources/ from the registered solution dir (if any)
    // into the session workspace root. No-op when SOLUTION_DIRS env is unset
    // or the tenant isn't in the map. Idempotent (SHA-1 gate per file).
    await this.sessionAssetMaterializer.materialize(handle.path, tenantId);

    const session: ManagedSession = {
      sessionId,
      clientId,
      cliProcess: null,
      stdin: null,
      socket,
      lastActivity: new Date(),
      status: 'idle',
      createdAt: new Date(),
      messageCount: 0,
      buffer: '',
      workspaceDir: handle.path,
      workspaceHandle: handle,
      userId,
      tenantId,
      syncedSkillIds: new Set(),
    };

    this.sessions.set(sessionId, session);

    if (!this.clientSessions.has(clientId)) {
      this.clientSessions.set(clientId, new Set());
    }
    this.clientSessions.get(clientId)!.add(sessionId);

    this.logger.log(`Created new session ${sessionId} for client ${clientId}`);
    this.logger.log(`Active sessions: ${this.sessions.size}/${this.maxSessions}`);

    try {
      await this.persistSessionToDatabase(session);
    } catch (error) {
      this.logger.error(
        `Failed to persist session ${sessionId} to database: ${error.message}`,
        error.stack,
      );
      // Session continues to work in-memory even if database write fails
    }

    return session;
  }

  /**
   * Get an existing session by ID
   */
  getSession(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Bind a session to a project for the agent-runtime sync layer.
   * Writes `session_metadata['projectId']` and emits `session.bound`
   * so the SessionAssetSyncer bootstraps the workspace `artifacts/`
   * dir from the solution's `ProjectArtifactSource.loadArtifacts()`
   * before the first agent turn.
   *
   * Idempotent: calling twice with the same `projectId` is a no-op
   * write (metadata upserts) + a re-bootstrap (also no-op when the
   * snapshot is already current).
   *
   * Solutions call this immediately after creating a project-scoped
   * agent session, before the first message lands.
   */
  async bindToProject(
    sessionId: string,
    tenantId: string,
    projectId: string,
  ): Promise<void> {
    if (!projectId) {
      throw new BadRequestException('projectId required');
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException(`session ${sessionId} not found`);
    }
    await this.sessionMetadataService.put(
      sessionId,
      tenantId,
      'projectId',
      projectId,
    );
    this.projectBindings.set(sessionId, projectId);
    this.eventEmitter.emit('session.bound', { sessionId, tenantId, projectId });
  }

  /**
   * Reverse lookup for the agent-runtime invalidate endpoint:
   * which active sessions are bound to `projectId`. Walks the
   * in-memory bindings map; only returns sessions that are still
   * live in `this.sessions` (filters out stale entries from
   * pre-cleanup races).
   */
  findSessionsByProjectId(projectId: string): string[] {
    const out: string[] = [];
    for (const [sid, pid] of this.projectBindings) {
      if (pid === projectId && this.sessions.has(sid)) {
        out.push(sid);
      }
    }
    return out;
  }

  /**
   * Get all sessions for a client
   */
  getClientSessions(clientId: string): ManagedSession[] {
    const sessionIds = this.clientSessions.get(clientId);
    if (!sessionIds) return [];

    const sessions: ManagedSession[] = [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session) sessions.push(session);
    }
    return sessions;
  }

  /**
   * Get a session by clientId (returns the most recent active session)
   * Used by REST API to find session when sessionId is not provided
   */
  getSessionByClientId(clientId: string): ManagedSession | undefined {
    const sessions = this.getClientSessions(clientId);
    if (sessions.length === 0) return undefined;

    // Return the most recently active session
    return sessions.reduce((latest, session) =>
      session.lastActivity > latest.lastActivity ? session : latest,
    );
  }

  /**
   * Spawn or reuse AgentEngine process for a session
   * Supports: Claude Code, OpenCode, custom engines
   */
  async ensureCLIProcess(
    session: ManagedSession,
    initialMessage: string,
    onEvent: (event: SessionEvent) => void,
    attachments?: ResolvedAttachment[],
    appendSystemPrompt?: string,
  ): Promise<void> {
    return this.cliProcessService.ensureCLIProcess(
      session,
      initialMessage,
      onEvent,
      attachments,
      appendSystemPrompt,
    );
  }

  /**
   * Send a follow-up message to an existing AgentEngine process
   * Uses --resume to restore session context
   */
  async sendFollowUp(
    session: ManagedSession,
    message: string,
    onEvent: (event: SessionEvent) => void,
    attachments?: ResolvedAttachment[],
  ): Promise<void> {
    return this.cliProcessService.sendFollowUp(session, message, onEvent, attachments);
  }


  /**
   * Cancel/kill a session's AgentEngine process
   * Sends SIGTERM, with 5-second SIGKILL timeout
   */
  cancelSession(sessionId: string, onEvent?: (event: any) => void): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    return this.cliProcessService.cancelSession(session, onEvent);
  }

  /**
   * Close and remove a session
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.logger.log(`Closing session ${sessionId}`);

    // Stop all background task monitors for this session
    this.backgroundTaskMonitorService.stopAllMonitorsForSession(sessionId);

    // Clean up push SSE channel (separate from per-turn channel)
    this.streamRegistry.cleanupSession(`${sessionId}:push`);

    if (session.cliProcess && !session.cliProcess.killed) {
      session.cliProcess.kill('SIGTERM');
    }

    this.sessions.delete(sessionId);
    this.clientSessions.get(session.clientId)?.delete(sessionId);
    this.projectBindings.delete(sessionId);

    this.eventMapperService.clearSessionState(sessionId);

    // Release provider resources (no-op for LocalProvider; unmounts for
    // AgentfsProvider). Fire-and-forget for non-shutdown callers (idle GC,
    // max-session eviction, manual close) so they don't block on unmount.
    // The promise is parked in `pendingCloses` so `shutdown()` can await
    // graceful unmount before the process exits (otherwise the agentfs
    // mount daemon outlives the backend; see v5 validation finding).
    const closePromise = this.workspaceProvider.close(sessionId)
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`workspaceProvider.close(${sessionId}) failed: ${msg}`);
      })
      .finally(() => {
        this.pendingCloses.delete(sessionId);
      });
    this.pendingCloses.set(sessionId, closePromise);

    // Phase 2: Update database to mark session as closed (fire-and-forget)
    this.updateSessionInDatabase(sessionId, {
      status: 'closed',
      closedAt: new Date(),
    }).catch((error) => {
      this.logger.error(
        `[Phase 2] Failed to mark session ${sessionId} as closed in database: ${error.message}`,
      );
      // Non-critical error, session cleanup continues
    });
  }

  /**
   * Attempt to reconnect to an existing session
   */
  reconnectSession(
    sessionId: string,
    clientId: string,
    socket: Socket,
  ): ManagedSession | null {
    const session = this.sessions.get(sessionId);

    if (!session) {
      this.logger.log(`Session ${sessionId} not found for reconnect`);
      return null;
    }

    if (session.clientId !== clientId) {
      this.logger.warn(
        `Client ${clientId} cannot reconnect to session owned by ${session.clientId}`,
      );
      return null;
    }

    this.logger.log(`Reconnecting client ${clientId} to session ${sessionId}`);
    session.socket = socket;
    session.lastActivity = new Date();

    return session;
  }

  /**
   * Get session statistics, optionally filtered by tenant
   */
  getStats(tenantId?: string): SessionStats {
    let idle = 0;
    let processing = 0;
    let total = 0;

    for (const session of this.sessions.values()) {
      if (tenantId && session.tenantId !== tenantId) continue;
      total++;
      if (session.status === 'idle') idle++;
      if (session.status === 'processing') processing++;
    }

    return {
      totalSessions: total,
      idleSessions: idle,
      processingSessions: processing,
      maxSessions: this.maxSessions,
    };
  }

  /**
   * Get all managed sessions (for admin dashboard)
   */
  getAllSessions(): ManagedSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Check if a session has an active AgentEngine process
   */
  hasActiveProcess(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    return this.cliProcessService.hasActiveProcess(session);
  }

  /**
   * Restart a session by killing its AgentEngine process
   * Next message will spawn fresh engine with updated skills
   */
  /**
   * Restart a session
   *
   * Week 4: Enhanced to throw errors and update skillSyncedAt
   *
   * @param sessionId - The session ID to restart
   * @param tenantId - Optional tenant ID for verification
   * @throws Error if session not found or tenant mismatch
   */
  async restartSession(sessionId: string, tenantId?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Verify tenant ownership if provided
    if (tenantId && session.tenantId !== tenantId) {
      throw new Error(`Tenant ${tenantId} cannot restart session owned by ${session.tenantId}`);
    }

    // Kill AgentEngine if running
    if (session.cliProcess && !session.cliProcess.killed) {
      this.logger.log(`Killing AgentEngine for session restart: ${sessionId}`);
      session.cliProcess.kill('SIGTERM');

      // Wait a bit for graceful shutdown
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Force kill if still alive
      if (session.cliProcess && !session.cliProcess.killed) {
        this.logger.warn(`Force killing AgentEngine for session: ${sessionId}`);
        session.cliProcess.kill('SIGKILL');
      }

      session.cliProcess = null;
      session.stdin = null;
    }

    // Clear restart flag and reset status
    session.needsRestart = false;
    session.status = 'idle';
    session.lastActivity = new Date();

    // Week 4: Update skillSyncedAt to indicate restart
    session.skillSyncedAt = new Date();

    this.logger.log(`Session ${sessionId} restarted successfully`);
  }

  /**
   * Get detailed session information
   *
   * Week 4: New method for session details endpoint
   *
   * @param sessionId - The session ID
   * @returns Session details or null if not found
   */
  getSessionDetails(sessionId: string): SessionDetails | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      tenantId: session.tenantId,
      status: session.status,
      needsRestart: session.needsRestart || false,
      syncedSkillCount: session.syncedSkillIds?.size || 0,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
    };
  }

  /**
   * Persist templateName to database for an existing session.
   * Called by orchestration after template resolution on first message.
   */
  async persistTemplateName(sessionId: string, templateName: string): Promise<void> {
    await this.updateSessionInDatabase(sessionId, { templateName });
  }

  /**
   * Check if a session can be restarted
   *
   * Week 4: New method for restart validation
   *
   * @param sessionId - The session ID
   * @returns true if session can be restarted
   */
  canRestartSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    // Cannot restart if currently processing
    if (session.status === 'processing') {
      return false;
    }

    // Can only restart if needsRestart flag is explicitly set
    return session.needsRestart === true;
  }

  /**
   * Get all sessions for a tenant
   */
  getSessionsByTenant(tenantId: string): ManagedSession[] {
    const sessions: ManagedSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  /**
   * Mark sessions for a tenant as needing restart
   *
   * Week 3 Enhancement: Accepts optional skillId for precise restart
   * - If skillId provided: Only marks sessions that have that skill synced
   * - If skillId omitted: Marks all tenant sessions (backward compatibility)
   *
   * @param tenantId - The tenant ID
   * @param skillId - Optional skill ID to filter sessions (Week 3)
   * @returns Array of affected session IDs
   */
  markSessionsForRestart(tenantId: string, skillId?: string): string[] {
    const affectedSessionIds: string[] = [];

    // Week 3: If skillId provided, only mark sessions with that skill
    if (skillId) {
      const affectedSessions = this.getAffectedSessions(tenantId, skillId);
      for (const session of affectedSessions) {
        session.needsRestart = true;
        affectedSessionIds.push(session.sessionId);
        this.logger.debug(`Marked session ${session.sessionId} as needing restart (skill: ${skillId})`);
      }
    } else {
      // Backward compatibility: Mark all tenant sessions
      for (const session of this.sessions.values()) {
        if (session.tenantId === tenantId) {
          session.needsRestart = true;
          affectedSessionIds.push(session.sessionId);
          this.logger.debug(`Marked session ${session.sessionId} as needing restart`);
        }
      }
    }

    if (affectedSessionIds.length > 0) {
      this.logger.log(
        `Marked ${affectedSessionIds.length} sessions for tenant ${tenantId} as needing restart${skillId ? ` (skill: ${skillId})` : ''}`,
      );
    }

    return affectedSessionIds;
  }

  /**
   * Track which skills are synced to a session
   *
   * Week 3: Called after skill sync to track which skills this session uses.
   * Enables precise session restart when specific skills are updated.
   *
   * @param sessionId - The session ID
   * @param skillIds - Array of skill IDs that were synced
   */
  trackSyncedSkills(sessionId: string, skillIds: string[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Cannot track skills for non-existent session: ${sessionId}`);
      return;
    }

    // Reset and populate with new skill IDs
    session.syncedSkillIds = new Set(skillIds);

    this.logger.debug(
      `Tracked ${skillIds.length} synced skills for session ${sessionId}: ${skillIds.join(', ')}`,
    );
  }

  /**
   * Get sessions affected by a skill update
   *
   * Week 3: Returns only sessions that have the specified skill synced.
   * Used for precise session restart marking.
   *
   * @param tenantId - The tenant ID
   * @param skillId - The skill ID
   * @returns Array of sessions that have this skill synced
   */
  getAffectedSessions(tenantId: string, skillId: string): ManagedSession[] {
    const affected: ManagedSession[] = [];

    for (const session of this.sessions.values()) {
      // Must match tenant
      if (session.tenantId !== tenantId) {
        continue;
      }

      // Must have this skill synced
      if (session.syncedSkillIds?.has(skillId)) {
        affected.push(session);
      }
    }

    this.logger.debug(
      `Found ${affected.length} sessions affected by skill ${skillId} in tenant ${tenantId}`,
    );

    return affected;
  }

  /**
   * Terminate a session (alias for closeSession)
   *
   * Week 3: Added for test compatibility
   */
  async terminateSession(sessionId: string): Promise<void> {
    this.closeSession(sessionId);
  }

  /**
   * Get session status including restart flag
   */
  getSessionStatus(sessionId: string): {
    sessionId: string;
    status: string;
    needsRestart: boolean;
    messageCount: number;
    hasActiveProcess: boolean;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId,
      status: session.status,
      needsRestart: session.needsRestart || false,
      messageCount: session.messageCount,
      hasActiveProcess: session.cliProcess !== null && !session.cliProcess.killed,
    };
  }


  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, this.cleanupIntervalMs);

    this.logger.log(
      `Cleanup timer started (interval: ${this.cleanupIntervalMs}ms, TTL: ${this.sessionTtlMs}ms)`,
    );
  }

  /**
   * Cleanup idle sessions that have exceeded TTL, and force-close stuck-processing sessions.
   * Applies pressure-aware TTL when pool utilization is high.
   */
  private cleanupIdleSessions(): void {
    const now = Date.now();
    const utilizationPct = (this.sessions.size / this.maxSessions) * 100;
    const toRemove: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      // Determine effective TTL based on pool pressure
      let effectiveTtl: number;
      if (utilizationPct >= this.cleanupPressureCriticalThreshold) {
        effectiveTtl = 0;                                                         // Critical: evict all idle instantly
      } else if (utilizationPct >= this.cleanupPressureHighThreshold) {
        effectiveTtl = Math.min(session.sessionTtlMs ?? this.sessionTtlMs, 60_000); // High: max 1 min
      } else {
        effectiveTtl = session.sessionTtlMs ?? this.sessionTtlMs;                // Normal: full TTL
      }

      const idleTime = now - session.lastActivity.getTime();

      if (session.status !== 'processing' && idleTime > effectiveTtl) {
        this.logger.log(
          `Session ${sessionId} expired (idle ${Math.round(idleTime / 1000)}s, effectiveTtl ${effectiveTtl / 1000}s, pressure ${utilizationPct.toFixed(0)}%)`,
        );
        toRemove.push(sessionId);
      } else if (session.status === 'processing' && session.processingStartedAt) {
        const age = now - session.processingStartedAt.getTime();
        if (age > this.maxProcessingMs) {
          this.logger.warn(
            `Session ${sessionId} stuck in processing ${Math.round(age / 1000)}s — force-closing`,
          );
          toRemove.push(sessionId);
        }
      }
    }

    for (const sessionId of toRemove) {
      this.closeSession(sessionId);
    }

    if (toRemove.length > 0 || utilizationPct >= this.cleanupPressureHighThreshold) {
      this.logger.log(
        `Cleanup: removed ${toRemove.length}, active ${this.sessions.size}/${this.maxSessions} (${utilizationPct.toFixed(0)}%)`,
      );
    }
  }

  /**
   * Cleanup the oldest idle session to make room for new ones.
   * Falls back to the oldest stuck-processing session if no idle sessions exist.
   */
  private cleanupOldestIdleSession(): boolean {
    let oldestIdle: ManagedSession | null = null;
    let oldestIdleTime = Infinity;
    let oldestStuck: ManagedSession | null = null;
    let oldestStuckTime = Infinity;

    for (const session of this.sessions.values()) {
      if (session.status === 'idle') {
        const t = session.lastActivity.getTime();
        if (t < oldestIdleTime) {
          oldestIdleTime = t;
          oldestIdle = session;
        }
      } else if (session.status === 'processing' && session.processingStartedAt) {
        const age = Date.now() - session.processingStartedAt.getTime();
        if (age > this.maxProcessingMs) {
          const t = session.processingStartedAt.getTime();
          if (t < oldestStuckTime) {
            oldestStuckTime = t;
            oldestStuck = session;
          }
        }
      }
    }

    const toEvict = oldestIdle ?? oldestStuck;
    if (toEvict) {
      this.logger.log(`Evicting ${toEvict.status} session: ${toEvict.sessionId}`);
      this.closeSession(toEvict.sessionId);
      return true;
    }

    return false;
  }


  /**
   * Create symlinks from session workspace to tenant MCP servers
   * This enables CLI to access MCP servers via session-relative paths
   *
   * Public method called from SessionsGateway after session.mcpServers is set
   */
  async createMcpSymlinks(session: ManagedSession): Promise<void> {
    return this.workspaceService.createMcpSymlinks(session);
  }

  /**
   * Get workspace file for download
   * Security: Validates path to prevent directory traversal
   */
  async getWorkspaceFile(
    sessionId: string,
    relativePath: string,
  ): Promise<WorkspaceFileInfo> {
    const session = this.getSession(sessionId) ?? null;
    return this.workspaceService.getWorkspaceFile(session, sessionId, relativePath);
  }

  /**
   * Get file content from session workspace for inline viewing
   */
  async getWorkspaceFileContent(
    sessionId: string,
    relativePath: string,
  ): Promise<{ content: string | null; mimeType: string; size: number; filename: string; isBinary: boolean }> {
    const session = this.getSession(sessionId) ?? null;
    return this.workspaceService.getWorkspaceFileContent(session, sessionId, relativePath);
  }

  /**
   * Get directory tree for session workspace
   */
  async getWorkspaceTree(sessionId: string): Promise<WorkspaceTreeResponse> {
    const session = this.getSession(sessionId) ?? null;
    return this.workspaceService.getWorkspaceTree(session, sessionId);
  }

  /**
   * Phase 2: Persist session to database (create)
   * @private
   */
  private async persistSessionToDatabase(session: ManagedSession): Promise<void> {
    try {
      await this.sessionRepository.save({
        sessionId: session.sessionId,
        tenantId: session.tenantId || null,
        userId: session.userId || null,
        clientId: session.clientId,
        status: session.status,
        messageCount: session.messageCount,
        totalTokens: 0, // Will be updated via updateSessionStatsInDatabase
        estimatedCost: 0.0,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        closedAt: null,
        workspaceDir: session.workspaceDir,
        templateName: session.templateName || null,
      });
      this.logger.debug(`[Phase 2] Persisted session ${session.sessionId} to database`);
    } catch (error) {
      // If unique constraint violation, session may already exist (race condition)
      if (error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('UNIQUE')) {
        this.logger.warn(
          `[Phase 2] Session ${session.sessionId} already exists in database, skipping`,
        );
        return;
      }
      throw error; // Re-throw other errors for caller to handle
    }
  }

  /**
   * Phase 2: Update session in database (activity, status, stats)
   * @private
   */
  private async updateSessionInDatabase(
    sessionId: string,
    updates: Partial<SessionEntity>,
  ): Promise<void> {
    try {
      const result = await this.sessionRepository.update(
        { sessionId },
        {
          ...updates,
          lastActivity: new Date(), // Always update lastActivity
        },
      );

      if (result.affected === 0) {
        this.logger.warn(
          `[Phase 2] Session ${sessionId} not found in database for update`,
        );
      } else {
        this.logger.debug(
          `[Phase 2] Updated session ${sessionId} in database: ${JSON.stringify(updates)}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `[Phase 2] Failed to update session ${sessionId} in database: ${error.message}`,
        error.stack,
      );
      // Don't throw - graceful failure, session continues in memory
    }
  }

  /**
   * Phase 2: Update session statistics (messageCount, totalTokens, estimatedCost)
   * Called periodically or on specific events
   * @private
   */
  private async updateSessionStatsInDatabase(
    sessionId: string,
    stats: {
      messageCount?: number;
      totalTokens?: number;
      estimatedCost?: number;
    },
  ): Promise<void> {
    // Backfill tenantId for sessions that were created before the fix
    const session = this.sessions.get(sessionId);
    const updates: Partial<SessionEntity> = { ...stats };
    if (session?.tenantId) {
      updates.tenantId = session.tenantId;
    }
    await this.updateSessionInDatabase(sessionId, updates);
  }

  /** Hard cap on how long shutdown waits for any single workspace unmount. */
  private static readonly SHUTDOWN_CLOSE_TIMEOUT_MS = 5000;

  /**
   * Graceful shutdown.
   *
   * Closes every live session synchronously (state cleanup), then awaits
   * the in-flight `workspaceProvider.close()` promises with a hard timeout
   * so the process doesn't hang on a stuck unmount. Without the await,
   * agentfs mount daemons survive backend exit briefly (their socket peer
   * only times out a few seconds later).
   */
  async shutdown(): Promise<void> {
    this.logger.log('Shutting down...');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Stop all background task monitors
    this.backgroundTaskMonitorService.stopAllMonitors();

    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }

    // Snapshot pending close promises BEFORE clearing state — the .finally()
    // handler on each promise removes its entry from pendingCloses, but our
    // local snapshot keeps Promise references alive for the await below.
    const pending = Array.from(this.pendingCloses.values());
    if (pending.length > 0) {
      this.logger.log(`Awaiting ${pending.length} workspace close(s) to flush…`);
      await Promise.race([
        Promise.all(pending),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            this.logger.warn(
              `Shutdown timed out after ${SessionService.SHUTDOWN_CLOSE_TIMEOUT_MS}ms — ` +
              `${this.pendingCloses.size} workspace close(s) may not have flushed`,
            );
            resolve();
          }, SessionService.SHUTDOWN_CLOSE_TIMEOUT_MS),
        ),
      ]);
    }

    this.sessions.clear();
    this.clientSessions.clear();
  }
}
