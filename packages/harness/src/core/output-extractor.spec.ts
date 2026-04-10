import { extractOutput } from './output-extractor';
import type { SessionResult, OutputSchema } from './interfaces';

const schema: OutputSchema = {
  id: 'eval-report',
  name: 'Evaluation Report',
  fields: [
    { key: 'score', type: 'number', required: true, description: 'Score' },
    { key: 'summary', type: 'string', required: true, description: 'Summary' },
    { key: 'details', type: 'object', required: false, description: 'Details' },
  ],
};

function makeResult(text: string): SessionResult {
  return {
    text,
    tokensUsed: { inputTokens: 100, outputTokens: 50 },
    finishReason: 'completed',
  };
}

describe('extractOutput', () => {
  it('parses direct JSON', () => {
    const result = makeResult(JSON.stringify({ score: 85, summary: 'Good' }));
    const output = extractOutput(result, schema);
    expect(output.score).toBe(85);
    expect(output.summary).toBe('Good');
  });

  it('extracts JSON from markdown code block', () => {
    const text = 'Here is the result:\n```json\n{"score": 72, "summary": "OK"}\n```';
    const output = extractOutput(makeResult(text), schema);
    expect(output.score).toBe(72);
    expect(output.summary).toBe('OK');
  });

  it('extracts JSON from code block without language tag', () => {
    const text = '```\n{"score": 65, "summary": "Fair"}\n```';
    const output = extractOutput(makeResult(text), schema);
    expect(output.score).toBe(65);
    expect(output.summary).toBe('Fair');
  });

  it('sets required fields to null when missing', () => {
    const text = JSON.stringify({ score: 80 });
    const output = extractOutput(makeResult(text), schema);
    expect(output.score).toBe(80);
    expect(output.summary).toBeNull();
  });

  it('omits optional fields when missing', () => {
    const text = JSON.stringify({ score: 80, summary: 'Good' });
    const output = extractOutput(makeResult(text), schema);
    expect(output).not.toHaveProperty('details');
  });

  it('returns null for required fields when text is not JSON', () => {
    const output = extractOutput(makeResult('plain text response'), schema);
    expect(output.score).toBeNull();
    expect(output.summary).toBeNull();
  });

  it('ignores array JSON values', () => {
    const output = extractOutput(makeResult('[1, 2, 3]'), schema);
    expect(output.score).toBeNull();
  });
});
