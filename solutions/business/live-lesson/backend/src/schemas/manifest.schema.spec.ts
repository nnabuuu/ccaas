import { ManifestSchema, ReadingStepSchema, PersonalTouchSchema, BonusArticleSchema, BonusStepSchema } from './manifest.schema';
import * as fs from 'fs';
import * as path from 'path';

describe('ManifestSchema', () => {
  const manifestPath = path.resolve(__dirname, '../../../data/lessons/ideal-beauty-reading/manifest.json');
  let manifest: unknown;

  beforeAll(() => {
    const raw = fs.readFileSync(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
  });

  it('should parse the full ideal-beauty-reading manifest', () => {
    const result = ManifestSchema.safeParse(manifest);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      fail(`Manifest validation failed:\n${issues.join('\n')}`);
    }
    expect(result.success).toBe(true);
  });

  it('should reject manifest missing required top-level fields', () => {
    const result = ManifestSchema.safeParse({ title: 'test' });
    expect(result.success).toBe(false);
  });

  it('should reject manifest with empty readingSteps', () => {
    const result = ManifestSchema.safeParse({
      id: 'test', title: 'Test', subject: 's', gradeLevel: 'g', lessonType: 'reading',
      article: { title: 'T', source: 'S', paragraphs: [{ id: 'p1', text: 'hello' }] },
      readingSteps: [],
    });
    expect(result.success).toBe(false);
  });

  it('should validate a minimal task step', () => {
    const result = ReadingStepSchema.safeParse({
      id: 's1', idx: 1, label: 'Test Task', type: 'task',
    });
    expect(result.success).toBe(true);
  });

  it('should catch invalid answerKey type in a step', () => {
    const result = ReadingStepSchema.safeParse({
      id: 's1', idx: 1, label: 'Test', type: 'task',
      answerKey: { type: 'quiz', answers: 'not-an-array' },
    });
    expect(result.success).toBe(false);
  });

  it('should validate a step with studentView', () => {
    const result = ReadingStepSchema.safeParse({
      id: 'i0', idx: 0, label: 'Intro', type: 'instruction',
      studentView: { title: 'Hello', body: '<p>World</p>', keyPoints: ['a', 'b'] },
    });
    expect(result.success).toBe(true);
  });

  it('should reject studentView missing body', () => {
    const result = ReadingStepSchema.safeParse({
      id: 'i0', idx: 0, label: 'Intro', type: 'instruction',
      studentView: { title: 'Hello' },
    });
    expect(result.success).toBe(false);
  });

  it('should allow passthrough fields on manifest', () => {
    const result = ManifestSchema.safeParse({
      id: 'test', title: 'Test', subject: 's', gradeLevel: 'g', lessonType: 'reading',
      article: { title: 'T', source: 'S', paragraphs: [{ id: 'p1', text: 'hello' }] },
      readingSteps: [{ id: 's1', idx: 0, label: 'Step' }],
      boardData: { custom: true },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).boardData).toEqual({ custom: true });
    }
  });
});

describe('PersonalTouchSchema', () => {
  it('should validate a correct personalTouch config', () => {
    const result = PersonalTouchSchema.safeParse({
      strategyLabels: [
        { taskIdx: 1, strategy: 'Predicting', emoji: '🔮' },
        { taskIdx: 2, strategy: 'Skimming', emoji: '👁' },
      ],
      tiers: [
        { minScore: 85, label: '策略达人', labelEn: 'Strategy Master', tone: 'gold' },
        { minScore: 0, label: '继续加油', labelEn: 'Keep Practicing', tone: 'neutral' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty strategyLabels', () => {
    const result = PersonalTouchSchema.safeParse({
      strategyLabels: [],
      tiers: [{ minScore: 0, label: 'x', labelEn: 'x', tone: 'neutral' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid tone value', () => {
    const result = PersonalTouchSchema.safeParse({
      strategyLabels: [{ taskIdx: 1, strategy: 'Test', emoji: '📖' }],
      tiers: [{ minScore: 0, label: 'x', labelEn: 'x', tone: 'rainbow' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative taskIdx', () => {
    const result = PersonalTouchSchema.safeParse({
      strategyLabels: [{ taskIdx: -1, strategy: 'Test', emoji: '📖' }],
      tiers: [{ minScore: 0, label: 'x', labelEn: 'x', tone: 'neutral' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('BonusArticleSchema', () => {
  it('should validate a correct bonus article', () => {
    const result = BonusArticleSchema.safeParse({
      title: 'Beyond the Plate',
      paragraphs: [
        { id: 'bp1', text: 'Intro text...', role: 'introduction' },
        { id: 'bp2', text: 'Example text...', role: 'example' },
        { id: 'bp3', text: 'Conclusion text...', role: 'conclusion' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid paragraph role', () => {
    const result = BonusArticleSchema.safeParse({
      title: 'Test',
      paragraphs: [{ id: 'p1', text: 'text', role: 'detail' }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty paragraphs', () => {
    const result = BonusArticleSchema.safeParse({
      title: 'Test',
      paragraphs: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('BonusStepSchema', () => {
  it('should validate a match-type bonus step', () => {
    const result = BonusStepSchema.safeParse({
      idx: 101,
      type: 'task',
      label: '结构识别',
      labelEn: 'Structure ID',
      strategy: 'Skimming',
      answerKey: {
        type: 'match',
        options: ['A', 'B', 'C'],
        answers: [
          { pairIdx: 0, left: 'P1', correct: 'A' },
          { pairIdx: 1, left: 'P2', correct: 'B' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should validate a matrix-type bonus step', () => {
    const result = BonusStepSchema.safeParse({
      idx: 102,
      type: 'task',
      label: '矩阵构建',
      answerKey: {
        type: 'matrix',
        answers: [
          { rowIdx: 0, place: 'Japan', practice: 'slurp', reason: 'respect', isDemo: true },
          { rowIdx: 1, place: 'India', practice: 'hands', reason: 'sensory' },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('should reject non-task type', () => {
    const result = BonusStepSchema.safeParse({
      idx: 101,
      type: 'instruction',
      label: 'test',
      answerKey: { type: 'quiz', answers: [{ questionIdx: 0, correct: 0, questionText: 'Q', options: ['A', 'B'] }] },
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing answerKey', () => {
    const result = BonusStepSchema.safeParse({
      idx: 101,
      type: 'task',
      label: 'test',
    });
    expect(result.success).toBe(false);
  });
});
