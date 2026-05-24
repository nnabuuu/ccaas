import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JUST_BASH_MCP_ENTRY = resolve(__dirname, 'just-bash-mcp/server.ts');

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
const TSX_BIN = findTsxBin();

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
   * Force MCP-server-only Bash, by denying the built-in Bash tool and steering
   * the agent toward the `mcp__vfs-poc-bash__bash` tool. POC default = on.
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

  const mcpConfig = {
    mcpServers: {
      'vfs-poc-bash': {
        type: 'stdio' as const,
        command: TSX_BIN,
        args: [JUST_BASH_MCP_ENTRY],
        env: {
          PATH: process.env.PATH ?? '',
          VFS_POC_MOUNT_POINT: mountPoint,
          VFS_POC_SESSION_ID: sessionId,
          ...(mcpLogPath ? { VFS_POC_MCP_LOG: mcpLogPath } : {}),
        },
      },
    },
  };

  const args = [
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--verbose',
    '--permission-mode', 'bypassPermissions',
    '--mcp-config', JSON.stringify(mcpConfig),
  ];

  if (forceSandboxedBash) {
    // Steer the model toward the sandboxed bash via system prompt + permission
    // denial of the built-in Bash tool. (`--disallowed-tools` is the documented
    // claude flag for this.)
    args.push(
      '--disallowed-tools', 'Bash',
      '--append-system-prompt',
      'For ANY shell command, you MUST call the MCP tool ' +
        '`mcp__vfs-poc-bash__bash` instead of the built-in Bash tool. The ' +
        'built-in Bash tool is disabled in this session.',
    );
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
