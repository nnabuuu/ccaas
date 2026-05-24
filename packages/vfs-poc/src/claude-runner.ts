import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const JUST_BASH_MCP_ENTRY = resolve(__dirname, 'just-bash-mcp/server.ts');
export const FILES_MCP_ENTRY = resolve(__dirname, 'files-mcp/server.ts');

// Resolve the tsx binary from the hoisted root node_modules so the MCP server
// inherits a working ESM+TS loader regardless of the cwd claude spawns it from.
function findTsxBin(): string {
  let dir = __dirname;
  while (true) {
    const candidate = resolve(dir, 'node_modules/.bin/tsx');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('tsx binary not found in any ancestor node_modules/.bin');
    dir = parent;
  }
}
export const TSX_BIN = findTsxBin();

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface RunClaudeOptions {
  sessionId: string;
  mountPoint: string;
  prompt: string;
  /** Override `claude` binary location. */
  claudeBin?: string;
  /** Path for MCP server tracing (verifies just-bash is actually invoked). */
  mcpLogPath?: string;
  /** Wall-clock cap. Default 90s. */
  timeoutMs?: number;
  /**
   * Tools to deny via `--disallowed-tools`. If omitted, defaults to ['Bash']
   * (legacy POC1 behavior) when `forceSandboxedBash` is true.
   */
  disallowedTools?: string[];
  /**
   * MCP servers to inject via `--mcp-config`. Map key = server name, value =
   * stdio spawn spec. If omitted, defaults to the legacy vfs-poc-bash setup
   * when `forceSandboxedBash` is true. Pass an explicit empty object to inject
   * nothing.
   */
  mcpServers?: Record<string, McpServerConfig>;
  /**
   * Extra text appended to the system prompt (e.g. "use this MCP tool not
   * that"). Pass null to omit. If omitted and `forceSandboxedBash` is true,
   * the legacy POC1 steering prompt is used.
   */
  appendSystemPrompt?: string | null;
  /**
   * POC1 legacy shorthand: when true (default), uses
   *   - disallowedTools = ['Bash']
   *   - mcpServers = { 'vfs-poc-bash': <local just-bash MCP> }
   *   - appendSystemPrompt = "use mcp__vfs-poc-bash__bash"
   * Set false to take full manual control via the fields above.
   */
  forceSandboxedBash?: boolean;
}

export interface RunClaudeResult {
  exitCode: number | null;
  events: unknown[];
  assistantText: string;
  toolUses: Array<{ name: string; input: unknown }>;
}

/**
 * Spawn the real `claude` CLI inside an agentfs mount and stream a single
 * user turn. Returns when claude emits a `result` event or the process exits.
 */
export async function runClaude(opts: RunClaudeOptions): Promise<RunClaudeResult> {
  const {
    sessionId,
    mountPoint,
    prompt,
    claudeBin = 'claude',
    mcpLogPath,
    timeoutMs = 90_000,
    forceSandboxedBash = true,
  } = opts;

  // Resolve the effective deny list + MCP set, with POC1 defaults preserved.
  const disallowedTools: string[] = opts.disallowedTools
    ?? (forceSandboxedBash ? ['Bash'] : []);
  const mcpServers: Record<string, McpServerConfig> = opts.mcpServers
    ?? (forceSandboxedBash
      ? {
          'vfs-poc-bash': {
            command: TSX_BIN,
            args: [JUST_BASH_MCP_ENTRY],
            env: {
              PATH: process.env.PATH ?? '',
              VFS_POC_MOUNT_POINT: mountPoint,
              VFS_POC_SESSION_ID: sessionId,
              ...(mcpLogPath ? { VFS_POC_MCP_LOG: mcpLogPath } : {}),
            },
          },
        }
      : {});
  const appendSystemPrompt: string | null = opts.appendSystemPrompt !== undefined
    ? opts.appendSystemPrompt
    : (forceSandboxedBash
      ? 'For ANY shell command, you MUST call the MCP tool ' +
        '`mcp__vfs-poc-bash__bash` instead of the built-in Bash tool. The ' +
        'built-in Bash tool is disabled in this session.'
      : null);

  const mcpConfig = {
    mcpServers: Object.fromEntries(
      Object.entries(mcpServers).map(([name, cfg]) => [
        name,
        { type: 'stdio' as const, ...cfg },
      ]),
    ),
  };

  const args = [
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'bypassPermissions',
    '--mcp-config', JSON.stringify(mcpConfig),
  ];

  if (disallowedTools.length > 0) {
    args.push('--disallowed-tools', disallowedTools.join(','));
  }
  if (appendSystemPrompt) {
    args.push('--append-system-prompt', appendSystemPrompt);
  }

  const child: ChildProcess = spawn(claudeBin, args, {
    cwd: mountPoint,
    env: {
      ...process.env,
      AGENT_SESSION_ID: sessionId,
      AGENT_WORKSPACE_DIR: mountPoint,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const events: unknown[] = [];
  let assistantText = '';
  const toolUses: Array<{ name: string; input: unknown }> = [];
  let resolveDone: (v: void) => void;
  let rejectDone: (e: Error) => void;
  const done = new Promise<void>((res, rej) => {
    resolveDone = res;
    rejectDone = rej;
  });

  let stdoutBuf = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString('utf8');
    let nl: number;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let evt: any;
      try { evt = JSON.parse(line); } catch { continue; }
      events.push(evt);
      // Collect assistant text + tool uses for assertions
      if (evt.type === 'assistant' && evt.message?.content) {
        for (const blk of evt.message.content) {
          if (blk.type === 'text') assistantText += blk.text;
          if (blk.type === 'tool_use') toolUses.push({ name: blk.name, input: blk.input });
        }
      }
      // Final result signal
      if (evt.type === 'result') {
        resolveDone();
      }
    }
  });

  child.stderr?.on('data', (b: Buffer) => {
    process.stderr.write(`[claude ${sessionId}] ${b}`);
  });

  child.on('error', (err) => rejectDone(err));
  child.on('exit', () => resolveDone());

  const initialMessage = JSON.stringify({
    type: 'user',
    message: { role: 'user', content: prompt },
  });
  child.stdin?.write(initialMessage + '\n');
  child.stdin?.end();

  const timer = setTimeout(() => {
    rejectDone(new Error(`claude timed out after ${timeoutMs}ms`));
    child.kill('SIGTERM');
  }, timeoutMs);

  try {
    await done;
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill('SIGTERM');
  }

  return { exitCode: child.exitCode, events, assistantText, toolUses };
}
