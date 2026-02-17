/**
 * Solutions Module Tests
 *
 * Verifies that the NestJS module correctly wires together all
 * solution auto-discovery services with their dependencies.
 *
 * Uses a manually constructed TestingModule to avoid pulling in the
 * full SkillsModule -> SessionsModule dependency chain.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SolutionScannerService } from './solution-scanner.service';
import { SkillMetadataParserService } from './skill-metadata-parser.service';
import { SolutionLoaderService } from './solution-loader.service';
import { SolutionConfigAdapter } from './solution-config-adapter';

// ---------------------------------------------------------------------------
// Mocks for external service dependencies
// ---------------------------------------------------------------------------

const mockTenantsService = {
  findOne: jest.fn(),
  create: jest.fn(),
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

describe('SolutionsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    // Replicate the provider wiring from SolutionsModule
    // but mock external dependencies to avoid circular module imports
    module = await Test.createTestingModule({
      providers: [
        SolutionScannerService,
        SkillMetadataParserService,
        SolutionConfigAdapter,
        {
          provide: SolutionLoaderService,
          useFactory: (scanner, parser, tenants, skills, mcpPool) =>
            new SolutionLoaderService(scanner, parser, tenants, skills, mcpPool),
          inject: [
            SolutionScannerService,
            SkillMetadataParserService,
            'TenantsService',
            'SkillsService',
            'McpPoolService',
          ],
        },
        { provide: 'TenantsService', useValue: mockTenantsService },
        { provide: 'SkillsService', useValue: mockSkillsService },
        { provide: 'McpPoolService', useValue: mockMcpPoolService },
      ],
    }).compile();
  });

  afterEach(async () => {
    await module?.close();
  });

  // =========================================================================
  // Module compilation
  // =========================================================================

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  // =========================================================================
  // Provider resolution
  // =========================================================================

  it('should resolve SolutionScannerService', () => {
    const service = module.get<SolutionScannerService>(SolutionScannerService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(SolutionScannerService);
  });

  it('should resolve SkillMetadataParserService', () => {
    const service = module.get<SkillMetadataParserService>(SkillMetadataParserService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(SkillMetadataParserService);
  });

  it('should resolve SolutionLoaderService', () => {
    const service = module.get<SolutionLoaderService>(SolutionLoaderService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(SolutionLoaderService);
  });

  it('should resolve SolutionConfigAdapter', () => {
    const adapter = module.get<SolutionConfigAdapter>(SolutionConfigAdapter);
    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(SolutionConfigAdapter);
  });

  // =========================================================================
  // Dependency injection correctness
  // =========================================================================

  describe('dependency injection', () => {
    it('all four providers should be distinct instances', () => {
      const scanner = module.get<SolutionScannerService>(SolutionScannerService);
      const parser = module.get<SkillMetadataParserService>(SkillMetadataParserService);
      const loader = module.get<SolutionLoaderService>(SolutionLoaderService);
      const adapter = module.get<SolutionConfigAdapter>(SolutionConfigAdapter);

      const instances = [scanner, parser, loader, adapter];
      const unique = new Set(instances);
      expect(unique.size).toBe(4);
    });

    it('SolutionLoaderService should be fully wired with dependencies', () => {
      const loader = module.get<SolutionLoaderService>(SolutionLoaderService);
      // If the loader resolves, its 5 constructor deps were injected:
      //   scanner, parser, tenantsService, skillsService, mcpPoolService
      expect(loader).toBeDefined();
      expect(loader.getStatus).toBeDefined();
      expect(typeof loader.loadAll).toBe('function');
      expect(typeof loader.loadOne).toBe('function');
      expect(typeof loader.getStatus).toBe('function');
    });

    it('SolutionScannerService should be usable independently', () => {
      const scanner = module.get<SolutionScannerService>(SolutionScannerService);
      expect(typeof scanner.scanSolutions).toBe('function');
      expect(typeof scanner.loadSolutionConfig).toBe('function');
    });

    it('SkillMetadataParserService should be usable independently', () => {
      const parser = module.get<SkillMetadataParserService>(SkillMetadataParserService);
      expect(typeof parser.parseSkillFile).toBe('function');
    });

    it('SolutionConfigAdapter should be usable independently', () => {
      const adapter = module.get<SolutionConfigAdapter>(SolutionConfigAdapter);
      expect(typeof adapter.adapt).toBe('function');
    });
  });

  // =========================================================================
  // Module metadata verification
  // =========================================================================

  describe('module metadata', () => {
    it('SolutionsModule should be importable', async () => {
      // Verify the module class itself has correct metadata
      const { SolutionsModule } = await import('./solutions.module');
      expect(SolutionsModule).toBeDefined();

      // Reflect metadata check
      const metadata = Reflect.getMetadata('imports', SolutionsModule);
      expect(metadata).toBeDefined();
      expect(Array.isArray(metadata)).toBe(true);
    });

    it('SolutionsModule should export providers', async () => {
      const { SolutionsModule } = await import('./solutions.module');
      const exports = Reflect.getMetadata('exports', SolutionsModule);
      expect(exports).toBeDefined();
      expect(exports).toContain(SolutionScannerService);
      expect(exports).toContain(SkillMetadataParserService);
      expect(exports).toContain(SolutionLoaderService);
      expect(exports).toContain(SolutionConfigAdapter);
    });

    it('SolutionsModule should declare providers', async () => {
      const { SolutionsModule } = await import('./solutions.module');
      const providers = Reflect.getMetadata('providers', SolutionsModule);
      expect(providers).toBeDefined();
      expect(providers).toContain(SolutionScannerService);
      expect(providers).toContain(SkillMetadataParserService);
      expect(providers).toContain(SolutionLoaderService);
      expect(providers).toContain(SolutionConfigAdapter);
    });

    it('SolutionsModule should import SkillsModule', async () => {
      const { SolutionsModule } = await import('./solutions.module');
      const { SkillsModule } = await import('../skills/skills.module');
      const imports = Reflect.getMetadata('imports', SolutionsModule);
      expect(imports).toContain(SkillsModule);
    });
  });
});
