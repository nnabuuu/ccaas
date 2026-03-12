import * as path from 'path';
import { SolutionLoaderService } from './solution-loader.service';
import { SolutionScannerService, type SolutionMetadata } from './solution-scanner.service';
import { SkillMetadataParserService } from './skill-metadata-parser.service';
import { TenantsService } from '../tenants/tenants.service';
import { SkillsService } from '../skills/skills.service';
import { McpPoolService } from '../mcp/mcp-pool.service';
import { EventMapperService } from '../sessions/event-mapper.service';
import type { SolutionConfigV3, McpServerDefinition } from './dto/solution-config.dto';

// ============================================================================
// Mock factories
// ============================================================================

function createMockScanner(): jest.Mocked<Pick<SolutionScannerService, 'scanSolutions'>> {
  return { scanSolutions: jest.fn().mockResolvedValue([]) };
}

function createMockParser(): jest.Mocked<Pick<SkillMetadataParserService, 'parseSkillFile'>> {
  return {
    parseSkillFile: jest.fn().mockResolvedValue({
      frontmatter: { name: 'Test Skill', description: 'desc' },
      slug: 'test-skill',
      content: '# Test\nContent.',
      source: 'frontmatter',
      filePath: '/fake/SKILL.md',
      warnings: [],
    }),
  };
}

/**
 * Tenant mock with two-call pattern:
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

const SOLUTION_PATH = '/fake/solutions/live-lesson';

/** Shorthand for a stdio MCP server definition (type is required by schema). */
function mcpDef(args: string[], extra: Partial<McpServerDefinition> = {}): McpServerDefinition {
  return { type: 'stdio', command: 'node', args, ...extra };
}

function makeV3Config(overrides: Partial<SolutionConfigV3> = {}): SolutionConfigV3 {
  return {
    schemaVersion: '3.0',
    tenant: { name: 'Test Solution', slug: 'test-solution', description: 'A test' },
    mode: 'simple',
    discovery: { enabled: true },
    skills: ['skills/test-skill'],
    mcpServers: {},
    ...overrides,
  };
}

function makeSolutionMetadata(overrides: Partial<SolutionMetadata> = {}): SolutionMetadata {
  return {
    slug: 'test-solution',
    name: 'Test Solution',
    solutionPath: SOLUTION_PATH,
    configPath: `${SOLUTION_PATH}/solution.json`,
    config: makeV3Config(),
    migrated: false,
    warnings: [],
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
  let scanner: ReturnType<typeof createMockScanner>;
  let parser: ReturnType<typeof createMockParser>;
  let tenants: ReturnType<typeof createMockTenants>;
  let skills: ReturnType<typeof createMockSkills>;
  let mcpPool: ReturnType<typeof createMockMcpPool>;
  let eventMapper: ReturnType<typeof createMockEventMapper>;
  let bundleService: { resolveActiveBundles: jest.Mock; getAvailableBundles: jest.Mock };

  beforeEach(() => {
    scanner    = createMockScanner();
    parser     = createMockParser();
    tenants    = createMockTenants();
    skills     = createMockSkills();
    mcpPool    = createMockMcpPool();
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
      scanner as any,
      parser as any,
      tenants as any,
      skills as any,
      mcpPool as any,
      eventMapper as any,
      bundleService as any,
    );
  });

  // ==========================================================================
  // resolveMcpServerAbsolutePaths — tested indirectly via session template injection
  // ==========================================================================

  describe('MCP path resolution into session templates', () => {
    it('resolves a relative .js arg to an absolute path', async () => {
      const config = makeV3Config({
        mcpServers: {
          'live-lesson-tools': mcpDef(['mcp-server/dist/index.js'], { description: 'tools' }),
        },
        sessionTemplates: { teaching: { enabledSkills: ['test-skill'] } },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const updateCall = findTemplateUpdateCall(tenants.update);
      expect(updateCall).toBeDefined();
      const saved = updateCall![1].config.sessionTemplates as Record<string, any>;
      const injectedArgs = saved['teaching'].mcpServers['live-lesson-tools'].args;

      expect(injectedArgs[0]).toBe(path.resolve(SOLUTION_PATH, 'mcp-server/dist/index.js'));
      expect(path.isAbsolute(injectedArgs[0])).toBe(true);
    });

    it('passes through an already-absolute path unchanged', async () => {
      const absolutePath = '/opt/mcp/server.js';
      const config = makeV3Config({
        mcpServers: { tools: mcpDef([absolutePath]) },
        sessionTemplates: { default: { enabledSkills: [] } },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      expect(saved['default'].mcpServers['tools'].args[0]).toBe(absolutePath);
    });

    it('passes through non-.js/.ts args unchanged', async () => {
      const config = makeV3Config({
        mcpServers: { tools: { type: 'stdio', command: 'python', args: ['-m', 'mymodule', '--port', '3000'] } },
        sessionTemplates: { default: { enabledSkills: [] } },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      expect(saved['default'].mcpServers['tools'].args).toEqual(['-m', 'mymodule', '--port', '3000']);
    });

    it('resolves .ts args as well as .js', async () => {
      const config = makeV3Config({
        mcpServers: { tools: { type: 'stdio', command: 'ts-node', args: ['src/server.ts'] } },
        sessionTemplates: { default: { enabledSkills: [] } },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      expect(saved['default'].mcpServers['tools'].args[0]).toBe(
        path.resolve(SOLUTION_PATH, 'src/server.ts'),
      );
    });

    it('injects MCP servers into a template that has no mcpServers', async () => {
      const config = makeV3Config({
        mcpServers: { tools: mcpDef(['dist/index.js']) },
        sessionTemplates: { teaching: { enabledSkills: [] } },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      expect(saved['teaching'].mcpServers).toBeDefined();
      expect(saved['teaching'].mcpServers['tools']).toBeDefined();
    });

    it('does NOT overwrite a template that already declares its own mcpServers', async () => {
      const ownMcpServers = { 'custom-tools': { command: 'node', args: ['/custom/server.js'] } };
      const config = makeV3Config({
        mcpServers: { 'solution-tools': mcpDef(['mcp-server/dist/index.js']) },
        sessionTemplates: {
          custom: { enabledSkills: [], mcpServers: ownMcpServers } as any,
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      expect(saved['custom'].mcpServers).toEqual(ownMcpServers);
      expect(saved['custom'].mcpServers['solution-tools']).toBeUndefined();
    });

    it('does not inject anything when solution has no MCP servers', async () => {
      const config = makeV3Config({
        mcpServers: {},
        sessionTemplates: { teaching: { enabledSkills: [] } },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      expect(saved['teaching'].mcpServers).toBeUndefined();
    });

    it('excludes toolEventTriggers from the injected session mcpServers', async () => {
      const config = makeV3Config({
        mcpServers: {
          tools: mcpDef(['mcp-server/dist/index.js'], {
            toolEventTriggers: [{ toolName: 'advance_beat', eventType: 'output_update' }],
          }),
        },
        sessionTemplates: { teaching: { enabledSkills: [] } },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      const injectedServer = saved['teaching'].mcpServers?.['tools'];
      expect(injectedServer).toBeDefined();
      expect(injectedServer.toolEventTriggers).toBeUndefined();
    });

    it('leaves path traversal args unchanged and logs a warning', async () => {
      const config = makeV3Config({
        mcpServers: { tools: mcpDef(['../../outside/server.js']) },
        sessionTemplates: { default: { enabledSkills: [] } },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      // Arg must NOT be resolved to an absolute path (guard fired)
      expect(saved['default'].mcpServers['tools'].args[0]).toBe('../../outside/server.js');
    });

    it('injects into all templates that lack mcpServers', async () => {
      const config = makeV3Config({
        mcpServers: { tools: mcpDef(['mcp-server/dist/index.js']) },
        sessionTemplates: {
          alpha: { enabledSkills: [] },
          beta:  { enabledSkills: [] },
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const saved = findTemplateUpdateCall(tenants.update)![1].config.sessionTemplates as Record<string, any>;
      expect(saved['alpha'].mcpServers?.['tools']).toBeDefined();
      expect(saved['beta'].mcpServers?.['tools']).toBeDefined();
    });
  });

  // ==========================================================================
  // loadAll
  // ==========================================================================

  describe('loadAll', () => {
    it('returns empty result when no solutions found', async () => {
      const result = await loader.loadAll();

      expect(result.loaded).toEqual([]);
      expect(result.failed).toEqual([]);
      expect(result.totalSolutions).toBe(0);
    });

    it('loads a solution end-to-end', async () => {
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata()]);

      const result = await loader.loadAll();

      expect(result.loaded).toHaveLength(1);
      expect(result.loaded[0].slug).toBe('test-solution');
    });

    it('skips solutions with discovery.enabled = false', async () => {
      const disabled = makeSolutionMetadata({
        config: makeV3Config({ discovery: { enabled: false } }),
      });
      scanner.scanSolutions.mockResolvedValue([disabled]);

      const result = await loader.loadAll();

      expect(result.loaded).toHaveLength(0);
      expect(result.totalSolutions).toBe(0);
    });

    it('handles solution loading failure gracefully', async () => {
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata()]);
      tenants.findOne.mockReset();
      tenants.findOne.mockRejectedValue(new Error('DB connection failed'));

      const result = await loader.loadAll();

      expect(result.loaded).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('DB connection failed');
    });

    it('clears stale tool triggers before loading', async () => {
      await loader.loadAll();

      expect(eventMapper.clearAllTenantToolTriggers).toHaveBeenCalledTimes(1);
    });

    it('registers toolEventTriggers with eventMapper', async () => {
      const config = makeV3Config({
        mcpServers: {
          tools: mcpDef(['dist/index.js'], {
            toolEventTriggers: [{ toolName: 'advance_beat', eventType: 'output_update' }],
          }),
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      expect(eventMapper.registerTenantToolTriggers).toHaveBeenCalledWith(
        'tenant-123',
        [{ toolName: 'advance_beat', eventType: 'output_update' }],
      );
    });
  });

  // ==========================================================================
  // loadOne
  // ==========================================================================

  describe('loadOne', () => {
    it('loads a solution by slug', async () => {
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata()]);

      const result = await loader.loadOne('test-solution');

      expect(result.slug).toBe('test-solution');
    });

    it('throws when solution slug not found', async () => {
      scanner.scanSolutions.mockResolvedValue([]);

      await expect(loader.loadOne('nonexistent')).rejects.toThrow(
        'Solution "nonexistent" not found',
      );
    });
  });

  // ==========================================================================
  // Tenant registration
  // ==========================================================================

  describe('tenant registration', () => {
    it('reuses an existing tenant without creating a new one', async () => {
      tenants.findOne.mockReset();
      tenants.findOne
        .mockResolvedValueOnce({ id: 'existing-123', slug: 'test-solution' } as any)
        .mockResolvedValue({ id: 'existing-123', config: {} } as any);
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata()]);

      const result = await loader.loadAll();

      expect(tenants.create).not.toHaveBeenCalled();
      expect(result.loaded[0].tenantId).toBe('existing-123');
    });

    it('creates a new tenant when none exists', async () => {
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata()]);

      const result = await loader.loadAll();

      expect(tenants.create).toHaveBeenCalledWith({
        name: 'Test Solution',
        slug: 'test-solution',
        description: 'A test',
      });
      expect(result.loaded[0].tenantId).toBe('tenant-123');
    });
  });

  // ==========================================================================
  // MCP server pool registration (DB records)
  // ==========================================================================

  describe('MCP server pool registration', () => {
    it('creates a new MCP server record in the DB', async () => {
      const config = makeV3Config({
        mcpServers: {
          'live-lesson-tools': mcpDef(['mcp-server/dist/index.js'], { description: 'Live Lesson tools' }),
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      const result = await loader.loadAll();

      expect(mcpPool.create).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({
          slug: 'live-lesson-tools',
          config: expect.objectContaining({ command: 'node' }),
        }),
      );
      expect(result.loaded[0].mcpServers[0].action).toBe('created');
    });

    it('updates an existing MCP server record', async () => {
      const config = makeV3Config({
        mcpServers: { tools: mcpDef(['dist/index.js']) },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);
      mcpPool.findOne.mockResolvedValue({ id: 'mcp-existing', slug: 'tools' } as any);

      const result = await loader.loadAll();

      expect(mcpPool.update).toHaveBeenCalledTimes(1);
      expect(mcpPool.create).not.toHaveBeenCalled();
      expect(result.loaded[0].mcpServers[0].action).toBe('updated');
    });

    it('marks MCP server as skipped on creation failure', async () => {
      const config = makeV3Config({
        mcpServers: { tools: mcpDef(['dist/index.js']) },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);
      mcpPool.create.mockRejectedValue(new Error('Port conflict'));

      const result = await loader.loadAll();

      expect(result.loaded[0].mcpServers[0].action).toBe('skipped');
      expect(result.loaded[0].mcpServers[0].error).toContain('Port conflict');
    });
  });

  // ==========================================================================
  // Bundle enabledBundles auto-sync
  // ==========================================================================

  describe('Bundle enabledBundles auto-sync (advanced mode)', () => {
    it('syncs enabledBundles from session template bundles to tenant config', async () => {
      const config = makeV3Config({
        mode: 'advanced',
        sessionTemplates: {
          lesson: {
            enabledSkills: [],
            bundles: ['structured-output', 'file-attachments'],
          },
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      // Find the update call that writes enabledBundles
      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeDefined();
      expect(bundleUpdateCall![1].config.enabledBundles).toEqual(
        expect.arrayContaining(['structured-output', 'file-attachments']),
      );
    });

    it('merges with existing tenant enabledBundles without duplicates', async () => {
      // Tenant already has 'structured-output'
      tenants.findOne.mockReset();
      tenants.findOne
        .mockResolvedValueOnce(null) // ensureTenant: slug lookup → not found
        .mockResolvedValue({
          id: 'tenant-123',
          slug: 'test-solution',
          config: { enabledBundles: ['structured-output'] },
        });

      const config = makeV3Config({
        mode: 'advanced',
        sessionTemplates: {
          lesson: {
            enabledSkills: [],
            bundles: ['structured-output', 'file-attachments'],
          },
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeDefined();
      const bundles = bundleUpdateCall![1].config.enabledBundles as string[];
      expect(bundles).toContain('structured-output');
      expect(bundles).toContain('file-attachments');
      expect(bundles.length).toBe(2); // no duplicates
    });

    it('skips update when all template bundles already enabled', async () => {
      tenants.findOne.mockReset();
      tenants.findOne
        .mockResolvedValueOnce(null) // ensureTenant
        .mockResolvedValue({
          id: 'tenant-123',
          slug: 'test-solution',
          config: { enabledBundles: ['structured-output'] },
        });

      const config = makeV3Config({
        mode: 'advanced',
        sessionTemplates: {
          lesson: {
            enabledSkills: [],
            bundles: ['structured-output'],
          },
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      // Should NOT have an enabledBundles update call (only solutionAppliedAt + sessionTemplates)
      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeUndefined();
    });

    it('collects bundles from multiple session templates', async () => {
      const config = makeV3Config({
        mode: 'advanced',
        sessionTemplates: {
          lesson: {
            enabledSkills: [],
            bundles: ['structured-output'],
          },
          review: {
            enabledSkills: [],
            bundles: ['file-attachments'],
          },
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeDefined();
      const bundles = bundleUpdateCall![1].config.enabledBundles as string[];
      expect(bundles).toContain('structured-output');
      expect(bundles).toContain('file-attachments');
    });

    it('passes synced enabledBundles to resolveActiveBundles for trigger registration', async () => {
      // After sync, tenant should have enabledBundles; resolveActiveBundles should receive them
      tenants.findOne.mockReset();
      tenants.findOne
        .mockResolvedValueOnce(null) // ensureTenant: slug lookup → not found
        // Step 3b pre-sync read: no bundles yet
        .mockResolvedValueOnce({ id: 'tenant-123', slug: 'test-solution', config: {} })
        // Step 4 re-read after sync: now has enabledBundles
        .mockResolvedValueOnce({
          id: 'tenant-123',
          slug: 'test-solution',
          config: { enabledBundles: ['structured-output'] },
        })
        // Step 5 applySessionTemplates read
        .mockResolvedValue({
          id: 'tenant-123',
          slug: 'test-solution',
          config: { enabledBundles: ['structured-output'] },
        });

      bundleService.resolveActiveBundles.mockReturnValue({
        mcpServers: {},
        toolEventTriggers: [
          { toolName: 'write_output', eventType: 'output_update' },
        ],
        appendSystemPrompts: [],
        activeBundleIds: ['structured-output'],
      });

      const config = makeV3Config({
        mode: 'advanced',
        sessionTemplates: {
          lesson: {
            enabledSkills: [],
            bundles: ['structured-output'],
          },
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      // resolveActiveBundles should receive the synced enabledBundles, NOT empty array
      expect(bundleService.resolveActiveBundles).toHaveBeenCalledWith(
        undefined,
        ['structured-output'],
      );

      // eventMapper should get the bundle triggers
      expect(eventMapper.registerTenantToolTriggers).toHaveBeenCalledWith(
        'tenant-123',
        expect.arrayContaining([
          { toolName: 'write_output', eventType: 'output_update' },
        ]),
      );
    });

    it('does nothing when session templates have no bundles', async () => {
      const config = makeV3Config({
        mode: 'advanced',
        sessionTemplates: {
          default: { enabledSkills: [] },
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      // No enabledBundles update call
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
    it('simple mode (default): auto-enables all built-in bundles', async () => {
      // No mode field → defaults to 'simple'
      const config = makeV3Config();
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

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
      const config = makeV3Config({
        mode: 'advanced',
        sessionTemplates: {
          lesson: {
            enabledSkills: [],
            bundles: ['structured-output'],
          },
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeDefined();
      const bundles = bundleUpdateCall![1].config.enabledBundles as string[];
      expect(bundles).toContain('structured-output');
      expect(bundles).not.toContain('file-attachments');
      expect(bundles).not.toContain('shared-context');
    });

    it('advanced mode: does not auto-enable bundles when no session templates declare bundles', async () => {
      const config = makeV3Config({
        mode: 'advanced',
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      const bundleUpdateCall = tenants.update.mock.calls.find(
        ([, p]) => p?.config?.enabledBundles !== undefined,
      );
      expect(bundleUpdateCall).toBeUndefined();
    });

    it('simple mode: filters out shared-context-server from solution mcpServers', async () => {
      const config = makeV3Config({
        mcpServers: {
          'solution-tools': mcpDef(['mcp-server/dist/index.js']),
          'shared-context-server': mcpDef(['shared-context-server/dist/index.js']),
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

      // solution-tools should be registered, shared-context-server should not
      expect(mcpPool.create).toHaveBeenCalledWith(
        'tenant-123',
        expect.objectContaining({ slug: 'solution-tools' }),
      );
      // Check that shared-context-server was NOT passed to mcpPool.create
      const createCalls = mcpPool.create.mock.calls.map(([, dto]: any) => dto.slug);
      expect(createCalls).not.toContain('shared-context-server');
    });

    it('advanced mode: does NOT filter shared-context-server from solution mcpServers', async () => {
      const config = makeV3Config({
        mode: 'advanced',
        mcpServers: {
          'shared-context-server': mcpDef(['shared-context-server/dist/index.js']),
        },
      });
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata({ config })]);

      await loader.loadAll();

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

    it('updates lastLoadAt and counts after loadAll', async () => {
      scanner.scanSolutions.mockResolvedValue([makeSolutionMetadata()]);

      await loader.loadAll();

      const status = loader.getStatus();
      expect(status.lastLoadAt).toBeInstanceOf(Date);
      expect(status.solutionsLoaded).toBe(1);
    });
  });
});
