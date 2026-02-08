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
        TypeOrmModule.forFeature([ApiKey, User, UserTenant, Tenant]),
      ],
      providers: [ApiKeyService, TenantsService, UserTenantService, UsersService],
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

  describe('User Resolution', () => {
    it('should resolve user from API key', async () => {
      // Create tenant
      const tenant = await tenantsService.create({
        name: 'Test Tenant',
        slug: 'test-tenant',
      });

      // Create user
      const user = await usersService.create({
        email: 'test@example.com',
        name: 'Test User',
      });

      // Create user-tenant relationship
      await userTenantService.create({
        userId: user.id,
        tenantId: tenant.id,
        role: 'developer',
      });

      // Create API key with user
      const { rawKey, apiKey: createdKey } = await service.create(tenant.id, {
        name: 'Test Key',
        scopes: ['chat', 'skills:read'],
      });

      // Associate user with API key
      const apiKeyRepo = dataSource.getRepository(ApiKey);
      const apiKey = await apiKeyRepo.findOne({ where: { id: createdKey.id } });
      apiKey!.userId = user.id;
      await apiKeyRepo.save(apiKey!);

      // Validate key and check user resolution
      const context = await service.createContext(rawKey);

      expect(context.userId).toBe(user.id);
      expect(context.user).toBeDefined();
      expect(context.user!.email).toBe('test@example.com');
      expect(context.userTenant).toBeDefined();
      expect(context.userTenant!.role).toBe('developer');
      expect(context.isAnonymous).toBe(false);
    });

    it('should work without user (backward compatibility)', async () => {
      // Create tenant
      const tenant = await tenantsService.create({
        name: 'Legacy Tenant',
        slug: 'legacy-tenant',
      });

      // Create API key without user
      const { rawKey } = await service.create(tenant.id, {
        name: 'Legacy Key',
        scopes: ['chat'],
      });

      // Validate key (should work without user)
      const context = await service.createContext(rawKey);

      expect(context.userId).toBeUndefined();
      expect(context.user).toBeUndefined();
      expect(context.userTenant).toBeUndefined();
      expect(context.tenantId).toBe(tenant.id);
      expect(context.isAnonymous).toBe(false);
    });

    it('should reject if user is not active in tenant', async () => {
      // Create tenant
      const tenant = await tenantsService.create({
        name: 'Inactive User Tenant',
        slug: 'inactive-user-tenant',
      });

      // Create user
      const user = await usersService.create({
        email: 'inactive@example.com',
        name: 'Inactive User',
      });

      // Create user-tenant relationship (inactive)
      const userTenant = await userTenantService.create({
        userId: user.id,
        tenantId: tenant.id,
        role: 'developer',
      });

      // Deactivate user in tenant
      await userTenantService.update(userTenant.id, { isActive: false });

      // Create API key with user
      const { rawKey, apiKey: createdKey } = await service.create(tenant.id, {
        name: 'Inactive User Key',
        scopes: ['chat'],
      });

      // Associate user with API key
      const apiKeyRepo = dataSource.getRepository(ApiKey);
      const apiKey = await apiKeyRepo.findOne({ where: { id: createdKey.id } });
      apiKey!.userId = user.id;
      await apiKeyRepo.save(apiKey!);

      // Should reject
      await expect(service.createContext(rawKey)).rejects.toThrow(
        'User is not active in this tenant',
      );
    });

    it('should handle admin role correctly', async () => {
      // Create tenant
      const tenant = await tenantsService.create({
        name: 'Admin Tenant',
        slug: 'admin-tenant',
      });

      // Create user
      const user = await usersService.create({
        email: 'admin@example.com',
        name: 'Admin User',
      });

      // Create user-tenant relationship with admin role
      await userTenantService.create({
        userId: user.id,
        tenantId: tenant.id,
        role: 'admin',
      });

      // Create API key with user
      const { rawKey, apiKey: createdKey } = await service.create(tenant.id, {
        name: 'Admin Key',
        scopes: ['admin'],
      });

      // Associate user with API key
      const apiKeyRepo = dataSource.getRepository(ApiKey);
      const apiKey = await apiKeyRepo.findOne({ where: { id: createdKey.id } });
      apiKey!.userId = user.id;
      await apiKeyRepo.save(apiKey!);

      // Validate key
      const context = await service.createContext(rawKey);

      expect(context.userTenant!.role).toBe('admin');
      expect(context.userTenant!.canCreateSkills).toBe(true);
    });

    it('should handle viewer role correctly', async () => {
      // Create tenant
      const tenant = await tenantsService.create({
        name: 'Viewer Tenant',
        slug: 'viewer-tenant',
      });

      // Create user
      const user = await usersService.create({
        email: 'viewer@example.com',
        name: 'Viewer User',
      });

      // Create user-tenant relationship with viewer role
      await userTenantService.create({
        userId: user.id,
        tenantId: tenant.id,
        role: 'viewer',
      });

      // Create API key with user
      const { rawKey, apiKey: createdKey } = await service.create(tenant.id, {
        name: 'Viewer Key',
        scopes: ['chat'],
      });

      // Associate user with API key
      const apiKeyRepo = dataSource.getRepository(ApiKey);
      const apiKey = await apiKeyRepo.findOne({ where: { id: createdKey.id } });
      apiKey!.userId = user.id;
      await apiKeyRepo.save(apiKey!);

      // Validate key
      const context = await service.createContext(rawKey);

      expect(context.userTenant!.role).toBe('viewer');
      expect(context.userTenant!.canCreateSkills).toBe(false);
    });
  });
});
