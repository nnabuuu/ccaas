/**
 * SandboxService — produces the spawn-spec pieces CliProcessService injects
 * when sandbox mode is active.
 *
 * Mode resolution:
 *   config.workspace.bashSandbox  → 'just-bash' | 'none' (already
 *                                    defaulted in configuration.ts)
 *
 * When mode = 'just-bash':
 *   bashMcpSpec(workspaceDir) → injects an MCP server (reserved name
 *                                `__ccaas_bash`) backed by
 *                                src/sessions/sandbox/just-bash-mcp/server.mjs,
 *                                rooted at the session workspace path.
 *   disallowedTools() → ['Bash'] — claude's built-in Bash tool is denied
 *                       so the model routes shell commands through MCP.
 *   systemPromptSteer() → tells the model to use the MCP bash and
 *                          explains the deny.
 *
 * When mode = 'none' (default for non-agentfs deployments): all helpers
 * return null/empty — caller short-circuits and behavior is identical
 * to pre-sandbox code.
 *
 * Reserved MCP name `__ccaas_bash` (double-underscore) is documented as
 * unavailable to solution-provided MCP servers.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export type BashSandboxMode = 'just-bash' | 'none';

/** Reserved MCP server name. Solution backends must not use this key. */
export const SANDBOX_BASH_MCP_NAME = '__ccaas_bash';

export interface SandboxMcpSpec {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
}

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  readonly mode: BashSandboxMode;
  readonly serverScriptPath: string;
  private readonly traceLogPath: string;

  constructor(@Inject(ConfigService) cfg: ConfigService) {
    this.mode = cfg.get<BashSandboxMode>('workspace.bashSandbox', 'none');
    // Gate the existsSync check on mode so deploys that pruned .mjs files
    // from dist (or any deploy with sandbox off) don't crash at boot for
    // an asset they never use. Throw remains fail-fast for active sandbox.
    this.serverScriptPath =
      this.mode === 'just-bash' ? resolveServerScriptPath() : '';
    const workspaceDir = cfg.get<string>('workspace.dir', '.agent-workspace');
    this.traceLogPath = resolve(workspaceDir, '_sandbox_logs', 'bash-mcp.log');
    this.logger.log(
      `Bash sandbox mode: ${this.mode}` +
      (this.mode === 'just-bash' ? ` (server: ${this.serverScriptPath})` : ''),
    );
  }

  get enabled(): boolean {
    return this.mode === 'just-bash';
  }

  /**
   * MCP server spec to merge into a claude session's `--mcp-config`, or
   * `null` when sandbox is off.
   */
  bashMcpSpec(workspaceDir: string, sessionId?: string): SandboxMcpSpec | null {
    if (!this.enabled) return null;
    return {
      name: SANDBOX_BASH_MCP_NAME,
      command: process.execPath, // current Node binary
      args: [this.serverScriptPath],
      env: {
        PATH: process.env.PATH ?? '',
        CCAAS_SANDBOX_ROOT: workspaceDir,
        CCAAS_SANDBOX_MCP_LOG: this.traceLogPath,
        ...(sessionId ? { CCAAS_SESSION_ID: sessionId } : {}),
      },
    };
  }

  /** Native tools that should be denied to claude when sandbox is active. */
  disallowedTools(): string[] {
    return this.enabled ? ['Bash'] : [];
  }

  /**
   * Steering text appended to claude's system prompt. Tells the model the
   * built-in Bash is gone and points it at the MCP replacement. Empty
   * string when sandbox is off (caller skips the append).
   */
  systemPromptSteer(): string {
    if (!this.enabled) return '';
    return (
      'For ANY shell command in this session, you MUST call the MCP tool ' +
      `\`mcp__${SANDBOX_BASH_MCP_NAME}__bash\` instead of the built-in Bash ` +
      'tool. The built-in Bash tool has been disabled for sandbox safety. ' +
      'The MCP bash has identical input schema ({command, cwd?}) and ' +
      'returns stdout/stderr/exitCode the same way.'
    );
  }
}

/**
 * Locate `just-bash-mcp/server.mjs` at runtime. Backend compiles to CJS
 * so `__dirname` is always defined — in dev (nest start, ts-node) it's
 * the .ts source dir; in prod (after `nest build`) it's
 * `dist/src/sessions/sandbox/`, and nest-cli's `assets` config copies
 * the `.mjs` to the same relative location.
 */
function resolveServerScriptPath(): string {
  const candidate = resolve(__dirname, 'just-bash-mcp/server.mjs');
  if (!existsSync(candidate)) {
    throw new Error(
      `SandboxService cannot find just-bash MCP server at ${candidate}. ` +
      `For nest dev this means the source file is missing; for nest prod ` +
      `this means nest-cli's assets config did not copy *.mjs to dist.`,
    );
  }
  return candidate;
}
