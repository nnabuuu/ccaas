/**
 * Solution + API Key Creation Integration Tests
 *
 * End-to-end tests for tenant creation with auto-create API key feature and authentication.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { TenantsModule } from '../../src/tenants/tenants.module';
import { AuthModule } from '../../src/auth/auth.module';
import { TenantsService } from '../../src/tenants/tenants.service';
import { ApiKeyService } from '../../src/auth/api-key.service';
import { Solution } from '../../src/solutions/entities/solution.entity';
import { createTestDatabaseModule } from '../setup/test-database';
import { ValidationPipe } from '@nestjs/common';

describe('Solution + API Key Creation (Integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tenantsService: TenantsService;
  let apiKeyService: ApiKeyService;
  let adminApiKey: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              auth: {
                enableRateLimiting: false,
                allowAnonymous: false,
              },
              skills: {
                defaultTenantId: 'test-default',
              },
            }),
          ],
        }),
        createTestDatabaseModule(),
        TenantsModule,
        AuthModule,
      ],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    dataSource = module.get(DataSource);
    tenantsService = module.get(TenantsService);
    apiKeyService = module.get(ApiKeyService);

    // Create default tenant for testing
    const defaultTenant = await dataSource.getRepository(Solution).findOne({
      where: { slug: 'test-default' },
    });

    if (!defaultTenant) {
      const tenant = await tenantsService.create({
        name: 'Test Default Solution',
        slug: 'test-default',
      });

      // Create admin API key for testing
      const { rawKey } = await apiKeyService.create(tenant.tenant.id, {
        name: 'Test Admin Key',
        scopes: ['admin'],
      });
      adminApiKey = rawKey;
    } else {
      // Use existing key or create new one
      const keys = await apiKeyService.findByTenantId(defaultTenant.id);
      const adminKey = keys.find(k => k.scopes.includes('admin'));

      if (!adminKey) {
        const { rawKey } = await apiKeyService.create(defaultTenant.id, {
          name: 'Test Admin Key',
          scopes: ['admin'],
        });
        adminApiKey = rawKey;
      } else {
        // For tests, we need to generate a new key since we can't retrieve the raw key
        const { rawKey } = await apiKeyService.create(defaultTenant.id, {
          name: 'Test Admin Key 2',
          scopes: ['admin'],
        });
        adminApiKey = rawKey;
      }
    }
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.destroy();
    }
    if (app) {
      await app.close();
    }
  });

  describe('Authentication', () => {
    it('should reject unauthenticated tenant creation (401)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .send({
          name: 'Unauthorized Solution',
          slug: 'unauthorized',
        })
        .expect(401);
    });

    it('should reject non-admin tenant creation (403)', async () => {
      // Create non-admin key
      const defaultTenant = await dataSource.getRepository(Solution).findOne({
        where: { slug: 'test-default' },
      });

      const { rawKey: regularKey } = await apiKeyService.create(defaultTenant!.id, {
        name: 'Regular Key',
        scopes: ['chat', 'skills:read'], // No admin
      });

      await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', regularKey)
        .send({
          name: 'Forbidden Solution',
          slug: 'forbidden',
        })
        .expect(403);
    });

    it('should allow admin to create tenant (200)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'Admin Created Solution',
          slug: 'admin-created',
        })
        .expect(201);

      expect(response.body.tenant).toBeDefined();
      expect(response.body.tenant.slug).toBe('admin-created');
    });
  });

  describe('Backward Compatibility', () => {
    it('should create tenant without API key when autoCreateApiKey not specified', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'Legacy Solution',
          slug: 'legacy-tenant',
        })
        .expect(201);

      expect(response.body.tenant).toBeDefined();
      expect(response.body.tenant.slug).toBe('legacy-tenant');
      expect(response.body.apiKey).toBeUndefined();
      expect(response.body.rawKey).toBeUndefined();
      expect(response.body.warning).toBeUndefined();
    });

    it('should create tenant without API key when autoCreateApiKey is false', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'Explicit No Key Solution',
          slug: 'explicit-no-key',
          autoCreateApiKey: false,
        })
        .expect(201);

      expect(response.body.tenant).toBeDefined();
      expect(response.body.apiKey).toBeUndefined();
      expect(response.body.rawKey).toBeUndefined();
    });
  });

  describe('Auto-create API Key Feature', () => {
    it('should create tenant with API key via REST API', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'Integration Test Solution',
          slug: 'integration-test',
          autoCreateApiKey: true,
        })
        .expect(201);

      // Verify tenant
      expect(response.body.tenant).toBeDefined();
      expect(response.body.tenant.slug).toBe('integration-test');
      expect(response.body.tenant.name).toBe('Integration Test Solution');

      // Verify API key metadata
      expect(response.body.apiKey).toBeDefined();
      expect(response.body.apiKey.keyPrefix).toMatch(/^sk-integrat-/);
      expect(response.body.apiKey.name).toBe('Default API Key for Integration Test Solution');
      expect(response.body.apiKey.scopes).toEqual(['skills:read', 'skills:execute', 'chat']);
      expect(response.body.apiKey.rateLimitRpm).toBe(60);
      expect(response.body.apiKey.rateLimitRpd).toBe(10000);
      expect(response.body.apiKey.status).toBe('active');

      // Verify raw key
      expect(response.body.rawKey).toBeDefined();
      expect(response.body.rawKey).toMatch(/^sk-integrat-[a-zA-Z0-9_-]+$/);

      // Verify warning
      expect(response.body.warning).toBeDefined();
      expect(response.body.warning).toContain('only time');

      // Verify key works by making authenticated request
      const skillsResponse = await request(app.getHttpServer())
        .get('/api/v1/skills')
        .set('X-API-Key', response.body.rawKey)
        .expect(200);

      expect(skillsResponse.body).toBeDefined();
    });

    it('should use tenant name in API key name', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'My Custom Solution',
          slug: 'my-custom-solution',
          autoCreateApiKey: true,
        })
        .expect(201);

      expect(response.body.apiKey.name).toBe('Default API Key for My Custom Solution');
    });

    it('should verify API key is persisted in database', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'DB Persistence Test',
          slug: 'db-persistence-test',
          autoCreateApiKey: true,
        })
        .expect(201);

      const solutionId = response.body.tenant.id;
      const apiKeyId = response.body.apiKey.id;

      // Query database directly
      const keys = await apiKeyService.findByTenantId(solutionId);
      expect(keys.length).toBeGreaterThan(0);

      const createdKey = keys.find(k => k.id === apiKeyId);
      expect(createdKey).toBeDefined();
      expect(createdKey!.name).toBe('Default API Key for DB Persistence Test');
      expect(createdKey!.scopes).toEqual(['skills:read', 'skills:execute', 'chat']);
    });

    it('should create API key with correct tenant binding', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'Solution Binding Test',
          slug: 'tenant-binding-test',
          autoCreateApiKey: true,
        })
        .expect(201);

      const solutionId = response.body.tenant.id;
      const rawKey = response.body.rawKey;

      // Verify key is bound to correct tenant
      const context = await apiKeyService.createContext(rawKey);
      expect(context.solutionId).toBe(solutionId);
      expect(context.tenant?.slug).toBe('tenant-binding-test');
    });
  });

  describe('Error Handling', () => {
    it('should reject duplicate slug', async () => {
      // Create first tenant
      await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'Duplicate Test',
          slug: 'duplicate-slug',
          autoCreateApiKey: true,
        })
        .expect(201);

      // Try to create second tenant with same slug
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          name: 'Duplicate Test 2',
          slug: 'duplicate-slug',
          autoCreateApiKey: true,
        })
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .send({
          // Missing name
          slug: 'invalid-tenant',
        })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('Other Endpoints', () => {
    it('should protect GET /api/v1/tenants', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/tenants')
        .expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/tenants')
        .set('X-API-Key', adminApiKey)
        .expect(200);
    });

    it('should protect GET /api/v1/tenants/:id', async () => {
      const tenant = await tenantsService.create({
        name: 'Protected Solution',
        slug: 'protected-tenant',
      });

      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenant.tenant.id}`)
        .expect(401);

      await request(app.getHttpServer())
        .get(`/api/v1/tenants/${tenant.tenant.id}`)
        .set('X-API-Key', adminApiKey)
        .expect(200);
    });

    it('should protect PUT /api/v1/tenants/:id', async () => {
      const tenant = await tenantsService.create({
        name: 'Update Test',
        slug: 'update-test',
      });

      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenant.tenant.id}`)
        .send({ name: 'Updated Name' })
        .expect(401);

      await request(app.getHttpServer())
        .put(`/api/v1/tenants/${tenant.tenant.id}`)
        .set('X-API-Key', adminApiKey)
        .send({ name: 'Updated Name' })
        .expect(200);
    });
  });
});
