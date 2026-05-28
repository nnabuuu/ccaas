/**
 * CliProcessService - handleCLIClose unit tests + sandbox argv plumbing
 *
 * Fix 1 (CRITICAL): Verifies that when a session is cancelling,
 * handleCLIClose emits `agent_status: cancelled` to onEvent so that
 * orchestrateMessage's completionPromise can resolve.
 *
 * applyMcpAndSandbox: covers the wiring layer between SandboxService and
 * spawned claude argv — see "applyMcpAndSandbox" describe block.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CliProcessService } from './cli-process.service';
import { EventMapperService } from '../event-mapper.service';
import { WorkspaceService } from './workspace.service';
import { SandboxService, SANDBOX_BASH_MCP_NAME } from '../sandbox/sandbox.service';
import { McpEngineAdapterService } from '../../tool-caller/adapters/mcp-engine-adapter.service';
import type { ManagedSession } from '../../common/interfaces';

describe('CliProcessService - handleCLIClose', () => {
  let service: CliProcessService;

  const makeSession = (status: ManagedSession['status'] = 'processing'): ManagedSession =>
    ({
      sessionId: 'test-session-id',
      clientId: 'test-client-id',
      status,
      buffer: '',
      cliProcess: {} as any,
      stdin: {} as any,
    } as unknown as ManagedSession);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CliProcessService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: EventMapperService,
          useValue: { mapToSessionEvents: jest.fn().mockReturnValue([]) },
        },
        { provide: WorkspaceService, useValue: {} },
        {
          provide: SandboxService,
          useValue: {
            enabled: false,
            mode: 'none',
            bashMcpSpec: () => null,
            disallowedTools: () => [],
            systemPromptSteer: () => '',
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          // Phase 3 injection — these specs only exercise applyMcpAndSandbox
          // when `session.useToolCallerProxy` is unset, so a stub that
          // never returns true keeps the existing behavior under test.
          provide: McpEngineAdapterService,
          useValue: { shouldProxy: () => false, buildProxyEntry: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CliProcessService>(CliProcessService);
  });

  // ─── Fix 1: cancellation branch ──────────────────────────────────────────

  describe('cancellation branch (Fix 1)', () => {
    it('emits agent_status: cancelled when session.status is cancelling', () => {
      const session = makeSession('cancelling');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_status',
          status: 'cancelled',
          sessionId: 'test-session-id',
        }),
      );
    });

    it('sets session.status to idle after cancellation', () => {
      const session = makeSession('cancelling');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(session.status).toBe('idle');
    });

    it('does NOT emit complete or error events when cancelling', () => {
      const session = makeSession('cancelling');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 1, onEvent);

      const emittedStatuses = onEvent.mock.calls.map(([e]: [any]) => e.status);
      expect(emittedStatuses).not.toContain('complete');
      expect(emittedStatuses).not.toContain('error');
    });
  });

  // ─── Normal completion (regression protection) ────────────────────────────

  describe('normal completion branch', () => {
    it('emits agent_status: complete on exit code 0', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_status',
          status: 'complete',
          exitCode: 0,
        }),
      );
    });

    it('emits agent_status: error on non-zero exit code', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 1, onEvent);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_status',
          status: 'error',
          exitCode: 1,
        }),
      );
    });

    it('sets session.status to idle on exit code 0', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(session.status).toBe('idle');
    });

    it('sets session.status to error on non-zero exit code', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 1, onEvent);

      expect(session.status).toBe('error');
    });
  });

  // ─── State cleanup (both branches) ───────────────────────────────────────

  describe('state cleanup', () => {
    it('clears cliProcess, stdin, and buffer after cancellation', () => {
      const session = makeSession('cancelling');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(session.cliProcess).toBeNull();
      expect(session.stdin).toBeNull();
      expect(session.buffer).toBe('');
    });

    it('clears cliProcess, stdin, and buffer after normal completion', () => {
      const session = makeSession('processing');
      const onEvent = jest.fn();

      (service as any).handleCLIClose(session, 0, onEvent);

      expect(session.cliProcess).toBeNull();
      expect(session.stdin).toBeNull();
      expect(session.buffer).toBe('');
    });
  });
});

// ─── applyMcpAndSandbox argv-plumbing tests ─────────────────────────────────
//
// Build a service with a *real* SandboxService mock that toggles `enabled`,
// then call the private `applyMcpAndSandbox` and assert what lands in argv.
// Justification (review item #3): the wiring layer is security-critical —
// fixture tests prove the deny flag, MCP merge, and reserved-name collision
// all behave correctly. Both spawn paths share this helper, so invariants
// proven here apply to initial + `--resume` spawn.

describe('CliProcessService - applyMcpAndSandbox', () => {
  const makeSandboxMock = (enabled: boolean) => ({
    enabled,
    mode: enabled ? 'just-bash' : 'none',
    bashMcpSpec: (workspaceDir: string, sessionId?: string) =>
      enabled
        ? {
            name: SANDBOX_BASH_MCP_NAME,
            command: '/usr/bin/node',
            args: ['/abs/server.mjs'],
            env: {
              PATH: '',
              CCAAS_SANDBOX_ROOT: workspaceDir,
              CCAAS_SANDBOX_MCP_LOG: '/tmp/log',
              ...(sessionId ? { CCAAS_SESSION_ID: sessionId } : {}),
            },
          }
        : null,
    disallowedTools: () => (enabled ? ['Bash'] : []),
    systemPromptSteer: () =>
      enabled ? `use mcp__${SANDBOX_BASH_MCP_NAME}__bash` : '',
  });

  const buildService = async (
    sandbox: ReturnType<typeof makeSandboxMock>,
  ): Promise<CliProcessService> => {
    const module = await Test.createTestingModule({
      providers: [
        CliProcessService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        {
          provide: EventMapperService,
          useValue: { mapToSessionEvents: jest.fn().mockReturnValue([]) },
        },
        {
          provide: WorkspaceService,
          useValue: {
            resolveSessionMcpPaths: (servers: Record<string, unknown>) => servers,
          },
        },
        { provide: SandboxService, useValue: sandbox },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        {
          provide: McpEngineAdapterService,
          useValue: { shouldProxy: () => false, buildProxyEntry: jest.fn() },
        },
      ],
    }).compile();
    return module.get<CliProcessService>(CliProcessService);
  };

  const makeSession = (overrides: Partial<ManagedSession> = {}): ManagedSession =>
    ({
      sessionId: 'sess-1',
      clientId: 'client-1',
      workspaceDir: '/ws/sess-1',
      mcpServers: undefined,
      ...overrides,
    } as unknown as ManagedSession);

  // ─── Sandbox OFF: bit-identical legacy behavior ─────────────────────────

  it('off → no --disallowed-tools, no __ccaas_bash in mcp-config', async () => {
    const svc = await buildService(makeSandboxMock(false));
    const args: string[] = [];
    const out = (svc as any).applyMcpAndSandbox(makeSession(), args, undefined);

    expect(args).not.toContain('--disallowed-tools');
    expect(args.join(' ')).not.toContain(SANDBOX_BASH_MCP_NAME);
    expect(out).toBeUndefined();
  });

  it('off + solution prompt → prompt passes through unchanged', async () => {
    const svc = await buildService(makeSandboxMock(false));
    const out = (svc as any).applyMcpAndSandbox(makeSession(), [], 'be helpful');
    expect(out).toBe('be helpful');
  });

  // ─── Sandbox ON: deny flag ──────────────────────────────────────────────

  it('on → emits exactly one --disallowed-tools containing Bash', async () => {
    const svc = await buildService(makeSandboxMock(true));
    const args: string[] = [];
    (svc as any).applyMcpAndSandbox(makeSession(), args, undefined);

    const denyIdxs = args.reduce<number[]>(
      (acc, a, i) => (a === '--disallowed-tools' ? [...acc, i] : acc),
      [],
    );
    expect(denyIdxs.length).toBe(1);
    expect(args[denyIdxs[0] + 1].split(',')).toContain('Bash');
  });

  it('on + caller pre-pushed --disallowed-tools Read → MERGED into one flag (review #1)', async () => {
    const svc = await buildService(makeSandboxMock(true));
    const args: string[] = ['--disallowed-tools', 'Read'];
    (svc as any).applyMcpAndSandbox(makeSession(), args, undefined);

    const denyIdxs = args.reduce<number[]>(
      (acc, a, i) => (a === '--disallowed-tools' ? [...acc, i] : acc),
      [],
    );
    expect(denyIdxs.length).toBe(1); // must NOT duplicate (last-wins would undo us)
    const denied = args[denyIdxs[0] + 1].split(',').sort();
    expect(denied).toEqual(['Bash', 'Read']);
  });

  it('on + caller pre-pushed --disallowed-tools Bash → dedup keeps single Bash', async () => {
    const svc = await buildService(makeSandboxMock(true));
    const args: string[] = ['--disallowed-tools', 'Bash'];
    (svc as any).applyMcpAndSandbox(makeSession(), args, undefined);
    const idx = args.indexOf('--disallowed-tools');
    expect(args[idx + 1]).toBe('Bash');
    expect(args.filter((a) => a === '--disallowed-tools').length).toBe(1);
  });

  // ─── Sandbox ON: MCP merge with solution servers ────────────────────────

  it('on + no solution mcpServers → mcp-config contains only __ccaas_bash', async () => {
    const svc = await buildService(makeSandboxMock(true));
    const args: string[] = [];
    (svc as any).applyMcpAndSandbox(makeSession(), args, undefined);
    const idx = args.indexOf('--mcp-config');
    expect(idx).toBeGreaterThanOrEqual(0);
    const cfg = JSON.parse(args[idx + 1]);
    expect(Object.keys(cfg.mcpServers)).toEqual([SANDBOX_BASH_MCP_NAME]);
  });

  it('on + solution mcpServers → both merged under --mcp-config', async () => {
    const svc = await buildService(makeSandboxMock(true));
    const args: string[] = [];
    const session = makeSession({
      mcpServers: {
        'solution-mcp': { command: 'node', args: ['solution.js'] },
      } as any,
    });
    (svc as any).applyMcpAndSandbox(session, args, undefined);

    const cfg = JSON.parse(args[args.indexOf('--mcp-config') + 1]);
    expect(Object.keys(cfg.mcpServers).sort()).toEqual(
      ['solution-mcp', SANDBOX_BASH_MCP_NAME].sort(),
    );
  });

  it('on + solution mcpServers collides on __ccaas_bash → sandbox wins, log warning', async () => {
    const svc = await buildService(makeSandboxMock(true));
    const warnSpy = jest
      .spyOn((svc as any).logger, 'warn')
      .mockImplementation(() => undefined);
    const args: string[] = [];
    const session = makeSession({
      mcpServers: {
        [SANDBOX_BASH_MCP_NAME]: { command: 'evil', args: [] },
      } as any,
    });

    (svc as any).applyMcpAndSandbox(session, args, undefined);

    const cfg = JSON.parse(args[args.indexOf('--mcp-config') + 1]);
    expect(cfg.mcpServers[SANDBOX_BASH_MCP_NAME].command).toBe('/usr/bin/node'); // sandbox spec, not 'evil'
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('collision'));
    warnSpy.mockRestore();
  });

  // ─── Sandbox ON: steering text composition (review #2) ─────────────────

  it('on + no solution prompt → returns steer text as-is', async () => {
    const svc = await buildService(makeSandboxMock(true));
    const out: string = (svc as any).applyMcpAndSandbox(makeSession(), [], undefined);
    expect(out).toContain(`mcp__${SANDBOX_BASH_MCP_NAME}__bash`);
    expect(out.startsWith('use mcp__')).toBe(true); // no leading delimiter when alone
  });

  it('on + solution prompt → delimiter separates them (review #2)', async () => {
    const svc = await buildService(makeSandboxMock(true));
    const out: string = (svc as any).applyMcpAndSandbox(
      makeSession(),
      [],
      'be a helpful assistant',
    );
    expect(out.startsWith('be a helpful assistant')).toBe(true);
    expect(out).toContain('[CCAAS SANDBOX — non-negotiable system constraint]');
    // hostile solution prompt can't visually swallow our text
    expect(out.indexOf('be a helpful assistant')).toBeLessThan(
      out.indexOf('mcp__'),
    );
  });

  // ─── Phase 3: ToolCallerProxy routing ────────────────────────────────────

  describe('applyMcpAndSandbox + useToolCallerProxy', () => {
    /**
     * Builds a CliProcessService where the McpEngineAdapter says
     * "yes, proxy this session" and returns a canonical entry.
     */
    const buildProxyService = async () => {
      const sandbox = makeSandboxMock(false);
      const module = await Test.createTestingModule({
        providers: [
          CliProcessService,
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
          { provide: EventMapperService, useValue: { mapToSessionEvents: jest.fn().mockReturnValue([]) } },
          {
            provide: WorkspaceService,
            useValue: {
              resolveSessionMcpPaths: (s: Record<string, unknown>) => s,
            },
          },
          { provide: SandboxService, useValue: sandbox },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
          {
            provide: McpEngineAdapterService,
            useValue: {
              shouldProxy: () => true,
              buildProxyEntry: () => ({
                name: 'tool-caller-proxy',
                config: {
                  command: 'node',
                  args: ['/path/to/proxy/dist/index.js'],
                  env: {
                    CCAAS_PROXY_BACKEND_URL: 'http://127.0.0.1:3001',
                    CCAAS_PROXY_SESSION_ID: 'sess-1',
                    CCAAS_PROXY_SESSION_TOKEN: 'tok',
                  },
                },
              }),
            },
          },
        ],
      }).compile();
      return module.get<CliProcessService>(CliProcessService);
    };

    const sessionWithMcpAndFlag = (flag: boolean): ManagedSession =>
      makeSession({
        useToolCallerProxy: flag,
        mcpServers: {
          'solution-tool-a': { command: '/old/bin', args: [] },
          'bundle:file-attachments': { command: '/bundles/file', args: [] },
        },
      });

    it('replaces solution MCP entries with the proxy when flag is on', async () => {
      const svc = await buildProxyService();
      const args: string[] = [];
      (svc as any).applyMcpAndSandbox(sessionWithMcpAndFlag(true), args, undefined);
      const idx = args.indexOf('--mcp-config');
      expect(idx).toBeGreaterThanOrEqual(0);
      const cfg = JSON.parse(args[idx + 1]);
      // Solution entry is gone, proxy entry is in its place
      expect(cfg.mcpServers['solution-tool-a']).toBeUndefined();
      expect(cfg.mcpServers['tool-caller-proxy']).toBeDefined();
      // Bundle entries preserved (ccaas-owned, not solution-owned)
      expect(cfg.mcpServers['bundle:file-attachments']).toBeDefined();
    });

    it('leaves solution MCP entries alone when flag is off', async () => {
      const svc = await buildProxyService();
      const args: string[] = [];
      (svc as any).applyMcpAndSandbox(sessionWithMcpAndFlag(false), args, undefined);
      const idx = args.indexOf('--mcp-config');
      const cfg = JSON.parse(args[idx + 1]);
      expect(cfg.mcpServers['solution-tool-a']).toBeDefined();
      expect(cfg.mcpServers['tool-caller-proxy']).toBeUndefined();
    });
  });
});
