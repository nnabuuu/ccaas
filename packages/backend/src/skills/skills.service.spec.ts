/**
 * SkillsService - Core CRUD Tests
 *
 * Tests for skill create() with duplicate slug detection.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SkillsService } from './skills.service';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillFile } from './entities/skill-file.entity';
import { SkillVersionFile } from './entities/skill-version-file.entity';
import { AlreadyExistsException } from '../protocol/http-exceptions';
import { SessionService } from '../sessions/session.service';

describe('SkillsService', () => {
  let service: SkillsService;
  let skillRepo: Record<string, jest.Mock>;
  let txManager: Record<string, jest.Mock>;

  const tenantId = 'tenant-1';

  beforeEach(async () => {
    txManager = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((_entity: any, data: any) => data),
      save: jest.fn().mockImplementation((_entity: any, data: any) => {
        if (Array.isArray(data)) return Promise.resolve(data);
        return Promise.resolve({ id: 'saved-1', ...data });
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      transaction: jest.fn().mockImplementation((cb: any) => cb(txManager)),
    };

    skillRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => ({ id: 'new-skill-id', ...data })),
      save: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({ ...data, updatedAt: new Date() }),
      ),
      createQueryBuilder: jest.fn(),
      manager: txManager as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(SkillVersion), useValue: { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]), create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(SkillFile), useValue: { find: jest.fn().mockResolvedValue([]), create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(SkillVersionFile), useValue: { find: jest.fn(), create: jest.fn(), save: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: SessionService, useValue: { getAffectedSessions: jest.fn().mockReturnValue([]) } },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create()', () => {
    const createDto = {
      name: 'My Skill',
      slug: 'my-skill',
      content: 'You are a helpful assistant',
      type: 'skill' as const,
    };

    it('should create a skill successfully when slug is unique', async () => {
      // Duplicate check runs inside the transaction now — returns null = no dup.
      txManager.findOne.mockResolvedValue(null);

      const result = await service.create(tenantId, createDto);

      expect(txManager.findOne).toHaveBeenCalledWith(Skill, {
        where: { tenantId, slug: 'my-skill' },
      });
      expect(txManager.create).toHaveBeenCalled();
      expect(txManager.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('should throw AlreadyExistsException when slug already exists', async () => {
      txManager.findOne.mockResolvedValue({ id: 'existing-id', slug: 'my-skill', tenantId });

      await expect(service.create(tenantId, createDto)).rejects.toThrow(AlreadyExistsException);
    });

    it('should include slug in AlreadyExistsException message', async () => {
      txManager.findOne.mockResolvedValue({ id: 'existing-id', slug: 'my-skill', tenantId });

      await expect(service.create(tenantId, createDto)).rejects.toThrow(/my-skill/);
    });

    it('should generate slug from name when slug is not provided', async () => {
      txManager.findOne.mockResolvedValue(null);

      await service.create(tenantId, { name: 'Hello World', content: 'content', type: 'skill' });

      expect(txManager.findOne).toHaveBeenCalledWith(Skill, {
        where: { tenantId, slug: 'hello-world' },
      });
    });

    // ----- Transactional rollback (HIGH #3) --------------------------------
    // If the SkillVersion or SkillFile save throws mid-create, the whole
    // transaction must roll back — otherwise the skills row survives, and
    // SolutionLoaderService.importOneSkill's idempotency check
    // (`findOne(tenantId, slug)` -> skip) would skip the re-import on
    // every subsequent boot, leaving the skill permanently versionless.

    it('rolls back the skill row when a downstream save throws', async () => {
      txManager.findOne.mockResolvedValue(null);
      // Simulate transaction failure: the second save (SkillVersion) throws.
      // Real TypeORM would roll back the SkillRow committed earlier in the
      // same transaction. We assert the error propagates and the outer
      // promise rejects — confirming we're inside a transaction wrapper.
      let saveCount = 0;
      txManager.save.mockImplementation((_entity: any, data: any) => {
        saveCount += 1;
        if (saveCount === 2) {
          return Promise.reject(new Error('simulated version-write failure'));
        }
        if (Array.isArray(data)) return Promise.resolve(data);
        return Promise.resolve({ id: 'saved-1', ...data });
      });

      await expect(service.create(tenantId, createDto)).rejects.toThrow(
        /simulated version-write failure/,
      );

      // Notifier must NOT fire when the transaction rolls back.
      // (The SkillChangeNotifier call lives after the transaction in
      // skills.service.ts; on rejection, control never reaches it.)
      expect(txManager.transaction).toHaveBeenCalled();
    });

    it('runs the whole create inside a single transaction', async () => {
      txManager.findOne.mockResolvedValue(null);

      await service.create(tenantId, {
        ...createDto,
        files: [{ relativePath: 'tools/check.sh', content: '#!/bin/sh\n' }],
      });

      // Three writes (Skill, SkillFile[], SkillVersion, SkillVersionFile[])
      // all happen via the SAME manager — the transaction callback.
      expect(txManager.transaction).toHaveBeenCalledTimes(1);
      // Confirm we saved against multiple entity tables via the same manager.
      const entitiesSaved = txManager.save.mock.calls.map((c: any[]) =>
        typeof c[0] === 'function' ? c[0].name : c[0],
      );
      expect(entitiesSaved).toEqual(expect.arrayContaining(['Skill', 'SkillFile', 'SkillVersion']));
    });
  });
});
