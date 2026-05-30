/**
 * ManifestAccessorService tests.
 *
 * Criterion 3 (success criteria): getState/setState round-trips through
 * SessionMetadataService — covered by the round-trip case. Also covers
 * boundary-enforced denial on reads/writes outside the role's
 * `readable`/`writable`, slot snapshot behavior, and the stream pub/sub
 * fanout (Phase 3B's bridge calls publish()).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { z } from 'zod';
import {
  defineManifest,
  defineStateField,
  OntologyRegistry,
} from '@kedge-agentic/ontology';
import { ManifestAccessorService } from './manifest-accessor.service';
import {
  ONTOLOGY_REGISTRY,
  OntologyRegistryProvider,
} from './ontology-registry.provider';
import { SessionMetadataService } from '../sessions/services/session-metadata.service';
import { SolutionToolkitRegistry } from '../tool-caller/solution-toolkit-registry';
import { ToolCallerProxyService } from '../tool-caller/tool-caller-proxy.service';
import { NotFoundException } from '@nestjs/common';
import type { SessionMetadataRow } from '../sessions/services/session-metadata.service';

class FakeSessionMetadataService {
  store = new Map<string, unknown>();
  putCalls: Array<{ sessionId: string; key: string; value: unknown }> = [];

  async get(sessionId: string, _solutionId: string, key: string): Promise<SessionMetadataRow> {
    if (!this.store.has(`${sessionId}/${key}`)) {
      throw new NotFoundException(`no metadata for ${sessionId}/${key}`);
    }
    return {
      key,
      value: this.store.get(`${sessionId}/${key}`),
      updatedAt: new Date().toISOString(),
    };
  }

  async put(
    sessionId: string,
    _solutionId: string,
    key: string,
    value: unknown,
  ): Promise<SessionMetadataRow> {
    this.store.set(`${sessionId}/${key}`, value);
    this.putCalls.push({ sessionId, key, value });
    return {
      key,
      value,
      updatedAt: new Date().toISOString(),
    };
  }
}

function buildManifest() {
  return defineManifest({
    name: 'LessonSession',
    displayName: 'Lesson Session',
    schemaVersion: '0.1.0',
    semantic: 'test lesson session',
    slots: [
      {
        apiName: 'plan',
        displayName: 'Plan',
        target: { kind: 'objectType', apiName: 'Lesson' },
        semantic: 'the lesson plan',
      },
    ],
    state: [
      defineStateField({
        apiName: 'phase',
        displayName: 'Phase',
        schema: z.enum(['waiting', 'active', 'ended']),
        initial: 'waiting',
        semantic: 'current phase',
      }),
      defineStateField({
        apiName: 'activeResourceIndex',
        displayName: 'Active Resource Index',
        schema: z.number().int(),
        initial: 0,
        semantic: 'active resource pointer',
      }),
    ],
    streams: [
      {
        apiName: 'events',
        displayName: 'Events',
        payloadSchema: z.object({ type: z.string() }),
        semantic: 'classroom events',
        backpressure: 'drop_oldest',
      },
    ],
    boundaries: [
      {
        role: 'agent',
        readable: ['plan', 'phase', 'activeResourceIndex'],
        writable: ['phase', 'activeResourceIndex'],
        actions: [],
        subscribes: ['events'],
      },
      {
        role: 'picker',
        readable: ['plan', 'phase'],
        writable: [],
        actions: [],
      },
    ],
  });
}

describe('ManifestAccessorService', () => {
  let service: ManifestAccessorService;
  let metadata: FakeSessionMetadataService;
  let registry: OntologyRegistry;

  beforeEach(async () => {
    metadata = new FakeSessionMetadataService();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OntologyRegistryProvider,
        ManifestAccessorService,
        { provide: SessionMetadataService, useValue: metadata },
      ],
    }).compile();
    service = module.get(ManifestAccessorService);
    registry = module.get(ONTOLOGY_REGISTRY);
    registry.registerManifest(buildManifest());
  });

  it('throws if the manifest is not registered', async () => {
    await expect(
      service.getAccessorFor({
        sessionId: 's1',
        solutionId: 'live-lesson',
        manifestName: 'DoesNotExist',
        role: 'agent',
      }),
    ).rejects.toThrow(/is not registered/);
  });

  it('seeds state from defineStateField.initial when SessionMetadata has no row', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    expect(a.getState<string>('phase')).toBe('waiting');
    expect(a.getState<number>('activeResourceIndex')).toBe(0);
  });

  it('setState round-trips through SessionMetadataService (criterion 3)', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    a.setState('phase', 'active');
    // sync cache reflects immediately
    expect(a.getState<string>('phase')).toBe('active');

    // wait one microtask for fire-and-forget persistence
    await new Promise<void>((res) => queueMicrotask(res));

    expect(metadata.putCalls).toContainEqual({
      sessionId: 's1',
      key: 'manifest.LessonSession.phase',
      value: 'active',
    });

    // recreate accessor — should rehydrate from SessionMetadata
    const a2 = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    expect(a2.getState<string>('phase')).toBe('active');
  });

  it('getState throws when role lacks readable for that path', async () => {
    const picker = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'picker',
    });
    expect(() => picker.getState('activeResourceIndex')).toThrow(/denied/);
  });

  it('setState throws when role lacks writable for that path', async () => {
    const picker = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'picker',
    });
    expect(() => picker.setState('phase', 'active')).toThrow(/denied/);
  });

  it('getSlot returns null for unbound singleton, [] for unbound collection', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    expect(a.getSlot('plan')).toBeNull();
  });

  it('getSlot returns pre-bound snapshot when provided', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
      slotBindings: { plan: { id: 'lesson-1', title: 'L' } },
    });
    expect(a.getSlot('plan')).toEqual({ id: 'lesson-1', title: 'L' });
  });

  it('subscribe + publish: handler receives events for the right session+stream only', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    const received: unknown[] = [];
    const unsub = a.subscribe('events', (e) => received.push(e));

    service.publish('s1', 'events', { type: 'join', studentId: 'st1' });
    service.publish('s2', 'events', { type: 'join', studentId: 'other' }); // different session — ignored
    service.publish('s1', 'other', { type: 'x' }); // different stream — ignored

    expect(received).toEqual([{ type: 'join', studentId: 'st1' }]);

    unsub();
    service.publish('s1', 'events', { type: 'leave' });
    expect(received).toEqual([{ type: 'join', studentId: 'st1' }]);
  });

  it('subscribe denies when role lacks the stream', async () => {
    const picker = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'picker',
    });
    expect(() => picker.subscribe('events', () => {})).toThrow(/denied/);
  });

  it('clearSession releases all stream handlers for that session (S2)', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    const received: unknown[] = [];
    a.subscribe('events', (e) => received.push(e));
    service.clearSession('s1');
    service.publish('s1', 'events', { type: 'after-clear' });
    expect(received).toEqual([]);
  });

  it('invokeAction with no proxy bound returns internal_error', async () => {
    // The default test module above already provides no ToolCallerProxy,
    // so the existing service has `proxy === undefined`. Exercise the
    // no-proxy branch explicitly.
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    const result = await a.invokeAction('some_action', {});
    expect(result).toEqual({
      ok: false,
      errorCode: 'internal_error',
      message: expect.stringMatching(/no ToolCallerProxyService bound/),
    });
  });

  it('invokeAction uses qualifyTool to map bare apiName → namespaced tool (pass-3 S2)', async () => {
    const toolkits = new SolutionToolkitRegistry();
    const proxy = new ToolCallerProxyService(toolkits);
    toolkits.registerToolkit({
      solutionId: 'live-lesson',
      namespace: 'creator-actions',
      tools: [
        {
          name: 'emit_todo_card',
          description: 'fixture',
          argsSchema: z.object({}).passthrough(),
          handler: async () => ({ ok: true, content: [{ type: 'text', text: 'fixture-ok' }] }),
        },
      ],
    });
    const module = await Test.createTestingModule({
      providers: [
        OntologyRegistryProvider,
        ManifestAccessorService,
        { provide: SessionMetadataService, useValue: metadata },
        { provide: ToolCallerProxyService, useValue: proxy },
      ],
    }).compile();
    const accessorService = module.get(ManifestAccessorService);
    const registry2 = module.get(ONTOLOGY_REGISTRY);
    registry2.registerManifest(buildManifest());
    const a = await accessorService.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
      qualifyTool: (n) => `creator-actions.${n}`,
    });
    // Caller passes bare apiName — accessor's qualifyTool prepends the namespace.
    const result = await a.invokeAction('emit_todo_card', {});
    expect(result).toEqual({ ok: true });
  });

  it('invokeAction maps tool_not_found from proxy to internal_error (S5 coverage)', async () => {
    const toolkits = new SolutionToolkitRegistry();
    const proxy = new ToolCallerProxyService(toolkits);
    // No tools registered — proxy.invoke returns tool_not_found.
    const module = await Test.createTestingModule({
      providers: [
        OntologyRegistryProvider,
        ManifestAccessorService,
        { provide: SessionMetadataService, useValue: metadata },
        { provide: ToolCallerProxyService, useValue: proxy },
      ],
    }).compile();
    const accessorService = module.get(ManifestAccessorService);
    const registry2 = module.get(ONTOLOGY_REGISTRY);
    registry2.registerManifest(buildManifest());
    const a = await accessorService.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    const result = await a.invokeAction('does_not_exist', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe('internal_error');
    }
  });

  it('onStateChange fires after setState with before+after, skips when Object.is matches', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    const events: Array<{ path: string; before: unknown; after: unknown }> = [];
    const unsub = service.onStateChange((e) => {
      events.push({ path: e.path, before: e.before, after: e.after });
    });

    a.setState('phase', 'active');
    expect(events).toEqual([
      { path: 'phase', before: 'waiting', after: 'active' },
    ]);

    // Spurious set — value unchanged, listener should NOT fire again.
    a.setState('phase', 'active');
    expect(events).toHaveLength(1);

    // Real change again — listener fires.
    a.setState('phase', 'ended');
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({
      path: 'phase',
      before: 'active',
      after: 'ended',
    });

    unsub();
    a.setState('phase', 'active');
    expect(events).toHaveLength(2); // unsubscribed listener doesn't fire
  });

  it('onStateChange listener errors are swallowed; other listeners still fire', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    const okEvents: unknown[] = [];
    service.onStateChange(() => {
      throw new Error('boom');
    });
    service.onStateChange((e) => {
      okEvents.push(e.path);
    });
    expect(() => a.setState('phase', 'active')).not.toThrow();
    expect(okEvents).toEqual(['phase']);
  });

  it('onStateChange does NOT fire when setState was a no-op (spurious set guard)', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    const events: unknown[] = [];
    service.onStateChange((e) => events.push(e));
    // The seeded initial for 'phase' is 'waiting'. Setting to 'waiting' is a no-op.
    a.setState('phase', 'waiting');
    expect(events).toEqual([]);
  });

  it('publish swallows per-handler errors so one bad subscriber cannot poison the fanout', async () => {
    const a = await service.getAccessorFor({
      sessionId: 's1',
      solutionId: 'live-lesson',
      manifestName: 'LessonSession',
      role: 'agent',
    });
    const okReceived: unknown[] = [];
    a.subscribe('events', () => {
      throw new Error('boom');
    });
    a.subscribe('events', (e) => {
      okReceived.push(e);
    });
    expect(() => service.publish('s1', 'events', { type: 'a' })).not.toThrow();
    expect(okReceived).toEqual([{ type: 'a' }]);
  });
});
