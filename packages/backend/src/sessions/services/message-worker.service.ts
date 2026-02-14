import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MessageQueueService } from './message-queue.service';
import { CompletionOrchestrationService } from './completion-orchestration.service';
import { SessionService } from '../session.service';
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

  constructor(
    private readonly queueService: MessageQueueService,
    private readonly orchestrationService: CompletionOrchestrationService,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Start polling on module initialization
   */
  onModuleInit() {
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
   * Process a single message
   *
   * @param queueItem - Queue item to process
   */
  private async processMessage(queueItem: MessageQueue): Promise<void> {
    this.activeWorkers++;
    this.logger.log(`Processing message ${queueItem.id} (active workers: ${this.activeWorkers}/${this.concurrency})`);

    try {
      // Get session (or create if doesn't exist)
      const session = this.sessionService.getSession(queueItem.sessionId);
      if (!session) {
        throw new Error(`Session ${queueItem.sessionId} not found`);
      }

      // Build orchestration input
      const input = {
        session,
        clientId: queueItem.clientId,
        tenantId: queueItem.tenantId || '', // Convert null to empty string for orchestration
        message: queueItem.payload.message,
        context: queueItem.payload.context,
        mcpServers: queueItem.payload.mcpServers,
        enabledSkillSlugs: queueItem.payload.enabledSkillSlugs,
        skillPath: queueItem.payload.skillPath,
        resumeSession: queueItem.payload.resumeSession,
        emitEvent: (event: any) => {
          // Emit to session socket if connected
          if (session.socket) {
            session.socket.emit(event.type, event);
          }
        },
      };

      // Execute orchestration
      const result = await this.orchestrationService.orchestrateMessage(input);

      // Mark as completed
      await this.queueService.markCompleted(
        queueItem.id,
        result.userMessageId,
        result.assistantMessageId,
      );

      this.logger.log(`Message ${queueItem.id} completed successfully`);
    } catch (error: any) {
      this.logger.error(`Message ${queueItem.id} failed: ${error.message}`, error.stack);

      // Mark as failed (will retry if allowed)
      await this.queueService.markFailed(queueItem.id, error.message);
    } finally {
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
