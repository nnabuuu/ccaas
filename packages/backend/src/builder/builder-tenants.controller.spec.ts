import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BuilderTenantsController } from './builder-tenants.controller';
import type { RequestContext } from '../auth/types';

describe('BuilderTenantsController', () => {
  let controller: BuilderTenantsController;
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
    tenantsService = {
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    userTenantService = {
      create: jest.fn(),
      findByUser: jest.fn(),
      findUserInTenant: jest.fn(),
    };
    auditService = {
      log: jest.fn(),
    };

    controller = new BuilderTenantsController(
      tenantsService,
      userTenantService,
      auditService,
    );
  });

  // ── requireBuilderUserId ────────────────────────────────────────────

  it('should throw 403 when no userId in context', async () => {
    await expect(
      controller.create({ name: 'Test' } as any, noUserCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── create ──────────────────────────────────────────────────────────

  it('should create tenant and auto-link builder as admin', async () => {
    const tenant = { id: 'new-tenant', slug: 'test', name: 'Test' };
    tenantsService.create.mockResolvedValue({ tenant, id: 'new-tenant' });
    userTenantService.create.mockResolvedValue({});

    const result = await controller.create({ name: 'Test' } as any, builderCtx);

    expect(result.tenant).toBe(tenant);
    expect(userTenantService.create).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'new-tenant',
      role: 'admin',
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'tenant.create',
        targetId: 'new-tenant',
      }),
    );
  });

  // ── findAll ─────────────────────────────────────────────────────────

  it('should list only active owned tenants', async () => {
    userTenantService.findByUser.mockResolvedValue([
      { tenant: { id: 't1', status: 'active' } },
      { tenant: { id: 't2', status: 'suspended' } },
      { tenant: null },
    ]);

    const result = await controller.findAll(builderCtx);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t1');
  });

  // ── findOne ─────────────────────────────────────────────────────────

  it('should return owned tenant', async () => {
    const tenant = { id: 't1', status: 'active' };
    tenantsService.findOne.mockResolvedValue(tenant);
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });

    const result = await controller.findOne('t1', builderCtx);
    expect(result).toBe(tenant);
  });

  it('should throw 404 for non-existent tenant', async () => {
    tenantsService.findOne.mockResolvedValue(null);

    await expect(
      controller.findOne('no-exist', builderCtx),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw 403 for non-owned tenant', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue(null);

    await expect(
      controller.findOne('t1', builderCtx),
    ).rejects.toThrow(ForbiddenException);
  });

  // ── update ──────────────────────────────────────────────────────────

  it('should update owned tenant', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: true });
    tenantsService.update.mockResolvedValue({ id: 't1', name: 'Updated' });

    const result = await controller.update('t1', { name: 'Updated' } as any, builderCtx);
    expect(result.name).toBe('Updated');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant.update' }),
    );
  });

  it('should throw 403 when updating non-owned tenant', async () => {
    tenantsService.findOne.mockResolvedValue({ id: 't1' });
    userTenantService.findUserInTenant.mockResolvedValue({ isActive: false });

    await expect(
      controller.update('t1', { name: 'Updated' } as any, builderCtx),
    ).rejects.toThrow(ForbiddenException);
  });
});
