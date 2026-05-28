/**
 * MCP engine adapter.
 *
 * Implements the design doc's "engine adapter" role for the Claude
 * Code engine (which speaks MCP). The adapter doesn't spawn Claude
 * Code itself — that's still `CliProcessService`'s job — but it
 * tells `CliProcessService` to point Claude Code at our proxy MCP
 * bundle instead of the solution's stdio MCP server.
 *
 * Wiring at a glance:
 *
 *   ccaas-core               proxy bundle                Claude Code
 *   ────────────             ────────────                ───────────
 *   McpEngineAdapter         /api/v1/internal/...        --mcp-config
 *     .registerSession()  ←  HTTP loopback        ←      (subprocess)
 *     .buildProxyEntry()  ───────────────────────→      spawns proxy
 *     .releaseSession()
 *
 * Reference: docs/design-tool-caller-proxy.md §5.1.
 */

import { randomBytes } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import type { ExecutionContext } from '../types';
import type { ManagedSession, McpServerConfig } from '../../common/interfaces/session.interface';
import { SolutionToolkitRegistry } from '../solution-toolkit-registry';

/**
 * Per-session registration state, indexed by sessionId. Cleared in
 * `releaseSession` so a misbehaving caller can't accumulate dangling
 * secrets across the process's lifetime.
 */
interface SessionRegistration {
  sessionId: string;
  /**
   * Random per-session shared secret. Sent to the proxy subprocess
   * via env var; included in every callback to ccaas-core via
   * `X-Proxy-Token` header. Constant-time compared in
   * `validateToken`. New session = new token; never reused.
   */
  token: string;
  /** Immutable ExecutionContext used for every invoke from this session. */
  context: ExecutionContext;
  createdAt: number;
}

@Injectable()
export class McpEngineAdapterService {
  readonly engineId = 'claude-code-mcp';
  private readonly logger = new Logger(McpEngineAdapterService.name);
  private readonly sessions = new Map<string, SessionRegistration>();

  constructor(private readonly registry: SolutionToolkitRegistry) {}

  /**
   * Whether a session should be proxied. Returns true when the
   * solution has at least one toolkit registered AND the session
   * carries enough identity to build an `ExecutionContext`.
   *
   * Phase 3 ships this off-by-default at the call site (gate flag in
   * Phase 4). Even with the gate on, this method gives the adapter a
   * second say: a session whose solution registered no toolkits has
   * nothing for the proxy to expose, so we skip the route.
   */
  shouldProxy(session: ManagedSession): boolean {
    if (!session.solutionId || !session.sessionId) return false;
    return this.registry.listToolsForSolution(session.solutionId).length > 0;
  }

  /**
   * Register a session with the adapter. Allocates a secret token,
   * captures the ExecutionContext that every tool call from this
   * session will run under. Subsequent `validateToken` /
   * `getContext` lookups resolve against this entry.
   *
   * Idempotent per sessionId: a second call returns the existing
   * registration (so reused sessions reuse their token).
   */
  registerSession(session: ManagedSession): SessionRegistration {
    const existing = this.sessions.get(session.sessionId);
    if (existing) return existing;

    if (!session.solutionId) {
      // Programming error — `shouldProxy` was supposed to catch this.
      throw new Error(
        `McpEngineAdapter.registerSession: session ${session.sessionId} has no solutionId`,
      );
    }

    const context: ExecutionContext = {
      solutionId: session.solutionId,
      sessionId: session.sessionId,
      actingUserId: session.actingUserId,
      actingRole: session.actingRole,
      apiKeyId: session.apiKeyId,
    };
    const registration: SessionRegistration = {
      sessionId: session.sessionId,
      token: randomBytes(32).toString('base64url'),
      context,
      createdAt: Date.now(),
    };
    this.sessions.set(session.sessionId, registration);
    this.logger.debug(
      `Registered proxy session ${session.sessionId} (solutionId=${context.solutionId}, ` +
      `actingUserId=${context.actingUserId ?? 'none'})`,
    );
    return registration;
  }

  /**
   * Build the `mcpServers` entry that points Claude Code at the
   * proxy bundle for this session. CliProcessService merges this
   * into the existing `--mcp-config` JSON.
   */
  buildProxyEntry(session: ManagedSession): { name: string; config: McpServerConfig } {
    const registration = this.registerSession(session);
    const binPath = resolveProxyBinPath();
    return {
      name: 'tool-caller-proxy',
      config: {
        command: 'node',
        args: [binPath],
        description:
          'ccaas ToolCallerProxy MCP bundle — routes tool calls through ' +
          'the platform pipeline (sanitization + audit + dispatch).',
        env: {
          CCAAS_PROXY_BACKEND_URL: this.backendUrl(),
          CCAAS_PROXY_SESSION_ID: session.sessionId,
          CCAAS_PROXY_SESSION_TOKEN: registration.token,
        },
      },
    };
  }

  /** Token check used by `InternalToolCallerController`. */
  validateToken(sessionId: string, token: string | undefined): boolean {
    if (!token) return false;
    const reg = this.sessions.get(sessionId);
    if (!reg) return false;
    return constantTimeEqual(reg.token, token);
  }

  /** Resolves the ExecutionContext for a session id. */
  getContext(sessionId: string): ExecutionContext | null {
    return this.sessions.get(sessionId)?.context ?? null;
  }

  /** Drop a session's registration; call from `SessionService.cleanup`. */
  releaseSession(sessionId: string): void {
    if (this.sessions.delete(sessionId)) {
      this.logger.debug(`Released proxy session ${sessionId}`);
    }
  }

  /** Test helper. */
  reset(): void {
    this.sessions.clear();
  }

  private backendUrl(): string {
    // The proxy subprocess runs on the same host as ccaas-core. Build
    // the loopback URL once at registration time so each session
    // captures whatever PORT is current. (PORT changes mid-process
    // are not a real scenario.)
    const port = process.env.PORT ?? '3001';
    return `http://127.0.0.1:${port}`;
  }
}

/**
 * Constant-time string comparison. Reject early when lengths differ
 * (this leaks length, which is acceptable — both tokens are
 * fixed-size base64url, so length never reveals user data). All
 * inputs are ASCII so `charCodeAt` is safe.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Locate the proxy bundle's compiled entry point.
 *
 * Preference order:
 *   1. `CCAAS_PROXY_BUNDLE_PATH` env var (operator override + testing)
 *   2. `<repoRoot>/packages/mcp/tool-caller-proxy-server/dist/index.js`
 *      computed from this file's location at runtime
 *
 * The result is cached after first successful resolution because the
 * filesystem isn't going anywhere mid-process.
 */
let cachedProxyBin: string | undefined;
function resolveProxyBinPath(): string {
  if (cachedProxyBin) return cachedProxyBin;
  const override = process.env.CCAAS_PROXY_BUNDLE_PATH;
  if (override && fs.existsSync(override)) {
    cachedProxyBin = override;
    return override;
  }
  // __dirname is .../packages/backend/(src|dist)/tool-caller/adapters
  // The bundle lives at .../packages/mcp/tool-caller-proxy-server/dist/index.js
  const candidates = [
    path.resolve(__dirname, '../../../../mcp/tool-caller-proxy-server/dist/index.js'),
    path.resolve(__dirname, '../../../../../mcp/tool-caller-proxy-server/dist/index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      cachedProxyBin = c;
      return c;
    }
  }
  throw new Error(
    `tool-caller-proxy-server bundle not found. Set CCAAS_PROXY_BUNDLE_PATH or build ` +
    `packages/mcp/tool-caller-proxy-server (npm run build). Tried: ${candidates.join(', ')}`,
  );
}
