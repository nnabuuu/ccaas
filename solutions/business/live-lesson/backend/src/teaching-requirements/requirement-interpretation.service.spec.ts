/**
 * Tests for RequirementInterpretationService — L2 CRUD.
 *
 * Uses a mocked TypeORM repo; the service is thin enough that the
 * value is in the operation semantics (find returns null vs row,
 * upsert insert-or-update, remove throws on missing) rather than
 * query construction.
 */

import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { RequirementInterpretation } from './requirement-interpretation.entity';
import { RequirementInterpretationService } from './requirement-interpretation.service';

function makeRepo() {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((dto: any) => ({ ...dto })),
    save: jest.fn((entity: any) =>
      Promise.resolve({
        id: 'row-1',
        ...entity,
        createdAt: '2026-05-27T00:00:00.000Z',
        updatedAt: '2026-05-27T00:00:01.000Z',
      }),
    ),
    upsert: jest.fn().mockResolvedValue({ identifiers: [{ id: 'row-1' }] }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}

describe('RequirementInterpretationService', () => {
  let service: RequirementInterpretationService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        RequirementInterpretationService,
        { provide: getRepositoryToken(RequirementInterpretation), useValue: repo },
      ],
    }).compile();
    service = mod.get(RequirementInterpretationService);
  });

  describe('find', () => {
    it('returns null when the user has no interpretation', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      expect(await service.find('alice', 'r-1.2.3')).toBeNull();
    });

    it('returns the overlay shape when found', async () => {
      repo.findOne.mockResolvedValueOnce({
        notes: '我的解读',
        updatedAt: '2026-05-27T00:00:01.000Z',
        userId: 'alice',
        reqId: 'r-1.2.3',
      });
      expect(await service.find('alice', 'r-1.2.3')).toEqual({
        notes: '我的解读',
        updatedAt: '2026-05-27T00:00:01.000Z',
      });
    });

    it('scopes by both userId and reqId in the WHERE clause', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await service.find('alice', 'r-1.2.3');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: 'alice', reqId: 'r-1.2.3' },
      });
    });
  });

  describe('listForUser', () => {
    it('returns rows ordered by reqId ASC', async () => {
      repo.find.mockResolvedValueOnce([
        { reqId: 'r-1.2.3', notes: 'a', updatedAt: 't1' },
        { reqId: 'r-2.1.1', notes: 'b', updatedAt: 't2' },
      ]);
      const out = await service.listForUser('alice');
      expect(out).toEqual([
        { reqId: 'r-1.2.3', notes: 'a', updatedAt: 't1' },
        { reqId: 'r-2.1.1', notes: 'b', updatedAt: 't2' },
      ]);
      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 'alice' },
        order: { reqId: 'ASC' },
      });
    });

    it('returns empty array when user has no interpretations', async () => {
      repo.find.mockResolvedValueOnce([]);
      expect(await service.listForUser('bob')).toEqual([]);
    });
  });

  describe('upsert', () => {
    it('calls atomic upsert with the (userId, reqId) conflict path', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'row-1',
        userId: 'alice',
        reqId: 'r-1.2.3',
        notes: 'new content',
        updatedAt: '2026-05-27T00:00:01.000Z',
      });
      const out = await service.upsert('alice', 'r-1.2.3', 'new content');
      expect(repo.upsert).toHaveBeenCalledWith(
        { userId: 'alice', reqId: 'r-1.2.3', notes: 'new content' },
        expect.objectContaining({
          conflictPaths: ['userId', 'reqId'],
          skipUpdateIfNoValuesChanged: false,
        }),
      );
      expect(out.notes).toBe('new content');
      expect(out.updatedAt).toBeTruthy();
    });

    it('re-reads the row after upsert to get the persisted timestamp', async () => {
      repo.findOne.mockResolvedValueOnce({
        notes: 'fresh',
        updatedAt: '2026-05-27T00:00:01.000Z',
      });
      const out = await service.upsert('alice', 'r-1.2.3', 'fresh');
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { userId: 'alice', reqId: 'r-1.2.3' },
      });
      expect(out.notes).toBe('fresh');
    });

    it('throws when upsert succeeds but the re-read returns null (defense)', async () => {
      // Defense-in-depth: SQLite isolation should prevent this, but
      // if some future engine returns null we surface the
      // inconsistency loudly rather than silently dropping the write.
      repo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.upsert('alice', 'r-1.2.3', 'fresh'),
      ).rejects.toThrow(/vanished/);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when no row exists for this (user, req)', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.remove('alice', 'r-1.2.3')).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('removes the row when found', async () => {
      const existing = { id: 'row-1', userId: 'alice', reqId: 'r-1.2.3' };
      repo.findOne.mockResolvedValueOnce(existing);
      await service.remove('alice', 'r-1.2.3');
      expect(repo.remove).toHaveBeenCalledWith(existing);
    });
  });
});
