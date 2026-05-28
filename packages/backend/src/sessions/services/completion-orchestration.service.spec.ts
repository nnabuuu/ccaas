/**
 * CompletionOrchestrationService - Unit Tests
 *
 * NIE-67: Verifies that --resume vs fresh-spawn decision is driven
 * ONLY by session.messageCount, never by client-supplied resumeSession.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CompletionOrchestrationService } from './completion-orchestration.service';
import { SessionService } from '../session.service';
import { SkillSyncService } from '../../skills/skill-sync.service';
import { SolutionsService } from '../../solutions/solutions.service';
import { MessagesService } from '../../messages/messages.service';
import { ConversationContextService } from '../../messages/conversation-context.service';
import { UserContextService } from '../../messages/user-context.service';
import { SkillsService } from '../../skills/skills.service';
import { ConversationMetadataService } from './conversation-metadata.service';
import { SkillManagementService } from './skill-management.service';
import { TurnsService } from '../../admin/services/turns.service';
import { McpPoolService } from '../../mcp/mcp-pool.service';
import { SessionEventsService } from '../../messages/session-events.service';
import { BundleService } from '../../bundles/bundle.service';
import { EventMapperService } from '../event-mapper.service';
import { McpEngineAdapterService } from '../../tool-caller/adapters/mcp-engine-adapter.service';
import type { ManagedSession } from '../../common/interfaces';

describe('CompletionOrchestrationService - NIE-67: session spawn decision', () => {
  let service: CompletionOrchestrationService;
  let mockSessionService: jest.Mocked<Pick<SessionService, 'sendFollowUp' | 'ensureCLIProcess'>>;
  let mockSessionEventsService: { recordEvent: jest.Mock };

  const makeSession = (messageCount: number): ManagedSession =>
    ({
      sessionId: 'test-session-id',
      messageCount,
      workspaceDir: '/tmp/workspace',
    } as unknown as ManagedSession);

  const baseInput = {
    clientId: 'client-1',
    solutionId: 'tenant-1',
    message: 'Hello',
    emitEvent: jest.fn(),
  };

  beforeEach(async () => {
    mockSessionService = {
      ensureCLIProcess: jest.fn().mockImplementation(
        (_session: unknown, _msg: unknown, onEvent: (e: unknown) => void) => {
          process.nextTick(() =>
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' }),
          );
          return Promise.resolve();
        },
      ),
      sendFollowUp: jest.fn().mockImplementation(
        (_session: unknown, _msg: unknown, onEvent: (e: unknown) => void) => {
          process.nextTick(() =>
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' }),
          );
          return Promise.resolve();
        },
      ),
    };

    const mockSkillSyncService = {
      syncToSession: jest.fn().mockResolvedValue({ skillCount: 0, skillIds: [] }),
    };

    const mockTenantsService = {
      findOne: jest.fn().mockResolvedValue({ id: 'tenant-uuid-1' }),
    };

    const mockMessagesService = {
      create: jest.fn().mockResolvedValue({ id: 'msg-id' }),
      updateContent: jest.fn().mockResolvedValue(undefined),
    };

    const mockConversationContextService = {
      createOrUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const mockUserContextService = {
      recordContext: jest.fn().mockResolvedValue(undefined),
    };

    const mockSkillsService = {};

    const mockConversationMetadataService = {
      autoGenerateTitle: jest.fn().mockResolvedValue(undefined),
    };

    const mockSkillManagementService = {
      loadEnabledSkills: jest.fn().mockResolvedValue([]),
      generateInlineSkillPrompt: jest.fn().mockResolvedValue(undefined),
      generateMixedSkillPrompt: jest.fn().mockResolvedValue(undefined),
      generateSkillSystemPrompt: jest.fn().mockReturnValue(''),
      generateToolRegistryPrompt: jest.fn().mockReturnValue(''),
    };

    const mockTurnsService = {
      createNextTurn: jest.fn().mockResolvedValue({ id: 'turn-1', turnNumber: 1 }),
      completeTurnWithRetry: jest.fn().mockResolvedValue({ turnNumber: 1, totalTokens: 0, durationMs: 0 }),
    };

    const mockMcpPoolService = {
      findOne: jest.fn().mockResolvedValue(null),
      findAllByTenantId: jest.fn().mockResolvedValue([]),
    };

    mockSessionEventsService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletionOrchestrationService,
        { provide: SessionService, useValue: mockSessionService },
        { provide: SkillSyncService, useValue: mockSkillSyncService },
        { provide: SolutionsService, useValue: mockTenantsService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: ConversationContextService, useValue: mockConversationContextService },
        { provide: UserContextService, useValue: mockUserContextService },
        { provide: SkillsService, useValue: mockSkillsService },
        { provide: ConversationMetadataService, useValue: mockConversationMetadataService },
        { provide: SkillManagementService, useValue: mockSkillManagementService },
        { provide: TurnsService, useValue: mockTurnsService },
        { provide: McpPoolService, useValue: mockMcpPoolService },
        { provide: SessionEventsService, useValue: mockSessionEventsService },
        {
          provide: BundleService,
          useValue: {
            resolveActiveBundles: jest.fn().mockReturnValue({
              mcpServers: {},
              toolEventTriggers: [],
              appendSystemPrompts: [],
              activeBundleIds: [],
            }),
          },
        },
        {
          provide: EventMapperService,
          useValue: {
            getTenantToolTriggers: jest.fn().mockReturnValue([]),
            registerTenantToolTriggers: jest.fn(),
            registerBundleTriggers: jest.fn(),
          },
        },
        // Phase 4: McpEngineAdapter — these specs do not exercise the
        // ToolCallerProxy routing path, so a stub that always says
        // "no proxy" keeps legacy behavior under test.
        {
          provide: McpEngineAdapterService,
          useValue: { shouldProxy: () => false },
        },
      ],
    }).compile();

    service = module.get<CompletionOrchestrationService>(CompletionOrchestrationService);
  });

  describe('Step 10: CLI process selection (NIE-67)', () => {
    it('should spawn fresh CLI (ensureCLIProcess) when messageCount === 0', async () => {
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
      });

      expect(mockSessionService.ensureCLIProcess).toHaveBeenCalledTimes(1);
      expect(mockSessionService.sendFollowUp).not.toHaveBeenCalled();
    });

    it('should use --resume (sendFollowUp) when messageCount > 0', async () => {
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(3),
      });

      expect(mockSessionService.sendFollowUp).toHaveBeenCalledTimes(1);
      expect(mockSessionService.ensureCLIProcess).not.toHaveBeenCalled();
    });

    it('should spawn fresh CLI even when messageCount === 1', async () => {
      // Edge case: messageCount===1 means first message was counted but
      // we're on the second — should resume
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(1),
      });

      expect(mockSessionService.sendFollowUp).toHaveBeenCalledTimes(1);
      expect(mockSessionService.ensureCLIProcess).not.toHaveBeenCalled();
    });

    it('should always spawn fresh CLI for messageCount === 0, regardless of any other input', async () => {
      // This test documents the NIE-67 fix:
      // Previously, passing resumeSession:true would force --resume on empty sessions → exit code 1
      // Now the field is gone; messageCount===0 always means fresh spawn, no exceptions.
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
        systemPrompt: 'You are a helpful assistant',
      });

      expect(mockSessionService.ensureCLIProcess).toHaveBeenCalledTimes(1);
      expect(mockSessionService.sendFollowUp).not.toHaveBeenCalled();
    });
  });

  // ─── Fix 3: spawn rejection handling ─────────────────────────────────────

  describe('Fix 3: spawn rejection resolves orchestrateMessage', () => {
    it('resolves when ensureCLIProcess rejects (messageCount === 0)', async () => {
      mockSessionService.ensureCLIProcess = jest.fn().mockRejectedValue(
        new Error('CLI spawn failed'),
      );

      await expect(
        service.orchestrateMessage({ ...baseInput, session: makeSession(0) }),
      ).resolves.toBeDefined();
    });

    it('resolves when sendFollowUp rejects (messageCount > 0)', async () => {
      mockSessionService.sendFollowUp = jest.fn().mockRejectedValue(
        new Error('Follow-up failed'),
      );

      await expect(
        service.orchestrateMessage({ ...baseInput, session: makeSession(3) }),
      ).resolves.toBeDefined();
    });
  });

  // ─── Fix 2: idempotent resolveCompletion ──────────────────────────────────

  describe('Fix 2: idempotent resolveCompletion', () => {
    it('handles multiple terminal events without throwing', async () => {
      mockSessionService.ensureCLIProcess = jest.fn().mockImplementation(
        (_session: unknown, _msg: unknown, onEvent: (e: unknown) => void) => {
          process.nextTick(() => {
            // Fire several terminal events — only the first should take effect
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' });
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' });
            onEvent({ type: 'agent_status', status: 'error', sessionId: 'test-session-id' });
          });
          return Promise.resolve();
        },
      );

      await expect(
        service.orchestrateMessage({ ...baseInput, session: makeSession(0) }),
      ).resolves.toBeDefined();
    });
  });

  // ─── Fix 2: timeout safety net ────────────────────────────────────────────

  describe('Fix 2: completionPromise timeout safety net', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Never emit a terminal event — simulates a hung agent
      mockSessionService.ensureCLIProcess = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('resolves via 10-minute timeout when agent never signals terminal status', async () => {
      const orchestrationPromise = service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
      });

      // Advance all timers (including the 10-min completionPromise timeout)
      // and flush microtask continuations between each timer step.
      await jest.runAllTimersAsync();

      await orchestrationPromise;
    });
  });

  // ─── Event persistence ──────────────────────────────────────────────────

  describe('Event persistence (SessionEventsService)', () => {
    it('should persist non-excluded events via recordEvent', async () => {
      // The default mock fires agent_status:complete, which is NOT excluded
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
      });

      expect(mockSessionEventsService.recordEvent).toHaveBeenCalled();
      const calls = mockSessionEventsService.recordEvent.mock.calls;
      // Should have been called with agent_status event
      const eventTypes = calls.map((c) => c[2]?.type);
      expect(eventTypes).toContain('agent_status');
    });

    it('should NOT persist text_delta events (default exclude)', async () => {
      mockSessionService.ensureCLIProcess = jest.fn().mockImplementation(
        (_session: unknown, _msg: unknown, onEvent: (e: unknown) => void) => {
          process.nextTick(() => {
            onEvent({ type: 'text_delta', delta: 'Hello' });
            onEvent({ type: 'text_delta', delta: ' world' });
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' });
          });
          return Promise.resolve();
        },
      );

      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
      });

      const calls = mockSessionEventsService.recordEvent.mock.calls;
      const eventTypes = calls.map((c) => c[2]?.type);
      expect(eventTypes).not.toContain('text_delta');
      expect(eventTypes).toContain('agent_status');
    });

    it('should pass correct sessionId and solutionId to recordEvent', async () => {
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
      });

      expect(mockSessionEventsService.recordEvent).toHaveBeenCalledWith(
        'test-session-id',           // sessionId
        'tenant-uuid-1',             // resolved solutionId
        expect.objectContaining({ type: 'agent_status' }),
      );
    });
  });

  // ─── MCP args path auto-completion ─────────────────────────────────────

  describe('MCP args relative path auto-completion', () => {
    let mockMcpPool: { findOne: jest.Mock; findAllByTenantId: jest.Mock };
    let mockSessService: {
      ensureCLIProcess: jest.Mock;
      sendFollowUp: jest.Mock;
      createMcpSymlinks: jest.Mock;
    };
    let svc: CompletionOrchestrationService;

    beforeEach(async () => {
      mockMcpPool = {
        findOne: jest.fn().mockResolvedValue(null),
        findAllByTenantId: jest.fn().mockResolvedValue([]),
      };
      mockSessService = {
        ensureCLIProcess: jest.fn().mockImplementation(
          (_s: unknown, _m: unknown, onEvent: (e: unknown) => void) => {
            process.nextTick(() =>
              onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' }),
            );
            return Promise.resolve();
          },
        ),
        sendFollowUp: jest.fn(),
        createMcpSymlinks: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CompletionOrchestrationService,
          { provide: SessionService, useValue: mockSessService },
          { provide: SkillSyncService, useValue: { syncToSession: jest.fn().mockResolvedValue({ skillCount: 0, skillIds: [] }) } },
          { provide: SolutionsService, useValue: { findOne: jest.fn().mockResolvedValue({ id: 'tenant-uuid-1' }) } },
          { provide: MessagesService, useValue: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }), updateContent: jest.fn().mockResolvedValue(undefined) } },
          { provide: ConversationContextService, useValue: { createOrUpdate: jest.fn().mockResolvedValue(undefined) } },
          { provide: UserContextService, useValue: { recordContext: jest.fn().mockResolvedValue(undefined) } },
          { provide: SkillsService, useValue: {} },
          { provide: ConversationMetadataService, useValue: { autoGenerateTitle: jest.fn().mockResolvedValue(undefined) } },
          { provide: SkillManagementService, useValue: { loadEnabledSkills: jest.fn().mockResolvedValue([]), generateInlineSkillPrompt: jest.fn().mockResolvedValue(undefined), generateMixedSkillPrompt: jest.fn().mockResolvedValue(undefined), generateSkillSystemPrompt: jest.fn().mockReturnValue(''), generateToolRegistryPrompt: jest.fn().mockReturnValue('') } },
          { provide: TurnsService, useValue: { createNextTurn: jest.fn().mockResolvedValue({ id: 't1', turnNumber: 1 }), completeTurnWithRetry: jest.fn().mockResolvedValue({ turnNumber: 1, totalTokens: 0, durationMs: 0 }) } },
          { provide: McpPoolService, useValue: mockMcpPool },
          { provide: SessionEventsService, useValue: { recordEvent: jest.fn().mockResolvedValue(undefined) } },
          { provide: BundleService, useValue: { resolveActiveBundles: jest.fn().mockReturnValue({ mcpServers: {}, toolEventTriggers: [], appendSystemPrompts: [], activeBundleIds: [] }) } },
          { provide: EventMapperService, useValue: { getTenantToolTriggers: jest.fn().mockReturnValue([]), registerTenantToolTriggers: jest.fn(), registerBundleTriggers: jest.fn() } },
          { provide: McpEngineAdapterService, useValue: { shouldProxy: () => false } },
        ],
      }).compile();

      svc = module.get<CompletionOrchestrationService>(CompletionOrchestrationService);
    });

    it('should prepend tenant path for relative file args (index.mjs)', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'user-search-tools', status: 'active', config: { command: 'node', args: ['index.mjs'] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers).toBeDefined();
      expect(session.mcpServers!['user-search-tools'].args).toEqual([
        'tenants/tenant-uuid-1/mcp-servers/user-search-tools/index.mjs',
      ]);
    });

    it('should prepend tenant path for nested relative paths (mcp-server/index.mjs)', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'my-tool', status: 'active', config: { command: 'node', args: ['mcp-server/index.mjs'] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers!['my-tool'].args).toEqual([
        'tenants/tenant-uuid-1/mcp-servers/my-tool/mcp-server/index.mjs',
      ]);
    });

    it('should NOT modify absolute paths', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'abs-tool', status: 'active', config: { command: 'node', args: ['/usr/bin/node'] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers!['abs-tool'].args).toEqual(['/usr/bin/node']);
    });

    it('should NOT modify args already starting with tenants/', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'pre-resolved', status: 'active', config: { command: 'node', args: ['tenants/t1/mcp-servers/pre-resolved/index.mjs'] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers!['pre-resolved'].args).toEqual([
        'tenants/t1/mcp-servers/pre-resolved/index.mjs',
      ]);
    });

    it('should NOT modify CLI flags', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'flag-tool', status: 'active', config: { command: 'node', args: ['-v', '--port', '3000'] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers!['flag-tool'].args).toEqual(['-v', '--port', '3000']);
    });

    it('should NOT modify template variables', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'tmpl-tool', status: 'active', config: { command: 'node', args: ['${CORE_MCP_DIR}/server.js'] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers!['tmpl-tool'].args).toEqual(['${CORE_MCP_DIR}/server.js']);
    });

    it('should NOT modify pure digit args', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'num-tool', status: 'active', config: { command: 'node', args: ['server.js', '3000'] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers!['num-tool'].args).toEqual([
        'tenants/tenant-uuid-1/mcp-servers/num-tool/server.js',
        '3000',
      ]);
    });

    it('should handle empty args gracefully', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'empty-tool', status: 'active', config: { command: 'node', args: [] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers!['empty-tool'].args).toEqual([]);
    });

    it('should NOT prepend path for args with path traversal (..)', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'evil-tool', status: 'active', config: { command: 'node', args: ['../../etc/passwd'] } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      // Path traversal arg should be passed through without tenant prefix
      expect(session.mcpServers!['evil-tool'].args).toEqual(['../../etc/passwd']);
    });

    it('should handle undefined args gracefully', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'no-args', status: 'active', config: { command: 'node' } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers!['no-args'].args).toEqual([]);
    });
  });

  // ─── REST adapter bridge wrapping ──────────────────────────────────────

  describe('REST adapter bridge wrapping', () => {
    let mockMcpPool: { findOne: jest.Mock; findAllByTenantId: jest.Mock };
    let mockSessService: {
      ensureCLIProcess: jest.Mock;
      sendFollowUp: jest.Mock;
      createMcpSymlinks: jest.Mock;
    };
    let svc: CompletionOrchestrationService;

    beforeEach(async () => {
      mockMcpPool = {
        findOne: jest.fn().mockResolvedValue(null),
        findAllByTenantId: jest.fn().mockResolvedValue([]),
      };
      mockSessService = {
        ensureCLIProcess: jest.fn().mockImplementation(
          (_s: unknown, _m: unknown, onEvent: (e: unknown) => void) => {
            process.nextTick(() =>
              onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' }),
            );
            return Promise.resolve();
          },
        ),
        sendFollowUp: jest.fn(),
        createMcpSymlinks: jest.fn(),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CompletionOrchestrationService,
          { provide: SessionService, useValue: mockSessService },
          { provide: SkillSyncService, useValue: { syncToSession: jest.fn().mockResolvedValue({ skillCount: 0, skillIds: [] }) } },
          { provide: SolutionsService, useValue: { findOne: jest.fn().mockResolvedValue({ id: 'tenant-uuid-1' }) } },
          { provide: MessagesService, useValue: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }), updateContent: jest.fn().mockResolvedValue(undefined) } },
          { provide: ConversationContextService, useValue: { createOrUpdate: jest.fn().mockResolvedValue(undefined) } },
          { provide: UserContextService, useValue: { recordContext: jest.fn().mockResolvedValue(undefined) } },
          { provide: SkillsService, useValue: {} },
          { provide: ConversationMetadataService, useValue: { autoGenerateTitle: jest.fn().mockResolvedValue(undefined) } },
          { provide: SkillManagementService, useValue: { loadEnabledSkills: jest.fn().mockResolvedValue([]), generateInlineSkillPrompt: jest.fn().mockResolvedValue(undefined), generateMixedSkillPrompt: jest.fn().mockResolvedValue(undefined), generateSkillSystemPrompt: jest.fn().mockReturnValue(''), generateToolRegistryPrompt: jest.fn().mockReturnValue('') } },
          { provide: TurnsService, useValue: { createNextTurn: jest.fn().mockResolvedValue({ id: 't1', turnNumber: 1 }), completeTurnWithRetry: jest.fn().mockResolvedValue({ turnNumber: 1, totalTokens: 0, durationMs: 0 }) } },
          { provide: McpPoolService, useValue: mockMcpPool },
          { provide: SessionEventsService, useValue: { recordEvent: jest.fn().mockResolvedValue(undefined) } },
          { provide: BundleService, useValue: { resolveActiveBundles: jest.fn().mockReturnValue({ mcpServers: {}, toolEventTriggers: [], appendSystemPrompts: [], activeBundleIds: [] }) } },
          { provide: EventMapperService, useValue: { getTenantToolTriggers: jest.fn().mockReturnValue([]), registerTenantToolTriggers: jest.fn(), registerBundleTriggers: jest.fn() } },
          { provide: McpEngineAdapterService, useValue: { shouldProxy: () => false } },
        ],
      }).compile();

      svc = module.get<CompletionOrchestrationService>(CompletionOrchestrationService);
    });

    const restAdapterConfig = {
      baseUrl: 'https://api.example.com',
      auth: { type: 'bearer' as const, token: 'test-token' },
      endpoints: [{ name: 'search_users', description: 'Search users', method: 'GET' as const, path: '/users' }],
    };

    it('should wrap REST adapter server as stdio bridge config', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'rest-api', status: 'active', config: { restAdapter: restAdapterConfig } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      expect(session.mcpServers).toBeDefined();
      const config = session.mcpServers!['rest-api'];
      expect(config.command).toBe('node');
      expect(config.args![0]).toMatch(/rest-adapter-bridge\/dist\/index\.js$/);
      // Bridge args path should be absolute (starts with /)
      expect(config.args![0]).toMatch(/^\//);
    });

    it('should serialize restAdapter config into REST_ADAPTER_CONFIG env', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'rest-api', status: 'active', config: { restAdapter: restAdapterConfig } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      const config = session.mcpServers!['rest-api'];
      expect(config.env).toBeDefined();
      expect(config.env!.REST_ADAPTER_CONFIG).toBe(JSON.stringify(restAdapterConfig));
    });

    it('should merge server.config.env into bridge env', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        {
          slug: 'rest-api',
          status: 'active',
          config: {
            restAdapter: restAdapterConfig,
            env: { CUSTOM_VAR: 'custom-value' },
          },
        },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      const config = session.mcpServers!['rest-api'];
      expect(config.env!.REST_ADAPTER_CONFIG).toBe(JSON.stringify(restAdapterConfig));
      expect(config.env!.CUSTOM_VAR).toBe('custom-value');
    });

    it('should skip server with no command and no restAdapter (warn log)', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'broken-server', status: 'active', config: {} },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      // Should not appear in mcpServers
      expect(session.mcpServers?.['broken-server']).toBeUndefined();
    });

    it('should handle normal stdio server alongside REST adapter', async () => {
      mockMcpPool.findAllByTenantId.mockResolvedValue([
        { slug: 'stdio-tool', status: 'active', config: { command: 'node', args: ['index.mjs'] } },
        { slug: 'rest-api', status: 'active', config: { restAdapter: restAdapterConfig } },
      ]);

      const session = makeSession(0);
      await svc.orchestrateMessage({ ...baseInput, session });

      // stdio server processed normally
      expect(session.mcpServers!['stdio-tool'].command).toBe('node');
      expect(session.mcpServers!['stdio-tool'].args).toEqual([
        'tenants/tenant-uuid-1/mcp-servers/stdio-tool/index.mjs',
      ]);

      // REST adapter wrapped as bridge
      expect(session.mcpServers!['rest-api'].command).toBe('node');
      expect(session.mcpServers!['rest-api'].args![0]).toMatch(/rest-adapter-bridge/);
    });
  });

  // ─── resolveEnabledSkills (private method) ─────────────────────────────

  describe('resolveEnabledSkills', () => {
    const resolve = (input: unknown[]) =>
      (service as any).resolveEnabledSkills(input);

    it('should parse string-only entries', () => {
      const result = resolve(['skill-a', 'skill-b']);
      expect(result.slugs).toEqual(['skill-a', 'skill-b']);
      expect(result.promptModeMap).toEqual({});
    });

    it('should parse object entries with promptMode', () => {
      const result = resolve([
        { slug: 'skill-a', promptMode: 'inline' },
        { slug: 'skill-b', promptMode: 'protocol' },
      ]);
      expect(result.slugs).toEqual(['skill-a', 'skill-b']);
      expect(result.promptModeMap).toEqual({
        'skill-a': 'inline',
        'skill-b': 'protocol',
      });
    });

    it('should handle mixed string and object entries', () => {
      const result = resolve([
        'skill-a',
        { slug: 'skill-b', promptMode: 'protocol' },
        'skill-c',
      ]);
      expect(result.slugs).toEqual(['skill-a', 'skill-b', 'skill-c']);
      expect(result.promptModeMap).toEqual({ 'skill-b': 'protocol' });
    });

    it('should omit entries without promptMode from map', () => {
      const result = resolve([
        { slug: 'skill-a' },
        { slug: 'skill-b', promptMode: undefined },
      ]);
      expect(result.slugs).toEqual(['skill-a', 'skill-b']);
      expect(result.promptModeMap).toEqual({});
    });

    it('should skip malformed entries gracefully', () => {
      const result = resolve([
        'valid',
        null,
        42,
        { noSlug: true },
        { slug: 'also-valid', promptMode: 'inline' },
      ]);
      expect(result.slugs).toEqual(['valid', 'also-valid']);
      expect(result.promptModeMap).toEqual({ 'also-valid': 'inline' });
    });

    it('should return empty arrays for empty input', () => {
      const result = resolve([]);
      expect(result.slugs).toEqual([]);
      expect(result.promptModeMap).toEqual({});
    });
  });

  // ─── Per-skill promptMode (enabledSkills template resolution) ──────────

  describe('Per-skill promptMode (enabledSkills)', () => {
    let mockTenantsService: { findOne: jest.Mock };
    let mockSkillSyncService: { syncToSession: jest.Mock };
    let mockSkillMgmt: {
      loadEnabledSkills: jest.Mock;
      generateInlineSkillPrompt: jest.Mock;
      generateMixedSkillPrompt: jest.Mock;
      generateSkillSystemPrompt: jest.Mock;
      generateToolRegistryPrompt: jest.Mock;
    };
    let svc: CompletionOrchestrationService;

    const makeTenant = (templates: Record<string, any>) => ({
      id: 'tenant-uuid-1',
      config: { sessionTemplates: templates },
    });

    beforeEach(async () => {
      mockTenantsService = { findOne: jest.fn() };
      mockSkillSyncService = {
        syncToSession: jest.fn().mockResolvedValue({ skillCount: 2, skillIds: ['s1', 's2'] }),
      };
      mockSkillMgmt = {
        loadEnabledSkills: jest.fn().mockResolvedValue([
          { slug: 'main-skill', name: 'Main Skill' },
          { slug: 'aux-skill', name: 'Aux Skill' },
        ]),
        generateInlineSkillPrompt: jest.fn().mockResolvedValue('INLINE_PROMPT'),
        generateMixedSkillPrompt: jest.fn().mockResolvedValue('MIXED_PROMPT'),
        generateSkillSystemPrompt: jest.fn().mockReturnValue('PROTOCOL_PROMPT'),
        generateToolRegistryPrompt: jest.fn().mockReturnValue(''),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CompletionOrchestrationService,
          {
            provide: SessionService,
            useValue: {
              ensureCLIProcess: jest.fn().mockImplementation(
                (_s: unknown, _m: unknown, onEvent: (e: unknown) => void) => {
                  process.nextTick(() =>
                    onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' }),
                  );
                  return Promise.resolve();
                },
              ),
              sendFollowUp: jest.fn(),
              createMcpSymlinks: jest.fn(),
              trackSyncedSkills: jest.fn(),
              persistTemplateName: jest.fn().mockResolvedValue(undefined),
            },
          },
          { provide: SkillSyncService, useValue: mockSkillSyncService },
          { provide: SolutionsService, useValue: mockTenantsService },
          { provide: MessagesService, useValue: { create: jest.fn().mockResolvedValue({ id: 'msg-1' }), updateContent: jest.fn().mockResolvedValue(undefined) } },
          { provide: ConversationContextService, useValue: { createOrUpdate: jest.fn() } },
          { provide: UserContextService, useValue: { recordContext: jest.fn() } },
          { provide: SkillsService, useValue: {} },
          { provide: ConversationMetadataService, useValue: { autoGenerateTitle: jest.fn().mockResolvedValue(undefined) } },
          { provide: SkillManagementService, useValue: mockSkillMgmt },
          { provide: TurnsService, useValue: { createNextTurn: jest.fn().mockResolvedValue({ id: 't1', turnNumber: 1 }), completeTurnWithRetry: jest.fn().mockResolvedValue({}) } },
          { provide: McpPoolService, useValue: { findOne: jest.fn().mockResolvedValue(null), findAllByTenantId: jest.fn().mockResolvedValue([]) } },
          { provide: SessionEventsService, useValue: { recordEvent: jest.fn().mockResolvedValue(undefined) } },
          { provide: BundleService, useValue: { resolveActiveBundles: jest.fn().mockReturnValue({ mcpServers: {}, toolEventTriggers: [], appendSystemPrompts: [], activeBundleIds: [] }) } },
          { provide: EventMapperService, useValue: { getTenantToolTriggers: jest.fn().mockReturnValue([]), registerTenantToolTriggers: jest.fn(), registerBundleTriggers: jest.fn() } },
          { provide: McpEngineAdapterService, useValue: { shouldProxy: () => false } },
        ],
      }).compile();

      svc = module.get<CompletionOrchestrationService>(CompletionOrchestrationService);
    });

    it('should use enabledSkills with per-skill overrides (mixed mode)', async () => {
      mockTenantsService.findOne.mockResolvedValue(makeTenant({
        'analyze-explain': {
          enabledSkills: [
            'main-skill',
            { slug: 'aux-skill', promptMode: 'protocol' },
          ],
          skillPromptMode: 'inline',
          appendSystemPrompt: 'Be helpful.',
        },
      }));

      await svc.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
        templateName: 'analyze-explain',
      });

      // Should call generateMixedSkillPrompt (not generateInlineSkillPrompt)
      expect(mockSkillMgmt.generateMixedSkillPrompt).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        { 'aux-skill': 'protocol' },
        'inline',
      );
      expect(mockSkillMgmt.generateInlineSkillPrompt).not.toHaveBeenCalled();
    });

    it('should not enter Step 4b for protocol-mode templates (backward compat)', async () => {
      mockTenantsService.findOne.mockResolvedValue(makeTenant({
        'protocol-tmpl': {
          enabledSkills: ['some-skill'],
          skillPromptMode: 'protocol',
          appendSystemPrompt: 'Original prompt.',
        },
      }));

      await svc.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
        templateName: 'protocol-tmpl',
      });

      // Protocol mode + no per-skill overrides → skip Step 4b entirely
      expect(mockSkillMgmt.generateMixedSkillPrompt).not.toHaveBeenCalled();
      expect(mockSkillMgmt.generateInlineSkillPrompt).not.toHaveBeenCalled();
      expect(mockSkillMgmt.generateSkillSystemPrompt).not.toHaveBeenCalled();
    });

    it('should not enter Step 4b for templates with no skillPromptMode (backward compat)', async () => {
      mockTenantsService.findOne.mockResolvedValue(makeTenant({
        'default-tmpl': {
          enabledSkills: ['some-skill'],
          appendSystemPrompt: 'Default prompt.',
        },
      }));

      await svc.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
        templateName: 'default-tmpl',
      });

      // No skillPromptMode (undefined) + no per-skill overrides → skip Step 4b
      expect(mockSkillMgmt.generateMixedSkillPrompt).not.toHaveBeenCalled();
      expect(mockSkillMgmt.generateInlineSkillPrompt).not.toHaveBeenCalled();
      expect(mockSkillMgmt.generateSkillSystemPrompt).not.toHaveBeenCalled();
    });

    it('should handle enabledSkills with all string entries (no overrides)', async () => {
      mockTenantsService.findOne.mockResolvedValue(makeTenant({
        'all-strings': {
          enabledSkills: ['skill-a', 'skill-b'],
          skillPromptMode: 'inline',
        },
      }));

      await svc.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
        templateName: 'all-strings',
      });

      // All strings → no per-skill overrides → promptModeMap is empty → uses inline path
      expect(mockSkillMgmt.generateInlineSkillPrompt).toHaveBeenCalled();
      expect(mockSkillMgmt.generateMixedSkillPrompt).not.toHaveBeenCalled();
    });

    it('should ignore non-array enabledSkills gracefully', async () => {
      mockTenantsService.findOne.mockResolvedValue(makeTenant({
        'bad-config': {
          enabledSkills: 'not-an-array',
          skillPromptMode: 'inline',
        },
      }));

      await svc.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
        templateName: 'bad-config',
      });

      // Non-array enabledSkills is ignored; inline mode still enters Step 4b
      // with undefined slugs (loads all skills)
      expect(mockSkillMgmt.generateMixedSkillPrompt).not.toHaveBeenCalled();
      expect(mockSkillMgmt.generateInlineSkillPrompt).toHaveBeenCalled();
    });
  });
});
