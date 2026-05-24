#!/usr/bin/env node
/**
 * Stdio MCP server exposing a sandboxed `bash` tool, backed by just-bash with
 * a `ReadWriteFs` rooted at the per-session agentfs mount point.
 *
 * Spawned per claude session via `--mcp-config`. Env vars:
 *   VFS_POC_MOUNT_POINT   absolute path of this session's agentfs mount (required)
 *   VFS_POC_SESSION_ID    informational label written into logs (optional)
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

const mountPoint = process.env.VFS_POC_MOUNT_POINT;
const sessionId = process.env.VFS_POC_SESSION_ID ?? 'unknown';
const logFile = process.env.VFS_POC_MCP_LOG;

if (!mountPoint) {
  console.error('[just-bash-mcp] missing VFS_POC_MOUNT_POINT');
  process.exit(1);
}

function trace(msg: string): void {
  if (!logFile) return;
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(logFile, `${new Date().toISOString()} [${sessionId}] ${msg}\n`);
  } catch {}
}

const fs = new ReadWriteFs({ root: mountPoint });
const bash = new Bash({ fs, cwd: '/' });

trace(`server starting mount=${mountPoint}`);

const server = new Server(
  { name: 'vfs-poc-just-bash', version: '0.0.1' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'bash',
      description:
        'Run a bash command inside a sandboxed just-bash interpreter. ' +
        'Filesystem is rooted at the session virtual workspace; cannot ' +
        'escape to the host. Returns stdout, stderr, and exitCode.',
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
    return { isError: true, content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }] };
  }
  const args = (req.params.arguments ?? {}) as { command?: string; cwd?: string };
  if (typeof args.command !== 'string') {
    return { isError: true, content: [{ type: 'text', text: 'command must be a string' }] };
  }

  trace(`exec cwd=${args.cwd ?? '/'} cmd=${truncate(args.command, 200)}`);

  try {
    const result = await bash.exec(args.command, args.cwd ? { cwd: args.cwd } : {});
    const body = JSON.stringify(
      {
        executor: 'just-bash@sandbox',
        sessionId,
        mountPoint,
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

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
