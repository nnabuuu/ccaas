/**
 * FillBlankPlugin unit tests.
 *
 * Coverage targets (the file was at 30% before this spec):
 *   - schema validation accepts/rejects representative shapes
 *   - sanitize() strips answer-bearing fields
 *   - grade(): exact accepts match → 100%; mismatched → LLM equivalence call;
 *     LLM-equivalent → recover correctness; LLM rejects → keep wrong
 *   - buildCheckItems() emits per-blank items from byDimension
 *   - §14 L3: buildGradePrompt emits one spec when LLM check is needed;
 *     parseGradeResponse re-runs grading with the edited LLM response
 */
import type { AiPromptBuilder } from '../../../../application/ai/ai-prompt-builder';
import { FillBlankPlugin } from '../fill-blank.plugin';

function makeMockAi(responses: string[]): AiPromptBuilder {
  let i = 0;
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callLlm: jest.fn(async (..._args: any[]) => responses[i++] ?? '{}'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callVisionLlm: jest.fn(),
  } as unknown as AiPromptBuilder;
}

const AK = {
  type: 'fill-blank' as const,
  sentences: [
    {
      id: 's1',
      template: '{{0}} is the capital of France.',
      blanks: { '0': { accepts: ['Paris', 'paris'] } },
    },
    {
      id: 's2',
      template: 'The sky is {{0}}.',
      blanks: { '0': { accepts: ['blue'] } },
    },
  ],
};

describe('FillBlankPlugin.answerKeySchema', () => {
  const plugin = new FillBlankPlugin(makeMockAi([]));

  it('accepts a valid fill-blank key', () => {
    expect(plugin.answerKeySchema.safeParse(AK).success).toBe(true);
  });

  it('rejects sentences[] empty', () => {
    expect(
      plugin.answerKeySchema.safeParse({ type: 'fill-blank', sentences: [] }).success,
    ).toBe(false);
  });

  it('rejects blank with empty accepts list', () => {
    const bad = {
      type: 'fill-blank',
      sentences: [{ id: 's1', template: 't', blanks: { '0': { accepts: [] } } }],
    };
    expect(plugin.answerKeySchema.safeParse(bad).success).toBe(false);
  });
});

describe('FillBlankPlugin.sanitize', () => {
  const plugin = new FillBlankPlugin(makeMockAi([]));

  it('strips blanks (answer data) and keeps id + template', () => {
    const spec = plugin.sanitize({ answerKey: AK }) as Record<string, unknown>;
    expect(spec.type).toBe('fill-blank');
    expect(spec.sentences).toEqual([
      { id: 's1', template: '{{0}} is the capital of France.' },
      { id: 's2', template: 'The sky is {{0}}.' },
    ]);
  });

  it('uses exerciseLabel when provided', () => {
    const spec = plugin.sanitize({ answerKey: AK, exerciseLabel: 'Geography' }) as Record<string, unknown>;
    expect(spec.label).toBe('Geography');
  });
});

describe('FillBlankPlugin.grade', () => {
  it('returns 100 when every blank matches accepts exactly (no LLM call)', async () => {
    const ai = makeMockAi([]);
    const plugin = new FillBlankPlugin(ai);
    const result = await plugin.grade({
      key: AK,
      data: { blanks: { s1_0: 'Paris', s2_0: 'blue' } },
    });
    expect(result.total).toBe(100);
    expect(result.byDimension).toEqual({ s1_0: true, s2_0: true });
    expect(ai.callLlm).not.toHaveBeenCalled();
  });

  it('returns 0 when all blanks are empty', async () => {
    const plugin = new FillBlankPlugin(makeMockAi([]));
    const result = await plugin.grade({ key: AK, data: { blanks: {} } });
    expect(result.total).toBe(0);
    expect(result.byDimension).toEqual({ s1_0: false, s2_0: false });
  });

  it('handles case-insensitive accept matching', async () => {
    const plugin = new FillBlankPlugin(makeMockAi([]));
    const result = await plugin.grade({
      key: AK,
      data: { blanks: { s1_0: 'PARIS', s2_0: 'BLUE' } },
    });
    expect(result.total).toBe(100);
  });

  it('falls back to LLM equivalence when accepts mismatch', async () => {
    const ai = makeMockAi([
      JSON.stringify({ results: [{ index: 0, equivalent: true }] }),
    ]);
    const plugin = new FillBlankPlugin(ai);
    const result = await plugin.grade({
      key: AK,
      data: { blanks: { s1_0: 'the City of Light', s2_0: 'blue' } },
    });
    expect(ai.callLlm).toHaveBeenCalledTimes(1);
    expect(result.byDimension.s1_0).toBe(true);
    expect(result.byDimension.s2_0).toBe(true);
    expect(result.total).toBe(100);
  });

  it('keeps a blank wrong when LLM rejects equivalence', async () => {
    const ai = makeMockAi([
      JSON.stringify({ results: [{ index: 0, equivalent: false }] }),
    ]);
    const plugin = new FillBlankPlugin(ai);
    const result = await plugin.grade({
      key: AK,
      data: { blanks: { s1_0: 'London', s2_0: 'blue' } },
    });
    expect(result.byDimension.s1_0).toBe(false);
    expect(result.byDimension.s2_0).toBe(true);
    expect(result.total).toBe(50);
  });

  it('handles a malformed LLM response gracefully (treats as not equivalent)', async () => {
    const ai = makeMockAi(['not json {{']);
    const plugin = new FillBlankPlugin(ai);
    const result = await plugin.grade({
      key: AK,
      data: { blanks: { s1_0: 'unknown', s2_0: 'blue' } },
    });
    // The malformed pending answer doesn't get credit
    expect(result.byDimension.s1_0).toBe(false);
    expect(result.byDimension.s2_0).toBe(true);
  });
});

describe('FillBlankPlugin.buildCheckItems', () => {
  const plugin = new FillBlankPlugin(makeMockAi([]));

  it('emits one item per blank-dimension in the grade result', () => {
    const items = plugin.buildCheckItems({
      key: AK,
      data: {},
      gradeResult: { total: 50, byDimension: { s1_0: true, s2_0: false } },
    });
    expect(items).toEqual(
      expect.arrayContaining([
        { idx: 's1_0', correct: true },
        { idx: 's2_0', correct: false },
      ]),
    );
  });
});

describe('FillBlankPlugin §14 L3', () => {
  it('buildGradePrompt: zero pending → empty spec list (no LLM needed)', () => {
    const plugin = new FillBlankPlugin(makeMockAi([]));
    const specs = plugin.buildGradePrompt({
      key: AK,
      data: { blanks: { s1_0: 'Paris', s2_0: 'blue' } },
    });
    expect(specs).toEqual([]);
  });

  it('buildGradePrompt: one spec when any blank needs LLM equivalence', () => {
    const plugin = new FillBlankPlugin(makeMockAi([]));
    const specs = plugin.buildGradePrompt({
      key: AK,
      data: { blanks: { s1_0: 'City of Light', s2_0: 'blue' } },
    });
    expect(specs).toHaveLength(1);
    expect(specs[0].userMessage).toContain('City of Light');
    expect(specs[0].options?.responseFormat).toEqual({ type: 'json_object' });
  });

  it('parseGradeResponse: edited LLM response → re-graded GradeResult', () => {
    const plugin = new FillBlankPlugin(makeMockAi([]));
    const edited = JSON.stringify({ results: [{ index: 0, equivalent: true }] });
    const result = plugin.parseGradeResponse([edited], {
      key: AK,
      data: { blanks: { s1_0: 'Lutèce', s2_0: 'blue' } },
    });
    expect(result.byDimension.s1_0).toBe(true);
    expect(result.byDimension.s2_0).toBe(true);
    expect(result.total).toBe(100);
  });

  it('parseGradeResponse: empty responses + no pending → grades from accepts only', () => {
    const plugin = new FillBlankPlugin(makeMockAi([]));
    const result = plugin.parseGradeResponse([], {
      key: AK,
      data: { blanks: { s1_0: 'Paris', s2_0: 'blue' } },
    });
    expect(result.total).toBe(100);
  });

  it('parseGradeResponse: malformed response → treats pending as wrong', () => {
    const plugin = new FillBlankPlugin(makeMockAi([]));
    const result = plugin.parseGradeResponse(['not json'], {
      key: AK,
      data: { blanks: { s1_0: 'Lutèce', s2_0: 'blue' } },
    });
    expect(result.byDimension.s1_0).toBe(false);
  });
});
