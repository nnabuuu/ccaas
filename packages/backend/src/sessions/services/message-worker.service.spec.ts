import { Test, TestingModule } from '@nestjs/testing';
import { MessageWorkerService } from './message-worker.service';
import { MessageQueueService } from './message-queue.service';
import { CompletionOrchestrationService } from './completion-orchestration.service';
import { AttachmentService } from './attachment.service';
import { SessionService } from '../session.service';
import { SessionAssetSyncer } from '../agent-runtime/session-asset-syncer.service';
import { StreamRegistryService } from './stream-registry.service';
import { MessageQueue } from '../entities/message-queue.entity';
import { makeSseClientId } from '../session-utils';

// ── MessageWorkerService ──────────────────────────────────────────────────────

describe('MessageWorkerService — processMessage', () => {
  let service: MessageWorkerService;
  let queueService: any;
  let orchestrationService: any;
  let attachmentService: any;
  let sessionService: any;
  let streamRegistry: any;
  let assetSyncer: { sync: jest.Mock };

  const SESSION_ID = 'worker-test-session';
  const mockSession = {
    sessionId: SESSION_ID,
    clientId: makeSseClientId(SESSION_ID),
    status: 'idle',
    workspaceDir: '/tmp/test',
    socket: null,
  };

  function makeQueueItem(overrides: Partial<MessageQueue> = {}): MessageQueue {
    return {
      id: 'queue-item-1',
      sessionId: SESSION_ID,
      clientId: makeSseClientId(SESSION_ID),
      tenantId: 'tenant-123',
      payload: {
        message: 'test message',
        enabledSkills: ['tutor'],
        systemPrompt: 'You are a tutor.',
        templateName: undefined,
        autoClose: false,
      },
      status: 'processing',
      priority: 0,
      retryCount: 0,
      maxRetries: 2,
      nextRetryAt: null,
      startedAt: new Date(),
      completedAt: null,
      error: null,
      userMessageId: null,
      assistantMessageId: null,
      durationMs: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as MessageQueue;
  }

  beforeEach(async () => {
    queueService = {
      getSessionsWithPendingMessages: jest.fn().mockResolvedValue([]),
      dequeueForSession: jest.fn().mockResolvedValue(null),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      resetStaleProcessingMessages: jest.fn().mockResolvedValue(0),
      getQueueItem: jest.fn().mockResolvedValue(null),
    };

    orchestrationService = {
      orchestrateMessage: jest.fn().mockResolvedValue({
        sessionId: SESSION_ID,
        userMessageId: 'msg-user-1',
        assistantMessageId: 'msg-assistant-1',
        skillSyncedCount: 0,
      }),
    };

    sessionService = {
      getOrCreateSession: jest.fn().mockResolvedValue(mockSession),
      closeSession: jest.fn(),
      // G4 pre-spawn attach helpers. β-2 renamed: worker now calls the
      // canonical `attachWorkspaceSource` + `getAttachedWorkspaceSource`.
      // The legacy `bindToProject` / `getBoundProjectId` mocks are kept
      // here ONLY because earlier tests reference them by name (we'll
      // alias them onto the canonical mocks at use sites). New tests
      // assert against the canonical names.
      getAttachedWorkspaceSource: jest.fn().mockReturnValue(undefined),
      attachWorkspaceSource: jest.fn().mockResolvedValue(undefined),
    };

    streamRegistry = {
      emit: jest.fn(),
      closeSession: jest.fn(),
    };

    attachmentService = {
      resolveAttachments: jest.fn().mockReturnValue(undefined),
    };

    // Hold a reference to the syncer mock so G4 tests can assert on it.
    assetSyncer = { sync: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageWorkerService,
        { provide: MessageQueueService, useValue: queueService },
        { provide: CompletionOrchestrationService, useValue: orchestrationService },
        { provide: AttachmentService, useValue: attachmentService },
        { provide: SessionService, useValue: sessionService },
        { provide: StreamRegistryService, useValue: streamRegistry },
        { provide: SessionAssetSyncer, useValue: assetSyncer },
      ],
    }).compile();

    service = module.get<MessageWorkerService>(MessageWorkerService);
    // Prevent the interval from firing during tests
    jest.spyOn(global, 'setInterval').mockReturnValue(undefined as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Helper: access private processMessage via any cast
  const process = (item: MessageQueue) =>
    (service as any).processMessage(item);

  // ── Session creation ────────────────────────────────────────────────────────

  it('calls getOrCreateSession (not getSession) so auto-closed sessions are recreated', async () => {
    await process(makeQueueItem());

    expect(sessionService.getOrCreateSession).toHaveBeenCalledWith(
      SESSION_ID,
      makeSseClientId(SESSION_ID),
      null,
      undefined,
      'tenant-123',
    );
  });

  // ── SSE emission ────────────────────────────────────────────────────────────

  it('routes orchestration events to streamRegistry.emit()', async () => {
    let capturedEmit: ((event: any) => void) | undefined;

    orchestrationService.orchestrateMessage.mockImplementation((input: any) => {
      capturedEmit = input.emitEvent;
      return Promise.resolve({
        sessionId: SESSION_ID,
        userMessageId: 'u1',
        assistantMessageId: 'a1',
        skillSyncedCount: 0,
      });
    });

    await process(makeQueueItem());

    // Simulate the orchestrator emitting a text_delta event
    capturedEmit!({ type: 'text_delta', delta: 'hi', sessionId: SESSION_ID, timestamp: '' });

    expect(streamRegistry.emit).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ type: 'text_delta' }),
    );
  });

  // ── SSE teardown on success ─────────────────────────────────────────────────

  it('calls streamRegistry.closeSession() after successful orchestration', async () => {
    await process(makeQueueItem());

    expect(streamRegistry.closeSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it('calls markCompleted() after successful orchestration', async () => {
    await process(makeQueueItem());

    expect(queueService.markCompleted).toHaveBeenCalledWith(
      'queue-item-1',
      'msg-user-1',
      'msg-assistant-1',
    );
  });

  // ── autoClose ───────────────────────────────────────────────────────────────

  it('calls sessionService.closeSession() when autoClose=true', async () => {
    await process(makeQueueItem({ payload: { message: 'hi', autoClose: true } }));

    expect(sessionService.closeSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it('does NOT call sessionService.closeSession() when autoClose=false', async () => {
    await process(makeQueueItem({ payload: { message: 'hi', autoClose: false } }));

    expect(sessionService.closeSession).not.toHaveBeenCalled();
  });

  it('does NOT call sessionService.closeSession() when autoClose is absent', async () => {
    await process(makeQueueItem({ payload: { message: 'hi' } }));

    expect(sessionService.closeSession).not.toHaveBeenCalled();
  });

  // ── Error path ──────────────────────────────────────────────────────────────

  it('emits error event to SSE on orchestration failure', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));

    await process(makeQueueItem());

    expect(streamRegistry.emit).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({
        code: 'PROCESSING_ERROR',
        message: 'boom',
        recoverable: false,
      }),
    );
  });

  it('closes SSE turn stream on orchestration failure', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));

    await process(makeQueueItem());

    expect(streamRegistry.closeSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it('calls markFailed() on orchestration failure', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));

    await process(makeQueueItem());

    expect(queueService.markFailed).toHaveBeenCalledWith('queue-item-1', 'boom');
  });

  it('does NOT call sessionService.closeSession() on failure (TTL handles cleanup)', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));

    await process(makeQueueItem({ payload: { message: 'hi', autoClose: true } }));

    // autoClose is in success path only
    expect(sessionService.closeSession).not.toHaveBeenCalled();
  });

  // ── Payload fields passed to orchestrator ───────────────────────────────────

  it('passes systemPrompt and templateName from payload to orchestrateMessage', async () => {
    await process(makeQueueItem({
      payload: {
        message: 'hello',
        systemPrompt: 'You are a helpful tutor.',
        templateName: 'teacher',
      },
    }));

    expect(orchestrationService.orchestrateMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: 'You are a helpful tutor.',
        templateName: 'teacher',
      }),
    );
  });

  // ── Attachment wiring ─────────────────────────────────────────────────────

  it('resolves attachments from payload and passes to orchestrateMessage', async () => {
    const resolvedAttachments = [
      { type: 'image', absolutePath: '/tmp/test/photo.png', mimeType: 'image/png' },
    ];
    attachmentService.resolveAttachments.mockReturnValue(resolvedAttachments);

    await process(makeQueueItem({
      payload: {
        message: 'see attached',
        attachments: [{ type: 'image', path: 'photo.png' }],
      },
    }));

    expect(attachmentService.resolveAttachments).toHaveBeenCalledWith(
      [{ type: 'image', path: 'photo.png' }],
      '/tmp/test', // mockSession.workspaceDir
    );
    expect(orchestrationService.orchestrateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: resolvedAttachments }),
    );
  });

  it('does not call resolveAttachments when attachments is absent', async () => {
    await process(makeQueueItem());

    expect(attachmentService.resolveAttachments).not.toHaveBeenCalled();
  });

  it('passes attachments=undefined to orchestrateMessage when no attachments', async () => {
    await process(makeQueueItem());

    expect(orchestrationService.orchestrateMessage).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: undefined }),
    );
  });

  // ── Ordering: DB writes before stream teardown ──────────────────────────────

  it('calls markCompleted before streamRegistry.closeSession (success path)', async () => {
    const callOrder: string[] = [];
    queueService.markCompleted.mockImplementation(async () => { callOrder.push('markCompleted'); });
    streamRegistry.closeSession.mockImplementation(() => { callOrder.push('closeSession'); });

    await process(makeQueueItem());

    expect(callOrder).toEqual(['markCompleted', 'closeSession']);
  });

  it('calls markFailed before streamRegistry.emit (error path)', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));
    const callOrder: string[] = [];
    queueService.markFailed.mockImplementation(async () => { callOrder.push('markFailed'); });
    streamRegistry.emit.mockImplementation(() => { callOrder.push('streamEmit'); });

    await process(makeQueueItem());

    expect(callOrder[0]).toBe('markFailed');
    expect(callOrder[1]).toBe('streamEmit');
  });

  it('still calls markCompleted even when streamRegistry.closeSession throws', async () => {
    streamRegistry.closeSession.mockImplementation(() => { throw new Error('stream error'); });

    await process(makeQueueItem());

    expect(queueService.markCompleted).toHaveBeenCalledWith('queue-item-1', 'msg-user-1', 'msg-assistant-1');
    expect(queueService.markFailed).not.toHaveBeenCalled();
  });

  it('still calls markFailed even when streamRegistry.emit throws', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));
    streamRegistry.emit.mockImplementation(() => { throw new Error('stream error'); });

    await process(makeQueueItem());

    expect(queueService.markFailed).toHaveBeenCalledWith('queue-item-1', 'boom');
  });

  // ── Double failure: markFailed also throws ────────────────────────────────

  it('does not throw when both orchestration and markFailed fail (double failure)', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));
    queueService.markFailed.mockRejectedValue(new Error('DB unavailable'));

    // Should NOT throw — the error is caught and logged
    await expect(process(makeQueueItem())).resolves.toBeUndefined();
  });

  it('still emits SSE error event even when markFailed throws', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));
    queueService.markFailed.mockRejectedValue(new Error('DB unavailable'));

    await process(makeQueueItem());

    expect(streamRegistry.emit).toHaveBeenCalledWith(
      SESSION_ID,
      expect.objectContaining({ code: 'PROCESSING_ERROR', message: 'boom' }),
    );
  });

  // ── activeWorkers counter ───────────────────────────────────────────────────

  it('decrements activeWorkers in finally block even when orchestration throws', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));

    const before = (service as any).activeWorkers;
    await process(makeQueueItem());

    expect((service as any).activeWorkers).toBe(before);
  });

  it('decrements activeWorkers in finally block after success', async () => {
    const before = (service as any).activeWorkers;
    await process(makeQueueItem());

    expect((service as any).activeWorkers).toBe(before);
  });

  // ── activeMessageIds tracking ─────────────────────────────────────────────

  it('adds message ID to activeMessageIds during processing and removes after', async () => {
    const ids = (service as any).activeMessageIds as Set<string>;
    let capturedDuringProcessing = false;

    orchestrationService.orchestrateMessage.mockImplementation(async () => {
      capturedDuringProcessing = ids.has('queue-item-1');
      return { sessionId: SESSION_ID, userMessageId: 'u1', assistantMessageId: 'a1', skillSyncedCount: 0 };
    });

    await process(makeQueueItem());

    expect(capturedDuringProcessing).toBe(true);
    expect(ids.has('queue-item-1')).toBe(false);
  });

  it('removes message ID from activeMessageIds even on failure', async () => {
    orchestrationService.orchestrateMessage.mockRejectedValue(new Error('boom'));

    await process(makeQueueItem());

    expect((service as any).activeMessageIds.has('queue-item-1')).toBe(false);
  });

  // ── G4: attach + sync before engine spawn ─────────────────────────────────
  //
  // These tests pin the load-bearing ordering for the agent-runtime
  // first-turn flow. Without them, refactors could easily reintroduce
  // the race where the engine spawns on an empty workspace because
  // attachWorkspaceSource's @OnEvent listener hasn't finished its
  // bootstrap sync. The wire is: getOrCreateSession → attach → sync
  // → orchestrate.
  //
  // β-2 renamed the service methods; the worker now calls
  // `attachWorkspaceSource` + `getAttachedWorkspaceSource`. Tests
  // assert against those canonical names.

  describe('G4 — attach + sync before orchestrateMessage', () => {
    const PROJECT_ID = 'proj-abc';

    it('calls attachWorkspaceSource + sync BEFORE orchestrateMessage when payload has projectId', async () => {
      // Track call order across the three mocks. We don't pin the
      // exact orchestrate args (other tests cover that) — just the
      // before/after relationship.
      const order: string[] = [];
      sessionService.attachWorkspaceSource.mockImplementation(async () => { order.push('attach'); });
      assetSyncer.sync.mockImplementation(async () => { order.push('sync'); });
      orchestrationService.orchestrateMessage.mockImplementation(async () => {
        order.push('orchestrate');
        return { sessionId: SESSION_ID, userMessageId: 'u', assistantMessageId: 'a', skillSyncedCount: 0 };
      });

      await process(makeQueueItem({ payload: { message: 'hi', projectId: PROJECT_ID } as any }));

      expect(order).toEqual(['attach', 'sync', 'orchestrate']);
    });

    it('passes tenantId + minimal WorkspaceSource (sourceIdentity only) to attachWorkspaceSource', async () => {
      await process(makeQueueItem({ tenantId: 'tenant-xyz', payload: { message: 'hi', projectId: PROJECT_ID } as any }));

      // Queue payload doesn't carry sourceUrl / sourceSchemaHash; worker
      // only knows the identity. Solutions that need the URL persisted
      // go through the explicit attach-workspace-source HTTP route.
      expect(sessionService.attachWorkspaceSource).toHaveBeenCalledWith(
        SESSION_ID,
        'tenant-xyz',
        { sourceIdentity: PROJECT_ID },
      );
    });

    it('skips attach + sync when payload has no projectId (back-compat)', async () => {
      await process(makeQueueItem()); // default payload has no projectId

      expect(sessionService.attachWorkspaceSource).not.toHaveBeenCalled();
      expect(assetSyncer.sync).not.toHaveBeenCalled();
      // Orchestration still runs.
      expect(orchestrationService.orchestrateMessage).toHaveBeenCalled();
    });

    it('skips attach + sync when session is already attached to the same sourceIdentity (idempotent re-send)', async () => {
      sessionService.getAttachedWorkspaceSource.mockReturnValue({
        sourceIdentity: PROJECT_ID,
      });

      await process(makeQueueItem({ payload: { message: 'hi', projectId: PROJECT_ID } as any }));

      expect(sessionService.attachWorkspaceSource).not.toHaveBeenCalled();
      expect(assetSyncer.sync).not.toHaveBeenCalled();
    });

    it('still attaches when session is attached to a DIFFERENT sourceIdentity (lets attachWorkspaceSource decide the policy)', async () => {
      sessionService.getAttachedWorkspaceSource.mockReturnValue({
        sourceIdentity: 'proj-old',
      });

      await process(makeQueueItem({ payload: { message: 'hi', projectId: PROJECT_ID } as any }));

      // Worker forwards the attach; attachWorkspaceSource's
      // 409-on-rebind guard is its own concern, tested separately in
      // session.service.attach-workspace-source.spec.ts.
      expect(sessionService.attachWorkspaceSource).toHaveBeenCalledWith(
        SESSION_ID,
        'tenant-123',
        { sourceIdentity: PROJECT_ID },
      );
    });

    it('skips attach when projectId is set but tenantId is missing (anonymous-session regression guard)', async () => {
      // Anonymous sessions can land here without a tenantId.
      // attachWorkspaceSource would 400 on empty-string tenantId; the
      // worker MUST skip the attach in that case rather than fail the
      // message. This guard is load-bearing — was missed in initial G4
      // fix and caught in review.
      await process(makeQueueItem({ tenantId: null as any, payload: { message: 'hi', projectId: PROJECT_ID } as any }));

      expect(sessionService.attachWorkspaceSource).not.toHaveBeenCalled();
      expect(assetSyncer.sync).not.toHaveBeenCalled();
      // Orchestration still runs — agent will just see an unattached workspace.
      expect(orchestrationService.orchestrateMessage).toHaveBeenCalled();
    });

    it('propagates sync failures as message failures (does not silently swallow)', async () => {
      assetSyncer.sync.mockRejectedValueOnce(new Error('artifact source unreachable'));

      await process(makeQueueItem({ payload: { message: 'hi', projectId: PROJECT_ID } as any }));

      // Message gets marked failed via the outer try/catch — same path
      // any other processing error takes.
      expect(queueService.markFailed).toHaveBeenCalled();
      // Orchestration must NOT have run with an empty workspace.
      expect(orchestrationService.orchestrateMessage).not.toHaveBeenCalled();
    });
  });
});

// ── pollAndProcess ────────────────────────────────────────────────────────────

describe('MessageWorkerService — pollAndProcess', () => {
  let service: MessageWorkerService;
  let queueService: any;
  let sessionService: any;
  let streamRegistry: any;

  const SESSION_ID = 'poll-test-session';

  function makeItem(id = 'qi-1', sessionId = SESSION_ID): MessageQueue {
    return {
      id,
      sessionId,
      clientId: makeSseClientId(sessionId),
      tenantId: 'tenant-1',
      payload: { message: 'hi' },
      status: 'processing',
      priority: 0,
      retryCount: 0,
      maxRetries: 2,
      nextRetryAt: null,
      startedAt: new Date(),
      completedAt: null,
      error: null,
      userMessageId: null,
      assistantMessageId: null,
      durationMs: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as MessageQueue;
  }

  beforeEach(async () => {
    queueService = {
      getSessionsWithPendingMessages: jest.fn().mockResolvedValue([]),
      dequeueForSession: jest.fn().mockResolvedValue(null),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      resetStaleProcessingMessages: jest.fn().mockResolvedValue(0),
    };

    const orchestrationService = {
      orchestrateMessage: jest.fn().mockResolvedValue({
        sessionId: SESSION_ID,
        userMessageId: 'u1',
        assistantMessageId: 'a1',
        skillSyncedCount: 0,
      }),
    };

    sessionService = {
      getOrCreateSession: jest.fn().mockResolvedValue({ sessionId: SESSION_ID, socket: null, workspaceDir: '/tmp' }),
      closeSession: jest.fn(),
    };

    streamRegistry = { emit: jest.fn(), closeSession: jest.fn() };

    jest.spyOn(global, 'setInterval').mockReturnValue(undefined as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageWorkerService,
        { provide: MessageQueueService, useValue: queueService },
        { provide: CompletionOrchestrationService, useValue: orchestrationService },
        { provide: AttachmentService, useValue: { resolveAttachments: jest.fn().mockReturnValue(undefined) } },
        { provide: SessionService, useValue: sessionService },
        { provide: StreamRegistryService, useValue: streamRegistry },
        { provide: SessionAssetSyncer, useValue: { sync: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<MessageWorkerService>(MessageWorkerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const poll = () => (service as any).pollAndProcess();

  it('does nothing when isShuttingDown is true', async () => {
    (service as any).isShuttingDown = true;
    queueService.getSessionsWithPendingMessages.mockResolvedValue([SESSION_ID]);

    await poll();

    expect(queueService.getSessionsWithPendingMessages).not.toHaveBeenCalled();
  });

  it('does nothing when worker pool is at capacity', async () => {
    (service as any).activeWorkers = (service as any).concurrency; // fill pool
    queueService.getSessionsWithPendingMessages.mockResolvedValue([SESSION_ID]);

    await poll();

    expect(queueService.getSessionsWithPendingMessages).not.toHaveBeenCalled();
  });

  it('returns early when no sessions have pending messages', async () => {
    queueService.getSessionsWithPendingMessages.mockResolvedValue([]);

    await poll();

    expect(queueService.dequeueForSession).not.toHaveBeenCalled();
  });

  it('skips a busy session when dequeue returns null and continues to next', async () => {
    const busySession = 'session-busy';
    const readySession = 'session-ready';
    queueService.getSessionsWithPendingMessages.mockResolvedValue([busySession, readySession]);
    queueService.dequeueForSession
      .mockResolvedValueOnce(null)              // busy session
      .mockResolvedValueOnce(makeItem('qi-2', readySession));

    jest.spyOn(service as any, 'processMessage').mockResolvedValue(undefined);

    await poll();

    expect(queueService.dequeueForSession).toHaveBeenCalledTimes(2);
    expect((service as any).processMessage).toHaveBeenCalledTimes(1);
    expect((service as any).processMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'qi-2' }),
    );
  });

  it('dispatches one item per session in a single poll cycle', async () => {
    queueService.getSessionsWithPendingMessages.mockResolvedValue(['s1', 's2', 's3']);
    queueService.dequeueForSession
      .mockResolvedValueOnce(makeItem('q1', 's1'))
      .mockResolvedValueOnce(makeItem('q2', 's2'))
      .mockResolvedValueOnce(makeItem('q3', 's3'));

    jest.spyOn(service as any, 'processMessage').mockResolvedValue(undefined);

    await poll();

    expect((service as any).processMessage).toHaveBeenCalledTimes(3);
  });

  it('stops dispatching when concurrency fills during the loop', async () => {
    (service as any).activeWorkers = (service as any).concurrency - 1; // one slot left
    queueService.getSessionsWithPendingMessages.mockResolvedValue(['s1', 's2']);
    queueService.dequeueForSession
      .mockResolvedValueOnce(makeItem('q1', 's1'))
      .mockResolvedValueOnce(makeItem('q2', 's2'));

    // processMessage increments activeWorkers synchronously (at start of method)
    jest.spyOn(service as any, 'processMessage').mockImplementation(async () => {
      (service as any).activeWorkers++;
    });

    await poll();

    // Only one slot was available so only one session should be dispatched
    expect((service as any).processMessage).toHaveBeenCalledTimes(1);
  });

  // ── Stale message sweep ─────────────────────────────────────────────────────

  it('runs stale sweep on first poll with activeMessageIds and reason', async () => {
    await poll();

    expect(queueService.resetStaleProcessingMessages).toHaveBeenCalledWith(
      (service as any).runtimeProcessingTimeoutMs,
      (service as any).activeMessageIds,
      'Stale processing message reset by runtime sweep',
    );
  });

  it('does not run stale sweep again before staleCheckIntervalMs elapses', async () => {
    await poll(); // first call — triggers sweep
    queueService.resetStaleProcessingMessages.mockClear();

    await poll(); // second call immediately — should NOT trigger sweep

    expect(queueService.resetStaleProcessingMessages).not.toHaveBeenCalled();
  });

  it('continues processing even when stale sweep throws', async () => {
    queueService.resetStaleProcessingMessages.mockRejectedValue(new Error('DB error'));
    queueService.getSessionsWithPendingMessages.mockResolvedValue(['s1']);
    queueService.dequeueForSession.mockResolvedValueOnce(makeItem('q1', 's1'));
    jest.spyOn(service as any, 'processMessage').mockResolvedValue(undefined);

    await poll();

    // Despite sweep failure, processing should continue
    expect((service as any).processMessage).toHaveBeenCalledTimes(1);
  });
});

// ── lifecycle ─────────────────────────────────────────────────────────────────

describe('MessageWorkerService — lifecycle', () => {
  let module: TestingModule;
  let service: MessageWorkerService;

  beforeEach(async () => {
    const queueService = {
      getSessionsWithPendingMessages: jest.fn().mockResolvedValue([]),
      resetStaleProcessingMessages: jest.fn().mockResolvedValue(0),
    };
    const orchestrationService = { orchestrateMessage: jest.fn() };
    const sessionService = { getOrCreateSession: jest.fn().mockResolvedValue({ sessionId: 'mock', socket: null }), closeSession: jest.fn() };
    const streamRegistry = { emit: jest.fn(), closeSession: jest.fn() };

    module = await Test.createTestingModule({
      providers: [
        MessageWorkerService,
        { provide: MessageQueueService, useValue: queueService },
        { provide: CompletionOrchestrationService, useValue: orchestrationService },
        { provide: AttachmentService, useValue: { resolveAttachments: jest.fn().mockReturnValue(undefined) } },
        { provide: SessionService, useValue: sessionService },
        { provide: StreamRegistryService, useValue: streamRegistry },
        { provide: SessionAssetSyncer, useValue: { sync: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<MessageWorkerService>(MessageWorkerService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('onModuleInit starts a poll interval at 1000 ms', async () => {
    const spy = jest.spyOn(global, 'setInterval').mockReturnValue(999 as any);

    await service.onModuleInit();

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect((service as any).pollTimer).toBe(999);
  });

  it('onModuleDestroy clears the timer and sets isShuttingDown', async () => {
    jest.spyOn(global, 'setInterval').mockReturnValue(42 as any);
    await service.onModuleInit();

    const clearSpy = jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
    service.onModuleDestroy();

    expect(clearSpy).toHaveBeenCalledWith(42);
    expect((service as any).pollTimer).toBeNull();
    expect((service as any).isShuttingDown).toBe(true);
  });
});

// ── getStatus ─────────────────────────────────────────────────────────────────

describe('MessageWorkerService — getStatus', () => {
  let service: MessageWorkerService;

  beforeEach(async () => {
    jest.spyOn(global, 'setInterval').mockReturnValue(undefined as any);

    const module = await Test.createTestingModule({
      providers: [
        MessageWorkerService,
        { provide: MessageQueueService, useValue: { getSessionsWithPendingMessages: jest.fn().mockResolvedValue([]), resetStaleProcessingMessages: jest.fn().mockResolvedValue(0) } },
        { provide: CompletionOrchestrationService, useValue: {} },
        { provide: AttachmentService, useValue: { resolveAttachments: jest.fn().mockReturnValue(undefined) } },
        { provide: SessionService, useValue: {} },
        { provide: StreamRegistryService, useValue: {} },
        { provide: SessionAssetSyncer, useValue: { sync: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<MessageWorkerService>(MessageWorkerService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns correct status fields with initial values', () => {
    const status = service.getStatus();

    expect(status).toEqual({
      activeWorkers: 0,
      concurrency: 5,
      pollIntervalMs: 1000,
      isShuttingDown: false,
    });
  });
});
