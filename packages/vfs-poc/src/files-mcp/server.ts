#!/usr/bin/env node
/**
 * Stdio MCP server exposing file-system tools that replicate claude's native
 * Read/Write/Edit/Grep/Glob, but route ALL fs operations through the per-session
 * agentfs mount point — never the host fs.
 *
 * Used by V2 config C2.4 to test the strong reading of spec D1:
 * "just-bash 完全替代 Claude Code 原生 shell" — extended to "claude's
 * native fs tools are also fully replaced". If claude can complete the
 * standard task using ONLY mcp__vfs-poc-files__* + mcp__vfs-poc-bash__bash,
 * the strong reading is achievable.
 *
 * Env: VFS_POC_MOUNT_POINT (required), VFS_POC_SESSION_ID, VFS_POC_MCP_LOG.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  appendFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const mountPoint = process.env.VFS_POC_MOUNT_POINT;
const sessionId = process.env.VFS_POC_SESSION_ID ?? 'unknown';
const logFile = process.env.VFS_POC_MCP_LOG;

if (!mountPoint) {
  console.error('[files-mcp] missing VFS_POC_MOUNT_POINT');
  process.exit(1);
}
const root = resolve(mountPoint);

function trace(msg: string): void {
  if (!logFile) return;
  try {
    mkdirSync(dirname(logFile), { recursive: true });
    appendFileSync(logFile, `${new Date().toISOString()} [${sessionId}] ${msg}\n`);
  } catch {}
}

/** Resolve and reject any path escaping the mount root. */
function safe(rel: string): string {
  const abs = resolve(root, rel.startsWith('/') ? `.${rel}` : rel);
  if (abs !== root && !abs.startsWith(root + sep)) {
    throw new Error(`path escapes mount: ${rel}`);
  }
  return abs;
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}

function globToRegex(glob: string): RegExp {
  // Translate ** and * → regex segments; literal everything else.
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*'; i++; // ** matches anything including /
    } else if (c === '*') {
      re += '[^/]*';
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^$|()[]{}\\'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}

const server = new Server(
  { name: 'vfs-poc-files', version: '0.0.1' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'read',
      description:
        'Read file contents from the session virtual workspace. Path is ' +
        'relative to workspace root (e.g. "src/main.ts"). Replaces claude\'s ' +
        'native Read tool — use this in this session.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path relative to workspace root' } },
        required: ['path'],
      },
    },
    {
      name: 'write',
      description:
        'Create or overwrite a file with the given content. Path relative to ' +
        'workspace root. Creates parent directories as needed. Replaces ' +
        'claude\'s native Write tool — use this in this session.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'edit',
      description:
        'In-place edit: replace exactly one occurrence of `oldText` with ' +
        '`newText` in the file. Throws if `oldText` not found or ambiguous. ' +
        'Replaces claude\'s native Edit tool — use this in this session.',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          oldText: { type: 'string' },
          newText: { type: 'string' },
        },
        required: ['path', 'oldText', 'newText'],
      },
    },
    {
      name: 'grep',
      description:
        'Search for `pattern` (regex) inside files matching `pathGlob` ' +
        '(optional, default all). Returns matching lines as `path:lineno:line`. ' +
        'Replaces claude\'s native Grep tool — use this in this session.',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string' },
          pathGlob: { type: 'string' },
        },
        required: ['pattern'],
      },
    },
    {
      name: 'glob',
      description:
        'List paths in the workspace matching a glob pattern (e.g. ' +
        '"src/**/*.ts"). Replaces claude\'s native Glob tool — use this in this session.',
      inputSchema: {
        type: 'object',
        properties: { pattern: { type: 'string' } },
        required: ['pattern'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  try {
    switch (req.params.name) {
      case 'read': {
        const path = safe(String(args.path));
        const content = readFileSync(path, 'utf8');
        trace(`read ${args.path} (${content.length}B)`);
        return { content: [{ type: 'text', text: content }] };
      }
      case 'write': {
        const path = safe(String(args.path));
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, String(args.content));
        trace(`write ${args.path} (${String(args.content).length}B)`);
        return { content: [{ type: 'text', text: `wrote ${args.path}` }] };
      }
      case 'edit': {
        const path = safe(String(args.path));
        const oldText = String(args.oldText);
        const newText = String(args.newText);
        const body = readFileSync(path, 'utf8');
        const idx = body.indexOf(oldText);
        if (idx === -1) throw new Error(`oldText not found in ${args.path}`);
        if (body.indexOf(oldText, idx + 1) !== -1) {
          throw new Error(`oldText is ambiguous in ${args.path} (>1 occurrences)`);
        }
        writeFileSync(path, body.slice(0, idx) + newText + body.slice(idx + oldText.length));
        trace(`edit ${args.path}`);
        return { content: [{ type: 'text', text: `edited ${args.path}` }] };
      }
      case 'grep': {
        const re = new RegExp(String(args.pattern));
        const glob = typeof args.pathGlob === 'string' ? globToRegex(args.pathGlob) : null;
        const hits: string[] = [];
        for (const f of walk(root)) {
          const rel = relative(root, f);
          if (glob && !glob.test(rel)) continue;
          let body: string;
          try { body = readFileSync(f, 'utf8'); } catch { continue; }
          const lines = body.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i]!)) hits.push(`${rel}:${i + 1}:${lines[i]}`);
          }
        }
        trace(`grep "${args.pattern}" glob=${args.pathGlob ?? '(any)'} → ${hits.length}`);
        return { content: [{ type: 'text', text: hits.join('\n') || '(no matches)' }] };
      }
      case 'glob': {
        const re = globToRegex(String(args.pattern));
        const paths: string[] = [];
        for (const f of walk(root)) {
          const rel = relative(root, f);
          if (re.test(rel)) paths.push(rel);
        }
        trace(`glob "${args.pattern}" → ${paths.length}`);
        return { content: [{ type: 'text', text: paths.join('\n') || '(no matches)' }] };
      }
      default:
        return { isError: true, content: [{ type: 'text', text: `unknown tool ${req.params.name}` }] };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    trace(`error ${req.params.name}: ${msg}`);
    return { isError: true, content: [{ type: 'text', text: `${req.params.name} error: ${msg}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
trace(`server connected mount=${root}`);
