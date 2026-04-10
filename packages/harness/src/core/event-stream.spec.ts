import { RunEventStream, RunEventStreamRegistry } from './event-stream.js';
import type { HarnessEvent } from './interfaces.js';

function makeEvent(type: HarnessEvent['type'] = 'step_started'): HarnessEvent {
  return { type, runId: 'run_1', data: {} };
}

describe('RunEventStream', () => {
  let stream: RunEventStream;

  beforeEach(() => {
    stream = new RunEventStream('run_1');
  });

  it('should emit events to subscribers', () => {
    const received: unknown[] = [];
    stream.subscribe('sub1', (env) => received.push(env));

    stream.emit(makeEvent());

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      seq: 1,
      runId: 'run_1',
      event: { type: 'step_started' },
    });
  });

  it('should drop oldest events when buffer exceeds 200', () => {
    // Emit 210 events
    for (let i = 0; i < 210; i++) {
      stream.emit(makeEvent());
    }

    const buffered = stream.getBufferedEvents(0);
    expect(buffered).toHaveLength(200);
    // First event in buffer should be seq 11 (dropped 1-10)
    expect(buffered[0].seq).toBe(11);
    expect(buffered[199].seq).toBe(210);
  });

  it('should filter buffered events by afterSeq', () => {
    for (let i = 0; i < 5; i++) {
      stream.emit(makeEvent());
    }

    const after3 = stream.getBufferedEvents(3);
    expect(after3).toHaveLength(2);
    expect(after3[0].seq).toBe(4);
    expect(after3[1].seq).toBe(5);
  });

  it('should stop delivering events after unsubscribe', () => {
    const received: unknown[] = [];
    const unsub = stream.subscribe('sub1', (env) => received.push(env));

    stream.emit(makeEvent());
    expect(received).toHaveLength(1);

    unsub();
    stream.emit(makeEvent());
    expect(received).toHaveLength(1); // no new event
  });

  it('should not break other subscribers when one throws', () => {
    const received: unknown[] = [];
    stream.subscribe('bad', () => {
      throw new Error('boom');
    });
    stream.subscribe('good', (env) => received.push(env));

    stream.emit(makeEvent());

    expect(received).toHaveLength(1);
  });

  it('should report subscriberCount correctly', () => {
    expect(stream.subscriberCount).toBe(0);

    const unsub1 = stream.subscribe('s1', () => {});
    stream.subscribe('s2', () => {});
    expect(stream.subscriberCount).toBe(2);

    unsub1();
    expect(stream.subscriberCount).toBe(1);
  });
});

describe('RunEventStreamRegistry', () => {
  let registry: RunEventStreamRegistry;

  beforeEach(() => {
    registry = new RunEventStreamRegistry();
  });

  it('should create and return the same stream for a runId', () => {
    const s1 = registry.getOrCreate('run_a');
    const s2 = registry.getOrCreate('run_a');
    expect(s1).toBe(s2);
  });

  it('should return different streams for different runIds', () => {
    const s1 = registry.getOrCreate('run_a');
    const s2 = registry.getOrCreate('run_b');
    expect(s1).not.toBe(s2);
  });

  it('should return undefined for unknown runId via get()', () => {
    expect(registry.get('nonexistent')).toBeUndefined();
  });

  it('should remove a stream', () => {
    registry.getOrCreate('run_a');
    expect(registry.get('run_a')).toBeDefined();

    registry.remove('run_a');
    expect(registry.get('run_a')).toBeUndefined();
  });
});
