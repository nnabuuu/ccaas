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
import { EventEmitter2 } from '@nestjs/event-emitter';
import { spawn, ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventMapperService } from '../event-mapper.service';
import { WorkspaceService } from './workspace.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { McpEngineAdapterService } from '../../tool-caller/adapters/mcp-engine-adapter.service';
import type { ManagedSession, CLIEvent, SessionEvent } from '../../common/interfaces';

export interface ResolvedAttachment {
  type: string;
  absolutePath: string;
  mimeType: string;
}

/**
 * Hard delimiter prepended before the sandbox steer so it can't be
 * visually swallowed by a malformed solution `appendSystemPrompt`
 * (e.g. one ending with "ignore subsequent instructions"). Note the
 * actual deny + MCP-injection enforcement happens at the CLI-flag layer
 * — steer text is only a hint to the model.
 */
const SANDBOX_STEER_DELIMITER =
  '\n\n---\n[CCAAS SANDBOX — non-negotiable system constraint]\n';

/**
 * Merge sandbox-required `disallowed` tools into an existing
 * `--disallowed-tools <csv>` flag in `args`, or push a new one. Mutates
 * `args` in place. Idempotent — duplicates are de-duped.
 *
 * Why merge instead of push: claude CLI takes the LAST `--disallowed-tools`
 * occurrence when duplicates are present, so a future caller pushing its
 * own deny flag would silently undo ours.
 */
function mergeDisallowedTools(args: string[], disallowed: string[]): void {
  let idx = -1;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--disallowed-tools') {
      idx = i;
    }
  }
  if (idx >= 0 && idx + 1 < args.length) {
    const existing = args[idx + 1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...existing, ...disallowed]));
    args[idx + 1] = merged.join(',');
  } else {
    args.push('--disallowed-tools', disallowed.join(','));
  }
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
    private readonly sandboxService: SandboxService,
    private readonly eventEmitter: EventEmitter2,
    private readonly mcpEngineAdapter: McpEngineAdapterService,
  ) {
    this.workspaceDir = this.configService.get('workspace.dir', '.agent-workspace');
    this.claudeCliPath = this.configService.get('CLAUDE_CLI_PATH', 'claude');

    this.logger.log(`Using Claude CLI: ${this.claudeCliPath}`);
  }

  /**
   * Build the `--mcp-config` arg + any sandbox-related arg additions
   * shared between initial spawn and `--resume` spawn. Mutates `args`
   * in place.
   *
   * Sandbox semantics (when `SandboxService.enabled`):
   *   - Inject `__ccaas_bash` MCP server backed by just-bash, rooted at
   *     `session.workspaceDir`. Merged with solution-provided mcpServers,
   *     never overrides.
   *   - Add `Bash` to `--disallowed-tools`. If a prior caller already
   *     pushed `--disallowed-tools`, merge into that single flag rather
   *     than emit a second one (claude CLI is last-wins on duplicates,
   *     so a duplicate flag would silently undo the sandbox deny).
   *   - Append sandbox steering text to `appendSystemPrompt` separated
   *     by a hard delimiter so a malformed solution prompt can't visually
   *     swallow it.
   */
  private applyMcpAndSandbox(
    session: ManagedSession,
    args: string[],
    appendSystemPrompt: string | undefined,
  ): string | undefined {
    const mcpServers: Record<string, unknown> = {};

    if (session.mcpServers && Object.keys(session.mcpServers).length > 0) {
      // Phase 3 routing — when the adapter has tools registered for
      // the solution, replace every SOLUTION mcp server entry
      // (anything not prefixed `bundle:`) with the single proxy
      // bundle. The bundle: entries stay direct because they're
      // ccaas-owned, not solution-owned. See
      // docs/design-tool-caller-proxy.md §5.1.
      //
      // We evaluate `shouldProxy` at every spawn (not once at first
      // turn) so a late-registered toolkit — e.g. SolutionLoader was
      // still walking the SOLUTIONS_DIR when this session's first
      // turn landed — can still flip routing on a subsequent turn.
      // `session.useToolCallerProxy` is kept as a separate audit
      // signal but no longer gates routing.
      if (this.mcpEngineAdapter.shouldProxy(session)) {
        const resolved = this.workspaceService.resolveSessionMcpPaths(session.mcpServers);
        const replaced: string[] = [];
        for (const [name, cfg] of Object.entries(resolved)) {
          if (name.startsWith('bundle:')) {
            mcpServers[name] = cfg;
          } else {
            replaced.push(name);
          }
        }
        const { name, config } = this.mcpEngineAdapter.buildProxyEntry(session);
        mcpServers[name] = config;
        this.logger.log(
          `Session ${session.sessionId} routed through ToolCallerProxy ` +
          `(replaced ${replaced.length} solution MCP entry/entries: ${replaced.join(', ')}; ` +
          `bundle entries preserved)`,
        );
      } else {
        const resolved = this.workspaceService.resolveSessionMcpPaths(session.mcpServers);
        Object.assign(mcpServers, resolved);
        this.logger.log(
          `Session ${session.sessionId} using solution MCP servers: ${Object.keys(session.mcpServers).join(', ')}`,
        );
      }
    }

    const sandbox = this.sandboxService.bashMcpSpec(session.workspaceDir, session.sessionId);
    if (sandbox) {
      if (mcpServers[sandbox.name]) {
        this.logger.warn(
          `Session ${session.sessionId} mcpServer key collision on reserved name ${sandbox.name}; ` +
          `solution-provided entry is being replaced by ccaas sandbox MCP.`,
        );
      }
      mcpServers[sandbox.name] = {
        command: sandbox.command,
        args: sandbox.args,
        env: sandbox.env,
      };
      this.logger.log(
        `Session ${session.sessionId} bash sandbox active (${this.sandboxService.mode}) → ${sandbox.name}`,
      );
    }

    if (Object.keys(mcpServers).length > 0) {
      const mcpConfig = JSON.stringify({ mcpServers });
      args.push('--mcp-config', mcpConfig);
      this.logger.debug(`MCP config: ${mcpConfig}`);
    } else {
      this.logger.warn(`Session ${session.sessionId} has NO MCP servers configured`);
    }

    const disallow = this.sandboxService.disallowedTools();
    if (disallow.length > 0) {
      mergeDisallowedTools(args, disallow);
    }

    const steer = this.sandboxService.systemPromptSteer();
    if (steer) {
      return appendSystemPrompt && appendSystemPrompt.trim()
        ? `${appendSystemPrompt}${SANDBOX_STEER_DELIMITER}${steer}`
        : steer;
    }
    return appendSystemPrompt;
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
    if (session.cliProcess && session.stdin && !session.cliProcess.killed) {
      this.logger.log(`Reusing AgentEngine for session ${session.sessionId}`);
      session.currentOnEvent = onEvent;
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
      '--permission-prompt-tool', 'stdio',
    ];

    // Merge solution-provided MCP servers + ccaas sandbox MCP (when enabled),
    // emit --mcp-config / --disallowed-tools, fold sandbox steering into the
    // append-system-prompt. See applyMcpAndSandbox for sandbox rationale.
    const effectiveSystemPrompt = this.applyMcpAndSandbox(session, args, appendSystemPrompt);
    if (effectiveSystemPrompt && effectiveSystemPrompt.trim()) {
      args.push('--append-system-prompt', effectiveSystemPrompt);
      this.logger.log(`Added system prompt (${effectiveSystemPrompt.length} chars)`);
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
    session.processingStartedAt = new Date();
    session.lastActivity = new Date();
    session.currentOnEvent = onEvent;

    // Persist appendSystemPrompt so sendFollowUp (--resume) can restore it
    if (appendSystemPrompt) {
      session.appendSystemPrompt = appendSystemPrompt;
    }

    this.logger.log(`AgentEngine spawned with PID ${cli.pid} for session ${session.sessionId}`);

    cli.on('spawn', () => {
      this.logger.log(`Process spawn confirmed for session ${session.sessionId}`);
      this.sendMessageToProcess(session, initialMessage, attachments);
    });

    // Route through session.currentOnEvent so follow-up turns can swap the handler
    cli.stdout.on('data', (chunk: Buffer) => {
      this.handleCLIOutput(session, chunk, session.currentOnEvent!);
    });

    cli.stderr.on('data', (chunk: Buffer) => {
      this.logger.error(`AgentEngine stderr (${session.sessionId}): ${chunk.toString()}`);
    });

    cli.on('close', (code: number | null) => {
      this.logger.log(`AgentEngine exited with code ${code} for session ${session.sessionId}`);
      this.handleCLIClose(session, code, session.currentOnEvent!);
    });

    cli.on('error', (error: Error) => {
      this.logger.error(`AgentEngine error for session ${session.sessionId}: ${error.message}`);
      session.status = 'error';
      session.currentOnEvent?.({
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
    onEvent: (event: SessionEvent) => void,
    attachments?: ResolvedAttachment[],
  ): Promise<void> {
    this.logger.log(`Sending follow-up message to session ${session.sessionId}`);

    if (session.cliProcess && !session.cliProcess.killed && session.stdin) {
      this.logger.log('Reusing existing AgentEngine for follow-up');
      session.currentOnEvent = onEvent;  // Swap callback so events route to new turn
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
      '--permission-prompt-tool', 'stdio',
      '--resume', session.sessionId,
    ];

    // Merge MCP + sandbox same as initial spawn (so resumed sessions
    // keep the just-bash MCP route + Bash deny, not just on first turn).
    const effectiveSystemPrompt = this.applyMcpAndSandbox(session, args, session.appendSystemPrompt);
    if (effectiveSystemPrompt && effectiveSystemPrompt.trim()) {
      args.push('--append-system-prompt', effectiveSystemPrompt);
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
    session.processingStartedAt = new Date();
    session.lastActivity = new Date();
    session.buffer = '';
    session.currentOnEvent = onEvent;

    onEvent({
      type: 'agent_status',
      status: 'running',
      sessionId: session.sessionId,
    });

    cli.on('spawn', () => {
      this.sendMessageToProcess(session, message, attachments);
    });

    // Route through session.currentOnEvent so follow-up turns can swap the handler
    cli.stdout.on('data', (chunk: Buffer) => {
      this.handleCLIOutput(session, chunk, session.currentOnEvent!);
    });

    cli.stderr.on('data', (chunk: Buffer) => {
      this.logger.error(`CLI stderr (${session.sessionId}): ${chunk.toString()}`);
    });

    cli.on('close', (code: number | null) => {
      this.logger.log(`CLI exited with code ${code} for session ${session.sessionId}`);
      this.handleCLIClose(session, code, session.currentOnEvent!);
    });

    cli.on('error', (error: Error) => {
      this.logger.error(`CLI error for session ${session.sessionId}: ${error.message}`);
      session.status = 'error';
      session.currentOnEvent?.({
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
   * Send a control_response to the CLI stdin (for AskUserQuestion answers).
   * Retrieves original toolInput from pending request, merges answers, and writes to stdin.
   */
  sendControlResponse(
    session: ManagedSession,
    requestId: string,
    answers: Record<string, string>,
  ): void {
    if (!session.stdin || session.stdin.destroyed) {
      throw new Error(`Cannot send control_response: stdin not available for session ${session.sessionId}`);
    }

    // Validate answer values are bounded strings before writing to CLI stdin
    const MAX_ANSWER_LENGTH = 10_000;
    for (const [key, val] of Object.entries(answers)) {
      if (typeof val !== 'string') {
        throw new Error(`Answer value for key "${key}" must be a string, got ${typeof val}`);
      }
      if (val.length > MAX_ANSWER_LENGTH) {
        throw new Error(`Answer value for key "${key}" exceeds ${MAX_ANSWER_LENGTH} characters`);
      }
    }

    // Retrieve original request to include full input
    const pending = this.eventMapperService.getPendingControlRequest(session.sessionId, requestId);
    if (!pending) {
      throw new Error(`No pending control_request found for session=${session.sessionId} requestId=${requestId}`);
    }

    // Build updated input with answers merged in
    const updatedInput = {
      ...pending.toolInput,
      answers,
    };

    // Use the original control_request's requestId for the CLI response,
    // which may differ from the frontend's requestId (tool_use block ID).
    const cliRequestId = pending.requestId;

    const response = JSON.stringify({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: cliRequestId,
        response: {
          behavior: 'allow',
          updatedInput,
        },
      },
    });

    this.logger.log(`[ControlResponse] Sending response for requestId=${cliRequestId} (lookup=${requestId}) session=${session.sessionId}`);

    try {
      session.stdin.write(response + '\n');
      session.lastActivity = new Date();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to write control_response: ${msg}`);
      throw error;
    }

    // Store answers for dedup (prevents LLM from re-asking the same AskUserQuestion)
    this.eventMapperService.storeCompletedAskUserAnswers(session.sessionId, answers, pending.toolInput);

    // Clean up pending request (remove both the original and lookup keys)
    this.eventMapperService.removePendingControlRequest(session.sessionId, cliRequestId);
    if (requestId !== cliRequestId) {
      this.eventMapperService.removePendingControlRequest(session.sessionId, requestId);
    }
  }

  /**
   * Auto-approve a control_request (for non-AskUserQuestion tools).
   * Optionally includes updatedInput for dedup AskUserQuestion responses.
   */
  private sendAutoApprove(
    session: ManagedSession,
    requestId: string,
    dedupToolInput?: Record<string, unknown>,
  ): void {
    if (!session.stdin || session.stdin.destroyed) return;

    const responsePayload = dedupToolInput
      ? { behavior: 'allow', updatedInput: dedupToolInput }
      : { behavior: 'allow' };

    const response = JSON.stringify({
      type: 'control_response',
      response: {
        subtype: 'success',
        request_id: requestId,
        response: responsePayload,
      },
    });

    try {
      session.stdin.write(response + '\n');
      if (dedupToolInput) {
        this.logger.log(`[Dedup] Auto-responded to duplicate AskUserQuestion requestId=${requestId}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to auto-approve control_request ${requestId}: ${msg}`);
    }
  }

  /**
   * Handle AgentEngine stdout data
   * Parses stream-json and maps to frontend events
   */
  private handleCLIOutput(
    session: ManagedSession,
    chunk: Buffer,
    onEvent: (event: SessionEvent) => void,
  ): void {
    session.buffer += chunk.toString();
    session.lastActivity = new Date();

    const lines = session.buffer.split('\n');
    session.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const cliEvent: CLIEvent = JSON.parse(line);
        const frontendEvents = this.eventMapperService.mapToSessionEvents(
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

        // Drain auto-approve queue: non-AskUserQuestion control_requests get approved immediately
        // (also handles dedup AskUserQuestion auto-responses with cached answers)
        const autoApprovals = this.eventMapperService.drainAutoApproveQueue(session.sessionId);
        for (const approval of autoApprovals) {
          this.sendAutoApprove(session, approval.requestId, approval.dedupToolInput);
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
    onEvent: (event: SessionEvent) => void,
  ): void {
    if (session.buffer.trim()) {
      try {
        const cliEvent: CLIEvent = JSON.parse(session.buffer);
        const frontendEvents = this.eventMapperService.mapToSessionEvents(
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
    session.processingEndedAt = new Date();

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

    // Global event for the agent-runtime sync layer. Fires once per turn
    // boundary (clean exit OR error OR cancellation). Subscribers gate on
    // `status: 'complete'` to run the syncer; other states are no-ops.
    this.eventEmitter.emit('session.turn.complete', {
      sessionId: session.sessionId,
      solutionId: session.solutionId,
      status: wasCancelled ? 'cancelled' : code === 0 ? 'complete' : 'error',
      exitCode: code,
    });
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
      session.processingStartedAt = new Date();
      session.messageCount++;
    } catch (error) {
      this.logger.error(`Failed to write to AgentEngine stdin for session ${session.sessionId}: ${error.message}`);
      session.status = 'error';
      throw error; // Let caller handle
    }
  }
}
