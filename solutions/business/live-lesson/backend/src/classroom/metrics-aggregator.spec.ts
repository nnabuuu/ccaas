import { MetricsAggregator } from './metrics-aggregator';
import { Student } from '../entities/student.entity';
import { AiQuestion } from '../entities/ai-question.entity';
import type { TaskMap, ResolvedObserve } from '../schemas';
import { resolveObserve } from '../schemas';

function makeStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 'stu-1',
    sessionId: 'sess-1',
    name: 'Alice',
    currentTask: 1,
    currentPhase: 'practice',
    joinedAt: new Date('2025-01-01T10:00:00Z'),
    stepStartedAt: null,
    ...overrides,
  } as Student;
}

function makeTaskMap(maxTask = 3): TaskMap {
  const stepToTask: Record<number, number> = {};
  const taskToStep: Record<number, number> = {};
  const taskSteps: number[] = [];
  for (let i = 1; i <= maxTask; i++) {
    const stepIdx = i * 2 - 1;
    stepToTask[stepIdx] = i;
    taskToStep[i] = stepIdx;
    taskSteps.push(stepIdx);
  }
  const advanceOn: Record<number, 'submit' | 'confirm'> = {};
  for (const step of taskSteps) advanceOn[step] = 'confirm';
  return { stepToTask, taskToStep, taskSteps, maxTask, advanceOn };
}

function makeSubsByStudent(
  entries: Array<{ studentId: string; step: number; score: any; data?: any; submittedAt?: string }>,
): Map<string, Record<number, { step: number; data: any; score: any; submittedAt: string }>> {
  const map = new Map<string, Record<number, any>>();
  for (const e of entries) {
    if (!map.has(e.studentId)) map.set(e.studentId, {});
    map.get(e.studentId)![e.step] = {
      step: e.step,
      data: e.data || {},
      score: e.score,
      submittedAt: e.submittedAt || '2025-01-01T10:05:00Z',
    };
  }
  return map;
}

describe('MetricsAggregator', () => {
  const agg = new MetricsAggregator();

  describe('formatDuration', () => {
    it('formats 0 seconds', () => {
      expect(agg.formatDuration(0)).toBe('0:00');
    });

    it('formats seconds < 60', () => {
      expect(agg.formatDuration(45)).toBe('0:45');
    });

    it('formats minutes and seconds', () => {
      expect(agg.formatDuration(250)).toBe('4:10');
    });

    it('pads single-digit seconds', () => {
      expect(agg.formatDuration(62)).toBe('1:02');
    });
  });

  describe('deriveResult', () => {
    it('returns correct for score 100', () => {
      expect(agg.deriveResult({ total: 100 })).toBe('correct');
    });

    it('returns wrong for score 0', () => {
      expect(agg.deriveResult({ total: 0 })).toBe('wrong');
    });

    it('returns partial for score 1-99', () => {
      expect(agg.deriveResult({ total: 50 })).toBe('partial');
    });

    it('returns partial for null score', () => {
      expect(agg.deriveResult(null)).toBe('partial');
    });

    it('returns partial when total is missing', () => {
      expect(agg.deriveResult({})).toBe('partial');
    });
  });

  describe('computeStudentDurations', () => {
    it('uses joinedAt for first task, submittedAt difference for subsequent', () => {
      const taskMap = makeTaskMap(2);
      const student = makeStudent({
        joinedAt: new Date('2025-01-01T10:00:00Z'),
      });
      const subs = makeSubsByStudent([
        { studentId: 'stu-1', step: 1, score: { total: 100 }, submittedAt: '2025-01-01T10:03:00Z' },
        { studentId: 'stu-1', step: 3, score: { total: 80 }, submittedAt: '2025-01-01T10:08:00Z' },
      ]);

      const result = agg.computeStudentDurations([student], subs, taskMap);
      const durations = result.get('stu-1')!;
      expect(durations[1]).toBe(180); // 3 minutes
      expect(durations[3]).toBe(300); // 5 minutes
    });

    it('skips students with no submissions', () => {
      const taskMap = makeTaskMap(1);
      const student = makeStudent();
      const result = agg.computeStudentDurations([student], new Map(), taskMap);
      expect(result.has('stu-1')).toBe(false);
    });
  });

  describe('computeStudentStatus', () => {
    const taskMap = makeTaskMap(3);

    it('returns done for completed phase', () => {
      const student = makeStudent({ currentPhase: 'completed' });
      expect(agg.computeStudentStatus(student, undefined, {}, taskMap)).toBe('done');
    });

    it('returns done when all task steps submitted', () => {
      const student = makeStudent({ currentTask: 3 });
      const subs = { 1: {}, 3: {}, 5: {} } as any;
      expect(agg.computeStudentStatus(student, subs, {}, taskMap)).toBe('done');
    });

    it('returns reading for listen phase', () => {
      const student = makeStudent({ currentPhase: 'listen' });
      expect(agg.computeStudentStatus(student, undefined, {}, taskMap)).toBe('reading');
    });

    it('returns stuck when elapsed > median * 1.5', () => {
      const student = makeStudent({
        currentTask: 1,
        stepStartedAt: new Date(Date.now() - 200_000).toISOString(), // 200s ago
      });
      const medianTimes = { 1: 60 }; // 60s median → stuck threshold = 90s
      expect(agg.computeStudentStatus(student, undefined, medianTimes, taskMap)).toBe('stuck');
    });

    it('returns prog when not stuck', () => {
      const student = makeStudent({
        currentTask: 1,
        stepStartedAt: new Date(Date.now() - 10_000).toISOString(), // 10s ago
      });
      const medianTimes = { 1: 60 };
      expect(agg.computeStudentStatus(student, undefined, medianTimes, taskMap)).toBe('prog');
    });
  });

  describe('computeHealthCards', () => {
    it('computes furthest, median, stuck, AI totals', () => {
      const students = [
        makeStudent({ id: 's1', currentTask: 3, currentPhase: 'practice' }),
        makeStudent({ id: 's2', currentTask: 2, currentPhase: 'practice' }),
        makeStudent({ id: 's3', currentTask: 1, currentPhase: 'practice' }),
      ];
      const statuses = new Map([['s1', 'prog'], ['s2', 'prog'], ['s3', 'stuck']]);
      const questions = [
        { studentId: 's1' } as AiQuestion,
        { studentId: 's1' } as AiQuestion,
        { studentId: 's2' } as AiQuestion,
      ];

      const result = agg.computeHealthCards(students, statuses, questions, 3);
      expect(result.furthest.step).toBe(3);
      expect(result.furthest.count).toBe(1);
      expect(result.median.step).toBe(2);
      expect(result.stuck.count).toBe(1);
      expect(result.aiTotal.rounds).toBe(3);
      expect(result.aiTotal.people).toBe(2);
    });

    it('handles empty students', () => {
      const result = agg.computeHealthCards([], new Map(), [], 3);
      expect(result.furthest.step).toBe(0);
      expect(result.median.step).toBe(0);
      expect(result.stuck.count).toBe(0);
    });
  });

  describe('computeAlertTag', () => {
    it('returns stuck alert when >= 5 students stuck at step', () => {
      const students = Array.from({ length: 6 }, (_, i) =>
        makeStudent({ id: `s${i}`, currentTask: 1 }),
      );
      const statuses = new Map(students.map(s => [s.id, 'stuck']));
      const metrics = { byDimension: {}, issues: [] };
      const tag = agg.computeAlertTag(1, metrics, students, statuses);
      expect(tag).toBe('6 人卡住');
    });

    it('returns wrong dimension alert when wrong >= 30%', () => {
      const metrics = {
        byDimension: { 'Q1': { good: 50, partial: 10, wrong: 40 } },
        issues: [],
      };
      const tag = agg.computeAlertTag(1, metrics, [], new Map());
      expect(tag).toBe('Q1 错误偏高');
    });

    it('returns walkthrough alert when walkthroughRate >= 50%', () => {
      const metrics = {
        byDimension: { 'Q1': { good: 80, partial: 10, wrong: 10 } },
        attemptMetrics: { 'Q1': { avgAttempts: 2.5, walkthroughRate: 55 } },
        issues: [],
      };
      const tag = agg.computeAlertTag(1, metrics, [], new Map());
      expect(tag).toBe('Q1 半数需提示');
    });

    it('returns null when no alerts', () => {
      const metrics = { byDimension: {}, issues: [] };
      const tag = agg.computeAlertTag(1, metrics, [], new Map());
      expect(tag).toBeNull();
    });

    it('prioritizes stuck over wrong dimension', () => {
      const students = Array.from({ length: 5 }, (_, i) =>
        makeStudent({ id: `s${i}`, currentTask: 2 }),
      );
      const statuses = new Map(students.map(s => [s.id, 'stuck']));
      const metrics = {
        byDimension: { 'Q1': { good: 50, partial: 10, wrong: 40 } },
        issues: [],
      };
      const tag = agg.computeAlertTag(2, metrics, students, statuses);
      expect(tag).toBe('5 人卡住');
    });
  });

  describe('buildStepMetrics', () => {
    it('aggregates scores, dimensions, timing, and AI stats', () => {
      const taskMap = makeTaskMap(1);
      const manifest = {
        readingSteps: [{
          idx: 1, label: 'Quiz Step', strategy: 'quiz',
          answerKey: {
            type: 'quiz',
            answers: [
              { questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] },
            ],
          },
        }],
      };

      const students = [
        makeStudent({ id: 's1', currentTask: 2 }),
        makeStudent({ id: 's2', currentTask: 2 }),
      ];

      const subs = makeSubsByStudent([
        {
          studentId: 's1', step: 1,
          score: { total: 100, byDimension: { q0: true } },
          submittedAt: '2025-01-01T10:03:00Z',
        },
        {
          studentId: 's2', step: 1,
          score: { total: 0, byDimension: { q0: false } },
          submittedAt: '2025-01-01T10:04:00Z',
        },
      ]);

      const questions = [
        { studentId: 's2', step: 1, category: '理解' } as AiQuestion,
      ];

      const durations = new Map([
        ['s1', { 1: 180 }],
        ['s2', { 1: 240 }],
      ]);

      const result = agg.buildStepMetrics(2, students, subs, questions, durations, manifest, taskMap);

      expect(result[1]).toBeDefined();
      expect(result[1].completedCount).toBe(2);
      expect(result[1].avgScore).toBe(50);
      expect(result[1].aiRounds).toBe(1);
      expect(result[1].aiPeople).toBe(1);
      expect(result[1].name).toBe('Quiz Step');
    });

    it('handles empty students array', () => {
      const taskMap = makeTaskMap(1);
      const manifest = { readingSteps: [{ idx: 1, label: 'S1' }] };
      const result = agg.buildStepMetrics(0, [], new Map(), [], new Map(), manifest, taskMap);
      expect(result[1]).toBeDefined();
      expect(result[1].completedCount).toBe(0);
      expect(result[1].avgScore).toBe(0);
    });
  });

  describe('detectIssues (via buildStepMetrics)', () => {
    it('detects quiz wrong-answer patterns with count >= 2', () => {
      const taskMap = makeTaskMap(1);
      const manifest = {
        readingSteps: [{
          idx: 1, label: 'Quiz', strategy: 'quiz',
          answerKey: {
            type: 'quiz',
            answers: [
              { questionIdx: 0, correct: 1, questionText: 'Q1', options: ['A', 'B'] },
            ],
          },
        }],
      };
      const students = [
        makeStudent({ id: 's1' }), makeStudent({ id: 's2' }), makeStudent({ id: 's3' }),
      ];
      const subs = makeSubsByStudent([
        { studentId: 's1', step: 1, data: { answers: [0] }, score: { total: 0 } },
        { studentId: 's2', step: 1, data: { answers: [0] }, score: { total: 0 } },
        { studentId: 's3', step: 1, data: { answers: [1] }, score: { total: 100 } },
      ]);

      const result = agg.buildStepMetrics(3, students, subs, [], new Map(), manifest, taskMap);
      expect(result[1].issues.length).toBeGreaterThanOrEqual(1);
      expect(result[1].issues[0]).toContain('2 人');
    });
  });

  describe('map type with resolvedObserves', () => {
    it('uses resolved dimension names for map answerKey', () => {
      const taskMap = makeTaskMap(1);
      const answerKey = {
        type: 'map',
        items: [
          { id: 'kohl', label: 'Kohl' },
          { id: 'henna', label: 'Henna' },
        ],
      };
      const manifest = {
        readingSteps: [{ idx: 1, label: 'Map It', answerKey }],
      };

      const resolved = resolveObserve({ answerKey });
      const resolvedObserves: Record<number, ResolvedObserve> = { 1: resolved };

      const students = [
        makeStudent({ id: 's1', currentTask: 2 }),
        makeStudent({ id: 's2', currentTask: 2 }),
      ];
      const subs = makeSubsByStudent([
        {
          studentId: 's1', step: 1,
          score: { total: 80, byDimension: { kohl_placed: true, kohl_reasoned: true, kohl_positionScore: 70, henna_placed: false, henna_reasoned: false, henna_positionScore: 0 } },
        },
        {
          studentId: 's2', step: 1,
          score: { total: 60, byDimension: { kohl_placed: true, kohl_reasoned: false, kohl_positionScore: 50, henna_placed: true, henna_reasoned: true, henna_positionScore: 40 } },
        },
      ]);

      const result = agg.buildStepMetrics(2, students, subs, [], new Map(), manifest, taskMap, resolvedObserves);

      // Dimension names should be human-readable
      expect(result[1].byDimension['Kohl \u2014 Placed']).toBeDefined();
      expect(result[1].byDimension['Henna \u2014 Reasoning']).toBeDefined();
      expect(result[1].byDimension['kohl_placed']).toBeUndefined();

      // dimensionLabels should be present
      expect(result[1].dimensionLabels['kohl_placed']).toBe('Kohl \u2014 Placed');
      expect(result[1].dimensionLabels['henna_positionScore']).toBe('Henna \u2014 Position');
    });

    it('detects issues using observe rules for map type', () => {
      const taskMap = makeTaskMap(1);
      const answerKey = {
        type: 'map',
        items: [{ id: 'art', label: 'Art' }],
      };
      const manifest = {
        readingSteps: [{ idx: 1, label: 'Map', answerKey }],
      };

      const resolved = resolveObserve({ answerKey });
      const resolvedObserves: Record<number, ResolvedObserve> = { 1: resolved };

      const students = [
        makeStudent({ id: 's1', currentTask: 2 }),
        makeStudent({ id: 's2', currentTask: 2 }),
        makeStudent({ id: 's3', currentTask: 2 }),
      ];
      // 2/3 students have art_placed = false → 67% wrong → should trigger *_placed rule (threshold 30)
      const subs = makeSubsByStudent([
        { studentId: 's1', step: 1, score: { total: 0, byDimension: { art_placed: false, art_reasoned: false, art_positionScore: 0 } } },
        { studentId: 's2', step: 1, score: { total: 0, byDimension: { art_placed: false, art_reasoned: true, art_positionScore: 50 } } },
        { studentId: 's3', step: 1, score: { total: 100, byDimension: { art_placed: true, art_reasoned: true, art_positionScore: 80 } } },
      ]);

      const result = agg.buildStepMetrics(3, students, subs, [], new Map(), manifest, taskMap, resolvedObserves);
      expect(result[1].issues.some((i: string) => i.includes('未放置'))).toBe(true);
    });
  });

  describe('select-evidence type with resolvedObserves', () => {
    it('uses resolved dimension names for select-evidence', () => {
      const taskMap = makeTaskMap(1);
      const answerKey = {
        type: 'select-evidence',
        sections: [
          { id: 'intro', label: 'Introduction' },
          { id: 'body', label: 'Body' },
        ],
      };
      const manifest = {
        readingSteps: [{ idx: 1, label: 'Evidence', answerKey }],
      };

      const resolved = resolveObserve({ answerKey });
      const resolvedObserves: Record<number, ResolvedObserve> = { 1: resolved };

      const students = [
        makeStudent({ id: 's1', currentTask: 2 }),
      ];
      const subs = makeSubsByStudent([
        {
          studentId: 's1', step: 1,
          score: { total: 50, byDimension: { intro_func: true, body_func: false } },
        },
      ]);

      const result = agg.buildStepMetrics(1, students, subs, [], new Map(), manifest, taskMap, resolvedObserves);
      expect(result[1].byDimension['Introduction Function']).toBeDefined();
      expect(result[1].byDimension['Body Function']).toBeDefined();
      expect(result[1].dimensionLabels['intro_func']).toBe('Introduction Function');
    });
  });

  describe('buildSurfaces', () => {
    it('extracts reasoning surface data from submissions', () => {
      const taskMap = makeTaskMap(1);
      const subs = makeSubsByStudent([
        {
          studentId: 's1', step: 1,
          data: { reasons: { kohl: 'Because it is traditional', henna: 'Cultural significance' } },
          score: { total: 80 },
        },
        {
          studentId: 's2', step: 1,
          data: { reasons: { kohl: 'Used for beauty' } },
          score: { total: 60 },
        },
      ]);

      const surfaces = [
        { type: 'reasoning' as const, source: 'data.reasons', label: 'Student Reasoning' },
      ];

      const result = agg.buildSurfaces(1, subs, 1, surfaces, [
        { id: 's1', name: 'Alice' },
        { id: 's2', name: 'Bob' },
      ]);

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBe(3); // 2 from Alice + 1 from Bob
      expect(result.reasoning[0]).toMatchObject({ studentName: 'Alice', itemId: 'kohl' });
    });

    it('extracts positions surface data', () => {
      const subs = makeSubsByStudent([
        {
          studentId: 's1', step: 1,
          data: { placements: { kohl: [0.5, 0.3], henna: [-0.2, 0.8] } },
          score: { total: 80 },
        },
      ]);

      const surfaces = [
        { type: 'positions' as const, source: 'data.placements', label: 'Positions' },
      ];

      const result = agg.buildSurfaces(1, subs, 1, surfaces, [
        { id: 's1', name: 'Alice' },
      ]);

      expect(result.positions).toBeDefined();
      expect(result.positions).toHaveLength(2);
      expect(result.positions[0]).toMatchObject({ itemId: 'kohl', x: 0.5, y: 0.3 });
    });

    it('extracts llmFeedback surface data', () => {
      const subs = makeSubsByStudent([
        {
          studentId: 's1', step: 1,
          data: {},
          score: { total: 80, llmFeedback: 'Good understanding of the topic.' },
        },
      ]);

      const surfaces = [
        { type: 'llmFeedback' as const, source: 'score.llmFeedback', label: 'AI Feedback' },
      ];

      const result = agg.buildSurfaces(1, subs, 1, surfaces, [
        { id: 's1', name: 'Alice' },
      ]);

      expect(result.llmFeedback).toBeDefined();
      expect(result.llmFeedback[0]).toMatchObject({ studentName: 'Alice', feedback: 'Good understanding of the topic.' });
    });

    it('returns empty for students without submissions', () => {
      const subs = new Map<string, Record<number, any>>();
      const surfaces = [
        { type: 'reasoning' as const, source: 'data.reasons', label: 'Reasoning' },
      ];

      const result = agg.buildSurfaces(1, subs, 1, surfaces, []);
      expect(result.reasoning).toEqual([]);
    });
  });

  describe('dimensionLabels output', () => {
    it('includes dimensionLabels in stepMetrics without resolvedObserves', () => {
      const taskMap = makeTaskMap(1);
      const manifest = {
        readingSteps: [{
          idx: 1, label: 'Quiz',
          answerKey: {
            type: 'quiz',
            answers: [{ questionIdx: 0, correct: 1, label: 'Main Idea' }],
          },
        }],
      };
      const students = [makeStudent({ id: 's1', currentTask: 2 })];
      const subs = makeSubsByStudent([
        { studentId: 's1', step: 1, score: { total: 100, byDimension: { q0: true } } },
      ]);

      const result = agg.buildStepMetrics(1, students, subs, [], new Map(), manifest, taskMap);
      expect(result[1].dimensionLabels).toBeDefined();
      expect(result[1].dimensionLabels['q0']).toBe('Main Idea');
    });
  });
});
