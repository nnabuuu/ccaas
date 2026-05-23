import { GradingService } from './grading.service';
import { QuizGrader } from '../../domain/exercise-types/quiz/quiz.grader';
import { MatchGrader } from '../../domain/exercise-types/match/match.grader';
import { MatrixGrader } from '../../domain/exercise-types/matrix/matrix.grader';
import { StanceGrader } from '../../domain/exercise-types/stance/stance.grader';
import { OrderGrader } from '../../domain/exercise-types/order/order.grader';

import { createPluginRegistryTestingModule } from '../exercise/test-utils';

describe('GradingService (dispatcher)', () => {
  let service: GradingService;

  beforeEach(async () => {
    const { module, registry } = await createPluginRegistryTestingModule();
    service = new GradingService(registry);
    void module;
  });

  it('returns null for missing answerKey', async () => {
    expect(await service.grade(null, {})).toBeNull();
    expect(await service.grade(undefined, {})).toBeNull();
  });

  it('returns null for unknown type', async () => {
    expect(await service.grade({ type: 'unknown' }, {})).toBeNull();
  });

  it('returns null when answerKey has no type', async () => {
    expect(await service.grade({}, {})).toBeNull();
  });

  it('dispatches to correct plugin via registry', async () => {
    const result = await service.grade(
      { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, questionText: 'Q?', options: ['A', 'B'] }] },
      { answers: [0] },
    );
    expect(result!.total).toBe(100);
  });
});

describe('QuizGrader', () => {
  const grader = new QuizGrader();

  it('scores all correct', () => {
    const r = grader.grade(
      { type: 'quiz', answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1?', options: ['A', 'B'] }, { questionIdx: 1, correct: 0, questionText: 'Q2?', options: ['X', 'Y'] }] },
      { answers: [1, 0] },
    );
    expect(r.total).toBe(100);
    expect(r.byDimension).toEqual({ q0: true, q1: true });
  });

  it('scores partial', () => {
    const r = grader.grade(
      { type: 'quiz', answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1?', options: ['A', 'B'] }, { questionIdx: 1, correct: 0, questionText: 'Q2?', options: ['X', 'Y'] }] },
      { answers: [1, 1] },
    );
    expect(r.total).toBe(50);
    expect(r.byDimension.q0).toBe(true);
    expect(r.byDimension.q1).toBe(false);
  });

  it('includes attemptCounts when provided', () => {
    const r = grader.grade(
      { type: 'quiz', answers: [{ questionIdx: 0, correct: 1, questionText: 'Q?', options: ['A', 'B'] }] },
      { answers: [1], attemptCounts: { 0: 3 } },
    );
    expect(r.attemptCounts).toEqual({ q0: 3 });
  });

  it('handles empty answers gracefully', () => {
    const r = grader.grade({ type: 'quiz', answers: [] as any }, {});
    expect(r.total).toBe(0);
    expect(r.byDimension).toEqual({});
    expect(r.attemptCounts).toBeUndefined();
  });

  it('falls back to 1 when attemptCounts index is missing', () => {
    const r = grader.grade(
      { type: 'quiz', answers: [{ questionIdx: 0, correct: 1, questionText: 'Q1?', options: ['A', 'B'] }, { questionIdx: 1, correct: 0, questionText: 'Q2?', options: ['X', 'Y'] }] },
      { answers: [1, 0], attemptCounts: { 0: 3 } },
    );
    expect(r.attemptCounts).toEqual({ q0: 3, q1: 1 });
  });
});

describe('MatchGrader', () => {
  const grader = new MatchGrader();

  it('case-insensitive match', () => {
    const r = grader.grade(
      { type: 'match', answers: [{ pairIdx: 0, left: 'L', correct: 'Hello' }], options: ['Hello', 'World'] },
      { pairs: ['hello'] },
    );
    expect(r.total).toBe(100);
  });

  it('handles object pairs', () => {
    const r = grader.grade(
      { type: 'match', answers: [{ pairIdx: 0, left: 'L', correct: 'X' }], options: ['X', 'Y'] },
      { pairs: [{ value: 'x' }] },
    );
    expect(r.total).toBe(100);
  });

  it('handles empty answers gracefully', () => {
    const r = grader.grade({ type: 'match', answers: [] as any, options: ['A', 'B'] }, {});
    expect(r.total).toBe(0);
    expect(r.byDimension).toEqual({});
  });

  it('falls back to data.answers when data.pairs is missing', () => {
    const r = grader.grade(
      { type: 'match', answers: [{ pairIdx: 0, left: 'L', correct: 'Hello' }], options: ['Hello', 'World'] },
      { answers: ['hello'] },
    );
    expect(r.total).toBe(100);
  });

  it('falls back to 1 when attemptCounts index is missing', () => {
    const r = grader.grade(
      { type: 'match', answers: [{ pairIdx: 0, left: 'L1', correct: 'X' }, { pairIdx: 1, left: 'L2', correct: 'Y' }], options: ['X', 'Y'] },
      { pairs: ['x', 'y'], attemptCounts: { 0: 3 } },
    );
    expect(r.attemptCounts).toEqual({ p0: 3, p1: 1 });
  });
});

describe('MatrixGrader', () => {
  const grader = new MatrixGrader();

  it('scores place/practice/reason dimensions', async () => {
    const r = await grader.grade(
      { type: 'matrix', answers: [{ rowIdx: 0, place: 'Rome', practice: 'bath', reason: 'hygiene', isDemo: false }] },
      { rows: [{ place: 'Rome', practice: 'bathing', reason: 'hygiene rituals' }] },
    );
    expect(r.byDimension.place).toBe(100);
    expect(r.byDimension.practice).toBe(100);
    expect(r.byDimension.reason).toBe(100);
  });

  it('reads what/why fields as fallback', async () => {
    const r = await grader.grade(
      { type: 'matrix', answers: [{ rowIdx: 0, place: 'Rome', practice: 'bath', reason: 'hygiene', isDemo: false }] },
      { rows: [{ place: 'Rome', what: 'bathing', why: 'hygiene rituals' }] },
    );
    expect(r.byDimension.practice).toBe(100);
    expect(r.byDimension.reason).toBe(100);
  });

  it('skips demo rows', async () => {
    const r = await grader.grade(
      { type: 'matrix', answers: [{ rowIdx: 0, place: 'X', practice: 'Y', reason: 'Z', isDemo: true }] },
      { rows: [{ place: 'wrong', practice: 'wrong', reason: 'wrong' }] },
    );
    expect(r.total).toBe(0);
  });

  it('handles empty answers gracefully', async () => {
    const r = await grader.grade({ type: 'matrix', answers: [] as any }, {});
    expect(r.total).toBe(0);
    expect(r.byDimension).toEqual({ place: 0, practice: 0, reason: 0 });
  });

  it('includes cellQualities in result', async () => {
    const r = await grader.grade(
      { type: 'matrix', answers: [{ rowIdx: 0, place: 'Rome', practice: 'bath', reason: 'hygiene', isDemo: false }] },
      { rows: [{ place: 'Rome', what: 'They used public baths regularly for social meetings', why: 'Bathing was central to Roman hygiene and social life' }] },
    );
    expect(r.cellQualities).toBeDefined();
    expect(r.cellQualities!['0']).toBeDefined();
    expect(r.cellQualities!['0'].whatQ).toBeGreaterThanOrEqual(0);
    expect(r.cellQualities!['0'].whyQ).toBeGreaterThanOrEqual(0);
  });
});

describe('StanceGrader', () => {
  const grader = new StanceGrader();

  it('100 when valid position + enough evidence', () => {
    const r = grader.grade(
      { type: 'stance', validPositions: ['agree', 'disagree'], minEvidence: 2, stanceOpts: ['agree', 'disagree'], evidence: ['e1', 'e2'] },
      { position: 'agree', evidence: ['e1', 'e2'] },
    );
    expect(r.total).toBe(100);
  });

  it('50 when only position is valid', () => {
    const r = grader.grade(
      { type: 'stance', validPositions: ['agree'], minEvidence: 2, stanceOpts: ['agree', 'disagree'], evidence: ['e1', 'e2'] },
      { position: 'agree', evidence: ['e1'] },
    );
    expect(r.total).toBe(50);
  });

  it('0 when nothing valid', () => {
    const r = grader.grade(
      { type: 'stance', validPositions: ['agree'], minEvidence: 2, stanceOpts: ['agree', 'disagree'], evidence: ['e1', 'e2'] },
      { position: 'maybe', evidence: [] },
    );
    expect(r.total).toBe(0);
  });

  it('handles defaults gracefully', () => {
    const r = grader.grade(
      { type: 'stance', validPositions: [], minEvidence: 2, stanceOpts: ['a', 'b'], evidence: ['e'] },
      {},
    );
    expect(r.total).toBe(0);
    expect(r.byDimension).toEqual({ position: false, evidence: false });
  });
});

describe('OrderGrader', () => {
  const grader = new OrderGrader();

  it('100 for correct order', () => {
    // items[1]='B', items[0]='A' → correctOrder [1,0] means correct sequence is ['B','A']
    const r = grader.grade(
      { type: 'order', items: ['A', 'B'], correctOrder: [1, 0] },
      { order: ['B', 'A'] },
    );
    expect(r.total).toBe(100);
  });

  it('0 for wrong order', () => {
    const r = grader.grade(
      { type: 'order', items: ['A', 'B'], correctOrder: [1, 0] },
      { order: ['A', 'B'] },
    );
    expect(r.total).toBe(0);
  });

  it('handles object items with label', () => {
    const r = grader.grade(
      { type: 'order', items: ['A', 'B'], correctOrder: [0, 1] },
      { order: [{ label: 'a' }, { label: 'b' }] },
    );
    expect(r.total).toBe(100);
  });

  it('handles empty items (empty matches empty)', () => {
    const r = grader.grade({ type: 'order', items: [] as any, correctOrder: [] as any }, {});
    expect(r.total).toBe(100);
    expect(r.byDimension).toEqual({ correct: true });
  });
});
