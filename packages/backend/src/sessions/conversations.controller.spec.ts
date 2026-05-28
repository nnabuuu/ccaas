/**
 * Session List/Search/Update/Delete Tests
 *
 * Tests for the session management endpoints that were migrated from
 * ConversationsController into SessionsController.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SessionsController } from './sessions.controller';
import { Session } from '../admin/entities/session.entity';
import { Turn } from '../admin/entities/turn.entity';
import { TurnsService } from '../admin/services/turns.service';
import { SessionsGateway } from './sessions.gateway';
import { SessionService } from './session.service';
import { CompletionOrchestrationService } from './services/completion-orchestration.service';
import { MessageQueueService } from './services/message-queue.service';
import { SkillManagementService } from './services/skill-management.service';
import { AttachmentService } from './services/attachment.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import { SkillsService } from '../skills/skills.service';
import { SolutionsService } from '../solutions/solutions.service';
import { SolutionAuthGuard } from '../solutions/solution-auth.guard';
import { UserSolutionService } from '../users/user-solution.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { QuotaGuard } from '../admin/guards/quota.guard';
import { MessagesService } from '../messages/messages.service';
import { ConversationContextService } from '../messages/conversation-context.service';
import { StreamRegistryService } from './services/stream-registry.service';
import { CliProcessService } from './services/cli-process.service';

describe('SessionsController (list/search/update/delete)', () => {
  let controller: SessionsController;
  let sessionRepository: jest.Mocked<Repository<Session>>;
  let turnsService: jest.Mocked<TurnsService>;

  const createMockQueryBuilder = (overrides: Partial<SelectQueryBuilder<any>> = {}) => {
    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
      getCount: jest.fn().mockResolvedValue(0),
      ...overrides,
    };
    return mockQb as unknown as jest.Mocked<SelectQueryBuilder<any>>;
  };

  const createMockSession = (
    sessionId: string,
    overrides: Partial<Session> = {},
  ): Session => ({
    id: `uuid-${sessionId}`,
    sessionId,
    solutionId: 'tenant-a',
    userId: null,
    actingUserId: null,
    actingRole: null,
    clientId: `client-${sessionId}`,
    status: 'idle' as any,
    messageCount: 5,
    totalTokens: 1000,
    estimatedCost: 0.05,
    createdAt: new Date(),
    lastActivity: new Date(),
    closedAt: null,
    title: null,
    isPinned: false,
    templateName: null,
    workspaceDir: `/tmp/${sessionId}`,
    updatedAt: new Date(),
    ...overrides,
  });

  // Minimal mock for unused dependencies
  const noopProvider = (token: any) => ({ provide: token, useValue: {} });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        {
          provide: getRepositoryToken(Session),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: TurnsService,
          useValue: {
            getTurnsBySession: jest.fn(),
          },
        },
        noopProvider(SessionsGateway),
        noopProvider(SessionService),
        noopProvider(CompletionOrchestrationService),
        noopProvider(MessageQueueService),
        noopProvider(SkillManagementService),
        noopProvider(AttachmentService),
        noopProvider(SkillSyncService),
        noopProvider(SkillsService),
        noopProvider(SolutionsService),
        noopProvider(UserSolutionService),
        noopProvider(MessagesService),
        noopProvider(ConversationContextService),
        noopProvider(StreamRegistryService),
        noopProvider(CliProcessService),
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SolutionAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionsController>(SessionsController);
    sessionRepository = module.get(getRepositoryToken(Session));
    turnsService = module.get(TurnsService);
  });

  // ===========================================================================
  // GET /api/v1/sessions - List Sessions
  // ===========================================================================

  describe('GET /api/v1/sessions', () => {
    it('should return paginated sessions', async () => {
      const sessions = [
        createMockSession('s1', { title: 'Chat 1' }),
        createMockSession('s2', { title: 'Chat 2' }),
      ];
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(2),
        getMany: jest.fn().mockResolvedValue(sessions),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await controller.listSessions(
        { page: 1, limit: 20 },
        'tenant-a',
      );

      expect(result.conversations).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by solutionId for tenant isolation', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.listSessions(
        { page: 1, limit: 20 },
        'tenant-a',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.solutionId = :solutionId',
        { solutionId: 'tenant-a' },
      );
    });

    it('should filter by isPinned when provided', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.listSessions(
        { page: 1, limit: 20, isPinned: true },
        'tenant-a',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.isPinned = :isPinned',
        { isPinned: true },
      );
    });

    it('should filter by templateName when provided', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.listSessions(
        { page: 1, limit: 20, templateName: 'farmer-advisor' },
        'tenant-a',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.templateName = :templateName',
        { templateName: 'farmer-advisor' },
      );
    });

    it('should indicate hasMore when more results exist', async () => {
      const sessions = Array.from({ length: 20 }, (_, i) =>
        createMockSession(`s${i}`),
      );
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(50),
        getMany: jest.fn().mockResolvedValue(sessions),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await controller.listSessions(
        { page: 1, limit: 20 },
        'tenant-a',
      );

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(50);
    });

    it('should default page to 1 and limit to 20', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.listSessions({}, 'tenant-a');

      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });
  });

  // ===========================================================================
  // GET /api/v1/sessions/search
  // ===========================================================================

  describe('GET /api/v1/sessions/search', () => {
    it('should search sessions by title', async () => {
      const sessions = [
        createMockSession('s1', { title: 'Math Lesson Plan' }),
      ];
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue(sessions),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await controller.searchSessions(
        { q: 'Math' },
        'tenant-a',
      );

      expect(result).toHaveLength(1);
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.title LIKE :query',
        { query: '%Math%' },
      );
    });

    it('should enforce tenant isolation in search', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.searchSessions({ q: 'test' }, 'tenant-b');

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.solutionId = :solutionId',
        { solutionId: 'tenant-b' },
      );
    });

    it('should filter by date range when provided', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.searchSessions(
        { q: 'test', dateFrom: '2026-01-01', dateTo: '2026-12-31' },
        'tenant-a',
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.createdAt >= :dateFrom',
        expect.objectContaining({ dateFrom: expect.any(Date) }),
      );
      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.createdAt <= :dateTo',
        expect.objectContaining({ dateTo: expect.any(Date) }),
      );
    });
  });

  // ===========================================================================
  // PATCH /api/v1/sessions/:sessionId
  // ===========================================================================

  describe('PATCH /api/v1/sessions/:sessionId', () => {
    it('should update session title', async () => {
      const session = createMockSession('s1');
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockResolvedValue({
        ...session,
        title: 'New Title',
      });

      const result = await controller.updateSession(
        's1',
        { title: 'New Title' },
        { solutionId: 'tenant-a' } as any,
      );

      expect(result.title).toBe('New Title');
      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Title' }),
      );
    });

    it('should toggle isPinned', async () => {
      const session = createMockSession('s1', { isPinned: false });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockResolvedValue({
        ...session,
        isPinned: true,
      });

      const result = await controller.updateSession(
        's1',
        { isPinned: true },
        { solutionId: 'tenant-a' } as any,
      );

      expect(result.isPinned).toBe(true);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.updateSession(
          'nonexistent',
          { title: 'New Title' },
          { solutionId: 'tenant-a' } as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation on update', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.updateSession(
          's1',
          { title: 'New Title' },
          { solutionId: 'tenant-a' } as any,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { sessionId: 's1', solutionId: 'tenant-a' },
      });
    });
  });

  // ===========================================================================
  // DELETE /api/v1/sessions/:sessionId
  // ===========================================================================

  describe('DELETE /api/v1/sessions/:sessionId', () => {
    it('should soft delete by setting closedAt', async () => {
      const session = createMockSession('s1', { closedAt: null });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockResolvedValue({
        ...session,
        closedAt: new Date(),
        status: 'closed',
      });

      const result = await controller.deleteSession(
        's1',
        { solutionId: 'tenant-a' } as any,
      );

      expect(result.success).toBe(true);
      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          closedAt: expect.any(Date),
          status: 'closed',
        }),
      );
    });

    it('should throw NotFoundException for non-existent session', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.deleteSession('nonexistent', { solutionId: 'tenant-a' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation on delete', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.deleteSession('s1', { solutionId: 'tenant-a' } as any),
      ).rejects.toThrow(NotFoundException);

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { sessionId: 's1', solutionId: 'tenant-a' },
      });
    });
  });

  // ===========================================================================
  // GET /api/v1/sessions/:sessionId/turns
  // ===========================================================================

  describe('GET /api/v1/sessions/:sessionId/turns', () => {
    it('should return all turns for a session', async () => {
      const session = createMockSession('s1');
      const turns = [
        {
          id: 'turn-1',
          sessionId: 's1',
          turnNumber: 0,
          userMessageId: 'user-msg-1',
          assistantMessageId: 'assistant-msg-1',
          totalTokens: 100,
          durationMs: 5000,
          createdAt: new Date(),
          completedAt: new Date(),
        },
        {
          id: 'turn-2',
          sessionId: 's1',
          turnNumber: 1,
          userMessageId: 'user-msg-2',
          assistantMessageId: 'assistant-msg-2',
          totalTokens: 150,
          durationMs: 7000,
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ];

      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      turnsService.getTurnsBySession = jest.fn().mockResolvedValue(turns);

      const result = await controller.getSessionTurns('s1', 'tenant-a');

      expect(result).toEqual(turns);
      expect(turnsService.getTurnsBySession).toHaveBeenCalledWith('s1');
    });

    it('should throw NotFoundException for non-existent session', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.getSessionTurns('nonexistent', 'tenant-a'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.getSessionTurns('s1', 'tenant-a'),
      ).rejects.toThrow(NotFoundException);

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { sessionId: 's1', solutionId: 'tenant-a' },
      });
    });
  });
});
