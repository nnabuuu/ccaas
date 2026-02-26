import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageQueueService } from './message-queue.service';
import { MessageQueue, MessageQueuePayload } from '../entities/message-queue.entity';

describe('MessageQueueService', () => {
  let service: MessageQueueService;
  let repository: jest.Mocked<Repository<MessageQueue>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageQueueService,
        {
          provide: getRepositoryToken(MessageQueue),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
            find: jest.fn(),
            findOneBy: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessageQueueService>(MessageQueueService);
    repository = module.get(getRepositoryToken(MessageQueue));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueue', () => {
    it('should create and save a queue item with correct fields', async () => {
      const sessionId = 'session-1';
      const clientId = 'client-1';
      const tenantId = 'tenant-1';
      const payload: MessageQueuePayload = {
        message: 'Test message',
        context: { userId: 'user-1' },
      };

      const mockQueueItem = {
        id: 'queue-1',
        sessionId,
        clientId,
        tenantId,
        payload,
        status: 'pending',
        priority: 0,
        retryCount: 0,
        maxRetries: 2,
      } as MessageQueue;

      repository.create.mockReturnValue(mockQueueItem);
      repository.save.mockResolvedValue(mockQueueItem);

      const result = await service.enqueue(sessionId, clientId, tenantId, payload);

      expect(repository.create).toHaveBeenCalledWith({
        sessionId,
        clientId,
        tenantId,
        payload,
        status: 'pending',
        priority: 0,
        retryCount: 0,
        maxRetries: 2,
      });
      expect(repository.save).toHaveBeenCalledWith(mockQueueItem);
      expect(result).toEqual(mockQueueItem);
    });

    it('should support custom priority', async () => {
      const mockQueueItem = { id: 'queue-1', priority: 10 } as MessageQueue;
      repository.create.mockReturnValue(mockQueueItem);
      repository.save.mockResolvedValue(mockQueueItem);

      await service.enqueue('session-1', 'client-1', 'tenant-1', { message: 'Test' }, 10);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 10 }),
      );
    });
  });

  describe('dequeueForSession', () => {
    it('should return null if session has processing message', async () => {
      repository.count.mockResolvedValue(1); // 1 processing message

      const result = await service.dequeueForSession('session-1');

      expect(result).toBeNull();
      expect(repository.count).toHaveBeenCalledWith({
        where: { sessionId: 'session-1', status: 'processing' },
      });
    });

    it('should return null if no pending messages', async () => {
      repository.count.mockResolvedValue(0); // No processing messages

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.dequeueForSession('session-1');

      expect(result).toBeNull();
      // Note: pessimistic_write lock removed — SQLite uses file-level locking
    });

    it('should dequeue oldest pending message (FIFO)', async () => {
      repository.count.mockResolvedValue(0); // No processing messages

      const mockQueueItem = {
        id: 'queue-1',
        sessionId: 'session-1',
        status: 'pending',
        createdAt: new Date('2025-01-01T10:00:00Z'),
      } as MessageQueue;

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockQueueItem),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      repository.save.mockResolvedValue({ ...mockQueueItem, status: 'processing' } as MessageQueue);

      const result = await service.dequeueForSession('session-1');

      expect(result).toBeDefined();
      expect(result?.status).toBe('processing');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('queue.priority', 'DESC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('queue.createdAt', 'ASC'); // FIFO
      expect(repository.save).toHaveBeenCalled();
    });

    it('should query without pessimistic lock (SQLite file-level locking)', async () => {
      repository.count.mockResolvedValue(0);

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.dequeueForSession('session-1');

      expect(mockQueryBuilder.getOne).toHaveBeenCalled();
    });
  });

  describe('markCompleted', () => {
    it('should update queue item with completed status', async () => {
      const queueItem = {
        id: 'queue-1',
        status: 'processing',
        startedAt: new Date(Date.now() - 5000), // Started 5 seconds ago
      } as MessageQueue;

      repository.findOneBy.mockResolvedValue(queueItem);
      repository.save.mockResolvedValue({ ...queueItem, status: 'completed' } as MessageQueue);

      await service.markCompleted('queue-1', 'user-msg-1', 'assistant-msg-1');

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          userMessageId: 'user-msg-1',
          assistantMessageId: 'assistant-msg-1',
          durationMs: expect.any(Number),
        }),
      );
    });

    it('should calculate duration correctly', async () => {
      const startTime = Date.now() - 3000; // 3 seconds ago
      const queueItem = {
        id: 'queue-1',
        startedAt: new Date(startTime),
      } as MessageQueue;

      repository.findOneBy.mockResolvedValue(queueItem);
      repository.save.mockImplementation(async (item) => item as MessageQueue);

      await service.markCompleted('queue-1', 'user-msg-1', 'assistant-msg-1');

      const savedItem = (repository.save as jest.Mock).mock.calls[0][0];
      expect(savedItem.durationMs).toBeGreaterThanOrEqual(2900);
      expect(savedItem.durationMs).toBeLessThanOrEqual(3100);
    });
  });

  describe('markFailed', () => {
    it('should schedule retry with exponential backoff', async () => {
      const queueItem = {
        id: 'queue-1',
        retryCount: 0,
        maxRetries: 2,
      } as MessageQueue;

      repository.findOneBy.mockResolvedValue(queueItem);
      repository.save.mockImplementation(async (item) => item as MessageQueue);

      await service.markFailed('queue-1', 'Test error');

      const savedItem = (repository.save as jest.Mock).mock.calls[0][0];
      expect(savedItem.retryCount).toBe(1);
      expect(savedItem.status).toBe('pending');
      expect(savedItem.error).toBe('Test error');
      expect(savedItem.nextRetryAt).toBeInstanceOf(Date);

      // First retry should be ~1 second delay
      const delay = savedItem.nextRetryAt.getTime() - Date.now();
      expect(delay).toBeGreaterThanOrEqual(900);
      expect(delay).toBeLessThanOrEqual(1100);
    });

    it('should use exponential backoff (1s, 2s, 4s)', async () => {
      const testCases = [
        { retryCount: 0, expectedDelayMs: 1000 },
        { retryCount: 1, expectedDelayMs: 2000 },
        { retryCount: 2, expectedDelayMs: 4000 },
      ];

      for (const { retryCount, expectedDelayMs } of testCases) {
        const queueItem = {
          id: 'queue-1',
          retryCount,
          maxRetries: 3,
        } as MessageQueue;

        repository.findOneBy.mockResolvedValue(queueItem);
        repository.save.mockImplementation(async (item) => item as MessageQueue);

        await service.markFailed('queue-1', 'Test error');

        const savedItem = (repository.save as jest.Mock).mock.calls[0][0];
        const delay = savedItem.nextRetryAt.getTime() - Date.now();

        expect(delay).toBeGreaterThanOrEqual(expectedDelayMs - 100);
        expect(delay).toBeLessThanOrEqual(expectedDelayMs + 100);

        jest.clearAllMocks();
      }
    });

    it('should mark as permanently failed after maxRetries', async () => {
      const queueItem = {
        id: 'queue-1',
        retryCount: 2,
        maxRetries: 2,
      } as MessageQueue;

      repository.findOneBy.mockResolvedValue(queueItem);
      repository.save.mockImplementation(async (item) => item as MessageQueue);

      await service.markFailed('queue-1', 'Test error');

      const savedItem = (repository.save as jest.Mock).mock.calls[0][0];
      expect(savedItem.retryCount).toBe(3);
      expect(savedItem.status).toBe('failed');
      expect(savedItem.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('cancelSessionMessages', () => {
    it('should cancel all pending messages for session', async () => {
      const mockResult = { affected: 3 };
      repository.update.mockResolvedValue(mockResult as any);

      const cancelledCount = await service.cancelSessionMessages('session-1');

      expect(cancelledCount).toBe(3);
      expect(repository.update).toHaveBeenCalledWith(
        { sessionId: 'session-1', status: 'pending' },
        expect.objectContaining({
          status: 'cancelled',
          error: 'Cancelled by user',
        }),
      );
    });

    it('should return 0 if no pending messages', async () => {
      repository.update.mockResolvedValue({ affected: 0 } as any);

      const cancelledCount = await service.cancelSessionMessages('session-1');

      expect(cancelledCount).toBe(0);
    });
  });

  describe('resetStaleProcessingMessages', () => {
    it('should return 0 when no stale processing messages exist', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.resetStaleProcessingMessages();

      expect(result).toBe(0);
      expect(repository.find).toHaveBeenCalledWith({
        where: {
          status: 'processing',
          startedAt: expect.anything(),
        },
      });
    });

    it('should call markFailed for each stale message', async () => {
      const staleMessages = [
        { id: 'queue-1', status: 'processing', startedAt: new Date(Date.now() - 120_000), retryCount: 0, maxRetries: 2 },
        { id: 'queue-2', status: 'processing', startedAt: new Date(Date.now() - 300_000), retryCount: 1, maxRetries: 2 },
      ] as MessageQueue[];

      repository.find.mockResolvedValue(staleMessages);
      repository.findOneBy.mockImplementation(async ({ id }: any) =>
        staleMessages.find((m) => m.id === id) || null,
      );
      repository.save.mockImplementation(async (item) => item as MessageQueue);

      const result = await service.resetStaleProcessingMessages();

      expect(result).toBe(2);
      // markFailed should have been called for each stale message
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'queue-1' });
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'queue-2' });
      expect(repository.save).toHaveBeenCalledTimes(2);
    });

    it('should retry messages that have not exceeded maxRetries', async () => {
      const staleMessage = {
        id: 'queue-1',
        status: 'processing',
        startedAt: new Date(Date.now() - 120_000),
        retryCount: 0,
        maxRetries: 2,
      } as MessageQueue;

      repository.find.mockResolvedValue([staleMessage]);
      repository.findOneBy.mockResolvedValue(staleMessage);
      repository.save.mockImplementation(async (item) => item as MessageQueue);

      await service.resetStaleProcessingMessages();

      const savedItem = (repository.save as jest.Mock).mock.calls[0][0];
      expect(savedItem.status).toBe('pending');
      expect(savedItem.retryCount).toBe(1);
      expect(savedItem.error).toBe('Stale processing message reset');
    });

    it('should permanently fail messages that have exceeded maxRetries', async () => {
      const staleMessage = {
        id: 'queue-1',
        status: 'processing',
        startedAt: new Date(Date.now() - 120_000),
        retryCount: 2,
        maxRetries: 2,
      } as MessageQueue;

      repository.find.mockResolvedValue([staleMessage]);
      repository.findOneBy.mockResolvedValue(staleMessage);
      repository.save.mockImplementation(async (item) => item as MessageQueue);

      await service.resetStaleProcessingMessages();

      const savedItem = (repository.save as jest.Mock).mock.calls[0][0];
      expect(savedItem.status).toBe('failed');
      expect(savedItem.retryCount).toBe(3);
    });

    it('should use custom timeout parameter', async () => {
      repository.find.mockResolvedValue([]);

      await service.resetStaleProcessingMessages(5_000);

      const findCall = repository.find.mock.calls[0][0] as any;
      const cutoffTime = findCall.where.startedAt.value as Date;
      const expectedCutoff = Date.now() - 5_000;
      expect(cutoffTime.getTime()).toBeGreaterThanOrEqual(expectedCutoff - 100);
      expect(cutoffTime.getTime()).toBeLessThanOrEqual(expectedCutoff + 100);
    });

    it('should exclude messages in excludeIds set', async () => {
      const staleMessages = [
        { id: 'queue-1', status: 'processing', startedAt: new Date(Date.now() - 120_000), retryCount: 0, maxRetries: 2 },
        { id: 'queue-2', status: 'processing', startedAt: new Date(Date.now() - 300_000), retryCount: 0, maxRetries: 2 },
      ] as MessageQueue[];

      repository.find.mockResolvedValue(staleMessages);
      repository.findOneBy.mockImplementation(async ({ id }: any) =>
        staleMessages.find((m) => m.id === id) || null,
      );
      repository.save.mockImplementation(async (item) => item as MessageQueue);

      const excludeIds = new Set(['queue-1']);
      const result = await service.resetStaleProcessingMessages(60_000, excludeIds);

      expect(result).toBe(1);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'queue-2' });
      expect(repository.findOneBy).not.toHaveBeenCalledWith({ id: 'queue-1' });
    });

    it('should use custom reason string in error field', async () => {
      const staleMessage = {
        id: 'queue-1',
        status: 'processing',
        startedAt: new Date(Date.now() - 120_000),
        retryCount: 0,
        maxRetries: 2,
      } as MessageQueue;

      repository.find.mockResolvedValue([staleMessage]);
      repository.findOneBy.mockResolvedValue(staleMessage);
      repository.save.mockImplementation(async (item) => item as MessageQueue);

      await service.resetStaleProcessingMessages(60_000, new Set(), 'Reset by runtime sweep');

      const savedItem = (repository.save as jest.Mock).mock.calls[0][0];
      expect(savedItem.error).toBe('Reset by runtime sweep');
    });
  });

  describe('getSessionQueueDepth', () => {
    it('should return correct queue depth statistics', async () => {
      repository.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(1); // processing

      const depth = await service.getSessionQueueDepth('session-1');

      expect(depth).toEqual({
        total: 6,
        pending: 5,
        processing: 1,
      });
    });
  });
});
