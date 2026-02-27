/**
 * StreamRegistry Service
 *
 * Manages SSE (Server-Sent Events) response streams per session.
 * Replaces the session.socket pattern for HTTP streaming transport.
 *
 * Multiple subscribers can attach to a single session stream,
 * enabling reconnection and multiple consumers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { FrontendEvent } from '../../common/interfaces/frontend-event.interface';

export interface StreamSubscriber {
  subscriberId: string;
  sessionId: string;
  res: Response;
  seq: number;
  createdAt: Date;
}

/**
 * Envelope for SSE events with sequence number for reconnection support
 */
export interface StreamEventEnvelope {
  seq: number;
  sessionId: string;
  timestamp: string;
  event: FrontendEvent;
}

/**
 * In-memory buffer of recent events per session (for reconnection)
 * Keeps last N events per session
 */
const EVENT_BUFFER_SIZE = 200;

@Injectable()
export class StreamRegistryService {
  private readonly logger = new Logger(StreamRegistryService.name);

  /**
   * Active SSE subscribers per session
   * sessionId -> Map<subscriberId, StreamSubscriber>
   */
  private subscribers = new Map<string, Map<string, StreamSubscriber>>();

  /**
   * Event sequence number per session
   */
  private sequenceCounters = new Map<string, number>();

  /**
   * Recent event buffer per session for reconnection
   */
  private eventBuffers = new Map<string, StreamEventEnvelope[]>();

  /**
   * Register an SSE response stream for a session
   */
  subscribe(sessionId: string, subscriberId: string, res: Response): void {
    // Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    const subscriber: StreamSubscriber = {
      subscriberId,
      sessionId,
      res,
      seq: 0,
      createdAt: new Date(),
    };

    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Map());
    }
    this.subscribers.get(sessionId)!.set(subscriberId, subscriber);

    this.logger.log(`SSE subscriber registered: session=${sessionId} subscriber=${subscriberId}`);

    // Handle client disconnect
    res.on('close', () => {
      this.unsubscribe(sessionId, subscriberId);
    });
  }

  /**
   * Unsubscribe an SSE connection
   */
  unsubscribe(sessionId: string, subscriberId: string): void {
    const sessionSubscribers = this.subscribers.get(sessionId);
    if (sessionSubscribers) {
      sessionSubscribers.delete(subscriberId);
      if (sessionSubscribers.size === 0) {
        this.subscribers.delete(sessionId);
      }
    }
    this.logger.debug(`SSE subscriber removed: session=${sessionId} subscriber=${subscriberId}`);
  }

  /**
   * Emit an event to all SSE subscribers of a session
   * Also buffers the event for reconnection
   */
  emit(sessionId: string, event: FrontendEvent): void {
    const seq = this.nextSeq(sessionId);
    const envelope: StreamEventEnvelope = {
      seq,
      sessionId,
      timestamp: new Date().toISOString(),
      event,
    };

    // Buffer the event
    this.bufferEvent(sessionId, envelope);

    // Send to all active subscribers
    const sessionSubscribers = this.subscribers.get(sessionId);
    if (!sessionSubscribers || sessionSubscribers.size === 0) {
      // No active SSE connections - event is buffered only
      this.logger.debug(`No SSE subscribers for session ${sessionId}, event buffered`);
      return;
    }

    const sseData = this.formatSSE(envelope);
    const deadSubscribers: string[] = [];

    for (const [subscriberId, subscriber] of sessionSubscribers) {
      try {
        subscriber.res.write(sseData);
        subscriber.seq = seq;
      } catch (err) {
        this.logger.warn(`Failed to write to SSE subscriber ${subscriberId}: ${err}`);
        deadSubscribers.push(subscriberId);
      }
    }

    // Cleanup dead subscribers
    for (const id of deadSubscribers) {
      this.unsubscribe(sessionId, id);
    }
  }

  /**
   * Check if a session has any active SSE subscribers
   */
  hasSubscribers(sessionId: string): boolean {
    const sessionSubscribers = this.subscribers.get(sessionId);
    return !!(sessionSubscribers && sessionSubscribers.size > 0);
  }

  /**
   * Get the number of active subscribers for a session
   */
  getSubscriberCount(sessionId: string): number {
    return this.subscribers.get(sessionId)?.size ?? 0;
  }

  /**
   * Get buffered events since a given sequence number (for reconnection)
   */
  getEventsSince(sessionId: string, afterSeq: number): StreamEventEnvelope[] {
    const buffer = this.eventBuffers.get(sessionId) || [];
    return buffer.filter(e => e.seq > afterSeq);
  }

  /**
   * Close a single SSE subscriber for a session (turn-scoped closure).
   * Only closes the specified subscriber, leaving other subscribers
   * (e.g. from a subsequent message) intact.
   */
  closeTurn(sessionId: string, subscriberId: string): void {
    const sessionSubscribers = this.subscribers.get(sessionId);
    if (!sessionSubscribers) return;

    const subscriber = sessionSubscribers.get(subscriberId);
    if (!subscriber) return;

    const doneEvent: FrontendEvent = {
      type: 'done',
      sessionId,
      timestamp: new Date().toISOString(),
    };

    const sseData = this.formatSSE({
      seq: this.nextSeq(sessionId),
      sessionId,
      timestamp: new Date().toISOString(),
      event: doneEvent,
    });

    try {
      subscriber.res.write(sseData);
      subscriber.res.end();
    } catch {
      // Ignore errors on close
    }

    sessionSubscribers.delete(subscriberId);
    if (sessionSubscribers.size === 0) {
      this.subscribers.delete(sessionId);
    }

    this.logger.debug(`Closed SSE subscriber ${subscriberId} for session ${sessionId}`);
  }

  /**
   * Close all SSE connections for a session (send done event then close)
   */
  closeSession(sessionId: string): void {
    const sessionSubscribers = this.subscribers.get(sessionId);
    if (!sessionSubscribers) return;

    const doneEvent: FrontendEvent = {
      type: 'done',
      sessionId,
      timestamp: new Date().toISOString(),
    };

    const sseData = this.formatSSE({
      seq: this.nextSeq(sessionId),
      sessionId,
      timestamp: new Date().toISOString(),
      event: doneEvent,
    });

    for (const [, subscriber] of sessionSubscribers) {
      try {
        subscriber.res.write(sseData);
        subscriber.res.end();
      } catch {
        // Ignore errors on close
      }
    }

    this.subscribers.delete(sessionId);
    this.logger.debug(`Closed all SSE connections for session ${sessionId}`);
  }

  /**
   * Cleanup all state for a session
   */
  cleanupSession(sessionId: string): void {
    this.closeSession(sessionId);
    this.sequenceCounters.delete(sessionId);
    this.eventBuffers.delete(sessionId);
  }

  /**
   * Format an event envelope as SSE wire format
   */
  private formatSSE(envelope: StreamEventEnvelope): string {
    const data = JSON.stringify(envelope);
    return `id: ${envelope.seq}\ndata: ${data}\n\n`;
  }

  /**
   * Get and increment sequence counter for a session
   */
  private nextSeq(sessionId: string): number {
    const current = this.sequenceCounters.get(sessionId) || 0;
    const next = current + 1;
    this.sequenceCounters.set(sessionId, next);
    return next;
  }

  /**
   * Buffer an event for potential reconnection
   */
  private bufferEvent(sessionId: string, envelope: StreamEventEnvelope): void {
    if (!this.eventBuffers.has(sessionId)) {
      this.eventBuffers.set(sessionId, []);
    }
    const buffer = this.eventBuffers.get(sessionId)!;
    buffer.push(envelope);

    // Trim to max buffer size
    if (buffer.length > EVENT_BUFFER_SIZE) {
      buffer.splice(0, buffer.length - EVENT_BUFFER_SIZE);
    }
  }
}
