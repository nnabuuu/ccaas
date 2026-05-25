/**
 * TypeOrmSnapshotStore adapter tests.
 *
 * Verifies the TypeORM-backed `SnapshotStore` impl translates between
 * the runtime's `SnapshotEntry` value object and the
 * `SessionArtifactSnapshot` entity correctly. Repository is mocked;
 * tests assert the calls the store makes against it.
 */

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TypeOrmSnapshotStore } from './typeorm-snapshot-store';
import { SessionArtifactSnapshot } from './session-artifact-snapshot.entity';

const repoMock = {
  find: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
};

describe('TypeOrmSnapshotStore', () => {
  let store: TypeOrmSnapshotStore;

  beforeEach(async () => {
    repoMock.find.mockReset();
    repoMock.upsert.mockReset();
    repoMock.delete.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmSnapshotStore,
        { provide: getRepositoryToken(SessionArtifactSnapshot), useValue: repoMock },
      ],
    }).compile();
    store = moduleRef.get(TypeOrmSnapshotStore);
  });

  it('list maps entity rows to SnapshotEntry value objects', async () => {
    repoMock.find.mockResolvedValueOnce([
      {
        sessionId: 's1',
        path: 'a.md',
        contentHash: 'h1',
        type: 'md',
        updatedAt: new Date('2026-05-25T12:00:00Z'),
      },
    ]);
    const out = await store.list('s1');
    expect(repoMock.find).toHaveBeenCalledWith({ where: { sessionId: 's1' } });
    expect(out).toEqual([
      {
        sessionId: 's1',
        path: 'a.md',
        contentHash: 'h1',
        type: 'md',
        updatedAt: '2026-05-25T12:00:00.000Z',
      },
    ]);
  });

  it('put issues an upsert keyed on (sessionId, path)', async () => {
    await store.put({
      sessionId: 's1',
      path: 'a.md',
      contentHash: 'h2',
      type: 'md',
      updatedAt: '2026-05-25T12:00:00.000Z',
    });
    expect(repoMock.upsert).toHaveBeenCalledWith(
      {
        sessionId: 's1',
        path: 'a.md',
        contentHash: 'h2',
        type: 'md',
      },
      ['sessionId', 'path'],
    );
  });

  it('remove deletes by composite key', async () => {
    await store.remove('s1', 'a.md');
    expect(repoMock.delete).toHaveBeenCalledWith({ sessionId: 's1', path: 'a.md' });
  });

  it('clear deletes every row for a session', async () => {
    await store.clear('s1');
    expect(repoMock.delete).toHaveBeenCalledWith({ sessionId: 's1' });
  });
});
