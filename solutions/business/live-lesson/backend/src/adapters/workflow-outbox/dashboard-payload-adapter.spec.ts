/**
 * DashboardPayloadAdapter unit tests — fixture-driven coverage of the
 * gist synthesis, alert derivation, indicatorStats groupBy, and
 * indicators filter. Pure function, no NestJS / DB.
 */

import {
  adaptDashboardPayload,
  parseDashboardPayload,
  type DashboardPayload,
  type DashboardFetchResult,
} from './dashboard-payload-adapter';

function emptyMetrics() {
  return {
    messageCount: 0,
    knowledgeCount: 0,
    misconceptionCount: 0,
    exerciseCorrectRate: null,
    lastActiveAt: null,
    currentStep: null,
  } as const;
}

type SpecStudent = DashboardPayload['students'][number];

function student(over: Partial<SpecStudent>): SpecStudent {
  return {
    studentId: 'student-1',
    studentName: 'Alice',
    status: null,
    metrics: emptyMetrics(),
    observations: [],
    ...over,
  };
}

function payload(students: DashboardPayload['students'], indicators: DashboardPayload['indicators'] = []): DashboardPayload {
  return {
    sessionId: 'sess-test',
    indicators,
    students,
    generatedAt: 999,
  };
}

describe('DashboardPayloadAdapter', () => {
  describe('parseDashboardPayload — defensive narrower', () => {
    it('returns null for non-object input', () => {
      expect(parseDashboardPayload(null)).toBeNull();
      expect(parseDashboardPayload(undefined)).toBeNull();
      expect(parseDashboardPayload('garbage')).toBeNull();
      expect(parseDashboardPayload(42)).toBeNull();
    });

    it('returns null when `students` is not an array', () => {
      expect(parseDashboardPayload({ sessionId: 's', students: 'oops' })).toBeNull();
    });

    it('preserves a well-formed payload', () => {
      const p = payload([]);
      expect(parseDashboardPayload(p)).toEqual(p);
    });
  });

  describe('adaptDashboardPayload — empty cases', () => {
    it('returns empty 4-array shape on null', () => {
      const out = adaptDashboardPayload(null);
      expect(out.logs).toEqual([]);
      expect(out.alerts).toEqual([]);
      expect(out.indicatorStats).toEqual([]);
      expect(out.indicators).toEqual([]);
    });

    it('returns empty 4-array shape on payload with no students', () => {
      const out = adaptDashboardPayload(payload([]));
      expect(out.logs).toEqual([]);
      expect(out.alerts).toEqual([]);
    });
  });

  describe('lifecycle gist synthesis (the M6.3 bug-fix)', () => {
    it('join with studentName → "Alice 加入课堂"', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'lifecycle',
                data: { action: 'join', studentName: 'Alice' },
                createdAt: 1000,
                updatedAt: 1000,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      const evt = out.logs[0].events[0];
      expect(evt.gist).toBe('Alice 加入课堂');
      expect(evt.source).toBe('system');
      expect(evt.systemType).toBe('join');
    });

    it('join without studentName falls back to slice.studentName', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            studentName: 'Bob',
            observations: [
              {
                id: 'o1',
                type: 'lifecycle',
                data: { action: 'join' },
                createdAt: 1000,
                updatedAt: 1000,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('Bob 加入课堂');
    });

    it('translate_request includes the word text', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'lifecycle',
                data: { action: 'translate_request', text: 'photosynthesis' },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('查词：photosynthesis');
    });

    it('leave with studentName → "Alice 离开课堂"', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'lifecycle',
                data: { action: 'leave', studentName: 'Alice' },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      const evt = out.logs[0].events[0];
      expect(evt.gist).toBe('Alice 离开课堂');
      expect(evt.systemType).toBe('leave');
    });

    it('discuss_complete + continue_chat_turn render fixed strings', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              { id: 'o1', type: 'lifecycle', data: { action: 'discuss_complete' }, createdAt: 1, updatedAt: 1, triggerEventId: 'e1' },
              { id: 'o2', type: 'lifecycle', data: { action: 'continue_chat_turn' }, createdAt: 2, updatedAt: 2, triggerEventId: 'e2' },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('完成讨论');
      expect(out.logs[0].events[1].gist).toBe('继续追问');
    });

    it('unknown lifecycle action falls back to the action string (never undefined)', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              { id: 'o1', type: 'lifecycle', data: { action: 'future_action' }, createdAt: 1, updatedAt: 1, triggerEventId: 'e1' },
            ],
          }),
        ]),
      );
      const gist = out.logs[0].events[0].gist;
      expect(gist).toBe('future_action');
      expect(gist).toBeDefined();
    });
  });

  describe('exercise + progress gist synthesis', () => {
    it('exercise with score → "提交 Step 3 答案，得分 85%"', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'exercise',
                data: { step: 3, score: 85 },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('提交 Step 3 答案，得分 85%');
      expect(out.logs[0].events[0].systemType).toBe('exercise_result');
    });

    it('exercise without step → "提交 Step ? 答案" (S2 legacy fallback, no raw object bleed)', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'exercise',
                data: { score: 50 },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('提交 Step ? 答案，得分 50%');
    });

    it('exercise with non-scalar step → falls back to "?" (no raw object render)', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'exercise',
                data: { step: { weird: true }, score: 10 },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('提交 Step ? 答案，得分 10%');
    });

    it('exercise without score → no suffix', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'exercise',
                data: { step: 3 },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('提交 Step 3 答案');
    });

    it('progress with taskNum + nextTask → "完成 Task 2，进入 Task 3"', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'progress',
                data: { step: 5, taskNum: 2, nextTask: 3 },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('完成 Task 2，进入 Task 3');
      expect(out.logs[0].events[0].systemType).toBe('step_complete');
    });

    it('progress with nextTask=null drops the suffix (S1 null guard)', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'progress',
                data: { taskNum: 2, nextTask: null },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('完成 Task 2');
    });

    it('progress missing taskNum falls back to step', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'progress',
                data: { step: 5 },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('完成 Task 5');
    });

    it('unknown observation type → opaque fallback (never undefined)', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'future_observation_type',
                data: {},
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      const gist = out.logs[0].events[0].gist;
      expect(gist).toBe('future_observation_type');
      expect(gist).toBeDefined();
    });
  });

  describe('indicator_hit pass-through + source=llm', () => {
    it('uses data.gist + data.quote + anchors with source=llm', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'indicator_hit',
                data: {
                  anchors: ['K1', 'M2'],
                  gist: 'student named photosynthesis correctly',
                  quote: 'I think it is photosynthesis',
                },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      const evt = out.logs[0].events[0];
      expect(evt.source).toBe('llm');
      expect(evt.gist).toBe('student named photosynthesis correctly');
      expect(evt.quote).toBe('I think it is photosynthesis');
      expect(evt.anchors).toEqual(['K1', 'M2']);
    });

    it('indicator_hit with empty/missing gist falls back to "(无 gist)"', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            observations: [
              {
                id: 'o1',
                type: 'indicator_hit',
                data: { anchors: ['K1'] },
                createdAt: 1,
                updatedAt: 1,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events[0].gist).toBe('(无 gist)');
    });
  });

  describe('student_status — drives alerts, never appears in events', () => {
    it('stuck → alert with severity=urgent; no event row', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            status: {
              current: 'stuck',
              previous: 'struggling',
              derivedAt: 5000,
              summary: '',
              alertMessage: null,
            },
            observations: [
              {
                id: 'st1',
                type: 'student_status',
                data: { status: 'stuck' },
                createdAt: 5000,
                updatedAt: 5000,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      expect(out.logs[0].events).toHaveLength(0);
      expect(out.alerts).toHaveLength(1);
      expect(out.alerts[0]).toMatchObject({
        severity: 'urgent',
        studentName: 'Alice',
        studentId: 'student-1',
        timestamp: 5000,
      });
      expect(out.alerts[0].message).toContain('Alice');
    });

    it('active / cruising → no alert', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            status: {
              current: 'active',
              previous: null,
              derivedAt: 1,
              summary: '',
              alertMessage: null,
            },
          }),
          student({
            studentId: 'student-2',
            studentName: 'Bob',
            status: {
              current: 'cruising',
              previous: null,
              derivedAt: 1,
              summary: '',
              alertMessage: null,
            },
          }),
        ]),
      );
      expect(out.alerts).toHaveLength(0);
    });

    it('uses alertMessage from status when present, otherwise synthesizes', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            status: {
              current: 'stuck',
              previous: null,
              derivedAt: 1,
              summary: '',
              alertMessage: 'Custom message from LLM',
            },
          }),
          student({
            studentId: 'student-2',
            studentName: 'Bob',
            status: {
              current: 'struggling',
              previous: null,
              derivedAt: 1,
              summary: '',
              alertMessage: null,
            },
          }),
        ]),
      );
      expect(out.alerts.find((a) => a.studentId === 'student-1')?.message).toBe(
        'Custom message from LLM',
      );
      expect(out.alerts.find((a) => a.studentId === 'student-2')?.message).toContain(
        'Bob',
      );
    });

    it('alerts sorted with urgent first', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            studentId: 'b',
            studentName: 'B',
            status: { current: 'idle', previous: null, derivedAt: 1, summary: '', alertMessage: null },
          }),
          student({
            studentId: 'a',
            studentName: 'A',
            status: { current: 'stuck', previous: null, derivedAt: 1, summary: '', alertMessage: null },
          }),
        ]),
      );
      expect(out.alerts.map((a) => a.severity)).toEqual(['urgent', 'info']);
    });
  });

  describe('indicatorStats groupBy', () => {
    it('counts unique students per anchor + picks latest gist', () => {
      const indicators = [
        { id: 'K1', type: 'knowledge', label: 'concept', description: '' },
        { id: 'M1', type: 'misconception', label: 'mix-up', description: '' },
      ];
      const out = adaptDashboardPayload(
        payload(
          [
            student({
              studentId: 'a',
              observations: [
                {
                  id: 'o1',
                  type: 'indicator_hit',
                  data: { anchors: ['K1'], gist: 'oldest' },
                  createdAt: 1,
                  updatedAt: 1,
                  triggerEventId: 'e1',
                },
              ],
            }),
            student({
              studentId: 'b',
              observations: [
                {
                  id: 'o2',
                  type: 'indicator_hit',
                  data: { anchors: ['K1', 'M1'], gist: 'newest' },
                  createdAt: 2,
                  updatedAt: 2,
                  triggerEventId: 'e2',
                },
              ],
            }),
          ],
          indicators,
        ),
      );
      const k1 = out.indicatorStats.find((s) => s.indicatorId === 'K1')!;
      expect(k1.studentCount).toBe(2);
      expect(k1.latestGist).toBe('newest');
      expect(k1.updatedAt).toBe(2);

      const m1 = out.indicatorStats.find((s) => s.indicatorId === 'M1')!;
      expect(m1.studentCount).toBe(1);
      expect(m1.latestGist).toBe('newest');
    });

    it('returns empty stats when no catalog registered', () => {
      const out = adaptDashboardPayload(
        payload(
          [
            student({
              observations: [
                {
                  id: 'o1',
                  type: 'indicator_hit',
                  data: { anchors: ['K1'], gist: 'x' },
                  createdAt: 1,
                  updatedAt: 1,
                  triggerEventId: 'e1',
                },
              ],
            }),
          ],
          [],
        ),
      );
      expect(out.indicatorStats).toEqual([]);
    });
  });

  describe('indicators filter — narrow to knowledge/misconception union', () => {
    it('drops invalid type values', () => {
      const out = adaptDashboardPayload(
        payload([], [
          { id: 'K1', type: 'knowledge', label: 'ok', description: 'desc' },
          { id: 'X1', type: 'process', label: 'bad', description: 'desc' },
          { id: 'M1', type: 'misconception', label: 'ok', description: 'desc' },
        ]),
      );
      expect(out.indicators.map((i) => i.id)).toEqual(['K1', 'M1']);
    });
  });

  describe('systemMetrics legacy compatibility (non-null fallbacks)', () => {
    it('S4 layered fallback: lastActiveAt prefers metrics.lastActiveAt when present', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            metrics: {
              messageCount: 2,
              knowledgeCount: 1,
              misconceptionCount: 1,
              exerciseCorrectRate: null,
              lastActiveAt: 1234,
              currentStep: 3,
            },
          }),
        ]),
      );
      expect(out.logs[0].systemMetrics.lastActiveAt).toBe(1234);
    });

    it('S4 layered fallback: when metrics.lastActiveAt=null, falls back to earliest observation createdAt', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            metrics: {
              messageCount: 0,
              knowledgeCount: 0,
              misconceptionCount: 0,
              exerciseCorrectRate: null,
              lastActiveAt: null,
              currentStep: null,
            },
            observations: [
              {
                id: 'lj',
                type: 'lifecycle',
                data: { action: 'join' },
                createdAt: 5000,
                updatedAt: 5000,
                triggerEventId: 'e1',
              },
            ],
          }),
        ]),
      );
      // Join-only student must NOT look active forever — preserves
      // frontend idle-detection math against M5 pass-1 MF2 family.
      expect(out.logs[0].systemMetrics.lastActiveAt).toBe(5000);
    });

    it('S4 layered fallback: no metrics, no observations → Date.now() final guard (non-null contract)', () => {
      const before = Date.now();
      const out = adaptDashboardPayload(
        payload([
          student({
            metrics: {
              messageCount: 0,
              knowledgeCount: 0,
              misconceptionCount: 0,
              exerciseCorrectRate: null,
              lastActiveAt: null,
              currentStep: null,
            },
            observations: [],
          }),
        ]),
      );
      const t = out.logs[0].systemMetrics.lastActiveAt;
      expect(typeof t).toBe('number');
      expect(t).toBeGreaterThanOrEqual(before);
    });

    it('exerciseCorrectRate=null falls back to 0; currentStep formatted', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            metrics: {
              messageCount: 2,
              knowledgeCount: 1,
              misconceptionCount: 1,
              exerciseCorrectRate: null,
              lastActiveAt: 1,
              currentStep: 3,
            },
          }),
        ]),
      );
      const m = out.logs[0].systemMetrics;
      expect(m.exerciseCorrectRate).toBe(0);
      expect(m.currentStep).toBe('step-3');
    });

    it('currentStep=null formats to empty string', () => {
      const out = adaptDashboardPayload(
        payload([
          student({
            metrics: {
              messageCount: 0,
              knowledgeCount: 0,
              misconceptionCount: 0,
              exerciseCorrectRate: 80,
              lastActiveAt: 12345,
              currentStep: null,
            },
          }),
        ]),
      );
      expect(out.logs[0].systemMetrics.currentStep).toBe('');
    });
  });

  describe('multiple students integration', () => {
    it('produces one log per student, alerts only for alertable students', () => {
      const out: DashboardFetchResult = adaptDashboardPayload(
        payload([
          student({
            studentId: 'a',
            studentName: 'A',
            status: { current: 'stuck', previous: null, derivedAt: 1, summary: '', alertMessage: null },
            observations: [
              { id: 'o1', type: 'indicator_hit', data: { anchors: ['M1'], gist: 'g1' }, createdAt: 1, updatedAt: 1, triggerEventId: 'e1' },
            ],
          }),
          student({
            studentId: 'b',
            studentName: 'B',
            status: { current: 'active', previous: null, derivedAt: 1, summary: '', alertMessage: null },
          }),
          student({
            studentId: 'c',
            studentName: 'C',
            status: null,
          }),
        ]),
      );
      expect(out.logs).toHaveLength(3);
      expect(out.alerts).toHaveLength(1);
      expect(out.alerts[0].studentId).toBe('a');
    });
  });
});
