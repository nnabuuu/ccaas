import { FillBlankGrader } from '../fill-blank.grader';
import type { FillBlankAnswerKey } from '../../../../schemas';
import type { AiPromptBuilder } from '../../../../application/ai/ai-prompt-builder';

const baseKey: FillBlankAnswerKey = {
  type: 'fill-blank',
  sentences: [
    {
      id: 's1',
      template: '两个数的{{1}}与这两个数的{{2}}的乘积等于这两个数的{{3}}。',
      blanks: {
        '1': { accepts: ['和'] },
        '2': { accepts: ['差'] },
        '3': { accepts: ['平方差'], hint: 'a²-b² 叫做？' },
      },
    },
    {
      id: 's2',
      template: '$(a+b)(a-b)=${{1}}',
      blanks: {
        '1': { accepts: ['a²-b²', 'a^2-b^2'] },
      },
    },
  ],
};

describe('FillBlankGrader (no LLM)', () => {
  const grader = new FillBlankGrader();

  it('scores 100 when all blanks correct', async () => {
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '平方差', s2_1: 'a²-b²' },
    });
    expect(r.total).toBe(100);
    expect(r.byDimension).toEqual({
      s1_1: true, s1_2: true, s1_3: true, s2_1: true,
    });
  });

  it('scores 0 when all blanks wrong', async () => {
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '积', s1_2: '和', s1_3: '完全平方', s2_1: 'a+b' },
    });
    expect(r.total).toBe(0);
    expect(r.byDimension).toEqual({
      s1_1: false, s1_2: false, s1_3: false, s2_1: false,
    });
  });

  it('scores partial correctness', async () => {
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: 'wrong', s2_1: 'wrong' },
    });
    expect(r.total).toBe(50); // 2/4
    expect(r.byDimension.s1_1).toBe(true);
    expect(r.byDimension.s1_2).toBe(true);
    expect(r.byDimension.s1_3).toBe(false);
    expect(r.byDimension.s2_1).toBe(false);
  });

  it('accepts alternative forms from accepts array', async () => {
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '平方差', s2_1: 'a^2-b^2' },
    });
    expect(r.total).toBe(100);
    expect(r.byDimension.s2_1).toBe(true);
  });

  it('matches case-insensitively', async () => {
    const key: FillBlankAnswerKey = {
      type: 'fill-blank',
      sentences: [{
        id: 's1',
        template: '{{1}}',
        blanks: { '1': { accepts: ['Hello'] } },
      }],
    };
    const r = await grader.grade(key, { blanks: { s1_1: 'hello' } });
    expect(r.total).toBe(100);
  });

  it('trims whitespace before matching', async () => {
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '  和  ', s1_2: '差', s1_3: '平方差', s2_1: ' a²-b² ' },
    });
    expect(r.total).toBe(100);
  });

  it('marks empty answers as incorrect', async () => {
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '', s1_2: '  ', s1_3: '平方差', s2_1: 'a²-b²' },
    });
    expect(r.total).toBe(50);
    expect(r.byDimension.s1_1).toBe(false);
    expect(r.byDimension.s1_2).toBe(false);
  });

  it('handles missing blanks data', async () => {
    const r = await grader.grade(baseKey, {});
    expect(r.total).toBe(0);
    expect(Object.values(r.byDimension).every(v => v === false)).toBe(true);
  });

  it('handles missing individual blank keys', async () => {
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和' }, // only 1 of 4 blanks
    });
    expect(r.total).toBe(25); // 1/4
    expect(r.byDimension.s1_1).toBe(true);
    expect(r.byDimension.s1_2).toBe(false);
  });

  it('marks non-matching answers as incorrect without LLM', async () => {
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '两数平方之差', s2_1: 'a²-b²' },
    });
    // '两数平方之差' is semantically close but not in accepts, no LLM → false
    expect(r.total).toBe(75);
    expect(r.byDimension.s1_3).toBe(false);
  });
});

describe('FillBlankGrader (with LLM)', () => {
  function mockBuilder(response: string | Error): AiPromptBuilder {
    const callLlm = response instanceof Error
      ? jest.fn().mockRejectedValue(response)
      : jest.fn().mockResolvedValue(response);
    return { callLlm } as unknown as AiPromptBuilder;
  }

  it('uses LLM for non-exact matches and accepts equivalent', async () => {
    const builder = mockBuilder(JSON.stringify({
      results: [{ index: 0, equivalent: true }],
    }));
    const grader = new FillBlankGrader(builder);
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '两数平方之差', s2_1: 'a²-b²' },
    });
    expect(r.total).toBe(100);
    expect(r.byDimension.s1_3).toBe(true);
    expect((builder.callLlm as jest.Mock)).toHaveBeenCalledTimes(1);
  });

  it('uses LLM and rejects non-equivalent', async () => {
    const builder = mockBuilder(JSON.stringify({
      results: [{ index: 0, equivalent: false }],
    }));
    const grader = new FillBlankGrader(builder);
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '完全不对', s2_1: 'a²-b²' },
    });
    expect(r.total).toBe(75);
    expect(r.byDimension.s1_3).toBe(false);
  });

  it('batches multiple non-exact items in one LLM call', async () => {
    const builder = mockBuilder(JSON.stringify({
      results: [
        { index: 0, equivalent: true },  // s1_3: '两数平方之差'
        { index: 1, equivalent: false },  // s2_1: 'a平方减b平方'
      ],
    }));
    const grader = new FillBlankGrader(builder);
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '两数平方之差', s2_1: 'a平方减b平方' },
    });
    expect((builder.callLlm as jest.Mock)).toHaveBeenCalledTimes(1);
    expect(r.byDimension.s1_3).toBe(true);
    expect(r.byDimension.s2_1).toBe(false);
    expect(r.total).toBe(75); // s1_1 + s1_2 + s1_3 correct, s2_1 wrong
  });

  it('falls back to false when LLM throws', async () => {
    const builder = mockBuilder(new Error('API failure'));
    const grader = new FillBlankGrader(builder);
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '两数平方之差', s2_1: 'a²-b²' },
    });
    expect(r.total).toBe(75);
    expect(r.byDimension.s1_3).toBe(false);
  });

  it('falls back when LLM returns invalid JSON', async () => {
    const builder = mockBuilder('not json');
    const grader = new FillBlankGrader(builder);
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '两数平方之差', s2_1: 'a²-b²' },
    });
    expect(r.total).toBe(75);
    expect(r.byDimension.s1_3).toBe(false);
  });

  it('handles missing index in LLM results', async () => {
    const builder = mockBuilder(JSON.stringify({
      results: [], // no results for the pending item
    }));
    const grader = new FillBlankGrader(builder);
    const r = await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '两数平方之差', s2_1: 'a²-b²' },
    });
    expect(r.byDimension.s1_3).toBe(false); // no match found → default false
  });

  it('skips LLM call when all blanks match exactly', async () => {
    const builder = mockBuilder(JSON.stringify({ results: [] }));
    const grader = new FillBlankGrader(builder);
    await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '平方差', s2_1: 'a²-b²' },
    });
    expect((builder.callLlm as jest.Mock)).not.toHaveBeenCalled();
  });

  it('passes correct options to callLlm', async () => {
    const builder = mockBuilder(JSON.stringify({
      results: [{ index: 0, equivalent: true }],
    }));
    const grader = new FillBlankGrader(builder);
    await grader.grade(baseKey, {
      blanks: { s1_1: '和', s1_2: '差', s1_3: '两数平方之差', s2_1: 'a²-b²' },
    });
    const callArgs = (builder.callLlm as jest.Mock).mock.calls[0];
    expect(callArgs[2]).toEqual({
      maxTokens: 256,
      temperature: 0,
      responseFormat: { type: 'json_object' },
    });
  });
});
