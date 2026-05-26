/**
 * Admin Users Controller Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AlreadyExistsException } from '../../protocol/http-exceptions';
import { AdminUsersController } from './admin-users.controller';
import { UsersService } from '../../users/users.service';
import { UserSolutionService } from '../../users/user-solution.service';
import { SolutionsService } from '../../solutions/solutions.service';
import { ApiKeyService } from '../../auth/api-key.service';
import { AuditService } from '../services/audit.service';
import type { RequestContext, ApiKeyScope } from '../../auth/types';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let usersService: jest.Mocked<UsersService>;
  let userTenantService: jest.Mocked<UserSolutionService>;
  let tenantsService: jest.Mocked<SolutionsService>;
  let apiKeyService: jest.Mocked<ApiKeyService>;
  let auditService: jest.Mocked<AuditService>;

  const TENANT_ID = '00000000-0000-4000-a000-000000000001';
  const USER_ID = '00000000-0000-4000-a000-000000000002';
  const UT_ID = '00000000-0000-4000-a000-000000000003';
  const KEY_ID = '00000000-0000-4000-a000-000000000004';
  const ADMIN_KEY_ID = '00000000-0000-4000-a000-000000000005';
  const BUILDER_KEY_ID = '00000000-0000-4000-a000-000000000006';
  const OTHER_TENANT_ID = '00000000-0000-4000-a000-000000000099';

  const mockTenant = {
    id: TENANT_ID,
    slug: 'default',
    name: 'Default Solution',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: USER_ID,
    email: 'test@example.com',
    name: 'Test User',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    tenants: [],
  };

  const mockUserTenant = {
    id: UT_ID,
    userId: USER_ID,
    solutionId: TENANT_ID,
    role: 'viewer' as const,
    canCreateSkills: false,
    isActive: true,
    joinedAt: new Date(),
    user: mockUser,
    tenant: mockTenant,
  };

  const mockApiKeyResult = {
    apiKey: {
      id: KEY_ID,
      name: 'Chat key for Test User',
      keyPrefix: 'sk-default-abc',
      scopes: ['chat'] as ApiKeyScope[],
      rateLimitRpm: 60,
      rateLimitRpd: 10000,
      status: 'active' as const,
      expiresAt: null,
      createdAt: new Date(),
    },
    rawKey: 'sk-default-abc1234567890abcdefghijklmnop',
  };

  const adminCtx: RequestContext = {
    solutionId: TENANT_ID,
    tenant: mockTenant as any,
    apiKeyId: ADMIN_KEY_ID,
    apiKeyScopes: ['admin'] as ApiKeyScope[],
    requestId: '00000000-0000-4000-a000-000000000010',
    timestamp: new Date(),
    isAnonymous: false,
  };

  const builderCtx: RequestContext = {
    solutionId: TENANT_ID,
    tenant: mockTenant as any,
    apiKeyId: BUILDER_KEY_ID,
    apiKeyScopes: ['builder'] as ApiKeyScope[],
    requestId: '00000000-0000-4000-a000-000000000011',
    timestamp: new Date(),
    isAnonymous: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
            findByEmail: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: UserSolutionService,
          useValue: {
            create: jest.fn(),
            findByTenant: jest.fn(),
            countByTenant: jest.fn(),
            findUserInTenant: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: SolutionsService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: ApiKeyService,
          useValue: {
            create: jest.fn(),
            revokeByUserId: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminUsersController);
    usersService = module.get(UsersService);
    userTenantService = module.get(UserSolutionService);
    tenantsService = module.get(SolutionsService);
    apiKeyService = module.get(ApiKeyService);
    auditService = module.get(AuditService);
  });

  describe('findAll', () => {
    it('should list users for a tenant', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      userTenantService.countByTenant.mockResolvedValue(1);
      userTenantService.findByTenant.mockResolvedValue([mockUserTenant as any]);

      const result = await controller.findAll(TENANT_ID, '1', '50', undefined, undefined, undefined, adminCtx);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].email).toBe('test@example.com');
      expect(result.items[0].role).toBe('viewer');
      expect(userTenantService.findByTenant).toHaveBeenCalledWith(TENANT_ID, { skip: 0, take: 50, filter: {} });
    });

    it('should throw if solutionId missing (admin scope)', async () => {
      await expect(
        controller.findAll('', '1', '50', undefined, undefined, undefined, adminCtx),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if tenant not found', async () => {
      tenantsService.findOne.mockResolvedValue(null);

      await expect(
        controller.findAll('nonexistent', '1', '50', undefined, undefined, undefined, adminCtx),
      ).rejects.toThrow(NotFoundException);
    });

    it('should force builder to own tenant', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      userTenantService.countByTenant.mockResolvedValue(0);
      userTenantService.findByTenant.mockResolvedValue([]);

      await controller.findAll(OTHER_TENANT_ID, '1', '50', undefined, undefined, undefined, builderCtx);

      // Should have called findByTenant with builder's own solutionId, not OTHER_TENANT_ID
      expect(userTenantService.findByTenant).toHaveBeenCalledWith(TENANT_ID, { skip: 0, take: 50, filter: {} });
    });

    it('should pass search filter to service', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      userTenantService.countByTenant.mockResolvedValue(0);
      userTenantService.findByTenant.mockResolvedValue([]);

      await controller.findAll(TENANT_ID, '1', '20', 'john', undefined, undefined, adminCtx);

      expect(userTenantService.findByTenant).toHaveBeenCalledWith(TENANT_ID, {
        skip: 0,
        take: 20,
        filter: { search: 'john' },
      });
      expect(userTenantService.countByTenant).toHaveBeenCalledWith(TENANT_ID, { search: 'john' });
    });

    it('should pass role filter to service', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      userTenantService.countByTenant.mockResolvedValue(0);
      userTenantService.findByTenant.mockResolvedValue([]);

      await controller.findAll(TENANT_ID, '1', '20', undefined, 'developer', undefined, adminCtx);

      expect(userTenantService.findByTenant).toHaveBeenCalledWith(TENANT_ID, {
        skip: 0,
        take: 20,
        filter: { role: 'developer' },
      });
    });

    it('should pass status filter to service', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      userTenantService.countByTenant.mockResolvedValue(0);
      userTenantService.findByTenant.mockResolvedValue([]);

      await controller.findAll(TENANT_ID, '1', '20', undefined, undefined, 'active', adminCtx);

      expect(userTenantService.findByTenant).toHaveBeenCalledWith(TENANT_ID, {
        skip: 0,
        take: 20,
        filter: { status: 'active' },
      });
    });

    it('should ignore invalid role values', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      userTenantService.countByTenant.mockResolvedValue(0);
      userTenantService.findByTenant.mockResolvedValue([]);

      await controller.findAll(TENANT_ID, '1', '20', undefined, 'invalid-role', undefined, adminCtx);

      expect(userTenantService.findByTenant).toHaveBeenCalledWith(TENANT_ID, {
        skip: 0,
        take: 20,
        filter: {},
      });
    });
  });

  describe('create', () => {
    it('should create user + tenant link + API key', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      usersService.create.mockResolvedValue(mockUser as any);
      userTenantService.create.mockResolvedValue(mockUserTenant as any);
      apiKeyService.create.mockResolvedValue(mockApiKeyResult as any);

      const result = await controller.create(
        {
          email: 'test@example.com',
          name: 'Test User',
          solutionId: TENANT_ID,
        },
        adminCtx,
      );

      expect(result.user.id).toBe(USER_ID);
      expect(result.rawKey).toBe(mockApiKeyResult.rawKey);
      expect(result.warning).toContain('only time');
      expect(usersService.create).toHaveBeenCalledWith({
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(userTenantService.create).toHaveBeenCalledWith({
        userId: USER_ID,
        solutionId: TENANT_ID,
        role: 'viewer',
      });
      expect(apiKeyService.create).toHaveBeenCalledWith(TENANT_ID, {
        name: 'Chat key for Test User',
        scopes: ['chat'],
        userId: USER_ID,
      });
      expect(auditService.log).toHaveBeenCalled();
    });

    it('should use specified role', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      usersService.create.mockResolvedValue(mockUser as any);
      userTenantService.create.mockResolvedValue(mockUserTenant as any);
      apiKeyService.create.mockResolvedValue(mockApiKeyResult as any);

      await controller.create(
        {
          email: 'dev@example.com',
          name: 'Dev User',
          solutionId: TENANT_ID,
          role: 'developer',
        },
        adminCtx,
      );

      expect(userTenantService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'developer' }),
      );
    });

    it('should throw 409 on duplicate email', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      usersService.create.mockRejectedValue(
        new AlreadyExistsException('User with email test@example.com already exists'),
      );

      await expect(
        controller.create(
          {
            email: 'test@example.com',
            name: 'Test User',
            solutionId: TENANT_ID,
          },
          adminCtx,
        ),
      ).rejects.toThrow(AlreadyExistsException);
    });

    it('should throw if tenant not found', async () => {
      tenantsService.findOne.mockResolvedValue(null);

      await expect(
        controller.create(
          {
            email: 'test@example.com',
            name: 'Test User',
            solutionId: 'nonexistent',
          },
          adminCtx,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should force builder solutionId to own tenant', async () => {
      tenantsService.findOne.mockResolvedValue(mockTenant as any);
      usersService.create.mockResolvedValue(mockUser as any);
      userTenantService.create.mockResolvedValue(mockUserTenant as any);
      apiKeyService.create.mockResolvedValue(mockApiKeyResult as any);

      await controller.create(
        {
          email: 'new@example.com',
          name: 'New User',
          solutionId: OTHER_TENANT_ID,
        },
        builderCtx,
      );

      // Builder's solutionId should be forced
      expect(tenantsService.findOne).toHaveBeenCalledWith(TENANT_ID);
    });
  });

  describe('findOne', () => {
    it('should return user with tenant associations', async () => {
      const userWithTenants = {
        ...mockUser,
        tenants: [mockUserTenant],
      };
      usersService.findOne.mockResolvedValue(userWithTenants as any);

      const result = await controller.findOne(USER_ID, adminCtx);

      expect(result.id).toBe(USER_ID);
      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0].role).toBe('viewer');
    });

    it('should throw on invalid UUID', async () => {
      await expect(
        controller.findOne('not-a-uuid', adminCtx),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deny builder access to other tenant user', async () => {
      const otherTenantUser = {
        ...mockUser,
        tenants: [{ ...mockUserTenant, solutionId: OTHER_TENANT_ID, isActive: true }],
      };
      usersService.findOne.mockResolvedValue(otherTenantUser as any);

      await expect(
        controller.findOne(USER_ID, builderCtx),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should update user name', async () => {
      const existing = { ...mockUser, tenants: [mockUserTenant] };
      const updated = { ...mockUser, name: 'Updated Name' };
      usersService.findOne.mockResolvedValue(existing as any);
      usersService.update.mockResolvedValue(updated as any);

      const result = await controller.update(
        USER_ID,
        { name: 'Updated Name' },
        adminCtx,
      );

      expect(result.name).toBe('Updated Name');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.update' }),
      );
    });

    it('should throw on invalid UUID', async () => {
      await expect(
        controller.update('not-a-uuid', { name: 'x' }, adminCtx),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deny builder access to other tenant user', async () => {
      const otherTenantUser = {
        ...mockUser,
        tenants: [{ ...mockUserTenant, solutionId: OTHER_TENANT_ID, isActive: true }],
      };
      usersService.findOne.mockResolvedValue(otherTenantUser as any);

      await expect(
        controller.update(USER_ID, { name: 'Hacked' }, builderCtx),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRole', () => {
    it('should update user role in tenant', async () => {
      const existing = { ...mockUser, tenants: [mockUserTenant] };
      usersService.findOne.mockResolvedValue(existing as any);
      userTenantService.findUserInTenant.mockResolvedValue(mockUserTenant as any);
      userTenantService.update.mockResolvedValue({
        ...mockUserTenant,
        role: 'admin',
        canCreateSkills: true,
      } as any);

      const result = await controller.updateRole(
        USER_ID,
        { role: 'admin' },
        adminCtx,
      );

      expect(result.role).toBe('admin');
      expect(result.canCreateSkills).toBe(true);
      expect(userTenantService.update).toHaveBeenCalledWith(UT_ID, { role: 'admin' });
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.role_update' }),
      );
    });

    it('should throw on invalid UUID', async () => {
      await expect(
        controller.updateRole('not-a-uuid', { role: 'admin' }, adminCtx),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deny builder access to other tenant user', async () => {
      const otherTenantUser = {
        ...mockUser,
        tenants: [{ ...mockUserTenant, solutionId: OTHER_TENANT_ID, isActive: true }],
      };
      usersService.findOne.mockResolvedValue(otherTenantUser as any);

      await expect(
        controller.updateRole(USER_ID, { role: 'admin' }, builderCtx),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw if user not in tenant', async () => {
      const existing = { ...mockUser, tenants: [mockUserTenant] };
      usersService.findOne.mockResolvedValue(existing as any);
      userTenantService.findUserInTenant.mockResolvedValue(null);

      await expect(
        controller.updateRole(USER_ID, { role: 'admin' }, adminCtx),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete user, revoke API keys, and deactivate tenant links', async () => {
      const existing = {
        ...mockUser,
        tenants: [mockUserTenant],
      };
      usersService.findOne.mockResolvedValue(existing as any);
      apiKeyService.revokeByUserId.mockResolvedValue(1);

      const result = await controller.remove(USER_ID, adminCtx);

      expect(result.success).toBe(true);
      expect(usersService.remove).toHaveBeenCalledWith(USER_ID);
      expect(apiKeyService.revokeByUserId).toHaveBeenCalledWith(USER_ID);
      expect(userTenantService.remove).toHaveBeenCalledWith(UT_ID);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.delete' }),
      );
    });

    it('should throw on invalid UUID', async () => {
      await expect(
        controller.remove('not-a-uuid', adminCtx),
      ).rejects.toThrow(BadRequestException);
    });

    it('should deny builder access to other tenant user', async () => {
      const otherUser = {
        ...mockUser,
        tenants: [{ ...mockUserTenant, solutionId: OTHER_TENANT_ID, isActive: true }],
      };
      usersService.findOne.mockResolvedValue(otherUser as any);

      await expect(
        controller.remove(USER_ID, builderCtx),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
