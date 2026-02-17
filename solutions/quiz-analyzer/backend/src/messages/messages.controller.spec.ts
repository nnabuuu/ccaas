import { Test, TestingModule } from '@nestjs/testing';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { ConversationContextService } from './conversation-context.service';
import { TurnsService } from './turns.service';

const mockMessagesService = {
  getMessagesBySession: jest.fn(),
  createMessage: jest.fn(),
};

const mockContextService = {
  getContextBySession: jest.fn(),
  createContext: jest.fn(),
};

const mockTurnsService = {
  getTurnsBySession: jest.fn(),
};

describe('MessagesController', () => {
  let controller: MessagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessagesController],
      providers: [
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: ConversationContextService, useValue: mockContextService },
        { provide: TurnsService, useValue: mockTurnsService },
      ],
    }).compile();

    controller = module.get<MessagesController>(MessagesController);
    jest.clearAllMocks();
  });

  describe('GET /messages', () => {
    it('should return paginated messages for a session', async () => {
      const mockResult = { data: [{ id: 'msg_1' }], total: 1 };
      mockMessagesService.getMessagesBySession.mockResolvedValue(mockResult);

      const result = await controller.getMessages('conv_123');

      expect(mockMessagesService.getMessagesBySession).toHaveBeenCalledWith('conv_123', {
        limit: undefined,
        offset: undefined,
      });
      expect(result).toEqual(mockResult);
    });

    it('should parse pagination query params', async () => {
      mockMessagesService.getMessagesBySession.mockResolvedValue({ data: [], total: 0 });

      await controller.getMessages('conv_123', '10', '20');

      expect(mockMessagesService.getMessagesBySession).toHaveBeenCalledWith('conv_123', {
        limit: 10,
        offset: 20,
      });
    });
  });

  describe('POST /messages', () => {
    it('should create a message with sessionId from URL param', async () => {
      const mockMsg = { id: 'msg_new', session_id: 'conv_123', role: 'user', content: 'Hello' };
      mockMessagesService.createMessage.mockResolvedValue(mockMsg);

      const result = await controller.createMessage('conv_123', {
        role: 'user',
        content: 'Hello',
      });

      expect(mockMessagesService.createMessage).toHaveBeenCalledWith({
        role: 'user',
        content: 'Hello',
        sessionId: 'conv_123',
      });
      expect(result).toEqual(mockMsg);
    });
  });

  describe('GET /context', () => {
    it('should return conversation context for a session', async () => {
      const mockCtx = { id: 'ctx_1', session_id: 'conv_123' };
      mockContextService.getContextBySession.mockResolvedValue(mockCtx);

      const result = await controller.getContext('conv_123');

      expect(mockContextService.getContextBySession).toHaveBeenCalledWith('conv_123');
      expect(result).toEqual(mockCtx);
    });

    it('should return null when no context exists', async () => {
      mockContextService.getContextBySession.mockResolvedValue(null);

      const result = await controller.getContext('conv_nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('POST /context', () => {
    it('should create a context with sessionId from URL param', async () => {
      const mockCtx = { id: 'ctx_new', session_id: 'conv_123' };
      mockContextService.createContext.mockResolvedValue(mockCtx);

      const result = await controller.createContext('conv_123', {
        tenantId: 'tenant_1',
        model: 'claude-3',
      });

      expect(mockContextService.createContext).toHaveBeenCalledWith({
        tenantId: 'tenant_1',
        model: 'claude-3',
        sessionId: 'conv_123',
      });
      expect(result).toEqual(mockCtx);
    });
  });

  describe('GET /turns', () => {
    it('should return turns for a session', async () => {
      const mockTurns = [
        { id: 'turn_1', turn_number: 0 },
        { id: 'turn_2', turn_number: 1 },
      ];
      mockTurnsService.getTurnsBySession.mockResolvedValue(mockTurns);

      const result = await controller.getTurns('conv_123');

      expect(mockTurnsService.getTurnsBySession).toHaveBeenCalledWith('conv_123');
      expect(result).toHaveLength(2);
    });
  });
});
