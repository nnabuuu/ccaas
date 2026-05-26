/**
 * Solutions Module Tests
 *
 * Verifies that the NestJS module correctly wires together
 * SolutionLoaderService with its dependencies.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SolutionLoaderService } from './solution-loader.service';
import { EventMapperService } from '../sessions/event-mapper.service';
import { BundleService } from '../bundles/bundle.service';

// ---------------------------------------------------------------------------
// Mocks for external service dependencies
// ---------------------------------------------------------------------------

const mockTenantsService = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockSkillsService = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  publish: jest.fn(),
};

const mockMcpPoolService = {
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockBundleService = {
  resolveActiveBundles: jest.fn().mockReturnValue({
    mcpServers: {},
    toolEventTriggers: [],
    appendSystemPrompts: [],
    activeBundleIds: [],
  }),
  getAvailableBundles: jest.fn().mockReturnValue([]),
};

describe('SolutionLoaderModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: SolutionLoaderService,
          useFactory: (tenants, skills, mcpPool, eventMapper, bundleService) =>
            new SolutionLoaderService(
              tenants,
              skills,
              mcpPool,
              eventMapper,
              bundleService,
              { get: () => undefined } as any, // ConfigService — no SOLUTIONS_DIR
            ),
          inject: [
            'SolutionsService',
            'SkillsService',
            'McpPoolService',
            EventMapperService,
            BundleService,
          ],
        },
        { provide: 'SolutionsService', useValue: mockTenantsService },
        { provide: 'SkillsService', useValue: mockSkillsService },
        { provide: 'McpPoolService', useValue: mockMcpPoolService },
        {
          provide: EventMapperService,
          useValue: { registerTenantToolTriggers: jest.fn(), clearAllTenantToolTriggers: jest.fn() },
        },
        { provide: BundleService, useValue: mockBundleService },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module?.close();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should resolve SolutionLoaderService', () => {
    const service = module.get<SolutionLoaderService>(SolutionLoaderService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(SolutionLoaderService);
  });

  it('SolutionLoaderService should have importFromConfig and getStatus', () => {
    const loader = module.get<SolutionLoaderService>(SolutionLoaderService);
    expect(typeof loader.importFromConfig).toBe('function');
    expect(typeof loader.getStatus).toBe('function');
  });

  describe('module metadata', () => {
    it('SolutionLoaderModule should be importable', async () => {
      const { SolutionLoaderModule } = await import('./solution-loader.module');
      expect(SolutionLoaderModule).toBeDefined();
    });

    it('SolutionLoaderModule should export SolutionLoaderService', async () => {
      const { SolutionLoaderModule } = await import('./solution-loader.module');
      const exports = Reflect.getMetadata('exports', SolutionLoaderModule);
      expect(exports).toBeDefined();
      expect(exports).toContain(SolutionLoaderService);
    });

    it('SolutionLoaderModule should declare SolutionLoaderService as provider', async () => {
      const { SolutionLoaderModule } = await import('./solution-loader.module');
      const providers = Reflect.getMetadata('providers', SolutionLoaderModule);
      expect(providers).toBeDefined();
      expect(providers).toContain(SolutionLoaderService);
    });
  });
});
