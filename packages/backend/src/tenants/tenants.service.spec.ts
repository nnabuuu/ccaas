/**
 * Tenants Service Tests
 *
 * Unit tests for tenant management business logic including auto-create API key feature.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { AlreadyExistsException } from '../protocol/http-exceptions';
import { ConfigService } from '@nestjs/config';
import { TenantsService } from './tenants.service';
import { Tenant, PLAN_DEFAULT_SESSION_TTL_MS, PLAN_MAX_SESSION_TTL_MS } from './entities/tenant.entity';
import { ApiKeyService } from '../auth/api-key.service';
import { QuotaService } from '../admin/quota.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('TenantsService', () => {
  let service: TenantsService;
  let tenantRepository: jest.Mocked<Repository<Tenant>>;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockApiKeyService = {
      create: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('default'),
    };

    const mockQuotaService = {
      createDefaultQuota: jest.fn().mockResolvedValue({}),
      checkQuota: jest.fn(),
      incrementTokenUsage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockRepository,
        },
        {
          provide: ApiKeyService,
          useValue: mockApiKeyService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: QuotaService,
          useValue: mockQuotaService,
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    tenantRepository = module.get(getRepositoryToken(Tenant));
    apiKeyService = module.get(ApiKeyService) as jest.Mocked<ApiKeyService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('create - without auto-create API key', () => {
    it('should create tenant without API key by default', async () => {
      const dto = {
        name: 'Test Tenant',
        slug: 'test-tenant',
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'active',
        createdAt: new Date(),
        config: {},
        maxSessions: 100,
        maxSkills: 50,
        plan: 'free',
      };

      tenantRepository.findOne.mockResolvedValue(null); // No existing tenant
      tenantRepository.create.mockReturnValue(mockTenant as any);
      tenantRepository.save.mockResolvedValue(mockTenant as any);

      const result = await service.create(dto);

      expect(result.tenant).toBeDefined();
      expect(result.tenant.id).toBe('tenant-123');
      expect(result.apiKey).toBeUndefined();
      expect(result.rawKey).toBeUndefined();
      expect(result.warning).toBeUndefined();

      expect(apiKeyService.create).not.toHaveBeenCalled();
    });

    it('should create tenant without API key when autoCreateApiKey is false', async () => {
      const dto = {
        name: 'Test Tenant',
        slug: 'test-tenant',
        autoCreateApiKey: false,
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'active',
        createdAt: new Date(),
        config: {},
        maxSessions: 100,
        maxSkills: 50,
        plan: 'free',
      };

      tenantRepository.findOne.mockResolvedValue(null);
      tenantRepository.create.mockReturnValue(mockTenant as any);
      tenantRepository.save.mockResolvedValue(mockTenant as any);

      const result = await service.create(dto);

      expect(result.tenant).toBeDefined();
      expect(result.apiKey).toBeUndefined();
      expect(apiKeyService.create).not.toHaveBeenCalled();
    });
  });

  describe('create - with auto-create API key', () => {
    it('should create tenant with API key when autoCreateApiKey is true', async () => {
      const dto = {
        name: 'Test Tenant',
        slug: 'test-tenant',
        autoCreateApiKey: true,
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'active',
        createdAt: new Date(),
        config: {},
        maxSessions: 100,
        maxSkills: 50,
        plan: 'free',
      };

      const mockApiKeyResponse = {
        apiKey: {
          id: 'key-456',
          name: 'Default API Key for Test Tenant',
          keyPrefix: 'sk-testtena-abc',
          scopes: ['skills:read', 'skills:execute', 'chat'],
          rateLimitRpm: 60,
          rateLimitRpd: 10000,
          status: 'active',
          expiresAt: null,
          createdAt: new Date(),
        },
        rawKey: 'sk-testtena-abc123xyz789...',
      };

      tenantRepository.findOne.mockResolvedValue(null);
      tenantRepository.create.mockReturnValue(mockTenant as any);
      tenantRepository.save.mockResolvedValue(mockTenant as any);
      apiKeyService.create.mockResolvedValue(mockApiKeyResponse as any);

      const result = await service.create(dto);

      expect(result.tenant).toBeDefined();
      expect(result.tenant.id).toBe('tenant-123');

      expect(result.apiKey).toBeDefined();
      expect(result.apiKey?.id).toBe('key-456');
      expect(result.apiKey?.name).toBe('Default API Key for Test Tenant');
      expect(result.apiKey?.keyPrefix).toBe('sk-testtena-abc');
      expect(result.apiKey?.scopes).toEqual(['skills:read', 'skills:execute', 'chat']);

      expect(result.rawKey).toBe('sk-testtena-abc123xyz789...');
      expect(result.warning).toContain('only time');

      expect(apiKeyService.create).toHaveBeenCalledWith('tenant-123', {
        name: 'Default API Key for Test Tenant',
        scopes: ['skills:read', 'skills:execute', 'chat'],
      });
    });

    it('should use tenant name in API key name', async () => {
      const dto = {
        name: 'My Solution Company',
        slug: 'my-solution',
        autoCreateApiKey: true,
      };

      const mockTenant = {
        id: 'tenant-999',
        name: 'My Solution Company',
        slug: 'my-solution',
        status: 'active',
        createdAt: new Date(),
        config: {},
        maxSessions: 100,
        maxSkills: 50,
        plan: 'free',
      };

      const mockApiKeyResponse = {
        apiKey: {
          id: 'key-789',
          name: 'Default API Key for My Solution Company',
          keyPrefix: 'sk-mysolution-xyz',
          scopes: ['skills:read', 'skills:execute', 'chat'],
          rateLimitRpm: 60,
          rateLimitRpd: 10000,
          status: 'active',
          expiresAt: null,
          createdAt: new Date(),
        },
        rawKey: 'sk-mysolution-xyz123...',
      };

      tenantRepository.findOne.mockResolvedValue(null);
      tenantRepository.create.mockReturnValue(mockTenant as any);
      tenantRepository.save.mockResolvedValue(mockTenant as any);
      apiKeyService.create.mockResolvedValue(mockApiKeyResponse as any);

      const result = await service.create(dto);

      expect(apiKeyService.create).toHaveBeenCalledWith('tenant-999', {
        name: 'Default API Key for My Solution Company',
        scopes: ['skills:read', 'skills:execute', 'chat'],
      });

      expect(result.apiKey?.name).toBe('Default API Key for My Solution Company');
    });
  });

  describe('create - slug generation', () => {
    it('should generate slug from name if not provided', async () => {
      const dto = {
        name: 'My Test Company',
      };

      const mockTenant = {
        id: 'tenant-123',
        name: 'My Test Company',
        slug: 'my-test-company',
        status: 'active',
        createdAt: new Date(),
        config: {},
        maxSessions: 100,
        maxSkills: 50,
        plan: 'free',
      };

      tenantRepository.findOne.mockResolvedValue(null);
      tenantRepository.create.mockImplementation((data: any) => ({
        ...mockTenant,
        ...data,
      } as any));
      tenantRepository.save.mockResolvedValue(mockTenant as any);

      const result = await service.create(dto);

      expect(result.tenant.slug).toBe('my-test-company');
    });

    it('should throw AlreadyExistsException if slug already exists', async () => {
      const dto = {
        name: 'Test Tenant',
        slug: 'existing-slug',
      };

      const existingTenant = {
        id: 'tenant-existing',
        slug: 'existing-slug',
      };

      tenantRepository.findOne.mockResolvedValue(existingTenant as any);

      await expect(service.create(dto)).rejects.toThrow(AlreadyExistsException);
      await expect(service.create(dto)).rejects.toThrow("Tenant with slug 'existing-slug' already exists");
    });
  });

  describe('findAll', () => {
    it('should return all active tenants', async () => {
      const mockTenants = [
        { id: 'tenant-1', name: 'Tenant 1', status: 'active' },
        { id: 'tenant-2', name: 'Tenant 2', status: 'active' },
      ];

      tenantRepository.find.mockResolvedValue(mockTenants as any);

      const result = await service.findAll();

      expect(result).toEqual(mockTenants);
      expect(tenantRepository.find).toHaveBeenCalledWith({
        where: { status: 'active' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findOne', () => {
    it('should find tenant by ID', async () => {
      const mockTenant = { id: 'tenant-123', name: 'Test', slug: 'test' };

      tenantRepository.findOne.mockResolvedValue(mockTenant as any);

      const result = await service.findOne('tenant-123');

      expect(result).toEqual(mockTenant);
      expect(tenantRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'tenant-123' },
      });
    });

    it('should find tenant by slug if ID not found', async () => {
      const mockTenant = { id: 'tenant-123', name: 'Test', slug: 'test-slug' };

      tenantRepository.findOne
        .mockResolvedValueOnce(null) // First call (by ID) returns null
        .mockResolvedValueOnce(mockTenant as any); // Second call (by slug) returns tenant

      const result = await service.findOne('test-slug');

      expect(result).toEqual(mockTenant);
      expect(tenantRepository.findOne).toHaveBeenCalledTimes(2);
      expect(tenantRepository.findOne).toHaveBeenNthCalledWith(1, { where: { id: 'test-slug' } });
      expect(tenantRepository.findOne).toHaveBeenNthCalledWith(2, { where: { slug: 'test-slug' } });
    });

    it('should return null if tenant not found', async () => {
      tenantRepository.findOne.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('plan-tier TTL', () => {
    it('create() defaults sessionTtlMs to plan default (free→300000)', async () => {
      const dto = { name: 'Free Tenant', slug: 'free-tenant' };
      const mockTenant = {
        id: 'tenant-free',
        name: 'Free Tenant',
        slug: 'free-tenant',
        status: 'active',
        createdAt: new Date(),
        config: {},
        maxSessions: 100,
        maxSkills: 50,
        plan: 'free',
        sessionTtlMs: 300000,
      };

      tenantRepository.findOne.mockResolvedValue(null);
      tenantRepository.create.mockImplementation((data: any) => ({ ...mockTenant, ...data } as any));
      tenantRepository.save.mockResolvedValue(mockTenant as any);

      const result = await service.create(dto);
      // effectiveTtl('free', undefined) should return PLAN_DEFAULT_SESSION_TTL_MS['free'] = 300000
      expect(tenantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sessionTtlMs: PLAN_DEFAULT_SESSION_TTL_MS['free'] }),
      );
    });

    it('create() defaults sessionTtlMs to plan default (starter→1800000)', async () => {
      const dto = { name: 'Starter Tenant', slug: 'starter-tenant', plan: 'starter' as const };
      const mockTenant = {
        id: 'tenant-starter',
        name: 'Starter Tenant',
        slug: 'starter-tenant',
        status: 'active',
        createdAt: new Date(),
        config: {},
        maxSessions: 100,
        maxSkills: 50,
        plan: 'starter',
        sessionTtlMs: 1800000,
      };

      tenantRepository.findOne.mockResolvedValue(null);
      tenantRepository.create.mockImplementation((data: any) => ({ ...mockTenant, ...data } as any));
      tenantRepository.save.mockResolvedValue(mockTenant as any);

      await service.create(dto);
      expect(tenantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sessionTtlMs: PLAN_DEFAULT_SESSION_TTL_MS['starter'] }),
      );
    });

    it('create() caps sessionTtlMs at plan max (free tenant cannot get 1800000)', async () => {
      const dto = { name: 'Free Tenant', slug: 'free-capped', sessionTtlMs: 1800000 };
      const mockTenant = {
        id: 'tenant-free-capped',
        name: 'Free Tenant',
        slug: 'free-capped',
        status: 'active',
        createdAt: new Date(),
        config: {},
        maxSessions: 100,
        maxSkills: 50,
        plan: 'free',
        sessionTtlMs: 300000, // capped to free max
      };

      tenantRepository.findOne.mockResolvedValue(null);
      tenantRepository.create.mockImplementation((data: any) => ({ ...mockTenant, ...data } as any));
      tenantRepository.save.mockResolvedValue(mockTenant as any);

      await service.create(dto);
      expect(tenantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ sessionTtlMs: PLAN_MAX_SESSION_TTL_MS['free'] }),
      );
    });

    it('update() re-caps sessionTtlMs when plan changes', async () => {
      const mockTenant = {
        id: 'tenant-upd',
        name: 'Tenant',
        slug: 'tenant-upd',
        status: 'active',
        config: {},
        plan: 'starter',
        sessionTtlMs: 1800000,
        save: jest.fn(),
      };

      tenantRepository.findOne.mockResolvedValue(mockTenant as any);
      tenantRepository.save.mockResolvedValue({ ...mockTenant, plan: 'free', sessionTtlMs: 300000 } as any);

      await service.update('tenant-upd', { plan: 'free' });

      // After downgrade to free, sessionTtlMs should be capped at 300000
      expect(tenantRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ plan: 'free', sessionTtlMs: PLAN_MAX_SESSION_TTL_MS['free'] }),
      );
    });

    it('effectiveTtl() returns plan default when no requested value', () => {
      expect(service.effectiveTtl('free')).toBe(300000);
      expect(service.effectiveTtl('starter')).toBe(1800000);
      expect(service.effectiveTtl('professional')).toBe(1800000);
      expect(service.effectiveTtl('enterprise')).toBe(1800000);
    });

    it('effectiveTtl() caps requested value at plan max', () => {
      expect(service.effectiveTtl('free', 1800000)).toBe(300000);
      expect(service.effectiveTtl('free', 60000)).toBe(60000);
      expect(service.effectiveTtl('starter', 1800000)).toBe(1800000);
      expect(service.effectiveTtl('starter', 900000)).toBe(900000);
    });
  });

  describe('update', () => {
    it('should update tenant', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Old Name',
        slug: 'test',
        status: 'active',
        config: {},
      };

      const updatedTenant = {
        ...mockTenant,
        name: 'New Name',
      };

      tenantRepository.findOne.mockResolvedValue(mockTenant as any);
      tenantRepository.save.mockResolvedValue(updatedTenant as any);

      const result = await service.update('tenant-123', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(tenantRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if tenant not found', async () => {
      tenantRepository.findOne.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'New' })).rejects.toThrow(NotFoundException);
      await expect(service.update('nonexistent', { name: 'New' })).rejects.toThrow('Tenant not found: nonexistent');
    });
  });

  describe('syncSessionTemplates', () => {
    const baseTenant = {
      id: 'tenant-123',
      name: 'Test Tenant',
      slug: 'test-tenant',
      status: 'active',
      plan: 'free' as const,
      config: {},
      maxSessions: 100,
      maxSkills: 50,
      sessionTtlMs: PLAN_DEFAULT_SESSION_TTL_MS['free'],
      createdAt: new Date(),
    };

    it('should merge incoming templates with existing ones (upsert — no deletions)', async () => {
      const existingTemplate = { description: 'Old template' };
      const tenantWithTemplates = {
        ...baseTenant,
        config: { sessionTemplates: { existing: existingTemplate } },
      };
      tenantRepository.findOne.mockResolvedValue(tenantWithTemplates as any);
      tenantRepository.save.mockResolvedValue({ ...tenantWithTemplates } as any);

      const count = await service.syncSessionTemplates('tenant-123', {
        newTemplate: { description: 'New template' },
      });

      expect(count).toBe(1);
      const saved = tenantRepository.save.mock.calls[0][0] as any;
      expect(saved.config.sessionTemplates).toHaveProperty('existing'); // not deleted
      expect(saved.config.sessionTemplates).toHaveProperty('newTemplate');
    });

    it('should cap sessionTtlMs at the plan maximum', async () => {
      tenantRepository.findOne.mockResolvedValue({ ...baseTenant, plan: 'free' } as any);
      tenantRepository.save.mockResolvedValue(baseTenant as any);

      const planMax = PLAN_MAX_SESSION_TTL_MS['free'];
      await service.syncSessionTemplates('tenant-123', {
        tmpl: { sessionTtlMs: planMax * 10 }, // way above max
      });

      const saved = tenantRepository.save.mock.calls[0][0] as any;
      expect(saved.config.sessionTemplates.tmpl.sessionTtlMs).toBe(planMax);
    });

    it('should preserve undefined sessionTtlMs without capping', async () => {
      tenantRepository.findOne.mockResolvedValue(baseTenant as any);
      tenantRepository.save.mockResolvedValue(baseTenant as any);

      await service.syncSessionTemplates('tenant-123', {
        tmpl: { description: 'No TTL' },
      });

      const saved = tenantRepository.save.mock.calls[0][0] as any;
      expect(saved.config.sessionTemplates.tmpl.sessionTtlMs).toBeUndefined();
    });

    it('should return the count of templates in the incoming payload', async () => {
      tenantRepository.findOne.mockResolvedValue(baseTenant as any);
      tenantRepository.save.mockResolvedValue(baseTenant as any);

      const count = await service.syncSessionTemplates('tenant-123', {
        t1: { description: 'A' },
        t2: { description: 'B' },
        t3: { description: 'C' },
      });

      expect(count).toBe(3);
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      tenantRepository.findOne.mockResolvedValue(null);

      await expect(
        service.syncSessionTemplates('nonexistent', { tmpl: {} }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
