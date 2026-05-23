import { MatchGrader } from '../match.grader';
import type { MatchAnswerKey } from '../../../../schemas';

describe('MatchGrader', () => {
  const grader = new MatchGrader();

  const key: MatchAnswerKey = {
    type: 'match',
    answers: [
      { pairIdx: 0, left: 'Cat', correct: 'Feline', options: ['Feline', 'Canine'] },
      { pairIdx: 1, left: 'Dog', correct: 'Canine', options: ['Feline', 'Canine'] },
    ],
  };

  // ── data.pairs (string[]) ──

  it('scores 100 with correct string pairs', () => {
    const result = grader.grade(key, { pairs: ['Feline', 'Canine'] });
    expect(result.total).toBe(100);
    expect(result.byDimension).toEqual({ p0: true, p1: true });
  });

  it('is case-insensitive', () => {
    const result = grader.grade(key, { pairs: ['feline', 'CANINE'] });
    expect(result.total).toBe(100);
  });

  it('scores 0 when all wrong', () => {
    const result = grader.grade(key, { pairs: ['Canine', 'Feline'] });
    expect(result.total).toBe(0);
  });

  it('scores partial', () => {
    const result = grader.grade(key, { pairs: ['Feline', 'Feline'] });
    expect(result.total).toBe(50);
    expect(result.byDimension).toEqual({ p0: true, p1: false });
  });

  // ── data.answers (alias for pairs) ──

  it('accepts data.answers as alias for data.pairs', () => {
    const result = grader.grade(key, { answers: ['Feline', 'Canine'] });
    expect(result.total).toBe(100);
  });

  // ── object value shape { value } ──

  it('accepts { value } object shape', () => {
    const result = grader.grade(key, {
      pairs: [{ value: 'Feline' }, { value: 'Canine' }],
    });
    expect(result.total).toBe(100);
  });

  it('handles mix of string and object shapes', () => {
    const result = grader.grade(key, {
      pairs: ['Feline', { value: 'Canine' }],
    });
    expect(result.total).toBe(100);
  });

  // ── edge cases ──

  it('handles missing student pairs', () => {
    const result = grader.grade(key, { pairs: [] });
    expect(result.total).toBe(0);
  });

  it('handles undefined student pair at index', () => {
    const result = grader.grade(key, { pairs: ['Feline'] }); // index 1 undefined
    expect(result.byDimension.p0).toBe(true);
    expect(result.byDimension.p1).toBe(false);
  });

  // ── attemptCounts ──

  it('passes through attemptCounts', () => {
    const result = grader.grade(key, {
      pairs: ['Feline', 'Canine'],
      attemptCounts: { 0: 1, 1: 2 },
    });
    expect(result.attemptCounts).toEqual({ p0: 1, p1: 2 });
  });

  it('omits attemptCounts when not in data', () => {
    const result = grader.grade(key, { pairs: ['Feline', 'Canine'] });
    expect(result.attemptCounts).toBeUndefined();
  });
});
