#!/usr/bin/env node
/**
 * just-bash MCP server — sandboxed shell tool for ccaas backend.
 *
 * Spawned by CliProcessService per claude session via `--mcp-config`,
 * exposes a single `bash` tool backed by `just-bash` with a
 * `ReadWriteFs` rooted at the session workspace path (which for
 * `WORKSPACE_PROVIDER=agentfs` is the agentfs FUSE/NFS mount, so the
 * sandbox stacks: just-bash interpreter + agentfs FS isolation).
 *
 * Ported from `packages/vfs-poc/src/just-bash-mcp/server.ts`.
 * V2 validation (docs/VALIDATION_REPORT.md round 3) confirmed claude
 * routes Bash through this MCP when `--disallowed-tools Bash` is set
 * and system prompt steers it.
 *
 * Env (set by CliProcessService when spawning):
 *   CCAAS_SANDBOX_ROOT     absolute path of session workspace (required)
 *   CCAAS_SESSION_ID       informational; tagged in logs
 *   CCAAS_SANDBOX_MCP_LOG  optional file path to tee tool calls (for debug)
 *
 * Shipped as `.mjs` so it can `import` ESM-only `just-bash` regardless
 * of backend's CJS compile target. Marked ESM by ../package.json's
 * `"type": "module"`. Compiled-output: nest-cli `assets` copies as-is
 * into `dist/sessions/sandbox/just-bash-mcp/`.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Bash, ReadWriteFs } from 'just-bash';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const root = process.env.CCAAS_SANDBOX_ROOT;
const sessionId = process.env.CCAAS_SESSION_ID ?? 'unknown';
const logFile = process.env.CCAAS_SANDBOX_MCP_LOG;

if (!root) {
  console.error('[ccaas-bash-mcp] missing CCAAS_SANDBOX_ROOT');
  process.exit(1);
}

function trace(msg) {
  if (!logFile) return;
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(logFile, `${new Date().toISOString()} [${sessionId}] ${msg}\n`);
  } catch {}
}

const fs = new ReadWriteFs({ root });
const bash = new Bash({ fs, cwd: '/' });

trace(`server starting root=${root}`);

const server = new Server(
  { name: 'ccaas-bash', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'bash',
      description:
        'Run a bash command inside a sandboxed just-bash interpreter. ' +
        'Filesystem is rooted at the session workspace; the command CANNOT ' +
        'escape to host bash or read host files. Returns stdout, stderr, ' +
        'exitCode. Use this for ALL shell commands in this session — the ' +
        "built-in Bash tool has been disabled. Input schema matches " +
        "claude's native Bash tool ({command, cwd?}) so behavior is the same.",
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Bash command to execute' },
          cwd: {
            type: 'string',
            description: 'Optional cwd inside the sandbox (defaults to /)',
          },
        },
        required: ['command'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== 'bash') {
    return {
      isError: true,
      content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }],
    };
  }
  const args = req.params.arguments ?? {};
  if (typeof args.command !== 'string') {
    return {
      isError: true,
      content: [{ type: 'text', text: 'command must be a string' }],
    };
  }

  trace(`exec cwd=${args.cwd ?? '/'} cmd=${truncate(args.command, 200)}`);

  try {
    const result = await bash.exec(
      args.command,
      args.cwd ? { cwd: args.cwd } : {},
    );
    const body = JSON.stringify(
      {
        executor: 'just-bash@sandbox',
        sessionId,
        root,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      },
      null,
      2,
    );
    trace(`exec done exit=${result.exitCode}`);
    return { content: [{ type: 'text', text: body }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    trace(`exec error ${msg}`);
    return {
      isError: true,
      content: [{ type: 'text', text: `just-bash error: ${msg}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
trace('server connected');

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
