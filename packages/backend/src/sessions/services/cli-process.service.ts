/**
 * CLI Process Service
 *
 * Manages AgentEngine process lifecycle (Claude Code, OpenCode, custom engines).
 *
 * Responsibilities:
 * - Spawn AgentEngine processes with proper configuration
 * - Manage CLI stdin/stdout communication
 * - Handle process termination (SIGTERM/SIGKILL)
 * - Parse stream-json output via EventMapperService
 * - Support attachments and system prompts
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn, ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventMapperService } from '../event-mapper.service';
import { WorkspaceService } from './workspace.service';
import type { ManagedSession, CLIEvent, FrontendEvent } from '../../common/interfaces';

export interface ResolvedAttachment {
  type: string;
  absolutePath: string;
  mimeType: string;
}

@Injectable()
export class CliProcessService {
  private readonly logger = new Logger(CliProcessService.name);
  private readonly workspaceDir: string;
  private readonly claudeCliPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventMapperService: EventMapperService,
    private readonly workspaceService: WorkspaceService,
  ) {
    this.workspaceDir = this.configService.get('workspace.dir', '.agent-workspace');
    this.claudeCliPath = this.configService.get('CLAUDE_CLI_PATH', 'claude');

    this.logger.log(`Using Claude CLI: ${this.claudeCliPath}`);
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
    appendSystemPrompt?: string,
  ): Promise<void> {
    if (session.cliProcess && session.stdin && !session.cliProcess.killed) {
      this.logger.log(`Reusing AgentEngine for session ${session.sessionId}`);
      this.sendMessageToProcess(session, initialMessage, attachments);
      return;
    }

    this.logger.log(`Spawning new AgentEngine for session ${session.sessionId}`);

    // Build arguments array (no shell interpretation, prevents injection)
    const args: string[] = [
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'bypassPermissions',
    ];

    // Add MCP servers if configured (passed from solution backends)
    if (session.mcpServers && Object.keys(session.mcpServers).length > 0) {
      // Resolve tenant-relative paths to session-relative symlink paths
      const resolvedMcpServers = this.workspaceService.resolveSessionMcpPaths(session.mcpServers);
      const mcpConfig = JSON.stringify({ mcpServers: resolvedMcpServers });
      args.push('--mcp-config', mcpConfig);
      this.logger.log(`Session ${session.sessionId} using MCP servers: ${Object.keys(session.mcpServers).join(', ')}`);
      this.logger.debug(`MCP config: ${mcpConfig}`);
    } else {
      this.logger.warn(`Session ${session.sessionId} has NO MCP servers configured`);
    }

    // Add append-system-prompt if provided
    if (appendSystemPrompt && appendSystemPrompt.trim()) {
      args.push('--append-system-prompt', appendSystemPrompt);
      this.logger.log(`Added skill system prompt (${appendSystemPrompt.length} chars)`);
    }

    this.logger.log(`Running command: ${this.claudeCliPath} ${args.join(' ')}`);
    this.logger.log(`Working directory: ${session.workspaceDir}`);

    const cli = spawn(this.claudeCliPath, args, {
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

    // Build arguments array with --resume (no shell interpretation, prevents injection)
    const args: string[] = [
      '--output-format', 'stream-json',
      '--input-format', 'stream-json',
      '--verbose',
      '--permission-mode', 'bypassPermissions',
      '--resume', session.sessionId,
    ];

    // Add MCP servers if configured (passed from solution backends)
    if (session.mcpServers && Object.keys(session.mcpServers).length > 0) {
      // Resolve tenant-relative paths to session-relative symlink paths
      const resolvedMcpServers = this.workspaceService.resolveSessionMcpPaths(session.mcpServers);
      const mcpConfig = JSON.stringify({ mcpServers: resolvedMcpServers });
      args.push('--mcp-config', mcpConfig);
    }

    // Add append-system-prompt (preserved across resume)
    if (session.appendSystemPrompt && session.appendSystemPrompt.trim()) {
      args.push('--append-system-prompt', session.appendSystemPrompt);
    }

    this.logger.log(`Running follow-up command: ${this.claudeCliPath} ${args.join(' ')}`);

    const cli = spawn(this.claudeCliPath, args, {
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
   * Cancel/kill a session's AgentEngine process
   * Sends SIGTERM, with 5-second SIGKILL timeout
   */
  cancelSession(session: ManagedSession, onEvent?: (event: any) => void): boolean {
    // Check if process is running
    if (session.cliProcess && !session.cliProcess.killed) {
      this.logger.log(`Cancelling session ${session.sessionId}`);

      // Set cancelling state (not idle yet)
      session.status = 'cancelling';

      // Send cancelled event to frontend
      if (onEvent) {
        onEvent({
          type: 'agent_status',
          status: 'cancelled',
          sessionId: session.sessionId,
        });
      }

      // Try SIGTERM first
      const killed = session.cliProcess.kill('SIGTERM');

      if (!killed) {
        this.logger.warn(`Failed to send SIGTERM to session ${session.sessionId}`);
        return false;
      }

      // Force SIGKILL after 5 seconds if still running
      setTimeout(() => {
        if (session.cliProcess && !session.cliProcess.killed) {
          this.logger.warn(`Process ${session.sessionId} didn't exit after SIGTERM, forcing SIGKILL`);
          session.cliProcess.kill('SIGKILL');
        }
      }, 5000);

      return true;
    }

    return false;
  }

  /**
   * Check if session has an active AgentEngine process
   */
  hasActiveProcess(session: ManagedSession): boolean {
    return !!(session.cliProcess && !session.cliProcess.killed);
  }

  /**
   * Handle AgentEngine stdout data
   * Parses stream-json and maps to frontend events
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
      // Emit cancelled so orchestrateMessage's completionPromise can resolve.
      // For REST cancel, the SSE stream is already closed; emitEvent on a closed
      // session is a no-op, but resolveCompletion() unblocks the awaiting controller.
      onEvent({
        type: 'agent_status',
        status: 'cancelled',
        sessionId: session.sessionId,
      });
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
}
