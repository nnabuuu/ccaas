/**
 * Diff Utilities
 *
 * Functions for formatting and displaying file differences between versions.
 */

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  lineNumber: number | null
  content: string
}

export interface DiffStats {
  additions: number
  deletions: number
  unchanged: number
}

/**
 * Simple line-by-line diff algorithm
 * For more complex diffs, consider integrating a library like 'diff'
 */
export function computeLineDiff(oldContent: string, newContent: string): {
  lines: DiffLine[]
  stats: DiffStats
} {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  const lines: DiffLine[] = []
  const stats: DiffStats = {
    additions: 0,
    deletions: 0,
    unchanged: 0,
  }

  // Simple LCS-based diff (Longest Common Subsequence)
  const lcs = longestCommonSubsequence(oldLines, newLines)
  const lcsSet = new Set(lcs)

  let oldIdx = 0
  let newIdx = 0

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx]
    const newLine = newLines[newIdx]

    // Both lines are in LCS - unchanged
    if (oldLine === newLine && lcsSet.has(oldLine)) {
      lines.push({
        type: 'unchanged',
        lineNumber: newIdx + 1,
        content: newLine,
      })
      stats.unchanged++
      oldIdx++
      newIdx++
    }
    // Old line not in new - removed
    else if (oldIdx < oldLines.length && !lcsSet.has(oldLine)) {
      lines.push({
        type: 'removed',
        lineNumber: null,
        content: oldLine,
      })
      stats.deletions++
      oldIdx++
    }
    // New line not in old - added
    else if (newIdx < newLines.length) {
      lines.push({
        type: 'added',
        lineNumber: newIdx + 1,
        content: newLine,
      })
      stats.additions++
      newIdx++
    } else {
      break
    }
  }

  return { lines, stats }
}

/**
 * Longest Common Subsequence algorithm
 */
function longestCommonSubsequence(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length
  const n = arr2.length
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0))

  // Build LCS table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = []
  let i = m
  let j = n
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1])
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return lcs
}

/**
 * Format file size difference with color
 */
export function formatSizeDiff(sizeDiff: number): {
  text: string
  color: 'green' | 'red' | 'gray'
} {
  if (sizeDiff === 0) {
    return { text: 'No change', color: 'gray' }
  }

  const absSize = Math.abs(sizeDiff)
  const sizeStr =
    absSize < 1024
      ? `${absSize} B`
      : absSize < 1024 * 1024
      ? `${(absSize / 1024).toFixed(1)} KB`
      : `${(absSize / (1024 * 1024)).toFixed(1)} MB`

  if (sizeDiff > 0) {
    return { text: `+${sizeStr}`, color: 'green' }
  } else {
    return { text: `-${sizeStr}`, color: 'red' }
  }
}

/**
 * Get color class for diff stats
 */
export function getDiffColor(type: 'added' | 'removed' | 'unchanged'): {
  bg: string
  text: string
  border: string
} {
  switch (type) {
    case 'added':
      return {
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-l-green-500',
      }
    case 'removed':
      return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-l-red-500',
      }
    case 'unchanged':
      return {
        bg: 'bg-transparent',
        text: 'text-slate-600 dark:text-slate-400',
        border: 'border-l-transparent',
      }
  }
}
