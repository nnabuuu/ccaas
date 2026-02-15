import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MessagesService } from './messages.service';
import { Message } from '../database/entities';

const mockQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getRawOne: jest.fn(),
};

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findAndCount: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQueryBuilder),
  manager: {
    transaction: jest.fn((callback) => {
      const mockManager = {
        getRepository: jest.fn(() => mockRepository),
      };
      return callback(mockManager);
    }),
  },
};

describe('MessagesService', () => {
  let service: MessagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        {
          provide: getRepositoryToken(Message),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    jest.clearAllMocks();
  });

  describe('createMessage', () => {
    it('should create a message with auto-incremented index', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxIndex: 2 });
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) => Promise.resolve({ ...data, created_at: '2026-02-15T00:00:00Z' }));

      const result = await service.createMessage({
        sessionId: 'conv_123',
        role: 'user',
        content: 'Hello world',
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('message.session_id = :sessionId', { sessionId: 'conv_123' });
      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        session_id: 'conv_123',
        role: 'user',
        content: 'Hello world',
        message_index: 3,
      }));
      expect(result.id).toMatch(/^msg_/);
    });

    it('should serialize metadata and toolCalls as JSON', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxIndex: null });
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) => Promise.resolve(data));

      await service.createMessage({
        sessionId: 'conv_123',
        role: 'assistant',
        content: 'Response',
        metadata: { model: 'claude-3', inputTokens: 10 },
        toolCalls: [{ id: 'tc_1', name: 'read', input: {}, status: 'completed' }],
        thinkingBlocks: [{ id: 'tb_1', content: 'Thinking' }],
      });

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        metadata: JSON.stringify({ model: 'claude-3', inputTokens: 10 }),
        tool_calls: JSON.stringify([{ id: 'tc_1', name: 'read', input: {}, status: 'completed' }]),
        thinking_blocks: JSON.stringify([{ id: 'tb_1', content: 'Thinking' }]),
      }));
    });

    it('should set null for optional fields when not provided', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ maxIndex: null });
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) => Promise.resolve(data));

      await service.createMessage({
        sessionId: 'conv_123',
        role: 'user',
        content: 'Test',
      });

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        parent_message_id: null,
        branch_id: null,
        is_continuation: 0,
        metadata: null,
        tool_calls: null,
        thinking_blocks: null,
      }));
    });
  });

  describe('getMessagesBySession', () => {
    it('should return paginated messages ordered by index', async () => {
      const mockMessages = [
        { id: 'msg_1', message_index: 0 },
        { id: 'msg_2', message_index: 1 },
      ];
      mockRepository.findAndCount.mockResolvedValue([mockMessages, 2]);

      const result = await service.getMessagesBySession('conv_123');

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { session_id: 'conv_123' },
        order: { message_index: 'ASC' },
        take: 50,
        skip: 0,
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should support custom pagination', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.getMessagesBySession('conv_123', { limit: 10, offset: 20 });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        take: 10,
        skip: 20,
      }));
    });
  });

  describe('getMessageCount', () => {
    it('should return count for a session', async () => {
      mockRepository.count.mockResolvedValue(5);

      const result = await service.getMessageCount('conv_123');

      expect(result).toBe(5);
      expect(mockRepository.count).toHaveBeenCalledWith({ where: { session_id: 'conv_123' } });
    });
  });
});
