/**
 * TenantGuard Unit Tests
 *
 * Covers: default tenant fallback, header/query resolution,
 * tenant validation, cross-tenant access control, context immutability.
 */

import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { TenantsService } from './tenants.service';
import { UserTenantService } from '../users/user-tenant.service';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let tenantsService: jest.Mocked<Pick<TenantsService, 'findOne' | 'getDefaultTenantId'>>;
  let userTenantService: jest.Mocked<Pick<UserTenantService, 'findUserInTenant'>>;

  beforeEach(() => {
    tenantsService = {
      findOne: jest.fn(),
      getDefaultTenantId: jest.fn().mockReturnValue('default-tenant'),
    };

    userTenantService = {
      findUserInTenant: jest.fn(),
    };

    guard = new TenantGuard(tenantsService as any, userTenantService as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (request: Record<string, any>): ExecutionContext => {
    // Ensure headers object exists
    if (!request.headers) request.headers = {};
    if (!request.query) request.query = {};
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  // ── Default tenant fallback ───────────────────────────────────────────

  it('should fall back to default tenant when no header is provided', async () => {
    const defaultTenant = { id: 'default-tenant', status: 'active' };
    tenantsService.findOne.mockResolvedValue(defaultTenant as any);

    const request: Record<string, any> = {};
    const ctx = createMockContext(request);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.tenant).toBe(defaultTenant);
    expect(request.tenantId).toBe('default-tenant');
    expect(tenantsService.getDefaultTenantId).toHaveBeenCalled();
  });

  it('should throw 401 when no header and no default tenant', async () => {
    tenantsService.findOne.mockResolvedValue(null);

    const ctx = createMockContext({});

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Tenant ID required');
  });

  // ── Header / query resolution ─────────────────────────────────────────

  it('should resolve tenant from X-Tenant-Id header', async () => {
    const tenant = { id: 'tenant-abc', status: 'active' };
    tenantsService.findOne.mockResolvedValue(tenant as any);

    const request: Record<string, any> = {
      headers: { 'x-tenant-id': 'tenant-abc' },
    };
    const ctx = createMockContext(request);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.tenant).toBe(tenant);
    expect(request.tenantId).toBe('tenant-abc');
    expect(tenantsService.findOne).toHaveBeenCalledWith('tenant-abc');
  });

  it('should resolve tenant from query param', async () => {
    const tenant = { id: 'tenant-query', status: 'active' };
    tenantsService.findOne.mockResolvedValue(tenant as any);

    const request: Record<string, any> = {
      headers: {},
      query: { tenantId: 'tenant-query' },
    };
    const ctx = createMockContext(request);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.tenantId).toBe('tenant-query');
  });

  // ── Tenant validation ─────────────────────────────────────────────────

  it('should throw 401 for non-existent tenant', async () => {
    tenantsService.findOne.mockResolvedValue(null);

    const ctx = createMockContext({
      headers: { 'x-tenant-id': 'no-such-tenant' },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Invalid tenant');
  });

  it('should throw 401 for inactive tenant', async () => {
    tenantsService.findOne.mockResolvedValue({
      id: 'tenant-inactive',
      status: 'suspended',
    } as any);

    const ctx = createMockContext({
      headers: { 'x-tenant-id': 'tenant-inactive' },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Tenant is not active');
  });

  // ── Cross-tenant access control ───────────────────────────────────────

  it('should allow admin key cross-tenant access', async () => {
    const targetTenant = { id: 'tenant-target', status: 'active' };
    tenantsService.findOne.mockResolvedValue(targetTenant as any);

    const request: Record<string, any> = {
      headers: { 'x-tenant-id': 'tenant-target' },
      context: {
        tenantId: 'tenant-caller',
        apiKeyId: 'key-1',
        apiKeyScopes: ['admin'],
      },
    };
    const ctx = createMockContext(request);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.tenant).toBe(targetTenant);
    expect(request.tenantId).toBe('tenant-target');
  });

  it('should deny non-admin key cross-tenant access with 403', async () => {
    const targetTenant = { id: 'tenant-target', status: 'active' };
    tenantsService.findOne.mockResolvedValue(targetTenant as any);

    const ctx = createMockContext({
      headers: { 'x-tenant-id': 'tenant-target' },
      context: {
        tenantId: 'tenant-caller',
        apiKeyId: 'key-2',
        apiKeyScopes: ['chat'],
      },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'API key does not have permission to access this tenant',
    );
  });

  it('should allow same-tenant access without admin scope', async () => {
    const tenant = { id: 'tenant-same', status: 'active' };
    tenantsService.findOne.mockResolvedValue(tenant as any);

    const request: Record<string, any> = {
      headers: { 'x-tenant-id': 'tenant-same' },
      context: {
        tenantId: 'tenant-same',
        apiKeyId: 'key-3',
        apiKeyScopes: ['chat'],
      },
    };
    const ctx = createMockContext(request);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  // ── Builder cross-tenant access ──────────────────────────────────────

  it('should allow builder key cross-tenant access to owned tenant', async () => {
    const targetTenant = { id: 'tenant-target', status: 'active' };
    tenantsService.findOne.mockResolvedValue(targetTenant as any);
    userTenantService.findUserInTenant.mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-target',
      isActive: true,
    } as any);

    const request: Record<string, any> = {
      headers: { 'x-tenant-id': 'tenant-target' },
      context: {
        tenantId: 'tenant-caller',
        apiKeyId: 'key-builder',
        apiKeyScopes: ['builder'],
        userId: 'user-1',
      },
    };
    const ctx = createMockContext(request);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(userTenantService.findUserInTenant).toHaveBeenCalledWith('user-1', 'tenant-target');
  });

  it('should deny builder key cross-tenant access to non-owned tenant', async () => {
    const targetTenant = { id: 'tenant-target', status: 'active' };
    tenantsService.findOne.mockResolvedValue(targetTenant as any);
    userTenantService.findUserInTenant.mockResolvedValue(null);

    const ctx = createMockContext({
      headers: { 'x-tenant-id': 'tenant-target' },
      context: {
        tenantId: 'tenant-caller',
        apiKeyId: 'key-builder',
        apiKeyScopes: ['builder'],
        userId: 'user-1',
      },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should deny builder key cross-tenant access when no userId', async () => {
    const targetTenant = { id: 'tenant-target', status: 'active' };
    tenantsService.findOne.mockResolvedValue(targetTenant as any);

    const ctx = createMockContext({
      headers: { 'x-tenant-id': 'tenant-target' },
      context: {
        tenantId: 'tenant-caller',
        apiKeyId: 'key-builder',
        apiKeyScopes: ['builder'],
        // no userId
      },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  it('should allow access when request has no context (unauthenticated)', async () => {
    const tenant = { id: 'tenant-open', status: 'active' };
    tenantsService.findOne.mockResolvedValue(tenant as any);

    const request: Record<string, any> = {
      headers: { 'x-tenant-id': 'tenant-open' },
      // no context — ApiKeyGuard was not applied or auth is optional
    };
    const ctx = createMockContext(request);
    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(request.tenant).toBe(tenant);
  });

  it('should never modify request.context (caller identity immutability)', async () => {
    const targetTenant = { id: 'tenant-target', status: 'active' };
    tenantsService.findOne.mockResolvedValue(targetTenant as any);

    const originalContext = Object.freeze({
      tenantId: 'tenant-caller',
      apiKeyId: 'key-1',
      apiKeyScopes: ['admin'],
    });

    const request: Record<string, any> = {
      headers: { 'x-tenant-id': 'tenant-target' },
      context: originalContext,
    };
    const ctx = createMockContext(request);
    await guard.canActivate(ctx);

    // context must still be the original frozen object — any mutation would throw
    expect(request.context).toBe(originalContext);
    expect(request.context.tenantId).toBe('tenant-caller');
  });
});
