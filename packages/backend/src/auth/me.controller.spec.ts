/**
 * Unit tests for MeController.
 *
 * The controller is intentionally a pure transformer — input `ctx`
 * comes from the ApiKeyGuard (tested elsewhere), output is the
 * `MeResponse` shape the creator UI consumes. So these tests focus
 * on the transformation contract, not the guard chain.
 *
 * Wider integration (guard + tenant lookup + DB) is covered by
 * api-key.service.integration.spec.ts.
 */

import { MeController, type MeResponse } from './me.controller';
import type { RequestContext } from './types';
import type { Tenant } from '../tenants/entities/tenant.entity';

function makeCtx(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    tenantId: 't-uuid-1',
    tenant: { id: 't-uuid-1', slug: 'live-lesson-creator', name: 'Live Lesson Creator' } as Tenant,
    apiKeyId: 'k-uuid-1',
    apiKeyScopes: ['chat', 'skills:read'],
    requestId: 'req-1',
    timestamp: new Date(),
    isAnonymous: false,
    ...overrides,
  };
}

describe('MeController.me', () => {
  let controller: MeController;

  beforeEach(() => {
    controller = new MeController();
  });

  it('returns identity payload for an authenticated request', () => {
    const out = controller.me(makeCtx());

    const expected: MeResponse = {
      tenantId: 't-uuid-1',
      tenantSlug: 'live-lesson-creator',
      apiKeyId: 'k-uuid-1',
      scopes: ['chat', 'skills:read'],
      isAnonymous: false,
    };
    expect(out).toEqual(expected);
  });

  it('reports anonymous flag honestly when guard set isAnonymous=true', () => {
    const ctx = makeCtx({ isAnonymous: true, apiKeyId: undefined, apiKeyScopes: [] });
    const out = controller.me(ctx);

    expect(out.isAnonymous).toBe(true);
    expect(out.apiKeyId).toBeUndefined();
    expect(out.scopes).toEqual([]);
    // Even anonymous responses carry tenantId — the frontend needs it
    // to compose bind-project bodies. The default tenant id is what
    // ApiKeyGuard fills in for anonymous requests.
    expect(out.tenantId).toBe('t-uuid-1');
  });

  it('defaults scopes to [] when guard did not set them', () => {
    const ctx = makeCtx({ apiKeyScopes: undefined });
    const out = controller.me(ctx);
    expect(out.scopes).toEqual([]);
  });

  it('throws a clear error if ctx is missing (guard misconfig)', () => {
    // Should never happen in production — but the @Auth() decorator
    // requires the guard to populate ctx, and a missing ctx would
    // otherwise yield `undefined` fields that confuse the UI.
    expect(() => controller.me(undefined)).toThrow(/auth context missing/);
  });
});
