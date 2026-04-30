import type { ObserverEvent, HandlerContext, Observation } from '@kedge-agentic/observer-engine';
import { StatusChangeHandler } from './status-change-handler';

// ── Helpers ──

const NOW = 1_700_000_000_000;

function makeEvent(overrides?: Partial<ObserverEvent>): ObserverEvent {
  return {
    id: 'evt-1',
    type: 'student_observation_changed',
    sessionId: 'sess-1',
    entityId: 'stu-1',
    tenantId: 'tenant-1',
    timestamp: NOW,
    payload: { trigger: 'chat_turn' },
    ...overrides,
  };
}

function makeObs(overrides: Partial<Observation> & { type: string }): Observation {
  return {
    id: `obs-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: 'sess-1',
    entityId: 'stu-1',
    tenantId: 'tenant-1',
    data: {},
    triggerEventId: 'evt-0',
    createdAt: NOW - 10_000,
    updatedAt: NOW - 10_000,
    ...overrides,
  };
}

const INDICATORS = [
  { id: 'K1', type: 'knowledge' as const, label: '理解夹角', description: '正确识别两边夹角' },
  { id: 'M1', type: 'misconception' as const, label: '非夹角混淆', description: '把非夹角当作夹角' },
];

function makeCtx(overrides?: {
  observations?: Observation[];
  meta?: Record<string, unknown>;
  llmResponse?: string;
  llmError?: Error;
}): HandlerContext {
  const observations = overrides?.observations ?? [];
  const meta = overrides?.meta ?? { indicators: INDICATORS };

  return {
    getObservations: jest.fn().mockResolvedValue(observations),
    getAllObservations: jest.fn().mockResolvedValue(observations),
    getSessionMeta: jest.fn().mockReturnValue(meta),
    llm: {
      chat: overrides?.llmError
        ? jest.fn().mockRejectedValue(overrides.llmError)
        : jest.fn().mockResolvedValue(overrides?.llmResponse ?? '{}'),
    },
    notify: jest.fn(),
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
}

// ── Tests ──

describe('StatusChangeHandler', () => {
  let handler: StatusChangeHandler;

  beforeEach(() => {
    handler = new StatusChangeHandler();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => jest.restoreAllMocks());

  // 1. Fast path: idle
  it('returns idle when all observations are old (fast path, no LLM)', async () => {
    const staleObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['K1'], gist: 'ok' },
      updatedAt: NOW - 200_000, // > 180s
      createdAt: NOW - 200_000,
    });
    const ctx = makeCtx({ observations: [staleObs] });

    const result = await handler.handle(makeEvent(), ctx);

    expect(ctx.llm.chat).not.toHaveBeenCalled();
    const op = result.observations[0];
    expect(op.op).toBe('append');
    if (op.op === 'append') {
      expect((op.observation.data as any).status).toBe('idle');
      expect((op.observation.data as any).summary).toBe('超过3分钟无活动');
    }
  });

  // 2. Fast path: cold start (0 indicator_hits)
  it('returns active on cold start with no indicator_hit observations', async () => {
    const exerciseObs = makeObs({
      type: 'exercise',
      data: { score: 90, step: 1 },
      updatedAt: NOW - 5_000,
    });
    const ctx = makeCtx({ observations: [exerciseObs] });

    const result = await handler.handle(makeEvent(), ctx);

    expect(ctx.llm.chat).not.toHaveBeenCalled();
    const op = result.observations[0];
    expect(op.op).toBe('append');
    if (op.op === 'append') {
      expect((op.observation.data as any).status).toBe('active');
      expect((op.observation.data as any).summary).toContain('暂无学习数据');
    }
  });

  // 3. Fast path: no indicators in session meta
  it('uses rule fallback when session meta has no indicators', async () => {
    const hitObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['M1'], gist: '混淆了' },
      updatedAt: NOW - 5_000,
      createdAt: NOW - 5_000,
    });
    const ctx = makeCtx({ observations: [hitObs], meta: {} });

    const result = await handler.handle(makeEvent(), ctx);

    expect(ctx.llm.chat).not.toHaveBeenCalled();
    const op = result.observations[0];
    if (op.op === 'append') {
      // Rule-based: 1 misconception → struggling
      expect((op.observation.data as any).status).toBe('struggling');
    }
  });

  // 4. LLM success: struggling + alertMessage
  it('uses LLM result when indicators and observations exist (struggling)', async () => {
    const hitObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['M1'], gist: '非夹角混淆' },
      updatedAt: NOW - 5_000,
      createdAt: NOW - 5_000,
    });
    const llmResponse = JSON.stringify({
      status: 'struggling',
      summary: 'M1非夹角混淆反复出现',
      alertMessage: '该学生反复将非夹角当作夹角使用',
    });
    const ctx = makeCtx({ observations: [hitObs], llmResponse });

    const result = await handler.handle(makeEvent(), ctx);

    expect(ctx.llm.chat).toHaveBeenCalledTimes(1);
    const op = result.observations[0];
    if (op.op === 'append') {
      expect((op.observation.data as any).status).toBe('struggling');
      expect((op.observation.data as any).summary).toBe('M1非夹角混淆反复出现');
      expect((op.observation.data as any).alertMessage).toBe('该学生反复将非夹角当作夹角使用');
    }
  });

  // 5. LLM success: active (no alert SSE)
  it('does not emit observer_alert when LLM returns active', async () => {
    const hitObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['K1'], gist: '正确' },
      updatedAt: NOW - 5_000,
      createdAt: NOW - 5_000,
    });
    const llmResponse = JSON.stringify({
      status: 'active',
      summary: '学习正常',
      alertMessage: null,
    });
    const ctx = makeCtx({ observations: [hitObs], llmResponse });

    await handler.handle(makeEvent(), ctx);

    // observer_status is emitted (status changed from undefined → active)
    const statusCalls = (ctx.notify as jest.Mock).mock.calls.filter(
      c => (c[0] as string).includes('observer_status'),
    );
    expect(statusCalls.length).toBe(1);

    // observer_alert is NOT emitted (active is not alertable)
    const alertCalls = (ctx.notify as jest.Mock).mock.calls.filter(
      c => (c[0] as string).includes('observer_alert'),
    );
    expect(alertCalls.length).toBe(0);
  });

  // 6. LLM failure: fallback to rules
  it('falls back to rule-based derivation when LLM throws', async () => {
    const hitObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['M1'], gist: 'error' },
      updatedAt: NOW - 5_000,
      createdAt: NOW - 5_000,
    });
    const ctx = makeCtx({
      observations: [hitObs],
      llmError: new Error('API timeout'),
    });

    const result = await handler.handle(makeEvent(), ctx);

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('LLM call failed'),
    );
    const op = result.observations[0];
    if (op.op === 'append') {
      // Rule: 1 misconception → struggling
      expect((op.observation.data as any).status).toBe('struggling');
      expect((op.observation.data as any).summary).toBe('');
    }
  });

  // 7. LLM returns invalid status: fallback
  it('falls back when LLM returns an invalid status value', async () => {
    const hitObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['K1'], gist: 'ok' },
      updatedAt: NOW - 5_000,
      createdAt: NOW - 5_000,
    });
    const llmResponse = JSON.stringify({
      status: 'confused', // invalid
      summary: 'test',
      alertMessage: null,
    });
    const ctx = makeCtx({ observations: [hitObs], llmResponse });

    const result = await handler.handle(makeEvent(), ctx);

    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid status'),
    );
    const op = result.observations[0];
    if (op.op === 'append') {
      // Rule fallback: 0 misconceptions, 1 K → active
      expect((op.observation.data as any).status).toBe('active');
    }
  });

  // 8. Status change triggers observer_status + observer_alert SSE
  it('emits observer_status and observer_alert when status changes to stuck', async () => {
    const existingStatusObs = makeObs({
      id: 'obs-status-1',
      type: 'student_status',
      data: { status: 'active', summary: '正常' },
      updatedAt: NOW - 60_000,
    });
    const hitObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['M1'], gist: '反复错误' },
      updatedAt: NOW - 5_000,
      createdAt: NOW - 5_000,
    });
    const llmResponse = JSON.stringify({
      status: 'stuck',
      summary: 'M1反复出现无改善',
      alertMessage: '该学生在夹角概念上反复犯错，建议干预',
    });
    const ctx = makeCtx({
      observations: [existingStatusObs, hitObs],
      llmResponse,
    });

    await handler.handle(makeEvent(), ctx);

    const notifyCalls = (ctx.notify as jest.Mock).mock.calls;

    // observer_status emitted
    const statusCall = notifyCalls.find(c => (c[0] as string).includes('observer_status'));
    expect(statusCall).toBeDefined();
    expect(statusCall![1]).toMatchObject({
      studentId: 'stu-1',
      status: 'stuck',
      previousStatus: 'active',
    });

    // observer_alert emitted with LLM alertMessage
    const alertCall = notifyCalls.find(c => (c[0] as string).includes('observer_alert'));
    expect(alertCall).toBeDefined();
    expect(alertCall![1]).toMatchObject({
      severity: 'urgent',
      message: '该学生在夹角概念上反复犯错，建议干预',
      studentId: 'stu-1',
    });
  });

  // 9. Status unchanged → no SSE
  it('does not emit SSE when status stays the same', async () => {
    const existingStatusObs = makeObs({
      id: 'obs-status-1',
      type: 'student_status',
      data: { status: 'active', summary: '学习正常' },
      updatedAt: NOW - 60_000,
    });
    const hitObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['K1'], gist: '正确理解' },
      updatedAt: NOW - 5_000,
      createdAt: NOW - 5_000,
    });
    const llmResponse = JSON.stringify({
      status: 'active',
      summary: '继续正常学习',
      alertMessage: null,
    });
    const ctx = makeCtx({
      observations: [existingStatusObs, hitObs],
      llmResponse,
    });

    await handler.handle(makeEvent(), ctx);

    // No notify calls at all — status unchanged (active → active)
    expect(ctx.notify).not.toHaveBeenCalled();
  });

  // 10. Updates existing student_status observation instead of appending
  it('updates existing student_status observation via op:update', async () => {
    const existingStatusObs = makeObs({
      id: 'obs-status-1',
      type: 'student_status',
      data: { status: 'struggling', summary: '之前的' },
      updatedAt: NOW - 60_000,
    });
    const hitObs = makeObs({
      type: 'indicator_hit',
      data: { anchors: ['K1', 'K2'], gist: '进步了' },
      updatedAt: NOW - 5_000,
      createdAt: NOW - 5_000,
    });
    const llmResponse = JSON.stringify({
      status: 'active',
      summary: '已改善',
      alertMessage: null,
    });
    const ctx = makeCtx({
      observations: [existingStatusObs, hitObs],
      llmResponse,
    });

    const result = await handler.handle(makeEvent(), ctx);

    const op = result.observations[0];
    expect(op.op).toBe('update');
    if (op.op === 'update') {
      expect(op.observationId).toBe('obs-status-1');
      expect((op.patch.data as any).status).toBe('active');
      expect((op.patch.data as any).previousStatus).toBe('struggling');
      expect((op.patch.data as any).summary).toBe('已改善');
    }
  });
});
