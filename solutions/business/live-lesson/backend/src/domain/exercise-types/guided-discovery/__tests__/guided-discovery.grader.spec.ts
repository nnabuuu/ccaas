import { GuidedDiscoveryGrader } from '../guided-discovery.grader';
import type { GuidedDiscoveryAnswerKey, GradeResult } from '../../../../schemas';
import { AnswerKeySchema, validateAnswerKey } from '../../../../schemas';
import { createPluginRegistryTestingModule } from '../../../../classroom/exercise/plugins/test-utils';
import { ExerciseTypeRegistry } from '../../../../classroom/exercise/exercise-type-registry';

// Local sanitize wrapper — dispatches through the shared `registry`
// (initialized in beforeAll below). Replaces the old top-level
// `sanitizeAnswerKey` import after manifest.utils dropped its hardcoded dict.
function sanitizeAnswerKey(ak: unknown, exerciseLabel?: string) {
  return registry.sanitize({
    answerKey: ak as Record<string, unknown>,
    exerciseLabel,
  });
}
import type { AiPromptBuilder } from '../../../../classroom/ai-prompt-builder';

// Registry shared by the buildCheckItems tests below — built once for the
// whole file. Hoisted via top-level `let` + `beforeAll` so individual `it`s
// stay synchronous-looking.
let registry: ExerciseTypeRegistry;
beforeAll(async () => {
  const handle = await createPluginRegistryTestingModule();
  registry = handle.registry;
});

function buildCheckItems(ak: Record<string, unknown>, data: Record<string, unknown>, gr: GradeResult): Array<Record<string, unknown>> {
  const items = registry.buildCheckItems(ak, data, gr);
  if (!items) throw new Error(`no buildCheckItems impl for type "${ak.type}"`);
  return items;
}

const grader = new GuidedDiscoveryGrader();

// ── Shared fixture ──

const answerKey: GuidedDiscoveryAnswerKey = {
  type: 'guided-discovery',
  title: '平方差公式',
  steps: [
    {
      type: 'observation_choice',
      id: 'observe',
      title: 'Q1 观察规律',
      table: [
        { expression: '(a+b)(a-b)', result: 'a²-b²' },
        { expression: '(x+3)(x-3)', result: 'x²-9' },
      ],
      highlights: {
        same: { color: '#4CAF50', terms: [['a', 'a'], ['x', 'x']] },
        opposite: { color: '#FF5722', terms: [['+b', '-b'], ['+3', '-3']] },
      },
      choices: [
        { id: 'c1', prompt: '两个因式中，a 出现的位置', options: ['相同', '不同'], correct: 0 },
        { id: 'c2', prompt: 'b 的符号', options: ['一正一负', '都是正'], correct: 0 },
      ],
    },
    {
      type: 'formula_blanks',
      id: 'symbolize',
      title: 'Q2 写出公式',
      blanks: [
        { id: 'lhs', label: '左边', accepts: ['(a+b)(a-b)', '(a-b)(a+b)'], rejects: ['a+b'], rejectHint: '需要写完整的乘法' },
        { id: 'rhs', label: '右边', accepts: ['a²-b²', 'a^2-b^2'] },
      ],
    },
    {
      type: 'derivation_blank',
      id: 'verify',
      title: 'Q3 验证',
      lines: [
        { text: '(a+b)(a-b)' },
        { text: '= a·a - a·b + b·a - b·b', blank: { id: 'd1', accepts: ['a²-a b+a b-b²', 'a^2-ab+ab-b^2', 'a²-ab+ab-b²'] } },
        { text: '= ', blank: { id: 'd2', accepts: ['a²-b²', 'a^2-b^2'] } },
      ],
    },
    {
      type: 'text_blanks',
      id: 'verbalize',
      title: 'Q4 用文字表述',
      template: '两数__乘以两数__等于这两数的__',
      blanks: [
        { id: 't1', accepts: ['和', '之和'] },
        { id: 't2', accepts: ['差', '之差'] },
        { id: 't3', accepts: ['平方差', '平方之差'] },
      ],
    },
  ],
  summary: { formula: '(a+b)(a-b) = a²-b²', name: '平方差公式' },
};

const allCorrectData = {
  steps: {
    observe: { answers: { c1: 0, c2: 0 } },
    symbolize: { answers: { lhs: '(a+b)(a-b)', rhs: 'a²-b²' } },
    verify: { answers: { d1: 'a²-ab+ab-b²', d2: 'a²-b²' } },
    verbalize: { answers: { t1: '和', t2: '差', t3: '平方差' } },
  },
};

// ── Grader: core ──

describe('GuidedDiscoveryGrader', () => {
  it('scores 100 when all steps correct', async () => {
    const result = await grader.grade(answerKey, allCorrectData);
    expect(result.total).toBe(100);
    expect(result.byDimension.observe).toBe(true);
    expect(result.byDimension.symbolize).toBe(true);
    expect(result.byDimension.verify).toBe(true);
    expect(result.byDimension.verbalize).toBe(true);
  });

  it('marks observe=false when one choice is wrong', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        observe: { answers: { c1: 1, c2: 0 } },
      },
    };
    const result = await grader.grade(answerKey, data);
    expect(result.total).toBe(75);
    expect(result.byDimension.observe).toBe(false);
    expect(result.byDimension.symbolize).toBe(true);
  });

  it('marks symbolize=false when formula blanks are swapped', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        symbolize: { answers: { lhs: 'b²-a²', rhs: 'a²-b²' } },
      },
    };
    const result = await grader.grade(answerKey, data);
    expect(result.total).toBe(75);
    expect(result.byDimension.symbolize).toBe(false);
  });

  it('marks verbalize=false when text blanks are swapped', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        verbalize: { answers: { t1: '差', t2: '和', t3: '平方差' } },
      },
    };
    const result = await grader.grade(answerKey, data);
    expect(result.total).toBe(75);
    expect(result.byDimension.verbalize).toBe(false);
  });

  it('scores 0 on empty submission', async () => {
    const result = await grader.grade(answerKey, {});
    expect(result.total).toBe(0);
    expect(Object.values(result.byDimension).every(v => v === false)).toBe(true);
  });

  it('handles derivation lines without blanks gracefully', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [
        {
          type: 'derivation_blank',
          id: 'd',
          title: 'derivation',
          lines: [
            { text: 'given: (a+b)(a-b)' },
            { text: '= ', blank: { id: 'x', accepts: ['a²-b²'] } },
          ],
        },
      ],
    };
    const data = { steps: { d: { answers: { x: 'a²-b²' } } } };
    const result = await grader.grade(key, data);
    expect(result.total).toBe(100);
  });
});

// ── Grader: normalization ──

describe('GuidedDiscoveryGrader — normalize', () => {
  it('a^2-b^2 matches a²-b²', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        symbolize: { answers: { lhs: '(a+b)(a-b)', rhs: 'a^2-b^2' } },
        verify: { answers: { d1: 'a^2-ab+ab-b^2', d2: 'a^2-b^2' } },
      },
    };
    const result = await grader.grade(answerKey, data);
    expect(result.total).toBe(100);
  });

  it('Chinese brackets ＋ multiplication sign', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'formula_blanks',
        id: 's1',
        title: 'test',
        blanks: [{ id: 'b1', label: 'x', accepts: ['(a+b)*(a-b)'] }],
      }],
    };
    const data = { steps: { s1: { answers: { b1: '（a+b）×（a-b）' } } } };
    const result = await grader.grade(key, data);
    expect(result.total).toBe(100);
  });

  it('em-dash and en-dash normalize to minus', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'formula_blanks',
        id: 's1',
        title: 'test',
        blanks: [{ id: 'b1', label: 'x', accepts: ['a-b'] }],
      }],
    };
    // \u2014 = em-dash, \u2013 = en-dash, \u2212 = minus sign
    for (const dash of ['a\u2014b', 'a\u2013b', 'a\u2212b']) {
      const data = { steps: { s1: { answers: { b1: dash } } } };
      const result = await grader.grade(key, data);
      expect(result.byDimension.s1).toBe(true);
    }
  });

  it('full-width equals sign normalizes', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'formula_blanks',
        id: 's1',
        title: 'test',
        blanks: [{ id: 'b1', label: 'x', accepts: ['a=b'] }],
      }],
    };
    const data = { steps: { s1: { answers: { b1: 'a\uff1db' } } } };
    expect((await grader.grade(key, data)).byDimension.s1).toBe(true);
  });

  it('whitespace around answer is trimmed', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        verbalize: { answers: { t1: '  和  ', t2: ' 差 ', t3: '平方差' } },
      },
    };
    expect((await grader.grade(answerKey, data)).byDimension.verbalize).toBe(true);
  });

  it('case insensitive matching', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'formula_blanks',
        id: 's1',
        title: 'test',
        blanks: [{ id: 'b1', label: 'x', accepts: ['A^2-B^2'] }],
      }],
    };
    const data = { steps: { s1: { answers: { b1: 'a^2-b^2' } } } };
    expect((await grader.grade(key, data)).byDimension.s1).toBe(true);
  });
});

// ── Grader: edge cases ──

describe('GuidedDiscoveryGrader — edge cases', () => {
  it('partial submission: only some steps answered', async () => {
    const data = {
      steps: {
        observe: { answers: { c1: 0, c2: 0 } },
        // symbolize, verify, verbalize missing
      },
    };
    const result = await grader.grade(answerKey, data);
    expect(result.total).toBe(25);
    expect(result.byDimension.observe).toBe(true);
    expect(result.byDimension.symbolize).toBe(false);
    expect(result.byDimension.verify).toBe(false);
    expect(result.byDimension.verbalize).toBe(false);
  });

  it('extra step data for unknown steps is ignored', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        phantomStep: { answers: { x: 'whatever' } },
      },
    };
    const result = await grader.grade(answerKey, data);
    expect(result.total).toBe(100);
    expect(result.byDimension).not.toHaveProperty('phantomStep');
  });

  it('empty string answer treated as missing', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        verbalize: { answers: { t1: '', t2: '差', t3: '平方差' } },
      },
    };
    expect((await grader.grade(answerKey, data)).byDimension.verbalize).toBe(false);
  });

  it('whitespace-only answer treated as missing', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        symbolize: { answers: { lhs: '   ', rhs: 'a²-b²' } },
      },
    };
    // normalize('   ') strips all whitespace → empty string → doesn't match any accept
    expect((await grader.grade(answerKey, data)).byDimension.symbolize).toBe(false);
  });

  it('alternative correct answers accepted', async () => {
    const data = {
      steps: {
        ...allCorrectData.steps,
        symbolize: { answers: { lhs: '(a-b)(a+b)', rhs: 'a^2-b^2' } },
        verbalize: { answers: { t1: '之和', t2: '之差', t3: '平方之差' } },
      },
    };
    const result = await grader.grade(answerKey, data);
    expect(result.byDimension.symbolize).toBe(true);
    expect(result.byDimension.verbalize).toBe(true);
  });

  it('observation_choice: missing answer key fails', async () => {
    const data = {
      steps: {
        observe: { answers: { c1: 0 } }, // c2 missing → undefined !== 0
      },
    };
    const key: GuidedDiscoveryAnswerKey = {
      ...answerKey,
      steps: [answerKey.steps[0]],
    };
    expect((await grader.grade(key, data)).byDimension.observe).toBe(false);
  });

  it('observation_choice: string "0" does NOT match number 0 (strict equality)', async () => {
    const data = {
      steps: {
        observe: { answers: { c1: '0' as unknown as number, c2: 0 } },
      },
    };
    const key: GuidedDiscoveryAnswerKey = {
      ...answerKey,
      steps: [answerKey.steps[0]],
    };
    // strict equality: '0' !== 0
    expect((await grader.grade(key, data)).byDimension.observe).toBe(false);
  });

  it('single-step answer key works', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'text_blanks',
        id: 'only',
        title: 'single',
        template: '__',
        blanks: [{ id: 'b', accepts: ['yes'] }],
      }],
    };
    const pass = await grader.grade(key, { steps: { only: { answers: { b: 'yes' } } } });
    expect(pass.total).toBe(100);

    const fail = await grader.grade(key, { steps: { only: { answers: { b: 'no' } } } });
    expect(fail.total).toBe(0);
  });

  it('keyboard reject answer returns rejectHint in llmFeedback', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'formula_blanks',
        id: 'sym',
        title: '写公式',
        blanks: [{
          id: 'rhs',
          label: '右边',
          accepts: ['a²-b²', 'a^2-b^2'],
          rejects: ['b²-a²', 'b^2-a^2'],
          rejectHint: '注意左右顺序，应该是 a²-b² 而不是 b²-a²',
        }],
      }],
    };
    // Rejected answer → wrong + rejectHint in feedback
    const result = await grader.grade(key, { steps: { sym: { answers: { rhs: 'b^2-a^2' } } } });
    expect(result.total).toBe(0);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toBe('注意左右顺序，应该是 a²-b² 而不是 b²-a²');
  });

  it('keyboard wrong answer not in rejects returns no rejectHint', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'formula_blanks',
        id: 'sym',
        title: '写公式',
        blanks: [{
          id: 'rhs',
          label: '右边',
          accepts: ['a²-b²'],
          rejects: ['b²-a²'],
          rejectHint: '注意顺序',
        }],
      }],
    };
    // Random wrong answer not in rejects → wrong but no feedback
    const result = await grader.grade(key, { steps: { sym: { answers: { rhs: 'xyz' } } } });
    expect(result.total).toBe(0);
    expect(result.llmFeedback).toBeUndefined();
  });
});

// ── Schema validation ──

describe('GuidedDiscoveryAnswerKey — schema validation', () => {
  it('parses a valid guided-discovery answer key', () => {
    const result = AnswerKeySchema.safeParse(answerKey);
    expect(result.success).toBe(true);
  });

  it('validates via validateAnswerKey helper', () => {
    const result = validateAnswerKey(answerKey);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing steps', () => {
    const bad = { type: 'guided-discovery', title: 'x', steps: [] };
    const result = validateAnswerKey(bad);
    expect(result.valid).toBe(false);
  });

  it('rejects choice correct > 1', () => {
    const bad = {
      type: 'guided-discovery',
      title: 'x',
      steps: [{
        type: 'observation_choice',
        id: 'obs',
        title: 'obs',
        choices: [{ id: 'c1', prompt: 'p', options: ['a', 'b'], correct: 2 }],
      }],
    };
    const result = validateAnswerKey(bad);
    expect(result.valid).toBe(false);
  });

  it('rejects choice options.length != 2', () => {
    const bad = {
      type: 'guided-discovery',
      title: 'x',
      steps: [{
        type: 'observation_choice',
        id: 'obs',
        title: 'obs',
        choices: [{ id: 'c1', prompt: 'p', options: ['a', 'b', 'c'], correct: 0 }],
      }],
    };
    const result = validateAnswerKey(bad);
    expect(result.valid).toBe(false);
  });

  it('rejects formula_blanks with empty accepts', () => {
    const bad = {
      type: 'guided-discovery',
      title: 'x',
      steps: [{
        type: 'formula_blanks',
        id: 'f',
        title: 'f',
        blanks: [{ id: 'b1', label: 'l', accepts: [] }],
      }],
    };
    const result = validateAnswerKey(bad);
    expect(result.valid).toBe(false);
  });

  it('accepts minimal valid key (single text_blanks step, no summary)', () => {
    const minimal = {
      type: 'guided-discovery',
      title: 'min',
      steps: [{
        type: 'text_blanks',
        id: 's',
        title: 't',
        template: '__',
        blanks: [{ id: 'b', accepts: ['x'] }],
      }],
    };
    expect(validateAnswerKey(minimal).valid).toBe(true);
  });
});

// ── Sanitizer — answer leakage ──

describe('sanitizeGuidedDiscovery', () => {
  it('preserves correct for observation_choice (client-side feedback)', () => {
    const spec = sanitizeAnswerKey(answerKey)!;
    expect(spec.type).toBe('guided-discovery');
    const obsStep = spec.gdSteps!.find(s => s.type === 'observation_choice')!;
    expect(obsStep.choices![0]).toHaveProperty('correct', 0);
    expect(obsStep.choices![1]).toHaveProperty('correct', 0);
  });

  it('strips accepts and rejects from formula_blanks', () => {
    const spec = sanitizeAnswerKey(answerKey)!;
    const symStep = spec.gdSteps!.find(s => s.type === 'formula_blanks')!;
    for (const blank of symStep.blanks!) {
      expect(blank).not.toHaveProperty('accepts');
      expect(blank).not.toHaveProperty('rejects');
      expect(blank).not.toHaveProperty('rejectHint');
    }
  });

  it('strips accepts from derivation_blank lines', () => {
    const spec = sanitizeAnswerKey(answerKey)!;
    const verStep = spec.gdSteps!.find(s => s.type === 'derivation_blank')!;
    for (const line of verStep.lines!) {
      if (line.blank) {
        expect(line.blank).not.toHaveProperty('accepts');
      }
    }
  });

  it('strips accepts from text_blanks (mapped to textBlanks)', () => {
    const spec = sanitizeAnswerKey(answerKey)!;
    const verbStep = spec.gdSteps!.find(s => s.type === 'text_blanks')!;
    // text_blanks blanks are mapped to textBlanks (id only)
    expect(verbStep.textBlanks).toBeDefined();
    for (const b of verbStep.textBlanks!) {
      expect(b).not.toHaveProperty('accepts');
    }
    // original blanks field should not be present for text_blanks
    expect(verbStep.blanks).toBeUndefined();
  });

  it('preserves table and highlights for student display', () => {
    const spec = sanitizeAnswerKey(answerKey)!;
    const obsStep = spec.gdSteps!.find(s => s.type === 'observation_choice')!;
    expect(obsStep.table).toHaveLength(2);
    expect(obsStep.highlights).toBeDefined();
  });

  it('preserves gdTitle and gdSummary', () => {
    const spec = sanitizeAnswerKey(answerKey)!;
    expect(spec.gdTitle).toBe('平方差公式');
    expect(spec.gdSummary).toEqual({ formula: '(a+b)(a-b) = a²-b²', name: '平方差公式' });
  });

  it('omits gdSummary when answer key has no summary', () => {
    const noSummary = { ...answerKey, summary: undefined };
    const spec = sanitizeAnswerKey(noSummary)!;
    expect(spec.gdSummary).toBeUndefined();
  });

  it('preserves label from exerciseLabel param', () => {
    const spec = sanitizeAnswerKey(answerKey, '引导发现练习')!;
    expect(spec.label).toBe('引导发现练习');
  });
});

// ── buildCheckItems ──

describe('buildCheckItems — guided-discovery', () => {
  it('returns per-step check items', async () => {
    const gradeResult = await grader.grade(answerKey, allCorrectData);
    const items = buildCheckItems(answerKey as unknown as Record<string, unknown>, allCorrectData, gradeResult);
    expect(items).toHaveLength(4);
    expect(items.map(i => i.idx)).toEqual(['observe', 'symbolize', 'verify', 'verbalize']);
    expect(items.every(i => i.correct === true)).toBe(true);
  });

  it('marks failing steps as incorrect', async () => {
    const data = {
      steps: {
        observe: { answers: { c1: 1, c2: 0 } },
        symbolize: { answers: { lhs: '(a+b)(a-b)', rhs: 'a²-b²' } },
        verify: { answers: { d1: 'wrong', d2: 'a²-b²' } },
        verbalize: { answers: { t1: '和', t2: '差', t3: '平方差' } },
      },
    };
    const gradeResult = await grader.grade(answerKey, data);
    const items = buildCheckItems(answerKey as unknown as Record<string, unknown>, data, gradeResult);
    expect(items.find(i => i.idx === 'observe')!.correct).toBe(false);
    expect(items.find(i => i.idx === 'symbolize')!.correct).toBe(true);
    expect(items.find(i => i.idx === 'verify')!.correct).toBe(false);
    expect(items.find(i => i.idx === 'verbalize')!.correct).toBe(true);
  });

  it('returns all false on empty submission', async () => {
    const gradeResult = await grader.grade(answerKey, {});
    const items = buildCheckItems(answerKey as unknown as Record<string, unknown>, {}, gradeResult);
    expect(items.every(i => i.correct === false)).toBe(true);
  });
});

// ── Image blank grading (two-stage: LLM OCR → matchesAny) ──

describe('GuidedDiscoveryGrader — image blanks', () => {
  const FAKE_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

  function mockAiPromptBuilder(response: string): AiPromptBuilder {
    return {
      callVisionLlm: jest.fn().mockResolvedValue(response),
    } as unknown as AiPromptBuilder;
  }

  const imageKey: GuidedDiscoveryAnswerKey = {
    type: 'guided-discovery',
    title: 'test',
    steps: [{
      type: 'formula_blanks',
      id: 'sym',
      title: '写出公式',
      blanks: [
        { id: 'lhs', label: '左边', accepts: ['(a+b)(a-b)'], rejects: ['a+b'], rejectHint: '需要写完整的乘法' },
        { id: 'rhs', label: '右边', accepts: ['a²-b²', 'a^2-b^2'] },
      ],
    }],
  };

  it('calls vision LLM for data URI answer and marks correct via matchesAny', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(true);
    expect(result.total).toBe(100);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(1);
  });

  it('marks incorrect when recognized text not in accepts', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: 'x+y' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toContain('识别结果「x+y」不正确');
  });

  it('returns rejectHint when recognized text matches rejects', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: 'a+b' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toContain('需要写完整的乘法');
  });

  it('handles mixed keyboard + image answers', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(true);
    // Only the image blank triggers LLM; keyboard blank uses matchesAny
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(1);
  });

  it('marks step incorrect on LLM failure', async () => {
    const ai = {
      callVisionLlm: jest.fn().mockRejectedValue(new Error('LLM timeout')),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toContain('图片识别失败');
  });

  it('keyboard-only answers skip LLM entirely', async () => {
    const ai = mockAiPromptBuilder('should not be called');
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: '(a+b)(a-b)', rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(true);
    expect(ai.callVisionLlm).not.toHaveBeenCalled();
    expect(result.llmFeedback).toBeUndefined();
  });

  it('prompt no longer includes correct answers or rejects', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    await g.grade(imageKey, data);
    const callArgs = (ai.callVisionLlm as jest.Mock).mock.calls[0];
    const userContent = callArgs[1].find((c: { type: string }) => c.type === 'text');
    expect(userContent.text).not.toContain('正确答案');
    expect(userContent.text).not.toContain('常见错误');
    expect(userContent.text).toContain('学生正在填写：左边');
  });

  it('derivation_blank image answers are graded via LLM + matchesAny', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: 'a²-b²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const derivKey: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'derivation_blank',
        id: 'v',
        title: '验证',
        lines: [
          { text: '(a+b)(a-b)' },
          { text: '= ', blank: { id: 'd1', accepts: ['a²-b²'] } },
        ],
      }],
    };
    const data = { steps: { v: { answers: { d1: FAKE_IMAGE } } } };
    const result = await g.grade(derivKey, data);
    expect(result.byDimension.v).toBe(true);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(1);
  });

  it('text_blanks image answers are graded via LLM + matchesAny', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '和' }));
    const g = new GuidedDiscoveryGrader(ai);
    const textKey: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'text_blanks',
        id: 't',
        title: '文字表述',
        template: '两数__乘以两数__',
        blanks: [{ id: 'b1', accepts: ['和', '之和'] }],
      }],
    };
    const data = { steps: { t: { answers: { b1: FAKE_IMAGE } } } };
    const result = await g.grade(textKey, data);
    expect(result.byDimension.t).toBe(true);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(1);
  });

  it('handles malformed LLM response gracefully', async () => {
    const ai = mockAiPromptBuilder('Sorry, I cannot read the image.');
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toContain('图片识别失败');
  });

  it('handles code-fence wrapped JSON response', async () => {
    const ai = mockAiPromptBuilder('```json\n{"recognized":"(a+b)(a-b)"}\n```');
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(true);
  });

  it('returns explicit feedback when AI service is unavailable', async () => {
    const g = new GuidedDiscoveryGrader(); // no aiPromptBuilder
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toContain('图片识别服务不可用');
  });

  it('both blanks as images triggers two LLM calls', async () => {
    const ai = {
      callVisionLlm: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ recognized: '(a+b)(a-b)' }))
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'a²-b²' })),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: FAKE_IMAGE } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(true);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(2);
    // Both correct via matchesAny → no feedback
    expect(result.llmFeedback).toBeUndefined();
  });

  it('both blanks as images, both wrong — feedbacks joined with semicolon', async () => {
    const ai = {
      callVisionLlm: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'x' }))
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'y' })),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: FAKE_IMAGE } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toBe('识别结果「x」不正确; 识别结果「y」不正确');
  });

  it('image correct but keyboard blank wrong — step still fails', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'WRONG' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.total).toBe(0);
  });

  it('multiple steps with images — feedbacks from different steps joined with newline', async () => {
    const ai = {
      callVisionLlm: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'x' }))
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'y' })),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    const multiImageKey: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [
        {
          type: 'formula_blanks',
          id: 's1',
          title: '公式',
          blanks: [{ id: 'b1', label: 'x', accepts: ['a²-b²'] }],
        },
        {
          type: 'formula_blanks',
          id: 's2',
          title: '验证',
          blanks: [{ id: 'b2', label: 'y', accepts: ['(a+b)(a-b)'] }],
        },
      ],
    };
    const data = {
      steps: {
        s1: { answers: { b1: FAKE_IMAGE } },
        s2: { answers: { b2: FAKE_IMAGE } },
      },
    };
    const result = await g.grade(multiImageKey, data);
    expect(result.byDimension.s1).toBe(false);
    expect(result.byDimension.s2).toBe(false);
    expect(result.llmFeedback).toBe('识别结果「x」不正确\n识别结果「y」不正确');
  });

  it('recognized text with different case/symbols still matches via normalizeMath', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '(A+B)(A-B)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    // matchesAny normalizes case → should match
    expect(result.byDimension.sym).toBe(true);
    expect(result.llmFeedback).toBeUndefined();
  });

  it('LLM returns empty recognized string — treated as unrecognizable', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toContain('无法识别手写内容');
  });

  it('LLM returns JSON missing recognized field — treated as unrecognizable', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ text: 'something' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(false);
    expect(result.llmFeedback).toContain('无法识别手写内容');
  });

  it('correct image recognition produces no feedback', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(true);
    expect(result.llmFeedback).toBeUndefined();
  });

  it('derivation_blank prompt uses step title when blank has no label', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: 'a²-b²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const derivKey: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery',
      title: 'test',
      steps: [{
        type: 'derivation_blank',
        id: 'v',
        title: '验证步骤',
        lines: [
          { text: '(a+b)(a-b)' },
          { text: '= ', blank: { id: 'd1', accepts: ['a²-b²'] } },
        ],
      }],
    };
    const data = { steps: { v: { answers: { d1: FAKE_IMAGE } } } };
    await g.grade(derivKey, data);
    const callArgs = (ai.callVisionLlm as jest.Mock).mock.calls[0];
    const userContent = callArgs[1].find((c: { type: string }) => c.type === 'text');
    // derivation blanks have no label, so prompt falls back to step title
    expect(userContent.text).toContain('填空题（步骤：验证步骤）');
    expect(userContent.text).not.toContain('学生正在填写');
  });

  it('data:image/png URI is detected as image', async () => {
    const pngImage = 'data:image/png;base64,iVBORw0KGgo=';
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: pngImage, rhs: 'a²-b²' } } },
    };
    const result = await g.grade(imageKey, data);
    expect(result.byDimension.sym).toBe(true);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(1);
  });

  it('buildCheckItems omits _llm when all image blanks correct (no feedback)', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const gradeResult = await g.grade(imageKey, data);
    const items = buildCheckItems(imageKey as unknown as Record<string, unknown>, data, gradeResult);
    expect(items.find(i => i.idx === '_llm')).toBeUndefined();
    expect(items).toHaveLength(1); // only the sym step
  });

  it('buildCheckItems includes llmFeedback for image grading', async () => {
    const ai = mockAiPromptBuilder(JSON.stringify({ recognized: 'a+b' }));
    const g = new GuidedDiscoveryGrader(ai);
    const data = {
      steps: { sym: { answers: { lhs: FAKE_IMAGE, rhs: 'a²-b²' } } },
    };
    const gradeResult = await g.grade(imageKey, data);
    const items = buildCheckItems(imageKey as unknown as Record<string, unknown>, data, gradeResult);
    const llmItem = items.find(i => i.idx === '_llm');
    expect(llmItem).toBeDefined();
    // 'a+b' is in rejects → rejectHint
    expect(llmItem!.hint).toContain('需要写完整的乘法');
  });
});

// ── Two-stage OCR: LLM call parameters & prompt ──

describe('GuidedDiscoveryGrader — image OCR prompt & params', () => {
  // Real minimal valid images (1×1 pixel PNGs / JPEG / WebP)
  const IMG_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';
  const IMG_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
  const IMG_WEBP = 'data:image/webp;base64,UklGRgAAAABXRUJQ';

  function mockAi(response: string): AiPromptBuilder {
    return { callVisionLlm: jest.fn().mockResolvedValue(response) } as unknown as AiPromptBuilder;
  }

  const singleBlankKey: GuidedDiscoveryAnswerKey = {
    type: 'guided-discovery',
    title: 'test',
    steps: [{
      type: 'formula_blanks',
      id: 's',
      title: '公式',
      blanks: [{ id: 'b', label: '左边', accepts: ['(a+b)(a-b)'] }],
    }],
  };

  it('system prompt is OCR-only, no answer judging', async () => {
    const ai = mockAi(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    await g.grade(singleBlankKey, { steps: { s: { answers: { b: IMG_PNG } } } });
    const [systemPrompt] = (ai.callVisionLlm as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('OCR');
    expect(systemPrompt).toContain('忠实转录');
    expect(systemPrompt).not.toContain('判断');
    expect(systemPrompt).not.toContain('正确');
  });

  it('passes maxTokens: 200, temperature: 0, json_object format', async () => {
    const ai = mockAi(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    await g.grade(singleBlankKey, { steps: { s: { answers: { b: IMG_PNG } } } });
    const opts = (ai.callVisionLlm as jest.Mock).mock.calls[0][2];
    expect(opts.maxTokens).toBe(200);
    expect(opts.temperature).toBe(0);
    expect(opts.responseFormat).toEqual({ type: 'json_object' });
    expect(opts.model).toBe('qwen3-vl-plus');
  });

  it('user prompt asks for dual-field JSON (allText + recognized)', async () => {
    const ai = mockAi(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    await g.grade(singleBlankKey, { steps: { s: { answers: { b: IMG_PNG } } } });
    const userContent = (ai.callVisionLlm as jest.Mock).mock.calls[0][1]
      .find((c: { type: string }) => c.type === 'text');
    expect(userContent.text).toContain('"allText"');
    expect(userContent.text).toContain('"recognized"');
    expect(userContent.text).toContain('填写位置');
    // Must NOT leak accepts/rejects to the LLM
    expect(userContent.text).not.toContain('(a+b)(a-b)');
  });

  it('system prompt mentions 涂改 and 划掉', async () => {
    const ai = mockAi(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    await g.grade(singleBlankKey, { steps: { s: { answers: { b: IMG_PNG } } } });
    const [systemPrompt] = (ai.callVisionLlm as jest.Mock).mock.calls[0];
    expect(systemPrompt).toContain('涂改');
    expect(systemPrompt).toContain('划掉');
  });

  it('sends image_url content part with the data URI', async () => {
    const ai = mockAi(JSON.stringify({ recognized: 'x' }));
    const g = new GuidedDiscoveryGrader(ai);
    await g.grade(singleBlankKey, { steps: { s: { answers: { b: IMG_PNG } } } });
    const imgPart = (ai.callVisionLlm as jest.Mock).mock.calls[0][1]
      .find((c: { type: string }) => c.type === 'image_url');
    expect(imgPart.image_url.url).toBe(IMG_PNG);
  });

  it('detects data:image/jpeg URI as image', async () => {
    const ai = mockAi(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(singleBlankKey, { steps: { s: { answers: { b: IMG_JPEG } } } });
    expect(result.byDimension.s).toBe(true);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(1);
  });

  it('detects data:image/webp URI as image', async () => {
    const ai = mockAi(JSON.stringify({ recognized: '(a+b)(a-b)' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(singleBlankKey, { steps: { s: { answers: { b: IMG_WEBP } } } });
    expect(result.byDimension.s).toBe(true);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(1);
  });
});

// ── Two-stage OCR: matchesAny correctness after recognition ──

describe('GuidedDiscoveryGrader — image OCR → matchesAny edge cases', () => {
  const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';

  function mockAi(response: string): AiPromptBuilder {
    return { callVisionLlm: jest.fn().mockResolvedValue(response) } as unknown as AiPromptBuilder;
  }

  // ── Normalization on recognized text ──

  it('recognized superscript ² matches caret-2 in accepts', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a^2-b^2'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: 'a²-b²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('recognized Chinese brackets ＋ multiplication normalize to match', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['(a+b)*(a-b)'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: '（a+b）×（a-b）' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('recognized em-dash/en-dash normalize to minus', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a-b'] }] }],
    };
    for (const dash of ['\u2014', '\u2013', '\u2212']) {
      const ai = mockAi(JSON.stringify({ recognized: `a${dash}b` }));
      const g = new GuidedDiscoveryGrader(ai);
      const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
      expect(result.byDimension.s).toBe(true);
    }
  });

  it('recognized full-width equals normalizes to match', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a=b'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: 'a\uff1db' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('recognized with leading/trailing whitespace still matches after trim', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a²-b²'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: '  a²-b²  ' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  // ── Unrecognizable inputs ──

  it('whitespace-only recognized text treated as unrecognizable', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: '   \t\n  ' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('无法识别手写内容');
  });

  it('recognized: null treated as unrecognizable', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: null }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('无法识别手写内容');
  });

  it('empty JSON object {} treated as unrecognizable', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a'] }] }],
    };
    const ai = mockAi('{}');
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('无法识别手写内容');
  });

  // ── Reject path edge cases ──

  it('rejects exist but rejectHint is undefined → falls through to generic message', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a²-b²'], rejects: ['b²-a²'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: 'b²-a²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    // No rejectHint → should use generic feedback, not crash
    expect(result.llmFeedback).toContain('识别结果「b²-a²」不正确');
  });

  it('rejects is empty array → skips reject check, uses generic message', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a²-b²'], rejects: [], rejectHint: 'should not appear' }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: 'wrong' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('识别结果「wrong」不正确');
    expect(result.llmFeedback).not.toContain('should not appear');
  });

  it('recognized matches normalized reject form → triggers rejectHint', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{
          id: 'b', label: 'x',
          accepts: ['a²-b²'],
          rejects: ['b^2-a^2'],       // caret form
          rejectHint: '注意顺序',
        }] }],
    };
    // LLM returns superscript form → normalizeMath should still match reject
    const ai = mockAi(JSON.stringify({ recognized: 'b²-a²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('注意顺序');
  });

  it('accepts takes priority over rejects when both match (overlap)', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{
          id: 'b', label: 'x',
          accepts: ['a-b'],
          rejects: ['a-b'],  // overlap (misconfigured, but should not crash)
          rejectHint: '错误',
        }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: 'a-b' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    // accepts check runs first → correct
    expect(result.byDimension.s).toBe(true);
  });

  // ── Backward compatibility: old LLM format with extra fields ──

  it('old format { recognized, correct: false } → still judged correct by matchesAny', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['(a+b)(a-b)'] }] }],
    };
    // LLM returns old format with correct: false, but recognized text actually matches
    const ai = mockAi(JSON.stringify({
      recognized: '(a+b)(a-b)',
      correct: false,        // ignored by two-stage
      feedback: '不正确',     // ignored by two-stage
    }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    // matchesAny decides, not LLM → correct
    expect(result.byDimension.s).toBe(true);
    expect(result.llmFeedback).toBeUndefined();
  });

  it('old format { recognized, correct: true } → still judged wrong by matchesAny if not in accepts', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['(a+b)(a-b)'] }] }],
    };
    // LLM says correct:true but recognized text is wrong → two-stage catches the lie
    const ai = mockAi(JSON.stringify({
      recognized: 'a+b',
      correct: true,          // ignored
      feedback: '正确！',      // ignored
    }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('识别结果「a+b」不正确');
  });

  // ── JSON parsing edge cases ──

  it('partial JSON triggers catch → 图片识别失败', async () => {
    const ai = mockAi('{ "recognized": "a+b');
    const g = new GuidedDiscoveryGrader(ai);
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a'] }] }],
    };
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('图片识别失败');
  });

  it('JSON with escaped unicode \\u002b is parsed correctly', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a+b'] }] }],
    };
    // \u002b = '+'
    const ai = mockAi('{ "recognized": "a\\u002bb" }');
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('code-fence with extra whitespace is stripped', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a²-b²'] }] }],
    };
    const ai = mockAi('```json\n  { "recognized": "a²-b²" }  \n```\n');
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  // ── Prompt fallback: empty label ──

  it('empty string label falls back to step title in prompt', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: '验证步骤',
        blanks: [{ id: 'b', label: '', accepts: ['a²-b²'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: 'a²-b²' }));
    const g = new GuidedDiscoveryGrader(ai);
    await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    const userContent = (ai.callVisionLlm as jest.Mock).mock.calls[0][1]
      .find((c: { type: string }) => c.type === 'text');
    // empty string is falsy → falls back to step title
    expect(userContent.text).toContain('填空题（步骤：验证步骤）');
  });

  // ── Multiple blanks: mixed feedback types ──

  it('first blank reject + second blank wrong → both feedbacks joined', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [
          { id: 'b1', label: '左边', accepts: ['(a+b)(a-b)'], rejects: ['a+b'], rejectHint: '写完整' },
          { id: 'b2', label: '右边', accepts: ['a²-b²'] },
        ],
      }],
    };
    const ai = {
      callVisionLlm: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'a+b' }))    // rejects match
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'xyz' })),   // generic wrong
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b1: IMG, b2: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toBe('写完整; 识别结果「xyz」不正确');
  });

  it('first blank image fails + second blank image correct → step fails', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [
          { id: 'b1', label: '左边', accepts: ['(a+b)(a-b)'] },
          { id: 'b2', label: '右边', accepts: ['a²-b²'] },
        ],
      }],
    };
    const ai = {
      callVisionLlm: jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'a²-b²' })),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b1: IMG, b2: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('图片识别失败');
  });

  // ── LLM extra data tolerance ──

  it('LLM returns extra unknown fields alongside recognized → still works', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a²-b²'] }] }],
    };
    const ai = mockAi(JSON.stringify({
      recognized: 'a²-b²',
      confidence: 0.95,
      language: 'zh',
      bbox: [10, 20, 100, 50],
    }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  // ── Feedback message content ──

  it('generic wrong feedback includes the recognized text in guillemets', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['正确答案'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: '学生写的内容' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.llmFeedback).toBe('识别结果「学生写的内容」不正确');
  });

  it('very long recognized text is truncated to 50 chars in feedback', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a'] }] }],
    };
    const longText = 'x'.repeat(80);
    const ai = mockAi(JSON.stringify({ recognized: longText }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.llmFeedback).toBe(`识别结果「${'x'.repeat(50)}…」不正确`);
    expect(result.llmFeedback!.length).toBeLessThan(80);
  });

  it('recognized text at exactly 50 chars is not truncated', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a'] }] }],
    };
    const text50 = 'y'.repeat(50);
    const ai = mockAi(JSON.stringify({ recognized: text50 }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.llmFeedback).toBe(`识别结果「${text50}」不正确`);
    expect(result.llmFeedback).not.toContain('…');
  });

  it('unrecognizable feedback does not include empty guillemets', async () => {
    const key: GuidedDiscoveryAnswerKey = {
      type: 'guided-discovery', title: 'test',
      steps: [{ type: 'formula_blanks', id: 's', title: 't',
        blanks: [{ id: 'b', label: 'x', accepts: ['a'] }] }],
    };
    const ai = mockAi(JSON.stringify({ recognized: '' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(key, { steps: { s: { answers: { b: IMG } } } });
    expect(result.llmFeedback).toBe('无法识别手写内容，请重新书写');
    expect(result.llmFeedback).not.toContain('「」');
  });
});

// ── allText fallback grading ──

describe('GuidedDiscoveryGrader — image OCR allText fallback', () => {
  const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';

  function mockAi(response: string): AiPromptBuilder {
    return { callVisionLlm: jest.fn().mockResolvedValue(response) } as unknown as AiPromptBuilder;
  }

  const fallbackKey: GuidedDiscoveryAnswerKey = {
    type: 'guided-discovery',
    title: 'test',
    steps: [{
      type: 'formula_blanks',
      id: 's',
      title: '公式',
      blanks: [{ id: 'b', label: '右边', accepts: ['a²-b²', 'a^2-b^2'], rejects: ['b²-a²'], rejectHint: '注意符号顺序' }],
    }],
  };

  it('recognized directly matches → correct', async () => {
    const ai = mockAi(JSON.stringify({ allText: '(a+b)(a-b)\n= a²-b²', recognized: 'a²-b²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(fallbackKey, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('recognized misses but allText line matches → correct (fallback)', async () => {
    const ai = mockAi(JSON.stringify({ allText: '(a+b)(a-b)\n= a²-b²', recognized: '推导过程' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(fallbackKey, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('allText line with = prefix still matches after stripping', async () => {
    const ai = mockAi(JSON.stringify({ allText: '= a²-b²', recognized: 'xxx' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(fallbackKey, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('fullwidth ＝ prefix also stripped', async () => {
    const ai = mockAi(JSON.stringify({ allText: '＝ a²-b²', recognized: 'xxx' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(fallbackKey, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('recognized and allText both miss → incorrect', async () => {
    const ai = mockAi(JSON.stringify({ allText: 'b²-a²', recognized: 'b²-a²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(fallbackKey, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
  });

  it('allText absent — fallback does not throw', async () => {
    const ai = mockAi(JSON.stringify({ recognized: 'a²-b²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(fallbackKey, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });

  it('recognized matches rejects and allText also misses → rejectHint', async () => {
    const ai = mockAi(JSON.stringify({ allText: 'b²-a²', recognized: 'b²-a²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(fallbackKey, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(result.llmFeedback).toContain('注意符号顺序');
  });

  it('old format (only recognized) still works', async () => {
    const ai = mockAi(JSON.stringify({ recognized: 'a²-b²' }));
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(fallbackKey, { steps: { s: { answers: { b: IMG } } } });
    expect(result.byDimension.s).toBe(true);
  });
});

// ── swappable text_blanks + image OCR caching ──

describe('GuidedDiscoveryGrader — swappable image blanks (ocrCache)', () => {
  const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';

  const swappableKey: GuidedDiscoveryAnswerKey = {
    type: 'guided-discovery',
    title: 'test',
    steps: [{
      type: 'text_blanks',
      id: 's',
      title: '填空',
      template: '__乘以__',
      blanks: [
        { id: 'b1', accepts: ['和', '之和'] },
        { id: 'b2', accepts: ['差', '之差'] },
      ],
      swappable: true,
    }],
  };

  it('swapped image blanks correct — vision called only once per blank (2 total, not 4)', async () => {
    const ai = {
      callVisionLlm: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ recognized: '差' }))
        .mockResolvedValueOnce(JSON.stringify({ recognized: '和' })),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    // b1 answers '差' (wrong for b1.accepts=['和']), b2 answers '和' (wrong for b2.accepts=['差'])
    // but swapped: b1.accepts=['差'] matches '差', b2.accepts=['和'] matches '和'
    const result = await g.grade(swappableKey, { steps: { s: { answers: { b1: IMG, b2: IMG } } } });
    expect(result.byDimension.s).toBe(true);
    // Only 2 vision calls (first gradeBlanks), not 4 (retry reuses cache)
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(2);
  });

  it('swapped image blanks both wrong in both orders — still fails', async () => {
    const ai = {
      callVisionLlm: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'x' }))
        .mockResolvedValueOnce(JSON.stringify({ recognized: 'y' })),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(swappableKey, { steps: { s: { answers: { b1: IMG, b2: IMG } } } });
    expect(result.byDimension.s).toBe(false);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(2);
  });

  it('mixed image + text, swapped order correct — only 1 vision call', async () => {
    const ai = {
      callVisionLlm: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ recognized: '差' })),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    // b1=image('差'), b2=text('和') — original order wrong, swapped correct
    const result = await g.grade(swappableKey, { steps: { s: { answers: { b1: IMG, b2: '和' } } } });
    expect(result.byDimension.s).toBe(true);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(1);
  });

  it('image blanks correct in original order — no retry, 2 vision calls', async () => {
    const ai = {
      callVisionLlm: jest.fn()
        .mockResolvedValueOnce(JSON.stringify({ recognized: '和' }))
        .mockResolvedValueOnce(JSON.stringify({ recognized: '差' })),
    } as unknown as AiPromptBuilder;
    const g = new GuidedDiscoveryGrader(ai);
    const result = await g.grade(swappableKey, { steps: { s: { answers: { b1: IMG, b2: IMG } } } });
    expect(result.byDimension.s).toBe(true);
    expect(ai.callVisionLlm).toHaveBeenCalledTimes(2);
  });
});
