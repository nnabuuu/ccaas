import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConversationContextService } from './conversation-context.service';
import { ConversationContext } from '../database/entities';

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
};

describe('ConversationContextService', () => {
  let service: ConversationContextService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationContextService,
        {
          provide: getRepositoryToken(ConversationContext),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ConversationContextService>(ConversationContextService);
    jest.clearAllMocks();
  });

  describe('createContext', () => {
    it('should create a context with serialized JSON fields', async () => {
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) => Promise.resolve({ ...data, created_at: '2026-02-15T00:00:00Z' }));

      const result = await service.createContext({
        sessionId: 'conv_123',
        tenantId: 'tenant_1',
        model: 'claude-sonnet-4-5-20250514',
        skillConfigHashes: [{ slug: 'analysis', hash: 'abc123' }],
        mcpToolsList: ['read_file', 'write_output'],
      });

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        session_id: 'conv_123',
        tenant_id: 'tenant_1',
        model: 'claude-sonnet-4-5-20250514',
        skill_config_hashes: JSON.stringify([{ slug: 'analysis', hash: 'abc123' }]),
        mcp_tools_list: JSON.stringify(['read_file', 'write_output']),
      }));
      expect(result.id).toMatch(/^ctx_/);
    });

    it('should set null for optional fields when not provided', async () => {
      mockRepository.create.mockImplementation((data) => data);
      mockRepository.save.mockImplementation((data) => Promise.resolve(data));

      await service.createContext({ sessionId: 'conv_123', tenantId: 'quiz-analyzer' });

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        session_id: 'conv_123',
        tenant_id: 'quiz-analyzer',
        system_prompt_hash: null,
        skill_config_hashes: null,
        mcp_tools_list: null,
        model: null,
        workspace_dir: null,
        client_id: null,
        metadata: null,
      }));
    });
  });

  describe('getContextBySession', () => {
    it('should return context for a session', async () => {
      const mockCtx = { id: 'ctx_1', session_id: 'conv_123', model: 'claude-3' };
      mockRepository.findOne.mockResolvedValue(mockCtx);

      const result = await service.getContextBySession('conv_123');

      expect(result).toEqual(mockCtx);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { session_id: 'conv_123' } });
    });

    it('should return null when no context exists', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.getContextBySession('conv_nonexistent');

      expect(result).toBeNull();
    });
  });
});
