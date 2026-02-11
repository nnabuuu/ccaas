import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionService } from '../chat/session.service';
import { ChatGateway } from '../chat/chat.gateway';
import { SkillSyncService } from '../skills/skill-sync.service';
import { SkillsService } from '../skills/skills.service';
import { TenantsService } from '../tenants/tenants.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationContextService } from '../messages/conversation-context.service';

describe('SessionsController - Sub-Agents Endpoint', () => {
  let controller: SessionsController;
  let sessionService: any;
  let chatGateway: any;

  const mockSession = {
    id: 'test-session',
    clientId: 'client-1',
    tenantId: 'tenant-1',
  };

  const mockSubAgents = [
    {
      subAgentId: 'toolu_01ABC',
      agentType: 'Task',
      description: 'Generating teaching guide',
      startedAt: '2025-02-03T10:30:45.123Z',
      status: 'running' as const,
      nestingLevel: 1,
    },
    {
      subAgentId: 'toolu_02DEF',
      agentType: 'Explore',
      description: 'Searching codebase',
      startedAt: '2025-02-03T10:31:00.456Z',
      status: 'running' as const,
      nestingLevel: 1,
    },
  ];

  beforeEach(async () => {
    sessionService = {
      getSession: jest.fn(),
      getSessionStatus: jest.fn(),
    };

    chatGateway = {
      getActiveSubAgents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionService, useValue: sessionService },
        { provide: ChatGateway, useValue: chatGateway },
        { provide: SkillSyncService, useValue: {} },
        { provide: SkillsService, useValue: {} },
        { provide: TenantsService, useValue: {} },
        { provide: MessagesService, useValue: {} },
        { provide: ConversationContextService, useValue: {} },
      ],
    }).compile();

    controller = module.get<SessionsController>(SessionsController);
  });

  describe('GET /sessions/:sessionId/sub-agents', () => {
    it('should return active sub-agents for valid session', () => {
      sessionService.getSession.mockReturnValue(mockSession);
      chatGateway.getActiveSubAgents.mockReturnValue(mockSubAgents);

      const result = controller.getActiveSubAgents('test-session');

      expect(sessionService.getSession).toHaveBeenCalledWith('test-session');
      expect(chatGateway.getActiveSubAgents).toHaveBeenCalledWith('test-session');
      expect(result.sessionId).toBe('test-session');
      expect(result.activeSubAgents).toEqual(mockSubAgents);
      expect(result.activeSubAgents).toHaveLength(2);
      expect(result.timestamp).toBeDefined();
    });

    it('should return 404 for non-existent session', () => {
      sessionService.getSession.mockReturnValue(null);

      expect(() => controller.getActiveSubAgents('fake-session')).toThrow(NotFoundException);
      expect(() => controller.getActiveSubAgents('fake-session')).toThrow(
        'Session not found: fake-session'
      );
    });

    it('should return empty array when no active sub-agents', () => {
      sessionService.getSession.mockReturnValue(mockSession);
      chatGateway.getActiveSubAgents.mockReturnValue([]);

      const result = controller.getActiveSubAgents('test-session');

      expect(result.activeSubAgents).toEqual([]);
      expect(result.activeSubAgents).toHaveLength(0);
    });

    it('should include timestamp in ISO format', () => {
      sessionService.getSession.mockReturnValue(mockSession);
      chatGateway.getActiveSubAgents.mockReturnValue(mockSubAgents);

      const result = controller.getActiveSubAgents('test-session');

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return sub-agents with all required fields', () => {
      sessionService.getSession.mockReturnValue(mockSession);
      chatGateway.getActiveSubAgents.mockReturnValue(mockSubAgents);

      const result = controller.getActiveSubAgents('test-session');

      result.activeSubAgents.forEach(agent => {
        expect(agent).toHaveProperty('subAgentId');
        expect(agent).toHaveProperty('agentType');
        expect(agent).toHaveProperty('startedAt');
        expect(agent).toHaveProperty('status');
        expect(['running', 'completed', 'failed']).toContain(agent.status);
      });
    });
  });
});
