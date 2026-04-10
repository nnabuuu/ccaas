import type { HarnessEvent, HarnessEventEmitter } from './interfaces.js';

const MAX_BUFFER_SIZE = 200;

export interface HarnessEventEnvelope {
  seq: number;
  runId: string;
  timestamp: string;
  event: HarnessEvent;
}

type EventCallback = (envelope: HarnessEventEnvelope) => void;

/**
 * Per-run event stream with subscriber management and ring buffer.
 */
export class RunEventStream implements HarnessEventEmitter {
  private subscribers = new Map<string, EventCallback>();
  private buffer: HarnessEventEnvelope[] = [];
  private seq = 0;

  constructor(private readonly runId: string) {}

  emit(event: HarnessEvent): void {
    const envelope: HarnessEventEnvelope = {
      seq: ++this.seq,
      runId: this.runId,
      timestamp: new Date().toISOString(),
      event,
    };

    // Ring buffer: drop oldest when full
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
    this.buffer.push(envelope);

    for (const cb of this.subscribers.values()) {
      try {
        cb(envelope);
      } catch {
        // subscriber errors must not break emit loop
      }
    }
  }

  /**
   * Subscribe to events. Returns an unsubscribe function.
   */
  subscribe(id: string, cb: EventCallback): () => void {
    this.subscribers.set(id, cb);
    return () => {
      this.subscribers.delete(id);
    };
  }

  /**
   * Get buffered events after a given sequence number (for reconnection replay).
   */
  getBufferedEvents(afterSeq = 0): HarnessEventEnvelope[] {
    return this.buffer.filter((e) => e.seq > afterSeq);
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }
}

/**
 * Registry that manages per-run event streams.
 */
export class RunEventStreamRegistry {
  private streams = new Map<string, RunEventStream>();

  getOrCreate(runId: string): RunEventStream {
    let stream = this.streams.get(runId);
    if (!stream) {
      stream = new RunEventStream(runId);
      this.streams.set(runId, stream);
    }
    return stream;
  }

  get(runId: string): RunEventStream | undefined {
    return this.streams.get(runId);
  }

  remove(runId: string): void {
    this.streams.delete(runId);
  }
}
