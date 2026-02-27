/**
 * Fuzzy Search Engine for Knowledge Points
 *
 * Pure TypeScript implementation — no external dependencies.
 *
 * Scoring algorithm:
 *   finalScore = 0.4 * bigramScore + 0.25 * tokenScore + 0.1 * substringBonus + 0.2 * exactBonus + 0.05 * leafBonus
 *
 * Where:
 * - bigramScore:    character bigram overlap between query and candidate name
 * - tokenScore:     fraction of query tokens that appear in candidate name
 * - substringBonus: 1.0 if query is substring of candidate (or vice versa), else 0
 * - exactBonus:     1.0 if query exactly equals candidate name (after whitespace normalization), else 0
 * - leafBonus:      1.0 if the candidate is a leaf node, else 0
 */

import type { KnowledgePoint } from './json-data-loader.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScoredResult {
  id: string;
  name: string;
  fullName: string;
  pathNames: string[];
  score: number;
  isLeaf: boolean;
  level: number;
  subjectId: string;
  gradeLevel: string;
}

export interface FuzzySearchOptions {
  topK?: number;
  threshold?: number;
}

// ─── Bigram Helpers ──────────────────────────────────────────────────────────

/**
 * Extract character bigrams from a string.
 * E.g. "一元方程" → Set{"一元", "元方", "方程"}
 */
export function extractBigrams(text: string): Set<string> {
  const bigrams = new Set<string>();
  const cleaned = text.replace(/\s+/g, '');
  for (let i = 0; i < cleaned.length - 1; i++) {
    bigrams.add(cleaned[i] + cleaned[i + 1]);
  }
  return bigrams;
}

/**
 * Compute bigram overlap score: |intersection| / |queryBigrams|.
 * Returns 0 if query has fewer than 2 characters.
 */
export function bigramScore(queryBigrams: Set<string>, candidateBigrams: Set<string>): number {
  if (queryBigrams.size === 0) return 0;
  let overlap = 0;
  for (const bg of queryBigrams) {
    if (candidateBigrams.has(bg)) overlap++;
  }
  return overlap / queryBigrams.size;
}

// ─── Token Helpers ───────────────────────────────────────────────────────────

/**
 * Split text into tokens by whitespace and common CJK punctuation.
 * E.g. "二次函数的图象" → ["二次函数的图象"]
 * E.g. "二次 函数" → ["二次", "函数"]
 */
export function tokenize(text: string): string[] {
  return text
    .split(/[\s,，。、；;：:（）()\[\]【】""''""''·\-—]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

/**
 * Compute token overlap score: fraction of query tokens found as substrings in candidate.
 */
export function tokenScore(queryTokens: string[], candidateName: string): number {
  if (queryTokens.length === 0) return 0;
  let matched = 0;
  for (const token of queryTokens) {
    if (candidateName.includes(token)) matched++;
  }
  return matched / queryTokens.length;
}

// ─── Substring Bonus ─────────────────────────────────────────────────────────

/**
 * Returns 1.0 if query is a substring of candidate or candidate is a substring of query.
 * Otherwise returns 0.
 */
export function substringBonus(query: string, candidateName: string): number {
  const q = query.replace(/\s+/g, '');
  const c = candidateName.replace(/\s+/g, '');
  if (c.includes(q) || q.includes(c)) return 1.0;
  return 0;
}

// ─── Exact Match Bonus ───────────────────────────────────────────────────────

/**
 * Returns 1.0 if query exactly equals candidate name (after whitespace normalization).
 */
export function exactMatchBonus(query: string, candidateName: string): number {
  const q = query.replace(/\s+/g, '');
  const c = candidateName.replace(/\s+/g, '');
  return q === c ? 1.0 : 0;
}

// ─── Main Search Function ────────────────────────────────────────────────────

/**
 * Score a single candidate against a query.
 */
export function scoreCandidate(
  query: string,
  candidateName: string,
  isLeaf: boolean,
  queryBigrams: Set<string>,
  queryTokens: string[],
): number {
  const candidateBigrams = extractBigrams(candidateName);
  const bg = bigramScore(queryBigrams, candidateBigrams);
  const tk = tokenScore(queryTokens, candidateName);
  const sub = substringBonus(query, candidateName);
  const exact = exactMatchBonus(query, candidateName);
  const leaf = isLeaf ? 1.0 : 0;

  return 0.4 * bg + 0.25 * tk + 0.1 * sub + 0.2 * exact + 0.05 * leaf;
}

/**
 * Fuzzy search knowledge points against a query string.
 *
 * @param query - The search query (e.g. "一元一次方程")
 * @param candidates - Array of KnowledgePoint to search within
 * @param getFullName - Function to look up fullName/pathNames for a KP id
 * @param options - topK (default 10), threshold (default 0.1)
 * @returns Scored results sorted by score descending
 */
export function fuzzySearchKnowledgePoints(
  query: string,
  candidates: KnowledgePoint[],
  getFullName: (id: string) => { pathNames: string[]; fullName: string } | undefined,
  options?: FuzzySearchOptions,
): ScoredResult[] {
  const topK = options?.topK ?? 10;
  const threshold = options?.threshold ?? 0.1;

  if (!query || query.trim().length === 0) return [];

  const trimmedQuery = query.trim();
  const queryBigrams = extractBigrams(trimmedQuery);
  const queryTokens = tokenize(trimmedQuery);

  const scored: ScoredResult[] = [];

  for (const kp of candidates) {
    const name = kp.name.trim();
    const isLeaf = kp.children.length === 0;
    const score = scoreCandidate(trimmedQuery, name, isLeaf, queryBigrams, queryTokens);

    if (score >= threshold) {
      const cached = getFullName(kp.id);
      scored.push({
        id: kp.id,
        name,
        fullName: cached?.fullName ?? name,
        pathNames: cached?.pathNames ?? [name],
        score: Math.round(score * 10000) / 10000, // 4 decimal places
        isLeaf,
        level: kp.level,
        subjectId: kp.subjectId,
        gradeLevel: kp.gradeLevel,
      });
    }
  }

  // Sort by score descending, then by level descending (deeper = more specific)
  scored.sort((a, b) => b.score - a.score || b.level - a.level);

  return scored.slice(0, topK);
}
