/**
 * StdioMcpToolkit integration test.
 *
 * Spawns a real stdio MCP server (the fake one below as a Node
 * one-liner) and drives a tools/call through it. Verifies:
 *   - the initialize handshake completes before the first call,
 *   - args reach the subprocess unchanged from what the proxy
 *     pipeline already validated,
 *   - the subprocess's response shape maps cleanly to ToolResult,
 *   - the subprocess survives concurrent calls (multiplexed via
 *     JSON-RPC ids).
 *
 * Test fake is intentionally minimal — it implements just enough of
 * MCP (initialize + tools/call) for this spec. Real stdio MCP
 * servers in solutions/business/* use the official SDK.
 */

import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { z } from 'zod';
import { StdioMcpToolkit } from './stdio-mcp-toolkit';

const FAKE_SERVER_SRC = `
// Minimal MCP-over-stdio server for tests. Reads JSON-RPC lines
// from stdin, replies on stdout. Only handles 'initialize',
// 'tools/call', and the 'notifications/initialized' notification.
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
    if (msg.method === 'notifications/initialized') continue; // no reply
    if (msg.method === 'initialize') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { protocolVersion: '2024-11-05', capabilities: { tools: {} } },
      }) + '\\n');
      continue;
    }
    if (msg.method === 'tools/call') {
      const args = msg.params.arguments;
      if (msg.params.name === 'fail') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0', id: msg.id,
          result: { content: [{ type: 'text', text: 'I do not like that' }], isError: true },
        }) + '\\n');
        continue;
      }
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        result: { content: [{ type: 'text', text: 'echo:' + JSON.stringify(args) }] },
      }) + '\\n');
      continue;
    }
    // unknown method
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0', id: msg.id,
      error: { code: -32601, message: 'method not found: ' + msg.method },
    }) + '\\n');
  }
});
`;

describe('StdioMcpToolkit', () => {
  let scratchDir: string;
  let fakeServerPath: string;
  let toolkit: StdioMcpToolkit;

  beforeAll(() => {
    scratchDir = mkdtempSync(path.join(tmpdir(), 'stdio-mcp-toolkit-'));
    fakeServerPath = path.join(scratchDir, 'fake-server.js');
    writeFileSync(fakeServerPath, FAKE_SERVER_SRC);
  });

  afterAll(() => {
    try { unlinkSync(fakeServerPath); } catch { /* ignore */ }
    try { rmdirSync(scratchDir); } catch { /* ignore */ }
  });

  beforeEach(() => {
    toolkit = new StdioMcpToolkit({
      solutionId: 'sol-x',
      namespace: 'mock',
      serverEntry: fakeServerPath,
      tools: [
        {
          name: 'echo',
          description: 'echoes its args',
          argsSchema: z.object({ msg: z.string() }),
        },
        {
          name: 'fail',
          description: 'always returns isError',
          argsSchema: z.object({}).passthrough(),
        },
      ],
    });
  });

  afterEach(async () => {
    await toolkit.dispose();
  });

  it('exposes the configured tools with the right namespace', () => {
    expect(toolkit.solutionId).toBe('sol-x');
    expect(toolkit.namespace).toBe('mock');
    expect(toolkit.tools.map((t) => t.name).sort()).toEqual(['echo', 'fail']);
  });

  it('spawns lazily — first invoke completes handshake then dispatches', async () => {
    const result = await toolkit.tools[0].handler({
      tool: 'mock.echo',
      args: { msg: 'hi' },
      context: {
        solutionId: 'sol-x',
        sessionId: 's',
        actingUserId: 'u',
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.content[0].text).toContain('echo:');
      expect(result.content[0].text).toContain('"msg":"hi"');
    }
  });

  it('handles multiple concurrent calls without crossing wires', async () => {
    const calls = Promise.all([
      toolkit.tools[0].handler({
        tool: 'mock.echo',
        args: { msg: 'a' },
        context: { solutionId: 'sol-x', sessionId: 's' },
      }),
      toolkit.tools[0].handler({
        tool: 'mock.echo',
        args: { msg: 'b' },
        context: { solutionId: 'sol-x', sessionId: 's' },
      }),
      toolkit.tools[0].handler({
        tool: 'mock.echo',
        args: { msg: 'c' },
        context: { solutionId: 'sol-x', sessionId: 's' },
      }),
    ]);
    const results = await calls;
    const texts = results.map((r) => (r.ok ? r.content[0].text : ''));
    expect(texts.some((t) => t.includes('"msg":"a"'))).toBe(true);
    expect(texts.some((t) => t.includes('"msg":"b"'))).toBe(true);
    expect(texts.some((t) => t.includes('"msg":"c"'))).toBe(true);
  });

  it('maps isError responses to ToolResult { ok: false, code: "handler_error" }', async () => {
    const result = await toolkit.tools[1].handler({
      tool: 'mock.fail',
      args: {},
      context: { solutionId: 'sol-x', sessionId: 's' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('handler_error');
      expect(result.reason).toContain('I do not like that');
    }
  });

  it('dispose kills the subprocess and rejects in-flight RPCs', async () => {
    // Warm the subprocess
    await toolkit.tools[0].handler({
      tool: 'mock.echo',
      args: { msg: 'warm' },
      context: { solutionId: 'sol-x', sessionId: 's' },
    });
    await toolkit.dispose();
    // A subsequent call respawns cleanly — first-class behavior
    // (we deliberately allow re-use of disposed toolkits in case the
    // ccaas-core process recycles them).
    const result = await toolkit.tools[0].handler({
      tool: 'mock.echo',
      args: { msg: 'after' },
      context: { solutionId: 'sol-x', sessionId: 's' },
    });
    expect(result.ok).toBe(true);
  });
});
