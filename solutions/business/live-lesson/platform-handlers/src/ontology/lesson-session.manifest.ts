/**
 * `LessonSession` — the canonical manifest for a live-lesson run.
 *
 * Slot bindings: plan (Lesson), class (ClassroomSession), students
 * (collection derived from class.contains), resources (collection).
 *
 * State (lives in SessionMetadata KV — `manifest.LessonSession.<field>`):
 *   - phase: lifecycle of the session
 *   - activeResourceIndex: pointer into resources slot
 *
 * Streams:
 *   - events: classroom-side observer-engine events. Phase 3 ships the
 *     stream surface; the observer-engine bridge that publishes into
 *     `ManifestAccessorService.publish('events', ...)` lives in the
 *     live-lesson backend process — see docs/ontology/PROGRESS.md for
 *     the cross-process deferral.
 *
 * Boundaries:
 *   - agent: read plan/class/students/phase/activeResourceIndex,
 *     write phase + activeResourceIndex, subscribe events.
 *   - picker: read plan/class only; no streams; no actions.
 *   - admin: '*' (everything).
 *
 * Lifecycle skipped for first pass per the impl-plan.
 */

import { z } from 'zod';
import {
  defineManifest,
  defineStateField,
  type ManifestDef,
  type StreamDef,
} from '@kedge-agentic/ontology';

/**
 * Phase 5 M2 introduced `student_joined`. M3 extends the stream with
 * `student_submitted` (+ optional `score`), `step_completed`
 * (+ optional `taskNum`), and three system event variants used by
 * DiscussService / TranslateService / AiAskService.
 *
 * M4 adds `chat_turn` (LLM-driven indicator classification handler)
 * and `student_observation_changed` (cascade signal published when an
 * observation row is added — drives the M4 StatusChangeHandler).
 */
const EventPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('student_joined'),
    studentId: z.string(),
    classroomCode: z.string(),
  }),
  z.object({
    type: z.literal('student_submitted'),
    studentId: z.string(),
    step: z.number().int().nonnegative(),
    score: z.number().optional(),
  }),
  z.object({
    type: z.literal('step_completed'),
    studentId: z.string(),
    step: z.number().int().nonnegative(),
    taskNum: z.number().int().nonnegative().optional(),
    nextTask: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('translate_request'),
    studentId: z.string(),
    step: z.number().int().nonnegative().optional(),
    originalText: z.string().optional(),
  }),
  z.object({
    type: z.literal('discuss_complete'),
    studentId: z.string(),
    step: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('continue_chat_turn'),
    studentId: z.string(),
    step: z.number().int().nonnegative().optional(),
  }),
  /**
   * M4 — chat_turn: emitted by DiscussService/AiAskService/etc when a
   * round of student↔AI dialogue happens. ChatTurnHandler classifies
   * the turn against indicators + appends an indicator_hit observation.
   */
  z.object({
    type: z.literal('chat_turn'),
    studentId: z.string(),
    step: z.number().int().nonnegative().optional(),
    student: z.string(),
    ai: z.string(),
    /** Optional taskNum for legacy compat; ChatTurnHandler doesn't read it. */
    taskNum: z.number().int().nonnegative().optional(),
    /** Optional round counter from the discuss flow. */
    round: z.number().int().nonnegative().optional(),
  }),
  /**
   * M4 — student_observation_changed: cascade signal. ChatTurnHandler
   * publishes this AFTER writing an indicator_hit observation. The
   * StatusChangeHandler watches this stream to re-derive student_status.
   * Cross-process: published in-process from the platform action
   * handler (NOT pushed via the live-lesson outbox).
   */
  z.object({
    type: z.literal('student_observation_changed'),
    studentId: z.string(),
    trigger: z.string(),
  }),
]);

const eventsStream: StreamDef = {
  apiName: 'events',
  displayName: 'Classroom Events',
  payloadSchema: EventPayloadSchema,
  semantic: '课堂内学生加入/提交/状态变化等观察事件',
  backpressure: 'drop_oldest',
};

export const LessonSessionManifest: ManifestDef = defineManifest({
  name: 'LessonSession',
  displayName: '课时运行 / Lesson Session',
  schemaVersion: '0.1.0',
  semantic: '一次具体课堂运行的运行时上下文',
  slots: [
    {
      apiName: 'plan',
      displayName: '课程计划 / Plan',
      target: { kind: 'objectType', apiName: 'Lesson' },
      semantic: '本次课堂运行的 Lesson 定义',
    },
    {
      apiName: 'class',
      displayName: '课堂会话 / Classroom',
      target: { kind: 'objectType', apiName: 'ClassroomSession' },
      semantic: '本次课堂的 ClassroomSession 实例',
    },
    {
      apiName: 'students',
      displayName: '学生 / Students',
      target: { kind: 'objectType', apiName: 'Student' },
      collection: true,
      derivedFrom: 'class.contains',
      semantic: '本次课堂中的学生（从 class.contains 派生）',
    },
    {
      apiName: 'resources',
      displayName: '资源 / Resources',
      target: { kind: 'objectType', apiName: 'Resource' },
      collection: true,
      semantic: '本次课堂可用的资源列表',
    },
  ],
  streams: [eventsStream],
  state: [
    defineStateField({
      apiName: 'phase',
      displayName: '阶段 / Phase',
      schema: z.enum(['waiting', 'active', 'ended']),
      initial: 'waiting',
      semantic: '课堂生命周期阶段',
    }),
    defineStateField({
      apiName: 'activeResourceIndex',
      displayName: '当前资源索引 / Active Resource Index',
      schema: z.number().int().nonnegative(),
      initial: 0,
      semantic: '指向 resources 集合的当前下标',
    }),
  ],
  boundaries: [
    {
      role: 'agent',
      readable: [
        'plan',
        'class',
        'students',
        'resources',
        'phase',
        'activeResourceIndex',
      ],
      writable: ['phase', 'activeResourceIndex'],
      actions: ['emit_todo_card'],
      subscribes: ['events'],
    },
    {
      role: 'picker',
      readable: ['plan', 'class', 'students', 'resources'],
      writable: [],
      actions: [],
    },
    {
      role: 'admin',
      readable: ['*'],
      writable: ['*'],
      actions: ['*'],
      subscribes: ['*'],
    },
  ],
});
