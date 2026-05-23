/**
 * Sanitize used to live in this file as a hardcoded dict; it's now dispatched
 * through ExerciseTypeRegistry per-type. The original assertions are still
 * valuable regression coverage, so we keep them all but route the
 * `sanitizeAnswerKey` / `sanitizeManifest` calls through a registry bootstrap.
 *
 * The `seededShuffle` tests at the bottom are unchanged — that helper still
 * lives in manifest.utils.
 */
import { createPluginRegistryTestingModule } from '../classroom/exercise/plugins/test-utils';
import type { ExerciseTypeRegistry } from '../classroom/exercise/exercise-type-registry';
import { seededShuffle } from './manifest.utils';

let registry: ExerciseTypeRegistry;
beforeAll(async () => {
  const handle = await createPluginRegistryTestingModule();
  registry = handle.registry;
});

function sanitizeAnswerKey(
  ak: unknown,
  exerciseLabel?: string,
  practiceItemIds?: string[],
) {
  return registry.sanitize({
    answerKey: ak as Record<string, unknown>,
    exerciseLabel,
    practiceItemIds,
  });
}
function sanitizeManifest(manifest: unknown) {
  return registry.sanitizeManifest(manifest);
}

describe('sanitizeAnswerKey', () => {
  it('returns null for invalid input', () => {
    expect(sanitizeAnswerKey(null)).toBeNull();
    expect(sanitizeAnswerKey({})).toBeNull();
    expect(sanitizeAnswerKey({ type: 'bogus' })).toBeNull();
  });

  describe('quiz', () => {
    const quizKey = {
      type: 'quiz',
      answers: [
        {
          questionIdx: 0,
          correct: 1,
          questionText: 'What happened?',
          questionTranslate: '发生了什么？',
          options: ['A', 'B', 'C', 'D'],
          hint: 'Look at ¶1',
          hintZh: '看 ¶1',
          walkthrough: 'Full explanation',
          walkthroughZh: '完整解释',
        },
      ],
    };

    it('keeps question text, translate, options', () => {
      const spec = sanitizeAnswerKey(quizKey)!;
      expect(spec.type).toBe('quiz');
      expect(spec.questions).toHaveLength(1);
      expect(spec.questions![0].text).toBe('What happened?');
      expect(spec.questions![0].translate).toBe('发生了什么？');
      expect(spec.questions![0].options).toEqual(['A', 'B', 'C', 'D']);
    });

    it('strips correct, hint, walkthrough', () => {
      const spec = sanitizeAnswerKey(quizKey)!;
      const q = spec.questions![0] as Record<string, unknown>;
      expect(q.correct).toBeUndefined();
      expect(q.hint).toBeUndefined();
      expect(q.hintZh).toBeUndefined();
      expect(q.walkthrough).toBeUndefined();
      expect(q.walkthroughZh).toBeUndefined();
    });

    it('preserves paraRef when present', () => {
      const key = { ...quizKey, answers: [{ ...quizKey.answers[0], paraRef: [3, 4] }] };
      const spec = sanitizeAnswerKey(key)!;
      expect((spec.questions![0] as any).paraRef).toEqual([3, 4]);
    });
  });

  describe('match', () => {
    const matchKey = {
      type: 'match',
      options: ['opt1', 'opt2', 'opt3'],
      answers: [
        { pairIdx: 0, left: 'left1', correct: 'opt1', hint: 'h1', hintZh: 'h1zh' },
      ],
    };

    it('keeps left, options from top-level', () => {
      const spec = sanitizeAnswerKey(matchKey)!;
      expect(spec.pairs![0].left).toBe('left1');
      expect(spec.pairs![0].options).toEqual(['opt1', 'opt2', 'opt3']);
    });

    it('strips correct, hint', () => {
      const spec = sanitizeAnswerKey(matchKey)!;
      const p = spec.pairs![0] as Record<string, unknown>;
      expect(p.correct).toBeUndefined();
      expect(p.hint).toBeUndefined();
    });

    it('preserves paraRef when present', () => {
      const key = { ...matchKey, answers: [{ ...matchKey.answers[0], paraRef: [5] }] };
      const spec = sanitizeAnswerKey(key)!;
      expect((spec.pairs![0] as any).paraRef).toEqual([5]);
    });
  });

  describe('matrix', () => {
    const matrixKey = {
      type: 'matrix',
      answers: [
        { rowIdx: 0, place: 'Egypt', practice: 'painting', reason: 'beauty', isDemo: true },
        { rowIdx: 1, place: 'Europe', practice: 'pale skin', reason: 'wealth', hint: 'Look ¶4' },
      ],
    };

    it('keeps demo row practice/reason', () => {
      const spec = sanitizeAnswerKey(matrixKey)!;
      expect(spec.rows![0].practice).toBe('painting');
      expect(spec.rows![0].reason).toBe('beauty');
      expect(spec.rows![0].isDemo).toBe(true);
    });

    it('keeps non-demo row practice/reason for practiceCount subset, strips hint', () => {
      const spec = sanitizeAnswerKey(matrixKey)!;
      const row = spec.rows![1] as Record<string, unknown>;
      expect(row.practice).toBe('pale skin');
      expect(row.reason).toBe('wealth');
      expect(row.hint).toBeUndefined();
    });

    it('preserves paraRef, whatPrompt, whyPrompt, practiceCount', () => {
      const key = {
        type: 'matrix',
        practiceCount: 3,
        answers: [
          { rowIdx: 0, place: 'Egypt', practice: 'x', reason: 'y', isDemo: true },
          { rowIdx: 1, place: 'Borneo', practice: 'tattoos', reason: 'diary', paraRef: [6], whatPrompt: 'What body mod?', whyPrompt: 'What did it record?' },
        ],
      };
      const spec = sanitizeAnswerKey(key)!;
      expect((spec as any).practiceCount).toBe(3);
      const row = spec.rows![1] as Record<string, unknown>;
      expect(row.paraRef).toEqual([6]);
      expect(row.whatPrompt).toBe('What body mod?');
      expect(row.whyPrompt).toBe('What did it record?');
    });
  });

  describe('stance', () => {
    const stanceKey = {
      type: 'stance',
      validPositions: ['I agree', 'I disagree'],
      minEvidence: 2,
      stanceQ: 'Do you agree?',
      stanceQZh: '你同意吗？',
      stanceOpts: ['I agree', 'I partly agree', 'I disagree'],
      evidence: ['fact1', 'fact2'],
    };

    it('keeps stanceQ, stanceOpts, evidence', () => {
      const spec = sanitizeAnswerKey(stanceKey)!;
      expect(spec.stanceQ).toBe('Do you agree?');
      expect(spec.stanceOpts).toEqual(['I agree', 'I partly agree', 'I disagree']);
      expect(spec.evidence).toEqual(['fact1', 'fact2']);
    });

    it('strips validPositions and minEvidence', () => {
      const spec = sanitizeAnswerKey(stanceKey)! as unknown as Record<string, unknown>;
      expect(spec.validPositions).toBeUndefined();
      expect(spec.minEvidence).toBeUndefined();
    });
  });

  describe('order', () => {
    const orderKey = {
      type: 'order',
      items: ['Scanning', 'Predicting', 'Evaluating', 'Skimming'],
      correctOrder: [1, 3, 0, 2],
    };

    it('keeps items', () => {
      const spec = sanitizeAnswerKey(orderKey)!;
      expect(spec.items).toEqual(['Scanning', 'Predicting', 'Evaluating', 'Skimming']);
    });

    it('strips correctOrder', () => {
      const spec = sanitizeAnswerKey(orderKey)! as unknown as Record<string, unknown>;
      expect(spec.correctOrder).toBeUndefined();
    });
  });

  describe('select-evidence', () => {
    const seKey = {
      type: 'select-evidence',
      functionOptions: ['Phenomenon', 'History', 'Culture', 'Conclusion'],
      sections: [
        { id: 'p12', label: '¶1-2', range: [1, 2], correctFunction: 'Phenomenon', hint: 'h', hintZh: '提示', aiCorrect: 'good', aiPartial: 'partial' },
      ],
      paragraphTokens: {
        '1': [
          { t: 'normal text' },
          { t: 'evidence text', kind: 'evidence', why: 'because reasons' },
          { t: 'distractor', kind: 'distractor', why: 'not relevant' },
        ],
      },
    };

    it('keeps functionOptions, section id/label/range', () => {
      const spec = sanitizeAnswerKey(seKey)!;
      expect(spec.functionOptions).toEqual(['Phenomenon', 'History', 'Culture', 'Conclusion']);
      expect(spec.sections![0].id).toBe('p12');
      expect(spec.sections![0].label).toBe('¶1-2');
      expect(spec.sections![0].range).toEqual([1, 2]);
    });

    it('keeps correctFunction, hint, aiCorrect, aiPartial on sections for client-side grading', () => {
      const spec = sanitizeAnswerKey(seKey)!;
      const s = spec.sections![0] as Record<string, unknown>;
      expect(s.correctFunction).toBe('Phenomenon');
      expect(s.hint).toBe('h');
      expect(s.hintZh).toBe('提示');
      expect(s.aiCorrect).toBe('good');
      expect(s.aiPartial).toBe('partial');
    });

    it('keeps kind and why on tokens for client-side grading', () => {
      const spec = sanitizeAnswerKey(seKey)!;
      const tokens = spec.paragraphTokens!['1'];
      expect(tokens[0]).toEqual({ t: 'normal text' });
      expect(tokens[1]).toEqual({ t: 'evidence text', kind: 'evidence', why: 'because reasons' });
      expect(tokens[2]).toEqual({ t: 'distractor', kind: 'distractor', why: 'not relevant' });
    });

    it('keeps minHits on sections when present', () => {
      const seKeyWithMinHits = {
        ...seKey,
        sections: [
          { id: 'p12', label: '¶1-2', range: [1, 2], correctFunction: 'Phenomenon', minHits: 2, hint: 'h', aiCorrect: 'good', aiPartial: 'partial' },
        ],
      };
      const spec = sanitizeAnswerKey(seKeyWithMinHits)!;
      expect(spec.sections![0].minHits).toBe(2);
    });

    it('omits minHits from sections when not present', () => {
      const spec = sanitizeAnswerKey(seKey)!;
      expect(spec.sections![0]).not.toHaveProperty('minHits');
    });
  });
});

describe('seededShuffle', () => {
  it('is deterministic — same seed produces same result', () => {
    const arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const r1 = seededShuffle(arr, 'student1:3');
    const r2 = seededShuffle(arr, 'student1:3');
    expect(r1).toEqual(r2);
  });

  it('different seeds produce different results', () => {
    const arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const r1 = seededShuffle(arr, 'student1:3');
    const r2 = seededShuffle(arr, 'student2:3');
    expect(r1).not.toEqual(r2);
  });

  it('preserves all elements (no duplicates, no missing)', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];
    const result = seededShuffle(arr, 'test-seed');
    expect(result.sort()).toEqual([...arr].sort());
  });

  it('does not mutate the original array', () => {
    const arr = ['a', 'b', 'c'];
    const copy = [...arr];
    seededShuffle(arr, 'seed');
    expect(arr).toEqual(copy);
  });

  it('handles empty array', () => {
    expect(seededShuffle([], 'seed')).toEqual([]);
  });

  it('handles single element', () => {
    expect(seededShuffle(['x'], 'seed')).toEqual(['x']);
  });
});

describe('sanitizeAnswerKey — map with practiceItemIds', () => {
  const mapKey = {
    type: 'map',
    prompt: 'Place items',
    axes: {
      x: { neg: 'Left', pos: 'Right', label: 'X-axis' },
      y: { neg: 'Bottom', pos: 'Top', label: 'Y-axis' },
    },
    items: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ],
    expected: { a: [0.5, 0.5], b: [-0.5, 0.5], c: [0.5, -0.5], d: [-0.5, -0.5] },
    practiceCount: 2,
    randomPractice: true,
  };

  it('without practiceItemIds, uses sequential slice for givenPlacements', () => {
    const spec = sanitizeAnswerKey(mapKey)!;
    expect(spec.practiceItemIds).toBeUndefined();
    // Sequential: first 2 are practice (a, b), last 2 are given (c, d)
    expect(spec.givenPlacements).toBeDefined();
    expect(Object.keys(spec.givenPlacements!)).toEqual(['c', 'd']);
  });

  it('with practiceItemIds, builds givenPlacements from non-practice items', () => {
    const spec = sanitizeAnswerKey(mapKey, undefined, ['b', 'd'])!;
    expect(spec.practiceItemIds).toEqual(['b', 'd']);
    // b, d are practice → a, c are given
    expect(Object.keys(spec.givenPlacements!).sort()).toEqual(['a', 'c']);
    expect(spec.givenPlacements!['a']).toEqual({ x: 0.5, y: 0.5 });
    expect(spec.givenPlacements!['c']).toEqual({ x: 0.5, y: -0.5 });
  });

  it('returns practiceItemIds in the spec', () => {
    const spec = sanitizeAnswerKey(mapKey, undefined, ['a', 'c'])!;
    expect(spec.practiceItemIds).toEqual(['a', 'c']);
  });

  it('strips expected from output', () => {
    const spec = sanitizeAnswerKey(mapKey, undefined, ['a', 'b'])! as Record<string, unknown>;
    expect(spec.expected).toBeUndefined();
  });
});

describe('sanitizeAnswerKey — map edge cases', () => {
  const mapKey = {
    type: 'map',
    prompt: 'Place items',
    axes: {
      x: { neg: 'Left', pos: 'Right', label: 'X-axis' },
      y: { neg: 'Bottom', pos: 'Top', label: 'Y-axis' },
    },
    items: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ],
    expected: { a: [0.5, 0.5], b: [-0.5, 0.5], c: [0.5, -0.5] },
    practiceCount: 2,
  };

  it('all items are practice → givenPlacements omitted', () => {
    const spec = sanitizeAnswerKey(mapKey, undefined, ['a', 'b', 'c'])!;
    expect(spec.practiceItemIds).toEqual(['a', 'b', 'c']);
    expect(spec.givenPlacements).toBeUndefined();
  });

  it('practiceCount >= items.length → givenPlacements empty (sequential mode)', () => {
    const bigCount = { ...mapKey, practiceCount: 10 };
    const spec = sanitizeAnswerKey(bigCount)!;
    // slice(10, 3) → empty → no givenPlacements
    expect(spec.givenPlacements).toBeUndefined();
    expect(spec.practiceCount).toBe(10);
  });

  it('practiceItemIds without expected → no givenPlacements', () => {
    const noExpected = { ...mapKey, expected: undefined };
    const spec = sanitizeAnswerKey(noExpected, undefined, ['a'])!;
    expect(spec.practiceItemIds).toEqual(['a']);
    expect(spec.givenPlacements).toBeUndefined();
  });

  it('empty practiceItemIds → all items get givenPlacements', () => {
    const spec = sanitizeAnswerKey(mapKey, undefined, [])!;
    expect(spec.practiceItemIds).toEqual([]);
    expect(Object.keys(spec.givenPlacements!).sort()).toEqual(['a', 'b', 'c']);
  });

  it('randomPractice field is not leaked to spec', () => {
    const withRandom = { ...mapKey, randomPractice: true };
    const spec = sanitizeAnswerKey(withRandom)! as Record<string, unknown>;
    expect(spec.randomPractice).toBeUndefined();
  });
});

describe('sanitizeManifest', () => {
  it('returns null/undefined as-is', () => {
    expect(sanitizeManifest(null)).toBeNull();
    expect(sanitizeManifest(undefined)).toBeUndefined();
  });

  it('sanitizes answerKeys in readingSteps', () => {
    const manifest = {
      id: 'test',
      readingSteps: [
        { idx: 0, type: 'instruction' },
        {
          idx: 1,
          type: 'task',
          exerciseLabel: 'Answer the questions.',
          answerKey: {
            type: 'quiz',
            answers: [
              { questionIdx: 0, correct: 1, questionText: 'Q?', options: ['A', 'B'] },
            ],
          },
        },
        {
          idx: 3,
          type: 'task',
          exerciseLabel: 'Put in order.',
          answerKey: {
            type: 'order',
            items: ['X', 'Y'],
            correctOrder: [1, 0],
          },
        },
      ],
    };

    const sanitized = sanitizeManifest(manifest) as Record<string, unknown>;
    const steps = sanitized.readingSteps as Array<Record<string, unknown>>;

    // Quiz: correct should be stripped
    const quizAk = steps[1].answerKey as Record<string, unknown>;
    expect(quizAk.type).toBe('quiz');
    const quizQs = quizAk.questions as Array<Record<string, unknown>>;
    expect(quizQs[0].text).toBe('Q?');
    expect(quizQs[0].correct).toBeUndefined();

    // Order: correctOrder should be stripped
    const orderAk = steps[2].answerKey as Record<string, unknown>;
    expect(orderAk.type).toBe('order');
    expect(orderAk.items).toEqual(['X', 'Y']);
    expect(orderAk.correctOrder).toBeUndefined();
  });

  it('does not mutate original manifest', () => {
    const manifest = {
      readingSteps: [
        { idx: 1, type: 'task', answerKey: { type: 'order', items: ['A', 'B'], correctOrder: [1, 0] } },
      ],
    };
    sanitizeManifest(manifest);
    expect(manifest.readingSteps[0].answerKey.correctOrder).toEqual([1, 0]);
  });
});
