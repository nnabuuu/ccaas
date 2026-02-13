/**
 * SkillsService User Attribution Tests
 *
 * TDD: Writing tests FIRST for user attribution and filtering
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SkillsService } from './skills.service';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SessionService } from '../sessions/session.service';

describe('SkillsService - User Attribution', () => {
  let service: SkillsService;
  let skillRepository: jest.Mocked<Repository<Skill>>;
  let versionRepository: jest.Mocked<Repository<SkillVersion>>;

  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(async () => {
    const mockSkillRepository = {
      create: jest.fn(),
      save: jest.fn((skill) => Promise.resolve({
        ...skill,
        updatedAt: skill.updatedAt || new Date(), // Week 5: Ensure updatedAt is set
      })),
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockVersionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
      on: jest.fn(),
    };

    const mockSessionService = {
      getAffectedSessions: jest.fn().mockReturnValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        {
          provide: getRepositoryToken(Skill),
          useValue: mockSkillRepository,
        },
        {
          provide: getRepositoryToken(SkillVersion),
          useValue: mockVersionRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
    skillRepository = module.get(getRepositoryToken(Skill));
    versionRepository = module.get(getRepositoryToken(SkillVersion));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should set createdBy when userId is provided', async () => {
      const createDto = {
        name: 'Test Skill',
        slug: 'test-skill',
        type: 'skill' as const,
        content: 'Test content',
        scope: 'tenant' as const,
      };

      const mockSkill = {
        id: 'skill-123',
        tenantId,
        ...createDto,
        createdBy: userId,
      };

      // First call: check for duplicate (return null)
      // Second call: find skill for createVersion (return saved skill)
      skillRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSkill as any);
      skillRepository.create.mockReturnValue(mockSkill as any);
      skillRepository.save
        .mockResolvedValueOnce(mockSkill as any)
        .mockResolvedValueOnce(mockSkill as any); // For version update
      versionRepository.create.mockReturnValue({} as any);
      versionRepository.save.mockResolvedValue({} as any);
      versionRepository.find.mockResolvedValue([]); // No existing versions

      const result = await service.create(tenantId, createDto, userId);

      expect(skillRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        tenantId,
        createdBy: userId,
        scope: 'tenant',
      }));
      expect(result.createdBy).toBe(userId);
    });

    it('should set createdBy to null when userId is not provided', async () => {
      const createDto = {
        name: 'Test Skill',
        slug: 'test-skill',
        type: 'skill' as const,
        content: 'Test content',
      };

      const mockSkill = {
        id: 'skill-123',
        tenantId,
        ...createDto,
        createdBy: null,
        scope: 'tenant',
      };

      skillRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSkill as any);
      skillRepository.create.mockReturnValue(mockSkill as any);
      skillRepository.save
        .mockResolvedValueOnce(mockSkill as any)
        .mockResolvedValueOnce(mockSkill as any);
      versionRepository.create.mockReturnValue({} as any);
      versionRepository.save.mockResolvedValue({} as any);
      versionRepository.find.mockResolvedValue([]);

      const result = await service.create(tenantId, createDto);

      expect(skillRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        createdBy: null,
      }));
      expect(result.createdBy).toBeNull();
    });

    it('should default scope to tenant when not specified', async () => {
      const createDto = {
        name: 'Test Skill',
        slug: 'test-skill',
        type: 'skill' as const,
        content: 'Test content',
      };

      const mockSkill = {
        id: 'skill-123',
        tenantId,
        ...createDto,
        createdBy: userId,
        scope: 'tenant',
      };

      skillRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSkill as any);
      skillRepository.create.mockReturnValue(mockSkill as any);
      skillRepository.save
        .mockResolvedValueOnce(mockSkill as any)
        .mockResolvedValueOnce(mockSkill as any);
      versionRepository.create.mockReturnValue({} as any);
      versionRepository.save.mockResolvedValue({} as any);
      versionRepository.find.mockResolvedValue([]);

      const result = await service.create(tenantId, createDto, userId);

      expect(skillRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        scope: 'tenant',
      }));
      expect(result.scope).toBe('tenant');
    });

    it('should allow personal scope when specified', async () => {
      const createDto = {
        name: 'Personal Skill',
        slug: 'personal-skill',
        type: 'skill' as const,
        content: 'Personal content',
        scope: 'personal' as const,
      };

      const mockSkill = {
        id: 'skill-456',
        tenantId,
        ...createDto,
        createdBy: userId,
      };

      skillRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSkill as any);
      skillRepository.create.mockReturnValue(mockSkill as any);
      skillRepository.save
        .mockResolvedValueOnce(mockSkill as any)
        .mockResolvedValueOnce(mockSkill as any);
      versionRepository.create.mockReturnValue({} as any);
      versionRepository.save.mockResolvedValue({} as any);
      versionRepository.find.mockResolvedValue([]);

      const result = await service.create(tenantId, createDto, userId);

      expect(skillRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        scope: 'personal',
      }));
      expect(result.scope).toBe('personal');
    });
  });

  describe('findAll', () => {
    it('should filter personal skills to only show user\'s own skills', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            { id: '1', scope: 'tenant', tenantId },
            { id: '2', scope: 'tenant', tenantId },
            { id: '3', scope: 'personal', createdBy: userId, tenantId },
          ],
          3,
        ]),
      };

      skillRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll(tenantId, {}, userId);

      // Check that personal skill filter was applied
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(skill.scope = :tenantScope OR (skill.scope = :personalScope AND skill.createdBy = :userId))',
        { tenantScope: 'tenant', personalScope: 'personal', userId },
      );
      expect(result.items).toHaveLength(3);
    });

    it('should show all tenant-scoped skills to everyone', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            { id: '1', scope: 'tenant', tenantId },
            { id: '2', scope: 'tenant', tenantId },
          ],
          2,
        ]),
      };

      skillRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll(tenantId, {}, userId);

      expect(result.items).toHaveLength(2);
      expect(result.items.every((s: Skill) => s.scope === 'tenant')).toBe(true);
    });

    it('should only show tenant-scoped skills for anonymous users', async () => {
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            { id: '1', scope: 'tenant', tenantId },
            { id: '2', scope: 'tenant', tenantId },
          ],
          2,
        ]),
      };

      skillRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll(tenantId, {});

      // Should filter to only tenant scope
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'skill.scope = :tenantScope',
        { tenantScope: 'tenant' },
      );
      expect(result.items).toHaveLength(2);
    });

    it('should filter by createdBy when specified', async () => {
      const otherUserId = 'other-user';
      const queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [{ id: '1', scope: 'tenant', createdBy: otherUserId, tenantId }],
          1,
        ]),
      };

      skillRepository.createQueryBuilder.mockReturnValue(queryBuilder as any);

      const result = await service.findAll(tenantId, { createdBy: otherUserId }, userId);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'skill.createdBy = :createdBy',
        { createdBy: otherUserId },
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should preserve createdBy field on update', async () => {
      const skillId = 'skill-123';
      const originalCreatedBy = 'original-user';

      const existingSkill = {
        id: skillId,
        tenantId,
        createdBy: originalCreatedBy,
        name: 'Original Name',
        content: 'Original content',
        config: {},
      };

      const updateDto = {
        name: 'Updated Name',
        content: 'Updated content',
      };

      skillRepository.findOne.mockResolvedValue(existingSkill as any);
      skillRepository.save.mockResolvedValue({
        ...existingSkill,
        ...updateDto,
        createdBy: originalCreatedBy, // Should remain unchanged
        updatedAt: new Date(), // Week 5: Required for event emission
      } as any);

      const result = await service.update(tenantId, skillId, updateDto);

      expect(result.createdBy).toBe(originalCreatedBy);
      expect(skillRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          createdBy: originalCreatedBy,
        }),
      );
    });

    it('should not allow changing createdBy through update', async () => {
      const skillId = 'skill-123';
      const originalCreatedBy = 'original-user';
      const attemptedNewUser = 'hacker-user';

      const existingSkill = {
        id: skillId,
        tenantId,
        createdBy: originalCreatedBy,
        name: 'Original Name',
        content: 'Original content',
        config: {},
      };

      const maliciousUpdateDto = {
        name: 'Updated Name',
        createdBy: attemptedNewUser, // Attempt to change ownership
      } as any;

      skillRepository.findOne.mockResolvedValue(existingSkill as any);
      skillRepository.save.mockResolvedValue({
        ...existingSkill,
        name: maliciousUpdateDto.name,
        createdBy: originalCreatedBy, // Should remain unchanged
        updatedAt: new Date(), // Week 5: Required for event emission
      } as any);

      const result = await service.update(tenantId, skillId, maliciousUpdateDto);

      // createdBy should NOT change
      expect(result.createdBy).toBe(originalCreatedBy);
      expect(result.createdBy).not.toBe(attemptedNewUser);
    });

    it('should allow changing scope', async () => {
      const skillId = 'skill-123';

      const existingSkill = {
        id: skillId,
        tenantId,
        createdBy: userId,
        scope: 'personal',
        name: 'Test Skill',
        content: 'Test content',
        config: {},
      };

      const updateDto = {
        scope: 'tenant' as const,
      };

      skillRepository.findOne.mockResolvedValue(existingSkill as any);
      skillRepository.save.mockResolvedValue({
        ...existingSkill,
        scope: 'tenant',
        updatedAt: new Date(), // Week 5: Required for event emission
      } as any);

      const result = await service.update(tenantId, skillId, updateDto);

      expect(result.scope).toBe('tenant');
    });
  });

  describe('findOne', () => {
    it('should return skill with creator information', async () => {
      const skillId = 'skill-123';
      const mockSkill = {
        id: skillId,
        tenantId,
        createdBy: userId,
        creator: {
          id: userId,
          name: 'Test User',
          email: 'test@example.com',
        },
      };

      skillRepository.findOne.mockResolvedValue(mockSkill as any);

      const result = await service.findOne(tenantId, skillId);

      expect(result).toBeDefined();
      expect(result?.createdBy).toBe(userId);
      expect(result?.creator).toBeDefined();
      expect(result?.creator?.name).toBe('Test User');
    });

    it('should handle legacy skills without creator gracefully', async () => {
      const skillId = 'legacy-skill';
      const mockSkill = {
        id: skillId,
        tenantId,
        createdBy: null,
        creator: null,
      };

      skillRepository.findOne.mockResolvedValue(mockSkill as any);

      const result = await service.findOne(tenantId, skillId);

      expect(result).toBeDefined();
      expect(result?.createdBy).toBeNull();
      expect(result?.creator).toBeNull();
    });
  });
});
