/**
 * Fuzzy Search Engine — Unit Tests
 *
 * Tests the bigram/token/substring scoring algorithm and end-to-end search.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  extractBigrams,
  bigramScore,
  tokenize,
  tokenScore,
  substringBonus,
  exactMatchBonus,
  scoreCandidate,
  fuzzySearchKnowledgePoints,
} from '../fuzzy-search.js';
import { jsonDataLoader, type KnowledgePoint } from '../json-data-loader.js';

// ─── Bigram Tests ────────────────────────────────────────────────────────────

describe('extractBigrams', () => {
  it('should extract bigrams from Chinese text', () => {
    const bigrams = extractBigrams('一元方程');
    expect(bigrams).toEqual(new Set(['一元', '元方', '方程']));
  });

  it('should return empty set for single char', () => {
    expect(extractBigrams('方').size).toBe(0);
  });

  it('should return empty set for empty string', () => {
    expect(extractBigrams('').size).toBe(0);
  });

  it('should strip whitespace before computing bigrams', () => {
    const bigrams = extractBigrams('一元 方程');
    expect(bigrams).toEqual(new Set(['一元', '元方', '方程']));
  });

  it('should handle English text', () => {
    const bigrams = extractBigrams('abc');
    expect(bigrams).toEqual(new Set(['ab', 'bc']));
  });
});

describe('bigramScore', () => {
  it('should return 1.0 for identical strings', () => {
    const q = extractBigrams('方程');
    const c = extractBigrams('方程');
    expect(bigramScore(q, c)).toBe(1.0);
  });

  it('should return partial overlap for similar strings', () => {
    const q = extractBigrams('一元方程');
    const c = extractBigrams('一元一次方程');
    // q = {一元, 元方, 方程}, c = {一元, 元一, 一次, 次方, 方程}
    // overlap = {一元, 方程} = 2 / 3
    expect(bigramScore(q, c)).toBeCloseTo(2 / 3, 4);
  });

  it('should return 0 for completely different strings', () => {
    const q = extractBigrams('勾股定理');
    const c = extractBigrams('化学方程式');
    expect(bigramScore(q, c)).toBe(0);
  });

  it('should return 0 for empty query bigrams', () => {
    const q = new Set<string>();
    const c = extractBigrams('方程');
    expect(bigramScore(q, c)).toBe(0);
  });
});

// ─── Token Tests ─────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('should split on whitespace', () => {
    expect(tokenize('二次 函数')).toEqual(['二次', '函数']);
  });

  it('should split on Chinese punctuation', () => {
    expect(tokenize('方程，不等式')).toEqual(['方程', '不等式']);
  });

  it('should handle mixed delimiters', () => {
    expect(tokenize('函数、方程 解法')).toEqual(['函数', '方程', '解法']);
  });

  it('should return empty for empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('should return single token for no delimiters', () => {
    expect(tokenize('二次函数')).toEqual(['二次函数']);
  });
});

describe('tokenScore', () => {
  it('should return 1.0 when all tokens match', () => {
    expect(tokenScore(['二次函数'], '二次函数的图象与性质')).toBe(1.0);
  });

  it('should return 0.5 when half of tokens match', () => {
    expect(tokenScore(['函数', '矩阵'], '二次函数的图象与性质')).toBe(0.5);
  });

  it('should return 0 when no tokens match', () => {
    expect(tokenScore(['矩阵', '行列式'], '二次函数的图象与性质')).toBe(0);
  });

  it('should return 0 for empty tokens', () => {
    expect(tokenScore([], '二次函数')).toBe(0);
  });
});

// ─── Substring Bonus Tests ───────────────────────────────────────────────────

describe('substringBonus', () => {
  it('should return 1.0 when query is substring of candidate', () => {
    expect(substringBonus('方程', '一元一次方程的解法')).toBe(1.0);
  });

  it('should return 1.0 when candidate is substring of query', () => {
    expect(substringBonus('一元一次方程的解法', '方程')).toBe(1.0);
  });

  it('should return 0 when neither is substring', () => {
    expect(substringBonus('勾股定理', '化学方程式')).toBe(0);
  });

  it('should strip whitespace before comparison', () => {
    expect(substringBonus('一元 方程', '一元方程的解法')).toBe(1.0);
  });
});

// ─── scoreCandidate Tests ────────────────────────────────────────────────────

describe('exactMatchBonus', () => {
  it('should return 1.0 for identical strings', () => {
    expect(exactMatchBonus('方程', '方程')).toBe(1.0);
  });

  it('should return 1.0 ignoring whitespace', () => {
    expect(exactMatchBonus('二次函数', '   二次函数')).toBe(1.0);
  });

  it('should return 0 for different strings', () => {
    expect(exactMatchBonus('方程', '方程式')).toBe(0);
  });
});

describe('scoreCandidate', () => {
  it('should give higher score to exact match', () => {
    const query = '二次函数';
    const qBg = extractBigrams(query);
    const qTk = tokenize(query);

    const exact = scoreCandidate(query, '二次函数', true, qBg, qTk);
    const partial = scoreCandidate(query, '二次函数的图象与性质', true, qBg, qTk);

    // Exact match gets exactMatchBonus=0.2, partial does not
    expect(exact).toBeGreaterThan(partial);
  });

  it('should give leaf bonus to leaf nodes', () => {
    const query = '方程';
    const qBg = extractBigrams(query);
    const qTk = tokenize(query);

    const leaf = scoreCandidate(query, '方程', true, qBg, qTk);
    const nonLeaf = scoreCandidate(query, '方程', false, qBg, qTk);

    expect(leaf).toBeGreaterThan(nonLeaf);
    expect(leaf - nonLeaf).toBeCloseTo(0.05, 4);
  });

  it('should return low score for unrelated strings', () => {
    const query = '勾股定理';
    const qBg = extractBigrams(query);
    const qTk = tokenize(query);

    const score = scoreCandidate(query, '化学方程式', false, qBg, qTk);
    expect(score).toBeLessThan(0.1);
  });
});

// ─── Integration Tests with Real Data ────────────────────────────────────────

describe('fuzzySearchKnowledgePoints (real data)', () => {
  beforeAll(() => {
    jsonDataLoader.load();
  });

  const getFullName = (id: string) => jsonDataLoader.getFullName(id);

  it('should find "二次函数" with fuzzy search', () => {
    const candidates = jsonDataLoader.getAllKnowledgePoints();
    const results = fuzzySearchKnowledgePoints('二次函数', candidates, getFullName, { topK: 10 });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('二次函数');
    expect(results[0].score).toBeGreaterThan(0.5);
  });

  it('should find "一元一次方程" even when exact name differs', () => {
    const candidates = jsonDataLoader.getAllKnowledgePoints();
    const results = fuzzySearchKnowledgePoints('一元一次方程', candidates, getFullName, { topK: 10 });

    expect(results.length).toBeGreaterThan(0);
    // Should find nodes containing "一元一次方程" even if name is "一元一次方程的解法"
    const hasMatch = results.some(r => r.name.includes('一元一次方程'));
    expect(hasMatch).toBe(true);
  });

  it('should narrow results with subject-scoped candidates', () => {
    // Get only math subject KPs
    const allKPs = jsonDataLoader.getAllKnowledgePoints();
    const mathSubjectId = allKPs.find(kp => kp.gradeLevel === '初中')?.subjectId;
    if (!mathSubjectId) return; // skip if no data

    const mathCandidates = jsonDataLoader.getKnowledgePointsBySubject(mathSubjectId);
    const allResults = fuzzySearchKnowledgePoints('函数', allKPs, getFullName, { topK: 20 });
    const scopedResults = fuzzySearchKnowledgePoints('函数', mathCandidates, getFullName, { topK: 20 });

    // Scoped should have fewer or equal results
    expect(scopedResults.length).toBeLessThanOrEqual(allResults.length);
    // All scoped results should be from the same subject
    scopedResults.forEach(r => expect(r.subjectId).toBe(mathSubjectId));
  });

  it('should respect threshold parameter', () => {
    const candidates = jsonDataLoader.getAllKnowledgePoints();

    const lowThreshold = fuzzySearchKnowledgePoints('函数', candidates, getFullName, { topK: 50, threshold: 0.05 });
    const highThreshold = fuzzySearchKnowledgePoints('函数', candidates, getFullName, { topK: 50, threshold: 0.5 });

    expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
  });

  it('should respect topK parameter', () => {
    const candidates = jsonDataLoader.getAllKnowledgePoints();
    const results = fuzzySearchKnowledgePoints('方程', candidates, getFullName, { topK: 3 });

    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('should return empty for empty query', () => {
    const candidates = jsonDataLoader.getAllKnowledgePoints();
    const results = fuzzySearchKnowledgePoints('', candidates, getFullName);
    expect(results).toEqual([]);
  });

  it('should return results sorted by score descending', () => {
    const candidates = jsonDataLoader.getAllKnowledgePoints();
    const results = fuzzySearchKnowledgePoints('二次函数', candidates, getFullName, { topK: 10 });

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should include fullName and pathNames in results', () => {
    const candidates = jsonDataLoader.getAllKnowledgePoints();
    const results = fuzzySearchKnowledgePoints('勾股定理', candidates, getFullName, { topK: 5 });

    expect(results.length).toBeGreaterThan(0);
    const first = results[0];
    expect(first.fullName).toBeTruthy();
    expect(first.pathNames.length).toBeGreaterThan(0);
    expect(first.fullName).toContain('>');
  });

  it('should find 勾股定理-related leaf nodes', () => {
    const candidates = jsonDataLoader.getAllKnowledgePoints();
    const results = fuzzySearchKnowledgePoints('勾股定理', candidates, getFullName, { topK: 10 });

    // "勾股定理" itself is a parent node; its children are leaves (e.g. "勾股定理及其证明")
    const leafResults = results.filter(r => r.isLeaf && r.name.includes('勾股定理'));
    expect(leafResults.length).toBeGreaterThan(0);
    // Leaf children should rank high thanks to substring + bigram overlap
    expect(leafResults[0].score).toBeGreaterThan(0.5);
  });
});
