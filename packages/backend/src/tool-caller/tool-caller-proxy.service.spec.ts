/**
 * Proxy-pipeline tests.
 *
 * The contract under test (design doc §5.2):
 *   1. Reserved fields stripped before validation.
 *   2. Zod failure → structured `validation_failed` result (no throw).
 *   3. Unknown tool → `tool_not_found`.
 *   4. Handler receives platform-asserted context, NOT agent args.
 *   5. Handler exceptions captured as `handler_error`.
 *   6. Audit sink invoked on every outcome.
 *
 * The identity-spoofing spec also lives here — it's the single most
 * important property of the proxy, so it gets first-class coverage.
 */

import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { SolutionToolkitRegistry } from './solution-toolkit-registry';
import {
  ToolCallerProxyService,
  type ToolCallAuditSink,
} from './tool-caller-proxy.service';
import type {
  ExecutionContext,
  ToolCallAuditEntry,
  ToolDefinition,
} from './types';

const SOL = 'sol-test';
const SESSION = 'sess-1';
const REAL_USER = 'teacher-42';

function makeCtx(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    solutionId: SOL,
    sessionId: SESSION,
    actingUserId: REAL_USER,
    apiKeyId: 'key-1',
    ...overrides,
  };
}

function makeTool(
  name: string,
  schema: z.ZodTypeAny,
  handler: ToolDefinition['handler'],
): ToolDefinition {
  return { name, description: `t-${name}`, argsSchema: schema, handler };
}

interface RecordedAudit extends ToolCallAuditEntry {}

function captureAuditSink(): { sink: ToolCallAuditSink; entries: RecordedAudit[] } {
  const entries: RecordedAudit[] = [];
  return {
    sink: { record: (e) => void entries.push({ ...e }) },
    entries,
  };
}

describe('ToolCallerProxyService', () => {
  let registry: SolutionToolkitRegistry;
  let proxy: ToolCallerProxyService;

  beforeEach(() => {
    registry = new SolutionToolkitRegistry();
    proxy = new ToolCallerProxyService(registry);
  });

  describe('Step 1 — reserved-field sanitization', () => {
    it('strips identity fields before they reach the handler', async () => {
      let received: Record<string, unknown> | null = null;
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('echo', z.object({ q: z.string() }), async (inv) => {
            received = inv.args;
            return { ok: true, content: [{ type: 'text', text: 'ok' }] };
          }),
        ],
      });

      const result = await proxy.invoke(
        { tool: 'lp.echo', args: { q: 'hi', userId: 'attacker', role: 'admin' } },
        makeCtx(),
      );

      expect(result.ok).toBe(true);
      expect(received).toEqual({ q: 'hi' }); // userId + role stripped before validation
    });

    it('records stripped field names in audit', async () => {
      const { sink, entries } = captureAuditSink();
      proxy.setAuditSink(sink);
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('e', z.object({}).passthrough(), async () => ({
            ok: true,
            content: [{ type: 'text', text: '' }],
          })),
        ],
      });

      await proxy.invoke(
        { tool: 'lp.e', args: { userId: 'x', tenantId: 't', permissions: ['a'] } },
        makeCtx(),
      );

      expect(entries).toHaveLength(1);
      expect(entries[0].strippedFields.slice().sort()).toEqual(
        ['permissions', 'tenantId', 'userId'].sort(),
      );
    });
  });

  describe('Step 2 — validation', () => {
    it('returns validation_failed with natural-language reason (no throw)', async () => {
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('strict', z.object({ n: z.number() }), async () => ({
            ok: true,
            content: [{ type: 'text', text: 'ok' }],
          })),
        ],
      });

      const result = await proxy.invoke(
        { tool: 'lp.strict', args: { n: 'not-a-number' } },
        makeCtx(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('validation_failed');
        expect(result.reason).toMatch(/Invalid arguments/);
        expect(result.reason).toMatch(/n:/);
      }
    });

    it('failed validation prevents handler dispatch', async () => {
      const handler = jest.fn(async () => ({
        ok: true as const,
        content: [{ type: 'text' as const, text: 'unreachable' }],
      }));
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [makeTool('s', z.object({ n: z.number() }), handler)],
      });

      await proxy.invoke({ tool: 'lp.s', args: { n: 'x' } }, makeCtx());
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Step 5 — handler dispatch & exception trap', () => {
    it('captures unexpected throws as handler_error', async () => {
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('boom', z.object({}), async () => {
            throw new Error('kaboom');
          }),
        ],
      });

      const result = await proxy.invoke({ tool: 'lp.boom', args: {} }, makeCtx());
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('handler_error');
        expect(result.reason).toMatch(/kaboom/);
      }
    });
  });

  describe('Unknown tools', () => {
    it('returns tool_not_found without invoking any handler', async () => {
      const result = await proxy.invoke(
        { tool: 'nope.missing', args: {} },
        makeCtx(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('tool_not_found');
      }
    });
  });

  describe('Step 4 — context injection (the security invariant)', () => {
    it('handler sees ctx.actingUserId from session, NEVER from args', async () => {
      let seenCtx: ExecutionContext | null = null;
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool(
            'spy',
            z.object({}).passthrough(), // accept anything for this test
            async (inv) => {
              seenCtx = inv.context;
              return { ok: true, content: [{ type: 'text', text: 'ok' }] };
            },
          ),
        ],
      });

      // The agent tries to claim a different userId via args.
      await proxy.invoke(
        { tool: 'lp.spy', args: { userId: 'attacker-id' } },
        makeCtx({ actingUserId: REAL_USER }),
      );

      expect(seenCtx).not.toBeNull();
      expect(seenCtx!.actingUserId).toBe(REAL_USER);
      // The bogus userId was stripped before validation, so it can't
      // surface as args.userId either.
      // (covered separately in sanitization spec; asserting context
      // wins is the headline guarantee.)
    });

    it('handler args do not carry any reserved field even when agent insists', async () => {
      let seenArgs: Record<string, unknown> | null = null;
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool(
            'spy2',
            z.object({}).passthrough(),
            async (inv) => {
              seenArgs = inv.args;
              return { ok: true, content: [{ type: 'text', text: 'ok' }] };
            },
          ),
        ],
      });

      await proxy.invoke(
        {
          tool: 'lp.spy2',
          args: {
            // Every ExecutionContext field name in one place — if any
            // of these survive, identity is forgeable from agent output.
            userId: 'a',
            tenantId: 'b',
            permissions: ['c'],
            sessionId: 'd',
            context: { evil: true },
            role: 'admin',
            solutionId: 'wrong-tenant',
            actingUserId: 'someone-else',
            actingRole: 'wrong-role',
            apiKeyId: 'forged-key',
            effectiveScope: 'all',
          },
        },
        makeCtx(),
      );
      expect(seenArgs).toEqual({}); // every key was reserved
    });
  });

  describe('Step 6 — audit (always)', () => {
    it('records ok outcome', async () => {
      const { sink, entries } = captureAuditSink();
      proxy.setAuditSink(sink);
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('ok', z.object({}), async () => ({
            ok: true,
            content: [{ type: 'text', text: 'ok' }],
          })),
        ],
      });
      await proxy.invoke({ tool: 'lp.ok', args: {} }, makeCtx());
      expect(entries).toHaveLength(1);
      expect(entries[0].outcome).toBe('ok');
      expect(entries[0].actingUserId).toBe(REAL_USER);
    });

    it('records validation_failed outcome', async () => {
      const { sink, entries } = captureAuditSink();
      proxy.setAuditSink(sink);
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('v', z.object({ n: z.number() }), async () => ({
            ok: true,
            content: [{ type: 'text', text: 'ok' }],
          })),
        ],
      });
      await proxy.invoke({ tool: 'lp.v', args: { n: 'x' } }, makeCtx());
      expect(entries).toHaveLength(1);
      expect(entries[0].outcome).toBe('validation_failed');
    });

    it('records tool_not_found', async () => {
      const { sink, entries } = captureAuditSink();
      proxy.setAuditSink(sink);
      await proxy.invoke({ tool: 'nope.x', args: {} }, makeCtx());
      expect(entries).toHaveLength(1);
      expect(entries[0].outcome).toBe('tool_not_found');
    });

    it('records handler_error', async () => {
      const { sink, entries } = captureAuditSink();
      proxy.setAuditSink(sink);
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('boom', z.object({}), async () => {
            throw new Error('x');
          }),
        ],
      });
      await proxy.invoke({ tool: 'lp.boom', args: {} }, makeCtx());
      expect(entries).toHaveLength(1);
      expect(entries[0].outcome).toBe('handler_error');
    });

    it('without a sink, logs the audit entry to the fallback logger (M3)', async () => {
      // No sink wired — audit must still observe the call so a half-
      // configured production deploy is visible in stdout.
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('e', z.object({}), async () => ({
            ok: true,
            content: [{ type: 'text', text: 'ok' }],
          })),
        ],
      });
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
      try {
        // first call — should warn about absent sink + emit audit log
        const r = await proxy.invoke({ tool: 'lp.e', args: {} }, makeCtx());
        expect(r.ok).toBe(true);
        // warn is one-shot
        const warnCalls = warnSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('no audit sink registered'));
        expect(warnCalls.length).toBe(1);
        const auditLogs = logSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('[audit-fallback]') && m.includes('tool=lp.e'));
        expect(auditLogs.length).toBe(1);
        expect(auditLogs[0]).toMatch(/actingUserId=teacher-42/);
        expect(auditLogs[0]).toMatch(/outcome=ok/);

        // second call — fallback continues but warn does NOT re-fire
        await proxy.invoke({ tool: 'lp.e', args: {} }, makeCtx());
        const warnCalls2 = warnSpy.mock.calls
          .map((c) => String(c[0]))
          .filter((m) => m.includes('no audit sink registered'));
        expect(warnCalls2.length).toBe(1); // unchanged
      } finally {
        warnSpy.mockRestore();
        logSpy.mockRestore();
      }
    });

    it('survives a misbehaving audit sink (audit failure ≠ call failure)', async () => {
      proxy.setAuditSink({
        record: () => {
          throw new Error('audit-broken');
        },
      });
      registry.registerToolkit({
        solutionId: SOL,
        namespace: 'lp',
        tools: [
          makeTool('e', z.object({}), async () => ({
            ok: true,
            content: [{ type: 'text', text: 'ok' }],
          })),
        ],
      });
      const result = await proxy.invoke({ tool: 'lp.e', args: {} }, makeCtx());
      expect(result.ok).toBe(true);
    });
  });

  describe('static interface', () => {
    it('exposes reserved-field list (used by spoofing docs / type tests)', () => {
      expect([...ToolCallerProxyService.RESERVED_FIELDS]).toContain('userId');
    });
  });
});
