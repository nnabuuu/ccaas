/**
 * ApiKeyService Integration Tests - User Resolution
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ApiKeyService } from './api-key.service';
import { TenantsService } from '../tenants/tenants.service';
import { UserTenantService } from '../users/user-tenant.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserTenant } from '../users/entities/user-tenant.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { ApiKey } from './entities/api-key.entity';
import { TenantQuota } from '../admin/entities/tenant-quota.entity';
import { QuotaService } from '../admin/quota.service';
import { createTestDatabaseModule } from '../../test/setup/test-database';
import { TypeOrmModule } from '@nestjs/typeorm';

describe('ApiKeyService - User Resolution Integration', () => {
  let service: ApiKeyService;
  let tenantsService: TenantsService;
  let userTenantService: UserTenantService;
  let usersService: UsersService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              auth: {
                enableRateLimiting: false,
                allowAnonymous: true,
              },
            }),
          ],
        }),
        createTestDatabaseModule(),
        TypeOrmModule.forFeature([ApiKey, User, UserTenant, Tenant, TenantQuota]),
      ],
      providers: [ApiKeyService, TenantsService, UserTenantService, UsersService, QuotaService],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    tenantsService = module.get<TenantsService>(TenantsService);
    userTenantService = module.get<UserTenantService>(UserTenantService);
    usersService = module.get<UsersService>(UsersService);

    // Get the datasource from the module
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.destroy();
    }
  });

  describe('rawKeyOverride (INITIAL_ADMIN_KEY support)', () => {
    let tenantId: string;

    beforeAll(async () => {
      const result = await tenantsService.create({
        name: 'Override Test Tenant',
        slug: 'override-test-tenant',
      });
      tenantId = result.id;
    });

    it('should use rawKeyOverride when valid sk- prefix and min length', async () => {
      const override = 'sk-test-override-12345'  // 22 chars, starts with sk-
      const { rawKey } = await service.create(tenantId, { name: 'Override Key', scopes: ['chat'] }, override)

      expect(rawKey).toBe(override)

      // Validate the key works for auth
      const context = await service.createContext(rawKey)
      expect(context.tenantId).toBe(tenantId)
    })

    it('should fall back to auto-generated key when override lacks sk- prefix', async () => {
      const override = 'no-prefix-key-long-enough'
      const { rawKey } = await service.create(tenantId, { name: 'No Prefix Key', scopes: ['chat'] }, override)

      expect(rawKey).not.toBe(override)
      expect(rawKey.startsWith('sk-')).toBe(true)
    })

    it('should fall back to auto-generated key when override is too short', async () => {
      const override = 'sk-short'  // Only 8 chars, below MIN_KEY_LENGTH of 20
      const { rawKey } = await service.create(tenantId, { name: 'Short Override Key', scopes: ['chat'] }, override)

      expect(rawKey).not.toBe(override)
      expect(rawKey.startsWith('sk-')).toBe(true)
      expect(rawKey.length).toBeGreaterThan(20)
    })

    it('should behave identically without rawKeyOverride (backward compat)', async () => {
      const { rawKey } = await service.create(tenantId, { name: 'No Override Key', scopes: ['chat'] })

      expect(rawKey.startsWith('sk-')).toBe(true)
      expect(rawKey.length).toBeGreaterThan(20)

      const context = await service.createContext(rawKey)
      expect(context.tenantId).toBe(tenantId)
    })

    it('should store override key as hash (raw key not retrievable from DB)', async () => {
      const override = 'sk-deterministic-key-ci'
      const { rawKey, apiKey } = await service.create(
        tenantId,
        { name: 'Hash Test Key', scopes: ['admin'] },
        override,
      )

      expect(rawKey).toBe(override)
      // keyPrefix is stored (first 16 chars), but full key is hashed
      expect(apiKey.keyPrefix).toBe(override.substring(0, 16))
    })
  })

  describe('User Resolution', () => {
    it('should resolve user from API key', async () => {
      const tenant = await tenantsService.create({ name: 'Test Tenant', slug: 'test-tenant' });
      const user = await usersService.create({ email: 'test@example.com', name: 'Test User' });
      await userTenantService.create({ userId: user.id, tenantId: tenant.id, role: 'developer' });
      const { rawKey, apiKey: createdKey } = await service.create(tenant.id, {
        name: 'Test Key',
        scopes: ['chat', 'skills:read'],
      });
      const apiKeyRepo = dataSource.getRepository(ApiKey);
      const apiKey = await apiKeyRepo.findOne({ where: { id: createdKey.id } });
      apiKey!.userId = user.id;
      await apiKeyRepo.save(apiKey!);

      const context = await service.createContext(rawKey);

      expect(context.userId).toBe(user.id);
      expect(context.user).toBeDefined();
      expect(context.user!.email).toBe('test@example.com');
      expect(context.userTenant).toBeDefined();
      expect(context.userTenant!.role).toBe('developer');
      expect(context.isAnonymous).toBe(false);
    });

    it('should work without user (backward compatibility)', async () => {
      const tenant = await tenantsService.create({ name: 'Legacy Tenant', slug: 'legacy-tenant' });
      const { rawKey } = await service.create(tenant.id, { name: 'Legacy Key', scopes: ['chat'] });

      const context = await service.createContext(rawKey);

      expect(context.userId).toBeUndefined();
      expect(context.user).toBeUndefined();
      expect(context.userTenant).toBeUndefined();
      expect(context.tenantId).toBe(tenant.id);
      expect(context.isAnonymous).toBe(false);
    });

    it('should reject if user is not active in tenant', async () => {
      const tenant = await tenantsService.create({ name: 'Inactive User Tenant', slug: 'inactive-user-tenant' });
      const user = await usersService.create({ email: 'inactive@example.com', name: 'Inactive User' });
      const userTenant = await userTenantService.create({ userId: user.id, tenantId: tenant.id, role: 'developer' });
      await userTenantService.update(userTenant.id, { isActive: false });
      const { rawKey, apiKey: createdKey } = await service.create(tenant.id, {
        name: 'Inactive User Key',
        scopes: ['chat'],
      });
      const apiKeyRepo = dataSource.getRepository(ApiKey);
      const apiKey = await apiKeyRepo.findOne({ where: { id: createdKey.id } });
      apiKey!.userId = user.id;
      await apiKeyRepo.save(apiKey!);

      await expect(service.createContext(rawKey)).rejects.toThrow('User is not active in this tenant');
    });

    it('should handle admin role correctly', async () => {
      const tenant = await tenantsService.create({ name: 'Admin Tenant', slug: 'admin-tenant' });
      const user = await usersService.create({ email: 'admin@example.com', name: 'Admin User' });
      await userTenantService.create({ userId: user.id, tenantId: tenant.id, role: 'admin' });
      const { rawKey, apiKey: createdKey } = await service.create(tenant.id, {
        name: 'Admin Key',
        scopes: ['admin'],
      });
      const apiKeyRepo = dataSource.getRepository(ApiKey);
      const apiKey = await apiKeyRepo.findOne({ where: { id: createdKey.id } });
      apiKey!.userId = user.id;
      await apiKeyRepo.save(apiKey!);

      const context = await service.createContext(rawKey);

      expect(context.userTenant!.role).toBe('admin');
      expect(context.userTenant!.canCreateSkills).toBe(true);
    });

    it('should handle viewer role correctly', async () => {
      const tenant = await tenantsService.create({ name: 'Viewer Tenant', slug: 'viewer-tenant' });
      const user = await usersService.create({ email: 'viewer@example.com', name: 'Viewer User' });
      await userTenantService.create({ userId: user.id, tenantId: tenant.id, role: 'viewer' });
      const { rawKey, apiKey: createdKey } = await service.create(tenant.id, {
        name: 'Viewer Key',
        scopes: ['chat'],
      });
      const apiKeyRepo = dataSource.getRepository(ApiKey);
      const apiKey = await apiKeyRepo.findOne({ where: { id: createdKey.id } });
      apiKey!.userId = user.id;
      await apiKeyRepo.save(apiKey!);

      const context = await service.createContext(rawKey);

      expect(context.userTenant!.role).toBe('viewer');
      expect(context.userTenant!.canCreateSkills).toBe(false);
    });
  });
});
