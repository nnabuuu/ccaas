/**
 * Admin Builder Users Controller Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AlreadyExistsException } from '../../protocol/http-exceptions';
import { AdminBuilderUsersController } from './admin-builder-users.controller';
import { UsersService } from '../../users/users.service';
import { UserTenantService } from '../../users/user-tenant.service';
import { TenantsService } from '../../tenants/tenants.service';
import { ApiKeyService } from '../../auth/api-key.service';
import { AuditService } from '../services/audit.service';
import type { RequestContext, ApiKeyScope } from '../../auth/types';

describe('AdminBuilderUsersController', () => {
  let controller: AdminBuilderUsersController;
  let usersService: jest.Mocked<UsersService>;
  let tenantsService: jest.Mocked<TenantsService>;
  let userTenantService: jest.Mocked<UserTenantService>;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let auditService: jest.Mocked<AuditService>;

  const mockUser = {
    id: 'user-uuid',
    email: 'builder@example.com',
    name: 'Builder User',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTenant = {
    id: 'tenant-uuid',
    name: 'Builder Tenant',
    slug: 'builder-tenant',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserTenant = {
    id: 'ut-uuid',
    userId: 'user-uuid',
    tenantId: 'tenant-uuid',
    role: 'admin',
    isActive: true,
  };

  const mockApiKeyResult = {
    apiKey: {
      id: 'key-uuid',
      name: 'Builder Key for Builder User',
      keyPrefix: 'sk-builder-abc',
      scopes: ['builder'] as ApiKeyScope[],
      rateLimitRpm: 60,
      rateLimitRpd: 10000,
      status: 'active',
      expiresAt: null,
      createdAt: new Date(),
    },
    rawKey: 'sk-builder-abc1234567890abcdefghijklmnop',
  };

  const mockContext: RequestContext = {
    tenantId: 'admin-tenant-uuid',
    tenant: { id: 'admin-tenant-uuid' } as any,
    apiKeyId: 'admin-key-uuid',
    apiKeyScopes: ['admin'] as ApiKeyScope[],
    requestId: 'request-uuid',
    timestamp: new Date(),
    isAnonymous: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminBuilderUsersController],
      providers: [
        {
          provide: UsersService,
          useValue: { create: jest.fn() },
        },
        {
          provide: TenantsService,
          useValue: { create: jest.fn() },
        },
        {
          provide: UserTenantService,
          useValue: { create: jest.fn() },
        },
        {
          provide: ApiKeyService,
          useValue: { create: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AdminBuilderUsersController);
    usersService = module.get(UsersService);
    tenantsService = module.get(TenantsService);
    userTenantService = module.get(UserTenantService);
    apiKeyService = module.get(ApiKeyService);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function setupHappyPath() {
    usersService.create.mockResolvedValue(mockUser as any);
    tenantsService.create.mockResolvedValue({ id: mockTenant.id, tenant: mockTenant } as any);
    userTenantService.create.mockResolvedValue(mockUserTenant as any);
    apiKeyService.create.mockResolvedValue(mockApiKeyResult as any);
  }

  describe('create', () => {
    const dto = {
      email: 'builder@example.com',
      name: 'Builder User',
      tenantName: 'Builder Tenant',
    };

    it('should create user, tenant, user-tenant link, and API key', async () => {
      setupHappyPath();

      const result = await controller.create(dto, mockContext);

      expect(usersService.create).toHaveBeenCalledWith({
        email: 'builder@example.com',
        name: 'Builder User',
      });
      expect(tenantsService.create).toHaveBeenCalledWith({
        name: 'Builder Tenant',
        slug: undefined,
      });
      expect(userTenantService.create).toHaveBeenCalledWith({
        userId: 'user-uuid',
        tenantId: 'tenant-uuid',
        role: 'admin',
      });
      expect(apiKeyService.create).toHaveBeenCalledWith('tenant-uuid', {
        name: 'Builder Key for Builder User',
        scopes: ['builder'],
        userId: 'user-uuid',
      });

      expect(result.user.id).toBe('user-uuid');
      expect(result.user.email).toBe('builder@example.com');
      expect(result.tenant.id).toBe('tenant-uuid');
      expect(result.tenant.slug).toBe('builder-tenant');
      expect(result.apiKey.id).toBe('key-uuid');
      expect(result.rawKey).toBe(mockApiKeyResult.rawKey);
      expect(result.warning).toContain('only time');
    });

    it('should pass tenantSlug when provided', async () => {
      const dtoWithSlug = { ...dto, tenantSlug: 'custom-slug' };
      setupHappyPath();

      await controller.create(dtoWithSlug, mockContext);

      expect(tenantsService.create).toHaveBeenCalledWith({
        name: 'Builder Tenant',
        slug: 'custom-slug',
      });
    });

    it('should create audit log with correct metadata (no email PII)', async () => {
      setupHappyPath();

      await controller.create(dto, mockContext);

      expect(auditService.log).toHaveBeenCalledWith({
        adminId: 'admin-key-uuid',
        action: 'builderUser.create',
        targetType: 'user',
        targetId: 'user-uuid',
        tenantId: 'tenant-uuid',
        metadata: {
          name: 'Builder User',
          tenantSlug: 'builder-tenant',
          apiKeyPrefix: 'sk-builder-abc',
        },
      });

      // Verify email is NOT in audit metadata
      const auditCall = auditService.log.mock.calls[0][0];
      expect(JSON.stringify(auditCall.metadata)).not.toContain('builder@example.com');
    });

    it('should throw 409 when email already exists', async () => {
      usersService.create.mockRejectedValue(
        new AlreadyExistsException('User with email builder@example.com already exists'),
      );

      await expect(controller.create(dto, mockContext)).rejects.toThrow(
        AlreadyExistsException,
      );
      expect(tenantsService.create).not.toHaveBeenCalled();
    });

    it('should throw 409 when tenant slug conflicts', async () => {
      usersService.create.mockResolvedValue(mockUser as any);
      tenantsService.create.mockRejectedValue(
        new AlreadyExistsException("Tenant with slug 'builder-tenant' already exists"),
      );

      await expect(controller.create(dto, mockContext)).rejects.toThrow(
        AlreadyExistsException,
      );
      expect(apiKeyService.create).not.toHaveBeenCalled();
    });

    it('should propagate error when user-tenant link fails', async () => {
      usersService.create.mockResolvedValue(mockUser as any);
      tenantsService.create.mockResolvedValue({ id: mockTenant.id, tenant: mockTenant } as any);
      userTenantService.create.mockRejectedValue(new Error('DB connection lost'));

      await expect(controller.create(dto, mockContext)).rejects.toThrow('DB connection lost');
      expect(apiKeyService.create).not.toHaveBeenCalled();
    });

    it('should propagate error when API key creation fails', async () => {
      usersService.create.mockResolvedValue(mockUser as any);
      tenantsService.create.mockResolvedValue({ id: mockTenant.id, tenant: mockTenant } as any);
      userTenantService.create.mockResolvedValue(mockUserTenant as any);
      apiKeyService.create.mockRejectedValue(new Error('Key hash collision'));

      await expect(controller.create(dto, mockContext)).rejects.toThrow('Key hash collision');
      expect(auditService.log).not.toHaveBeenCalled();
    });
  });
});
