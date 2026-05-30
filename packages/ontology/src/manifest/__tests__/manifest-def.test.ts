/**
 * Integration tests for the manifest layer.
 *
 * Builds a small `LessonSession`-shaped `ManifestDef` end-to-end —
 * slots + streams + state + boundaries + lifecycle — to confirm that
 * all the manifest primitives compose. Phase-deferred fields
 * (notifications, BoundaryPredicate-scoped readable, objectSet slot
 * target) are tested as compile-time-blocked via @ts-expect-error.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type {
  AccessBoundary,
  LifecycleDef,
  ManifestDef,
  SchemaVersion,
  SlotDef,
  SlotTarget,
  StateDef,
} from '../index.js';

describe('SlotDef + SlotTarget', () => {
  it('accepts target.kind objectType', () => {
    const slot: SlotDef = {
      apiName: 'plan',
      displayName: '教学计划',
      target: { kind: 'objectType', apiName: 'LessonPlan' },
      required: true,
      semantic: 'The lesson plan being executed.',
    };
    expect(slot.target.kind).toBe('objectType');
  });

  it('accepts target.kind manifest (for nesting per §9.2)', () => {
    const slot: SlotDef = {
      apiName: 'currentLesson',
      displayName: '当前课时',
      target: { kind: 'manifest', name: 'LessonSession' },
      semantic: 'Nested LessonSession manifest inside a SemesterPlan.',
    };
    expect(slot.target.kind).toBe('manifest');
  });

  it('accepts target.kind objectSet (Tier 2, Phase 4)', () => {
    const t: SlotTarget = { kind: 'objectSet', name: 'strugglingStudents' };
    expect(t.kind).toBe('objectSet');
  });

  it('accepts derivedFrom dot-path', () => {
    const slot: SlotDef = {
      apiName: 'students',
      displayName: '学生',
      target: { kind: 'objectType', apiName: 'Student' },
      collection: true,
      derivedFrom: 'class.contains',
      semantic: 'Derived from class.contains.',
    };
    expect(slot.derivedFrom).toBe('class.contains');
  });
});

describe('StateDef', () => {
  it('binds an initial value type-checked against schema', () => {
    const phase: StateDef = {
      apiName: 'phase',
      displayName: '当前阶段',
      schema: z.enum(['waiting', 'practice', 'discuss']),
      initial: 'waiting',
      semantic: 'Current teaching phase.',
    };
    expect(phase.initial).toBe('waiting');
  });

  it('accepts boolean state', () => {
    const paused: StateDef = {
      apiName: 'paused',
      displayName: 'paused',
      schema: z.boolean(),
      initial: false,
      semantic: 'Paused-for-intervention flag.',
    };
    expect(paused.initial).toBe(false);
  });

  it('accepts nullable state', () => {
    const stepId: StateDef = {
      apiName: 'activeStepId',
      displayName: '当前步骤ID',
      schema: z.string().nullable(),
      initial: null,
      semantic: 'null until phase leaves waiting.',
    };
    expect(stepId.initial).toBeNull();
  });
});

describe('AccessBoundary', () => {
  it('readable/writable accept readonly string[] in Phase 1', () => {
    const ab: AccessBoundary = {
      role: 'agent',
      readable: ['plan', 'class', 'students'],
      writable: ['phase', 'activeStepId'],
      actions: ['adjustDifficulty', 'flagForIntervention'],
      subscribes: ['events'],
    };
    expect(ab.readable).toContain('plan');
  });

  it('accepts custom string roles beyond agent/picker/admin', () => {
    const ab: AccessBoundary = {
      role: 'teacher', // solution-defined custom role
      readable: ['plan'],
      writable: [],
      actions: [],
    };
    expect(ab.role).toBe('teacher');
  });

  it('rejects Phase 4 BoundaryPathEntry shape (predicate entries) at compile time', () => {
    const ab: AccessBoundary = {
      role: 'agent',
      readable: [
        // @ts-expect-error — predicate entries land in Phase 4 alongside BoundaryPredicate
        { slot: 'events', where: { op: 'eq', path: 'row.studentId', value: 'x' } },
      ],
      writable: [],
      actions: [],
    };
    expect(ab.role).toBe('agent');
  });
});

describe('LifecycleDef', () => {
  it('all hook fields are optional', () => {
    const empty: LifecycleDef = {};
    expect(Object.keys(empty)).toHaveLength(0);
  });

  it('accepts the four hook kinds', () => {
    const hooks: LifecycleDef = {
      onActivate: 'startObservationStream',
      onDeactivate: 'generateSessionReport',
      onSlotChange: 'rebindStudents',
      onStateChange: 'broadcastStateToFrontend',
    };
    expect(hooks.onActivate).toBe('startObservationStream');
  });
});

describe('ManifestDef integration (LessonSession shape)', () => {
  it('composes the full surface end-to-end', () => {
    const version: SchemaVersion = '1.0.0';
    const LessonSession: ManifestDef = {
      name: 'LessonSession',
      displayName: '课堂会话',
      schemaVersion: version,
      semantic:
        'A single in-progress run of a LessonPlan with a specific Class.',
      slots: [
        {
          apiName: 'plan',
          displayName: '教学计划',
          target: { kind: 'objectType', apiName: 'LessonPlan' },
          required: true,
          semantic: 'The lesson plan being executed.',
        },
        {
          apiName: 'students',
          displayName: '学生',
          target: { kind: 'objectType', apiName: 'Student' },
          collection: true,
          derivedFrom: 'class.contains',
          semantic: 'Derived from class.contains.',
        },
      ],
      streams: [
        {
          apiName: 'events',
          displayName: '课堂事件流',
          payloadType: 'ClassroomEvent',
          backpressure: 'drop_oldest',
          semantic: 'Push stream of ClassroomEvent.',
        },
      ],
      state: [
        {
          apiName: 'phase',
          displayName: '当前阶段',
          schema: z.enum(['waiting', 'listen', 'practice', 'discuss', 'ended']),
          initial: 'waiting',
          semantic: 'Current teaching phase.',
        },
      ],
      boundaries: [
        {
          role: 'agent',
          readable: ['plan', 'students'],
          writable: ['phase'],
          actions: ['flagForIntervention'],
          subscribes: ['events'],
        },
        {
          role: 'admin',
          readable: ['*'],
          writable: ['*'],
          actions: ['*'],
        },
      ],
      lifecycle: {
        onActivate: 'startObservationStream',
        onDeactivate: 'generateSessionReport',
      },
    };

    expect(LessonSession.name).toBe('LessonSession');
    expect(LessonSession.slots).toHaveLength(2);
    expect(LessonSession.boundaries.find((b) => b.role === 'admin')?.readable).toContain(
      '*',
    );
  });

  it('rejects Phase 5 field `notifications` at compile time', () => {
    const m: ManifestDef = {
      name: 'X',
      displayName: 'X',
      schemaVersion: '0.0.1',
      semantic: 's',
      slots: [],
      state: [],
      boundaries: [],
      // @ts-expect-error — Tier 3 (G10); lands in Phase 5
      notifications: [],
    };
    expect(m.name).toBe('X');
  });
});
