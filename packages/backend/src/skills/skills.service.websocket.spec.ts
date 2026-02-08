/**
 * SkillsService - WebSocket Event Tests
 *
 * TDD: Writing tests FIRST for skill_updated event emission
 *
 * Week 5 Goals:
 * - Emit skill_updated event after skill update/publish
 * - Include affected sessions list
 * - Calculate impact level (low/medium/high)
 * - Event forwarded to tenant room via ChatGateway
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SkillsService } from './skills.service';
import { Skill } from './entities/skill.entity';
import { SkillVersion } from './entities/skill-version.entity';
import { SessionService } from '../chat/session.service';

describe('SkillsService - WebSocket Events (Week 5)', () => {
  let service: SkillsService;
  let sessionService: jest.Mocked<SessionService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let skillRepository: any;
  let versionRepository: any;

  beforeEach(async () => {
    const mockSkillRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const mockVersionRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      find: jest.fn(),
    };

    const mockSessionService = {
      getAffectedSessions: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
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
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
    sessionService = module.get(SessionService);
    eventEmitter = module.get(EventEmitter2);
    skillRepository = module.get(getRepositoryToken(Skill));
    versionRepository = module.get(getRepositoryToken(SkillVersion));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateSkill - Event Emission', () => {
    it('should emit skill_updated event after updating skill', async () => {
      const mockSkill = {
        id: 'skill-123',
        name: 'Customer Support',
        slug: 'customer-support',
        tenantId: 'tenant-123',
        currentVersion: '1.2.0',
        updatedAt: new Date(),
        versions: [{ id: 'version-1' }],
      };

      const mockAffectedSessions = [
        {
          sessionId: 'session-1',
          userId: 'user-1',
            lastActivity: new Date(),
        },
        {
          sessionId: 'session-2',
          userId: 'user-2',
            lastActivity: new Date(),
        },
      ];

      skillRepository.findOne.mockResolvedValue(mockSkill);
      skillRepository.save.mockResolvedValue(mockSkill);
      versionRepository.find.mockResolvedValue(mockSkill.versions);
      sessionService.getAffectedSessions.mockReturnValue(mockAffectedSessions as any);

      await service.update('tenant-123', 'skill-123', { name: 'Updated Name' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'skill.updated',
        expect.objectContaining({
          skill: expect.objectContaining({
            id: 'skill-123',
            name: 'Updated Name', // Name was updated
            version: '1.2.0',
          }),
          affectedSessions: expect.arrayContaining([
            expect.objectContaining({
              sessionId: 'session-1',
              userId: 'user-1',
            }),
          ]),
          impact: 'low', // 2 sessions = low impact
        }),
      );
    });

    it('should include impact level based on number of affected sessions', async () => {
      const mockSkill = {
        id: 'skill-123',
        name: 'Popular Skill',
        slug: 'popular-skill',
        tenantId: 'tenant-123',
        currentVersion: '2.0.0',
        updatedAt: new Date(),
        versions: [{ id: 'version-1' }],
      };

      // Create 8 affected sessions (high impact)
      const mockAffectedSessions = Array.from({ length: 8 }, (_, i) => ({
        sessionId: `session-${i}`,
        userId: `user-${i}`,
        lastActivity: new Date(),
      }));

      skillRepository.findOne.mockResolvedValue(mockSkill);
      skillRepository.save.mockResolvedValue(mockSkill);
      versionRepository.find.mockResolvedValue(mockSkill.versions);
      sessionService.getAffectedSessions.mockReturnValue(mockAffectedSessions as any);

      await service.update('tenant-123', 'skill-123', { content: 'Updated content' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'skill.updated',
        expect.objectContaining({
          impact: 'high', // 8 sessions = high impact
        }),
      );
    });

    it('should calculate low impact (0-2 sessions)', async () => {
      const mockSkill = {
        id: 'skill-123',
        name: 'Skill',
        tenantId: 'tenant-123',
        currentVersion: '1.0.0',
        updatedAt: new Date(),
        versions: [],
      };

      skillRepository.findOne.mockResolvedValue(mockSkill);
      skillRepository.save.mockResolvedValue(mockSkill);
      versionRepository.find.mockResolvedValue([]);
      sessionService.getAffectedSessions.mockReturnValue([
        { sessionId: 'session-1', userId: 'user-1' },
      ] as any);

      await service.update('tenant-123', 'skill-123', { name: 'Updated' });

      const emitCall = eventEmitter.emit.mock.calls[0];
      expect(emitCall[1].impact).toBe('low');
    });

    it('should calculate medium impact (3-5 sessions)', async () => {
      const mockSkill = {
        id: 'skill-123',
        name: 'Skill',
        tenantId: 'tenant-123',
        currentVersion: '1.0.0',
        updatedAt: new Date(),
        versions: [],
      };

      const sessions = Array.from({ length: 4 }, (_, i) => ({
        sessionId: `session-${i}`,
        userId: `user-${i}`,
      }));

      skillRepository.findOne.mockResolvedValue(mockSkill);
      skillRepository.save.mockResolvedValue(mockSkill);
      versionRepository.find.mockResolvedValue([]);
      sessionService.getAffectedSessions.mockReturnValue(sessions as any);

      await service.update('tenant-123', 'skill-123', { name: 'Updated' });

      const emitCall = eventEmitter.emit.mock.calls[0];
      expect(emitCall[1].impact).toBe('medium');
    });

    it('should calculate high impact (6+ sessions)', async () => {
      const mockSkill = {
        id: 'skill-123',
        name: 'Skill',
        tenantId: 'tenant-123',
        currentVersion: '1.0.0',
        updatedAt: new Date(),
        versions: [],
      };

      const sessions = Array.from({ length: 10 }, (_, i) => ({
        sessionId: `session-${i}`,
        userId: `user-${i}`,
      }));

      skillRepository.findOne.mockResolvedValue(mockSkill);
      skillRepository.save.mockResolvedValue(mockSkill);
      versionRepository.find.mockResolvedValue([]);
      sessionService.getAffectedSessions.mockReturnValue(sessions as any);

      await service.update('tenant-123', 'skill-123', { name: 'Updated' });

      const emitCall = eventEmitter.emit.mock.calls[0];
      expect(emitCall[1].impact).toBe('high');
    });

    it('should handle skills with no affected sessions', async () => {
      const mockSkill = {
        id: 'skill-123',
        name: 'Unused Skill',
        tenantId: 'tenant-123',
        currentVersion: '1.0.0',
        updatedAt: new Date(),
        versions: [],
      };

      skillRepository.findOne.mockResolvedValue(mockSkill);
      skillRepository.save.mockResolvedValue(mockSkill);
      versionRepository.find.mockResolvedValue([]);
      sessionService.getAffectedSessions.mockReturnValue([]);

      await service.update('tenant-123', 'skill-123', { name: 'Updated' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'skill.updated',
        expect.objectContaining({
          affectedSessions: [],
          impact: 'low', // 0 sessions = low impact
        }),
      );
    });

  });

  describe('publishSkill - Event Emission', () => {
    it('should emit skill_updated event after publishing skill', async () => {
      const mockSkill = {
        id: 'skill-123',
        name: 'Draft Skill',
        slug: 'draft-skill',
        tenantId: 'tenant-123',
        status: 'draft',
        currentVersion: null,
        versions: [
          {
            id: 'version-1',
            versionNumber: '1.0.0',
            status: 'draft',
          },
        ],
      };

      const mockPublishedSkill = {
        ...mockSkill,
        status: 'published',
        currentVersion: '1.0.0',
        updatedAt: new Date(),
      };

      skillRepository.findOne.mockResolvedValue(mockSkill);
      skillRepository.save.mockResolvedValue(mockPublishedSkill);
      versionRepository.findOne.mockResolvedValue(mockSkill.versions[0]);
      versionRepository.save.mockResolvedValue({
        ...mockSkill.versions[0],
        status: 'published',
      });
      sessionService.getAffectedSessions.mockReturnValue([]);

      await service.publish('skill-123', 'version-1');

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'skill.updated',
        expect.objectContaining({
          skill: expect.objectContaining({
            id: 'skill-123',
            name: 'Draft Skill',
            version: '1.0.0',
          }),
        }),
      );
    });
  });
});
