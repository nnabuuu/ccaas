import { Injectable, Inject } from '@nestjs/common';
import type { Response } from 'express';
import { RunEventStreamRegistry } from '../core/event-stream.js';
import { HARNESS_EVENT_STREAM_REGISTRY } from './harness.constants.js';

const HEARTBEAT_INTERVAL_MS = 30_000;

@Injectable()
export class HarnessStreamService {
  constructor(
    @Inject(HARNESS_EVENT_STREAM_REGISTRY)
    private readonly registry: RunEventStreamRegistry,
  ) {}

  /**
   * Stream SSE events for a run to an HTTP response.
   * Replays buffered events if lastSeq is provided (reconnection).
   */
  streamEvents(runId: string, res: Response, lastSeq?: number): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const stream = this.registry.getOrCreate(runId);
    const subscriberId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Replay buffered events for reconnection
    if (lastSeq != null && lastSeq > 0) {
      const buffered = stream.getBufferedEvents(lastSeq);
      for (const envelope of buffered) {
        res.write(`id: ${envelope.seq}\ndata: ${JSON.stringify(envelope)}\n\n`);
      }
    }

    // Subscribe to live events
    const unsubscribe = stream.subscribe(subscriberId, (envelope) => {
      res.write(`id: ${envelope.seq}\ndata: ${JSON.stringify(envelope)}\n\n`);
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, HEARTBEAT_INTERVAL_MS);

    // Cleanup on close
    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    res.on('close', cleanup);
    res.on('error', cleanup);
  }
}
