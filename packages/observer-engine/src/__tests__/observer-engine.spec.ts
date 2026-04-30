import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObserverEngine } from '../core/observer-engine.js';
import type {
  ObservationStore,
  EventStore,
  ObserverEvent,
  HandlerContext,
  HandlerResult,
  Observation,
  NotifySink,
  LlmGateway,
} from '../core/interfaces.js';

function createMockObservationStore(): ObservationStore {
  const observations: Observation[] = [];
  return {
    append: vi.fn(async (obs: Observation) => {
      observations.push(obs);
    }),
    update: vi.fn(async () => {}),
    getByEntity: vi.fn(async (sessionId, entityId) =>
      observations.filter(
        (o) => o.sessionId === sessionId && o.entityId === entityId,
      ),
    ),
    getBySession: vi.fn(async (sessionId) =>
      observations.filter((o) => o.sessionId === sessionId),
    ),
  };
}

function createMockEventStore(): EventStore {
  return {
    save: vi.fn(async () => {}),
    getBySession: vi.fn(async () => []),
  };
}

describe('ObserverEngine', () => {
  let obsStore: ObservationStore;
  let eventStore: EventStore;
  let engine: ObserverEngine;

  beforeEach(() => {
    obsStore = createMockObservationStore();
    eventStore = createMockEventStore();
    engine = new ObserverEngine(obsStore, eventStore);
  });

  it('dispatches event to registered handler', async () => {
    const handler = vi.fn(async (): Promise<HandlerResult> => ({
      observations: [],
    }));

    engine.register('test_event', handler);
    await engine.dispatch({
      type: 'test_event',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: { foo: 'bar' },
    });

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0] as ObserverEvent;
    expect(event.type).toBe('test_event');
    expect(event.payload).toEqual({ foo: 'bar' });
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeGreaterThan(0);
  });

  it('persists event to event store', async () => {
    engine.register('x', async () => ({ observations: [] }));
    await engine.dispatch({
      type: 'x',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(eventStore.save).toHaveBeenCalledOnce();
  });

  it('appends observation from handler result', async () => {
    engine.register('chat_turn', async (event) => ({
      observations: [
        {
          op: 'append',
          observation: {
            entityId: event.entityId,
            type: 'misconception',
            data: { topic: 'fractions' },
            triggerEventId: event.id,
          },
        },
      ],
    }));

    await engine.dispatch({
      type: 'chat_turn',
      sessionId: 's1',
      entityId: 'student-1',
      tenantId: 't1',
      payload: { message: 'hello' },
    });

    expect(obsStore.append).toHaveBeenCalledOnce();
    const obs = (obsStore.append as any).mock.calls[0][0] as Observation;
    expect(obs.type).toBe('misconception');
    expect(obs.entityId).toBe('student-1');
    expect(obs.sessionId).toBe('s1');
    expect(obs.tenantId).toBe('t1');
    expect(obs.data).toEqual({ topic: 'fractions' });
  });

  it('updates existing observation', async () => {
    engine.register('resolve', async () => ({
      observations: [
        {
          op: 'update',
          observationId: 'obs-123',
          patch: { type: 'resolved', data: { resolvedAt: 100 } },
        },
      ],
    }));

    await engine.dispatch({
      type: 'resolve',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(obsStore.update).toHaveBeenCalledWith('obs-123', {
      type: 'resolved',
      data: { resolvedAt: 100 },
    });
  });

  it('cascades emitted events', async () => {
    const cascadeHandler = vi.fn(async (): Promise<HandlerResult> => ({
      observations: [],
    }));

    engine.register('step_1', async (event) => ({
      observations: [],
      emit: [
        {
          type: 'step_2',
          sessionId: event.sessionId,
          entityId: event.entityId,
          tenantId: event.tenantId,
          payload: { from: 'step_1' },
        },
      ],
    }));
    engine.register('step_2', cascadeHandler);

    await engine.dispatch({
      type: 'step_1',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(cascadeHandler).toHaveBeenCalledOnce();
    const cascadeEvent = cascadeHandler.mock.calls[0][0] as ObserverEvent;
    expect(cascadeEvent.type).toBe('step_2');
    expect(cascadeEvent.payload).toEqual({ from: 'step_1' });
    expect(cascadeEvent.metadata?.depth).toBe(1);
  });

  it('enforces max cascade depth', async () => {
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const limitedEngine = new ObserverEngine(
      obsStore,
      eventStore,
      undefined,
      undefined,
      logger,
      { maxCascadeDepth: 2 },
    );

    // Infinite loop: each event emits itself
    limitedEngine.register('loop', async (event) => ({
      observations: [],
      emit: [
        {
          type: 'loop',
          sessionId: event.sessionId,
          entityId: event.entityId,
          tenantId: event.tenantId,
          payload: {},
        },
      ],
    }));

    await limitedEngine.dispatch({
      type: 'loop',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    // depth 0 → emits depth 1 → emits depth 2 → emits depth 3 (dropped)
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][0]).toContain('exceeds max');
  });

  it('isolates handler errors', async () => {
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const safeEngine = new ObserverEngine(
      obsStore,
      eventStore,
      undefined,
      undefined,
      logger,
    );

    const goodHandler = vi.fn(async (): Promise<HandlerResult> => ({
      observations: [
        {
          op: 'append',
          observation: {
            entityId: 'e1',
            type: 'ok',
            data: {},
            triggerEventId: 'x',
          },
        },
      ],
    }));

    safeEngine.register('multi', async () => {
      throw new Error('Handler exploded');
    });
    safeEngine.register('multi', goodHandler);

    await safeEngine.dispatch({
      type: 'multi',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(logger.error).toHaveBeenCalled();
    expect(goodHandler).toHaveBeenCalledOnce();
    expect(obsStore.append).toHaveBeenCalledOnce();
  });

  it('executes multiple handlers for same event type sequentially', async () => {
    const order: number[] = [];

    engine.register('ordered', async () => {
      order.push(1);
      return { observations: [] };
    });
    engine.register('ordered', async () => {
      order.push(2);
      return { observations: [] };
    });
    engine.register('ordered', async () => {
      order.push(3);
      return { observations: [] };
    });

    await engine.dispatch({
      type: 'ordered',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(order).toEqual([1, 2, 3]);
  });

  it('provides handler context with store access', async () => {
    engine.setSessionMeta('s1', { lesson: 'math' });

    engine.register('ctx_test', async (event, ctx) => {
      const meta = ctx.getSessionMeta();
      expect(meta).toEqual({ lesson: 'math' });
      await ctx.getObservations('e1');
      await ctx.getAllObservations('s1');
      return { observations: [] };
    });

    await engine.dispatch({
      type: 'ctx_test',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(obsStore.getByEntity).toHaveBeenCalledWith('s1', 'e1');
    expect(obsStore.getBySession).toHaveBeenCalledWith('s1');
  });

  it('provides notify sink to handler context', async () => {
    const notifySink: NotifySink = { push: vi.fn() };
    const notifyEngine = new ObserverEngine(
      obsStore,
      eventStore,
      undefined,
      notifySink,
    );

    notifyEngine.register('alert', async (_event, ctx) => {
      ctx.notify('session:s1:alerts', { severity: 'urgent' });
      return { observations: [] };
    });

    await notifyEngine.dispatch({
      type: 'alert',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(notifySink.push).toHaveBeenCalledWith('session:s1:alerts', {
      severity: 'urgent',
    });
  });

  it('provides LLM gateway to handler context', async () => {
    const llm: LlmGateway = {
      chat: vi.fn(async () => '{"action":"skip"}'),
    };
    const llmEngine = new ObserverEngine(obsStore, eventStore, llm);

    llmEngine.register('analyze', async (_event, ctx) => {
      const result = await ctx.llm.chat([
        { role: 'user', content: 'analyze this' },
      ]);
      expect(result).toBe('{"action":"skip"}');
      return { observations: [] };
    });

    await llmEngine.dispatch({
      type: 'analyze',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(llm.chat).toHaveBeenCalledOnce();
  });

  it('does nothing when no handler registered for event type', async () => {
    await engine.dispatch({
      type: 'unknown_event',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    // Event still persisted
    expect(eventStore.save).toHaveBeenCalledOnce();
    expect(obsStore.append).not.toHaveBeenCalled();
  });

  it('works without event store (null)', async () => {
    const noEventStoreEngine = new ObserverEngine(obsStore, null);
    const handler = vi.fn(async (): Promise<HandlerResult> => ({
      observations: [],
    }));

    noEventStoreEngine.register('test', handler);
    await noEventStoreEngine.dispatch({
      type: 'test',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('clears session meta', async () => {
    engine.setSessionMeta('s1', { x: 1 });
    engine.clearSessionMeta('s1');

    engine.register('check', async (_event, ctx) => {
      expect(ctx.getSessionMeta()).toEqual({});
      return { observations: [] };
    });

    await engine.dispatch({
      type: 'check',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });
  });

  it('preserves correlationId across cascade chain', async () => {
    let correlationIds: (string | undefined)[] = [];

    engine.register('a', async (event) => {
      correlationIds.push(event.metadata?.correlationId);
      return {
        observations: [],
        emit: [
          {
            type: 'b',
            sessionId: event.sessionId,
            entityId: event.entityId,
            tenantId: event.tenantId,
            payload: {},
          },
        ],
      };
    });

    engine.register('b', async (event) => {
      correlationIds.push(event.metadata?.correlationId);
      return { observations: [] };
    });

    await engine.dispatch({
      type: 'a',
      sessionId: 's1',
      entityId: 'e1',
      tenantId: 't1',
      payload: {},
    });

    expect(correlationIds).toHaveLength(2);
    expect(correlationIds[0]).toBe(correlationIds[1]);
  });
});
