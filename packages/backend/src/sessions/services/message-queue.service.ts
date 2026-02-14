import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, IsNull } from 'typeorm';
import { MessageQueue, MessageQueuePayload, MessageQueueStatus } from '../entities/message-queue.entity';

/**
 * Message Queue Service
 *
 * Manages database-backed FIFO message queue per session.
 * Prevents race conditions via row-level pessimistic locking.
 *
 * Key Methods:
 * - enqueue() - Add message to queue
 * - dequeueForSession() - Get next message with locking
 * - markCompleted() - Mark success
 * - markFailed() - Mark failure and schedule retry
 *
 * Concurrency Control:
 * - Only one message per session can be in 'processing' status
 * - dequeueForSession() checks processing count before dequeue
 * - Pessimistic write lock prevents concurrent dequeue
 */
@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);

  constructor(
    @InjectRepository(MessageQueue)
    private readonly queueRepository: Repository<MessageQueue>,
  ) {}

  /**
   * Enqueue a new message for processing
   *
   * This is the ONLY entry point for message processing.
   * All chat messages must be enqueued (not directly orchestrated).
   *
   * @param sessionId - Session identifier (FIFO key)
   * @param clientId - Client identifier
   * @param tenantId - Tenant identifier (nullable)
   * @param payload - Message payload
   * @param priority - Priority (default: 0, higher = process first)
   * @returns Created queue item
   */
  async enqueue(
    sessionId: string,
    clientId: string,
    tenantId: string | null,
    payload: MessageQueuePayload,
    priority: number = 0,
  ): Promise<MessageQueue> {
    const queueItem = this.queueRepository.create({
      sessionId,
      clientId,
      tenantId,
      payload,
      status: 'pending',
      priority,
      retryCount: 0,
      maxRetries: 2,
    });

    const saved = await this.queueRepository.save(queueItem);
    this.logger.log(`Enqueued message ${saved.id} for session ${sessionId}`);

    return saved;
  }

  /**
   * Dequeue next message for a session (FIFO with locking)
   *
   * Enforces concurrency control:
   * 1. Check if session has processing message (if yes, return null)
   * 2. Get oldest pending message (FIFO by createdAt, priority secondary)
   * 3. Acquire row-level lock (pessimistic_write)
   * 4. Mark as 'processing'
   *
   * @param sessionId - Session identifier
   * @returns Queue item or null if session busy or no pending messages
   */
  async dequeueForSession(sessionId: string): Promise<MessageQueue | null> {
    // Check if session already has a processing message
    const processingCount = await this.queueRepository.count({
      where: {
        sessionId,
        status: 'processing',
      },
    });

    if (processingCount > 0) {
      this.logger.debug(`Session ${sessionId} is busy (processing message exists)`);
      return null;
    }

    // Get oldest pending message with row-level lock
    const queueItem = await this.queueRepository
      .createQueryBuilder('queue')
      .where('queue.sessionId = :sessionId', { sessionId })
      .andWhere('queue.status = :status', { status: 'pending' })
      .andWhere(
        '(queue.nextRetryAt IS NULL OR queue.nextRetryAt <= :now)',
        { now: new Date() },
      )
      .orderBy('queue.priority', 'DESC')
      .addOrderBy('queue.createdAt', 'ASC') // FIFO
      .setLock('pessimistic_write') // Row-level lock prevents race
      .getOne();

    if (!queueItem) {
      this.logger.debug(`No pending messages for session ${sessionId}`);
      return null;
    }

    // Mark as processing
    queueItem.status = 'processing';
    queueItem.startedAt = new Date();
    await this.queueRepository.save(queueItem);

    this.logger.log(`Dequeued message ${queueItem.id} for session ${sessionId}`);
    return queueItem;
  }

  /**
   * Mark message as completed
   *
   * @param queueItemId - Queue item ID
   * @param userMessageId - Created user message ID
   * @param assistantMessageId - Created assistant message ID
   */
  async markCompleted(
    queueItemId: string,
    userMessageId: string,
    assistantMessageId: string,
  ): Promise<void> {
    const queueItem = await this.queueRepository.findOneBy({ id: queueItemId });
    if (!queueItem) {
      this.logger.warn(`Queue item ${queueItemId} not found`);
      return;
    }

    queueItem.status = 'completed';
    queueItem.completedAt = new Date();
    queueItem.userMessageId = userMessageId;
    queueItem.assistantMessageId = assistantMessageId;

    if (queueItem.startedAt) {
      queueItem.durationMs = Date.now() - queueItem.startedAt.getTime();
    }

    await this.queueRepository.save(queueItem);
    this.logger.log(`Message ${queueItemId} marked as completed (duration: ${queueItem.durationMs}ms)`);
  }

  /**
   * Mark message as failed and schedule retry if allowed
   *
   * Implements exponential backoff:
   * - Retry 1: 1 second delay
   * - Retry 2: 2 seconds delay
   * - Retry 3: 4 seconds delay
   * - Max delay: 30 seconds
   *
   * @param queueItemId - Queue item ID
   * @param error - Error message
   */
  async markFailed(queueItemId: string, error: string): Promise<void> {
    const queueItem = await this.queueRepository.findOneBy({ id: queueItemId });
    if (!queueItem) {
      this.logger.warn(`Queue item ${queueItemId} not found`);
      return;
    }

    queueItem.retryCount++;
    queueItem.error = error;

    if (queueItem.retryCount <= queueItem.maxRetries) {
      // Exponential backoff: 1s, 2s, 4s (max 30s)
      const delayMs = Math.min(1000 * Math.pow(2, queueItem.retryCount - 1), 30000);
      queueItem.status = 'pending';
      queueItem.nextRetryAt = new Date(Date.now() + delayMs);
      queueItem.startedAt = null;

      this.logger.log(
        `Message ${queueItemId} will retry in ${delayMs}ms (attempt ${queueItem.retryCount}/${queueItem.maxRetries})`,
      );
    } else {
      // Max retries exceeded, mark as permanently failed
      queueItem.status = 'failed';
      queueItem.completedAt = new Date();

      this.logger.error(
        `Message ${queueItemId} permanently failed after ${queueItem.retryCount} attempts: ${error}`,
      );
    }

    await this.queueRepository.save(queueItem);
  }

  /**
   * Cancel all pending messages for a session
   *
   * Used when user clicks "Cancel" button.
   * Does NOT cancel currently processing message (handled by CLI process kill).
   *
   * @param sessionId - Session identifier
   * @returns Number of cancelled messages
   */
  async cancelSessionMessages(sessionId: string): Promise<number> {
    const result = await this.queueRepository.update(
      {
        sessionId,
        status: 'pending',
      },
      {
        status: 'cancelled',
        completedAt: new Date(),
        error: 'Cancelled by user',
      },
    );

    const cancelledCount = result.affected || 0;
    if (cancelledCount > 0) {
      this.logger.log(`Cancelled ${cancelledCount} pending messages for session ${sessionId}`);
    }

    return cancelledCount;
  }

  /**
   * Get a single queue item by ID
   *
   * @param queueItemId - Queue item ID
   * @returns Queue item or null if not found
   */
  async getQueueItem(queueItemId: string): Promise<MessageQueue | null> {
    return this.queueRepository.findOneBy({ id: queueItemId });
  }

  /**
   * Get queue depth for a session
   *
   * @param sessionId - Session identifier
   * @returns Queue depth statistics
   */
  async getSessionQueueDepth(sessionId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
  }> {
    const [pending, processing] = await Promise.all([
      this.queueRepository.count({
        where: { sessionId, status: 'pending' },
      }),
      this.queueRepository.count({
        where: { sessionId, status: 'processing' },
      }),
    ]);

    return {
      total: pending + processing,
      pending,
      processing,
    };
  }

  /**
   * Get all queue items for a session
   *
   * @param sessionId - Session identifier
   * @param includeCompleted - Include completed/failed items (default: false)
   * @returns Array of queue items
   */
  async getSessionQueue(
    sessionId: string,
    includeCompleted: boolean = false,
  ): Promise<MessageQueue[]> {
    const queryBuilder = this.queueRepository
      .createQueryBuilder('queue')
      .where('queue.sessionId = :sessionId', { sessionId });

    if (!includeCompleted) {
      queryBuilder.andWhere('queue.status IN (:...statuses)', {
        statuses: ['pending', 'processing'],
      });
    }

    return queryBuilder
      .orderBy('queue.priority', 'DESC')
      .addOrderBy('queue.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Get all sessions with pending messages
   *
   * Used by worker to discover sessions to process.
   *
   * @returns Array of session IDs
   */
  async getSessionsWithPendingMessages(): Promise<string[]> {
    const results = await this.queueRepository
      .createQueryBuilder('queue')
      .select('DISTINCT queue.sessionId', 'sessionId')
      .where('queue.status = :status', { status: 'pending' })
      .andWhere(
        '(queue.nextRetryAt IS NULL OR queue.nextRetryAt <= :now)',
        { now: new Date() },
      )
      .getRawMany<{ sessionId: string }>();

    return results.map((r) => r.sessionId);
  }

  /**
   * Get queue statistics for monitoring
   *
   * @param tenantId - Optional tenant filter
   * @returns Queue statistics
   */
  async getQueueStats(tenantId?: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const where = tenantId ? { tenantId } : {};

    const [pending, processing, completed, failed, cancelled] = await Promise.all([
      this.queueRepository.count({ where: { ...where, status: 'pending' } }),
      this.queueRepository.count({ where: { ...where, status: 'processing' } }),
      this.queueRepository.count({ where: { ...where, status: 'completed' } }),
      this.queueRepository.count({ where: { ...where, status: 'failed' } }),
      this.queueRepository.count({ where: { ...where, status: 'cancelled' } }),
    ]);

    return { pending, processing, completed, failed, cancelled };
  }

  /**
   * Clean up old completed/failed/cancelled messages
   *
   * Should be called periodically (e.g., daily cron job).
   *
   * @param olderThanDays - Delete messages older than this (default: 7 days)
   * @returns Number of deleted messages
   */
  async cleanupOldMessages(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.queueRepository
      .createQueryBuilder()
      .delete()
      .where('status IN (:...statuses)', {
        statuses: ['completed', 'failed', 'cancelled'],
      })
      .andWhere('completedAt < :cutoffDate', { cutoffDate })
      .execute();

    const deletedCount = result.affected || 0;
    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} messages older than ${olderThanDays} days`);
    }

    return deletedCount;
  }
}
