/**
 * WorkflowEngineService tests — dispatch pipeline + cascade depth +
 * queue overflow + predicate/args-mapper failure isolation.
 *
 * Uses a fake ManifestAccessorService that captures `invokeAction`
 * calls without exercising the full Phase 3 bridge. Phase 5 M2's
 * integration spec will run the bridge end-to-end with real
 * SessionMetadata + ToolCallerProxy.
 */

import { Test } from '@nestjs/testing';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import type { ActionResult } from '@kedge-agentic/ontology';
import { ManifestAccessorService } from '../ontology/manifest-accessor.service';
import { IndicatorRegistryService } from './llm/indicator-registry.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowMetricsService } from './workflow-metrics.service';
import { WorkflowRegistry } from './workflow-registry';
import type { TriggerDef } from './types';

class FakeManifestAccessor {
  invocations: Array<{ tool: string; args: Record<string, unknown>; role: string }> = [];
  stateChangeListeners: Array<(e: any) => void> = [];
  /** When set, getAccessorFor's invokeAction will return this. Default: ok. */
  nextResult: ActionResult = { ok: true };

  onStateChange(listener: (e: any) => void): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      const i = this.stateChangeListeners.indexOf(listener);
      if (i >= 0) this.stateChangeListeners.splice(i, 1);
    };
  }

  fireStateChange(e: any) {
    for (const l of this.stateChangeListeners) l(e);
  }

  publish(_sessionId: string, _stream: string, _event: unknown) {
    // no-op for these tests
  }

  async getAccessorFor(input: { role: string }) {
    const self = this;
    return {
      manifest: { name: 'LessonSession' } as any,
      role: input.role,
      getState: () => undefined,
      setState: () => undefined,
      getSlot: () => null,
      listActions: () => [],
      async invokeAction(action: string, args: Record<string, unknown>) {
        self.invocations.push({ tool: action, args, role: input.role });
        return self.nextResult;
      },
      subscribe: () => () => undefined,
    } as any;
  }
}

function eventTrigger(opts: Partial<TriggerDef> & { apiName: string }): TriggerDef {
  return {
    apiName: opts.apiName,
    manifest: 'LessonSession',
    semantic: 'fixture',
    kind: 'event',
    watch: { stream: 'events' },
    then: {
      action: 'record_lifecycle_observation',
      args: (input) => ({ payload: input.event?.payload }),
    },
    ...(opts as any),
  };
}

async function buildEngine(): Promise<{
  engine: WorkflowEngineService;
  registry: WorkflowRegistry;
  metrics: WorkflowMetricsService;
  accessor: FakeManifestAccessor;
}> {
  const fake = new FakeManifestAccessor();
  const module = await Test.createTestingModule({
    providers: [
      WorkflowRegistry,
      WorkflowMetricsService,
      WorkflowEngineService,
      DiscoveryService,
      MetadataScanner,
      IndicatorRegistryService,
      { provide: ManifestAccessorService, useValue: fake },
    ],
  }).compile();
  await module.init();
  return {
    engine: module.get(WorkflowEngineService),
    registry: module.get(WorkflowRegistry),
    metrics: module.get(WorkflowMetricsService),
    accessor: fake,
  };
}

describe('WorkflowEngineService — dispatch via ingestEvent', () => {
  it('fires matching event triggers + audits via invokeAction', async () => {
    const { engine, accessor } = await buildEngine();
    engine.registerTrigger(eventTrigger({ apiName: 't1' }));

    await engine.ingestEvent({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: { type: 'student_joined', name: 'Alice' },
    });

    expect(accessor.invocations).toHaveLength(1);
    expect(accessor.invocations[0]).toEqual({
      tool: 'record_lifecycle_observation',
      args: { payload: { type: 'student_joined', name: 'Alice' } },
      role: 'agent',
    });
  });

  it('does not fire triggers from a different manifest or stream', async () => {
    const { engine, accessor } = await buildEngine();
    engine.registerTrigger(
      eventTrigger({ apiName: 'matches', watch: { stream: 'events' } } as any),
    );
    engine.registerTrigger(
      eventTrigger({
        apiName: 'wrong_stream',
        watch: { stream: 'other_stream' },
      } as any),
    );

    await engine.ingestEvent({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {},
    });

    expect(accessor.invocations).toHaveLength(1);
  });

  it('predicate false → no invokeAction, counter incremented', async () => {
    const { engine, accessor, metrics } = await buildEngine();
    engine.registerTrigger(
      eventTrigger({
        apiName: 't1',
        when: () => false,
      } as any),
    );
    await engine.ingestEvent({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {},
    });
    expect(accessor.invocations).toHaveLength(0);
    expect(metrics.get('triggers_predicate_rejected')).toBe(1);
  });

  it('predicate throws → treated as false (engine never throws)', async () => {
    const { engine, accessor, metrics } = await buildEngine();
    engine.registerTrigger(
      eventTrigger({
        apiName: 't1',
        when: () => {
          throw new Error('boom');
        },
      } as any),
    );
    await expect(
      engine.ingestEvent({
        sessionId: 's1',
        solutionId: 'live-lesson',
        manifestName: 'LessonSession',
        streamApiName: 'events',
        payload: {},
      }),
    ).resolves.toBe(true);
    expect(accessor.invocations).toHaveLength(0);
    expect(metrics.get('triggers_predicate_rejected')).toBe(1);
  });

  it('args-mapper throws → audited + dropped, counter incremented', async () => {
    const { engine, accessor, metrics } = await buildEngine();
    engine.registerTrigger(
      eventTrigger({
        apiName: 't1',
        then: {
          action: 'noop',
          args: () => {
            throw new Error('mapper boom');
          },
        },
      } as any),
    );
    await engine.ingestEvent({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {},
    });
    expect(accessor.invocations).toHaveLength(0);
    expect(metrics.get('triggers_args_mapper_threw')).toBe(1);
  });

  it('invokeAction returns ok:false → counter incremented (tool not found maps to action_not_found)', async () => {
    const { engine, accessor, metrics } = await buildEngine();
    accessor.nextResult = {
      ok: false,
      errorCode: 'internal_error',
      message: 'tool not found',
    };
    engine.registerTrigger(eventTrigger({ apiName: 't1' }));
    await engine.ingestEvent({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {},
    });
    expect(metrics.get('triggers_action_failed')).toBe(1);
    expect(metrics.get('triggers_action_not_found')).toBe(1);
  });

  it('per-session FIFO: 2 events on same session serialize', async () => {
    const { engine, accessor } = await buildEngine();
    const order: string[] = [];
    engine.registerTrigger(
      eventTrigger({
        apiName: 'slow',
        then: {
          action: 'noop',
          args: async (input: any) => {
            order.push(`start-${input.event?.payload?.i}`);
            await new Promise<void>((resolve) => setTimeout(resolve, 10));
            order.push(`end-${input.event?.payload?.i}`);
            return {};
          },
        },
      } as any),
    );
    await Promise.all([
      engine.ingestEvent({
        sessionId: 's1',
        solutionId: 'live-lesson',
        manifestName: 'LessonSession',
        streamApiName: 'events',
        payload: { i: 1 },
      }),
      engine.ingestEvent({
        sessionId: 's1',
        solutionId: 'live-lesson',
        manifestName: 'LessonSession',
        streamApiName: 'events',
        payload: { i: 2 },
      }),
    ]);
    // FIFO: i=1 finishes before i=2 starts.
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    expect(accessor.invocations).toHaveLength(2);
  });
});

describe('WorkflowEngineService — state-change triggers', () => {
  it('fires state-change trigger when listener invoked on matching path', async () => {
    const { engine, accessor } = await buildEngine();
    engine.registerTrigger({
      apiName: 'on_phase_active',
      manifest: 'LessonSession',
      semantic: 'fixture',
      kind: 'state-change',
      watch: { state: 'phase' },
      then: {
        action: 'log_phase',
        args: (input) => ({
          path: input.stateChange?.path,
          before: input.stateChange?.before,
          after: input.stateChange?.after,
        }),
      },
    });
    // Simulate the ManifestAccessorService firing onStateChange:
    accessor.fireStateChange({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      path: 'phase',
      before: 'waiting',
      after: 'active',
    });
    // Wait one microtask + the queued promise.
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(accessor.invocations).toHaveLength(1);
    expect(accessor.invocations[0].args).toEqual({
      path: 'phase',
      before: 'waiting',
      after: 'active',
    });
  });

  it('state-change `equals` narrows: only fires when after matches', async () => {
    const { engine, accessor } = await buildEngine();
    engine.registerTrigger({
      apiName: 'phase_active_only',
      manifest: 'LessonSession',
      semantic: 'fixture',
      kind: 'state-change',
      watch: { state: 'phase', equals: 'active' },
      then: { action: 'noop', args: () => ({}) },
    });
    accessor.fireStateChange({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      path: 'phase',
      before: 'active',
      after: 'ended',
    });
    accessor.fireStateChange({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      path: 'phase',
      before: 'waiting',
      after: 'active',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(accessor.invocations).toHaveLength(1);
  });

  it('state-change `transitionsTo` narrows: only on edge (before !== to, after === to)', async () => {
    const { engine, accessor } = await buildEngine();
    engine.registerTrigger({
      apiName: 'phase_enters_active',
      manifest: 'LessonSession',
      semantic: 'fixture',
      kind: 'state-change',
      watch: { state: 'phase', transitionsTo: 'active' },
      then: { action: 'noop', args: () => ({}) },
    });
    // before === to → not an edge → no fire
    accessor.fireStateChange({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      path: 'phase',
      before: 'active',
      after: 'active',
    });
    // real edge → fires
    accessor.fireStateChange({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      path: 'phase',
      before: 'waiting',
      after: 'active',
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
    expect(accessor.invocations).toHaveLength(1);
  });
});

describe('WorkflowEngineService — cascade + queue', () => {
  it('cascade depth respects per-trigger cascadeBudget override', async () => {
    const { engine, accessor, metrics } = await buildEngine();
    engine.registerTrigger(
      eventTrigger({
        apiName: 'low_budget',
        cascadeBudget: 0, // never fires — even depth 0 is >= 0
      } as any),
    );
    await engine.ingestEvent({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {},
    });
    expect(accessor.invocations).toHaveLength(0);
    expect(metrics.get('cascade_depth_exceeded')).toBe(1);
  });

  it('clearSession releases per-session queue state', async () => {
    const { engine } = await buildEngine();
    engine.registerTrigger(eventTrigger({ apiName: 't1' }));
    await engine.ingestEvent({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      streamApiName: 'events',
      payload: {},
    });
    expect(() => engine.clearSession('s1')).not.toThrow();
  });
});
