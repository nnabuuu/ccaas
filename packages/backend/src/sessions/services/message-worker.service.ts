import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MessageQueueService } from './message-queue.service';
import { CompletionOrchestrationService } from './completion-orchestration.service';
import { AttachmentService } from './attachment.service';
import { SessionService } from '../session.service';
import { StreamRegistryService } from './stream-registry.service';
import { SessionAssetSyncer } from '../agent-runtime/session-asset-syncer.service';
import { makeSseClientId } from '../session-utils';
import { MessageQueue } from '../entities/message-queue.entity';

/**
 * Message Worker Service
 *
 * Background worker that polls message queue and processes messages.
 *
 * Key Features:
 * - Periodic polling (1000ms interval)
 * - Concurrency control (max 5 concurrent messages across all sessions)
 * - Session-level FIFO enforcement (one message per session at a time)
 * - Automatic retry on failure
 * - Graceful shutdown
 *
 * Lifecycle:
 * 1. onModuleInit() - Start polling
 * 2. pollAndProcess() - Every 1 second
 * 3. For each session with pending messages:
 *    - dequeueForSession() (returns null if session busy)
 *    - processMessage() in background
 * 4. onModuleDestroy() - Stop polling
 *
 * Processing Flow:
 * pending → dequeue → processing → orchestrate → completed/failed
 */
@Injectable()
export class MessageWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessageWorkerService.name);
  private pollTimer: NodeJS.Timeout | null = null;
  private activeWorkers = 0;
  private readonly concurrency = 5; // Max concurrent messages
  private readonly pollIntervalMs = 1000; // Poll every 1 second
  private isShuttingDown = false;
  private readonly activeMessageIds = new Set<string>(); // Track in-flight messages
  private lastStaleCheckAt = 0;
  private readonly staleCheckIntervalMs = 60_000; // Check every 60s
  private readonly runtimeProcessingTimeoutMs = 5 * 60_000; // 5 min runtime timeout

  constructor(
    private readonly queueService: MessageQueueService,
    private readonly orchestrationService: CompletionOrchestrationService,
    private readonly attachmentService: AttachmentService,
    private readonly sessionService: SessionService,
    private readonly streamRegistry: StreamRegistryService,
    // G4 fix: needed to await bootstrap sync BEFORE spawning the engine
    // so the agent's first turn sees a populated artifacts/ directory.
    private readonly assetSyncer: SessionAssetSyncer,
  ) {}

  /**
   * Start polling on module initialization
   */
  async onModuleInit() {
    const resetCount = await this.queueService.resetStaleProcessingMessages();
    if (resetCount > 0) {
      this.logger.warn(`Reset ${resetCount} stale processing messages on startup`);
    }

    this.logger.log(`Starting message worker (poll interval: ${this.pollIntervalMs}ms, concurrency: ${this.concurrency})`);

    this.pollTimer = setInterval(() => {
      this.pollAndProcess().catch((err) => {
        this.logger.error(`Poll error: ${err.message}`, err.stack);
      });
    }, this.pollIntervalMs);
  }

  /**
   * Stop polling on module destruction
   */
  onModuleDestroy() {
    this.logger.log('Stopping message worker');
    this.isShuttingDown = true;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Poll queue and process messages
   *
   * This method runs every 1 second and:
   * 1. Checks if we have available worker slots
   * 2. Gets all sessions with pending messages
   * 3. For each session, tries to dequeue (fails if session busy)
   * 4. Processes message in background
   */
  private async pollAndProcess(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    // Periodic stale message sweep
    const now = Date.now();
    if (now - this.lastStaleCheckAt >= this.staleCheckIntervalMs) {
      this.lastStaleCheckAt = now;
      try {
        const resetCount = await this.queueService.resetStaleProcessingMessages(
          this.runtimeProcessingTimeoutMs,
          this.activeMessageIds,
          'Stale processing message reset by runtime sweep',
        );
        if (resetCount > 0) {
          this.logger.warn(`Stale sweep: reset ${resetCount} processing messages (timeout: ${this.runtimeProcessingTimeoutMs}ms)`);
        }
      } catch (err: any) {
        this.logger.error(`Stale sweep failed: ${err.message}`);
      }
    }

    // Check if we have capacity
    if (this.activeWorkers >= this.concurrency) {
      this.logger.debug(`Worker pool full (${this.activeWorkers}/${this.concurrency})`);
      return;
    }

    // Get all sessions with pending messages
    const sessions = await this.queueService.getSessionsWithPendingMessages();
    if (sessions.length === 0) {
      return;
    }

    this.logger.debug(`Found ${sessions.length} sessions with pending messages`);

    // Try to dequeue and process for each session
    for (const sessionId of sessions) {
      if (this.activeWorkers >= this.concurrency) {
        break;
      }

      const queueItem = await this.queueService.dequeueForSession(sessionId);
      if (!queueItem) {
        // Session is busy or no pending messages
        continue;
      }

      // Process in background (don't await)
      this.processMessage(queueItem).catch((err) => {
        this.logger.error(`Failed to process ${queueItem.id}: ${err.message}`, err.stack);
      });
    }
  }

  /**
   * Process a single message from the queue
   *
   * Uses getOrCreateSession() so a session auto-closed by a prior autoClose=true
   * request is transparently re-created for the next queued request.
   * Events are routed to the SSE stream via StreamRegistryService.
   * The SSE turn stream is closed here (not in the controller).
   */
  private async processMessage(queueItem: MessageQueue): Promise<void> {
    this.activeWorkers++;
    this.activeMessageIds.add(queueItem.id);
    const { sessionId } = queueItem;
    this.logger.log(`Processing message ${queueItem.id} (active workers: ${this.activeWorkers}/${this.concurrency})`);

    try {
      // getOrCreateSession recreates the session if a prior autoClose destroyed it
      const clientId = makeSseClientId(sessionId);
      const userId = queueItem.payload.userId;
      const session = await this.sessionService.getOrCreateSession(sessionId, clientId, null, userId, queueItem.tenantId ?? undefined);

      // G4 fix — synchronous bind + bootstrap before spawning the engine.
      //
      // Without this, the SendMessageDto's optional projectId would
      // only land in session_metadata via the async @OnEvent('session.bound')
      // handler, and the orchestration call below would spawn the agent
      // BEFORE SessionAssetSyncer copied artifacts/ into the workspace.
      // Agent's first turn would `ls artifacts/` and see nothing — the
      // user would have to send a warm-up message to bind the project.
      //
      // We await the syncer directly (not via the event bus) so the
      // ordering is deterministic: when orchestrateMessage runs, the
      // workspace already has the project's artifacts/.
      //
      // Idempotency: if the session is already bound to the same project
      // (subsequent messages in the same conversation), skip entirely —
      // bind/sync are cheap but not free.
      const incomingProjectId = queueItem.payload.projectId;
      // Require tenantId too: attachWorkspaceSource's input validator
      // rejects empty string with BadRequestException — passing `|| ''`
      // would regress the anonymous-session path (queueItem.tenantId
      // can be null for guest mode under AUTH_ALLOW_ANONYMOUS=true).
      // Skip the attach entirely when we don't have an explicit tenant;
      // the agent will run on the materializer-only workspace (still
      // functional, just without per-project artifacts/).
      //
      // β-2 note: worker calls the canonical `attachWorkspaceSource`
      // with a minimal `{sourceIdentity}` descriptor — `sourceUrl` +
      // `sourceSchemaHash` aren't available on `MessageQueue.payload`
      // (the queue carries the legacy `projectId` field). Solutions
      // that need the new fields persisted go through the explicit
      // `attach-workspace-source` HTTP route. β-3 may extend the queue
      // payload if a worker-side use case appears.
      if (incomingProjectId && queueItem.tenantId) {
        const currentBinding =
          this.sessionService.getAttachedWorkspaceSource(sessionId);
        if (currentBinding?.sourceIdentity !== incomingProjectId) {
          await this.sessionService.attachWorkspaceSource(
            sessionId,
            queueItem.tenantId,
            { sourceIdentity: incomingProjectId },
          );
          await this.assetSyncer.sync(sessionId);
        }
      }

      // Resolve attachments from queue payload
      const attachmentInputs = queueItem.payload.attachments ?? queueItem.payload.attachmentPaths?.map(s => JSON.parse(s));
      const attachments = attachmentInputs?.length
        ? this.attachmentService.resolveAttachments(attachmentInputs, session.workspaceDir)
        : undefined;

      // Execute orchestration — events emitted to SSE stream
      const result = await this.orchestrationService.orchestrateMessage({
        session,
        clientId,
        tenantId: queueItem.tenantId || '',
        message: queueItem.payload.message,
        context: queueItem.payload.context,
        enabledSkills: queueItem.payload.enabledSkills ?? (queueItem.payload as any).enabledSkillSlugs,
        systemPrompt: queueItem.payload.systemPrompt,
        templateName: queueItem.payload.templateName,
        emitEvent: (event: any) => this.streamRegistry.emit(sessionId, event),
        attachments,
      });

      // Persist success BEFORE stream teardown: a stream failure must not cause
      // the queue item to be incorrectly marked as failed.
      await this.queueService.markCompleted(
        queueItem.id,
        result.userMessageId,
        result.assistantMessageId,
      );

      // Honour autoClose: free pool slot immediately
      if (queueItem.payload.autoClose) {
        this.logger.log(`Auto-closing session ${sessionId} (autoClose=true)`);
        this.sessionService.closeSession(sessionId);
      }

      // Close only the SSE subscriber for this turn (non-fatal: a stream error
      // must not revert the already-persisted completion). Using closeTurn instead
      // of closeSession prevents killing SSE connections from subsequent messages.
      try {
        const subscriberId = queueItem.payload.subscriberId;
        if (subscriberId) {
          this.streamRegistry.closeTurn(sessionId, subscriberId);
        } else {
          this.streamRegistry.closeSession(sessionId); // fallback for legacy items
        }
      } catch (streamErr: any) {
        this.logger.warn(`Failed to close SSE turn for ${sessionId}: ${streamErr.message}`);
      }

      this.logger.log(`Message ${queueItem.id} completed`);
    } catch (error: any) {
      this.logger.error(`Message ${queueItem.id} failed: ${error.message}`, error.stack);

      // Persist failure BEFORE stream teardown: a stream error must not leave
      // the queue item stuck in 'processing' state.
      try {
        await this.queueService.markFailed(queueItem.id, error.message);
      } catch (markErr: any) {
        this.logger.error(
          `CRITICAL: Failed to mark message ${queueItem.id} as failed: ${markErr.message}. ` +
          `Message may be stuck in processing state — will be recovered by stale message sweep.`,
        );
      }

      // Emit error to SSE and close turn stream (non-fatal)
      try {
        this.streamRegistry.emit(sessionId, {
          type: 'error',
          sessionId,
          timestamp: new Date().toISOString(),
          code: 'PROCESSING_ERROR',
          message: error.message,
          recoverable: false,
        });
        const subscriberId = queueItem.payload.subscriberId;
        if (subscriberId) {
          this.streamRegistry.closeTurn(sessionId, subscriberId);
        } else {
          this.streamRegistry.closeSession(sessionId); // fallback for legacy items
        }
      } catch (streamErr: any) {
        this.logger.warn(`Failed to emit error to SSE for ${sessionId}: ${streamErr.message}`);
      }
    } finally {
      this.activeMessageIds.delete(queueItem.id);
      this.activeWorkers--;
      this.logger.debug(`Worker finished (active workers: ${this.activeWorkers}/${this.concurrency})`);
    }
  }

  /**
   * Get worker status (for monitoring)
   */
  getStatus(): {
    activeWorkers: number;
    concurrency: number;
    pollIntervalMs: number;
    isShuttingDown: boolean;
  } {
    return {
      activeWorkers: this.activeWorkers,
      concurrency: this.concurrency,
      pollIntervalMs: this.pollIntervalMs,
      isShuttingDown: this.isShuttingDown,
    };
  }
}
