import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminSolutionAccessGuard } from './admin-solution-access.guard';
import { UserSolutionService } from '../../users/user-solution.service';

describe('AdminSolutionAccessGuard', () => {
  let guard: AdminSolutionAccessGuard;
  let userTenantService: jest.Mocked<Pick<UserSolutionService, 'findUserInTenant'>>;

  function createContext(overrides: {
    context?: any;
    params?: any;
    query?: any;
    body?: any;
    headers?: any;
  }): ExecutionContext {
    const request = {
      context: overrides.context,
      params: overrides.params || {},
      query: overrides.query || {},
      body: overrides.body || {},
      headers: overrides.headers || {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    userTenantService = {
      findUserInTenant: jest.fn(),
    };
    guard = new AdminSolutionAccessGuard(
      userTenantService as unknown as UserSolutionService,
    );
  });

  it('should pass through when no request context', async () => {
    const ctx = createContext({ context: undefined });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should pass through for admin scope (unrestricted)', async () => {
    const ctx = createContext({
      context: {
        apiKeyScopes: ['admin'],
        solutionId: 'tenant-1',
      },
      params: { solutionId: 'any-tenant' },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(userTenantService.findUserInTenant).not.toHaveBeenCalled();
  });

  it('should pass through when no solutionId in request (list endpoints)', async () => {
    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should allow builder accessing own tenant', async () => {
    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      params: { solutionId: 'tenant-1' },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(userTenantService.findUserInTenant).not.toHaveBeenCalled();
  });

  it('should allow builder cross-tenant access to owned tenant', async () => {
    userTenantService.findUserInTenant.mockResolvedValue({
      isActive: true,
    } as any);

    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      params: { solutionId: 'tenant-2' },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(userTenantService.findUserInTenant).toHaveBeenCalledWith(
      'user-1',
      'tenant-2',
    );
  });

  it('should reject builder cross-tenant access to non-owned tenant', async () => {
    userTenantService.findUserInTenant.mockResolvedValue(null);

    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      params: { solutionId: 'tenant-3' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should reject builder without userId on cross-tenant access', async () => {
    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        // no userId
      },
      params: { solutionId: 'tenant-2' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should reject builder accessing inactive user-tenant', async () => {
    userTenantService.findUserInTenant.mockResolvedValue({
      isActive: false,
    } as any);

    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      params: { solutionId: 'tenant-2' },
    });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should extract solutionId from query params', async () => {
    userTenantService.findUserInTenant.mockResolvedValue({
      isActive: true,
    } as any);

    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      query: { solutionId: 'tenant-2' },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(userTenantService.findUserInTenant).toHaveBeenCalledWith(
      'user-1',
      'tenant-2',
    );
  });

  it('should extract solutionId from request body', async () => {
    userTenantService.findUserInTenant.mockResolvedValue({
      isActive: true,
    } as any);

    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      body: { solutionId: 'tenant-2' },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(userTenantService.findUserInTenant).toHaveBeenCalledWith(
      'user-1',
      'tenant-2',
    );
  });

  it('should NOT extract solutionId from :id route param (non-tenant resource IDs)', async () => {
    // :id may be an API key, MCP server, or audit log — not a solutionId.
    // Guard should pass through (no solutionId found) rather than mis-interpret :id.
    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      params: { id: 'some-api-key-uuid' },
    });
    // No solutionId extracted → pass through
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(userTenantService.findUserInTenant).not.toHaveBeenCalled();
  });

  it('should extract solutionId from X-Solution-Id header', async () => {
    userTenantService.findUserInTenant.mockResolvedValue({
      isActive: true,
    } as any);

    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      headers: { 'x-tenant-id': 'tenant-2' },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(userTenantService.findUserInTenant).toHaveBeenCalledWith(
      'user-1',
      'tenant-2',
    );
  });

  it('should pass through for non-admin non-builder scopes', async () => {
    const ctx = createContext({
      context: {
        apiKeyScopes: ['chat'],
        solutionId: 'tenant-1',
      },
      params: { solutionId: 'tenant-2' },
    });
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('should prioritize route params over query params', async () => {
    const ctx = createContext({
      context: {
        apiKeyScopes: ['builder'],
        solutionId: 'tenant-1',
        userId: 'user-1',
      },
      params: { solutionId: 'tenant-1' }, // own tenant
      query: { solutionId: 'tenant-2' },  // different tenant
    });
    // Route param takes priority, so tenant-1 == own tenant → allowed
    expect(await guard.canActivate(ctx)).toBe(true);
    expect(userTenantService.findUserInTenant).not.toHaveBeenCalled();
  });
});
