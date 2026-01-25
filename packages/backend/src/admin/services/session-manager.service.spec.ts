/**
 * Session Manager Service Tests
 *
 * Tests for multi-tenancy filtering in session management.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SessionManagerService } from './session-manager.service';
import { SessionService } from '../../chat/session.service';
import { AuditService } from './audit.service';
import { Message } from '../../messages/entities/message.entity';
import { ToolEvent } from '../../messages/entities/tool-event.entity';
import { ThinkingBlock } from '../../messages/entities/thinking-block.entity';
import { ProcessLifecycleEvent } from '../../messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from '../../messages/entities/api-error-event.entity';
import type { ManagedSession } from '../../common/interfaces';

describe('SessionManagerService', () => {
  let service: SessionManagerService;
  let sessionService: jest.Mocked<SessionService>;
  let auditService: jest.Mocked<AuditService>;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let apiErrorRepository: jest.Mocked<Repository<ApiErrorEvent>>;

  // Mock query builder
  const createMockQueryBuilder = () => {
    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      getCount: jest.fn().mockResolvedValue(0),
    };
    return mockQb as unknown as jest.Mocked<SelectQueryBuilder<any>>;
  };

  // Create mock sessions with tenantId
  const createMockSession = (
    sessionId: string,
    tenantId: string | undefined,
    status: string = 'idle',
  ): ManagedSession => ({
    sessionId,
    clientId: `client-${sessionId}`,
    cliProcess: null,
    stdin: null,
    socket: null,
    lastActivity: new Date(),
    status: status as any,
    createdAt: new Date(),
    messageCount: 5,
    buffer: '',
    workspaceDir: `/tmp/${sessionId}`,
    tenantId,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagerService,
        {
          provide: SessionService,
          useValue: {
            getStats: jest.fn().mockReturnValue({
              totalSessions: 10,
              activeSessions: 5,
            }),
            getAllSessions: jest.fn().mockReturnValue([]),
            getSession: jest.fn(),
            cancelSession: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logSuccess: jest.fn(),
            logFailure: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            createQueryBuilder: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(ToolEvent),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(ThinkingBlock),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(ProcessLifecycleEvent),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(ApiErrorEvent),
          useValue: {
            createQueryBuilder: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<SessionManagerService>(SessionManagerService);
    sessionService = module.get(SessionService);
    auditService = module.get(AuditService);
    messageRepository = module.get(getRepositoryToken(Message));
    apiErrorRepository = module.get(getRepositoryToken(ApiErrorEvent));
  });

  describe('getRecentSessions', () => {
    it('should return all sessions when tenantId is not provided', async () => {
      const mockSessions = [
        createMockSession('session-1', 'tenant-a'),
        createMockSession('session-2', 'tenant-b'),
        createMockSession('session-3', undefined),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(10);

      expect(result).toHaveLength(3);
      expect(result.map(s => s.sessionId)).toEqual(['session-1', 'session-2', 'session-3']);
    });

    it('should filter sessions by tenantId when provided', async () => {
      const mockSessions = [
        createMockSession('session-1', 'tenant-a'),
        createMockSession('session-2', 'tenant-b'),
        createMockSession('session-3', 'tenant-a'),
        createMockSession('session-4', undefined),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(10, 'tenant-a');

      expect(result).toHaveLength(2);
      expect(result.every(s => s.tenantId === 'tenant-a')).toBe(true);
      expect(result.map(s => s.sessionId)).toEqual(['session-1', 'session-3']);
    });

    it('should respect the limit parameter', async () => {
      const mockSessions = [
        createMockSession('session-1', 'tenant-a'),
        createMockSession('session-2', 'tenant-a'),
        createMockSession('session-3', 'tenant-a'),
        createMockSession('session-4', 'tenant-a'),
        createMockSession('session-5', 'tenant-a'),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(3, 'tenant-a');

      expect(result).toHaveLength(3);
    });

    it('should sort sessions by lastActivity descending', async () => {
      const now = Date.now();
      const mockSessions = [
        { ...createMockSession('session-1', 'tenant-a'), lastActivity: new Date(now - 3000) },
        { ...createMockSession('session-2', 'tenant-a'), lastActivity: new Date(now - 1000) },
        { ...createMockSession('session-3', 'tenant-a'), lastActivity: new Date(now - 2000) },
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(10, 'tenant-a');

      expect(result[0].sessionId).toBe('session-2');
      expect(result[1].sessionId).toBe('session-3');
      expect(result[2].sessionId).toBe('session-1');
    });

    it('should return empty array when no sessions match tenantId', async () => {
      const mockSessions = [
        createMockSession('session-1', 'tenant-a'),
        createMockSession('session-2', 'tenant-b'),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(10, 'tenant-nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should return sessions without tenantId when filtering for undefined', async () => {
      const mockSessions = [
        createMockSession('session-1', 'tenant-a'),
        createMockSession('session-2', undefined),
        createMockSession('session-3', undefined),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      // When no tenantId filter, should return all
      const result = await service.getRecentSessions(10);

      expect(result).toHaveLength(3);
    });
  });

  describe('getErrorRate24h', () => {
    it('should not filter by tenantId when not provided', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount.mockResolvedValue(5);
      mockMessageQb.getCount.mockResolvedValue(100);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      await service.getErrorRate24h();

      expect(mockErrorQb.andWhere).not.toHaveBeenCalled();
      expect(mockMessageQb.andWhere).not.toHaveBeenCalled();
    });

    it('should filter by tenantId when provided', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount.mockResolvedValue(5);
      mockMessageQb.getCount.mockResolvedValue(100);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const tenantId = 'tenant-123';
      await service.getErrorRate24h(tenantId);

      expect(mockErrorQb.andWhere).toHaveBeenCalledWith(
        'error.tenantId = :tenantId',
        { tenantId },
      );
      expect(mockMessageQb.andWhere).toHaveBeenCalledWith(
        'message.tenantId = :tenantId',
        { tenantId },
      );
    });

    it('should calculate error rate correctly', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount.mockResolvedValue(10);
      mockMessageQb.getCount.mockResolvedValue(200);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const result = await service.getErrorRate24h();

      expect(result).toBe(5); // (10 / 200) * 100 = 5%
    });

    it('should return 0 when no messages', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount.mockResolvedValue(0);
      mockMessageQb.getCount.mockResolvedValue(0);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const result = await service.getErrorRate24h();

      expect(result).toBe(0);
    });

    it('should return 0 when no errors', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount.mockResolvedValue(0);
      mockMessageQb.getCount.mockResolvedValue(100);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const result = await service.getErrorRate24h();

      expect(result).toBe(0);
    });

    it('should round error rate to 2 decimal places', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount.mockResolvedValue(1);
      mockMessageQb.getCount.mockResolvedValue(3);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const result = await service.getErrorRate24h();

      // (1/3) * 100 = 33.333... should round to 33.33
      expect(result).toBe(33.33);
    });
  });

  describe('getSessions', () => {
    it('should filter sessions by tenantId in query', async () => {
      const mockSessions = [
        createMockSession('session-1', 'tenant-a'),
        createMockSession('session-2', 'tenant-b'),
        createMockSession('session-3', 'tenant-a'),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getSessions({ tenantId: 'tenant-a' });

      expect(result.items).toHaveLength(2);
      expect(result.items.every(s => s.tenantId === 'tenant-a')).toBe(true);
      expect(result.total).toBe(2);
    });

    it('should filter sessions by status', async () => {
      const mockSessions = [
        createMockSession('session-1', 'tenant-a', 'idle'),
        createMockSession('session-2', 'tenant-a', 'processing'),
        createMockSession('session-3', 'tenant-a', 'idle'),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getSessions({ status: 'idle' });

      expect(result.items).toHaveLength(2);
      expect(result.items.every(s => s.status === 'idle')).toBe(true);
    });

    it('should combine tenantId and status filters', async () => {
      const mockSessions = [
        createMockSession('session-1', 'tenant-a', 'idle'),
        createMockSession('session-2', 'tenant-a', 'processing'),
        createMockSession('session-3', 'tenant-b', 'idle'),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getSessions({ tenantId: 'tenant-a', status: 'idle' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sessionId).toBe('session-1');
    });

    it('should apply pagination correctly', async () => {
      const mockSessions = Array.from({ length: 25 }, (_, i) =>
        createMockSession(`session-${i}`, 'tenant-a'),
      );

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getSessions({ limit: 10, offset: 5 });

      expect(result.items).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(5);
    });
  });
});
