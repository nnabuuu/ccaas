/**
 * MatrixObserveHandler unit tests.
 *
 * Was 57.7% function / 79% statement covered. Drives compute() through the
 * three branches it owns:
 *   - stats roll-up across multiple students
 *   - row distribution + quality split (whatDist/whyDist)
 *   - detectPatterns: why_blank, what_stronger, quality_drop
 */
import { MatrixObserveHandler } from './matrix.handler';
import type { ObserveContext } from '../observe-handler.interface';
import type { Student } from '../../../entities/student.entity';
import type { Submission } from '../../../entities/submission.entity';

function mkStudent(id: string, name: string): Student {
  return { id, name } as Student;
}

function mkSub(stepIdx: number, rows: Array<Record<string, string>>, cellQualities?: Record<string, { whatQ: number; whyQ: number }>): Submission {
  return {
    stepIdx,
    dataJson: { rows },
    scoreJson: cellQualities ? { cellQualities } : {},
  } as unknown as Submission;
}

const ROWS = [
  { rowIdx: 0, place: 'A', whatPrompt: 'concept A', paraRef: [1] },
  { rowIdx: 1, place: 'B', whatPrompt: 'concept B' },
  { rowIdx: 2, place: 'C', whatPrompt: 'concept C', isDemo: true }, // ignored
  { rowIdx: 3, place: 'D', whatPrompt: 'concept D' },
  { rowIdx: 4, place: 'E', whatPrompt: 'concept E' },
];

// `answers` is a non-empty tuple type — relax via cast for fixture clarity.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const KEY = { type: 'matrix' as const, answers: ROWS } as any;

function buildCtx(over: Partial<ObserveContext>): ObserveContext {
  return {
    sessionId: 's',
    lessonId: 'l',
    students: [],
    subsByStudent: new Map(),
    stepIdx: 1,
    answerKey: KEY,
    view: 'latest',
    ...over,
  };
}

describe('MatrixObserveHandler.compute', () => {
  it('returns zeroed stats when no students submitted', () => {
    const h = new MatrixObserveHandler();
    const out = h.compute(buildCtx({
      students: [mkStudent('s1', 'Alice')],
      // No submission for student s1 → not counted as submitted
      subsByStudent: new Map(),
    }));
    expect(out.stats.submitted).toBe(0);
    expect(out.stats.totalStudents).toBe(1);
    expect(out.stats.avgCompletion).toBe(0);
    expect(out.stats.avgQuality).toBe(0);
    expect(out.patterns).toEqual([]);
  });

  it('throws when given a non-matrix answerKey', () => {
    const h = new MatrixObserveHandler();
    expect(() =>
      h.compute(buildCtx({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        answerKey: { type: 'quiz' } as any,
      })),
    ).toThrow(/MatrixObserveHandler expects matrix answerKey/);
  });

  it('uses cellQualities from scoreJson when present (not textQuality)', () => {
    const h = new MatrixObserveHandler();
    const subs = new Map<string, Record<number, Submission>>();
    subs.set('s1', {
      1: mkSub(1, [
        { practice: 'one two three four five six seven eight nine ten', reason: 'short' },
        { practice: 'p', reason: 'r' },
        { practice: '', reason: '' }, // demo row — ignored
        { practice: 'a', reason: 'b' },
        { practice: 'c', reason: 'd' },
      ], {
        '0': { whatQ: 3, whyQ: 3 }, // override what textQuality would compute
        '1': { whatQ: 2, whyQ: 1 },
        '3': { whatQ: 1, whyQ: 1 },
        '4': { whatQ: 1, whyQ: 1 },
      }),
    });
    const out = h.compute(buildCtx({ students: [mkStudent('s1', 'A')], subsByStudent: subs }));
    expect(out.students).toHaveLength(1);
    expect(out.students[0].responses['0'].whatQ).toBe(3);
    expect(out.students[0].responses['0'].whyQ).toBe(3);
  });

  it('rolls up the why_blank pattern when >=2 students have ≥30% empty Why cells', () => {
    const h = new MatrixObserveHandler();
    const subs = new Map<string, Record<number, Submission>>();
    // Each student has 4 practice rows; ≥30% of 4 = 2 empty Why cells
    subs.set('s1', {
      1: mkSub(1, [
        { practice: 'what a', reason: 'why a' },
        { practice: 'what b', reason: '' }, // empty why
        { practice: '', reason: '' },        // demo (ignored)
        { practice: 'what d', reason: '' }, // empty why
        { practice: 'what e', reason: 'why e' },
      ]),
    });
    subs.set('s2', {
      1: mkSub(1, [
        { practice: 'wa', reason: '' },
        { practice: 'wb', reason: '' },
        { practice: '', reason: '' },
        { practice: 'wd', reason: 'wd-r' },
        { practice: 'we', reason: 'we-r' },
      ]),
    });
    const out = h.compute(buildCtx({
      students: [mkStudent('s1', 'A'), mkStudent('s2', 'B')],
      subsByStudent: subs,
    }));
    const blank = out.patterns.find(p => p.id === 'why_blank');
    expect(blank).toBeDefined();
    expect(blank!.count).toBe(2);
    // medium severity since <5 students
    expect(blank!.severity).toBe('medium');
  });

  it('marks high severity when 5 students have empty Why', () => {
    const h = new MatrixObserveHandler();
    const subs = new Map<string, Record<number, Submission>>();
    for (let i = 0; i < 5; i++) {
      subs.set('s' + i, {
        1: mkSub(1, [
          { practice: 'x', reason: '' },
          { practice: 'y', reason: '' },
          { practice: '', reason: '' },
          { practice: 'z', reason: 'r' },
          { practice: 'w', reason: 'r' },
        ]),
      });
    }
    const students = Array.from({ length: 5 }, (_, i) => mkStudent('s' + i, 'N' + i));
    const out = h.compute(buildCtx({ students, subsByStudent: subs }));
    const blank = out.patterns.find(p => p.id === 'why_blank');
    expect(blank?.severity).toBe('high');
  });

  it('rolls up the what_stronger pattern when What scores beat Why by >0.8 globally', () => {
    const h = new MatrixObserveHandler();
    const subs = new Map<string, Record<number, Submission>>();
    // Both students: cellQualities force What=3, Why=1 (diff=2)
    const cellQ = { '0': { whatQ: 3, whyQ: 1 }, '1': { whatQ: 3, whyQ: 1 }, '3': { whatQ: 3, whyQ: 1 }, '4': { whatQ: 3, whyQ: 1 } };
    subs.set('s1', { 1: mkSub(1, [
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
      { practice: '', reason: '' },
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
    ], cellQ) });
    subs.set('s2', { 1: mkSub(1, [
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
      { practice: '', reason: '' },
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
    ], cellQ) });
    const out = h.compute(buildCtx({
      students: [mkStudent('s1', 'A'), mkStudent('s2', 'B')],
      subsByStudent: subs,
    }));
    expect(out.patterns.some(p => p.id === 'what_stronger')).toBe(true);
  });

  it('rolls up the quality_drop pattern when first-half rows score >0.5 higher than second-half', () => {
    const h = new MatrixObserveHandler();
    // We have 4 non-demo rows in the answer key (rowIdx 0,1,3,4).
    // First half = 2 rows, second half = 2 rows.
    // Force first half whatQ=3,whyQ=3 (avg=3) and second half whatQ=1,whyQ=1 (avg=1).
    const cellQ = {
      '0': { whatQ: 3, whyQ: 3 },
      '1': { whatQ: 3, whyQ: 3 },
      '3': { whatQ: 1, whyQ: 1 },
      '4': { whatQ: 1, whyQ: 1 },
    };
    const subs = new Map<string, Record<number, Submission>>();
    subs.set('s1', { 1: mkSub(1, [
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
      { practice: '', reason: '' },
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
    ], cellQ) });
    subs.set('s2', { 1: mkSub(1, [
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
      { practice: '', reason: '' },
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
    ], cellQ) });
    const out = h.compute(buildCtx({
      students: [mkStudent('s1', 'A'), mkStudent('s2', 'B')],
      subsByStudent: subs,
    }));
    expect(out.patterns.some(p => p.id === 'quality_drop')).toBe(true);
  });

  it('emits per-row stats with whatAvg/whyAvg and a length-4 distribution', () => {
    const h = new MatrixObserveHandler();
    const cellQ = {
      '0': { whatQ: 3, whyQ: 0 },
      '1': { whatQ: 1, whyQ: 2 },
      '3': { whatQ: 2, whyQ: 1 },
      '4': { whatQ: 0, whyQ: 3 },
    };
    const subs = new Map<string, Record<number, Submission>>();
    subs.set('s1', { 1: mkSub(1, [
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
      { practice: '', reason: '' },
      { practice: 'a', reason: 'b' },
      { practice: 'a', reason: 'b' },
    ], cellQ) });
    const out = h.compute(buildCtx({ students: [mkStudent('s1', 'A')], subsByStudent: subs }));
    expect(out.rows).toHaveLength(4);
    out.rows.forEach(r => {
      expect(r.whatDist).toHaveLength(4);
      expect(r.whyDist).toHaveLength(4);
      const total = r.whatDist.reduce((a, b) => a + b, 0);
      expect(total).toBe(1);
    });
    expect(out.rows[0].concept).toBe('concept A');
    expect(out.rows[0].paraRef).toBe('1');
  });

  it('flags students with low completion and low quality in keyInsights', () => {
    const h = new MatrixObserveHandler();
    const subs = new Map<string, Record<number, Submission>>();
    // Student leaves most cells blank → completion < 50, quality 0.
    subs.set('s1', { 1: mkSub(1, [
      { practice: 'a', reason: '' },
      { practice: '', reason: '' },
      { practice: '', reason: '' },
      { practice: '', reason: '' },
      { practice: '', reason: '' },
    ]) });
    const out = h.compute(buildCtx({ students: [mkStudent('s1', 'A')], subsByStudent: subs }));
    const insights = out.students[0].keyInsights;
    expect(insights).toContain('完成度低于50%');
  });
});
