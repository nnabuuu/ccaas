#!/usr/bin/env node
/**
 * ToolCaller proxy MCP server.
 *
 * Claude Code spawns this binary as a regular stdio MCP server. From
 * Claude Code's perspective the binary exposes the full set of tools
 * that the session's solutionId has registered with ccaas-core's
 * SolutionToolkitRegistry. Internally, this process forwards every
 * tools/call back to ccaas-core over loopback HTTP, where the
 * ToolCallerProxy pipeline runs (reserved-field strip, validation,
 * audit, dispatch).
 *
 * The proxy server is intentionally tiny — it's a transport adapter,
 * not a place where business logic lives. All identity, all
 * permission checks, all validation happens on the ccaas-core side.
 *
 * Required env vars (set by McpEngineAdapter when spawning):
 *   CCAAS_PROXY_BACKEND_URL   — base URL to reach ccaas-core (e.g. http://localhost:3001)
 *   CCAAS_PROXY_SESSION_ID    — the session this proxy serves
 *   CCAAS_PROXY_SESSION_TOKEN — per-session shared secret (header X-Proxy-Token)
 *
 * Optional:
 *   CCAAS_PROXY_DEBUG=1       — verbose logging to stderr
 *
 * Wire protocol (HTTP loopback to ccaas-core):
 *   GET  /api/v1/internal/tool-caller/sessions/:id/tools
 *        → { tools: Array<{name, description, inputSchema}> }
 *   POST /api/v1/internal/tool-caller/sessions/:id/invoke
 *        body: { tool: string, args: Record<string, unknown> }
 *        → { ok: true, content: [...] }
 *        | { ok: false, code: string, reason: string }
 *
 * The wire shape mirrors `ToolResult` from
 * packages/backend/src/tool-caller/types.ts. Diverging it makes the
 * proxy server's translation harder; keep the two locked.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';

const BACKEND_URL = required('CCAAS_PROXY_BACKEND_URL');
const SESSION_ID = required('CCAAS_PROXY_SESSION_ID');
const SESSION_TOKEN = required('CCAAS_PROXY_SESSION_TOKEN');
const DEBUG = process.env.CCAAS_PROXY_DEBUG === '1';

// Hard deadlines for the two callbacks. Node's `fetch` has no
// default timeout — a tool handler that hangs (a stuck stdio MCP
// server, a deadlocked DB call) would otherwise lock Claude Code
// indefinitely. The bundle still returns a structured isError to
// the agent so the conversation can continue.
const TOOLS_LIST_TIMEOUT_MS = numEnv('CCAAS_PROXY_TOOLS_TIMEOUT_MS', 30_000);
const INVOKE_TIMEOUT_MS = numEnv('CCAAS_PROXY_INVOKE_TIMEOUT_MS', 120_000);

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    // stderr only — stdout is reserved for MCP protocol bytes.
    process.stderr.write(
      `[tool-caller-proxy-server] FATAL: missing env var ${name}\n`,
    );
    process.exit(2);
  }
  return v;
}

function dlog(msg: string): void {
  if (DEBUG) {
    process.stderr.write(`[tool-caller-proxy-server] ${msg}\n`);
  }
}

const sessionPath = `/api/v1/internal/tool-caller/sessions/${encodeURIComponent(SESSION_ID)}`;

/**
 * Fetch the tool list from ccaas-core. Called once at startup AND
 * whenever Claude Code re-requests tools/list (rare, but the SDK
 * allows it). Errors propagate to Claude Code as MCP errors so the
 * subprocess fails loud rather than serving zero tools silently.
 */
async function fetchToolList(): Promise<Tool[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TOOLS_LIST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${sessionPath}/tools`, {
      method: 'GET',
      headers: {
        'X-Proxy-Token': SESSION_TOKEN,
        Accept: 'application/json',
      },
      signal: ctrl.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error(
        `ccaas-core tool list timed out after ${TOOLS_LIST_TIMEOUT_MS}ms`,
      );
    }
    throw err;
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) {
    throw new Error(
      `ccaas-core tool list failed: ${res.status} ${await safeBody(res)}`,
    );
  }
  const body = (await res.json()) as {
    tools?: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>;
  };
  if (!Array.isArray(body.tools)) {
    throw new Error('ccaas-core /tools returned non-array tools field');
  }
  // MCP's Tool type expects inputSchema as a JSON Schema object. The
  // backend hands us exactly that shape; cast through unknown for the
  // SDK's narrower JSONSchema7 type which we don't import here to
  // avoid a transitive dep.
  return body.tools.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema as Tool['inputSchema'],
  }));
}

/**
 * Forward a tool call to ccaas-core. The response shape mirrors
 * ToolResult — success carries MCP content blocks, failure carries
 * a natural-language reason that the agent can surface to the user.
 *
 * Network / protocol errors are reflected as MCP `isError: true`
 * results so the agent sees a structured failure rather than the
 * subprocess crashing.
 */
async function invokeTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  dlog(`invoke tool=${name}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), INVOKE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${sessionPath}/invoke`, {
      method: 'POST',
      headers: {
        'X-Proxy-Token': SESSION_TOKEN,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ tool: name, args }),
      signal: ctrl.signal,
    });
  } catch (err) {
    const aborted = (err as Error).name === 'AbortError';
    const msg = aborted
      ? `tool call exceeded ${INVOKE_TIMEOUT_MS}ms deadline`
      : err instanceof Error
        ? err.message
        : String(err);
    dlog(`invoke transport error: ${msg}`);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `ToolCallerProxy transport error: ${msg}`,
        },
      ],
    };
  } finally {
    clearTimeout(t);
  }

  if (!res.ok) {
    const body = await safeBody(res);
    dlog(`invoke http ${res.status}: ${body}`);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `ToolCallerProxy returned HTTP ${res.status}: ${body}`,
        },
      ],
    };
  }

  // ToolResult discriminated union — same shape as the backend type.
  const result = (await res.json()) as
    | {
        ok: true;
        content: Array<{ type: 'text'; text: string }>;
      }
    | {
        ok: false;
        code: string;
        reason: string;
      };

  if (result.ok) {
    return { content: result.content };
  }
  // Failure paths (validation/permission/not_found/handler_error) all
  // come back as MCP `isError: true` with a single natural-language
  // text content. This is the design's "structured failures the agent
  // can relay" — never an exception.
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `${result.code}: ${result.reason}`,
      },
    ],
  };
}

async function safeBody(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 500);
  } catch {
    return '<unreadable>';
  }
}

async function main() {
  dlog(`starting for session ${SESSION_ID} → ${BACKEND_URL}`);

  // Eagerly fetch the tool list once so a startup failure surfaces
  // before Claude Code asks (so the operator sees the error inside
  // the same log line as the proxy spawn).
  let toolListCache: Tool[];
  try {
    toolListCache = await fetchToolList();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[tool-caller-proxy-server] FATAL: initial tool list fetch failed: ${msg}\n`,
    );
    process.exit(3);
  }
  dlog(`loaded ${toolListCache.length} tool(s)`);

  const server = new Server(
    { name: 'tool-caller-proxy-server', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolListCache,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return invokeTool(name, (args ?? {}) as Record<string, unknown>);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  dlog('connected; awaiting requests');

  // Graceful shutdown so Claude Code can clean up.
  const shutdown = () => {
    dlog('signal received; exiting');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`[tool-caller-proxy-server] FATAL: ${msg}\n`);
  process.exit(1);
});
