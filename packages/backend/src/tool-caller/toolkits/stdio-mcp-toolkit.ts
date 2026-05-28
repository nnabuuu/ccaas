/**
 * Wraps a legacy solution-shipped stdio MCP server as a
 * `SolutionToolkit`.
 *
 * The shipped binary (e.g. `solutions/business/live-lesson/creator-mcp-server/`)
 * stays untouched — same protocol, same args, same env. The wrapper
 * spawns it lazily on the first invocation, multiplexes
 * concurrent calls over the single subprocess via JSON-RPC IDs, and
 * keeps the process alive until `dispose()`.
 *
 * The handler's signature accepts `ToolInvocation<TArgs>` (args +
 * context) but it only forwards `args` to the subprocess. Context
 * is intentionally consumed by the proxy pipeline upstream — the
 * legacy stdio MCP server is identity-blind by design (it has no
 * way to verify identity claims, so we never give it any).
 *
 * Reference: design doc §5.1, plan Phase 3 step 4.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import type {
  SolutionToolkit,
  ToolDefinition,
  ToolInvocation,
  ToolResult,
} from '../types';

/** Tool definition with a JSONSchema hand-mirrored from the stdio server's `inputSchema`. */
export interface StdioToolSpec {
  /** Local tool name as advertised by the stdio MCP server. */
  name: string;
  /** Description shown to the agent — usually copied from the source MCP server. */
  description: string;
  /**
   * Zod schema mirroring the stdio server's JSON Schema input.
   * Used by the ToolCallerProxy for arg validation; the stdio
   * subprocess will re-validate independently. Duplication is
   * acceptable for the migration window — the long-term plan is
   * to load schemas as data from solutions (plan §"Open questions").
   *
   * For loader-driven probing (Phase 4) we use `z.unknown()` and pass
   * the original stdio JSON Schema via `jsonSchemaOverride` so the
   * agent sees the upstream contract verbatim without a Zod
   * round-trip. The stdio server itself is the source of truth.
   */
  argsSchema: z.ZodTypeAny;
  /**
   * Optional precomputed JSON Schema — passed through to
   * `ToolDefinition.jsonSchemaOverride`. When set, the proxy exposes
   * this exact schema to the agent rather than deriving one from
   * `argsSchema`.
   */
  jsonSchemaOverride?: Record<string, unknown>;
  /** Forward-compat declarative permission tag (not enforced yet). */
  requiredPermissions?: string[];
}

export interface StdioMcpToolkitOptions {
  /** Owning solution. Tools are isolated per-solution in the registry. */
  solutionId: string;
  /** Toolkit namespace — same string used in solution.json's MCP server slug. */
  namespace: string;
  /** Path to the stdio MCP server's entrypoint (e.g. `dist/index.js`). */
  serverEntry: string;
  /** Optional working dir for the subprocess (defaults to entry's dir). */
  cwd?: string;
  /** Optional extra env vars passed to the subprocess. */
  env?: Record<string, string>;
  /** Tool definitions to expose. Names must match what the server advertises. */
  tools: StdioToolSpec[];
}

interface PendingRpc {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

/**
 * Spawn-and-forward implementation of the stdio MCP wire protocol.
 *
 * The MCP spec is JSON-RPC 2.0 over newline-delimited stdin/stdout.
 * We only implement the subset needed for tools/call — `initialize`
 * + `tools/call` — because that's all the proxy ever needs.
 *
 * One subprocess per toolkit (i.e. per solution.json mcp-server
 * declaration), shared across all sessions for that solution.
 * This matches today's behavior — solutions don't expect per-session
 * MCP processes.
 */
export class StdioMcpToolkit implements SolutionToolkit {
  private readonly logger = new Logger(StdioMcpToolkit.name);
  readonly solutionId: string;
  readonly namespace: string;
  readonly tools: ToolDefinition[];

  private child: ChildProcess | null = null;
  private nextRpcId = 1;
  private pending = new Map<number, PendingRpc>();
  private buffer = '';
  /**
   * Initialization is async; the first `tools/call` blocks on the
   * `initialize` handshake completing. We cache the promise so
   * concurrent first calls don't double-init.
   */
  private initPromise: Promise<void> | null = null;

  constructor(private readonly opts: StdioMcpToolkitOptions) {
    this.solutionId = opts.solutionId;
    this.namespace = opts.namespace;
    this.tools = opts.tools.map((spec) => this.makeToolDefinition(spec));
  }

  /**
   * Build a ToolDefinition whose handler forwards to the stdio
   * subprocess. The proxy has already sanitized + validated args
   * by the time this handler runs.
   */
  private makeToolDefinition(spec: StdioToolSpec): ToolDefinition {
    return {
      name: spec.name,
      description: spec.description,
      argsSchema: spec.argsSchema,
      jsonSchemaOverride: spec.jsonSchemaOverride,
      requiredPermissions: spec.requiredPermissions,
      handler: async (invocation: ToolInvocation) =>
        this.dispatchToStdio(spec.name, invocation),
    };
  }

  private async dispatchToStdio(
    toolName: string,
    invocation: ToolInvocation,
  ): Promise<ToolResult> {
    try {
      await this.ensureInitialized();
      const response = (await this.rpc('tools/call', {
        name: toolName,
        arguments: invocation.args,
      })) as {
        content?: Array<{ type: 'text'; text: string }>;
        isError?: boolean;
      };
      if (response.isError) {
        return {
          ok: false,
          code: 'handler_error',
          reason: contentToString(response.content) || 'tool returned isError',
        };
      }
      return {
        ok: true,
        content: response.content ?? [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: 'handler_error',
        reason: `stdio MCP transport error: ${msg}`,
      };
    }
  }

  /** Idempotent. Spawns the subprocess + completes MCP handshake. */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize().catch((err) => {
      // On init failure: clear the cached promise so a later
      // call can retry rather than receiving the same dead error
      // forever.
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  private async initialize(): Promise<void> {
    this.spawn();
    await this.rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ccaas-tool-caller-proxy', version: '1.0.0' },
    });
    // MCP spec requires `notifications/initialized` notification after
    // the initialize response. No id → no response expected.
    this.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  }

  private spawn(): void {
    if (this.child) return;
    const child = spawn('node', [this.opts.serverEntry], {
      cwd: this.opts.cwd,
      // Don't inherit the full backend env into untrusted solution
      // code. `sanitizeEnvForSolutionSubprocess` keeps PATH/HOME/etc.
      // and strips credentials like CCAAS_API_KEY, LLM keys, and DB
      // paths. Solution-provided env (this.opts.env) layers on top.
      env: {
        ...sanitizeEnvForSolutionSubprocess(process.env),
        ...(this.opts.env ?? {}),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.child = child;
    child.stdout!.setEncoding('utf8');
    child.stdout!.on('data', (chunk: string) => {
      // Stale data from a disposed child must not leak into a new
      // session's parser buffer. Drop unless this is still the
      // current subprocess.
      if (this.child !== child) return;
      this.onStdout(chunk);
    });
    child.stderr!.on('data', (chunk) => {
      // MCP servers log to stderr — surface at debug level (verbose
      // by design; ops can grep `[stdio-mcp]` to find them).
      this.logger.debug(`[stdio-mcp ${this.namespace}] ${String(chunk).trimEnd()}`);
    });
    child.on('exit', (code, signal) => {
      // If a new subprocess has already been spawned (e.g. via
      // dispose + immediate re-invoke), this exit event is stale —
      // it belongs to the OLD child. We MUST NOT:
      //   - reject pending RPCs (they belong to the new child)
      //   - clear this.buffer (it holds new child's stdout)
      //   - null this.child / this.initPromise (they are new)
      // Treat the stale event as a no-op so the new subprocess can
      // complete its handshake undisturbed.
      const isCurrent = this.child === child;
      if (!isCurrent) {
        this.logger.debug(
          `stdio MCP ${this.namespace} (old child) exited; ignoring (a new subprocess has replaced it)`,
        );
        return;
      }
      this.logger.warn(
        `stdio MCP ${this.namespace} exited (code=${code} signal=${signal}); ` +
        `${this.pending.size} pending RPC(s) will reject`,
      );
      const err = new Error(`stdio MCP ${this.namespace} exited unexpectedly`);
      for (const { reject } of this.pending.values()) reject(err);
      this.pending.clear();
      this.child = null;
      this.initPromise = null;
      this.buffer = '';
    });
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl).trim();
      this.buffer = this.buffer.slice(nl + 1);
      if (!line) continue;
      this.dispatchMessage(line);
    }
  }

  private dispatchMessage(line: string): void {
    let msg: {
      jsonrpc?: string;
      id?: number | string;
      result?: unknown;
      error?: { code: number; message: string };
      method?: string;
    };
    try {
      msg = JSON.parse(line);
    } catch (err) {
      this.logger.warn(
        `stdio MCP ${this.namespace} emitted non-JSON line: ${line.slice(0, 120)}`,
      );
      return;
    }
    // Method calls FROM the server (notifications) — we don't act on
    // them today. Future: log_message, progress, etc.
    if (msg.method && msg.id === undefined) return;
    if (typeof msg.id !== 'number') return;
    const pending = this.pending.get(msg.id);
    if (!pending) return;
    this.pending.delete(msg.id);
    if (msg.error) {
      pending.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
    } else {
      pending.resolve(msg.result);
    }
  }

  private async rpc(method: string, params: unknown): Promise<unknown> {
    if (!this.child || !this.child.stdin || this.child.stdin.destroyed) {
      throw new Error(`stdio MCP ${this.namespace} subprocess not running`);
    }
    const id = this.nextRpcId++;
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.child || !this.child.stdin || this.child.stdin.destroyed) return;
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  /**
   * Stop the subprocess cleanly. Safe to call multiple times.
   *
   * Awaits the captured child's actual `exit` event before resolving
   * so callers that follow with an immediate respawn don't race the
   * dispose teardown. The previous fire-and-forget design left a
   * SIGKILL timer hanging that could fire AFTER the new child was
   * spawned — under PID reuse, that timer could in principle kill a
   * recycled PID. We clear the timer on exit to make that
   * impossible.
   */
  async dispose(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.child = null;
    this.initPromise = null;
    for (const { reject } of this.pending.values()) {
      reject(new Error(`stdio MCP ${this.namespace} disposed`));
    }
    this.pending.clear();
    if (child.exitCode !== null || child.signalCode !== null) {
      return; // already gone — nothing to wait for
    }
    return new Promise<void>((resolve) => {
      const killTimer = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
        }
      }, 1000);
      killTimer.unref();
      child.once('exit', () => {
        clearTimeout(killTimer);
        resolve();
      });
      child.kill('SIGTERM');
    });
  }
}

function contentToString(content: Array<{ type: 'text'; text: string }> | undefined): string {
  if (!content || content.length === 0) return '';
  return content
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('\n');
}

/**
 * Variables that MUST be propagated for a Node subprocess to even
 * start (path resolution, home dir for caches, terminal handling,
 * Node module resolution overrides set by the test runner).
 *
 * Anything not on this list is dropped. Solution stdio MCP servers
 * are untrusted code from a third party; they should never see
 * `CCAAS_API_KEY`, LLM provider keys, `DATABASE_PATH`, cloud creds,
 * etc. Solution-specific env can be re-added via `StdioMcpToolkitOptions.env`.
 */
const SOLUTION_SUBPROCESS_ENV_ALLOWLIST = new Set([
  'PATH',
  'HOME',
  'USER',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
  'TZ',
  'TMPDIR',
  'NODE_PATH',
  'NODE_OPTIONS',
  'NODE_ENV',
  'NVM_BIN',
  'NVM_DIR',
]);

export function sanitizeEnvForSolutionSubprocess(
  env: NodeJS.ProcessEnv,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) continue;
    if (SOLUTION_SUBPROCESS_ENV_ALLOWLIST.has(k)) {
      out[k] = v;
    }
  }
  return out;
}
