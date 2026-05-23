/**
 * Plugin parity tests — ensure new plugin implementations behave identically to
 * the legacy graders + sanitizers for the migrated 3 types (quiz / match / order).
 *
 * These tests are the safety net for the Stage 1 migration. As long as they pass,
 * the GradingService fallback path stays compatible.
 */
import { QuizPlugin } from '../../../domain/exercise-types/quiz/quiz.plugin';
import { MatchPlugin } from '../../../domain/exercise-types/match/match.plugin';
import { OrderPlugin } from '../../../domain/exercise-types/order/order.plugin';
import { QuizGrader } from '../../../domain/exercise-types/quiz/quiz.grader';
import { MatchGrader } from '../../../domain/exercise-types/match/match.grader';
import { OrderGrader } from '../../../domain/exercise-types/order/order.grader';

describe('QuizPlugin', () => {
  const plugin = new QuizPlugin();
  const legacy = new QuizGrader();

  it('answerKeySchema accepts a valid quiz answerKey', () => {
    const ak = {
      type: 'quiz',
      answers: [
        { questionIdx: 0, questionText: 'Q?', options: ['A', 'B'], correct: 0 },
      ],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(true);
  });

  it('answerKeySchema rejects correct >= options.length', () => {
    const ak = {
      type: 'quiz',
      answers: [
        { questionIdx: 0, questionText: 'Q?', options: ['A', 'B'], correct: 5 },
      ],
    };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(false);
  });

  it('grade output matches legacy grader (all correct)', () => {
    const ak = {
      type: 'quiz' as const,
      answers: [
        { questionIdx: 0, questionText: 'Q1?', options: ['A', 'B'], correct: 1 },
        { questionIdx: 1, questionText: 'Q2?', options: ['X', 'Y'], correct: 0 },
      ],
    };
    const data = { answers: [1, 0] };
    const pluginResult = plugin.grade({ key: ak, data });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacyResult = legacy.grade(ak as any, data);
    expect(pluginResult).toEqual(legacyResult);
  });

  it('grade output matches legacy grader (partial)', () => {
    const ak = {
      type: 'quiz' as const,
      answers: [
        { questionIdx: 0, questionText: 'Q1?', options: ['A', 'B'], correct: 1 },
        { questionIdx: 1, questionText: 'Q2?', options: ['X', 'Y'], correct: 0 },
      ],
    };
    const data = { answers: [1, 1] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(plugin.grade({ key: ak, data })).toEqual(legacy.grade(ak as any, data));
  });

  it('sanitize strips correct + hint + walkthrough', () => {
    const ak = {
      type: 'quiz',
      answers: [
        {
          questionIdx: 0,
          questionText: 'Q?',
          options: ['A', 'B'],
          correct: 1,
          hint: 'leak',
          walkthrough: 'leak2',
        },
      ],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as { questions: Array<Record<string, unknown>> };
    expect(spec.questions[0].correct).toBeUndefined();
    expect(spec.questions[0].hint).toBeUndefined();
    expect(spec.questions[0].walkthrough).toBeUndefined();
  });

  it('buildCheckItems returns idx + correct + hint for wrong answers', () => {
    const ak = {
      type: 'quiz' as const,
      answers: [
        { questionIdx: 0, questionText: 'Q?', options: ['A', 'B'], correct: 1, hint: 'Try B' },
      ],
    };
    const data = { answers: [0] };
    const gradeResult = plugin.grade({ key: ak, data });
    const items = plugin.buildCheckItems({ key: ak, data, gradeResult });
    expect(items).toEqual([{ idx: 0, correct: false, hint: 'Try B' }]);
  });
});

describe('MatchPlugin', () => {
  const plugin = new MatchPlugin();
  const legacy = new MatchGrader();

  it('grade output matches legacy grader', () => {
    const ak = {
      type: 'match' as const,
      answers: [{ pairIdx: 0, left: 'L', correct: 'Hello' }],
      options: ['Hello', 'World'],
    };
    const data = { pairs: ['hello'] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(plugin.grade({ key: ak, data })).toEqual(legacy.grade(ak as any, data));
  });

  it('sanitize strips `correct` field from each pair', () => {
    const ak = {
      type: 'match',
      answers: [{ pairIdx: 0, left: 'L', correct: 'Hello' }],
      options: ['Hello', 'World'],
    };
    const spec = plugin.sanitize({ answerKey: ak }) as { pairs: Array<Record<string, unknown>> };
    expect(spec.pairs[0].correct).toBeUndefined();
  });
});

describe('OrderPlugin', () => {
  const plugin = new OrderPlugin();
  const legacy = new OrderGrader();

  it('grade 100 for correct order matches legacy', () => {
    const ak = { type: 'order' as const, items: ['A', 'B'], correctOrder: [1, 0] };
    const data = { order: ['B', 'A'] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(plugin.grade({ key: ak, data })).toEqual(legacy.grade(ak as any, data));
  });

  it('grade 0 for wrong order matches legacy', () => {
    const ak = { type: 'order' as const, items: ['A', 'B'], correctOrder: [1, 0] };
    const data = { order: ['A', 'B'] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(plugin.grade({ key: ak, data })).toEqual(legacy.grade(ak as any, data));
  });

  it('answerKeySchema rejects duplicate correctOrder indices', () => {
    const ak = { type: 'order', items: ['A', 'B'], correctOrder: [0, 0] };
    expect(plugin.answerKeySchema.safeParse(ak).success).toBe(false);
  });

  it('sanitize strips correctOrder', () => {
    const ak = { type: 'order', items: ['A', 'B'], correctOrder: [1, 0] };
    const spec = plugin.sanitize({ answerKey: ak }) as Record<string, unknown>;
    expect(spec.correctOrder).toBeUndefined();
    expect(spec.items).toEqual(['A', 'B']);
  });

  it('buildCheckItems produces position-correct flags', () => {
    const ak = { type: 'order' as const, items: ['A', 'B', 'C'], correctOrder: [2, 0, 1] };
    const data = { order: ['C', 'B', 'A'] };
    const gradeResult = plugin.grade({ key: ak, data });
    const items = plugin.buildCheckItems({ key: ak, data, gradeResult });
    expect(items).toEqual([
      { idx: 0, correct: true },
      { idx: 1, correct: false },
      { idx: 2, correct: false },
    ]);
  });
});
