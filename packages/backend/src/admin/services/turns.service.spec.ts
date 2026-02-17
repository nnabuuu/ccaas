import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TurnsService } from './turns.service';
import { Turn } from '../entities/turn.entity';
import { TokenUsageEvent } from '../../messages/entities/token-usage-event.entity';
import { NotFoundException } from '@nestjs/common';

describe('TurnsService', () => {
  let service: TurnsService;
  let turnRepository: jest.Mocked<Repository<Turn>>;
  let tokenUsageRepository: jest.Mocked<Repository<TokenUsageEvent>>;

  const mockTurnRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: null as any,
  };

  const mockTokenUsageRepository = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnsService,
        {
          provide: getRepositoryToken(Turn),
          useValue: mockTurnRepository,
        },
        {
          provide: getRepositoryToken(TokenUsageEvent),
          useValue: mockTokenUsageRepository,
        },
      ],
    }).compile();

    service = module.get<TurnsService>(TurnsService);
    turnRepository = module.get(getRepositoryToken(Turn));
    tokenUsageRepository = module.get(getRepositoryToken(TokenUsageEvent));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTurn', () => {
    it('should create a new turn with initial values', async () => {
      const params = {
        sessionId: 'session-123',
        userMessageId: 'user-msg-456',
        turnNumber: 0,
      };

      const createdTurn = {
        id: 'turn-789',
        sessionId: params.sessionId,
        turnNumber: params.turnNumber,
        userMessageId: params.userMessageId,
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
        createdAt: new Date(),
        completedAt: null,
      };

      mockTurnRepository.create.mockReturnValue(createdTurn as any);
      mockTurnRepository.save.mockResolvedValue(createdTurn as any);

      const result = await service.createTurn(params);

      expect(mockTurnRepository.create).toHaveBeenCalledWith({
        sessionId: params.sessionId,
        turnNumber: params.turnNumber,
        userMessageId: params.userMessageId,
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
      });
      expect(mockTurnRepository.save).toHaveBeenCalledWith(createdTurn);
      expect(result).toEqual(createdTurn);
    });
  });

  describe('createNextTurn', () => {
    it('should create a turn with atomically assigned turn number', async () => {
      const params = {
        sessionId: 'session-123',
        userMessageId: 'user-msg-456',
      };

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxTurnNumber: 2 }),
      };

      const createdTurn = {
        id: 'turn-789',
        sessionId: params.sessionId,
        turnNumber: 3,
        userMessageId: params.userMessageId,
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
        createdAt: new Date(),
        completedAt: null,
      };

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        create: jest.fn().mockReturnValue(createdTurn),
        save: jest.fn().mockResolvedValue(createdTurn),
      };

      mockTurnRepository.manager = {
        transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
      } as any;

      const result = await service.createNextTurn(params);

      expect(result.turnNumber).toBe(3);
      expect(result.sessionId).toBe(params.sessionId);
      expect(result.userMessageId).toBe(params.userMessageId);
    });

    it('should start at turn 0 for new sessions', async () => {
      const params = {
        sessionId: 'session-new',
        userMessageId: 'user-msg-1',
      };

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      const createdTurn = {
        id: 'turn-1',
        sessionId: params.sessionId,
        turnNumber: 0,
        userMessageId: params.userMessageId,
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
        createdAt: new Date(),
        completedAt: null,
      };

      const mockManager = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        create: jest.fn().mockReturnValue(createdTurn),
        save: jest.fn().mockResolvedValue(createdTurn),
      };

      mockTurnRepository.manager = {
        transaction: jest.fn().mockImplementation((cb) => cb(mockManager)),
      } as any;

      const result = await service.createNextTurn(params);

      expect(result.turnNumber).toBe(0);
    });
  });

  describe('completeTurnWithRetry', () => {
    it('should return immediately if tokens found on first attempt', async () => {
      const params = {
        turnId: 'turn-789',
        assistantMessageId: 'assistant-msg-999',
      };

      const existingTurn = {
        id: params.turnId,
        sessionId: 'session-123',
        turnNumber: 0,
        userMessageId: 'user-msg-456',
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
        createdAt: new Date(Date.now() - 5000),
        completedAt: null,
      };

      const tokenEvents = [
        {
          id: 'event-1',
          messageId: params.assistantMessageId,
          inputTokens: 100,
          outputTokens: 50,
          reasoningTokens: 10,
          cachedInputTokens: 0,
          cacheCreationTokens: 0,
        },
      ];

      mockTurnRepository.findOne.mockResolvedValue(existingTurn as any);
      mockTokenUsageRepository.find.mockResolvedValue(tokenEvents as any);
      mockTurnRepository.save.mockImplementation((turn) =>
        Promise.resolve(turn as any),
      );

      const result = await service.completeTurnWithRetry(params);

      expect(result.totalTokens).toBe(160);
      // Should only call once since tokens were found
      expect(mockTurnRepository.findOne).toHaveBeenCalledTimes(1);
    });

    it('should retry up to maxRetries if no tokens found', async () => {
      const params = {
        turnId: 'turn-789',
        assistantMessageId: 'assistant-msg-999',
        maxRetries: 2,
      };

      const existingTurn = {
        id: params.turnId,
        sessionId: 'session-123',
        turnNumber: 0,
        userMessageId: 'user-msg-456',
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
        createdAt: new Date(Date.now() - 100),
        completedAt: null,
      };

      mockTurnRepository.findOne.mockResolvedValue(existingTurn as any);
      mockTokenUsageRepository.find.mockResolvedValue([]);
      mockTurnRepository.save.mockImplementation((turn) =>
        Promise.resolve(turn as any),
      );

      const result = await service.completeTurnWithRetry(params);

      expect(result.totalTokens).toBe(0);
      // Should retry 3 times (initial + 2 retries)
      expect(mockTurnRepository.findOne).toHaveBeenCalledTimes(3);
    });
  });

  describe('completeTurn', () => {
    it('should complete a turn with assistant message, tokens, and duration', async () => {
      const params = {
        turnId: 'turn-789',
        assistantMessageId: 'assistant-msg-999',
      };

      const existingTurn = {
        id: params.turnId,
        sessionId: 'session-123',
        turnNumber: 0,
        userMessageId: 'user-msg-456',
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
        createdAt: new Date(Date.now() - 5000), // 5 seconds ago
        completedAt: null,
      };

      const tokenEvents = [
        {
          id: 'event-1',
          messageId: params.assistantMessageId,
          inputTokens: 100,
          outputTokens: 50,
          reasoningTokens: 10,
          cachedInputTokens: 20,
          cacheCreationTokens: 5,
        },
        {
          id: 'event-2',
          messageId: params.assistantMessageId,
          inputTokens: 30,
          outputTokens: 20,
          reasoningTokens: 0,
          cachedInputTokens: 0,
          cacheCreationTokens: 0,
        },
      ];

      // inputTokens already includes cachedInputTokens (they are a subset)
      // cacheCreationTokens are a one-time cost, not counted in total context
      const expectedTotalTokens = 100 + 50 + 10 + 30 + 20; // 210

      mockTurnRepository.findOne.mockResolvedValue(existingTurn as any);
      mockTokenUsageRepository.find.mockResolvedValue(tokenEvents as any);
      mockTurnRepository.save.mockImplementation((turn) =>
        Promise.resolve(turn as any),
      );

      const result = await service.completeTurn(params);

      expect(mockTurnRepository.findOne).toHaveBeenCalledWith({
        where: { id: params.turnId },
      });
      expect(mockTokenUsageRepository.find).toHaveBeenCalledWith({
        where: { messageId: params.assistantMessageId },
      });

      expect(result.assistantMessageId).toBe(params.assistantMessageId);
      expect(result.totalTokens).toBe(expectedTotalTokens);
      expect(result.durationMs).toBeGreaterThan(0);
      expect(result.completedAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException if turn not found', async () => {
      mockTurnRepository.findOne.mockResolvedValue(null);

      await expect(
        service.completeTurn({
          turnId: 'nonexistent-turn',
          assistantMessageId: 'assistant-msg-999',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle turns with no token events', async () => {
      const params = {
        turnId: 'turn-789',
        assistantMessageId: 'assistant-msg-999',
      };

      const existingTurn = {
        id: params.turnId,
        sessionId: 'session-123',
        turnNumber: 0,
        userMessageId: 'user-msg-456',
        assistantMessageId: null,
        totalTokens: 0,
        durationMs: 0,
        createdAt: new Date(Date.now() - 1000),
        completedAt: null,
      };

      mockTurnRepository.findOne.mockResolvedValue(existingTurn as any);
      mockTokenUsageRepository.find.mockResolvedValue([]);
      mockTurnRepository.save.mockImplementation((turn) =>
        Promise.resolve(turn as any),
      );

      const result = await service.completeTurn(params);

      expect(result.totalTokens).toBe(0);
      expect(result.assistantMessageId).toBe(params.assistantMessageId);
    });
  });

  describe('getTurnsBySession', () => {
    it('should return all turns for a session ordered by turnNumber', async () => {
      const sessionId = 'session-123';
      const turns = [
        {
          id: 'turn-1',
          sessionId,
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
          sessionId,
          turnNumber: 1,
          userMessageId: 'user-msg-2',
          assistantMessageId: 'assistant-msg-2',
          totalTokens: 150,
          durationMs: 7000,
          createdAt: new Date(),
          completedAt: new Date(),
        },
      ];

      mockTurnRepository.find.mockResolvedValue(turns as any);

      const result = await service.getTurnsBySession(sessionId);

      expect(mockTurnRepository.find).toHaveBeenCalledWith({
        where: { sessionId },
        order: { turnNumber: 'ASC' },
      });
      expect(result).toEqual(turns);
    });

    it('should return empty array if no turns found', async () => {
      mockTurnRepository.find.mockResolvedValue([]);

      const result = await service.getTurnsBySession('session-no-turns');

      expect(result).toEqual([]);
    });
  });

  describe('getNextTurnNumber', () => {
    it('should return 0 for a session with no turns', async () => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue(null),
      };

      mockTurnRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      const result = await service.getNextTurnNumber('session-new');

      expect(result).toBe(0);
    });

    it('should return next turn number for existing session', async () => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxTurnNumber: 5 }),
      };

      mockTurnRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      const result = await service.getNextTurnNumber('session-existing');

      expect(result).toBe(6);
    });

    it('should handle null maxTurnNumber from database', async () => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ maxTurnNumber: null }),
      };

      mockTurnRepository.createQueryBuilder.mockReturnValue(
        queryBuilder as any,
      );

      const result = await service.getNextTurnNumber('session-123');

      expect(result).toBe(0);
    });
  });
});
