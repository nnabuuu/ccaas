/**
 * Headless Execution Service
 *
 * Spawns AgentEngine processes without WebSocket dependency.
 * Supports: Claude Code, OpenCode, and custom engines.
 * Used by SchedulerService for background/scheduled task execution.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventMapperService } from '../sessions/event-mapper.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import type { CLIEvent, SessionEvent } from '../common/interfaces';
import type { ScheduledTask } from './entities/scheduled-task.entity';
import type { ScheduledTaskExecution } from './entities/scheduled-task-execution.entity';

export interface HeadlessResult {
  resultText: string;
  tokenUsage: { input: number; output: number; cached: number };
  events: SessionEvent[];
  exitCode: number | null;
  workspacePath?: string;
}

export interface HeadlessExecuteOptions {
  resumeSessionId?: string;
  preserveWorkspace?: boolean;
  timeoutMs?: number;
}

@Injectable()
export class HeadlessExecutionService {
  private readonly logger = new Logger(HeadlessExecutionService.name);
  private readonly workspaceDir: string;
  private readonly claudeCliPath: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventMapperService: EventMapperService,
    private readonly skillSyncService: SkillSyncService,
  ) {
    this.workspaceDir = this.configService.get('workspace.dir', '.agent-workspace');
    this.claudeCliPath = this.configService.get('CLAUDE_CLI_PATH', 'claude');
  }

  /**
   * Execute a scheduled task headlessly.
   * Returns a promise that resolves when the CLI process completes or times out.
   */
  async execute(
    task: ScheduledTask,
    execution: ScheduledTaskExecution,
    onEvent?: (event: SessionEvent) => void,
  ): Promise<HeadlessResult> {
    const sessionId = execution.sessionId;

    // 1. Setup workspace
    const sessionWorkspace = path.join(this.workspaceDir, 'scheduled', sessionId);
    fs.mkdirSync(sessionWorkspace, { recursive: true });

    // Write permission settings
    const claudeDir = path.join(sessionWorkspace, '.claude');
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

    // 2. Sync skills if configured
    if (task.enabledSkills?.length) {
      try {
        const syncResult = await this.skillSyncService.syncToSession(
          sessionWorkspace,
          task.tenantId,
          {
            publishedOnly: true,
            skillSlugs: task.enabledSkills,
          },
        );
        this.logger.log(
          `Synced ${syncResult.skillCount} skills for scheduled task ${task.id}`,
        );
      } catch (error) {
        this.logger.warn(`Failed to sync skills for task ${task.id}: ${error}`);
      }
    }

    // 3. Build CLI command
    let shellCommand = `${this.claudeCliPath} --output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions`;

    if (task.mcpServers && Object.keys(task.mcpServers).length > 0) {
      const mcpConfig = JSON.stringify({ mcpServers: task.mcpServers });
      const escapedConfig = mcpConfig.replace(/'/g, "'\\''");
      shellCommand += ` --mcp-config '${escapedConfig}'`;
    }

    this.logger.log(`Headless execution starting for task ${task.id}, session ${sessionId}`);
    this.logger.debug(`Command: ${shellCommand}`);

    // 4. Spawn and run
    return new Promise<HeadlessResult>((resolve) => {
      const result: HeadlessResult = {
        resultText: '',
        tokenUsage: { input: 0, output: 0, cached: 0 },
        events: [],
        exitCode: null,
      };

      let buffer = '';
      let resolved = false;
      let timeoutHandle: NodeJS.Timeout | null = null;

      const finish = (exitCode: number | null) => {
        if (resolved) return;
        resolved = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        // Process remaining buffer
        if (buffer.trim()) {
          try {
            const cliEvent: CLIEvent = JSON.parse(buffer);
            this.processEvent(cliEvent, sessionId, task.tenantId, result, onEvent);
          } catch {
            // Ignore incomplete JSON
          }
        }

        result.exitCode = exitCode;
        this.logger.log(
          `Headless execution completed for task ${task.id}: exit=${exitCode}, text=${result.resultText.length} chars`,
        );

        // Cleanup workspace
        this.cleanupWorkspace(sessionWorkspace);

        resolve(result);
      };

      const cli = spawn('/bin/sh', ['-c', shellCommand], {
        cwd: sessionWorkspace,
        env: {
          ...process.env,
          AGENT_SESSION_ID: sessionId,
          AGENT_WORKSPACE_DIR: path.resolve(this.workspaceDir),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.logger.log(`CLI process spawned with PID ${cli.pid} for scheduled session ${sessionId}`);

      // Set timeout
      timeoutHandle = setTimeout(() => {
        if (!resolved) {
          this.logger.warn(`Headless execution timeout for task ${task.id} (${task.timeoutMs}ms)`);
          cli.kill('SIGTERM');
          // Give it a moment to cleanup, then force kill
          setTimeout(() => {
            if (!cli.killed) cli.kill('SIGKILL');
          }, 5000);
          result.exitCode = -1;
          finish(-1);
        }
      }, task.timeoutMs);

      // Send user message on spawn
      cli.on('spawn', () => {
        const jsonMessage = JSON.stringify({
          type: 'user',
          message: {
            role: 'user',
            content: task.message,
          },
        });
        cli.stdin.write(jsonMessage + '\n');
        this.logger.debug(`Sent message to headless CLI: ${jsonMessage.slice(0, 200)}...`);
      });

      // Process stdout
      cli.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const cliEvent: CLIEvent = JSON.parse(line);
            this.processEvent(cliEvent, sessionId, task.tenantId, result, onEvent);
          } catch {
            this.logger.warn(`Failed to parse headless CLI output: ${line.slice(0, 100)}...`);
          }
        }
      });

      cli.stderr.on('data', (chunk: Buffer) => {
        this.logger.error(`Headless CLI stderr (${sessionId}): ${chunk.toString()}`);
      });

      cli.on('close', (code: number | null) => {
        finish(code);
      });

      cli.on('error', (error: Error) => {
        this.logger.error(`Headless CLI error for ${sessionId}: ${error.message}`);
        finish(-1);
      });
    });
  }

  /**
   * Execute a background job headlessly.
   * Supports resume via --resume flag and optional workspace preservation.
   */
  async executeJob(
    params: {
      sessionId: string;
      tenantId: string;
      prompt: string;
      mcpServers?: Record<string, unknown>;
      enabledSkills?: string[];
    },
    options?: HeadlessExecuteOptions,
    onEvent?: (event: SessionEvent) => void,
  ): Promise<HeadlessResult> {
    const { sessionId, tenantId, prompt, mcpServers, enabledSkills } = params;
    const timeoutMs = options?.timeoutMs ?? 600000;
    const preserveWorkspace = options?.preserveWorkspace ?? false;
    const resumeSessionId = options?.resumeSessionId;

    // 1. Setup workspace
    const sessionWorkspace = path.join(this.workspaceDir, 'jobs', sessionId);
    fs.mkdirSync(sessionWorkspace, { recursive: true });

    // Write permission settings
    const claudeDir = path.join(sessionWorkspace, '.claude');
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

    // 2. Sync skills if configured
    if (enabledSkills?.length) {
      try {
        const syncResult = await this.skillSyncService.syncToSession(
          sessionWorkspace,
          tenantId,
          { publishedOnly: true, skillSlugs: enabledSkills },
        );
        this.logger.log(`Synced ${syncResult.skillCount} skills for job session ${sessionId}`);
      } catch (error) {
        this.logger.warn(`Failed to sync skills for job ${sessionId}: ${error}`);
      }
    }

    // 3. Build CLI command
    let shellCommand = `${this.claudeCliPath} --output-format stream-json --input-format stream-json --verbose --permission-mode bypassPermissions`;

    if (resumeSessionId) {
      shellCommand += ` --resume '${resumeSessionId}'`;
    }

    if (mcpServers && Object.keys(mcpServers).length > 0) {
      const mcpConfig = JSON.stringify({ mcpServers });
      const escapedConfig = mcpConfig.replace(/'/g, "'\\''");
      shellCommand += ` --mcp-config '${escapedConfig}'`;
    }

    this.logger.log(`Job execution starting for session ${sessionId}${resumeSessionId ? ` (resuming ${resumeSessionId})` : ''}`);

    // 4. Spawn and run
    return new Promise<HeadlessResult>((resolve) => {
      const result: HeadlessResult = {
        resultText: '',
        tokenUsage: { input: 0, output: 0, cached: 0 },
        events: [],
        exitCode: null,
        workspacePath: sessionWorkspace,
      };

      let buffer = '';
      let resolved = false;
      let timeoutHandle: NodeJS.Timeout | null = null;

      const finish = (exitCode: number | null) => {
        if (resolved) return;
        resolved = true;

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        if (buffer.trim()) {
          try {
            const cliEvent: CLIEvent = JSON.parse(buffer);
            this.processEvent(cliEvent, sessionId, tenantId, result, onEvent);
          } catch {
            // Ignore incomplete JSON
          }
        }

        result.exitCode = exitCode;
        this.logger.log(
          `Job execution completed for session ${sessionId}: exit=${exitCode}, text=${result.resultText.length} chars`,
        );

        // Only cleanup workspace if not preserved
        if (!preserveWorkspace) {
          this.cleanupWorkspace(sessionWorkspace);
        }

        resolve(result);
      };

      const cli = spawn('/bin/sh', ['-c', shellCommand], {
        cwd: sessionWorkspace,
        env: {
          ...process.env,
          AGENT_SESSION_ID: sessionId,
          AGENT_WORKSPACE_DIR: path.resolve(this.workspaceDir),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.logger.log(`CLI process spawned with PID ${cli.pid} for job session ${sessionId}`);

      timeoutHandle = setTimeout(() => {
        if (!resolved) {
          this.logger.warn(`Job execution timeout for session ${sessionId} (${timeoutMs}ms)`);
          cli.kill('SIGTERM');
          setTimeout(() => {
            if (!cli.killed) cli.kill('SIGKILL');
          }, 5000);
          result.exitCode = -1;
          finish(-1);
        }
      }, timeoutMs);

      // Send user message on spawn (only if not resuming)
      cli.on('spawn', () => {
        if (!resumeSessionId) {
          const jsonMessage = JSON.stringify({
            type: 'user',
            message: { role: 'user', content: prompt },
          });
          cli.stdin.write(jsonMessage + '\n');
          this.logger.debug(`Sent message to job CLI: ${jsonMessage.slice(0, 200)}...`);
        }
      });

      cli.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const cliEvent: CLIEvent = JSON.parse(line);
            this.processEvent(cliEvent, sessionId, tenantId, result, onEvent);
          } catch {
            this.logger.warn(`Failed to parse job CLI output: ${line.slice(0, 100)}...`);
          }
        }
      });

      cli.stderr.on('data', (chunk: Buffer) => {
        this.logger.error(`Job CLI stderr (${sessionId}): ${chunk.toString()}`);
      });

      cli.on('close', (code: number | null) => finish(code));
      cli.on('error', (error: Error) => {
        this.logger.error(`Job CLI error for ${sessionId}: ${error.message}`);
        finish(-1);
      });
    });
  }

  /**
   * Process a single CLI event, accumulating results
   */
  private processEvent(
    cliEvent: CLIEvent,
    sessionId: string,
    tenantId: string,
    result: HeadlessResult,
    onEvent?: (event: SessionEvent) => void,
  ): void {
    const frontendEvents = this.eventMapperService.mapToSessionEvents(
      cliEvent,
      sessionId,
      `scheduled_${tenantId}`,
    );

    for (const event of frontendEvents) {
      result.events.push(event);

      // Accumulate text
      if (event.type === 'text_delta' && (event as any).delta) {
        result.resultText += (event as any).delta;
      }

      // Accumulate token usage
      if (event.type === 'token_usage') {
        const payload = (event as any).payload;
        if (payload) {
          result.tokenUsage.input = payload.sessionInputTokens || result.tokenUsage.input;
          result.tokenUsage.output = payload.sessionOutputTokens || result.tokenUsage.output;
          result.tokenUsage.cached = payload.cachedInputTokens || result.tokenUsage.cached;
        }
      }

      // Forward to callback (e.g., Socket.io emit)
      if (onEvent) {
        onEvent(event);
      }
    }
  }

  /**
   * Cleanup workspace directory after execution
   */
  private cleanupWorkspace(workspacePath: string): void {
    try {
      fs.rmSync(workspacePath, { recursive: true, force: true });
      this.logger.debug(`Cleaned up workspace: ${workspacePath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup workspace ${workspacePath}: ${error}`);
    }
  }
}
