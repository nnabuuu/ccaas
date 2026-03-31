/**
 * SkillsService - Toggle Tests
 *
 * Tests for skill enabled/disabled toggle functionality.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SkillsService } from './skills.service';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SkillFile } from './entities/skill-file.entity';
import { SkillVersionFile } from './entities/skill-version-file.entity';
import { SessionService } from '../sessions/session.service';

describe('SkillsService - Toggle', () => {
  let service: SkillsService;
  let skillRepo: Record<string, jest.Mock>;

  const tenantId = 'tenant-123';

  beforeEach(async () => {
    skillRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((data: any) => data),
      save: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({ ...data, updatedAt: new Date() }),
      ),
      createQueryBuilder: jest.fn(),
      manager: { transaction: jest.fn() } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        { provide: getRepositoryToken(Skill), useValue: skillRepo },
        { provide: getRepositoryToken(SkillVersion), useValue: { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() } },
        { provide: getRepositoryToken(SkillFile), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn(), delete: jest.fn() } },
        { provide: getRepositoryToken(SkillVersionFile), useValue: { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), save: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: SessionService, useValue: { getAffectedSessions: jest.fn().mockReturnValue([]) } },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should toggle enabled: true → false', async () => {
    const mockSkill = {
      id: 'skill-1',
      tenantId,
      name: 'Test Skill',
      slug: 'test-skill',
      enabled: true,
    };
    skillRepo.findOne.mockResolvedValue({ ...mockSkill });

    const result = await service.toggle(tenantId, 'skill-1');

    expect(result.enabled).toBe(false);
    expect(skillRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'skill-1', enabled: false }),
    );
  });

  it('should toggle enabled: false → true', async () => {
    const mockSkill = {
      id: 'skill-2',
      tenantId,
      name: 'Disabled Skill',
      slug: 'disabled-skill',
      enabled: false,
    };
    skillRepo.findOne.mockResolvedValue({ ...mockSkill });

    const result = await service.toggle(tenantId, 'skill-2');

    expect(result.enabled).toBe(true);
    expect(skillRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'skill-2', enabled: true }),
    );
  });

  it('should throw NotFoundException for non-existent skill', async () => {
    skillRepo.findOne.mockResolvedValue(null);

    await expect(service.toggle(tenantId, 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
