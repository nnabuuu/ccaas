/**
 * McpEngineAdapter unit tests.
 *
 * Covers the security-critical surface: token generation,
 * constant-time comparison, session lifecycle. The proxy-bundle
 * spawn itself is exercised via the StdioMcpToolkit + controller
 * integration spec — here we focus on the registration ledger.
 */

import { z } from 'zod';
import { McpEngineAdapterService } from './mcp-engine-adapter.service';
import { SolutionToolkitRegistry } from '../solution-toolkit-registry';
import type { ManagedSession } from '../../common/interfaces/session.interface';

function makeSession(over: Partial<ManagedSession> = {}): ManagedSession {
  // Cast through unknown: ManagedSession requires many runtime-only
  // fields (cliProcess etc.) the adapter never reads.
  return {
    sessionId: 's1',
    clientId: 'c1',
    solutionId: 'sol-a',
    actingUserId: 'teacher-42',
    actingRole: undefined,
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
    ...over,
  } as unknown as ManagedSession;
}

describe('McpEngineAdapterService', () => {
  let registry: SolutionToolkitRegistry;
  let adapter: McpEngineAdapterService;

  beforeEach(() => {
    registry = new SolutionToolkitRegistry();
    adapter = new McpEngineAdapterService(registry);
  });

  describe('shouldProxy', () => {
    it('returns false when the solution has no toolkit registered', () => {
      expect(adapter.shouldProxy(makeSession())).toBe(false);
    });

    it('returns true once a toolkit is registered for the solution', () => {
      registry.registerToolkit({
        solutionId: 'sol-a',
        namespace: 'lp',
        tools: [
          {
            name: 'g',
            description: '',
            argsSchema: z.object({}),
            handler: async () => ({ ok: true, content: [] }),
          },
        ],
      });
      expect(adapter.shouldProxy(makeSession())).toBe(true);
    });

    it('isolates per-solution — another solution registering tools does not flip ours', () => {
      registry.registerToolkit({
        solutionId: 'other',
        namespace: 'x',
        tools: [
          {
            name: 'g',
            description: '',
            argsSchema: z.object({}),
            handler: async () => ({ ok: true, content: [] }),
          },
        ],
      });
      expect(adapter.shouldProxy(makeSession())).toBe(false);
    });

    it('returns false when session has no solutionId', () => {
      expect(adapter.shouldProxy(makeSession({ solutionId: undefined }))).toBe(false);
    });
  });

  describe('registerSession + token + context', () => {
    it('mints a fresh token per session and exposes the ExecutionContext', () => {
      const reg = adapter.registerSession(makeSession());
      expect(reg.token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
      expect(reg.token.length).toBeGreaterThanOrEqual(40);
      expect(reg.context.solutionId).toBe('sol-a');
      expect(reg.context.actingUserId).toBe('teacher-42');
    });

    it('is idempotent — second call returns the same token', () => {
      const a = adapter.registerSession(makeSession());
      const b = adapter.registerSession(makeSession());
      expect(a.token).toBe(b.token);
    });

    it('different sessions get different tokens', () => {
      const a = adapter.registerSession(makeSession({ sessionId: 's1' }));
      const b = adapter.registerSession(makeSession({ sessionId: 's2' }));
      expect(a.token).not.toBe(b.token);
    });

    it('throws when registering a session without solutionId', () => {
      expect(() =>
        adapter.registerSession(makeSession({ solutionId: undefined })),
      ).toThrow(/no solutionId/);
    });
  });

  describe('validateToken', () => {
    it('accepts the matching token for the right session', () => {
      const reg = adapter.registerSession(makeSession());
      expect(adapter.validateToken('s1', reg.token)).toBe(true);
    });

    it('rejects empty / missing tokens (covers H1 of the security review)', () => {
      adapter.registerSession(makeSession());
      expect(adapter.validateToken('s1', undefined)).toBe(false);
      expect(adapter.validateToken('s1', '')).toBe(false);
    });

    it('rejects the right token for the wrong sessionId', () => {
      const reg = adapter.registerSession(makeSession({ sessionId: 's1' }));
      expect(adapter.validateToken('s2', reg.token)).toBe(false);
    });

    it('rejects a near-match (constant-time comparison correctness)', () => {
      const reg = adapter.registerSession(makeSession());
      // Flip one char in the middle to ensure equal-length compare path.
      const mid = Math.floor(reg.token.length / 2);
      const tampered = reg.token.slice(0, mid) + 'X' + reg.token.slice(mid + 1);
      expect(adapter.validateToken('s1', tampered)).toBe(false);
    });

    it('rejects a token from a different session even if length matches', () => {
      const a = adapter.registerSession(makeSession({ sessionId: 's1' }));
      adapter.registerSession(makeSession({ sessionId: 's2' }));
      // a.token is for s1 — using it for s2 must fail.
      expect(adapter.validateToken('s2', a.token)).toBe(false);
    });
  });

  describe('getContext / releaseSession', () => {
    it('returns null context after releaseSession', () => {
      adapter.registerSession(makeSession());
      expect(adapter.getContext('s1')).not.toBeNull();
      adapter.releaseSession('s1');
      expect(adapter.getContext('s1')).toBeNull();
    });

    it('releaseSession is a no-op for unknown sessions', () => {
      expect(() => adapter.releaseSession('never-existed')).not.toThrow();
    });

    it('after release the old token no longer validates', () => {
      const reg = adapter.registerSession(makeSession());
      adapter.releaseSession('s1');
      expect(adapter.validateToken('s1', reg.token)).toBe(false);
    });
  });

  describe('buildProxyEntry', () => {
    beforeEach(() => {
      // Point the path resolver at a real-on-disk file so the unit
      // test doesn't depend on the proxy bundle being built.
      process.env.CCAAS_PROXY_BUNDLE_PATH = __filename;
    });
    afterEach(() => {
      delete process.env.CCAAS_PROXY_BUNDLE_PATH;
    });

    it('returns an mcpServers-shaped entry with secret env vars', () => {
      const out = adapter.buildProxyEntry(makeSession());
      expect(out.name).toBe('tool-caller-proxy');
      expect(out.config.command).toBe('node');
      expect(out.config.args[0]).toBe(__filename);
      expect(out.config.env!.CCAAS_PROXY_SESSION_ID).toBe('s1');
      expect(out.config.env!.CCAAS_PROXY_SESSION_TOKEN).toMatch(/[A-Za-z0-9_-]+/);
      expect(out.config.env!.CCAAS_PROXY_BACKEND_URL).toMatch(/^http:\/\/127\.0\.0\.1:/);
    });

    it('reuses the same token across calls for one session', () => {
      const a = adapter.buildProxyEntry(makeSession());
      const b = adapter.buildProxyEntry(makeSession());
      expect(a.config.env!.CCAAS_PROXY_SESSION_TOKEN).toBe(
        b.config.env!.CCAAS_PROXY_SESSION_TOKEN,
      );
    });
  });
});
