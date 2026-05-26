/**
 * ProjectArtifactSourceRegistry unit tests — tenant.config-backed lookup.
 *
 * Mocks SolutionsService and exercises:
 *   - cache hit returns instance, doesn't re-query
 *   - cache miss + tenant has artifactUrl → constructs RestWorkspaceArtifactSource
 *   - cache miss + tenant has no artifactUrl → caches null (negative cache)
 *   - cache miss + tenant config has invalid URL → caches null + logs
 *   - null/undefined slug → returns null without DB call
 *   - tenant.config.changed event evicts the cached entry
 */

import { ProjectArtifactSourceRegistry } from './project-artifact-source-registry';
import { SOLUTION_CONFIG_CHANGED } from '../../solutions/solution-config-events';
import { RestWorkspaceArtifactSource } from './rest-workspace-artifact-source';

const tenant = (slug: string, artifactUrl?: string) => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  config: artifactUrl !== undefined ? { artifactUrl } : {},
});

describe('ProjectArtifactSourceRegistry', () => {
  let tenants: { findOne: jest.Mock };
  let registry: ProjectArtifactSourceRegistry;

  beforeEach(() => {
    tenants = { findOne: jest.fn() };
    registry = new ProjectArtifactSourceRegistry(tenants as any);
  });

  it('cache miss + tenant has artifactUrl → constructs RestWorkspaceArtifactSource', async () => {
    tenants.findOne.mockResolvedValueOnce(tenant('live-lesson', 'http://localhost:3007/api'));
    const source = await registry.getForTenantSlug('live-lesson');
    expect(source).toBeInstanceOf(RestWorkspaceArtifactSource);
    expect(tenants.findOne).toHaveBeenCalledWith('live-lesson');
  });

  it('cache hit does not re-query SolutionsService', async () => {
    tenants.findOne.mockResolvedValueOnce(tenant('demo', 'http://localhost:3010/api'));
    const first = await registry.getForTenantSlug('demo');
    const second = await registry.getForTenantSlug('demo');
    expect(first).toBe(second);
    expect(tenants.findOne).toHaveBeenCalledTimes(1);
  });

  it('cache miss + tenant has no artifactUrl → caches null', async () => {
    tenants.findOne.mockResolvedValueOnce(tenant('bare-tenant'));
    const first = await registry.getForTenantSlug('bare-tenant');
    expect(first).toBeNull();
    // re-query: cached null, no DB call
    const second = await registry.getForTenantSlug('bare-tenant');
    expect(second).toBeNull();
    expect(tenants.findOne).toHaveBeenCalledTimes(1);
  });

  it('cache miss + tenant config has invalid URL → caches null + logs', async () => {
    tenants.findOne.mockResolvedValueOnce(tenant('broken', 'not a real url'));
    const out = await registry.getForTenantSlug('broken');
    expect(out).toBeNull();
  });

  it('rejects non-http(s) protocols (file://, javascript:) as unsafe', async () => {
    tenants.findOne.mockResolvedValueOnce(tenant('evil', 'file:///etc/passwd'));
    expect(await registry.getForTenantSlug('evil')).toBeNull();

    tenants.findOne.mockResolvedValueOnce(tenant('xss', 'javascript:alert(1)'));
    expect(await registry.getForTenantSlug('xss')).toBeNull();
  });

  it('accepts both http:// and https:// URLs', async () => {
    tenants.findOne.mockResolvedValueOnce(tenant('plain', 'http://localhost:3007/api'));
    expect(await registry.getForTenantSlug('plain')).toBeInstanceOf(RestWorkspaceArtifactSource);

    tenants.findOne.mockResolvedValueOnce(tenant('secure', 'https://api.example.com/v1'));
    expect(await registry.getForTenantSlug('secure')).toBeInstanceOf(RestWorkspaceArtifactSource);
  });

  it('null/undefined slug → returns null without DB call', async () => {
    expect(await registry.getForTenantSlug(null)).toBeNull();
    expect(await registry.getForTenantSlug(undefined)).toBeNull();
    expect(await registry.getForTenantSlug('')).toBeNull();
    expect(tenants.findOne).not.toHaveBeenCalled();
  });

  it('unknown tenant (findOne returns null) → caches null', async () => {
    tenants.findOne.mockResolvedValueOnce(null);
    const out = await registry.getForTenantSlug('ghost');
    expect(out).toBeNull();
    // verify the null was cached
    await registry.getForTenantSlug('ghost');
    expect(tenants.findOne).toHaveBeenCalledTimes(1);
  });

  describe('tenant.config.changed event invalidation', () => {
    it('evicts the cached entry for the changed slug', async () => {
      tenants.findOne.mockResolvedValueOnce(tenant('live-lesson', 'http://a.local/api'));
      const first = await registry.getForTenantSlug('live-lesson');
      expect(first).toBeInstanceOf(RestWorkspaceArtifactSource);

      // Simulate the event: SolutionsService.update writes new URL, then fires.
      registry.onTenantConfigChanged({ solutionId: 'id-live-lesson', slug: 'live-lesson' });

      // Next lookup re-queries; new mock returns the new URL.
      tenants.findOne.mockResolvedValueOnce(tenant('live-lesson', 'http://b.local/api'));
      const second = await registry.getForTenantSlug('live-lesson');
      expect(second).toBeInstanceOf(RestWorkspaceArtifactSource);
      expect(second).not.toBe(first);
      expect(tenants.findOne).toHaveBeenCalledTimes(2);
    });

    it('only evicts the named slug, leaves others cached', async () => {
      tenants.findOne
        .mockResolvedValueOnce(tenant('a', 'http://a.local/api'))
        .mockResolvedValueOnce(tenant('b', 'http://b.local/api'));
      const aFirst = await registry.getForTenantSlug('a');
      const bFirst = await registry.getForTenantSlug('b');

      registry.onTenantConfigChanged({ solutionId: 'id-a', slug: 'a' });

      // a re-queries; b stays cached
      tenants.findOne.mockResolvedValueOnce(tenant('a', 'http://a2.local/api'));
      const aSecond = await registry.getForTenantSlug('a');
      const bSecond = await registry.getForTenantSlug('b');
      expect(aSecond).not.toBe(aFirst);
      expect(bSecond).toBe(bFirst); // same instance, no new DB call
      expect(tenants.findOne).toHaveBeenCalledTimes(3); // a, b, a-again
    });
  });
});
