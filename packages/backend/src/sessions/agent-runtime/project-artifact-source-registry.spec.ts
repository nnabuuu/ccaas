/**
 * ProjectArtifactSourceRegistry unit tests — pure slug → source map.
 */

import type { ProjectArtifactSource, ArtifactSnapshot } from '@kedge-agentic/agent-runtime';
import { ProjectArtifactSourceRegistry } from './project-artifact-source-registry';

const stub = (label: string): ProjectArtifactSource => ({
  loadArtifacts: jest.fn(async () => [{ path: label, content: label, type: 'md' } as ArtifactSnapshot]),
  saveArtifact: jest.fn(async () => undefined),
});

describe('ProjectArtifactSourceRegistry', () => {
  it('returns the per-tenant source for a matching slug', () => {
    const live = stub('live');
    const r = new ProjectArtifactSourceRegistry(new Map([['live-lesson', live]]), null);
    expect(r.getForTenantSlug('live-lesson')).toBe(live);
  });

  it('falls back to defaultSource when slug not in map', () => {
    const fallback = stub('default');
    const r = new ProjectArtifactSourceRegistry(new Map(), fallback);
    expect(r.getForTenantSlug('unknown')).toBe(fallback);
  });

  it('returns null when slug not in map AND no default', () => {
    const r = new ProjectArtifactSourceRegistry(new Map(), null);
    expect(r.getForTenantSlug('unknown')).toBeNull();
  });

  it('null/undefined slug falls back to defaultSource', () => {
    const fallback = stub('default');
    const r = new ProjectArtifactSourceRegistry(new Map(), fallback);
    expect(r.getForTenantSlug(null)).toBe(fallback);
    expect(r.getForTenantSlug(undefined)).toBe(fallback);
  });

  it('per-tenant overrides default when both apply', () => {
    const live = stub('live');
    const fallback = stub('default');
    const r = new ProjectArtifactSourceRegistry(new Map([['live-lesson', live]]), fallback);
    expect(r.getForTenantSlug('live-lesson')).toBe(live);
    expect(r.getForTenantSlug('demo')).toBe(fallback);
  });

  it('lookup is synchronous + side-effect-free (no DB calls)', () => {
    const live = stub('live');
    const r = new ProjectArtifactSourceRegistry(new Map([['live-lesson', live]]), null);
    // Resolve same slug 1000 times — no async, no calls beyond the Map.get.
    for (let i = 0; i < 1000; i++) {
      expect(r.getForTenantSlug('live-lesson')).toBe(live);
    }
    expect(live.loadArtifacts).not.toHaveBeenCalled();
  });
});
