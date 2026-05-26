/**
 * ProjectAccessGuard spec.
 *
 * Exercises canActivate directly against a synthetic ExecutionContext
 * so the test doesn't depend on a NestJS HTTP host. Covers:
 *   - 401 on missing token
 *   - 401 on invalid/expired token (ApiKeyService.validateKey rejects)
 *   - 403 on resolver returning null (project unknown / no resolver)
 *   - 403 on tenant mismatch
 *   - true (pass) on valid token + matching tenant
 *   - defensive 403 when projectId is missing (should not happen in
 *     production but the guard fails closed)
 */

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { ProjectAccessGuard } from './project-access.guard';

function ctx(params: {
  projectId?: string | unknown;
  token?: string | unknown;
}): ExecutionContext {
  const req = {
    params: params.projectId === undefined ? {} : { projectId: params.projectId },
    query: params.token === undefined ? {} : { token: params.token },
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('ProjectAccessGuard', () => {
  const TENANT = 'tenant-A';
  const VALID_TOKEN = 'k_valid';
  const PROJ = 'proj-1';

  let apiKeys: { validateKey: jest.Mock };
  let tenantResolver: { verifyProjectAccess: jest.Mock };
  let guard: ProjectAccessGuard;

  beforeEach(() => {
    apiKeys = {
      validateKey: jest.fn().mockImplementation(async (raw: string) => {
        if (raw === VALID_TOKEN) {
          return { apiKey: {}, tenant: { id: TENANT } };
        }
        throw new Error('invalid');
      }),
    };
    tenantResolver = {
      // Default: caller tenant always matches. Individual tests override
      // to assert the deny paths.
      verifyProjectAccess: jest
        .fn()
        .mockImplementation(async (_pid: string, callerTenantId: string) =>
          callerTenantId === TENANT,
        ),
    };
    guard = new ProjectAccessGuard(apiKeys as any, tenantResolver as any);
  });

  it('returns true when token and tenant match', async () => {
    await expect(
      guard.canActivate(ctx({ projectId: PROJ, token: VALID_TOKEN })),
    ).resolves.toBe(true);
  });

  it('throws 401 when token is missing', async () => {
    await expect(
      guard.canActivate(ctx({ projectId: PROJ })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when token is invalid (ApiKeyService rejects)', async () => {
    await expect(
      guard.canActivate(ctx({ projectId: PROJ, token: 'bogus' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 403 when the resolver verifies false (unknown project or wrong tenant)', async () => {
    tenantResolver.verifyProjectAccess.mockResolvedValueOnce(false);
    await expect(
      guard.canActivate(ctx({ projectId: PROJ, token: VALID_TOKEN })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes the caller tenant id through to verifyProjectAccess', async () => {
    await guard.canActivate(ctx({ projectId: PROJ, token: VALID_TOKEN }));
    expect(tenantResolver.verifyProjectAccess).toHaveBeenCalledWith(
      PROJ,
      TENANT,
    );
  });

  it('throws 403 (fail-closed) when projectId is missing', async () => {
    await expect(
      guard.canActivate(ctx({ token: VALID_TOKEN })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(apiKeys.validateKey).not.toHaveBeenCalled();
  });

  it('throws 401 when token is an array (express duplicate-query-param coercion)', async () => {
    // `?token=a&token=b` → req.query.token === ['a','b']. Without an
    // explicit type-check, the array would slip past `!token` and crash
    // inside the SHA hasher with a confusing error. Guard must reject.
    await expect(
      guard.canActivate(ctx({ projectId: PROJ, token: [VALID_TOKEN, 'other'] })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(apiKeys.validateKey).not.toHaveBeenCalled();
  });

  it('throws 403 when projectId is an array (defense-in-depth)', async () => {
    await expect(
      guard.canActivate(ctx({ projectId: ['a', 'b'], token: VALID_TOKEN })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(apiKeys.validateKey).not.toHaveBeenCalled();
  });
});
