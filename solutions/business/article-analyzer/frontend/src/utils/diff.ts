export interface DiffSegment {
  type: 'added' | 'removed' | 'equal';
  text: string;
}

/**
 * Compute a word-level diff between two strings.
 * Uses a simple LCS (Longest Common Subsequence) approach on word arrays.
 */
export function wordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  const lcs = computeLCS(oldWords, newWords);
  const result: DiffSegment[] = [];

  let oi = 0;
  let ni = 0;

  for (const match of lcs) {
    // Words removed from old before this match
    if (oi < match.oldIdx) {
      result.push({ type: 'removed', text: oldWords.slice(oi, match.oldIdx).join('') });
    }
    // Words added in new before this match
    if (ni < match.newIdx) {
      result.push({ type: 'added', text: newWords.slice(ni, match.newIdx).join('') });
    }
    // Matching word
    result.push({ type: 'equal', text: oldWords[match.oldIdx] });
    oi = match.oldIdx + 1;
    ni = match.newIdx + 1;
  }

  // Trailing removed words
  if (oi < oldWords.length) {
    result.push({ type: 'removed', text: oldWords.slice(oi).join('') });
  }
  // Trailing added words
  if (ni < newWords.length) {
    result.push({ type: 'added', text: newWords.slice(ni).join('') });
  }

  return mergeSegments(result);
}

/** Tokenize text into words, preserving whitespace as part of tokens. */
function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) || [];
}

interface LCSMatch {
  oldIdx: number;
  newIdx: number;
}

/** Compute LCS matches between two word arrays. */
function computeLCS(a: string[], b: string[]): LCSMatch[] {
  const m = a.length;
  const n = b.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack to find matches
  const matches: LCSMatch[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      matches.push({ oldIdx: i, newIdx: j });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  return matches;
}

/** Merge consecutive segments of the same type. */
function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];
  const merged: DiffSegment[] = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const last = merged[merged.length - 1];
    if (last.type === segments[i].type) {
      last.text += segments[i].text;
    } else {
      merged.push({ ...segments[i] });
    }
  }
  return merged;
}
