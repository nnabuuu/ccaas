/**
 * AgentRuntimeModule DI resolution tests (Phase 1.6).
 *
 * Phase 1.6 removed the SOLUTION_ARTIFACT_URL{,S} env-CSV parsing. The
 * artifact-callback URL now lives on `tenant.config.artifactUrl`,
 * registered via solution.json + auto-discovery (or via REST). These
 * tests are correspondingly simpler:
 *   - PROJECT_ARTIFACT_SOURCE token resolves (back-compat — bound to
 *     options.artifactSource or NoopArtifactSource)
 *   - PROJECT_ARTIFACT_SOURCE_REGISTRY resolves to a
 *     ProjectArtifactSourceRegistry instance
 *   - CHANGE_STREAM is an InMemoryChangeStream singleton
 *
 * Registry behavior itself (tenant.config lookup, cache, event
 * invalidation) is covered in `project-artifact-source-registry.spec.ts`.
 */

import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
} from './agent-runtime.module';
import { SessionArtifactSnapshot } from './session-artifact-snapshot.entity';

@Injectable()
class FakeArtifactSource implements ProjectArtifactSource {
  async loadArtifacts(): Promise<ReadonlyArray<ArtifactSnapshot>> {
    return [{ path: 'fixture.md', content: '# hi', type: 'md' }];
  }
  async saveArtifact(): Promise<void> {}
}

const repoMock = {
  find: jest.fn(async () => []),
  upsert: jest.fn(),
  delete: jest.fn(),
};

function compileWith(options?: { artifactSource?: typeof FakeArtifactSource }) {
  return Test.createTestingModule({
    imports: [AgentRuntimeModule.forRoot({ artifactSource: options?.artifactSource })],
  })
    .overrideProvider(getRepositoryToken(SessionArtifactSnapshot))
    .useValue(repoMock)
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
    expect(moduleRef.get<ChangeStream>(CHANGE_STREAM)).toBe(stream);
  });

  // Note: PROJECT_ARTIFACT_SOURCE_REGISTRY binding lives in SessionsModule
  // (not AgentRuntimeModule) because the registry depends on SolutionsService.
  // Tests for the registry itself: see project-artifact-source-registry.spec.ts.
});

// Type-only assertion that the source-loader contract from agent-runtime
// is correctly typed end-to-end. The `Artifact<TContent>` import below
// verifies that the editor-side full type is still available too — they
// should coexist without name collision.
type _ArtifactStillExported = Artifact<object>;
