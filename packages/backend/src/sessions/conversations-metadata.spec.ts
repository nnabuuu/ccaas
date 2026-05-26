/**
 * Conversation Metadata Enhancement Tests
 *
 * Tests for:
 * 1. WebSocket reconnect returning conversation metadata (title)
 * 2. Auto-title generation from first user message
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from '../admin/entities/session.entity';
import { ConversationMetadataService } from './services/conversation-metadata.service';

describe('ConversationMetadataService', () => {
  let service: ConversationMetadataService;
  let sessionRepository: jest.Mocked<Repository<Session>>;

  const createMockSession = (
    sessionId: string,
    overrides: Partial<Session> = {},
  ): Session => ({
    id: `uuid-${sessionId}`,
    sessionId,
    solutionId: 'tenant-a',
    userId: null,
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
      providers: [
        ConversationMetadataService,
        {
          provide: getRepositoryToken(Session),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConversationMetadataService>(ConversationMetadataService);
    sessionRepository = module.get(getRepositoryToken(Session));
  });

  // ===========================================================================
  // getConversationMetadata (for reconnect enrichment)
  // ===========================================================================

  describe('getConversationMetadata', () => {
    it('should return title and metadata for existing session', async () => {
      const session = createMockSession('s1', { title: 'My Chat' });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);

      const result = await service.getConversationMetadata('s1');

      expect(result).toEqual({
        title: 'My Chat',
        isPinned: false,
      });
    });

    it('should return null values when session not found in DB', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      const result = await service.getConversationMetadata('nonexistent');

      expect(result).toEqual({
        title: null,
        isPinned: false,
      });
    });

    it('should not throw when DB query fails', async () => {
      sessionRepository.findOne = jest.fn().mockRejectedValue(new Error('DB error'));

      const result = await service.getConversationMetadata('s1');

      expect(result).toEqual({
        title: null,
        isPinned: false,
      });
    });
  });

  // ===========================================================================
  // autoGenerateTitle
  // ===========================================================================

  describe('autoGenerateTitle', () => {
    it('should generate title from first user message', async () => {
      const session = createMockSession('s1', { title: null });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockResolvedValue({
        ...session,
        title: 'Help me write a lesson plan',
      });

      await service.autoGenerateTitle('s1', 'Help me write a lesson plan about fractions');

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Help me write a lesson plan about fractions',
        }),
      );
    });

    it('should truncate long messages to 100 characters', async () => {
      const longMessage = 'A'.repeat(200);
      const session = createMockSession('s1', { title: null });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockResolvedValue(session);

      await service.autoGenerateTitle('s1', longMessage);

      const savedTitle = (sessionRepository.save.mock.calls[0][0] as any).title;
      expect(savedTitle.length).toBeLessThanOrEqual(103); // 100 + "..."
      expect(savedTitle.endsWith('...')).toBe(true);
    });

    it('should not overwrite existing title', async () => {
      const session = createMockSession('s1', { title: 'Existing Title' });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);

      await service.autoGenerateTitle('s1', 'New message');

      expect(sessionRepository.save).not.toHaveBeenCalled();
    });

    it('should not throw when session not found', async () => {
      sessionRepository.findOne = jest.fn().mockResolvedValue(null);

      // Should not throw
      await expect(
        service.autoGenerateTitle('nonexistent', 'Some message'),
      ).resolves.not.toThrow();
    });

    it('should not throw when DB save fails', async () => {
      const session = createMockSession('s1', { title: null });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockRejectedValue(new Error('DB error'));

      // Should not throw (auto-title is non-critical)
      await expect(
        service.autoGenerateTitle('s1', 'Some message'),
      ).resolves.not.toThrow();
    });

    it('should trim whitespace from message for title', async () => {
      const session = createMockSession('s1', { title: null });
      sessionRepository.findOne = jest.fn().mockResolvedValue(session);
      sessionRepository.save = jest.fn().mockResolvedValue(session);

      await service.autoGenerateTitle('s1', '   Hello world   ');

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Hello world',
        }),
      );
    });
  });
});
