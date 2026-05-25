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
} from './agent-runtime.module';
import { SessionArtifactSnapshot } from './session-artifact-snapshot.entity';
import { SessionService } from '../session.service';
import { SessionMetadataService } from '../services/session-metadata.service';

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

function compileWith(options?: { artifactSource?: typeof FakeArtifactSource }) {
  const builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [AgentRuntimeModule.forRoot(options ?? {})],
    providers: [
      { provide: SessionService, useValue: { getSession: jest.fn(() => undefined) } },
      { provide: SessionMetadataService, useValue: { get: jest.fn() } },
    ],
  });
  return builder
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
});

// Type-only assertion that the source-loader contract from agent-runtime
// is correctly typed end-to-end. The `Artifact<TContent>` import below
// verifies that the editor-side full type is still available too — they
// should coexist without name collision.
type _ArtifactStillExported = Artifact<object>;
