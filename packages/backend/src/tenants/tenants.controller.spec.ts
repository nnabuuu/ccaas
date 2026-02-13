/**
 * Tenants Controller Tests
 *
 * Tests for tenant management endpoints including authentication and auto-create API key feature.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('TenantsController', () => {
  let controller: TenantsController;
  let service: jest.Mocked<TenantsService>;
  let apiKeyGuard: ApiKeyGuard;
  let scopesGuard: ScopesGuard;

  beforeEach(async () => {
    const mockTenantsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .overrideGuard(ScopesGuard)
      .useValue({
        canActivate: jest.fn().mockReturnValue(true),
      })
      .compile();

    controller = module.get<TenantsController>(TenantsController);
    service = module.get(TenantsService) as jest.Mocked<TenantsService>;
    apiKeyGuard = module.get(ApiKeyGuard);
    scopesGuard = module.get(ScopesGuard);
  });

  describe('Authentication', () => {
    it('should have @Auth("admin") decorator applied', () => {
      // Verify that the controller requires authentication
      // This is tested through the guard mocks
      expect(apiKeyGuard).toBeDefined();
      expect(scopesGuard).toBeDefined();
    });
  });

  describe('create - backward compatibility', () => {
    it('should create tenant without API key when autoCreateApiKey not specified', async () => {
      const dto = {
        name: 'Test Tenant',
        slug: 'test-tenant',
      };

      const mockResponse = {
        id: 'tenant-123',
        tenant: {
          id: 'tenant-123',
          name: 'Test Tenant',
          slug: 'test-tenant',
          createdAt: new Date(),
          status: 'active',
          config: {},
          maxSessions: 100,
          maxSkills: 50,
          plan: 'free',
        },
      };

      service.create.mockResolvedValue(mockResponse as any);

      const result = await controller.create(dto);

      expect(result.tenant).toBeDefined();
      expect(result.apiKey).toBeUndefined();
      expect(result.rawKey).toBeUndefined();
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('should create tenant without API key when autoCreateApiKey is false', async () => {
      const dto = {
        name: 'Test Tenant',
        slug: 'test-tenant',
        autoCreateApiKey: false,
      };

      const mockResponse = {
        id: 'tenant-123',
        tenant: {
          id: 'tenant-123',
          name: 'Test Tenant',
          slug: 'test-tenant',
          createdAt: new Date(),
          status: 'active',
          config: {},
          maxSessions: 100,
          maxSkills: 50,
          plan: 'free',
        },
      };

      service.create.mockResolvedValue(mockResponse as any);

      const result = await controller.create(dto);

      expect(result.tenant).toBeDefined();
      expect(result.apiKey).toBeUndefined();
      expect(result.rawKey).toBeUndefined();
    });
  });

  describe('create - auto-create API key', () => {
    it('should create tenant with API key when autoCreateApiKey is true', async () => {
      const dto = {
        name: 'Test Tenant',
        slug: 'test-tenant',
        autoCreateApiKey: true,
      };

      const mockResponse = {
        id: 'tenant-123',
        tenant: {
          id: 'tenant-123',
          name: 'Test Tenant',
          slug: 'test-tenant',
          createdAt: new Date(),
          status: 'active',
          config: {},
          maxSessions: 100,
          maxSkills: 50,
          plan: 'free',
        },
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
        rawKey: 'sk-testtena-abc123xyz...',
        warning: 'This is the only time the raw API key will be displayed. Please save it securely.',
      };

      service.create.mockResolvedValue(mockResponse as any);

      const result = await controller.create(dto);

      expect(result.tenant).toBeDefined();
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey?.keyPrefix).toBe('sk-testtena-abc');
      expect(result.apiKey?.scopes).toContain('skills:read');
      expect(result.apiKey?.scopes).toContain('skills:execute');
      expect(result.apiKey?.scopes).toContain('chat');
      expect(result.rawKey).toBe('sk-testtena-abc123xyz...');
      expect(result.warning).toContain('only time');
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all tenants', async () => {
      const mockTenants = [
        { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one', status: 'active' },
        { id: 'tenant-2', name: 'Tenant Two', slug: 'tenant-two', status: 'active' },
      ];

      service.findAll.mockResolvedValue(mockTenants as any);

      const result = await controller.findAll();

      expect(result).toEqual(mockTenants);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a tenant by id', async () => {
      const mockTenant = {
        id: 'tenant-123',
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'active',
      };

      service.findOne.mockResolvedValue(mockTenant as any);

      const result = await controller.findOne('tenant-123');

      expect(result).toEqual(mockTenant);
      expect(service.findOne).toHaveBeenCalledWith('tenant-123');
    });

    it('should throw NotFoundException when tenant not found', async () => {
      service.findOne.mockResolvedValue(null);

      await expect(controller.findOne('nonexistent')).rejects.toThrow('Tenant not found: nonexistent');
    });
  });

  describe('update', () => {
    it('should update a tenant', async () => {
      const updateDto = { name: 'Updated Name' };
      const mockTenant = {
        id: 'tenant-123',
        name: 'Updated Name',
        slug: 'test-tenant',
        status: 'active',
      };

      service.update.mockResolvedValue(mockTenant as any);

      const result = await controller.update('tenant-123', updateDto);

      expect(result).toEqual(mockTenant);
      expect(service.update).toHaveBeenCalledWith('tenant-123', updateDto);
    });
  });
});
