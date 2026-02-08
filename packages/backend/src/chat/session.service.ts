/**
 * Session Service
 *
 * Manages persistent AgentEngine sessions with lifecycle management.
 * Supports: Claude Code, OpenCode, and custom engine implementations.
 * Each session maintains an AgentEngine process that can handle
 * multiple messages while preserving context via --resume.
 */

import {
  Injectable,
  OnModuleDestroy,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';
import * as fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import * as path from 'node:path';
import { Socket } from 'socket.io';
import { EventMapperService } from './event-mapper.service';
import type {
  ManagedSession,
  SessionStats,
  CLIEvent,
  FrontendEvent,
  WorkspaceFileInfo,
  WorkspaceTreeResponse,
  FileTreeNode,
} from '../common/interfaces';

export interface ResolvedAttachment {
  type: string;        // 'image' | 'document'
  absolutePath: string;
  mimeType: string;
}

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
  private cleanupInterval: NodeJS.Timeout | null = null;

  private readonly workspaceDir: string;
  private readonly sessionTtlMs: number;
  private readonly maxSessions: number;
  private readonly cleanupIntervalMs: number;
  private readonly claudeCliPath: string;

  // 后台任务监控映射 (sessionId:subAgentId -> intervalId)
  private backgroundTaskMonitors = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventMapperService: EventMapperService,
  ) {
    this.workspaceDir = this.configService.get('workspace.dir', '.agent-workspace');
    this.sessionTtlMs = this.configService.get('workspace.sessionTtlMs', 1800000);
    this.maxSessions = this.configService.get('workspace.maxSessions', 100);
    this.cleanupIntervalMs = this.configService.get('workspace.cleanupIntervalMs', 300000);
    this.claudeCliPath = this.configService.get('CLAUDE_CLI_PATH', 'claude');

    this.logger.log(`Using Claude CLI: ${this.claudeCliPath}`);
    this.startCleanupTimer();

    // 注册后台任务回调
    this.eventMapperService.registerBackgroundTaskCallback((sessionId, tracker) => {
      this.startBackgroundTaskMonitor(sessionId, tracker);
    });
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
    userId?: string,
  ): ManagedSession {
    let session = this.sessions.get(sessionId);

    if (session) {
      session.socket = socket;
      session.lastActivity = new Date();
      // Preserve userId if it was set before
      if (!session.userId && userId) {
        session.userId = userId;
      }
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
        // Disable global plugins to prevent conflicts with workspace skills
        // Solutions should manage their own skills via CCAAS database
        enabledPlugins: {},
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
      userId, // Week 3: Track user
      syncedSkillIds: new Set(), // Week 3: Track synced skills
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
    onEvent: (event: FrontendEvent) => void,
    attachments?: ResolvedAttachment[],
  ): Promise<void> {
    if (session.cliProcess && session.stdin && !session.cliProcess.killed) {
      this.logger.log(`Reusing AgentEngine for session ${session.sessionId}`);
      this.sendMessageToProcess(session, initialMessage, attachments);
      return;
    }

    this.logger.log(`Spawning new AgentEngine for session ${session.sessionId}`);

    // Build base command
    let shellCommand = `${this.claudeCliPath} --output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions`;

    // Add MCP servers if configured (passed from solution backends)
    if (session.mcpServers && Object.keys(session.mcpServers).length > 0) {
      const mcpConfig = JSON.stringify({ mcpServers: session.mcpServers });
      // Escape single quotes in JSON for shell
      const escapedConfig = mcpConfig.replace(/'/g, "'\\''");
      shellCommand += ` --mcp-config '${escapedConfig}'`;
      this.logger.log(`Session ${session.sessionId} using MCP servers: ${Object.keys(session.mcpServers).join(', ')}`);
      this.logger.debug(`MCP config: ${mcpConfig}`);
    } else {
      this.logger.warn(`Session ${session.sessionId} has NO MCP servers configured`);
    }

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

    this.logger.log(`AgentEngine spawned with PID ${cli.pid} for session ${session.sessionId}`);

    cli.on('spawn', () => {
      this.logger.log(`Process spawn confirmed for session ${session.sessionId}`);
      this.sendMessageToProcess(session, initialMessage, attachments);
    });

    cli.stdout.on('data', (chunk: Buffer) => {
      this.handleCLIOutput(session, chunk, onEvent);
    });

    cli.stderr.on('data', (chunk: Buffer) => {
      this.logger.error(`AgentEngine stderr (${session.sessionId}): ${chunk.toString()}`);
    });

    cli.on('close', (code: number | null) => {
      this.logger.log(`AgentEngine exited with code ${code} for session ${session.sessionId}`);
      this.handleCLIClose(session, code, onEvent);
    });

    cli.on('error', (error: Error) => {
      this.logger.error(`AgentEngine error for session ${session.sessionId}: ${error.message}`);
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
   * Send a follow-up message to an existing AgentEngine process
   * Uses --resume to restore session context
   */
  async sendFollowUp(
    session: ManagedSession,
    message: string,
    onEvent: (event: FrontendEvent) => void,
    attachments?: ResolvedAttachment[],
  ): Promise<void> {
    this.logger.log(`Sending follow-up message to session ${session.sessionId}`);

    if (session.cliProcess && !session.cliProcess.killed && session.stdin) {
      this.logger.log('Reusing existing AgentEngine for follow-up');
      this.sendMessageToProcess(session, message, attachments);
      onEvent({
        type: 'agent_status',
        status: 'running',
        sessionId: session.sessionId,
      });
      return;
    }

    this.logger.log('AgentEngine not running, spawning new with --resume');

    // Build base command with --resume
    let shellCommand = `${this.claudeCliPath} --output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions --resume '${session.sessionId}'`;

    // Add MCP servers if configured (passed from solution backends)
    if (session.mcpServers && Object.keys(session.mcpServers).length > 0) {
      const mcpConfig = JSON.stringify({ mcpServers: session.mcpServers });
      // Escape single quotes in JSON for shell
      const escapedConfig = mcpConfig.replace(/'/g, "'\\''");
      shellCommand += ` --mcp-config '${escapedConfig}'`;
    }

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
      this.sendMessageToProcess(session, message, attachments);
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
   * Handle AgentEngine stdout output
   * Parses stream-json format and maps to frontend events
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
          `Mapped ${frontendEvents.length} events from AgentEngine event type: ${cliEvent.type}`,
        );

        for (const event of frontendEvents) {
          this.logger.debug(`Emitting event: ${event.type}`);
          onEvent(event);
        }
      } catch (parseError) {
        this.logger.warn(`Failed to parse AgentEngine output: ${line.slice(0, 100)}...`);
      }
    }
  }

  /**
   * Handle AgentEngine process close
   * Detects cancellation vs normal completion
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

    // Check if this was a user cancellation
    const wasCancelled = session.status === 'cancelling';

    session.buffer = '';
    session.cliProcess = null;
    session.stdin = null;

    // Set final status based on cancellation or exit code
    if (wasCancelled) {
      session.status = 'idle';  // Cancelled - back to idle
      // Cancelled event already sent in cancelSession, don't send again
    } else {
      session.status = code === 0 ? 'idle' : 'error';
      onEvent({
        type: 'agent_status',
        status: code === 0 ? 'complete' : 'error',
        sessionId: session.sessionId,
        exitCode: code,
        ...(code !== 0 && { error: `AgentEngine exited with code ${code}` }),
      });
    }
  }

  /**
   * Send message to AgentEngine stdin
   * Supports image attachments as multi-block content
   */
  private sendMessageToProcess(
    session: ManagedSession,
    message: string,
    attachments?: ResolvedAttachment[],
  ): void {
    // More strict checks
    if (!session.stdin || session.stdin.destroyed) {
      this.logger.warn(`Cannot send message: stdin not available for session ${session.sessionId}`);
      return;
    }

    // Check process status
    if (!session.cliProcess || session.cliProcess.killed) {
      this.logger.warn(`Cannot send message: process not running for session ${session.sessionId}`);
      return;
    }

    // Don't send messages while cancelling
    if (session.status === 'cancelling') {
      this.logger.warn(`Cannot send message: session ${session.sessionId} is being cancelled`);
      return;
    }

    let content: string | object[];

    if (attachments && attachments.length > 0) {
      // Build multi-block content: text + images (Anthropic Messages API format)
      const blocks: object[] = [];

      // Text block
      blocks.push({ type: 'text', text: message });

      // Attachment blocks
      for (const att of attachments) {
        if (att.type === 'image') {
          try {
            const fileBuffer = fs.readFileSync(att.absolutePath);
            const base64Data = fileBuffer.toString('base64');
            blocks.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: att.mimeType,
                data: base64Data,
              },
            });
            this.logger.log(
              `Attached image: ${att.absolutePath} (${Math.round(fileBuffer.length / 1024)}KB)`,
            );
          } catch (err) {
            this.logger.error(`Failed to read attachment ${att.absolutePath}: ${err}`);
          }
        }
      }

      content = blocks;
    } else {
      content = message;
    }

    const jsonMessage = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content,
      },
    });

    this.logger.debug(`Sending message to CLI: ${jsonMessage.slice(0, 200)}...`);

    try {
      const canWrite = session.stdin.write(jsonMessage + '\n');

      // Check backpressure
      if (!canWrite) {
        this.logger.warn(`Write buffer full for session ${session.sessionId}, waiting for drain`);
        // Wait for drain event
        session.stdin.once('drain', () => {
          this.logger.debug(`Write buffer drained for session ${session.sessionId}`);
        });
      }

      session.lastActivity = new Date();
      session.status = 'processing';
      session.messageCount++;
    } catch (error) {
      this.logger.error(`Failed to write to AgentEngine stdin for session ${session.sessionId}: ${error.message}`);
      session.status = 'error';
      throw error; // Let caller handle
    }
  }

  /**
   * Cancel/kill a session's AgentEngine process
   * Sends SIGTERM, with 5-second SIGKILL timeout
   */
  cancelSession(sessionId: string, onEvent?: (event: any) => void): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check if process is running
    if (session.cliProcess && !session.cliProcess.killed) {
      this.logger.log(`Cancelling session ${sessionId}`);

      // Set cancelling state (not idle yet)
      session.status = 'cancelling';

      // Send cancelled event to frontend
      if (onEvent) {
        onEvent({
          type: 'agent_status',
          status: 'cancelled',
          sessionId: session.sessionId,
          message: 'Operation cancelled by user',
        });
      }

      // Send SIGTERM signal
      session.cliProcess.kill('SIGTERM');

      // Set 5-second timeout for SIGKILL if process doesn't exit
      setTimeout(() => {
        if (session.cliProcess && !session.cliProcess.killed) {
          this.logger.warn(`Force killing session ${sessionId} after SIGTERM timeout`);
          session.cliProcess.kill('SIGKILL');
        }
      }, 5000);

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

    // 停止该 session 的所有后台任务监控
    for (const [monitorKey, intervalId] of this.backgroundTaskMonitors.entries()) {
      if (monitorKey.startsWith(`${sessionId}:`)) {
        clearInterval(intervalId);
        this.backgroundTaskMonitors.delete(monitorKey);
        this.logger.log(`[BackgroundTask] Stopped monitor on session close: ${monitorKey}`);
      }
    }

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
   * Check if a session has an active AgentEngine process
   */
  hasActiveProcess(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.cliProcess !== null && !session?.cliProcess?.killed;
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
   * Update session context
   *
   * Writes frontend form state to a file in the session workspace
   * so Claude Code can read current form values.
   */
  async updateContext(
    sessionId: string,
    context: { lessonPlanId?: string; currentForm?: Record<string, unknown> },
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Session doesn't exist yet - create workspace directory and write context
      // This handles the case where context is synced before first message
      const workspaceDir = path.join(this.workspaceDir, 'sessions', sessionId);
      fs.mkdirSync(workspaceDir, { recursive: true });

      const contextDir = path.join(workspaceDir, '.context');
      fs.mkdirSync(contextDir, { recursive: true });

      const contextPath = path.join(contextDir, 'lesson-plan.json');
      fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), 'utf-8');

      this.logger.log(`Context written for pre-session ${sessionId}`);
      return;
    }

    // Ensure .context directory exists
    const contextDir = path.join(session.workspaceDir, '.context');
    fs.mkdirSync(contextDir, { recursive: true });

    // Write JSON file
    const contextPath = path.join(contextDir, 'lesson-plan.json');
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2), 'utf-8');

    this.logger.log(`Context updated for session ${sessionId}`);
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
   * 启动后台任务监控
   */
  private startBackgroundTaskMonitor(sessionId: string, tracker: any): void {
    const monitorKey = `${sessionId}:${tracker.subAgentId}`;

    // 避免重复监控
    if (this.backgroundTaskMonitors.has(monitorKey)) {
      return;
    }

    this.logger.log(
      `[BackgroundTask] Starting monitor: ${monitorKey}, outputFile=${tracker.outputFile}`,
    );

    // 每 3 秒检查一次输出文件
    const intervalId = setInterval(async () => {
      try {
        await this.checkBackgroundTaskStatus(sessionId, tracker);
      } catch (error) {
        this.logger.error(`[BackgroundTask] Monitor error: ${monitorKey}`, error);
      }
    }, 3000);

    this.backgroundTaskMonitors.set(monitorKey, intervalId);

    // 30 分钟后超时
    setTimeout(() => {
      this.stopBackgroundTaskMonitor(monitorKey, sessionId, tracker.subAgentId, 'timeout');
    }, 30 * 60 * 1000);
  }

  /**
   * 检查后台任务状态
   */
  private async checkBackgroundTaskStatus(sessionId: string, tracker: any): Promise<void> {
    if (!tracker.outputFile) {
      return;
    }

    try {
      const content = await fsPromises.readFile(tracker.outputFile, 'utf-8');
      const lines = content.split('\n');
      const lastLines = lines.slice(-20).join('\n'); // 读取最后 20 行

      // 检测完成标记
      if (
        lastLines.includes('Agent completed successfully') ||
        lastLines.includes('"type":"result"') ||
        lastLines.includes('agentId:') // Task tool 返回的标记
      ) {
        this.logger.log(`[BackgroundTask] Task completed: ${tracker.subAgentId}`);
        this.stopBackgroundTaskMonitor(
          `${sessionId}:${tracker.subAgentId}`,
          sessionId,
          tracker.subAgentId,
          'completed',
        );
      } else if (lastLines.includes('Error') || lastLines.includes('Failed')) {
        this.logger.warn(`[BackgroundTask] Task failed: ${tracker.subAgentId}`);
        this.stopBackgroundTaskMonitor(
          `${sessionId}:${tracker.subAgentId}`,
          sessionId,
          tracker.subAgentId,
          'failed',
        );
      }
    } catch (error: any) {
      // 文件不存在或无法读取，继续等待
      if (error.code !== 'ENOENT') {
        this.logger.debug(`[BackgroundTask] Cannot read output file: ${tracker.outputFile}`);
      }
    }
  }

  /**
   * 停止后台任务监控
   */
  private stopBackgroundTaskMonitor(
    monitorKey: string,
    sessionId: string,
    subAgentId: string,
    status: 'completed' | 'failed' | 'timeout',
  ): void {
    const intervalId = this.backgroundTaskMonitors.get(monitorKey);
    if (intervalId) {
      clearInterval(intervalId);
      this.backgroundTaskMonitors.delete(monitorKey);
    }

    // 通知 EventMapper 标记任务完成
    const finalStatus = status === 'timeout' ? 'failed' : status;
    const error = status === 'timeout' ? 'Task timeout after 30 minutes' : undefined;

    const tracker = this.eventMapperService.markBackgroundTaskComplete(
      sessionId,
      subAgentId,
      finalStatus,
      error,
    );

    if (tracker) {
      // 发送 subagent_completed 事件
      const session = this.getSession(sessionId);
      if (session?.socket) {
        const durationMs = Date.now() - tracker.startedAt.getTime();
        const event: FrontendEvent = {
          type: 'subagent_completed',
          sessionId,
          clientId: session.clientId,
          timestamp: new Date().toISOString(),
          payload: {
            subAgentId,
            status: finalStatus,
            durationMs,
            error,
          },
        };
        session.socket.emit('subagent_completed', event);
        this.logger.log(
          `[BackgroundTask] Sent subagent_completed event: ${subAgentId}, status=${finalStatus}`,
        );
      }
    }
  }

  /**
   * Get workspace file for download
   * Security: Validates path to prevent directory traversal
   */
  async getWorkspaceFile(
    sessionId: string,
    relativePath: string,
  ): Promise<WorkspaceFileInfo> {
    // 1. Get workspace directory
    const session = this.getSession(sessionId);
    const workspaceDir = session?.workspaceDir ||
      path.join(this.workspaceDir, 'sessions', sessionId);

    if (!fs.existsSync(workspaceDir)) {
      throw new NotFoundException(`Session workspace not found: ${sessionId}`);
    }

    // 2. Sanitize path (CRITICAL SECURITY)
    const sanitizedPath = this.sanitizeFilePath(relativePath);
    const absolutePath = path.join(workspaceDir, sanitizedPath);

    // 3. Prevent directory traversal
    const resolvedPath = path.resolve(absolutePath);
    const resolvedWorkspace = path.resolve(workspaceDir);

    if (!resolvedPath.startsWith(resolvedWorkspace + path.sep) && resolvedPath !== resolvedWorkspace) {
      this.logger.warn(`[Security] Path traversal blocked: ${relativePath}`);
      throw new BadRequestException('Invalid file path');
    }

    // 4. Check file exists and is a regular file
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException(`File not found: ${relativePath}`);
    }

    const stats = fs.lstatSync(absolutePath);

    if (stats.isSymbolicLink()) {
      this.logger.warn(`[Security] Symlink blocked: ${relativePath}`);
      throw new BadRequestException('Symlinks not allowed');
    }

    if (!stats.isFile()) {
      throw new BadRequestException('Path does not point to a file');
    }

    // 5. Return file info
    const filename = path.basename(absolutePath);
    return {
      filename,
      absolutePath,
      mimeType: this.detectMimeType(filename),
      size: stats.size,
    };
  }

  /**
   * Get directory tree for session workspace
   */
  async getWorkspaceTree(sessionId: string): Promise<WorkspaceTreeResponse> {
    const session = this.getSession(sessionId);
    const workspaceDir = session?.workspaceDir ||
      path.join(this.workspaceDir, 'sessions', sessionId);

    if (!fs.existsSync(workspaceDir)) {
      throw new NotFoundException(`Session workspace not found: ${sessionId}`);
    }

    const tree = this.buildDirectoryTree(workspaceDir, '');
    return { tree };
  }

  /**
   * Sanitize file path to prevent traversal attacks
   */
  private sanitizeFilePath(filePath: string): string {
    // Block absolute paths (must be caught before any processing)
    if (path.isAbsolute(filePath)) {
      throw new BadRequestException('Invalid file path');
    }

    // Block null bytes (poison null terminator attack)
    if (filePath.includes('\0')) {
      throw new BadRequestException('Invalid file path');
    }

    // Block backslash (Windows path traversal)
    if (filePath.includes('\\')) {
      throw new BadRequestException('Invalid file path');
    }

    // Block URL-encoded special characters (double encoding attack)
    if (filePath.includes('%')) {
      throw new BadRequestException('Invalid file path');
    }

    // Remove leading/trailing slashes
    let sanitized = filePath.replace(/^\/+|\/+$/g, '');

    // Normalize path (resolves .. and .)
    sanitized = path.normalize(sanitized);

    // Block paths that still contain ..
    if (sanitized.includes('..')) {
      throw new BadRequestException('Invalid file path');
    }

    return sanitized;
  }

  /**
   * Build directory tree recursively
   */
  private buildDirectoryTree(basePath: string, relativePath: string): FileTreeNode[] {
    const fullPath = path.join(basePath, relativePath);
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });

    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      const entryPath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        nodes.push({
          id: `folder-${entryPath}`,
          name: entry.name,
          type: 'folder',
          path: entryPath,
          children: this.buildDirectoryTree(basePath, entryPath),
        });
      } else if (entry.isFile()) {
        const stats = fs.statSync(path.join(basePath, entryPath));
        nodes.push({
          id: `file-${entryPath}`,
          name: entry.name,
          type: 'file',
          path: entryPath,
          size: stats.size,
          mimeType: this.detectMimeType(entry.name),
        });
      }
    }

    // Sort: folders first, then files (alphabetically)
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Detect MIME type from filename
   */
  private detectMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();

    const mimeMap: Record<string, string> = {
      // Text
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.ts': 'text/typescript',

      // Images
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',

      // Audio
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',

      // Documents
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };

    return mimeMap[ext] || 'application/octet-stream';
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

    // 停止所有后台任务监控
    for (const [monitorKey, intervalId] of this.backgroundTaskMonitors.entries()) {
      clearInterval(intervalId);
      this.logger.log(`[BackgroundTask] Stopped monitor: ${monitorKey}`);
    }
    this.backgroundTaskMonitors.clear();

    for (const sessionId of this.sessions.keys()) {
      this.closeSession(sessionId);
    }

    this.sessions.clear();
    this.clientSessions.clear();
  }
}
