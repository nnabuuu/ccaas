/**
 * Session Service
 *
 * Manages persistent Claude Code CLI sessions with lifecycle management.
 * Each session maintains a long-running CLI process that can handle
 * multiple messages while preserving context.
 */

import {
  Injectable,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Socket } from 'socket.io';
import { EventMapperService } from './event-mapper.service';
import type {
  ManagedSession,
  SessionStats,
  CLIEvent,
  FrontendEvent,
} from '../common/interfaces';

@Injectable()
export class SessionService implements OnModuleDestroy {
  private readonly logger = new Logger(SessionService.name);
  private sessions = new Map<string, ManagedSession>();
  private clientSessions = new Map<string, Set<string>>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  private readonly workspaceDir: string;
  private readonly sessionTtlMs: number;
  private readonly maxSessions: number;
  private readonly cleanupIntervalMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventMapperService: EventMapperService,
  ) {
    this.workspaceDir = this.configService.get('workspace.dir', '.agent-workspace');
    this.sessionTtlMs = this.configService.get('workspace.sessionTtlMs', 1800000);
    this.maxSessions = this.configService.get('workspace.maxSessions', 100);
    this.cleanupIntervalMs = this.configService.get('workspace.cleanupIntervalMs', 300000);

    this.startCleanupTimer();
  }

  onModuleDestroy() {
    this.shutdown();
  }

  /**
   * Get or create a session for a client
   */
  getOrCreateSession(
    sessionId: string,
    clientId: string,
    socket: Socket,
  ): ManagedSession {
    let session = this.sessions.get(sessionId);

    if (session) {
      session.socket = socket;
      session.lastActivity = new Date();
      this.logger.log(`Reusing existing session ${sessionId}`);
      return session;
    }

    if (this.sessions.size >= this.maxSessions) {
      const cleaned = this.cleanupOldestIdleSession();
      if (!cleaned) {
        throw new Error(`Max sessions limit (${this.maxSessions}) reached`);
      }
    }

    const workspaceDir = path.join(this.workspaceDir, 'sessions', sessionId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    // Create .claude directory with pre-approved permissions
    // This allows Claude Code CLI to write files without interactive approval
    const claudeDir = path.join(workspaceDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.local.json'),
      JSON.stringify({
        permissions: {
          allow: ['Bash(*)', 'Write(*)', 'Edit(*)', 'Read(*)'],
          deny: [],
        },
      }, null, 2),
    );

    session = {
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
      workspaceDir,
    };

    this.sessions.set(sessionId, session);

    if (!this.clientSessions.has(clientId)) {
      this.clientSessions.set(clientId, new Set());
    }
    this.clientSessions.get(clientId)!.add(sessionId);

    this.logger.log(`Created new session ${sessionId} for client ${clientId}`);
    this.logger.log(`Active sessions: ${this.sessions.size}/${this.maxSessions}`);

    return session;
  }

  /**
   * Get an existing session by ID
   */
  getSession(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
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
   * Spawn or reuse CLI process for a session
   */
  async ensureCLIProcess(
    session: ManagedSession,
    initialMessage: string,
    onEvent: (event: FrontendEvent) => void,
  ): Promise<void> {
    if (session.cliProcess && session.stdin && !session.cliProcess.killed) {
      this.logger.log(`Reusing CLI process for session ${session.sessionId}`);
      this.sendMessageToProcess(session, initialMessage);
      return;
    }

    this.logger.log(`Spawning new CLI process for session ${session.sessionId}`);

    const shellCommand = 'claude --output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions';

    this.logger.log(`Running command: ${shellCommand}`);
    this.logger.log(`Working directory: ${session.workspaceDir}`);

    const cli = spawn('/bin/sh', ['-c', shellCommand], {
      cwd: session.workspaceDir,
      env: {
        ...process.env,
        AGENT_SESSION_ID: session.sessionId,
        AGENT_CLIENT_ID: session.clientId,
        AGENT_WORKSPACE_DIR: path.resolve(this.workspaceDir),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    session.cliProcess = cli;
    session.stdin = cli.stdin as Writable;
    session.status = 'processing';
    session.lastActivity = new Date();

    this.logger.log(`CLI process spawned with PID ${cli.pid} for session ${session.sessionId}`);

    cli.on('spawn', () => {
      this.logger.log(`Process spawn confirmed for session ${session.sessionId}`);
      this.sendMessageToProcess(session, initialMessage);
    });

    cli.stdout.on('data', (chunk: Buffer) => {
      this.handleCLIOutput(session, chunk, onEvent);
    });

    cli.stderr.on('data', (chunk: Buffer) => {
      this.logger.error(`CLI stderr (${session.sessionId}): ${chunk.toString()}`);
    });

    cli.on('close', (code: number | null) => {
      this.logger.log(`CLI exited with code ${code} for session ${session.sessionId}`);
      this.handleCLIClose(session, code, onEvent);
    });

    cli.on('error', (error: Error) => {
      this.logger.error(`CLI error for session ${session.sessionId}: ${error.message}`);
      session.status = 'error';
      onEvent({
        type: 'agent_status',
        status: 'error',
        sessionId: session.sessionId,
        error: error.message,
      });
    });
  }

  /**
   * Send a follow-up message to an existing CLI process
   */
  async sendFollowUp(
    session: ManagedSession,
    message: string,
    onEvent: (event: FrontendEvent) => void,
  ): Promise<void> {
    this.logger.log(`Sending follow-up message to session ${session.sessionId}`);

    if (session.cliProcess && !session.cliProcess.killed && session.stdin) {
      this.logger.log('Reusing existing CLI process for follow-up');
      this.sendMessageToProcess(session, message);
      onEvent({
        type: 'agent_status',
        status: 'running',
        sessionId: session.sessionId,
      });
      return;
    }

    this.logger.log('CLI process not running, spawning new with --resume');

    const shellCommand = `claude --output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions --resume '${session.sessionId}'`;

    this.logger.log(`Running follow-up command: ${shellCommand}`);

    const cli = spawn('/bin/sh', ['-c', shellCommand], {
      cwd: session.workspaceDir,
      env: {
        ...process.env,
        AGENT_SESSION_ID: session.sessionId,
        AGENT_CLIENT_ID: session.clientId,
        AGENT_WORKSPACE_DIR: path.resolve(this.workspaceDir),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    session.cliProcess = cli;
    session.stdin = cli.stdin as Writable;
    session.status = 'processing';
    session.lastActivity = new Date();
    session.buffer = '';

    onEvent({
      type: 'agent_status',
      status: 'running',
      sessionId: session.sessionId,
    });

    cli.on('spawn', () => {
      this.sendMessageToProcess(session, message);
    });

    cli.stdout.on('data', (chunk: Buffer) => {
      this.handleCLIOutput(session, chunk, onEvent);
    });

    cli.stderr.on('data', (chunk: Buffer) => {
      this.logger.error(`CLI stderr (${session.sessionId}): ${chunk.toString()}`);
    });

    cli.on('close', (code: number | null) => {
      this.logger.log(`CLI exited with code ${code} for session ${session.sessionId}`);
      this.handleCLIClose(session, code, onEvent);
    });

    cli.on('error', (error: Error) => {
      this.logger.error(`CLI error for session ${session.sessionId}: ${error.message}`);
      session.status = 'error';
      onEvent({
        type: 'agent_status',
        status: 'error',
        sessionId: session.sessionId,
        error: error.message,
      });
    });
  }

  /**
   * Handle CLI stdout output
   */
  private handleCLIOutput(
    session: ManagedSession,
    chunk: Buffer,
    onEvent: (event: FrontendEvent) => void,
  ): void {
    session.buffer += chunk.toString();
    session.lastActivity = new Date();

    const lines = session.buffer.split('\n');
    session.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const cliEvent: CLIEvent = JSON.parse(line);
        const frontendEvents = this.eventMapperService.mapToFrontendEvents(
          cliEvent,
          session.sessionId,
          session.clientId,
        );

        this.logger.debug(
          `Mapped ${frontendEvents.length} events from CLI event type: ${cliEvent.type}`,
        );

        for (const event of frontendEvents) {
          this.logger.debug(`Emitting event: ${event.type}`);
          onEvent(event);
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse CLI output: ${line.slice(0, 100)}...`);
      }
    }
  }

  /**
   * Handle CLI process close
   */
  private handleCLIClose(
    session: ManagedSession,
    code: number | null,
    onEvent: (event: FrontendEvent) => void,
  ): void {
    if (session.buffer.trim()) {
      try {
        const cliEvent: CLIEvent = JSON.parse(session.buffer);
        const frontendEvents = this.eventMapperService.mapToFrontendEvents(
          cliEvent,
          session.sessionId,
          session.clientId,
        );
        for (const event of frontendEvents) {
          onEvent(event);
        }
      } catch {
        // Ignore incomplete JSON
      }
    }

    session.buffer = '';
    session.status = code === 0 ? 'idle' : 'error';
    session.cliProcess = null;
    session.stdin = null;

    onEvent({
      type: 'agent_status',
      status: code === 0 ? 'complete' : 'error',
      sessionId: session.sessionId,
      exitCode: code,
    });
  }

  /**
   * Send message to CLI stdin
   */
  private sendMessageToProcess(session: ManagedSession, message: string): void {
    if (session.stdin && !session.stdin.destroyed) {
      const jsonMessage = JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: message,
        },
      });
      this.logger.debug(`Sending message to CLI: ${jsonMessage.slice(0, 100)}...`);
      session.stdin.write(jsonMessage + '\n');
      session.lastActivity = new Date();
      session.status = 'processing';
      session.messageCount++;
    }
  }

  /**
   * Cancel/kill a session's CLI process
   */
  cancelSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (session.cliProcess && !session.cliProcess.killed) {
      this.logger.log(`Cancelling session ${sessionId}`);
      session.cliProcess.kill('SIGTERM');
      session.status = 'idle';
      return true;
    }
    return false;
  }

  /**
   * Close and remove a session
   */
  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.logger.log(`Closing session ${sessionId}`);

    if (session.cliProcess && !session.cliProcess.killed) {
      session.cliProcess.kill('SIGTERM');
    }

    this.sessions.delete(sessionId);
    this.clientSessions.get(session.clientId)?.delete(sessionId);

    this.eventMapperService.clearSessionState(sessionId);
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
   * Get session statistics
   */
  getStats(): SessionStats {
    let idle = 0;
    let processing = 0;

    for (const session of this.sessions.values()) {
      if (session.status === 'idle') idle++;
      if (session.status === 'processing') processing++;
    }

    return {
      totalSessions: this.sessions.size,
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
   * Check if a session has an active CLI process
   */
  hasActiveProcess(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.cliProcess !== null && !session?.cliProcess?.killed;
  }

  /**
   * Restart a session by killing its CLI process
   * Next message will spawn fresh CLI with updated skills
   */
  restartSession(sessionId: string, tenantId?: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.logger.warn(`Session ${sessionId} not found for restart`);
      return false;
    }

    // Verify tenant ownership if provided
    if (tenantId && session.tenantId !== tenantId) {
      this.logger.warn(`Tenant ${tenantId} cannot restart session owned by ${session.tenantId}`);
      return false;
    }

    // Kill CLI process if running
    if (session.cliProcess && !session.cliProcess.killed) {
      this.logger.log(`Killing CLI process for session restart: ${sessionId}`);
      session.cliProcess.kill('SIGTERM');
      session.cliProcess = null;
      session.stdin = null;
    }

    // Clear restart flag
    session.needsRestart = false;
    session.status = 'idle';
    session.lastActivity = new Date();

    this.logger.log(`Session ${sessionId} restarted successfully`);
    return true;
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
   * Mark all sessions for a tenant as needing restart
   * Called when skills are updated
   */
  markSessionsForRestart(tenantId: string): string[] {
    const affectedSessionIds: string[] = [];

    for (const session of this.sessions.values()) {
      if (session.tenantId === tenantId) {
        session.needsRestart = true;
        affectedSessionIds.push(session.sessionId);
        this.logger.debug(`Marked session ${session.sessionId} as needing restart`);
      }
    }

    if (affectedSessionIds.length > 0) {
      this.logger.log(
        `Marked ${affectedSessionIds.length} sessions for tenant ${tenantId} as needing restart`,
      );
    }

    return affectedSessionIds;
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
   * Cleanup idle sessions that have exceeded TTL
   */
  private cleanupIdleSessions(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastActivity.getTime();

      if (idleTime > this.sessionTtlMs && session.status !== 'processing') {
        this.logger.log(
          `Session ${sessionId} expired (idle for ${Math.round(idleTime / 1000)}s)`,
        );
        toRemove.push(sessionId);
      }
    }

    for (const sessionId of toRemove) {
      this.closeSession(sessionId);
    }

    if (toRemove.length > 0) {
      this.logger.log(
        `Cleaned up ${toRemove.length} idle sessions. Active: ${this.sessions.size}`,
      );
    }
  }

  /**
   * Cleanup the oldest idle session to make room for new ones
   */
  private cleanupOldestIdleSession(): boolean {
    let oldestSession: ManagedSession | null = null;
    let oldestTime = Infinity;

    for (const session of this.sessions.values()) {
      if (session.status === 'idle') {
        const activityTime = session.lastActivity.getTime();
        if (activityTime < oldestTime) {
          oldestTime = activityTime;
          oldestSession = session;
        }
      }
    }

    if (oldestSession) {
      this.logger.log(`Evicting oldest idle session: ${oldestSession.sessionId}`);
      this.closeSession(oldestSession.sessionId);
      return true;
    }

    return false;
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    this.logger.log('Shutting down...');

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }

    this.sessions.clear();
    this.clientSessions.clear();
  }
}
