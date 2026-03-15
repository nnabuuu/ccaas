/**
 * Admin API Keys Controller Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminApiKeysController } from './admin-api-keys.controller';
import { ApiKeyService } from '../../auth/api-key.service';
import { TenantsService } from '../../tenants/tenants.service';
import { AuditService } from '../services/audit.service';
import { UserTenantService } from '../../users/user-tenant.service';
import type { RequestContext, ApiKeyScope } from '../../auth/types';
import type {
  ApiKeyResponse,
  CreateApiKeyResponse,
} from '../../auth/dto/api-key.dto';

describe('AdminApiKeysController', () => {
  let controller: AdminApiKeysController;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let tenantsService: jest.Mocked<TenantsService>;
  let auditService: jest.Mocked<AuditService>;

  const mockTenant = {
    id: 'tenant-uuid',
    slug: 'default',
    name: 'Default Tenant',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApiKeyResponse: ApiKeyResponse = {
    id: 'key-uuid',
    tenantId: 'tenant-uuid',
    name: 'Test Key',
    keyPrefix: 'sk-default-abc',
    scopes: ['chat', 'skills:read'] as ApiKeyScope[],
    rateLimitRpm: 60,
    rateLimitRpd: 10000,
    lastUsedAt: null,
    usageCount: 0,
    status: 'active',
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateResponse: CreateApiKeyResponse = {
    apiKey: {
      id: 'key-uuid',
      name: 'Test Key',
      keyPrefix: 'sk-default-abc',
      scopes: ['chat', 'skills:read'] as ApiKeyScope[],
      rateLimitRpm: 60,
      rateLimitRpd: 10000,
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
    },
    rawKey: 'sk-default-abc1234567890abcdefghijklmnop',
  };

  const mockContext: RequestContext = {
    tenantId: 'tenant-uuid',
    tenant: mockTenant as any,
    apiKeyId: 'admin-key-uuid',
    apiKeyScopes: ['admin'] as ApiKeyScope[],
    requestId: 'request-uuid',
    timestamp: new Date(),
    isAnonymous: false,
  };

  beforeEach(async () => {
    // Create mocks
    const mockApiKeyService = {
      findByTenantId: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      revoke: jest.fn(),
      delete: jest.fn(),
    };

    const mockTenantsService = {
      findOne: jest.fn(),
    };

    const mockAuditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminApiKeysController],
      providers: [
        { provide: ApiKeyService, useValue: mockApiKeyService },
        { provide: TenantsService, useValue: mockTenantsService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: UserTenantService, useValue: { findUserInTenant: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AdminApiKeysController>(AdminApiKeysController);
    apiKeyService = module.get(ApiKeyService);
    tenantsService = module.get(TenantsService);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated API keys', async () => {
      const keys = [mockApiKeyResponse, { ...mockApiKeyResponse, id: 'key-2' }];
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      apiKeyService.findByTenantId.mockResolvedValue(keys);

      const result = await controller.findAll('tenant-uuid', '1', '50');

      expect(tenantsService.findOne).toHaveBeenCalledWith('tenant-uuid');
      expect(apiKeyService.findByTenantId).toHaveBeenCalledWith('tenant-uuid');
      expect(result).toEqual({
        items: keys,
        total: 2,
        page: 1,
        limit: 50,
      });
    });

    it('should throw BadRequestException when tenantId missing', async () => {
      await expect(controller.findAll('', '1', '50')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when tenant not found', async () => {
      tenantsService.findOne.mockResolvedValue(null);

      await expect(
        controller.findAll('nonexistent', '1', '50'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should limit to max 100 per page', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      apiKeyService.findByTenantId.mockResolvedValue([]);

      const result = await controller.findAll('tenant-uuid', '1', '200');

      expect(result.limit).toBe(100);
    });

    it('should apply pagination correctly', async () => {
      const keys = Array.from({ length: 10 }, (_, i) => ({
        ...mockApiKeyResponse,
        id: `key-${i}`,
      }));
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      apiKeyService.findByTenantId.mockResolvedValue(keys);

      const result = await controller.findAll('tenant-uuid', '2', '3');

      expect(result.items).toHaveLength(3);
      expect(result.items[0].id).toBe('key-3'); // Second page starts at index 3
      expect(result.page).toBe(2);
      expect(result.total).toBe(10);
    });
  });

  describe('findOne', () => {
    it('should return a single API key', async () => {
      apiKeyService.findById.mockResolvedValue(mockApiKeyResponse);

      const result = await controller.findOne('550e8400-e29b-41d4-a716-446655440000', mockContext);

      expect(apiKeyService.findById).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
      );
      expect(result).toEqual(mockApiKeyResponse);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(controller.findOne('invalid-uuid', mockContext)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when key not found', async () => {
      apiKeyService.findById.mockResolvedValue(null);

      await expect(
        controller.findOne('550e8400-e29b-41d4-a716-446655440000', mockContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createDto = {
      tenantId: 'tenant-uuid',
      name: 'Test Key',
      scopes: ['chat', 'skills:read'] as ApiKeyScope[],
    };

    it('should create API key and return raw key with warning', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      apiKeyService.create.mockResolvedValue(mockCreateResponse);

      const result = await controller.create(createDto as any, mockContext);

      expect(tenantsService.findOne).toHaveBeenCalledWith('tenant-uuid');
      expect(apiKeyService.create).toHaveBeenCalledWith(
        'tenant-uuid',
        createDto,
      );
      expect(result.rawKey).toBe(mockCreateResponse.rawKey);
      expect(result.warning).toContain('only time');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'apikey.create',
          targetType: 'apikey',
        }),
      );
    });

    it('should create audit log entry', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      apiKeyService.create.mockResolvedValue(mockCreateResponse);

      await controller.create(createDto as any, mockContext);

      expect(auditService.log).toHaveBeenCalledWith({
        adminId: 'admin-key-uuid',
        action: 'apikey.create',
        targetType: 'apikey',
        targetId: 'key-uuid',
        tenantId: 'tenant-uuid',
        metadata: expect.objectContaining({
          name: 'Test Key',
          keyPrefix: 'sk-default-abc',
          scopes: ['chat', 'skills:read'],
        }),
      });
    });

    it('should validate tenant exists', async () => {
      tenantsService.findOne.mockResolvedValue(null);

      await expect(
        controller.create(createDto as any, mockContext),
      ).rejects.toThrow(NotFoundException);
    });

    it('should never log raw key or hash in audit', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      apiKeyService.create.mockResolvedValue(mockCreateResponse);

      await controller.create(createDto as any, mockContext);

      const auditCall = auditService.log.mock.calls[0][0];
      expect(JSON.stringify(auditCall)).not.toContain('rawKey');
      expect(JSON.stringify(auditCall)).not.toContain('keyHash');
    });
  });

  describe('update', () => {
    const updateDto = {
      name: 'Updated Name',
      scopes: ['chat', 'skills:write'] as ApiKeyScope[],
    };

    it('should update API key properties', async () => {
      apiKeyService.findById.mockResolvedValue(mockApiKeyResponse);
      apiKeyService.update.mockResolvedValue({
        ...mockApiKeyResponse,
        ...updateDto,
      });

      const result = await controller.update(
        '550e8400-e29b-41d4-a716-446655440000',
        updateDto,
        mockContext,
      );

      expect(apiKeyService.update).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        updateDto,
      );
      expect(result.name).toBe('Updated Name');
    });

    it('should log before/after values in audit', async () => {
      apiKeyService.findById.mockResolvedValue(mockApiKeyResponse);
      apiKeyService.update.mockResolvedValue({
        ...mockApiKeyResponse,
        ...updateDto,
      });

      await controller.update(
        '550e8400-e29b-41d4-a716-446655440000',
        updateDto,
        mockContext,
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'apikey.update',
          metadata: expect.objectContaining({
            previousValue: expect.any(Object),
            newValue: expect.any(Object),
          }),
        }),
      );
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        controller.update('invalid-uuid', updateDto, mockContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when key not found', async () => {
      apiKeyService.findById.mockResolvedValue(null);

      await expect(
        controller.update(
          '550e8400-e29b-41d4-a716-446655440000',
          updateDto,
          mockContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('revoke', () => {
    it('should revoke active key', async () => {
      apiKeyService.findById
        .mockResolvedValueOnce(mockApiKeyResponse)
        .mockResolvedValueOnce({ ...mockApiKeyResponse, status: 'revoked' });

      const result = await controller.revoke(
        '550e8400-e29b-41d4-a716-446655440000',
        mockContext,
      );

      expect(apiKeyService.revoke).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
      );
      expect(result.status).toBe('revoked');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'apikey.revoke',
        }),
      );
    });

    it('should throw when already revoked', async () => {
      apiKeyService.findById.mockResolvedValue({
        ...mockApiKeyResponse,
        status: 'revoked',
      });

      await expect(
        controller.revoke('550e8400-e29b-41d4-a716-446655440000', mockContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        controller.revoke('invalid-uuid', mockContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when key not found', async () => {
      apiKeyService.findById.mockResolvedValue(null);

      await expect(
        controller.revoke('550e8400-e29b-41d4-a716-446655440000', mockContext),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should create audit log BEFORE deletion', async () => {
      apiKeyService.findById.mockResolvedValue(mockApiKeyResponse);
      apiKeyService.delete.mockResolvedValue();

      await controller.delete(
        '550e8400-e29b-41d4-a716-446655440000',
        mockContext,
      );

      // Verify audit was called before delete
      const auditCallOrder = auditService.log.mock.invocationCallOrder[0];
      const deleteCallOrder = apiKeyService.delete.mock.invocationCallOrder[0];
      expect(auditCallOrder).toBeLessThan(deleteCallOrder);
    });

    it('should return success message', async () => {
      apiKeyService.findById.mockResolvedValue(mockApiKeyResponse);
      apiKeyService.delete.mockResolvedValue();

      const result = await controller.delete(
        '550e8400-e29b-41d4-a716-446655440000',
        mockContext,
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('sk-default-abc');
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(
        controller.delete('invalid-uuid', mockContext),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when key not found', async () => {
      apiKeyService.findById.mockResolvedValue(null);

      await expect(
        controller.delete('550e8400-e29b-41d4-a716-446655440000', mockContext),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
