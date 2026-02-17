/**
 * Session Manager Service Tests
 *
 * Tests for session management with database-backed pagination,
 * dual-write pattern, and multi-tenancy filtering.
 *
 * TDD: These tests define the contract for PaginatedSessions with
 * page/pageSize semantics and the SessionQueryDto interface.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SessionManagerService, PaginatedSessions } from './session-manager.service';
import { SessionService } from '../../sessions/session.service';
import { AuditService } from './audit.service';
import { Message } from '../../messages/entities/message.entity';
import { ToolEvent } from '../../messages/entities/tool-event.entity';
import { ThinkingBlock } from '../../messages/entities/thinking-block.entity';
import { ProcessLifecycleEvent } from '../../messages/entities/process-lifecycle-event.entity';
import { ApiErrorEvent } from '../../messages/entities/api-error-event.entity';
import { TokenUsageEvent } from '../../messages/entities/token-usage-event.entity';
import { Session } from '../entities/session.entity';
import { SessionQueryDto } from '../dto/admin.dto';
import type { ManagedSession } from '../../common/interfaces';

describe('SessionManagerService', () => {
  let service: SessionManagerService;
  let sessionService: jest.Mocked<SessionService>;
  let auditService: jest.Mocked<AuditService>;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let apiErrorRepository: jest.Mocked<Repository<ApiErrorEvent>>;
  let tokenUsageRepository: jest.Mocked<Repository<TokenUsageEvent>>;
  let sessionRepository: jest.Mocked<Repository<Session>>;

  // Mock query builder factory
  const createMockQueryBuilder = (overrides: Partial<SelectQueryBuilder<any>> = {}) => {
    const mockQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      getCount: jest.fn().mockResolvedValue(0),
      ...overrides,
    };
    return mockQb as unknown as jest.Mocked<SelectQueryBuilder<any>>;
  };

  // Create a mock ManagedSession
  const createMockManagedSession = (
    sessionId: string,
    tenantId: string | undefined,
    status: string = 'idle',
    overrides: Partial<ManagedSession> = {},
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
    ...overrides,
  });

  // Create a mock Session entity (database record)
  const createMockSessionEntity = (
    sessionId: string,
    tenantId: string | null = null,
    status: string = 'idle',
    overrides: Partial<Session> = {},
  ): Session => ({
    id: `uuid-${sessionId}`,
    sessionId,
    tenantId,
    clientId: `client-${sessionId}`,
    status: status as any,
    messageCount: 5,
    totalTokens: 1000,
    estimatedCost: 0.05,
    createdAt: new Date(),
    lastActivity: new Date(),
    closedAt: null,
    workspaceDir: `/tmp/${sessionId}`,
    title: null,
    isPinned: false,
    updatedAt: new Date(),
    ...overrides,
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
        {
          provide: getRepositoryToken(TokenUsageEvent),
          useValue: {
            createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
          },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: {
            createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SessionManagerService>(SessionManagerService);
    sessionService = module.get(SessionService);
    auditService = module.get(AuditService);
    messageRepository = module.get(getRepositoryToken(Message));
    apiErrorRepository = module.get(getRepositoryToken(ApiErrorEvent));
    tokenUsageRepository = module.get(getRepositoryToken(TokenUsageEvent));
    sessionRepository = module.get(getRepositoryToken(Session));
  });

  // ===========================================================================
  // PaginatedSessions Return Shape
  // ===========================================================================

  describe('PaginatedSessions return type', () => {
    it('should return data, total, page, and pageSize fields', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({});

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('pageSize');
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.total).toBe('number');
      expect(typeof result.page).toBe('number');
      expect(typeof result.pageSize).toBe('number');
    });

    it('should default to page 1 and pageSize 50', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });
  });

  // ===========================================================================
  // Database-Backed Pagination (getSessions)
  // ===========================================================================

  describe('getSessions - database pagination', () => {
    it('should query database with correct offset for page 1', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({ page: 1, pageSize: 50 });

      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(mockQb.take).toHaveBeenCalledWith(50);
    });

    it('should query database with correct offset for page 3', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(200),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({ page: 3, pageSize: 25 });

      // page 3, pageSize 25 => offset = (3-1) * 25 = 50
      expect(mockQb.skip).toHaveBeenCalledWith(50);
      expect(mockQb.take).toHaveBeenCalledWith(25);
    });

    it('should cap pageSize at 250', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({ page: 1, pageSize: 500 });

      expect(mockQb.take).toHaveBeenCalledWith(250);
      expect(result.pageSize).toBe(250);
    });

    it('should enforce minimum page of 1', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({ page: 0, pageSize: 50 });

      expect(mockQb.skip).toHaveBeenCalledWith(0);
      expect(result.page).toBe(1);
    });

    it('should enforce minimum pageSize of 1', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({ page: 1, pageSize: 0 });

      expect(mockQb.take).toHaveBeenCalledWith(1);
      expect(result.pageSize).toBe(1);
    });

    it('should return correct total count', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(150),
        getMany: jest.fn().mockResolvedValue([
          createMockSessionEntity('s1', 'tenant-a'),
          createMockSessionEntity('s2', 'tenant-a'),
        ]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);
      sessionService.getAllSessions = jest.fn().mockReturnValue([]);

      const result = await service.getSessions({ page: 1, pageSize: 50 });

      expect(result.total).toBe(150);
    });

    it('should map session entities to SessionListItem format', async () => {
      const sessionEntity = createMockSessionEntity('s1', 'tenant-a', 'processing', {
        messageCount: 10,
        totalTokens: 5000,
        estimatedCost: 0.25,
      });
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([sessionEntity]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);
      sessionService.getAllSessions = jest.fn().mockReturnValue([]);

      const result = await service.getSessions({ page: 1, pageSize: 50 });

      expect(result.data).toHaveLength(1);
      const item = result.data[0];
      expect(item.sessionId).toBe('s1');
      expect(item.tenantId).toBe('tenant-a');
      expect(item.clientId).toBe('client-s1');
      expect(item.status).toBe('processing');
      expect(item.messageCount).toBe(10);
      expect(item.totalTokens).toBe(5000);
      expect(item.estimatedCost).toBe(0.25);
      expect(item.hasActiveProcess).toBe(false);
    });

    it('should enrich with in-memory process status when available', async () => {
      const sessionEntity = createMockSessionEntity('s1', 'tenant-a', 'processing');
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([sessionEntity]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      // Mock in-memory session with active process
      const mockProcess = { killed: false } as any;
      sessionService.getAllSessions = jest.fn().mockReturnValue([
        createMockManagedSession('s1', 'tenant-a', 'processing', {
          cliProcess: mockProcess,
        }),
      ]);

      const result = await service.getSessions({ page: 1, pageSize: 50 });

      expect(result.data[0].hasActiveProcess).toBe(true);
    });

    it('should order by lastActivity descending', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({ page: 1, pageSize: 50 });

      expect(mockQb.orderBy).toHaveBeenCalledWith('session.lastActivity', 'DESC');
    });
  });

  // ===========================================================================
  // Filtering
  // ===========================================================================

  describe('getSessions - filtering', () => {
    it('should filter by tenantId', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({ tenantId: 'tenant-a' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.tenantId = :tenantId',
        { tenantId: 'tenant-a' },
      );
    });

    it('should filter by status', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({ status: 'processing' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.status = :status',
        { status: 'processing' },
      );
    });

    it('should filter by startDate', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({ startDate: '2026-01-01T00:00:00Z' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.createdAt >= :startDate',
        expect.objectContaining({ startDate: expect.any(Date) }),
      );
    });

    it('should filter by endDate', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({ endDate: '2026-12-31T23:59:59Z' });

      expect(mockQb.andWhere).toHaveBeenCalledWith(
        'session.createdAt <= :endDate',
        expect.objectContaining({ endDate: expect.any(Date) }),
      );
    });

    it('should combine tenantId and status filters', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({ tenantId: 'tenant-a', status: 'idle' });

      expect(mockQb.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should not add filters when no filter params provided', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      await service.getSessions({});

      expect(mockQb.andWhere).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Fallback to In-Memory
  // ===========================================================================

  describe('getSessions - in-memory fallback', () => {
    it('should fall back to in-memory sessions when database fails', async () => {
      // Make database query fail
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getCount: jest.fn().mockRejectedValue(new Error('DB connection error')),
        }),
      );

      // Provide in-memory sessions
      const mockSessions = [
        createMockManagedSession('s1', 'tenant-a', 'idle'),
        createMockManagedSession('s2', 'tenant-b', 'processing'),
      ];
      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      // Mock token stats query
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      );

      const result = await service.getSessions({ page: 1, pageSize: 50 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('should apply tenantId filter in memory fallback', async () => {
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getCount: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      );

      const mockSessions = [
        createMockManagedSession('s1', 'tenant-a'),
        createMockManagedSession('s2', 'tenant-b'),
        createMockManagedSession('s3', 'tenant-a'),
      ];
      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }),
      );

      const result = await service.getSessions({ tenantId: 'tenant-a' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(s => s.tenantId === 'tenant-a')).toBe(true);
      expect(result.total).toBe(2);
    });

    it('should apply status filter in memory fallback', async () => {
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getCount: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      );

      const mockSessions = [
        createMockManagedSession('s1', 'tenant-a', 'idle'),
        createMockManagedSession('s2', 'tenant-a', 'processing'),
        createMockManagedSession('s3', 'tenant-a', 'idle'),
      ];
      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }),
      );

      const result = await service.getSessions({ status: 'idle' });

      expect(result.data).toHaveLength(2);
      expect(result.data.every(s => s.status === 'idle')).toBe(true);
    });

    it('should apply pagination in memory fallback', async () => {
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getCount: jest.fn().mockRejectedValue(new Error('DB error')),
        }),
      );

      const mockSessions = Array.from({ length: 100 }, (_, i) =>
        createMockManagedSession(`s${i}`, 'tenant-a'),
      );
      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);
      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({ getRawMany: jest.fn().mockResolvedValue([]) }),
      );

      const result = await service.getSessions({ page: 2, pageSize: 25 });

      expect(result.data).toHaveLength(25);
      expect(result.total).toBe(100);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(25);
    });
  });

  // ===========================================================================
  // Backward Compatibility (offset/limit)
  // ===========================================================================

  describe('getSessions - backward compatibility with offset/limit', () => {
    it('should support legacy offset/limit parameters', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(100),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({ offset: 20, limit: 10 });

      // offset=20, limit=10 => page=3, pageSize=10
      expect(mockQb.skip).toHaveBeenCalledWith(20);
      expect(mockQb.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it('should prefer page/pageSize over offset/limit when both provided', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(100),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({
        page: 2,
        pageSize: 50,
        offset: 0,
        limit: 20,
      });

      // page/pageSize should take precedence
      expect(mockQb.skip).toHaveBeenCalledWith(50);
      expect(mockQb.take).toHaveBeenCalledWith(50);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);
    });
  });

  // ===========================================================================
  // Dual-Write (Session Sync)
  // ===========================================================================

  describe('syncSessionToDatabase', () => {
    it('should save session entity to database', async () => {
      const managedSession = createMockManagedSession('s1', 'tenant-a', 'idle');

      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([
            { sessionId: 's1', totalTokens: 5000, estimatedCost: 0.25 },
          ]),
        }),
      );
      sessionRepository.save = jest.fn().mockResolvedValue({});

      await service.syncSessionToDatabase(managedSession);

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 's1',
          tenantId: 'tenant-a',
          clientId: 'client-s1',
          status: 'idle',
          messageCount: 5,
          totalTokens: 5000,
          estimatedCost: 0.25,
          closedAt: null,
        }),
      );
    });

    it('should set closedAt when session status is closed', async () => {
      const managedSession = createMockManagedSession('s1', 'tenant-a', 'closed');

      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      );
      sessionRepository.save = jest.fn().mockResolvedValue({});

      await service.syncSessionToDatabase(managedSession);

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          closedAt: managedSession.lastActivity,
        }),
      );
    });

    it('should not throw when save fails', async () => {
      const managedSession = createMockManagedSession('s1', 'tenant-a');

      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      );
      sessionRepository.save = jest.fn().mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(service.syncSessionToDatabase(managedSession)).resolves.not.toThrow();
    });
  });

  describe('syncAllSessionsToDatabase', () => {
    it('should sync all in-memory sessions to database', async () => {
      const mockSessions = [
        createMockManagedSession('s1', 'tenant-a'),
        createMockManagedSession('s2', 'tenant-b'),
        createMockManagedSession('s3', undefined),
      ];
      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      );
      sessionRepository.save = jest.fn().mockResolvedValue({});

      const count = await service.syncAllSessionsToDatabase();

      expect(count).toBe(3);
      expect(sessionRepository.save).toHaveBeenCalledTimes(3);
    });
  });

  // ===========================================================================
  // Recent Sessions
  // ===========================================================================

  describe('getRecentSessions', () => {
    it('should return all sessions when tenantId is not provided', async () => {
      const mockSessions = [
        createMockManagedSession('session-1', 'tenant-a'),
        createMockManagedSession('session-2', 'tenant-b'),
        createMockManagedSession('session-3', undefined),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(10);

      expect(result).toHaveLength(3);
      expect(result.map(s => s.sessionId)).toEqual(['session-1', 'session-2', 'session-3']);
    });

    it('should filter sessions by tenantId when provided', async () => {
      const mockSessions = [
        createMockManagedSession('session-1', 'tenant-a'),
        createMockManagedSession('session-2', 'tenant-b'),
        createMockManagedSession('session-3', 'tenant-a'),
        createMockManagedSession('session-4', undefined),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(10, 'tenant-a');

      expect(result).toHaveLength(2);
      expect(result.every(s => s.tenantId === 'tenant-a')).toBe(true);
      expect(result.map(s => s.sessionId)).toEqual(['session-1', 'session-3']);
    });

    it('should respect the limit parameter', async () => {
      const mockSessions = [
        createMockManagedSession('session-1', 'tenant-a'),
        createMockManagedSession('session-2', 'tenant-a'),
        createMockManagedSession('session-3', 'tenant-a'),
        createMockManagedSession('session-4', 'tenant-a'),
        createMockManagedSession('session-5', 'tenant-a'),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(3, 'tenant-a');

      expect(result).toHaveLength(3);
    });

    it('should sort sessions by lastActivity descending', async () => {
      const now = Date.now();
      const mockSessions = [
        { ...createMockManagedSession('session-1', 'tenant-a'), lastActivity: new Date(now - 3000) },
        { ...createMockManagedSession('session-2', 'tenant-a'), lastActivity: new Date(now - 1000) },
        { ...createMockManagedSession('session-3', 'tenant-a'), lastActivity: new Date(now - 2000) },
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(10, 'tenant-a');

      expect(result[0].sessionId).toBe('session-2');
      expect(result[1].sessionId).toBe('session-3');
      expect(result[2].sessionId).toBe('session-1');
    });

    it('should return empty array when no sessions match tenantId', async () => {
      const mockSessions = [
        createMockManagedSession('session-1', 'tenant-a'),
        createMockManagedSession('session-2', 'tenant-b'),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      const result = await service.getRecentSessions(10, 'tenant-nonexistent');

      expect(result).toHaveLength(0);
    });

    it('should return sessions without tenantId when filtering for undefined', async () => {
      const mockSessions = [
        createMockManagedSession('session-1', 'tenant-a'),
        createMockManagedSession('session-2', undefined),
        createMockManagedSession('session-3', undefined),
      ];

      sessionService.getAllSessions = jest.fn().mockReturnValue(mockSessions);

      // When no tenantId filter, should return all
      const result = await service.getRecentSessions(10);

      expect(result).toHaveLength(3);
    });
  });

  // ===========================================================================
  // Error Rate
  // ===========================================================================

  describe('getErrorRate24h', () => {
    it('should not filter by tenantId when not provided', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount = jest.fn().mockResolvedValue(5);
      mockMessageQb.getCount = jest.fn().mockResolvedValue(100);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      await service.getErrorRate24h();

      expect(mockErrorQb.andWhere).not.toHaveBeenCalled();
      expect(mockMessageQb.andWhere).not.toHaveBeenCalled();
    });

    it('should filter by tenantId when provided', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount = jest.fn().mockResolvedValue(5);
      mockMessageQb.getCount = jest.fn().mockResolvedValue(100);

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

      mockErrorQb.getCount = jest.fn().mockResolvedValue(10);
      mockMessageQb.getCount = jest.fn().mockResolvedValue(200);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const result = await service.getErrorRate24h();

      expect(result).toBe(0.05); // (10 / 200) = 0.05 (5% as decimal)
    });

    it('should return 0 when no messages', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount = jest.fn().mockResolvedValue(0);
      mockMessageQb.getCount = jest.fn().mockResolvedValue(0);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const result = await service.getErrorRate24h();

      expect(result).toBe(0);
    });

    it('should return 0 when no errors', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount = jest.fn().mockResolvedValue(0);
      mockMessageQb.getCount = jest.fn().mockResolvedValue(100);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const result = await service.getErrorRate24h();

      expect(result).toBe(0);
    });

    it('should round error rate to 4 decimal places', async () => {
      const mockErrorQb = createMockQueryBuilder();
      const mockMessageQb = createMockQueryBuilder();

      mockErrorQb.getCount = jest.fn().mockResolvedValue(1);
      mockMessageQb.getCount = jest.fn().mockResolvedValue(3);

      apiErrorRepository.createQueryBuilder = jest.fn().mockReturnValue(mockErrorQb);
      messageRepository.createQueryBuilder = jest.fn().mockReturnValue(mockMessageQb);

      const result = await service.getErrorRate24h();

      // (1/3) = 0.333... should round to 0.3333 (33.33% as decimal)
      expect(result).toBe(0.3333);
    });
  });

  // ===========================================================================
  // Session Kill
  // ===========================================================================

  describe('killSession', () => {
    it('should throw NotFoundException for non-existent session', async () => {
      sessionService.getSession = jest.fn().mockReturnValue(null);

      await expect(service.killSession('nonexistent', 'admin-1', 'tenant-a')).rejects.toThrow();
    });

    it('should throw ForbiddenException for cross-tenant access', async () => {
      const mockSession = createMockManagedSession('s1', 'tenant-a', 'processing');
      sessionService.getSession = jest.fn().mockReturnValue(mockSession);

      await expect(service.killSession('s1', 'admin-1', 'tenant-b')).rejects.toThrow(
        'Cannot access sessions belonging to another tenant',
      );
    });

    it('should call cancelSession and log audit on success', async () => {
      const mockSession = createMockManagedSession('s1', 'tenant-a', 'processing');
      sessionService.getSession = jest.fn().mockReturnValue(mockSession);
      sessionService.cancelSession = jest.fn().mockReturnValue(true);

      const result = await service.killSession('s1', 'admin-1', 'tenant-a');

      expect(result).toBe(true);
      expect(auditService.logSuccess).toHaveBeenCalledWith(
        'admin-1',
        'session.kill',
        'session',
        's1',
        expect.any(Object),
        'tenant-a',
      );
    });

    it('should log audit failure when cancel fails', async () => {
      const mockSession = createMockManagedSession('s1', 'tenant-a', 'idle');
      sessionService.getSession = jest.fn().mockReturnValue(mockSession);
      sessionService.cancelSession = jest.fn().mockReturnValue(false);

      const result = await service.killSession('s1', 'admin-1', 'tenant-a');

      expect(result).toBe(false);
      expect(auditService.logFailure).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Conversation Metadata (title, isPinned)
  // ===========================================================================

  describe('conversation metadata fields', () => {
    it('should include title and isPinned in session list items from database', async () => {
      const sessionEntity = createMockSessionEntity('s1', 'tenant-a', 'idle', {
        title: 'My Conversation',
        isPinned: true,
      });
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([sessionEntity]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);
      sessionService.getAllSessions = jest.fn().mockReturnValue([]);

      const result = await service.getSessions({ page: 1, pageSize: 50 });

      expect(result.data).toHaveLength(1);
      const item = result.data[0];
      expect(item.title).toBe('My Conversation');
      expect(item.isPinned).toBe(true);
    });

    it('should default title to null and isPinned to false', async () => {
      const sessionEntity = createMockSessionEntity('s1', 'tenant-a');
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([sessionEntity]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);
      sessionService.getAllSessions = jest.fn().mockReturnValue([]);

      const result = await service.getSessions({ page: 1, pageSize: 50 });

      expect(result.data[0].title).toBeNull();
      expect(result.data[0].isPinned).toBe(false);
    });

    it('should not overwrite title and isPinned when syncing in-memory session to database', async () => {
      const managedSession = createMockManagedSession('s1', 'tenant-a', 'idle');

      tokenUsageRepository.createQueryBuilder = jest.fn().mockReturnValue(
        createMockQueryBuilder({
          getRawMany: jest.fn().mockResolvedValue([]),
        }),
      );
      sessionRepository.save = jest.fn().mockResolvedValue({});

      await service.syncSessionToDatabase(managedSession);

      // title and isPinned should NOT be included in sync
      // because they are user-managed metadata, not in-memory state
      const saveArg = sessionRepository.save.mock.calls[0][0];
      expect(saveArg).not.toHaveProperty('title');
      expect(saveArg).not.toHaveProperty('isPinned');
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle empty query parameters gracefully', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({});

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('should handle negative page values', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({ page: -5, pageSize: 50 });

      expect(result.page).toBe(1);
      expect(mockQb.skip).toHaveBeenCalledWith(0);
    });

    it('should handle negative pageSize values', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const result = await service.getSessions({ page: 1, pageSize: -10 });

      expect(result.pageSize).toBe(1);
      expect(mockQb.take).toHaveBeenCalledWith(1);
    });

    it('should handle undefined page and pageSize as defaults', async () => {
      const mockQb = createMockQueryBuilder({
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      });
      sessionRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQb);

      const query = new SessionQueryDto();
      const result = await service.getSessions(query);

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });
  });
});
