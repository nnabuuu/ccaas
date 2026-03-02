/**
 * Conversations Controller Tests
 *
 * Tests for the conversation management REST API endpoints.
 * ConversationsController handles metadata management (list, search, update title, pin, delete).
 * Distinct from SessionsController (runtime operations) and MessagesController (message queries).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ConversationsController } from './conversations.controller';
import { Session } from '../admin/entities/session.entity';
import { Turn } from '../admin/entities/turn.entity';
import { ApiKeyService } from '../auth/api-key.service';
import { TurnsService } from '../admin/services/turns.service';

describe('ConversationsController', () => {
  let controller: ConversationsController;
  let sessionRepository: jest.Mocked<Repository<Session>>;
  let turnRepository: jest.Mocked<Repository<Turn>>;
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
    tenantId: 'tenant-a',
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConversationsController],
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
          provide: getRepositoryToken(Turn),
          useValue: {
            createQueryBuilder: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: ApiKeyService,
          useValue: {
            validateApiKey: jest.fn(),
          },
        },
        {
          provide: TurnsService,
          useValue: {
            getTurnsBySession: jest.fn(),
            createTurn: jest.fn(),
            completeTurn: jest.fn(),
            getNextTurnNumber: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ConversationsController>(ConversationsController);
    sessionRepository = module.get(getRepositoryToken(Session));
    turnRepository = module.get(getRepositoryToken(Turn));
    turnsService = module.get(TurnsService);
  });

  // ===========================================================================
  // GET /api/v1/conversations - List Conversations
  // ===========================================================================

  describe('GET /api/v1/conversations', () => {
    it('should return paginated conversations', async () => {
      const sessions = [
        createMockSession('s1', { title: 'Chat 1' }),
        createMockSession('s2', { title: 'Chat 2' }),
      ];
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(2),
        getMany: jest.fn().mockResolvedValue(sessions),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await controller.listConversations(
        { page: 1, limit: 20 },
        { tenantId: 'tenant-a' } as any,
      );

      expect(result.conversations).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by tenantId for tenant isolation', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.listConversations(
        { page: 1, limit: 20 },
        { tenantId: 'tenant-a' } as any,
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.tenantId = :tenantId',
        { tenantId: 'tenant-a' },
      );
    });

    it('should filter by isPinned when provided', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.listConversations(
        { page: 1, limit: 20, isPinned: true },
        { tenantId: 'tenant-a' } as any,
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

      await controller.listConversations(
        { page: 1, limit: 20, templateName: 'farmer-advisor' },
        { tenantId: 'tenant-a' } as any,
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

      const result = await controller.listConversations(
        { page: 1, limit: 20 },
        { tenantId: 'tenant-a' } as any,
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

      await controller.listConversations(
        {},
        { tenantId: 'tenant-a' } as any,
      );

      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(20);
    });
  });

  // ===========================================================================
  // GET /api/v1/conversations/search - Search Conversations
  // ===========================================================================

  describe('GET /api/v1/conversations/search', () => {
    it('should search conversations by title', async () => {
      const sessions = [
        createMockSession('s1', { title: 'Math Lesson Plan' }),
      ];
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue(sessions),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await controller.searchConversations(
        { q: 'Math' },
        { tenantId: 'tenant-a' } as any,
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

      await controller.searchConversations(
        { q: 'test' },
        { tenantId: 'tenant-b' } as any,
      );

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.tenantId = :tenantId',
        { tenantId: 'tenant-b' },
      );
    });

    it('should filter by date range when provided', async () => {
      const mockQb = createMockQueryBuilder({
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await controller.searchConversations(
        { q: 'test', dateFrom: '2026-01-01', dateTo: '2026-12-31' },
        { tenantId: 'tenant-a' } as any,
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
  // PATCH /api/v1/conversations/:id - Update Metadata
  // ===========================================================================

  describe('PATCH /api/v1/conversations/:id', () => {
    it('should update conversation title', async () => {
      const session = createMockSession('s1');
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockResolvedValue({
        ...session,
        title: 'New Title',
      });

      const result = await controller.updateConversation(
        's1',
        { title: 'New Title' },
        { tenantId: 'tenant-a' } as any,
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

      const result = await controller.updateConversation(
        's1',
        { isPinned: true },
        { tenantId: 'tenant-a' } as any,
      );

      expect(result.isPinned).toBe(true);
    });

    it('should throw NotFoundException for non-existent conversation', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.updateConversation(
          'nonexistent',
          { title: 'New Title' },
          { tenantId: 'tenant-a' } as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation on update', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.updateConversation(
          's1',
          { title: 'New Title' },
          { tenantId: 'tenant-a' } as any,
        ),
      ).rejects.toThrow(NotFoundException);

      // findOne should be called with both sessionId AND tenantId
      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { sessionId: 's1', tenantId: 'tenant-a' },
      });
    });
  });

  // ===========================================================================
  // DELETE /api/v1/conversations/:id - Soft Delete
  // ===========================================================================

  describe('DELETE /api/v1/conversations/:id', () => {
    it('should soft delete by setting closedAt', async () => {
      const session = createMockSession('s1', { closedAt: null });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockResolvedValue({
        ...session,
        closedAt: new Date(),
        status: 'closed',
      });

      const result = await controller.deleteConversation(
        's1',
        { tenantId: 'tenant-a' } as any,
      );

      expect(result.success).toBe(true);
      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          closedAt: expect.any(Date),
          status: 'closed',
        }),
      );
    });

    it('should throw NotFoundException for non-existent conversation', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.deleteConversation('nonexistent', { tenantId: 'tenant-a' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation on delete', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.deleteConversation('s1', { tenantId: 'tenant-a' } as any),
      ).rejects.toThrow(NotFoundException);

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { sessionId: 's1', tenantId: 'tenant-a' },
      });
    });
  });

  // ===========================================================================
  // GET /api/v1/conversations/:id/turns - Get Conversation Turns
  // ===========================================================================

  describe('GET /api/v1/conversations/:id/turns', () => {
    it('should return all turns for a conversation', async () => {
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

      const result = await controller.getConversationTurns(
        's1',
        { tenantId: 'tenant-a' } as any,
      );

      expect(result).toEqual(turns);
      expect(turnsService.getTurnsBySession).toHaveBeenCalledWith('s1');
    });

    it('should throw NotFoundException for non-existent conversation', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.getConversationTurns('nonexistent', { tenantId: 'tenant-a' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce tenant isolation', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      await expect(
        controller.getConversationTurns('s1', { tenantId: 'tenant-a' } as any),
      ).rejects.toThrow(NotFoundException);

      expect(sessionRepository.findOne).toHaveBeenCalledWith({
        where: { sessionId: 's1', tenantId: 'tenant-a' },
      });
    });
  });
});
