import { SolutionLoaderService, type ImportSolutionConfig } from './solution-loader.service';
import { SolutionsService } from '../solutions/solutions.service';
import { SkillsService } from '../skills/skills.service';
import { McpPoolService } from '../mcp/mcp-pool.service';
import { EventMapperService } from '../sessions/event-mapper.service';
import type { McpServerDefinition } from './dto/solution-config.dto';

// ============================================================================
// Mock factories
// ============================================================================

/**
 * Solution mock with two-call pattern:
 *  - Call 1 (ensureTenant): findOne(slug) → null (tenant not yet created)
 *  - Call 2+ (applySessionTemplates, etc.): → tenant with empty config
 */
function createMockTenants() {
  return {
    findOne: jest.fn()
      .mockResolvedValueOnce(null)  // ensureTenant: slug lookup → not found
      .mockResolvedValue({ id: 'tenant-123', slug: 'test-solution', config: {} }),
    create: jest.fn().mockResolvedValue({
      tenant: { id: 'tenant-123', slug: 'test-solution', name: 'Test Solution' },
    }),
    update: jest.fn().mockResolvedValue({}),
  };
}

function createMockSkills(): jest.Mocked<Pick<SkillsService, 'findOne' | 'create' | 'update' | 'publish'>> {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((_tid, dto) =>
      Promise.resolve({ id: `skill-${dto.slug}`, slug: dto.slug, name: dto.name }),
    ),
    update: jest.fn().mockResolvedValue({}),
    publish: jest.fn().mockResolvedValue({}),
  };
}

function createMockMcpPool(): jest.Mocked<Pick<McpPoolService, 'findOne' | 'create' | 'update'>> {
  return {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((_tid, dto) =>
      Promise.resolve({ id: `mcp-${dto.slug}`, slug: dto.slug }),
    ),
    update: jest.fn().mockResolvedValue({}),
  };
}

function createMockEventMapper(): jest.Mocked<
  Pick<EventMapperService, 'registerTenantToolTriggers' | 'clearAllTenantToolTriggers'>
> {
  return {
    registerTenantToolTriggers: jest.fn(),
    clearAllTenantToolTriggers: jest.fn(),
  };
}

// ============================================================================
// Test fixtures
// ============================================================================

/** Shorthand for a stdio MCP server definition. */
function mcpDef(args: string[], extra: Partial<McpServerDefinition> = {}): McpServerDefinition {
  return { type: 'stdio', command: 'node', args, ...extra };
}

function makeConfig(overrides: Partial<ImportSolutionConfig> = {}): ImportSolutionConfig {
  return {
    tenant: { name: 'Test Solution', slug: 'test-solution', description: 'A test' },
    mode: 'simple',
    mcpServers: {},
    ...overrides,
  };
}

/** Helper: find the tenants.update call that saves sessionTemplates */
function findTemplateUpdateCall(updateMock: jest.Mock) {
  return updateMock.mock.calls.find(([, p]) => p?.config?.sessionTemplates !== undefined);
}

// ============================================================================
// Tests
// ============================================================================

describe('SolutionLoaderService', () => {
  let loader: SolutionLoaderService;
  let tenants: ReturnType<typeof createMockTenants>;
  let skills: ReturnType<typeof createMockSkills>;
  let mcpPool: ReturnType<typeof createMockMcpPool>;
  let eventMapper: ReturnType<typeof createMockEventMapper>;
  let bundleService: { resolveActiveBundles: jest.Mock; getAvailableBundles: jest.Mock };

  beforeEach(() => {
    tenants     = createMockTenants();
    skills      = createMockSkills();
    mcpPool     = createMockMcpPool();
    eventMapper = createMockEventMapper();
    bundleService = {
      resolveActiveBundles: jest.fn().mockReturnValue({
        mcpServers: {},
        toolEventTriggers: [],
        appendSystemPrompts: [],
        activeBundleIds: [],
      }),
      getAvailableBundles: jest.fn().mockReturnValue([
        { id: 'structured-output' },
        { id: 'file-attachments', mcpServer: { command: 'node', args: ['${CORE_MCP_DIR}/attach-file-server/dist/index.js'] } },
        { id: 'shared-context', mcpServer: { command: 'node', args: ['${CORE_MCP_DIR}/shared-context-server/dist/index.js'] } },
      ]),
    };

    loader = new SolutionLoaderService(
      tenants as any,
      skills as any,
      mcpPool as any,
      eventMapper as any,
      bundleService as any,
      { get: jest.fn(() => undefined) } as any, // ConfigService — no SOLUTIONS_DIR
    );
  });

  // ==========================================================================
  // importFromConfig
  // ==========================================================================

  describe('importFromConfig', () => {
    it('imports a solution with empty config', async () => {
      const result = await loader.importFromConfig(makeConfig());

      expect(result.slug).toBe('test-solution');
      expect(result.name).toBe('Test Solution');
      expect(result.solutionId).toBe('tenant-123');
      expect(result.mcpServers).toEqual([]);
    });

    it('creates a new tenant when none exists', async () => {
      await loader.importFromConfig(makeConfig());

      expect(tenants.create).toHaveBeenCalledWith({
        name: 'Test Solution',
        slug: 'test-solution',
        description: 'A test',
      });
    });

    it('reuses an existing tenant without creating a new one', async () => {
      tenants.findOne.mockReset();
      tenants.findOne
        .mockResolvedValueOnce({ id: 'existing-123', slug: 'test-solution' } as any)
        .mockResolvedValue({ id: 'existing-123', config: {} } as any);

      const result = await loader.importFromConfig(makeConfig());

      expect(tenants.create).not.toHaveBeenCalled();
      expect(result.solutionId).toBe('existing-123');
    });

    it('registers MCP servers from config body', async () => {
      const config = makeConfig({
        mcpServers: {
          'my-tools': mcpDef(['/abs/path/dist/index.js'], { description: 'My tools' }),
        },
      });

      const result = await loader.importFromConfig(config);

      expect(mcpPool.create).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({
          slug: 'my-tools',
          config: expect.objectContaining({ command: 'node' }),
        }),
      );
      expect(result.mcpServers[0].action).toBe('created');
    });

    it('updates an existing MCP server', async () => {
      const config = makeConfig({
        mcpServers: { tools: mcpDef(['/path/index.js']) },
      });
      mcpPool.findOne.mockResolvedValue({ id: 'mcp-existing', slug: 'tools' } as any);

      const result = await loader.importFromConfig(config);

      expect(mcpPool.update).toHaveBeenCalledTimes(1);
      expect(mcpPool.create).not.toHaveBeenCalled();
      expect(result.mcpServers[0].action).toBe('updated');
    });

    it('marks MCP server as skipped on creation failure', async () => {
      const config = makeConfig({
        mcpServers: { tools: mcpDef(['/path/index.js']) },
      });
      mcpPool.create.mockRejectedValue(new Error('Port conflict'));

      const result = await loader.importFromConfig(config);

      expect(result.mcpServers[0].action).toBe('skipped');
      expect(result.mcpServers[0].error).toContain('Port conflict');
    });

    it('registers toolEventTriggers with eventMapper', async () => {
      const config = makeConfig({
        mcpServers: {
          tools: mcpDef(['/path/index.js'], {
            toolEventTriggers: [{ toolName: 'advance_beat', eventType: 'output_update' }],
          }),
        },
      });

      await loader.importFromConfig(config);

      expect(eventMapper.registerTenantToolTriggers).toHaveBeenCalledWith(
        'tenant-123',
        [{ toolName: 'advance_beat', eventType: 'output_update' }],
      );
    });

    it('applies session templates', async () => {
      const config = makeConfig({
        sessionTemplates: {
          default: { enabledSkills: ['echo-chat'] },
        },
      });

      const result = await loader.importFromConfig(config);

      expect(result.templateCount).toBe(1);
      const updateCall = findTemplateUpdateCall(tenants.update);
      expect(updateCall).toBeDefined();
      const saved = updateCall![1].config.sessionTemplates as Record<string, any>;
      expect(saved['default']).toBeDefined();
    });

    it('stamps solutionAppliedAt after import', async () => {
      await loader.importFromConfig(makeConfig());

      const stampCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.solutionAppliedAt !== undefined,
      );
      expect(stampCall).toBeDefined();
    });
  });

  // ==========================================================================
  // Bundle enabledBundles auto-sync
  // ==========================================================================

  describe('Bundle enabledBundles auto-sync', () => {
    it('simple mode (default): auto-enables all built-in bundles', async () => {
      await loader.importFromConfig(makeConfig());

      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeDefined();
      const bundles = bundleUpdateCall![1].config.enabledBundles as string[];
      expect(bundles).toContain('structured-output');
      expect(bundles).toContain('file-attachments');
      expect(bundles).toContain('shared-context');
    });

    it('advanced mode: only syncs bundles declared in session templates', async () => {
      const config = makeConfig({
        mode: 'advanced',
        sessionTemplates: {
          lesson: {
            enabledSkills: [],
            bundles: ['structured-output'],
          },
        },
      });

      await loader.importFromConfig(config);

      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeDefined();
      const bundles = bundleUpdateCall![1].config.enabledBundles as string[];
      expect(bundles).toContain('structured-output');
      expect(bundles).not.toContain('file-attachments');
    });

    it('advanced mode: does not auto-enable bundles when no session templates declare bundles', async () => {
      const config = makeConfig({ mode: 'advanced' });

      await loader.importFromConfig(config);

      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeUndefined();
    });
  });

  // ==========================================================================
  // Solution mode (simple / advanced)
  // ==========================================================================

  describe('Solution mode', () => {
    it('simple mode: filters out shared-context-server from solution mcpServers', async () => {
      const config = makeConfig({
        mcpServers: {
          'solution-tools': mcpDef(['/opt/mcp-server/dist/index.js']),
          'shared-context-server': mcpDef(['shared-context-server/dist/index.js']),
        },
      });

      await loader.importFromConfig(config);

      // solution-tools should be registered, shared-context-server should not
      expect(mcpPool.create).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({ slug: 'solution-tools' }),
      );
      const createCalls = mcpPool.create.mock.calls.map(([, dto]: any) => dto.slug);
      expect(createCalls).not.toContain('shared-context-server');
    });

    it('advanced mode: does NOT filter shared-context-server from solution mcpServers', async () => {
      const config = makeConfig({
        mode: 'advanced',
        mcpServers: {
          'shared-context-server': mcpDef(['shared-context-server/dist/index.js']),
        },
      });

      await loader.importFromConfig(config);

      expect(mcpPool.create).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({ slug: 'shared-context-server' }),
      );
    });
  });

  // ==========================================================================
  // getStatus
  // ==========================================================================

  describe('getStatus', () => {
    it('returns null lastLoadAt before any load', () => {
      expect(loader.getStatus().lastLoadAt).toBeNull();
    });

    it('returns a copy, not a mutable reference', () => {
      expect(loader.getStatus()).not.toBe(loader.getStatus());
    });

    it('updates lastLoadAt and counts after importFromConfig', async () => {
      await loader.importFromConfig(makeConfig());

      const status = loader.getStatus();
      expect(status.lastLoadAt).toBeInstanceOf(Date);
      expect(status.solutionsLoaded).toBe(1);
    });
  });
});
