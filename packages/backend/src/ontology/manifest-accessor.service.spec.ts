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
