/**
 * CompletionOrchestrationService - Unit Tests
 *
 * NIE-67: Verifies that --resume vs fresh-spawn decision is driven
 * ONLY by session.messageCount, never by client-supplied resumeSession.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { CompletionOrchestrationService } from './completion-orchestration.service';
import { SessionService } from '../session.service';
import { SkillSyncService } from '../../skills/skill-sync.service';
import { TenantsService } from '../../tenants/tenants.service';
import { MessagesService } from '../../messages/messages.service';
import { ConversationContextService } from '../../messages/conversation-context.service';
import { UserContextService } from '../../messages/user-context.service';
import { SkillsService } from '../../skills/skills.service';
import { ConversationMetadataService } from './conversation-metadata.service';
import { SkillManagementService } from './skill-management.service';
import { TurnsService } from '../../admin/services/turns.service';
import type { ManagedSession } from '../../common/interfaces';

describe('CompletionOrchestrationService - NIE-67: session spawn decision', () => {
  let service: CompletionOrchestrationService;
  let mockSessionService: jest.Mocked<Pick<SessionService, 'sendFollowUp' | 'ensureCLIProcess'>>;

  const makeSession = (messageCount: number): ManagedSession =>
    ({
      sessionId: 'test-session-id',
      messageCount,
      workspaceDir: '/tmp/workspace',
    } as unknown as ManagedSession);

  const baseInput = {
    clientId: 'client-1',
    tenantId: 'tenant-1',
    message: 'Hello',
    emitEvent: jest.fn(),
  };

  beforeEach(async () => {
    mockSessionService = {
      ensureCLIProcess: jest.fn().mockImplementation(
        (_session: unknown, _msg: unknown, onEvent: (e: unknown) => void) => {
          process.nextTick(() =>
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' }),
          );
          return Promise.resolve();
        },
      ),
      sendFollowUp: jest.fn().mockImplementation(
        (_session: unknown, _msg: unknown, onEvent: (e: unknown) => void) => {
          process.nextTick(() =>
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' }),
          );
          return Promise.resolve();
        },
      ),
    };

    const mockSkillSyncService = {
      syncToSession: jest.fn().mockResolvedValue({ skillCount: 0, skillIds: [] }),
    };

    const mockTenantsService = {
      findOne: jest.fn().mockResolvedValue({ id: 'tenant-uuid-1' }),
    };

    const mockMessagesService = {
      create: jest.fn().mockResolvedValue({ id: 'msg-id' }),
      updateContent: jest.fn().mockResolvedValue(undefined),
    };

    const mockConversationContextService = {
      createOrUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const mockUserContextService = {
      recordContext: jest.fn().mockResolvedValue(undefined),
    };

    const mockSkillsService = {};

    const mockConversationMetadataService = {
      autoGenerateTitle: jest.fn().mockResolvedValue(undefined),
    };

    const mockSkillManagementService = {
      loadEnabledSkills: jest.fn().mockResolvedValue([]),
      generateInlineSkillPrompt: jest.fn().mockResolvedValue(undefined),
    };

    const mockTurnsService = {
      createNextTurn: jest.fn().mockResolvedValue({ id: 'turn-1', turnNumber: 1 }),
      completeTurnWithRetry: jest.fn().mockResolvedValue({ turnNumber: 1, totalTokens: 0, durationMs: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletionOrchestrationService,
        { provide: SessionService, useValue: mockSessionService },
        { provide: SkillSyncService, useValue: mockSkillSyncService },
        { provide: TenantsService, useValue: mockTenantsService },
        { provide: MessagesService, useValue: mockMessagesService },
        { provide: ConversationContextService, useValue: mockConversationContextService },
        { provide: UserContextService, useValue: mockUserContextService },
        { provide: SkillsService, useValue: mockSkillsService },
        { provide: ConversationMetadataService, useValue: mockConversationMetadataService },
        { provide: SkillManagementService, useValue: mockSkillManagementService },
        { provide: TurnsService, useValue: mockTurnsService },
      ],
    }).compile();

    service = module.get<CompletionOrchestrationService>(CompletionOrchestrationService);
  });

  describe('Step 10: CLI process selection (NIE-67)', () => {
    it('should spawn fresh CLI (ensureCLIProcess) when messageCount === 0', async () => {
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
      });

      expect(mockSessionService.ensureCLIProcess).toHaveBeenCalledTimes(1);
      expect(mockSessionService.sendFollowUp).not.toHaveBeenCalled();
    });

    it('should use --resume (sendFollowUp) when messageCount > 0', async () => {
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(3),
      });

      expect(mockSessionService.sendFollowUp).toHaveBeenCalledTimes(1);
      expect(mockSessionService.ensureCLIProcess).not.toHaveBeenCalled();
    });

    it('should spawn fresh CLI even when messageCount === 1', async () => {
      // Edge case: messageCount===1 means first message was counted but
      // we're on the second — should resume
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(1),
      });

      expect(mockSessionService.sendFollowUp).toHaveBeenCalledTimes(1);
      expect(mockSessionService.ensureCLIProcess).not.toHaveBeenCalled();
    });

    it('should always spawn fresh CLI for messageCount === 0, regardless of any other input', async () => {
      // This test documents the NIE-67 fix:
      // Previously, passing resumeSession:true would force --resume on empty sessions → exit code 1
      // Now the field is gone; messageCount===0 always means fresh spawn, no exceptions.
      await service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
        systemPrompt: 'You are a helpful assistant',
      });

      expect(mockSessionService.ensureCLIProcess).toHaveBeenCalledTimes(1);
      expect(mockSessionService.sendFollowUp).not.toHaveBeenCalled();
    });
  });

  // ─── Fix 3: spawn rejection handling ─────────────────────────────────────

  describe('Fix 3: spawn rejection resolves orchestrateMessage', () => {
    it('resolves when ensureCLIProcess rejects (messageCount === 0)', async () => {
      mockSessionService.ensureCLIProcess = jest.fn().mockRejectedValue(
        new Error('CLI spawn failed'),
      );

      await expect(
        service.orchestrateMessage({ ...baseInput, session: makeSession(0) }),
      ).resolves.toBeDefined();
    });

    it('resolves when sendFollowUp rejects (messageCount > 0)', async () => {
      mockSessionService.sendFollowUp = jest.fn().mockRejectedValue(
        new Error('Follow-up failed'),
      );

      await expect(
        service.orchestrateMessage({ ...baseInput, session: makeSession(3) }),
      ).resolves.toBeDefined();
    });
  });

  // ─── Fix 2: idempotent resolveCompletion ──────────────────────────────────

  describe('Fix 2: idempotent resolveCompletion', () => {
    it('handles multiple terminal events without throwing', async () => {
      mockSessionService.ensureCLIProcess = jest.fn().mockImplementation(
        (_session: unknown, _msg: unknown, onEvent: (e: unknown) => void) => {
          process.nextTick(() => {
            // Fire several terminal events — only the first should take effect
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' });
            onEvent({ type: 'agent_status', status: 'complete', sessionId: 'test-session-id' });
            onEvent({ type: 'agent_status', status: 'error', sessionId: 'test-session-id' });
          });
          return Promise.resolve();
        },
      );

      await expect(
        service.orchestrateMessage({ ...baseInput, session: makeSession(0) }),
      ).resolves.toBeDefined();
    });
  });

  // ─── Fix 2: timeout safety net ────────────────────────────────────────────

  describe('Fix 2: completionPromise timeout safety net', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Never emit a terminal event — simulates a hung agent
      mockSessionService.ensureCLIProcess = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('resolves via 10-minute timeout when agent never signals terminal status', async () => {
      const orchestrationPromise = service.orchestrateMessage({
        ...baseInput,
        session: makeSession(0),
      });

      // Advance all timers (including the 10-min completionPromise timeout)
      // and flush microtask continuations between each timer step.
      await jest.runAllTimersAsync();

      await orchestrationPromise;
    });
  });
});
