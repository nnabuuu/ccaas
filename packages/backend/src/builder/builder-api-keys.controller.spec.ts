import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BuilderApiKeysController } from './builder-api-keys.controller';
import type { RequestContext } from '../auth/types';

describe('BuilderApiKeysController', () => {
  let controller: BuilderApiKeysController;
  let apiKeyService: any;
  let tenantsService: any;
  let userTenantService: any;
  let auditService: any;

  const builderCtx: RequestContext = {
    tenantId: 'default',
    tenant: { id: 'default' } as any,
    apiKeyId: 'key-builder',
    apiKeyScopes: ['builder'],
    userId: 'user-1',
    requestId: 'req-1',
    timestamp: new Date(),
  };

  const noUserCtx: RequestContext = {
    ...builderCtx,
    userId: undefined,
  };

  beforeEach(() => {
    apiKeyService = {
      create: jest.fn(),
      findByTenantId: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      revoke: jest.fn(),
      delete: jest.fn(),
    };
    tenantsService = {
      findOne: jest.fn(),
    };
    userTenantService = {
      findUserInTenant: jest.fn(),
    };
    auditService = {
      log: jest.fn(),
    };

    controller = new BuilderApiKeysController(
      apiKeyService,
      tenantsService,
      userTenantService,
      auditService,
    );
  });

  // ── Auth checks ─────────────────────────────────────────────────────

  it('should throw 403 when no userId in context', async () => {
    await expect(
      controller.create('t1', { name: 'Key' } as any, noUserCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── create ──────────────────────────────────────────────────────────

  it('should create key for owned tenant', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });
    apiKeyService.create.mockResolvedValue({
      apiKey: { id: 'k1', keyPrefix: 'sk-test', scopes: ['chat'] },
      rawKey: 'sk-test-xxx',
    });

    const result = await controller.create('t1', { name: 'Key', scopes: ['chat'] } as any, builderCtx);

    expect(result.rawKey).toBe('sk-test-xxx');
    expect(result.warning).toBeDefined();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'apikey.create' }),
    );
  });

  it('should reject admin scope in new keys', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });

    await expect(
      controller.create('t1', { name: 'Key', scopes: ['admin'] } as any, builderCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should reject builder scope in new keys', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });

    await expect(
      controller.create('t1', { name: 'Key', scopes: ['builder'] } as any, builderCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should strip userId from child key creation', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });
    apiKeyService.create.mockResolvedValue({
      apiKey: { id: 'k1', keyPrefix: 'sk-test', scopes: ['chat'] },
      rawKey: 'sk-test-xxx',
    });

    const dto = { name: 'Key', scopes: ['chat'], userId: 'hacker-id' } as any;
    await controller.create('t1', dto, builderCtx);

    // userId should have been stripped before calling apiKeyService.create
    expect(apiKeyService.create).toHaveBeenCalledWith('t1', expect.objectContaining({ userId: undefined }));
  });

  it('should throw 403 for non-owned tenant', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue(null);

    await expect(
      controller.create('t1', { name: 'Key' } as any, builderCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── findAll ─────────────────────────────────────────────────────────

  it('should list keys for owned tenant', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });
    apiKeyService.findByTenantId.mockResolvedValue([{ id: 'k1' }, { id: 'k2' }]);

    const result = await controller.findAll('t1', builderCtx);
    expect(result).toHaveLength(2);
  });

  // ── update ──────────────────────────────────────────────────────────

  it('should update key for owned tenant', async () => {
    apiKeyService.findById.mockResolvedValue({ id: 'k1', tenantId: 't1', name: 'Old', scopes: ['chat'] });
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });
    apiKeyService.update.mockResolvedValue({ id: 'k1', name: 'New', scopes: ['chat'] });

    const result = await controller.update('k1', { name: 'New' } as any, builderCtx);
    expect(result.name).toBe('New');
  });

  it('should reject admin scope in update', async () => {
    apiKeyService.findById.mockResolvedValue({ id: 'k1', tenantId: 't1' });
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });

    await expect(
      controller.update('k1', { scopes: ['admin'] } as any, builderCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── revoke ──────────────────────────────────────────────────────────

  it('should revoke key for owned tenant', async () => {
    apiKeyService.findById
      .mockResolvedValueOnce({ id: 'k1', tenantId: 't1', status: 'active', keyPrefix: 'sk-test', name: 'Key' })
      .mockResolvedValueOnce({ id: 'k1', status: 'revoked' });
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });

    const result = await controller.revoke('k1', builderCtx);
    expect(result.status).toBe('revoked');
  });

  it('should throw 400 when revoking already-revoked key', async () => {
    apiKeyService.findById.mockResolvedValue({ id: 'k1', tenantId: 't1', status: 'revoked' });
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });

    await expect(
      controller.revoke('k1', builderCtx),
    ).rejects.toThrow(BadRequestException);
  });

  // ── delete ──────────────────────────────────────────────────────────

  it('should delete key for owned tenant', async () => {
    apiKeyService.findById.mockResolvedValue({ id: 'k1', tenantId: 't1', keyPrefix: 'sk-test', name: 'Key' });
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });

    const result = await controller.delete('k1', builderCtx);
    expect(result.success).toBe(true);
    expect(apiKeyService.delete).toHaveBeenCalledWith('k1');
  });

  it('should throw 404 for non-existent key', async () => {
    apiKeyService.findById.mockResolvedValue(null);

    await expect(
      controller.delete('no-exist', builderCtx),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw 403 when deleting key from non-owned tenant', async () => {
    apiKeyService.findById.mockResolvedValue({ id: 'k1', tenantId: 't1' });
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue(null);

    await expect(
      controller.delete('k1', builderCtx),
    ).rejects.toThrow(ForbiddenException);
  });
});
