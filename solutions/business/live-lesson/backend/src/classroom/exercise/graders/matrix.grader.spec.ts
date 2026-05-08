import { MatrixGrader, textQuality } from './matrix.grader';
import type { MatrixAnswerKey } from '../../../schemas';

// ── textQuality (pure function) ──

describe('textQuality', () => {
  it('returns 0 for undefined', () => {
    expect(textQuality(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(textQuality('')).toBe(0);
    expect(textQuality('   ')).toBe(0);
  });

  it('returns 1 for short text (< 15 chars)', () => {
    expect(textQuality('短')).toBe(1);
    expect(textQuality('hello world!!')).toBe(1); // 13 chars
  });

  it('returns 2 for medium text (15-59 chars)', () => {
    expect(textQuality('a'.repeat(15))).toBe(2);
    expect(textQuality('a'.repeat(59))).toBe(2);
  });

  it('returns 3 for long text (>= 60 chars)', () => {
    expect(textQuality('a'.repeat(60))).toBe(3);
  });

  it('trims whitespace before measuring', () => {
    expect(textQuality('  ab  ')).toBe(1); // trimmed = 2 chars
  });
});

// ── MatrixGrader (heuristic path, no LLM) ──

describe('MatrixGrader', () => {
  const grader = new MatrixGrader(); // no aiPromptBuilder → heuristic path

  const key: MatrixAnswerKey = {
    type: 'matrix',
    answers: [
      { rowIdx: 0, place: 'Rome', isDemo: true, practice: 'demo', reason: 'demo' },
      { rowIdx: 1, place: 'Paris', practice: 'art', reason: 'culture' },
      { rowIdx: 2, place: 'Tokyo', practice: 'tech', reason: 'innovation' },
    ],
  };

  it('filters out demo rows for scoring', async () => {
    const result = await grader.grade(key, {
      rows: [
        { place: 'Rome', practice: 'demo', reason: 'demo' },
        { place: 'Paris', practice: 'art', reason: 'culture' },
        { place: 'Tokyo', practice: 'tech', reason: 'innovation' },
      ],
    });
    // Only rows 1 and 2 are scored; demo row 0 is excluded
    expect(result.total).toBe(100);
    expect(result.byDimension.place).toBe(100);
  });

  it('scores 0 when all wrong', async () => {
    const result = await grader.grade(key, {
      rows: [
        { place: 'Rome', practice: 'demo', reason: 'demo' },
        { place: 'wrong', practice: 'wrong', reason: 'wrong' },
        { place: 'wrong', practice: 'wrong', reason: 'wrong' },
      ],
    });
    expect(result.total).toBe(0);
  });

  it('uses substring matching for place', async () => {
    const result = await grader.grade(key, {
      rows: [
        {},
        { place: 'the city of Paris is', practice: 'art', reason: 'culture' },
        { place: 'Tokyo', practice: 'tech', reason: 'innovation' },
      ],
    });
    expect(result.byDimension.place).toBe(100);
  });

  it('accepts what/why aliases for practice/reason', async () => {
    const result = await grader.grade(key, {
      rows: [
        {},
        { place: 'Paris', what: 'art', why: 'culture' },
        { place: 'Tokyo', what: 'tech', why: 'innovation' },
      ],
    });
    expect(result.byDimension.practice).toBe(100);
    expect(result.byDimension.reason).toBe(100);
  });

  it('handles empty rows — empty practice/reason match empty answer', async () => {
    // When student rows are missing, sPractice/sReason are '' which
    // matches empty practice/reason via ''.includes('') === true.
    // Only place (non-empty in key) fails.
    const result = await grader.grade(key, { rows: [] });
    expect(result.byDimension.place).toBe(0);
    expect(result.byDimension.practice).toBe(100);
    expect(result.byDimension.reason).toBe(100);
  });

  it('returns cellQualities using heuristic', async () => {
    const result = await grader.grade(key, {
      rows: [
        {},
        { place: 'Paris', practice: 'a'.repeat(60), reason: '' },
        { place: 'Tokyo', practice: 'short', reason: 'x'.repeat(20) },
      ],
    });
    expect(result.cellQualities).toBeDefined();
    // Row 1: whatQ=3 (60 chars), whyQ=0 (empty)
    expect(result.cellQualities!['1'].whatQ).toBe(3);
    expect(result.cellQualities!['1'].whyQ).toBe(0);
    // Row 2: whatQ=1 (5 chars), whyQ=2 (20 chars)
    expect(result.cellQualities!['2'].whatQ).toBe(1);
    expect(result.cellQualities!['2'].whyQ).toBe(2);
  });

  it('is case-insensitive for matching', async () => {
    const result = await grader.grade(key, {
      rows: [
        {},
        { place: 'PARIS', practice: 'ART', reason: 'CULTURE' },
        { place: 'tokyo', practice: 'TECH', reason: 'Innovation' },
      ],
    });
    expect(result.total).toBe(100);
  });
});
