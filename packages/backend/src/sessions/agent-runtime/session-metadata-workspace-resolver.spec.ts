/**
 * SessionMetadataWorkspaceResolver spec.
 *
 * Covers: returns true when a binding exists for (projectId, solutionId)
 * with the canonical JSON-quoted value the SessionMetadataService
 * writes; matches the raw-string legacy format; returns false when no
 * row matches; returns false when projectId or solutionId is empty;
 * returns false when binding exists but for a DIFFERENT tenant (the
 * multi-tenant correctness check — caller can't piggyback on another
 * tenant's binding).
 */

import { DataSource, Repository } from 'typeorm';

import { SessionMetadata } from '../entities/session-metadata.entity';
import { SessionMetadataWorkspaceResolver } from './session-metadata-workspace-resolver';

describe('SessionMetadataWorkspaceResolver', () => {
  let dataSource: DataSource;
  let repo: Repository<SessionMetadata>;
  let resolver: SessionMetadataWorkspaceResolver;

  const TENANT_A = 'tenant-A';
  const TENANT_B = 'tenant-B';

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [SessionMetadata],
      synchronize: true,
      logging: false,
    });
    await dataSource.initialize();
    repo = dataSource.getRepository(SessionMetadata);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await repo.clear();
    resolver = new SessionMetadataWorkspaceResolver(repo);
  });

  it('returns false for empty projectId', async () => {
    expect(await resolver.verifyProjectAccess('', TENANT_A)).toBe(false);
  });

  it('returns false for empty callerTenantId', async () => {
    expect(await resolver.verifyProjectAccess('proj-1', '')).toBe(false);
  });

  it('returns false when no binding exists', async () => {
    expect(
      await resolver.verifyProjectAccess('proj-unknown', TENANT_A),
    ).toBe(false);
  });

  it('returns true for the canonical JSON-quoted value (matches SessionMetadataService.put)', async () => {
    await repo.save(
      repo.create({
        sessionId: 'sess-1',
        solutionId: TENANT_A,
        key: 'projectId',
        value: JSON.stringify('proj-1'),
      }),
    );
    expect(
      await resolver.verifyProjectAccess('proj-1', TENANT_A),
    ).toBe(true);
  });

  it('also matches raw-string value (legacy / prototype data)', async () => {
    await repo.save(
      repo.create({
        sessionId: 'sess-2',
        solutionId: TENANT_A,
        key: 'projectId',
        value: 'proj-2',
      }),
    );
    expect(
      await resolver.verifyProjectAccess('proj-2', TENANT_A),
    ).toBe(true);
  });

  it('returns false when binding exists for a DIFFERENT tenant (multi-tenant isolation)', async () => {
    // Critical: even when the projectId exists in the metadata table,
    // callers from a different tenant must NOT see it.
    await repo.save(
      repo.create({
        sessionId: 'sess-other',
        solutionId: TENANT_B,
        key: 'projectId',
        value: JSON.stringify('proj-shared'),
      }),
    );
    expect(
      await resolver.verifyProjectAccess('proj-shared', TENANT_A),
    ).toBe(false);
    // Sanity: tenant B itself can access.
    expect(
      await resolver.verifyProjectAccess('proj-shared', TENANT_B),
    ).toBe(true);
  });

  it('returns true even when multiple sessions for the same caller bind the same project', async () => {
    await repo.save(
      repo.create({
        sessionId: 'sess-1',
        solutionId: TENANT_A,
        key: 'projectId',
        value: JSON.stringify('proj-multi'),
      }),
    );
    await repo.save(
      repo.create({
        sessionId: 'sess-2',
        solutionId: TENANT_A,
        key: 'projectId',
        value: JSON.stringify('proj-multi'),
      }),
    );
    expect(
      await resolver.verifyProjectAccess('proj-multi', TENANT_A),
    ).toBe(true);
  });
});
