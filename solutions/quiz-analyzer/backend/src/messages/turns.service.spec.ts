import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TurnsService } from './turns.service';
import { Turn } from '../database/entities';

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
};

describe('TurnsService', () => {
  let service: TurnsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TurnsService,
        {
          provide: getRepositoryToken(Turn),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TurnsService>(TurnsService);
    jest.clearAllMocks();
  });

  describe('createTurn', () => {
    it('should create a turn with auto-incremented number', async () => {
      mockRepository.count.mockResolvedValue(2);
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) => Promise.resolve({ ...data, created_at: '2026-02-15T00:00:00Z' }));

      const result = await service.createTurn({
        sessionId: 'conv_123',
        userMessageId: 'msg_user_3',
      });

      expect(mockRepository.count).toHaveBeenCalledWith({ where: { session_id: 'conv_123' } });
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        session_id: 'conv_123',
        turn_number: 2,
        user_message_id: 'msg_user_3',
        assistant_message_id: null,
        total_tokens: 0,
        duration_ms: 0,
      }));
      expect(result.id).toMatch(/^turn_/);
    });
  });

  describe('completeTurn', () => {
    it('should update turn with assistant response and metrics', async () => {
      const mockTurn = {
        id: 'turn_1',
        session_id: 'conv_123',
        turn_number: 0,
        user_message_id: 'msg_user_1',
        assistant_message_id: null,
        total_tokens: 0,
        duration_ms: 0,
        completed_at: null,
      };
      mockRepository.findOne.mockResolvedValue(mockTurn);
      mockRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await service.completeTurn('turn_1', {
        assistantMessageId: 'msg_asst_1',
        totalTokens: 150,
        durationMs: 3200,
      });

      expect(result.assistant_message_id).toBe('msg_asst_1');
      expect(result.total_tokens).toBe(150);
      expect(result.duration_ms).toBe(3200);
      expect(result.completed_at).toBeTruthy();
    });

    it('should return null when turn not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.completeTurn('turn_nonexistent', {
        assistantMessageId: 'msg_asst_1',
      });

      expect(result).toBeNull();
    });
  });

  describe('getTurnsBySession', () => {
    it('should return turns ordered by number', async () => {
      const mockTurns = [
        { id: 'turn_1', turn_number: 0 },
        { id: 'turn_2', turn_number: 1 },
      ];
      mockRepository.find.mockResolvedValue(mockTurns);

      const result = await service.getTurnsBySession('conv_123');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { session_id: 'conv_123' },
        order: { turn_number: 'ASC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getLatestTurn', () => {
    it('should return the most recent turn', async () => {
      const mockTurn = { id: 'turn_5', turn_number: 4 };
      mockRepository.findOne.mockResolvedValue(mockTurn);

      const result = await service.getLatestTurn('conv_123');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { session_id: 'conv_123' },
        order: { turn_number: 'DESC' },
      });
      expect(result).toEqual(mockTurn);
    });

    it('should return null when no turns exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getLatestTurn('conv_123');

      expect(result).toBeNull();
    });
  });
});
