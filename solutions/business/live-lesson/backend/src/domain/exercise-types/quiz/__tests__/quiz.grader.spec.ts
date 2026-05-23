import { QuizGrader } from '../quiz.grader';
import type { QuizAnswerKey } from '../../../../schemas';

describe('QuizGrader', () => {
  const grader = new QuizGrader();

  const key: QuizAnswerKey = {
    type: 'quiz',
    answers: [
      { questionIdx: 0, questionText: 'Q1', options: ['A', 'B', 'C'], correct: 1 },
      { questionIdx: 1, questionText: 'Q2', options: ['X', 'Y'], correct: 0 },
    ],
  };

  it('scores 100 when all answers correct', () => {
    const result = grader.grade(key, { answers: [1, 0] });
    expect(result.total).toBe(100);
    expect(result.byDimension).toEqual({ q0: true, q1: true });
  });

  it('scores 0 when all answers wrong', () => {
    const result = grader.grade(key, { answers: [0, 1] });
    expect(result.total).toBe(0);
    expect(result.byDimension).toEqual({ q0: false, q1: false });
  });

  it('scores partial correctness', () => {
    const result = grader.grade(key, { answers: [1, 1] });
    expect(result.total).toBe(50);
    expect(result.byDimension).toEqual({ q0: true, q1: false });
  });

  it('uses strict equality — string "1" !== number 1', () => {
    const result = grader.grade(key, { answers: ['1', '0'] });
    expect(result.total).toBe(0);
  });

  it('handles missing student answers', () => {
    const result = grader.grade(key, { answers: [] });
    expect(result.total).toBe(0);
    expect(result.byDimension).toEqual({ q0: false, q1: false });
  });

  it('handles empty answers key', () => {
    const emptyKey: QuizAnswerKey = { type: 'quiz', answers: [] as any };
    const result = grader.grade(emptyKey, { answers: [1] });
    expect(result.total).toBe(0);
  });

  it('passes through attemptCounts when present', () => {
    const result = grader.grade(key, {
      answers: [1, 0],
      attemptCounts: { 0: 2, 1: 3 },
    });
    expect(result.attemptCounts).toEqual({ q0: 2, q1: 3 });
  });

  it('defaults attemptCounts to 1 when key present but value missing', () => {
    const result = grader.grade(key, {
      answers: [1, 0],
      attemptCounts: { 0: 2 }, // missing index 1
    });
    expect(result.attemptCounts).toEqual({ q0: 2, q1: 1 });
  });

  it('omits attemptCounts when not in data', () => {
    const result = grader.grade(key, { answers: [1, 0] });
    expect(result.attemptCounts).toBeUndefined();
  });
});
