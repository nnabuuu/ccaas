import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionService } from '../sessions/session.service';
import { SessionsGateway } from '../sessions/sessions.gateway';
import { CompletionOrchestrationService } from './services/completion-orchestration.service';
import { MessageQueueService } from './services/message-queue.service';
import { SkillManagementService } from './services/skill-management.service';
import { AttachmentService } from './services/attachment.service';
import { SkillSyncService } from '../skills/skill-sync.service';
import { SkillsService } from '../skills/skills.service';
import { SolutionsService } from '../solutions/solutions.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationContextService } from '../messages/conversation-context.service';
import { StreamRegistryService } from './services/stream-registry.service';
import { SendMessageDto } from './dto/send-message.dto';
import { makeSseClientId } from './session-utils';
import { QuotaService } from '../admin/quota.service';
import { QuotaGuard } from '../admin/guards/quota.guard';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Session } from '../admin/entities/session.entity';
import { TurnsService } from '../admin/services/turns.service';
import { CliProcessService } from './services/cli-process.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { SolutionAuthGuard } from '../solutions/solution-auth.guard';

// ── sendMessage (queue-routed) ────────────────────────────────────────────────

describe('SessionsController — sendMessage (queue-routed via enqueue)', () => {
  let controller: SessionsController;
  let sessionService: any;
  let streamRegistry: any;
  let completionOrchestrationService: any;
  let messageQueueService: any;
  let tenantsService: any;
  let skillsService: any;
  let skillManagementService: any;

  const SESSION_ID = 'test-session-autoclose';

  beforeEach(async () => {
    sessionService = {
      getOrCreateSession: jest.fn().mockResolvedValue({ sessionId: 'mock', socket: null }),
      closeSession: jest.fn(),
    };

    completionOrchestrationService = {
      orchestrateMessage: jest.fn(),
    };

    messageQueueService = {
      enqueue: jest.fn().mockResolvedValue({ id: 'queue-item-1' }),
    };

    streamRegistry = {
      subscribe: jest.fn(),
      emit: jest.fn(),
      closeSession: jest.fn(),
      getEventsSince: jest.fn().mockReturnValue([]),
    };

    tenantsService = {
      findOne: jest.fn().mockResolvedValue({ id: 'tenant-123' }),
    };

    skillsService = {
      findPublished: jest.fn().mockResolvedValue([]),
    };

    skillManagementService = {
      generateSystemPromptForSession: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionService, useValue: sessionService },
        { provide: SessionsGateway, useValue: { getActiveSubAgents: jest.fn() } },
        { provide: CompletionOrchestrationService, useValue: completionOrchestrationService },
        { provide: MessageQueueService, useValue: messageQueueService },
        { provide: SkillManagementService, useValue: skillManagementService },
        { provide: AttachmentService, useValue: { resolveAttachments: jest.fn().mockReturnValue([]) } },
        { provide: SkillSyncService, useValue: {} },
        { provide: SkillsService, useValue: skillsService },
        { provide: SolutionsService, useValue: tenantsService },
        { provide: MessagesService, useValue: {} },
        { provide: ConversationContextService, useValue: {} },
        { provide: StreamRegistryService, useValue: streamRegistry },
        { provide: QuotaService, useValue: { checkQuota: jest.fn().mockResolvedValue({ allowed: true }), getOrCreateQuota: jest.fn() } },
        { provide: QuotaGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: TurnsService, useValue: {} },
        { provide: CliProcessService, useValue: { sendControlResponse: jest.fn() } },
      ],
    })
      .overrideGuard(ApiKeyGuard).useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard).useValue({ canActivate: () => true })
      .overrideGuard(SolutionAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionsController>(SessionsController);
  });

  const mockRes: any = {
    setHeader: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  };

  const mockCtx: any = undefined;

  it('calls messageQueueService.enqueue() with correct payload', async () => {
    const dto: SendMessageDto = {
      message: 'hello',
      solutionId: 'tenant-123',
      autoClose: true,
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(messageQueueService.enqueue).toHaveBeenCalledWith(
      SESSION_ID,
      makeSseClientId(SESSION_ID),
      'tenant-123',
      expect.objectContaining({
        message: 'hello',
        autoClose: true,
      }),
    );
  });

  it('includes pre-computed systemPrompt in enqueue payload', async () => {
    skillsService.findPublished.mockResolvedValue([{ slug: 'tutor', enabled: true }]);
    skillManagementService.generateSystemPromptForSession.mockResolvedValue('You are a tutor.');

    const dto: SendMessageDto = {
      message: 'teach me',
      solutionId: 'tenant-123',
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(messageQueueService.enqueue).toHaveBeenCalledWith(
      SESSION_ID,
      makeSseClientId(SESSION_ID),
      'tenant-123',
      expect.objectContaining({ systemPrompt: 'You are a tutor.' }),
    );
  });

  it('appends appendSystemPrompt to generated systemPrompt', async () => {
    skillsService.findPublished.mockResolvedValue([{ slug: 'tutor', enabled: true }]);
    skillManagementService.generateSystemPromptForSession.mockResolvedValue('Base prompt.');

    const dto: SendMessageDto = {
      message: 'hello',
      solutionId: 'tenant-123',
      appendSystemPrompt: 'Extra instruction.',
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(messageQueueService.enqueue).toHaveBeenCalledWith(
      SESSION_ID,
      makeSseClientId(SESSION_ID),
      'tenant-123',
      expect.objectContaining({ systemPrompt: 'Base prompt.\n\nExtra instruction.' }),
    );
  });

  it('does NOT call orchestrateMessage (worker handles orchestration)', async () => {
    const dto: SendMessageDto = {
      message: 'hello',
      solutionId: 'tenant-123',
      autoClose: true,
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(completionOrchestrationService.orchestrateMessage).not.toHaveBeenCalled();
  });

  it('does NOT call sessionService.closeSession (worker handles autoClose)', async () => {
    const dto: SendMessageDto = {
      message: 'hello',
      solutionId: 'tenant-123',
      autoClose: true,
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(sessionService.closeSession).not.toHaveBeenCalled();
  });

  it('does NOT call streamRegistry.closeSession in success path (worker closes SSE)', async () => {
    const dto: SendMessageDto = {
      message: 'hello',
      solutionId: 'tenant-123',
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(streamRegistry.closeSession).not.toHaveBeenCalled();
  });

  it('emits error and closes SSE stream when enqueue throws', async () => {
    messageQueueService.enqueue.mockRejectedValue(new Error('db error'));

    const dto: SendMessageDto = {
      message: 'hello',
      solutionId: 'tenant-123',
      autoClose: true,
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(streamRegistry.emit).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ code: 'INTERNAL_ERROR', message: 'db error' }),
    );
    expect(streamRegistry.closeSession).toHaveBeenCalledWith(SESSION_ID);
    expect(sessionService.closeSession).not.toHaveBeenCalled();
  });

  it('emits error and closes SSE stream when tenantsService.findOne throws', async () => {
    tenantsService.findOne.mockRejectedValue(new Error('tenant db error'));

    const dto: SendMessageDto = {
      message: 'hello',
      solutionId: 'tenant-123',
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(streamRegistry.emit).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ code: 'INTERNAL_ERROR', message: 'tenant db error' }),
    );
    expect(streamRegistry.closeSession).toHaveBeenCalledWith(SESSION_ID);
    expect(messageQueueService.enqueue).not.toHaveBeenCalled();
  });
});

// ── sendMessage — SSE setup & edge cases ─────────────────────────────────────

describe('SessionsController — sendMessage SSE setup & edge cases', () => {
  let controller: SessionsController;
  let streamRegistry: any;
  let messageQueueService: any;
  let tenantsService: any;
  let skillsService: any;
  let skillManagementService: any;

  const SESSION_ID = 'test-session-sse';

  beforeEach(async () => {
    streamRegistry = {
      subscribe: jest.fn(),
      emit: jest.fn(),
      closeSession: jest.fn(),
      getEventsSince: jest.fn().mockReturnValue([]),
    };
    messageQueueService = {
      enqueue: jest.fn().mockResolvedValue({ id: 'q1' }),
    };
    tenantsService = { findOne: jest.fn().mockResolvedValue({ id: 'tenant-123' }) };
    skillsService = { findPublished: jest.fn().mockResolvedValue([]) };
    skillManagementService = { generateSystemPromptForSession: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionService, useValue: { getOrCreateSession: jest.fn().mockResolvedValue({ sessionId: 'mock', socket: null }), closeSession: jest.fn() } },
        { provide: SessionsGateway, useValue: { getActiveSubAgents: jest.fn() } },
        { provide: CompletionOrchestrationService, useValue: { orchestrateMessage: jest.fn() } },
        { provide: MessageQueueService, useValue: messageQueueService },
        { provide: SkillManagementService, useValue: skillManagementService },
        { provide: AttachmentService, useValue: { resolveAttachments: jest.fn().mockReturnValue([]) } },
        { provide: SkillSyncService, useValue: {} },
        { provide: SkillsService, useValue: skillsService },
        { provide: SolutionsService, useValue: tenantsService },
        { provide: MessagesService, useValue: {} },
        { provide: ConversationContextService, useValue: {} },
        { provide: StreamRegistryService, useValue: streamRegistry },
        { provide: QuotaService, useValue: { checkQuota: jest.fn().mockResolvedValue({ allowed: true }), getOrCreateQuota: jest.fn() } },
        { provide: QuotaGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: TurnsService, useValue: {} },
        { provide: CliProcessService, useValue: { sendControlResponse: jest.fn() } },
      ],
    })
      .overrideGuard(ApiKeyGuard).useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard).useValue({ canActivate: () => true })
      .overrideGuard(SolutionAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionsController>(SessionsController);
  });

  const mockRes: any = { setHeader: jest.fn(), write: jest.fn(), end: jest.fn() };
  const mockCtx: any = undefined;

  it('subscribes the response to the stream registry before enqueuing', async () => {
    await controller.sendMessage(SESSION_ID, { message: 'hi', solutionId: 'tenant-123' }, mockRes, mockCtx);

    // subscribe must be called first, so the stream is ready before the worker fires
    expect(streamRegistry.subscribe).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String), // subscriberId (uuid)
      mockRes,
    );
    expect(messageQueueService.enqueue).toHaveBeenCalled();
  });

  it('replays buffered events when afterSeq is provided', async () => {
    const buffered = [
      { seq: 5, sessionId: SESSION_ID, timestamp: '', event: { type: 'text_delta' } },
    ];
    streamRegistry.getEventsSince.mockReturnValue(buffered);

    await controller.sendMessage(SESSION_ID, { message: 'hi', solutionId: 'tenant-123', afterSeq: 4 }, mockRes, mockCtx);

    expect(streamRegistry.getEventsSince).toHaveBeenCalledWith(SESSION_ID, 4);
    expect(mockRes.write).toHaveBeenCalledWith(
      expect.stringContaining('"seq":5'),
    );
  });

  it('does not call getEventsSince when afterSeq is undefined', async () => {
    await controller.sendMessage(SESSION_ID, { message: 'hi', solutionId: 'tenant-123' }, mockRes, mockCtx);

    expect(streamRegistry.getEventsSince).not.toHaveBeenCalled();
  });

  it('emits MISSING_TENANT_ID error and closes SSE when solutionId is absent', async () => {
    await controller.sendMessage(SESSION_ID, { message: 'hi' } as any, mockRes, mockCtx);

    expect(streamRegistry.emit).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ code: 'MISSING_TENANT_ID' }),
    );
    expect(streamRegistry.closeSession).toHaveBeenCalledWith(SESSION_ID);
    expect(messageQueueService.enqueue).not.toHaveBeenCalled();
  });

  it('filters out disabled skills from auto-loaded enabledSkills', async () => {
    skillsService.findPublished.mockResolvedValue([
      { slug: 'tutor', enabled: true },
      { slug: 'disabled-skill', enabled: false },
      { slug: 'writer', enabled: true },
    ]);

    await controller.sendMessage(SESSION_ID, { message: 'hi', solutionId: 'tenant-123' }, mockRes, mockCtx);

    expect(messageQueueService.enqueue).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String),
      'tenant-123',
      expect.objectContaining({ enabledSkills: ['tutor', 'writer'] }),
    );
  });

  it('does NOT call findPublished when templateName is provided (defers to orchestration)', async () => {
    const dto: SendMessageDto = {
      message: 'match knowledge points',
      solutionId: 'tenant-123',
      templateName: 'kp-search',
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(skillsService.findPublished).not.toHaveBeenCalled();
    expect(messageQueueService.enqueue).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String),
      'tenant-123',
      expect.objectContaining({ templateName: 'kp-search' }),
    );
  });

  it('calls findPublished when no templateName and no enabledSkills (existing behavior)', async () => {
    skillsService.findPublished.mockResolvedValue([
      { slug: 'tutor', enabled: true },
      { slug: 'writer', enabled: true },
    ]);

    const dto: SendMessageDto = {
      message: 'hello',
      solutionId: 'tenant-123',
    };

    await controller.sendMessage(SESSION_ID, dto, mockRes, mockCtx);

    expect(skillsService.findPublished).toHaveBeenCalledWith('tenant-123');
    expect(messageQueueService.enqueue).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String),
      'tenant-123',
      expect.objectContaining({ enabledSkills: ['tutor', 'writer'] }),
    );
  });

  it('does not modify systemPrompt when appendSystemPrompt is only whitespace', async () => {
    skillsService.findPublished.mockResolvedValue([{ slug: 'tutor', enabled: true }]);
    skillManagementService.generateSystemPromptForSession.mockResolvedValue('Base prompt.');

    await controller.sendMessage(
      SESSION_ID,
      { message: 'hi', solutionId: 'tenant-123', appendSystemPrompt: '   ' },
      mockRes,
      mockCtx,
    );

    expect(messageQueueService.enqueue).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String),
      'tenant-123',
      expect.objectContaining({ systemPrompt: 'Base prompt.' }),
    );
  });

  it('auto-resolves solutionId from API key context when body has no solutionId', async () => {
    const ctxWithTenant: any = { solutionId: 'tenant-from-key' };

    await controller.sendMessage(
      SESSION_ID,
      { message: 'hi' } as any,
      mockRes,
      ctxWithTenant,
    );

    // Should NOT emit MISSING_TENANT_ID error
    expect(streamRegistry.emit).not.toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ code: 'MISSING_TENANT_ID' }),
    );
    // Should call findOne with the auto-resolved solutionId from API key
    expect(tenantsService.findOne).toHaveBeenCalledWith('tenant-from-key');
    // Should enqueue (resolvedTenantId comes from tenant.id returned by mock)
    expect(messageQueueService.enqueue).toHaveBeenCalledWith(
      SESSION_ID,
      expect.any(String),
      'tenant-123', // mock findOne returns { id: 'tenant-123' }
      expect.objectContaining({ message: 'hi' }),
    );
  });
});

// ── Sub-Agents Endpoint ───────────────────────────────────────────────────────

describe('SessionsController - Sub-Agents Endpoint', () => {
  let controller: SessionsController;
  let sessionService: any;
  let sessionsGateway: any;
  let streamRegistry: any;

  const mockSession = {
    id: 'test-session',
    clientId: 'client-1',
    solutionId: 'tenant-1',
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

    sessionsGateway = {
      getActiveSubAgents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionService, useValue: sessionService },
        { provide: SessionsGateway, useValue: sessionsGateway },
        { provide: CompletionOrchestrationService, useValue: {} },
        { provide: MessageQueueService, useValue: {} },
        { provide: SkillManagementService, useValue: {} },
        { provide: AttachmentService, useValue: {} },
        { provide: SkillSyncService, useValue: {} },
        { provide: SkillsService, useValue: {} },
        { provide: SolutionsService, useValue: {} },
        { provide: MessagesService, useValue: {} },
        { provide: ConversationContextService, useValue: {} },
        { provide: StreamRegistryService, useValue: (streamRegistry = { subscribe: jest.fn(), emit: jest.fn(), closeSession: jest.fn(), getEventsSince: jest.fn().mockReturnValue([]), getSubscriberCount: jest.fn().mockReturnValue(0) }) },
        { provide: QuotaService, useValue: { checkQuota: jest.fn().mockResolvedValue({ allowed: true }), getOrCreateQuota: jest.fn() } },
        { provide: QuotaGuard, useValue: { canActivate: jest.fn().mockReturnValue(true) } },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: TurnsService, useValue: {} },
        { provide: CliProcessService, useValue: { sendControlResponse: jest.fn() } },
      ],
    })
      .overrideGuard(ApiKeyGuard).useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard).useValue({ canActivate: () => true })
      .overrideGuard(SolutionAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionsController>(SessionsController);
  });

  describe('GET /sessions/:sessionId/events', () => {
    let mockRes: any;

    beforeEach(() => {
      mockRes = {
        setHeader: jest.fn(),
        flushHeaders: jest.fn(),
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
      };
    });

    it('should throw NotFoundException when session does not exist', async () => {
      sessionService.getSession.mockReturnValue(null);

      await expect(controller.subscribeEvents('future-session', mockRes))
        .rejects.toThrow(NotFoundException);

      expect(streamRegistry.subscribe).not.toHaveBeenCalled();
    });

    it('should subscribe to push channel key for valid session', async () => {
      sessionService.getSession.mockReturnValue(mockSession);

      await controller.subscribeEvents('test-session', mockRes);

      expect(streamRegistry.subscribe).toHaveBeenCalledWith(
        'test-session:push',
        expect.any(String),
        mockRes,
      );
    });

    it('should NOT subscribe to the per-turn channel key', async () => {
      sessionService.getSession.mockReturnValue(mockSession);

      await controller.subscribeEvents('test-session', mockRes);

      // Must use :push key, not plain sessionId (which is the per-turn stream)
      expect(streamRegistry.subscribe).not.toHaveBeenCalledWith(
        'test-session',
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('GET /sessions/:sessionId/sub-agents', () => {
    it('should return active sub-agents for valid session', () => {
      sessionService.getSession.mockReturnValue(mockSession);
      sessionsGateway.getActiveSubAgents.mockReturnValue(mockSubAgents);

      const result = controller.getActiveSubAgents('test-session');

      expect(sessionService.getSession).toHaveBeenCalledWith('test-session');
      expect(sessionsGateway.getActiveSubAgents).toHaveBeenCalledWith('test-session');
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
      sessionsGateway.getActiveSubAgents.mockReturnValue([]);

      const result = controller.getActiveSubAgents('test-session');

      expect(result.activeSubAgents).toEqual([]);
      expect(result.activeSubAgents).toHaveLength(0);
    });

    it('should include timestamp in ISO format', () => {
      sessionService.getSession.mockReturnValue(mockSession);
      sessionsGateway.getActiveSubAgents.mockReturnValue(mockSubAgents);

      const result = controller.getActiveSubAgents('test-session');

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should return sub-agents with all required fields', () => {
      sessionService.getSession.mockReturnValue(mockSession);
      sessionsGateway.getActiveSubAgents.mockReturnValue(mockSubAgents);

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

// ── attach-workspace-source (new) + bind-project (compat alias) ───────────────
//
// β-2 of the α+β refactor (~/.claude/plans/kind-exploring-mango.md):
// the new route calls the canonical service method
// `attachWorkspaceSource(sessionId, solutionId, source)`; the legacy
// `bind-project` route still calls `bindToProject(sessionId, solutionId,
// projectId)` which is now a deprecated delegating alias at the
// service layer. These tests pin the wire contract for both routes;
// the service-level alias equivalence is verified in
// `session.service.attach-workspace-source.spec.ts`.

describe('SessionsController — attach-workspace-source + bind-project alias', () => {
  let controller: SessionsController;
  let sessionService: any;

  const SESSION_ID = 'sess-attach-spec';

  beforeEach(async () => {
    sessionService = {
      attachWorkspaceSource: jest.fn().mockResolvedValue(undefined),
      // Legacy alias still mocked because the old bind-project route
      // calls it directly (the controller doesn't go through the
      // alias chain inside the service — the route handler calls
      // bindToProject; SessionService.bindToProject then delegates).
      bindToProject: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        { provide: SessionService, useValue: sessionService },
        { provide: SessionsGateway, useValue: {} },
        { provide: CompletionOrchestrationService, useValue: {} },
        { provide: MessageQueueService, useValue: {} },
        { provide: SkillManagementService, useValue: {} },
        { provide: AttachmentService, useValue: {} },
        { provide: SkillSyncService, useValue: {} },
        { provide: SkillsService, useValue: {} },
        { provide: SolutionsService, useValue: {} },
        { provide: MessagesService, useValue: {} },
        { provide: ConversationContextService, useValue: {} },
        { provide: StreamRegistryService, useValue: {} },
        { provide: QuotaService, useValue: {} },
        { provide: QuotaGuard, useValue: { canActivate: () => true } },
        { provide: getRepositoryToken(Session), useValue: {} },
        { provide: TurnsService, useValue: {} },
        { provide: CliProcessService, useValue: {} },
      ],
    })
      .overrideGuard(ApiKeyGuard).useValue({ canActivate: () => true })
      .overrideGuard(ScopesGuard).useValue({ canActivate: () => true })
      .overrideGuard(SolutionAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(QuotaGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SessionsController>(SessionsController);
  });

  describe('POST /sessions/:sid/attach-workspace-source (new)', () => {
    it('calls attachWorkspaceSource with the full WorkspaceSource descriptor (β-2: sourceUrl now persisted)', async () => {
      await controller.attachWorkspaceSource(SESSION_ID, {
        sourceUrl: 'http://localhost:3007/api/projects',
        sourceIdentity: 'proj-abc',
        solutionId: 'tenant-1',
      });

      // β-2 contract: the new route threads sourceUrl through to the
      // service. Pre-β-2 this called the legacy bindToProject with
      // just (sessionId, solutionId, projectId) and dropped sourceUrl.
      expect(sessionService.attachWorkspaceSource).toHaveBeenCalledWith(
        SESSION_ID,
        'tenant-1',
        {
          sourceIdentity: 'proj-abc',
          sourceUrl: 'http://localhost:3007/api/projects',
        },
      );
      // Old method is NOT called for the new route — verifies the
      // controller migrated cleanly (no double-call regression).
      expect(sessionService.bindToProject).not.toHaveBeenCalled();
    });

    it('threads sourceSchemaHash into the descriptor when provided', async () => {
      await controller.attachWorkspaceSource(SESSION_ID, {
        sourceUrl: 'http://x',
        sourceIdentity: 'p',
        sourceSchemaHash: 'sha256:abcd',
        solutionId: 't',
      });
      expect(sessionService.attachWorkspaceSource).toHaveBeenCalledWith(
        SESSION_ID,
        't',
        {
          sourceIdentity: 'p',
          sourceUrl: 'http://x',
          sourceSchemaHash: 'sha256:abcd',
        },
      );
    });

    it('echoes the new workspaceSource shape (sourceUrl + sourceIdentity) in the response', async () => {
      const out = await controller.attachWorkspaceSource(SESSION_ID, {
        sourceUrl: 'http://localhost:3007/api/projects',
        sourceIdentity: 'proj-abc',
        solutionId: 'tenant-1',
      });

      expect(out).toEqual({
        success: true,
        sessionId: SESSION_ID,
        workspaceSource: {
          sourceUrl: 'http://localhost:3007/api/projects',
          sourceIdentity: 'proj-abc',
        },
      });
      // No `projectId` in the response — the new route does NOT echo
      // the old field. Solutions that still need projectId in the
      // response should keep calling the deprecated bind-project route.
      expect(out).not.toHaveProperty('projectId');
    });

    it('includes sourceSchemaHash in the response only when provided', async () => {
      const withHash = await controller.attachWorkspaceSource(SESSION_ID, {
        sourceUrl: 'http://x',
        sourceIdentity: 'p',
        sourceSchemaHash: 'sha256:abcd',
        solutionId: 't',
      });
      expect(withHash.workspaceSource.sourceSchemaHash).toBe('sha256:abcd');

      const withoutHash = await controller.attachWorkspaceSource(SESSION_ID, {
        sourceUrl: 'http://x',
        sourceIdentity: 'p',
        solutionId: 't',
      });
      expect(withoutHash.workspaceSource).not.toHaveProperty('sourceSchemaHash');
    });

    it('propagates errors from attachWorkspaceSource (e.g. 409 rebind, 403 cross-tenant)', async () => {
      sessionService.attachWorkspaceSource.mockRejectedValue(new Error('already attached'));
      await expect(
        controller.attachWorkspaceSource(SESSION_ID, {
          sourceUrl: 'http://x',
          sourceIdentity: 'p',
          solutionId: 't',
        }),
      ).rejects.toThrow('already attached');
    });
  });

  describe('POST /sessions/:sid/bind-project (compat alias)', () => {
    it('still calls the legacy bindToProject service method (no migration to the new method yet)', async () => {
      const out = await controller.bindToProject(SESSION_ID, {
        projectId: 'proj-legacy',
        solutionId: 'tenant-1',
      });

      // The old route is supposed to keep calling the deprecated
      // alias method specifically — the alias's job is to delegate to
      // attachWorkspaceSource internally. Calling attachWorkspaceSource
      // directly here would defeat the point of having the alias
      // exercise the delegation path in production.
      expect(sessionService.bindToProject).toHaveBeenCalledWith(
        SESSION_ID,
        'tenant-1',
        'proj-legacy',
      );
      expect(sessionService.attachWorkspaceSource).not.toHaveBeenCalled();
      expect(out).toEqual({
        success: true,
        sessionId: SESSION_ID,
        projectId: 'proj-legacy',
      });
    });
  });
});
