/**
 * InternalToolCallerController tests.
 *
 * Two security gates under test:
 *   1. Loopback-only — non-127.0.0.1/::1 peers get 403, regardless of token.
 *   2. Token auth — bad/missing token gets 401, regardless of source.
 *
 * Then the happy paths: tools/list returns canonical JSON Schemas;
 * invoke flows through the ToolCallerProxy pipeline (so identity is
 * read from the registered ExecutionContext, never request body).
 */

import {
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { InternalToolCallerController } from './internal-tool-caller.controller';
import { SolutionToolkitRegistry } from './solution-toolkit-registry';
import { ToolCallerProxyService } from './tool-caller-proxy.service';
import { McpEngineAdapterService } from './adapters/mcp-engine-adapter.service';
import type { ManagedSession } from '../common/interfaces/session.interface';

const SOL = 'sol-test';
const SESSION = 's1';

function loopbackReq(addr = '127.0.0.1'): Request {
  return {
    socket: { remoteAddress: addr },
  } as unknown as Request;
}

function makeSession(): ManagedSession {
  return {
    sessionId: SESSION,
    clientId: 'c',
    solutionId: SOL,
    actingUserId: 'teacher-42',
    cliProcess: null,
    stdin: null,
    socket: null,
    lastActivity: new Date(),
    status: 'idle',
    createdAt: new Date(),
    messageCount: 0,
    buffer: '',
    workspaceDir: '/tmp',
  } as unknown as ManagedSession;
}

describe('InternalToolCallerController', () => {
  let registry: SolutionToolkitRegistry;
  let proxy: ToolCallerProxyService;
  let adapter: McpEngineAdapterService;
  let controller: InternalToolCallerController;
  let token: string;

  beforeEach(() => {
    registry = new SolutionToolkitRegistry();
    proxy = new ToolCallerProxyService(registry);
    adapter = new McpEngineAdapterService(registry);
    controller = new InternalToolCallerController(registry, proxy, adapter);

    registry.registerToolkit({
      solutionId: SOL,
      namespace: 'lp',
      tools: [
        {
          name: 'echo',
          description: 'echo input',
          argsSchema: z.object({ q: z.string() }),
          handler: async (inv) => ({
            ok: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  q: (inv.args as { q: string }).q,
                  actingUserId: inv.context.actingUserId,
                }),
              },
            ],
          }),
        },
      ],
    });
    token = adapter.registerSession(makeSession()).token;
  });

  describe('loopback gate', () => {
    it.each(['10.0.0.1', '192.168.1.5', '8.8.8.8', '::ffff:8.8.8.8'])(
      'rejects %s with 403',
      async (peer) => {
        await expect(
          controller.listTools(SESSION, token, loopbackReq(peer)),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it.each(['127.0.0.1', '::1', '::ffff:127.0.0.1'])(
      'accepts %s when token is valid',
      async (peer) => {
        const r = await controller.listTools(SESSION, token, loopbackReq(peer));
        expect(r.tools.length).toBeGreaterThan(0);
      },
    );
  });

  describe('token auth', () => {
    it('rejects missing token with 401', async () => {
      await expect(
        controller.listTools(SESSION, undefined, loopbackReq()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects wrong token with 401', async () => {
      await expect(
        controller.listTools(SESSION, 'forged', loopbackReq()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects right token for wrong session with 401 (no enumeration)', async () => {
      adapter.registerSession({
        ...makeSession(),
        sessionId: 'other',
      } as ManagedSession);
      await expect(
        controller.listTools('other', token, loopbackReq()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('GET /tools', () => {
    it('returns the registry tools with JSON Schema converted from Zod', async () => {
      const r = await controller.listTools(SESSION, token, loopbackReq());
      expect(r.tools).toHaveLength(1);
      expect(r.tools[0].name).toBe('lp.echo');
      expect(r.tools[0].description).toBe('echo input');
      // Cast through unknown because zod-to-json-schema's emitted
      // type is opaque to the test (matches the controller's escape
      // hatch).
      const schema = r.tools[0].inputSchema as {
        type?: string;
        properties?: Record<string, unknown>;
        required?: string[];
      };
      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('q');
      expect(schema.required).toContain('q');
    });

    it('after releaseSession, tools list returns 401 (no enumeration of stale state)', async () => {
      adapter.releaseSession(SESSION);
      await expect(
        controller.listTools(SESSION, token, loopbackReq()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('POST /invoke', () => {
    it('runs the proxy pipeline — handler sees ctx.actingUserId, not args', async () => {
      const r = await controller.invoke(
        SESSION,
        {
          tool: 'lp.echo',
          args: { q: 'hello', userId: 'attacker' } as Record<string, unknown>,
        },
        token,
        loopbackReq(),
      );
      expect(r.ok).toBe(true);
      if (r.ok) {
        const body = JSON.parse(r.content[0].text);
        expect(body.q).toBe('hello');
        expect(body.actingUserId).toBe('teacher-42'); // ambient, not 'attacker'
      }
    });

    it('returns validation_failed for bad args (no throw)', async () => {
      const r = await controller.invoke(
        SESSION,
        { tool: 'lp.echo', args: { q: 12345 } as Record<string, unknown> },
        token,
        loopbackReq(),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('validation_failed');
      }
    });

    it('returns tool_not_found for unknown tool name', async () => {
      const r = await controller.invoke(
        SESSION,
        { tool: 'nope.x', args: {} },
        token,
        loopbackReq(),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('tool_not_found');
      }
    });

    it('returns validation_failed for malformed body (missing tool)', async () => {
      const r = await controller.invoke(
        SESSION,
        {} as { tool?: string; args?: Record<string, unknown> },
        token,
        loopbackReq(),
      );
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.code).toBe('validation_failed');
      }
    });
  });
});
