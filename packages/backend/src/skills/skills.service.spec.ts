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
      skillRepo.findOne.mockResolvedValue(null); // no duplicate
      // createVersion -> transaction -> findOne returns the saved skill
      txManager.findOne.mockResolvedValue({
        id: 'new-skill-id',
        name: 'My Skill',
        content: 'You are a helpful assistant',
        config: {},
        allowedTools: [],
        currentVersion: null,
      });

      const result = await service.create(tenantId, createDto);

      expect(skillRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId, slug: 'my-skill' },
      });
      expect(skillRepo.create).toHaveBeenCalled();
      expect(skillRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('should throw AlreadyExistsException when slug already exists', async () => {
      skillRepo.findOne.mockResolvedValue({ id: 'existing-id', slug: 'my-skill', tenantId });

      await expect(service.create(tenantId, createDto)).rejects.toThrow(AlreadyExistsException);

      expect(skillRepo.create).not.toHaveBeenCalled();
      expect(skillRepo.save).not.toHaveBeenCalled();
    });

    it('should include slug in AlreadyExistsException message', async () => {
      skillRepo.findOne.mockResolvedValue({ id: 'existing-id', slug: 'my-skill', tenantId });

      await expect(service.create(tenantId, createDto)).rejects.toThrow(/my-skill/);
    });

    it('should generate slug from name when slug is not provided', async () => {
      skillRepo.findOne.mockResolvedValue(null);
      txManager.findOne.mockResolvedValue({
        id: 'new-skill-id',
        name: 'Hello World',
        content: 'content',
        config: {},
        allowedTools: [],
        currentVersion: null,
      });

      await service.create(tenantId, { name: 'Hello World', content: 'content', type: 'skill' });

      expect(skillRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId, slug: 'hello-world' },
      });
    });
  });
});
