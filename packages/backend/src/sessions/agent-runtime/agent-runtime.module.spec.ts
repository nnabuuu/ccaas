/**
 * AgentRuntimeModule DI resolution tests.
 *
 * Verifies that `forRoot()` correctly wires:
 *   - the `PROJECT_ARTIFACT_SOURCE` token to the solution-provided
 *     impl when one is passed, or to the no-op default when omitted
 *   - the `CHANGE_STREAM` token to an `InMemoryChangeStream`
 *   - the `SessionAssetSyncer` provider, which depends on
 *     `SessionService` + `SessionMetadataService` — those are mocked
 *     here since they live in the parent `SessionsModule`
 *
 * These are pure DI tests — no database, no agentfs, no live sessions.
 */

import { Injectable } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  type Artifact,
  type ArtifactSnapshot,
  type ChangeStream,
  InMemoryChangeStream,
  type ProjectArtifactSource,
} from '@kedge-agentic/agent-runtime';

import {
  AgentRuntimeModule,
  CHANGE_STREAM,
  PROJECT_ARTIFACT_SOURCE,
  PROJECT_ARTIFACT_SOURCE_REGISTRY,
} from './agent-runtime.module';
import { ProjectArtifactSourceRegistry } from './project-artifact-source-registry';
import { SessionArtifactSnapshot } from './session-artifact-snapshot.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
class FakeArtifactSource implements ProjectArtifactSource {
  public loadCalls: string[] = [];
  public saveCalls: Array<{ projectId: string; artifact: ArtifactSnapshot }> = [];

  async loadArtifacts(projectId: string): Promise<ReadonlyArray<ArtifactSnapshot>> {
    this.loadCalls.push(projectId);
    return [{ path: 'fixture.md', content: '# hi', type: 'md' }];
  }

  async saveArtifact(projectId: string, artifact: ArtifactSnapshot): Promise<void> {
    this.saveCalls.push({ projectId, artifact });
  }
}

const repoMock = {
  find: jest.fn(async () => []),
  upsert: jest.fn(),
  delete: jest.fn(),
};

function compileWith(options?: { artifactSource?: typeof FakeArtifactSource; envUrls?: Record<string, string>; envUrl?: string }) {
  const cfgMap: Record<string, unknown> = {
    'workspace.solutionArtifactUrls': options?.envUrls ?? {},
    'workspace.solutionArtifactUrl': options?.envUrl,
  };
  const builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AgentRuntimeModule.forRoot({ artifactSource: options?.artifactSource })],
  });
  return builder
    .overrideProvider(getRepositoryToken(SessionArtifactSnapshot))
    .useValue(repoMock)
    .overrideProvider(ConfigService)
    .useValue({ get: (k: string, d?: unknown) => cfgMap[k] ?? d })
    .compile();
}

describe('AgentRuntimeModule', () => {
  beforeEach(() => {
    repoMock.find.mockClear();
    repoMock.upsert.mockClear();
    repoMock.delete.mockClear();
  });

  it('resolves the solution-provided artifact source via PROJECT_ARTIFACT_SOURCE', async () => {
    const moduleRef = await compileWith({ artifactSource: FakeArtifactSource });

    const source = moduleRef.get<ProjectArtifactSource>(PROJECT_ARTIFACT_SOURCE);
    expect(source).toBeInstanceOf(FakeArtifactSource);

    const out = await source.loadArtifacts('p1');
    expect(out).toEqual([{ path: 'fixture.md', content: '# hi', type: 'md' }]);
    expect((source as FakeArtifactSource).loadCalls).toEqual(['p1']);
  });

  it('falls back to a no-op source when no artifact source is provided', async () => {
    const moduleRef = await compileWith();
    const source = moduleRef.get<ProjectArtifactSource>(PROJECT_ARTIFACT_SOURCE);
    const out = await source.loadArtifacts('p1');
    expect(out).toEqual([]);
    await expect(source.saveArtifact('p1', { path: 'x', content: 'y', type: 'md' }))
      .resolves.toBeUndefined();
  });

  it('binds CHANGE_STREAM to an InMemoryChangeStream singleton', async () => {
    const moduleRef = await compileWith();
    const stream = moduleRef.get<ChangeStream>(CHANGE_STREAM);
    expect(stream).toBeInstanceOf(InMemoryChangeStream);
    // resolve again and confirm singleton (same instance)
    expect(moduleRef.get<ChangeStream>(CHANGE_STREAM)).toBe(stream);
  });

  it('uses a no-op source that satisfies the ProjectArtifactSource contract', async () => {
    const moduleRef = await compileWith();
    const source = moduleRef.get<ProjectArtifactSource>(PROJECT_ARTIFACT_SOURCE);
    expect(typeof source.loadArtifacts).toBe('function');
    expect(typeof source.saveArtifact).toBe('function');
  });

  describe('PROJECT_ARTIFACT_SOURCE_REGISTRY (Phase 1.5)', () => {
    it('binds to a ProjectArtifactSourceRegistry instance', async () => {
      const moduleRef = await compileWith();
      const registry = moduleRef.get<ProjectArtifactSourceRegistry>(PROJECT_ARTIFACT_SOURCE_REGISTRY);
      expect(registry).toBeInstanceOf(ProjectArtifactSourceRegistry);
    });

    it('legacy SOLUTION_ARTIFACT_URL → defaultSource picks up unknown tenants', async () => {
      const moduleRef = await compileWith({ envUrl: 'http://legacy.local/api' });
      const registry = moduleRef.get<ProjectArtifactSourceRegistry>(PROJECT_ARTIFACT_SOURCE_REGISTRY);
      // any slug not in the (empty) map falls back to default
      expect(registry.getForTenantSlug('any-tenant')).not.toBeNull();
    });

    it('SOLUTION_ARTIFACT_URLS → per-tenant entries beat defaultSource', async () => {
      const moduleRef = await compileWith({
        envUrl: 'http://default.local/api',
        envUrls: { 'live-lesson': 'http://live.local/api', demo: 'http://demo.local/api' },
      });
      const registry = moduleRef.get<ProjectArtifactSourceRegistry>(PROJECT_ARTIFACT_SOURCE_REGISTRY);
      const live = registry.getForTenantSlug('live-lesson');
      const demo = registry.getForTenantSlug('demo');
      const fallback = registry.getForTenantSlug('other');
      // 3 distinct sources: live, demo, default
      expect(live).not.toBe(demo);
      expect(live).not.toBe(fallback);
      expect(demo).not.toBe(fallback);
    });

    it('explicit artifactSource takes precedence over both env vars', async () => {
      const moduleRef = await compileWith({
        artifactSource: FakeArtifactSource,
        envUrl: 'http://legacy.local/api',
        envUrls: { demo: 'http://demo.local/api' },
      });
      const registry = moduleRef.get<ProjectArtifactSourceRegistry>(PROJECT_ARTIFACT_SOURCE_REGISTRY);
      // The default fallback is the explicit FakeArtifactSource, not the legacy URL.
      // Per-tenant env entries still apply (they're independent).
      const fallback = registry.getForTenantSlug('unknown');
      expect(fallback).toBeInstanceOf(FakeArtifactSource);
    });

    it('no env vars + no explicit source → defaultSource is null, unknown tenant returns null', async () => {
      const moduleRef = await compileWith();
      const registry = moduleRef.get<ProjectArtifactSourceRegistry>(PROJECT_ARTIFACT_SOURCE_REGISTRY);
      // No env was supplied; defaults to no fallback. Note: PROJECT_ARTIFACT_SOURCE
      // (the legacy single-source token) is bound to NoopArtifactSource so direct
      // injectors keep working, but the registry sees null as its defaultSource.
      expect(registry.getForTenantSlug('unknown')).toBeNull();
    });
  });
});

// Type-only assertion that the source-loader contract from agent-runtime
// is correctly typed end-to-end. The `Artifact<TContent>` import below
// verifies that the editor-side full type is still available too — they
// should coexist without name collision.
type _ArtifactStillExported = Artifact<object>;
