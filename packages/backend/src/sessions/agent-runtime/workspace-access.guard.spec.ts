/**
 * WorkspaceAccessGuard spec.
 *
 * Exercises canActivate directly against a synthetic ExecutionContext
 * so the test doesn't depend on a NestJS HTTP host. Covers:
 *   - 401 on missing token
 *   - 401 on invalid/expired token (ApiKeyService.validateKey rejects)
 *   - 403 on resolver returning false (workspace unknown / no resolver)
 *   - 403 on tenant mismatch
 *   - true (pass) on valid token + matching tenant
 *   - defensive 403 when identity is missing (should not happen in
 *     production but the guard fails closed)
 *
 * Renamed from `ProjectAccessGuard` in β-3; param name flipped from
 * `projectId` to `identity` so the guard works for both
 * `/workspaces/:identity/*` (canonical) and `/projects/:identity/*`
 * (deprecated alias). The synthesized req.params therefore uses the
 * unified `identity` key.
 */

import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { WorkspaceAccessGuard } from './workspace-access.guard';

function ctx(params: {
  identity?: string | unknown;
  token?: string | unknown;
}): ExecutionContext {
  const req = {
    params: params.identity === undefined ? {} : { identity: params.identity },
    query: params.token === undefined ? {} : { token: params.token },
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('WorkspaceAccessGuard', () => {
  const TENANT = 'tenant-A';
  const VALID_TOKEN = 'k_valid';
  const IDENTITY = 'proj-1';

  let apiKeys: { validateKey: jest.Mock };
  let tenantResolver: { verifyProjectAccess: jest.Mock };
  let guard: WorkspaceAccessGuard;

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
      // to assert the deny paths. Note: method name stays
      // `verifyProjectAccess` because that's what the agent-runtime
      // package's `ProjectTenantResolver` interface defines (renaming
      // the package's interface is out of β-3 scope).
      verifyProjectAccess: jest
        .fn()
        .mockImplementation(async (_id: string, callerTenantId: string) =>
          callerTenantId === TENANT,
        ),
    };
    guard = new WorkspaceAccessGuard(apiKeys as any, tenantResolver as any);
  });

  it('returns true when token and tenant match', async () => {
    await expect(
      guard.canActivate(ctx({ identity: IDENTITY, token: VALID_TOKEN })),
    ).resolves.toBe(true);
  });

  it('throws 401 when token is missing', async () => {
    await expect(
      guard.canActivate(ctx({ identity: IDENTITY })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when token is invalid (ApiKeyService rejects)', async () => {
    await expect(
      guard.canActivate(ctx({ identity: IDENTITY, token: 'bogus' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 403 when the resolver verifies false (unknown workspace or wrong tenant)', async () => {
    tenantResolver.verifyProjectAccess.mockResolvedValueOnce(false);
    await expect(
      guard.canActivate(ctx({ identity: IDENTITY, token: VALID_TOKEN })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes the caller tenant id through to verifyProjectAccess', async () => {
    await guard.canActivate(ctx({ identity: IDENTITY, token: VALID_TOKEN }));
    expect(tenantResolver.verifyProjectAccess).toHaveBeenCalledWith(
      IDENTITY,
      TENANT,
    );
  });

  it('throws 403 (fail-closed) when identity is missing', async () => {
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
      guard.canActivate(ctx({ identity: IDENTITY, token: [VALID_TOKEN, 'other'] })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(apiKeys.validateKey).not.toHaveBeenCalled();
  });

  it('throws 403 when identity is an array (defense-in-depth)', async () => {
    await expect(
      guard.canActivate(ctx({ identity: ['a', 'b'], token: VALID_TOKEN })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(apiKeys.validateKey).not.toHaveBeenCalled();
  });
});
