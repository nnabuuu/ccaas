/**
 * ObservationRepository + ObserverEventRepository integration tests
 * against an in-memory SQLite.
 *
 * Proves: M1 persistence wiring is correct, dedup gate works, the
 * entity columns map round-trip.
 */

import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObservationRecord, ObserverEventRecord } from '../entities';
import { ObservationRepository } from './observation-repository';
import { ObserverEventRepository } from './observer-event-repository';
import { getTestDatabaseOptions } from '../../../test/setup/test-database';

describe('ObservationRepository + ObserverEventRepository', () => {
  let observationRepo: ObservationRepository;
  let eventRepo: ObserverEventRepository;
  let rawObsRepo: Repository<ObservationRecord>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(getTestDatabaseOptions()),
        TypeOrmModule.forFeature([ObservationRecord, ObserverEventRecord]),
      ],
      providers: [ObservationRepository, ObserverEventRepository],
    }).compile();
    observationRepo = module.get(ObservationRepository);
    eventRepo = module.get(ObserverEventRepository);
    rawObsRepo = module.get<Repository<ObservationRecord>>(
      getRepositoryToken(ObservationRecord),
    );
  });

  it('append + getByEntity round-trips an observation', async () => {
    await observationRepo.append({
      id: 'obs-1',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: { action: 'join', studentName: 'Alice' },
      triggerEventId: 'evt-1',
      createdAt: 1000,
      updatedAt: 1000,
    });
    const obs = await observationRepo.getByEntity('s1', 'student-1');
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatchObject({
      id: 'obs-1',
      type: 'lifecycle',
      data: { action: 'join', studentName: 'Alice' },
    });
  });

  it('update patches type + data and bumps updatedAtEpoch', async () => {
    await observationRepo.append({
      id: 'obs-2',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      type: 'indicator_hit',
      data: { gist: 'first try' },
      triggerEventId: 'evt-2',
      createdAt: 1000,
      updatedAt: 1000,
    });
    await observationRepo.update('obs-2', {
      data: { gist: 'refined understanding' },
    });
    const [obs] = await observationRepo.getByEntity('s1', 'student-1');
    expect(obs.data).toEqual({ gist: 'refined understanding' });
    expect(obs.updatedAt).toBeGreaterThan(obs.createdAt);
  });

  it('update on a non-existent observation is a no-op (idempotent miss)', async () => {
    await expect(
      observationRepo.update('does-not-exist', { type: 'whatever' }),
    ).resolves.toBeUndefined();
  });

  it('getBySession returns observations in insertion order', async () => {
    await observationRepo.append({
      id: 'a',
      sessionId: 's1',
      entityId: 'st-1',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: {},
      triggerEventId: 'evt-a',
      createdAt: 100,
      updatedAt: 100,
    });
    await observationRepo.append({
      id: 'b',
      sessionId: 's1',
      entityId: 'st-2',
      solutionId: 'live-lesson',
      type: 'progress',
      data: {},
      triggerEventId: 'evt-b',
      createdAt: 200,
      updatedAt: 200,
    });
    const session = await observationRepo.getBySession('s1');
    expect(session.map((o) => o.id)).toEqual(['a', 'b']);
  });

  it('getBySessionAndType filters by type', async () => {
    await observationRepo.append({
      id: 'l',
      sessionId: 's1',
      entityId: 'st-1',
      solutionId: 'live-lesson',
      type: 'lifecycle',
      data: {},
      triggerEventId: 'evt-1',
      createdAt: 100,
      updatedAt: 100,
    });
    await observationRepo.append({
      id: 'p',
      sessionId: 's1',
      entityId: 'st-1',
      solutionId: 'live-lesson',
      type: 'progress',
      data: {},
      triggerEventId: 'evt-2',
      createdAt: 200,
      updatedAt: 200,
    });
    const lifecycle = await observationRepo.getBySessionAndType(
      's1',
      'lifecycle',
    );
    expect(lifecycle.map((o) => o.id)).toEqual(['l']);
  });

  it('event dedup: hasEvent returns false before save, true after', async () => {
    expect(await eventRepo.hasEvent('evt-x')).toBe(false);
    await eventRepo.save({
      id: 'evt-x',
      type: 'student_join',
      sessionId: 's1',
      entityId: 'student-1',
      solutionId: 'live-lesson',
      timestamp: 1000,
      payload: { studentName: 'Alice' },
    });
    expect(await eventRepo.hasEvent('evt-x')).toBe(true);
  });

  it('event getBySession respects limit + after options', async () => {
    for (let i = 1; i <= 5; i++) {
      await eventRepo.save({
        id: `evt-${i}`,
        type: 'test',
        sessionId: 's1',
        entityId: 'e',
        solutionId: 'live-lesson',
        timestamp: i * 100,
        payload: { i },
      });
    }
    const after2 = await eventRepo.getBySession('s1', { after: 200 });
    expect(after2.map((e) => e.id)).toEqual(['evt-3', 'evt-4', 'evt-5']);
    const limited = await eventRepo.getBySession('s1', { limit: 2 });
    expect(limited).toHaveLength(2);
  });

  it('raw repo write is visible via the wrapper (no caching surprises)', async () => {
    // belt-and-suspenders: write through TypeORM directly, read via repo
    await rawObsRepo.save(
      rawObsRepo.create({
        id: 'direct',
        sessionId: 's1',
        entityId: 'st',
        solutionId: 'live-lesson',
        type: 'lifecycle',
        data: { from: 'raw' },
        triggerEventId: 'evt',
        createdAtEpoch: 1,
        updatedAtEpoch: 1,
      }),
    );
    const [obs] = await observationRepo.getByEntity('s1', 'st');
    expect(obs.data).toEqual({ from: 'raw' });
  });
});
