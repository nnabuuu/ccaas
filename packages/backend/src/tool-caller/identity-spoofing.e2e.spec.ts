/**
 * End-to-end identity-spoofing security probe.
 *
 * Wires the full Phase 3+4 chain in one Jest spec — no Nest module,
 * no Claude Code subprocess, no HTTP server, but every other layer
 * is real:
 *
 *   StdioMcpToolkit (real subprocess) ←
 *     SolutionToolkitRegistry          ←
 *       ToolCallerProxyService          ←
 *         InternalToolCallerController  ← simulated proxy bundle
 *
 * The probe pushes the worst-case agent payload at the controller
 * (every ExecutionContext field stuffed into args) and asserts:
 *   1. The stdio handler observes only safe args + the session's
 *      actingUserId (ambient identity wins).
 *   2. The audit sink records every stripped field by name.
 *   3. The result is a structured `{ok: true}` — never a crash.
 *
 * If this spec fails, the security argument in
 * docs/design-tool-caller-proxy.md §7 has regressed.
 */

import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import type { Request } from 'express';
import { ToolCallerProxyService } from './tool-caller-proxy.service';
import { SolutionToolkitRegistry } from './solution-toolkit-registry';
import { McpEngineAdapterService } from './adapters/mcp-engine-adapter.service';
import { InternalToolCallerController } from './internal-tool-caller.controller';
import { StdioMcpToolkit } from './toolkits/stdio-mcp-toolkit';
import type { ToolCallAuditEntry } from './types';
import type { ManagedSession } from '../common/interfaces/session.interface';

const REAL_USER = 'teacher-42';
const SESSION = 'sess-e2e';
const SOL = 'sol-e2e';

// Minimal stdio MCP server that echoes the args back as JSON text.
// The agent never spawns this directly — the proxy chain does.
const ECHO_SERVER_SRC = `
process.stdin.setEncoding('utf8');
let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.method === 'notifications/initialized') continue;
    if (msg.method === 'initialize') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        result: { protocolVersion: '2024-11-05', capabilities: { tools: {} } },
      }) + '\\n');
      continue;
    }
    if (msg.method === 'tools/call') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        result: { content: [{ type: 'text', text: JSON.stringify(msg.params.arguments) }] },
      }) + '\\n');
      continue;
    }
  }
});
`;

function loopbackReq(): Request {
  return { socket: { remoteAddress: '127.0.0.1' } } as unknown as Request;
}

function makeSession(): ManagedSession {
  return {
    sessionId: SESSION,
    clientId: 'c',
    solutionId: SOL,
    actingUserId: REAL_USER,
    actingRole: 'teacher',
    apiKeyId: 'key-1',
    cliProcess: null,
    stdin: null,
    socket: null,
    lastActivity: new Date(),
    status: 'idle',
    createdAt: new Date(),
    messageCount: 0,
    buffer: '',
    workspaceDir: '/tmp/x',
  } as unknown as ManagedSession;
}

describe('identity-spoofing end-to-end', () => {
  let scratchDir: string;
  let echoServerPath: string;
  let registry: SolutionToolkitRegistry;
  let proxy: ToolCallerProxyService;
  let adapter: McpEngineAdapterService;
  let controller: InternalToolCallerController;
  let toolkit: StdioMcpToolkit;
  let auditTrail: ToolCallAuditEntry[];
  let token: string;

  beforeAll(() => {
    scratchDir = mkdtempSync(path.join(tmpdir(), 'id-spoof-e2e-'));
    echoServerPath = path.join(scratchDir, 'echo.js');
    writeFileSync(echoServerPath, ECHO_SERVER_SRC);
  });

  afterAll(() => {
    try { unlinkSync(echoServerPath); } catch { /* ignore */ }
    try { rmdirSync(scratchDir); } catch { /* ignore */ }
  });

  beforeEach(() => {
    registry = new SolutionToolkitRegistry();
    proxy = new ToolCallerProxyService(registry);
    adapter = new McpEngineAdapterService(registry);
    controller = new InternalToolCallerController(registry, proxy, adapter);

    auditTrail = [];
    proxy.setAuditSink({ record: (entry) => void auditTrail.push({ ...entry }) });

    toolkit = new StdioMcpToolkit({
      solutionId: SOL,
      namespace: 'creator',
      serverEntry: echoServerPath,
      tools: [
        {
          name: 'emit_todo_card',
          description: 'echoes args back as text',
          // z.unknown() mirrors how the Phase 4 loader registers
          // proxy-enabled stdio servers: defer structural validation
          // to the upstream MCP server, but keep the reserved-field
          // strip in the proxy pipeline.
          argsSchema: z.unknown(),
        },
      ],
    });
    registry.registerToolkit(toolkit);
    token = adapter.registerSession(makeSession()).token;
  });

  afterEach(async () => {
    await toolkit.dispose();
  });

  it('strips every ExecutionContext-shaped field the agent shoves into args', async () => {
    // The agent is the attacker here. It writes EVERY reserved field
    // simultaneously, attempting to forge identity, scope, and key.
    const result = await controller.invoke(
      SESSION,
      {
        tool: 'creator.emit_todo_card',
        args: {
          // legitimate args
          title: 'Tasks',
          items: [{ id: 't1', label: 'Step 1' }],
          // attacker payload
          userId: 'attacker',
          tenantId: 'wrong-tenant',
          sessionId: 'other-session',
          permissions: ['admin:*'],
          context: { forged: true },
          role: 'admin',
          solutionId: 'wrong-solution',
          actingUserId: 'admin-id',
          actingRole: 'district-admin',
          apiKeyId: 'forged-key',
          effectiveScope: 'all',
        } as Record<string, unknown>,
      },
      token,
      loopbackReq(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The stdio echo server returns the args it ACTUALLY saw — proves
    // the strip happened upstream and nothing reserved leaked through.
    const echoed = JSON.parse(result.content[0].text) as Record<string, unknown>;
    expect(echoed).toEqual({
      title: 'Tasks',
      items: [{ id: 't1', label: 'Step 1' }],
    });
    expect(echoed).not.toHaveProperty('userId');
    expect(echoed).not.toHaveProperty('actingUserId');
    expect(echoed).not.toHaveProperty('permissions');
    expect(echoed).not.toHaveProperty('apiKeyId');
    expect(echoed).not.toHaveProperty('solutionId');
  });

  it('records every stripped reserved field in the audit entry', async () => {
    await controller.invoke(
      SESSION,
      {
        tool: 'creator.emit_todo_card',
        args: {
          userId: 'a',
          tenantId: 'b',
          permissions: ['x'],
          sessionId: 'd',
          context: { e: 1 },
          role: 'admin',
          solutionId: 'f',
          actingUserId: 'g',
          actingRole: 'h',
          apiKeyId: 'i',
          effectiveScope: 'all',
        } as Record<string, unknown>,
      },
      token,
      loopbackReq(),
    );

    expect(auditTrail).toHaveLength(1);
    const audit = auditTrail[0];
    expect(audit.actingUserId).toBe(REAL_USER); // ambient, never the attacker's claim
    expect(audit.solutionId).toBe(SOL);
    expect(audit.outcome).toBe('ok');
    expect(audit.tool).toBe('creator.emit_todo_card');
    // Every reserved field name appears in strippedFields.
    expect([...audit.strippedFields].sort()).toEqual(
      [
        'userId',
        'tenantId',
        'permissions',
        'sessionId',
        'context',
        'role',
        'solutionId',
        'actingUserId',
        'actingRole',
        'apiKeyId',
        'effectiveScope',
      ].sort(),
    );
  });

  it('the audit is recorded EVEN when the agent invents a tool name', async () => {
    const r = await controller.invoke(
      SESSION,
      { tool: 'creator.hallucinated', args: { userId: 'attacker' } },
      token,
      loopbackReq(),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe('tool_not_found');
    }
    expect(auditTrail).toHaveLength(1);
    expect(auditTrail[0].outcome).toBe('tool_not_found');
    expect(auditTrail[0].strippedFields).toEqual(['userId']);
    expect(auditTrail[0].actingUserId).toBe(REAL_USER);
  });

  it('exposes the upstream JSON Schema verbatim via /tools (jsonSchemaOverride path)', async () => {
    // The Phase 4 loader uses jsonSchemaOverride to pass the stdio
    // server's exact inputSchema through to the agent. Here we set
    // one explicitly to mirror that wiring.
    registry.clearSolution(SOL);
    const upstreamSchema = {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    };
    registry.registerToolkit({
      solutionId: SOL,
      namespace: 'creator',
      tools: [
        {
          name: 'emit_todo_card',
          description: 'echo',
          argsSchema: z.unknown(),
          jsonSchemaOverride: upstreamSchema,
          handler: async (inv) => ({
            ok: true,
            content: [{ type: 'text', text: JSON.stringify(inv.args) }],
          }),
        },
      ],
    });

    const r = await controller.listTools(SESSION, token, loopbackReq());
    expect(r.tools).toHaveLength(1);
    expect(r.tools[0].inputSchema).toEqual(upstreamSchema);
  });
});
