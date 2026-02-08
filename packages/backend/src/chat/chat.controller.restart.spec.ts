/**
 * ChatController - Session Restart Tests
 *
 * TDD: Writing tests FIRST for session restart REST endpoint
 *
 * Week 4 Goals:
 * - POST /api/v1/sessions/:id/restart endpoint
 * - Restart session and return details
 * - Handle errors gracefully
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { SessionService } from './session.service';
import { MessagesService } from '../messages/messages.service';
import { ChatGateway } from './chat.gateway';

describe('ChatController - Session Restart (Week 4)', () => {
  let controller: ChatController;
  let sessionService: jest.Mocked<SessionService>;
  let messagesService: jest.Mocked<MessagesService>;

  beforeEach(async () => {
    const mockSessionService = {
      getSession: jest.fn(),
      getSessionDetails: jest.fn(),
      restartSession: jest.fn(),
      canRestartSession: jest.fn(),
    };

    const mockMessagesService = {
      findBySession: jest.fn(),
    };

    const mockChatGateway = {
      // Add minimal mock properties if needed
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: ChatGateway,
          useValue: mockChatGateway,
        },
      ],
    }).compile();

    controller = module.get<ChatController>(ChatController);
    sessionService = module.get(SessionService);
    messagesService = module.get(MessagesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/sessions/:id/restart', () => {
    it('should restart session and return success', async () => {
      const sessionId = 'session-123';
      const mockSessionDetails = {
        sessionId,
        userId: 'user-123',
        tenantId: 'tenant-123',
        status: 'idle',
        needsRestart: false,
        syncedSkillCount: 3,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      sessionService.getSession.mockReturnValue({ sessionId } as any);
      sessionService.canRestartSession.mockReturnValue(true);
      sessionService.restartSession.mockResolvedValue(undefined);
      sessionService.getSessionDetails.mockReturnValue(mockSessionDetails);

      const result = await controller.restartSession(sessionId);

      expect(sessionService.restartSession).toHaveBeenCalledWith(sessionId, undefined);
      expect(result).toEqual({
        success: true,
        message: 'Session restarted successfully',
        session: mockSessionDetails,
      });
    });

    it('should throw NotFoundException if session does not exist', async () => {
      sessionService.getSession.mockReturnValue(undefined);

      await expect(controller.restartSession('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.restartSession('nonexistent')).rejects.toThrow(
        'Session not found: nonexistent',
      );
    });

    it('should throw BadRequestException if session cannot be restarted', async () => {
      const sessionId = 'session-processing';

      sessionService.getSession.mockReturnValue({ sessionId, status: 'processing' } as any);
      sessionService.canRestartSession.mockReturnValue(false);

      await expect(controller.restartSession(sessionId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.restartSession(sessionId)).rejects.toThrow(
        'Session cannot be restarted at this time',
      );
    });

    it('should handle restart errors gracefully', async () => {
      const sessionId = 'session-error';

      sessionService.getSession.mockReturnValue({ sessionId } as any);
      sessionService.canRestartSession.mockReturnValue(true);
      sessionService.restartSession.mockRejectedValue(new Error('Process termination failed'));

      await expect(controller.restartSession(sessionId)).rejects.toThrow(
        'Process termination failed',
      );
    });

    it('should work with sessions that have no userId (anonymous)', async () => {
      const sessionId = 'session-anon';
      const mockSessionDetails = {
        sessionId,
        userId: undefined,
        tenantId: 'tenant-123',
        status: 'idle',
        needsRestart: false,
        syncedSkillCount: 1,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      sessionService.getSession.mockReturnValue({ sessionId } as any);
      sessionService.canRestartSession.mockReturnValue(true);
      sessionService.restartSession.mockResolvedValue(undefined);
      sessionService.getSessionDetails.mockReturnValue(mockSessionDetails);

      const result = await controller.restartSession(sessionId);

      expect(result.success).toBe(true);
      expect(result.session?.userId).toBeUndefined();
    });
  });

  describe('GET /api/v1/sessions/:id/details', () => {
    it('should return session details', () => {
      const sessionId = 'session-details';
      const mockDetails = {
        sessionId,
        userId: 'user-123',
        tenantId: 'tenant-123',
        status: 'idle',
        needsRestart: true,
        syncedSkillCount: 5,
        lastActivity: new Date(),
        createdAt: new Date(),
      };

      sessionService.getSessionDetails.mockReturnValue(mockDetails);

      const result = controller.getSessionDetails(sessionId);

      expect(sessionService.getSessionDetails).toHaveBeenCalledWith(sessionId);
      expect(result).toEqual(mockDetails);
    });

    it('should throw NotFoundException if session does not exist', () => {
      sessionService.getSessionDetails.mockReturnValue(null);

      expect(() => controller.getSessionDetails('nonexistent')).toThrow(NotFoundException);
      expect(() => controller.getSessionDetails('nonexistent')).toThrow(
        'Session not found: nonexistent',
      );
    });
  });
});
