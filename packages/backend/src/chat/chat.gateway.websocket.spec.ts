/**
 * ChatGateway - WebSocket Event Forwarding Tests
 *
 * TDD: Writing tests FIRST for skill_updated event forwarding
 *
 * Week 5 Goals:
 * - Listen to skill.updated event from EventEmitter
 * - Forward event to tenant room via Socket.io
 * - Include all session details in forwarded event
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatGateway } from './chat.gateway';
import { SessionService } from './session.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import { EventMapperService } from './event-mapper.service';
import { MessagesService } from '../messages/messages.service';
import { TenantsService } from '../tenants/tenants.service';
import { ToolEventsService } from '../messages/tool-events.service';
import { ThinkingBlocksService } from '../messages/thinking-blocks.service';
import { TokenUsageService } from '../messages/token-usage.service';
import { ProcessLifecycleService } from '../messages/process-lifecycle.service';
import { ConversationContextService } from '../messages/conversation-context.service';
import { UserContextService } from '../messages/user-context.service';
import { FilesService } from '../files/files.service';

describe('ChatGateway - WebSocket Events (Week 5)', () => {
  let gateway: ChatGateway;
  let eventEmitter: EventEmitter2;
  let mockServer: any;

  beforeEach(async () => {
    const mockSessionService = {
      getOrCreateSession: jest.fn(),
      getSession: jest.fn(),
    };

    const mockSkillSyncService = {
      syncToSession: jest.fn(),
    };

    const mockEventMapperService = {
      handleEvent: jest.fn(),
      registerToolHook: jest.fn(),
      registerThinkingCallback: jest.fn(),
      registerTokenUsageCallback: jest.fn(),
    };

    const mockMessagesService = {
      create: jest.fn(),
    };

    const mockTenantsService = {
      findOne: jest.fn(),
    };

    const mockToolEventsService = {
      create: jest.fn(),
    };

    const mockThinkingBlocksService = {
      create: jest.fn(),
    };

    const mockTokenUsageService = {
      create: jest.fn(),
    };

    const mockProcessLifecycleService = {
      create: jest.fn(),
    };

    const mockConversationContextService = {
      create: jest.fn(),
    };

    const mockUserContextService = {
      create: jest.fn(),
    };

    const mockFilesService = {
      create: jest.fn(),
    };

    // Use real EventEmitter2 for testing
    const realEventEmitter = new EventEmitter2();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: SkillSyncService,
          useValue: mockSkillSyncService,
        },
        {
          provide: EventMapperService,
          useValue: mockEventMapperService,
        },
        {
          provide: MessagesService,
          useValue: mockMessagesService,
        },
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
        {
          provide: ToolEventsService,
          useValue: mockToolEventsService,
        },
        {
          provide: ThinkingBlocksService,
          useValue: mockThinkingBlocksService,
        },
        {
          provide: TokenUsageService,
          useValue: mockTokenUsageService,
        },
        {
          provide: ProcessLifecycleService,
          useValue: mockProcessLifecycleService,
        },
        {
          provide: ConversationContextService,
          useValue: mockConversationContextService,
        },
        {
          provide: UserContextService,
          useValue: mockUserContextService,
        },
        {
          provide: FilesService,
          useValue: mockFilesService,
        },
        {
          provide: EventEmitter2,
          useValue: realEventEmitter,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    eventEmitter = module.get(EventEmitter2);

    // Mock Socket.io server
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    // Assign mock server to gateway
    gateway.server = mockServer;

    // Initialize gateway (sets up event listeners)
    gateway.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('skill.updated event forwarding', () => {
    it('should forward skill_updated event to tenant room', (done) => {
      const mockEvent = {
        skill: {
          id: 'skill-123',
          name: 'Customer Support',
          version: '1.2.0',
          updatedBy: 'user-admin',
          updatedAt: '2024-02-08T10:30:00Z',
        },
        affectedSessions: [
          {
            sessionId: 'session-1',
            userId: 'user-1',
            lastActive: new Date('2024-02-08T10:00:00Z'),
            canRestart: true,
          },
        ],
        impact: 'low',
        tenantId: 'tenant-123',
      };

      // Emit event after a short delay to ensure listener is registered
      setTimeout(() => {
        eventEmitter.emit('skill.updated', mockEvent);

        // Give time for event to be processed
        setTimeout(() => {
          expect(mockServer.to).toHaveBeenCalledWith('tenant:tenant-123');
          expect(mockServer.emit).toHaveBeenCalledWith('skill_updated', {
            type: 'skill_updated',
            skill: mockEvent.skill,
            affectedSessions: mockEvent.affectedSessions,
            impact: mockEvent.impact,
          });
          done();
        }, 10);
      }, 10);
    });

    it('should handle events with no affected sessions', (done) => {
      const mockEvent = {
        skill: {
          id: 'skill-456',
          name: 'Unused Skill',
          version: '1.0.0',
          updatedAt: '2024-02-08T10:30:00Z',
        },
        affectedSessions: [],
        impact: 'low',
        tenantId: 'tenant-456',
      };

      setTimeout(() => {
        eventEmitter.emit('skill.updated', mockEvent);

        setTimeout(() => {
          expect(mockServer.to).toHaveBeenCalledWith('tenant:tenant-456');
          expect(mockServer.emit).toHaveBeenCalledWith('skill_updated', {
            type: 'skill_updated',
            skill: mockEvent.skill,
            affectedSessions: [],
            impact: 'low',
          });
          done();
        }, 10);
      }, 10);
    });

    it('should handle high impact events', (done) => {
      const mockEvent = {
        skill: {
          id: 'skill-789',
          name: 'Popular Skill',
          version: '2.0.0',
          updatedBy: 'admin',
          updatedAt: '2024-02-08T11:00:00Z',
        },
        affectedSessions: Array.from({ length: 10 }, (_, i) => ({
          sessionId: `session-${i}`,
          userId: `user-${i}`,
          lastActive: new Date(),
          canRestart: true,
        })),
        impact: 'high',
        tenantId: 'tenant-789',
      };

      setTimeout(() => {
        eventEmitter.emit('skill.updated', mockEvent);

        setTimeout(() => {
          expect(mockServer.to).toHaveBeenCalledWith('tenant:tenant-789');
          expect(mockServer.emit).toHaveBeenCalledWith('skill_updated', {
            type: 'skill_updated',
            skill: mockEvent.skill,
            affectedSessions: expect.arrayContaining([
              expect.objectContaining({
                sessionId: 'session-0',
              }),
            ]),
            impact: 'high',
          });
          done();
        }, 10);
      }, 10);
    });

    it('should include all session details in forwarded event', (done) => {
      const mockEvent = {
        skill: {
          id: 'skill-abc',
          name: 'Test Skill',
          version: '1.0.0',
          updatedAt: '2024-02-08T12:00:00Z',
        },
        affectedSessions: [
          {
            sessionId: 'session-detailed',
            userId: 'user-123',
            lastActive: new Date('2024-02-08T11:55:00Z'),
            canRestart: true,
          },
        ],
        impact: 'low',
        tenantId: 'tenant-abc',
      };

      setTimeout(() => {
        eventEmitter.emit('skill.updated', mockEvent);

        setTimeout(() => {
          const emitCall = mockServer.emit.mock.calls[0];
          expect(emitCall[1].affectedSessions[0]).toMatchObject({
            sessionId: 'session-detailed',
            userId: 'user-123',
            canRestart: true,
          });
          done();
        }, 10);
      }, 10);
    });
  });
});
